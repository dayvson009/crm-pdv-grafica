const sheets = require('../services/googleSheetsService');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

// Estenda os plugins Day.js
dayjs.extend(utc);
dayjs.extend(timezone);

// Defina o fuso horário padrão para Recife
// 'America/Recife' é o identificador IANA para o fuso horário de Recife (UTC-3).
dayjs.tz.setDefault('America/Recife');

exports.renderPdvVendas = async (req, res) => {
  const produtos = await sheets.getProdutos();
  res.render('pdvVendas', { produtos, currentPage: 'pdvVendas' });
};

exports.renderPdvPedidos = async (req, res) => {
  const produtos = await sheets.getProdutos();
  res.render('pdvPedidos', { produtos, currentPage: 'pdvPedidos' });
};

exports.registrarVenda = async (req, res) => {
  try {
    const data = dayjs.tz().format('DD-MM-YYYY HH:mm:ss');
    const novoID = await sheets.getNovoIDPedido();
    const linha = await sheets.getProximaLinha();

    const {
      produto,
      quantidade,
      desconto,
      valorPago,
      formaPagamento,
      status,
      observacao,
      loja
    } = req.body;

    const qtd = parseInt(quantidade);

    // Deixa as colunas com fórmula vazias
    await sheets.addVenda([
      data, loja, novoID, produto, qtd, `=SEERRO(PROCV(D${linha};Produtos!A:D;2;0)*E${linha};0)`, `=SEERRO(PROCV(D${linha};Produtos!A:D;3;0)*E${linha};0)`, desconto, valorPago, `=I${linha}-(G${linha}-H${linha})`, formaPagamento, status, observacao
    ]);

    res.status(200).json({ message: 'Venda registrado com sucesso!' });

  } catch (error) {
      console.error('Erro ao registrar venda:', error);
      res.status(500).json({ message: 'Erro interno do servidor ao registrar pedido.' });
  }
};


exports.registrarPedido = async (req, res) => {
  try {
    const { nome, loja, telefone, email, dataEntrega, itens, observacaoGeral } = req.body;

    if (!nome || !telefone || !itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).send('Dados inválidos');
    }

    const dataHora = dayjs.tz().format('DD-MM-YYYY HH:mm:ss');
    const novoID = await sheets.getNovoIDPedido();
    const linha = await sheets.getProximaLinha();
    const linhaPedidos = await sheets.getProximaLinhaPedidos();

    let valorTotal = 0;
    let valorPagoTotal = 0;
    let descontoTotal = 0;

    // 1. Registrar cada item na aba "Vendas"
    const registrosVendas = itens.map((item, index) => {
      // Garantir que os valores sejam números
      const desconto = parseFloat(item.desconto) || 0;
      const valorPago = parseFloat(item.valorPago) || 0;
      const valorTotalItem = parseFloat(item.valorTotal) || 0;
      
      // Calcular o valor total bruto (antes do desconto) para este item
      const valorTotalBrutoItem = valorTotalItem + desconto;
      
      valorTotal += valorTotalBrutoItem; // Agora é o total bruto
      valorPagoTotal += valorPago;
      descontoTotal += desconto;
      
      return [
        dataHora,
        loja,
        novoID,
        item.produto,
        item.quantidade,
        `=SEERRO(PROCV(D${linha+index};Produtos!A:D;2;0)*E${linha+index};0)`, // Custo (cálculo automático na planilha)
        `=SEERRO(PROCV(D${linha+index};Produtos!A:D;3;0)*E${linha+index};0)`, // Valor Total (idem)
        desconto,
        valorPago,
        `=I${linha+index}-(G${linha+index}-H${linha+index})`, // Valor Restante (cálculo automático)
        item.formaPagamento,
        'Pedidos',
        item.observacao || ''
      ];
    });

    await sheets.addMultiplasVendas(registrosVendas);

    // Log para debug dos valores calculados
    console.log(`Pedido ${novoID}: Valor Total BRUTO: R$ ${valorTotal}, Desconto Total: R$ ${descontoTotal}, Valor Pago Total: R$ ${valorPagoTotal}`);

    // 2. Registrar resumo na aba "Pedidos"
    // Colunas: Data, Loja, ID, Nome, Telefone, Email, Desconto, Valor Total (BRUTO), Valor Pago, Valor Restante, Data Entrega, Status, Observação
    const resumoPedido = [
      dataHora,
      loja,
      novoID,
      nome,
      telefone,
      email || '',
      descontoTotal,
      valorTotal, // Valor total BRUTO (antes do desconto)
      valorPagoTotal, 
      `=I${linhaPedidos}-(H${linhaPedidos}-G${linhaPedidos})`, // Valor Restante será calculado na planilha
      dataEntrega || '',
      'Pedidos',
      observacaoGeral || '' // Observação geral do pedido
    ];
    await sheets.addPedido(resumoPedido);

    res.status(200).json({ message: 'Pedido registrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao registrar pedido:', err);
    res.status(500).json({ message: 'Erro interno do servidor ao registrar pedido.' });
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

  res.render('painelpedidos', { 
    porStatus, 
    currentPage: 'painelpedidos'
  });
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
  const { id, pago, dataEntrega, observacao } = req.body;

  try {
    // Buscar o status atual do pedido
    const itens = await sheets.getItensDoPedido(id);
    const status = itens.length > 0 ? itens[0].status : 'Pedidos';

    // Chamar a função do service para atualizar o pedido
    await sheets.atualizarPedidoCompleto(id, pago, dataEntrega, status, observacao);
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

exports.visualizarRecibo = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar o pedido pelo ID
    const pedido = await sheets.getPedidoPorID(id);
    
    if (!pedido) {
      return res.status(404).render('erro', { 
        message: 'Pedido não encontrado',
        error: 'O pedido solicitado não foi encontrado em nossa base de dados.'
      });
    }

    // Buscar itens do pedido
    const itens = await sheets.getItensDoPedido(id);
    
    // Determinar se deve mostrar dados sensíveis baseado no status
    const mostrarDadosSensiveis = pedido.status !== 'Entregue';
    
    // Preparar dados para renderização
    const dadosRecibo = {
      pedido: {
        id: pedido.id,
        nome: mostrarDadosSensiveis ? pedido.nome : 'Cliente',
        telefone: mostrarDadosSensiveis ? pedido.telefone : '***',
        email: mostrarDadosSensiveis ? (pedido.email || 'Não informado') : '***',
        loja: pedido.loja,
        status: pedido.status,
        dataHora: pedido.dataHora,
        dataEntrega: pedido.dataEntrega,
        total: pedido.total,
        desconto: pedido.desconto,
        pago: pedido.pago,
        restante: pedido.restante,
        observacao: pedido.observacao
      },
      itens: itens,
      mostrarDadosSensiveis: mostrarDadosSensiveis
    };

    res.render('recibo', { dadosRecibo });
    
  } catch (error) {
    console.error('Erro ao visualizar recibo:', error);
    res.status(500).render('erro', { 
      message: 'Erro interno do servidor',
      error: 'Ocorreu um erro ao carregar o recibo. Tente novamente mais tarde.'
    });
  }
};
