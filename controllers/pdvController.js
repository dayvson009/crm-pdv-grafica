const sheets = require('../services/googleSheetsService');
const dayjs = require('dayjs');

exports.renderPdvVendas = async (req, res) => {
  const produtos = await sheets.getProdutos();
  res.render('pdvVendas', { produtos, currentPage: 'pdvVendas' });
};

exports.renderPdvPedidos = async (req, res) => {
  const produtos = await sheets.getProdutos();
  res.render('pdvPedidos', { produtos, currentPage: 'pdvPedidos' });
};

exports.registrarVenda = async (req, res) => {
  const data = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const novoID = await sheets.getNovoIDPedido();
  const linha = await sheets.getProximaLinha();

  const {
    produto,
    quantidade,
    desconto,
    valorPago,
    formaPagamento,
    status,
    observacao
  } = req.body;

  const qtd = parseInt(quantidade);

  // Deixa as colunas com fórmula vazias
  await sheets.addVenda([
    data, novoID, produto, qtd, `=SEERRO(PROCV(C${linha};Produtos!A:D;2;0)*D${linha};0)`, `=SEERRO(PROCV(C${linha};Produtos!A:D;3;0)*D${linha};0)`, desconto, valorPago, `=H${linha}-(F${linha}-G${linha})`, formaPagamento, status, observacao
  ]);

  res.redirect('/');
};


exports.registrarPedido = async (req, res) => {
  try {
    const { nome, telefone, email, dataEntrega, itens } = req.body;

    if (!nome || !telefone || !itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).send('Dados inválidos');
    }

    const dataHora = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const novoID = await sheets.getNovoIDPedido();
    const linha = await sheets.getProximaLinha();
    const linhaPedidos = await sheets.getProximaLinha();

    let valorTotal = 0;
    let valorPagoTotal = 0;
    let descontoTotal = 0;

    // 1. Registrar cada item na aba "Vendas"
    const registrosVendas = itens.map(item => {
      valorTotal += item.valorTotal;
      valorPagoTotal += item.valorPago;
      descontoTotal += item.desconto;

      return [
        dataHora,
        novoID,
        item.produto,
        item.quantidade,
        `=SEERRO(PROCV(C${linha};Produtos!A:D;2;0)*D${linha};0)`, // Custo (cálculo automático na planilha)
        `=SEERRO(PROCV(C${linha};Produtos!A:D;3;0)*D${linha};0)`, // Valor Total (idem)
        item.desconto,
        item.valorPago,
        `=H${linha}-(F${linha}-G${linha})`, // Valor Restante (cálculo automático)
        item.formaPagamento,
        'Pedidos',
        item.observacao || ''
      ];
    });

    await sheets.addMultiplasVendas(registrosVendas);

    // 2. Registrar resumo na aba "Pedidos"
    const resumoPedido = [
      dataHora,
      novoID,
      nome,
      telefone,
      email || '',
      descontoTotal,
      valorTotal,
      valorPagoTotal,
      `=H${linhaPedidos}-(F${linhaPedidos}-G${linhaPedidos})`, // Valor Restante será calculado na planilha
      dataEntrega || '',
      'Pedidos',
      '' // Observação
    ];

    await sheets.addPedido(resumoPedido);

    res.status(200).send('Pedido registrado com sucesso!');
  } catch (err) {
    console.error('Erro ao registrar pedido:', err);
    res.status(500).send('Erro interno ao registrar pedido.');
  }
};


//// DASHBOARD

exports.dashboardPedidos = async (req, res) => {
  const pedidos = await sheets.getPedidos();
  const porStatus = {};

  // Agrupar por status
  pedidos.forEach(p => {
    const status = p.status || 'Orçamentos';
    if (!porStatus[status]) porStatus[status] = [];
    porStatus[status].push(p);
  });

  res.render('painelpedidos', { porStatus, currentPage: 'painelpedidos' });
};

exports.atualizarStatusPedido = async (req, res) => {
  const { idPedido, novoStatus } = req.body;
  try {
    await sheets.atualizarStatusPedido(idPedido, novoStatus);
    res.send('Status atualizado!');
  } catch (e) {
    console.error('Erro ao atualizar status:', e);
    res.status(500).send('Erro ao atualizar status.');
  }
};

exports.getItensDoPedido = async (req, res) => {
  const id = req.query.id;
  const itens = await sheets.getItensDoPedido(id);
  res.json(itens);
};

exports.editarPedido = async (req, res) => {
  const { id, itens, pago, dataEntrega, observacao } = req.body;

  try {
    await sheets.atualizarPedidoCompleto(id, itens, pago, dataEntrega, observacao);
    res.send('Pedido atualizado com sucesso');
  } catch (e) {
    console.error('Erro ao editar pedido:', e);
    res.status(500).send('Erro ao editar pedido');
  }
};

exports.getAvisos = async (req, res) => {
  const avisos = await sheets.getAvisos();
  res.render('avisos', { avisos, currentPage: 'avisos' });
};

exports.salvarAviso = async (req, res) => {
  const { para, whatsapp, texto } = req.body;
  try {
    await sheets.salvarAviso({ para, whatsapp, texto });
    res.redirect('/avisos');
  } catch (err) {
    console.error('Erro ao salvar aviso:', err);
    res.status(500).send('Erro ao salvar aviso.');
  }
};

exports.deletarAviso = async (req, res) => {
  const { linha } = req.body;
  try {
    await sheets.deletarAviso(linha);
    res.redirect('/avisos');
  } catch (err) {
    console.error('Erro ao deletar aviso:', err);
    res.status(500).send('Erro ao deletar aviso');
  }
};
