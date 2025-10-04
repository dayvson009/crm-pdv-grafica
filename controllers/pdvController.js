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
  res.render('pdvVendas', { produtos, currentPage: 'pdvVendas', usuario: req.session.usuario });
};

exports.renderPdvPedidos = async (req, res) => {
  const produtos = await sheets.getProdutos();
  const vendedores = await sheets.getVendedores();
  res.render('pdvPedidos', { produtos, vendedores, currentPage: 'pdvPedidos', usuario: req.session.usuario });
};

exports.registrarVenda = async (req, res) => {
  try {
    const data = dayjs.tz().format('DD-MM-YYYY HH:mm:ss');
    const novoID = await sheets.getNovoIDPedido();

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
    const descontoNum = parseFloat(desconto) || 0;
    const valorPagoNum = parseFloat(valorPago) || 0;

    // Buscar dados do produto
    const produtoData = await sheets.getProdutoPorNome(produto);
    
    if (!produtoData) {
      return res.status(400).json({ message: 'Produto não encontrado.' });
    }

    // Calcular valores reais
    const preco = parseFloat(produtoData.preco.replace('R$ ', '').replace(',', '.')) || 0;
    const custoUnitario = parseFloat(produtoData.custo.replace('R$ ', '').replace(',', '.')) || 0;
    
    const valorTotalBruto = preco * qtd;
    const custoTotal = custoUnitario * qtd;
    const valorTotalComDesconto = valorTotalBruto - descontoNum;
    const valorRestante = valorTotalComDesconto - valorPagoNum;

    // Registrar venda com valores reais
    await sheets.addVenda([
      data, 
      loja, 
      novoID, 
      produto, 
      qtd, 
      custoTotal, // Custo total real
      valorTotalBruto, // Valor total bruto real
      descontoNum, 
      valorPagoNum, 
      valorRestante, // Valor restante real
      formaPagamento, 
      status, 
      observacao,
      preco // Nova coluna N - valor unitário
    ]);

    res.status(200).json({ message: 'Venda registrado com sucesso!' });

  } catch (error) {
      console.error('Erro ao registrar venda:', error);
      res.status(500).json({ message: 'Erro interno do servidor ao registrar pedido.' });
  }
};


exports.registrarPedido = async (req, res) => {
  try {
    const { nome, loja, telefone, email, dataEntrega, itens, observacaoGeral, vendedor } = req.body;

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

    // Buscar todos os produtos de uma vez para otimizar
    const todosProdutos = await sheets.getProdutos();
    
    // 1. Registrar cada item na aba "Vendas"
    const registrosVendas = itens.map((item, index) => {
      // Garantir que os valores sejam números
      const desconto = parseFloat(item.desconto) || 0;
      const valorPago = parseFloat(item.valorPago) || 0;
      const valorTotalItem = parseFloat(item.valorTotal) || 0;
      const valorTotalBrutoItem = parseFloat(item.valorTotalBruto) || 0;
      
      // Buscar produto na lista já carregada
      const produto = todosProdutos.find(p => p.nome === item.produto);
      
      // Calcular valor unitário baseado no tipo de produto
      let valorUnitario = 0;
      if (produto) {
        const preco = parseFloat(produto.preco.replace('R$ ', '').replace(',', '.')) || 0;
        valorUnitario = preco; // Valor unitário (por m² ou por unidade)
      }
      
      // Calcular custo unitário (coluna B da planilha Produtos)
      let custoUnitario = 0;
      if (produto) {
        custoUnitario = parseFloat(produto.custo.replace('R$ ', '').replace(',', '.')) || 0;
      }
      
      const custoTotal = custoUnitario * item.quantidade;
      const valorRestante = valorTotalItem - valorPago;
      
      valorTotal += valorTotalBrutoItem; // Agora é o total bruto
      valorPagoTotal += valorPago;
      descontoTotal += desconto;
      
      return [
        dataHora,
        loja,
        novoID,
        item.produto,
        item.quantidade,
        custoTotal, // Custo total real
        valorTotalBrutoItem, // Valor total bruto real
        desconto,
        valorPago,
        valorRestante, // Valor restante real
        item.formaPagamento,
        'Pedidos',
        item.observacao || '',
        valorUnitario // Nova coluna N - valor unitário
      ];
    });

    await sheets.addMultiplasVendas(registrosVendas);

    // 2. Registrar resumo na aba "Pedidos"
    // Colunas: Data, Loja, ID, Nome, Telefone, Email, Desconto, Valor Total (BRUTO), Valor Pago, Valor Restante, Data Entrega, Status, Observação, Vendedor
    const valorRestanteTotal = valorTotal - descontoTotal - valorPagoTotal;
    
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
      valorRestanteTotal, // Valor Restante real calculado
      dataEntrega || '',
      'Pedidos',
      observacaoGeral || '', // Observação geral do pedido
      vendedor || '' // Nova coluna N - Vendedor
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
  try {
    // Primeiro, aplicar arquivamento automático
    await sheets.arquivarPedidosAntigos();
    
    // Depois buscar os pedidos (já filtrados para excluir arquivados)
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
      currentPage: 'painelpedidos',
      usuario: req.session.usuario
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    res.status(500).send('Erro interno do servidor');
  }
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
  const pedido = await sheets.getPedidoPorID(id);
  const status = pedido.status;
  
  try {
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
  res.render('avisos', { avisos, currentPage: 'avisos', usuario: req.session.usuario });
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

exports.getEstatisticasArquivados = async (req, res) => {
  try {
    const estatisticas = await sheets.getEstatisticasArquivados();
    res.json(estatisticas);
  } catch (error) {
    console.error('Erro ao buscar estatísticas de arquivados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.testarArquivamento = async (req, res) => {
  try {
    
    // Primeiro, buscar estatísticas antes do arquivamento
    const estatisticasAntes = await sheets.getEstatisticasArquivados();
    
    // Executar o arquivamento
    await sheets.arquivarPedidosAntigos();
    
    // Buscar estatísticas depois do arquivamento
    const estatisticasDepois = await sheets.getEstatisticasArquivados();
    
    const pedidosArquivados = estatisticasDepois.totalArquivados - estatisticasAntes.totalArquivados;
    
    res.json({ 
      message: 'Teste de arquivamento concluído. Verifique os logs do console.',
      pedidosArquivados: pedidosArquivados,
      totalAntes: estatisticasAntes.totalArquivados,
      totalDepois: estatisticasDepois.totalArquivados
    });
  } catch (error) {
    console.error('Erro no teste de arquivamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
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
