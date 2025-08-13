const { google } = require('googleapis');
const creds = require('../credentials.json');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

// Estenda os plugins Day.js
dayjs.extend(utc);
dayjs.extend(timezone);

// Defina o fuso horário padrão para Recife
// 'America/Recife' é o identificador IANA para o fuso horário de Recife (UTC-3).
dayjs.tz.setDefault('America/Recife');

const spreadsheetId = '1ivM3DzWckcM4wJda0gcXxbmsZyBWOfXTrgHsKBNhD0I';

async function authSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

exports.getProdutos = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Produtos!A2:C',
  });

  return res.data.values.map(([produto, custo, preco]) => ({
    nome: produto,
    custo: custo,
    preco: preco
  }));
};

exports.getProdutoPorNome = async (nome) => {
  const produtos = await exports.getProdutos();
  return produtos.find(p => p.nome === nome);
};

exports.addVenda = async (linha) => {
  const sheets = await authSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Vendas!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [linha] }
  });
};

exports.getNovoIDPedido = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!C2:C',
  });

  const valores = res.data.values || [];
  const ultimosIDs = valores.map(v => parseInt(v[0])).filter(n => !isNaN(n));
  const ultimoID = Math.max(...ultimosIDs, 0);

  return ultimoID + 1;
};


exports.getProximaLinha = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!A2:A',
  });
  const linhas = res.data.values?.length || 0;
  return linhas + 2; // +2 porque começa da linha 2
};

exports.getProximaLinhaPedidos = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!A2:A',
  });
  const linhas = res.data.values?.length || 0;
  return linhas + 2; // +2 porque começa da linha 2
};

exports.addMultiplasVendas = async (linhas) => {
  const sheets = await authSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Vendas!A2',
    valueInputOption: 'USER_ENTERED',
    resource: { values: linhas }
  });
};

exports.addPedido = async (linha) => {
  const sheets = await authSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Pedidos!A2',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [linha] }
  });
};


// Dashboard

exports.getPedidos = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!A2:M',
  });

  const linhas = res.data.values || [];

  // Primeiro, arquivar automaticamente pedidos entregues há mais de 10 dias
  await exports.arquivarPedidosAntigos();

  return linhas
    .map((linha) => ({
      dataHora: linha[0],
      loja: linha[1],
      id: linha[2],
      nome: linha[3],
      telefone: linha[4],
      email: linha[5],
      desconto: linha[6],
      total: linha[7],
      pago: linha[8],
      restante: linha[9],
      dataEntrega: linha[10],
      status: linha[11],
      observacao: linha[12],
    }))
    .filter(pedido => pedido.status !== 'Arquivado'); // Filtrar pedidos arquivados
};

// Função para arquivar automaticamente pedidos entregues há mais de 10 dias
exports.arquivarPedidosAntigos = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!A2:M',
  });

  const linhas = res.data.values || [];
  const hoje = dayjs.tz();
    
  let pedidosVerificados = 0;
  let pedidosArquivados = 0;
  let pedidosComErro = 0;
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const status = linha[11]; // Coluna L (12ª coluna, índice 11)
    const dataEntrega = linha[10]; // Coluna K (11ª coluna, índice 10)
    const idPedido = linha[2]; // Coluna C (3ª coluna, índice 2)
    
    
    // Se o pedido está entregue e tem data de entrega
    if (status === 'Entregue' && dataEntrega) {
      pedidosVerificados++;
      try {
        
        let dataEntregaObj;
        
        // Tentar diferentes formatos de data
        if (typeof dataEntrega === 'string') {
          // Remover espaços e caracteres especiais
          const dataLimpa = dataEntrega.trim().replace(/[^\d\-]/g, '');
          
          // Tentar diferentes formatos sem timezone primeiro
          const formatos = ['YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY/MM/DD'];
          
          for (const formato of formatos) {
            try {
              dataEntregaObj = dayjs(dataLimpa, formato);
              if (dataEntregaObj.isValid()) {
                break;
              }
            } catch (error) {
            }
          }
        }
        
        if (!dataEntregaObj || !dataEntregaObj.isValid()) {
          pedidosComErro++;
          continue;
        }
        
        // Calcular quantos dias se passaram desde a entrega
        const diasDesdeEntrega = hoje.diff(dataEntregaObj, 'day');
        
        // Se passaram mais de 10 dias desde a entrega, arquivar
        if (diasDesdeEntrega > 10) {
          
          // Atualizar o status para "Arquivado"
          const linhaDestino = i + 2;
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Pedidos!L${linhaDestino}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [['Arquivado']] }
          });
          
          pedidosArquivados++;
        } 
      } catch (error) {
        console.error(`   ❌ Erro ao processar pedido #${idPedido}:`, error);
        pedidosComErro++;
      }
    } 
  }
 
};

exports.getPedidoPorID = async (id) => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!A2:M',
  });

  const linhas = res.data.values || [];
  const pedido = linhas.find(linha => String(linha[2]) === String(id));

  if (!pedido) return null;

  return {
    dataHora: pedido[0],
    loja: pedido[1],
    id: pedido[2],
    nome: pedido[3],
    telefone: pedido[4],
    email: pedido[5],
    desconto: pedido[6],
    total: pedido[7],
    pago: pedido[8],
    restante: pedido[9],
    dataEntrega: pedido[10],
    status: pedido[11],
    observacao: pedido[12],
  };
};

exports.atualizarStatusPedido = async (id, novoStatus) => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!C2:C',
  });

  const linhas = res.data.values || [];
  const index = linhas.findIndex(l => l[0] == id);

  if (index === -1) throw new Error('Pedido não encontrado.');

  const linhaDestino = index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Pedidos!L${linhaDestino}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[novoStatus]] }
  });
};

exports.getItensDoPedido = async (idPedido) => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!A2:M',
  });

  const dados = res.data.values || [];

  return dados
    .filter(l => String(l[2]) === String(idPedido))
    .map(l => ({
      loja: l[1],
      produto: l[3],
      qtd: parseInt(l[4]),
      valorTotal: l[6] ? (typeof l[6] === 'string' ? parseFloat(l[6].replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(l[6])) || 0 : 0,
      desconto: l[7] ? (typeof l[7] === 'string' ? parseFloat(l[7].replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(l[7])) || 0 : 0,
      valorPago: l[8] ? (typeof l[8] === 'string' ? parseFloat(l[8].replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(l[8])) || 0 : 0,
      formaPagamento: l[10],
      status: l[11],
      observacao: l[12] || ''
    }));
};

exports.atualizarPedidoCompleto = async (id, pago, entrega, status, obs) => {
  const sheets = await authSheets();

  // 1. Buscar todos os itens da aba Vendas com esse ID
  const resV = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!A2:M',
  });

  const valores = resV.data.values || [];
  const itensDoPedido = valores
    .map((v, i) => {
      // Tentar ler os valores como números, mesmo se estiverem em fórmulas
      const valorTotal = v[6] ? (typeof v[6] === 'string' ? parseFloat(v[6].replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(v[6])) || 0 : 0;
      const desconto = v[7] ? (typeof v[7] === 'string' ? parseFloat(v[7].replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(v[7])) || 0 : 0;
      const valorPago = v[8] ? (typeof v[8] === 'string' ? parseFloat(v[8].replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(v[8])) || 0 : 0;
      
      return { 
        linha: i + 2, 
        id: v[2], 
        produto: v[3],
        qtd: parseInt(v[4]) || 0,
        valorTotal: valorTotal,
        desconto: desconto,
        valorPago: valorPago,
        formaPagamento: v[10],
        status: v[11],
        observacao: v[12] || ''
      };
    })
    .filter(v => String(v.id) === String(id));

  if (itensDoPedido.length === 0) {
    throw new Error('Nenhum item encontrado para este pedido');
  }

  // 2. PRIMEIRO: Zerar a coluna I (valor pago) de todos os itens do pedido
  
  for (let item of itensDoPedido) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Vendas!I${item.linha}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[0]]
        }
      });
      
    } catch (error) {
      console.error(`Erro ao zerar item ${item.produto} na linha ${item.linha}:`, error);
    }
  }

  // 3. Calcular o valor restante de cada item (coluna J = valorTotal - desconto - valorPago)
  const itensComRestante = itensDoPedido.map(item => {
    const valorRestante = item.valorTotal - item.desconto; // Agora valorPago é 0
    
    return {
      ...item,
      valorPago: 0, // Zerado
      valorRestante: valorRestante
    };
  });


  // 4. Ordenar itens: primeiro os que têm débito (valor restante negativo), depois os outros
  itensComRestante.sort((a, b) => {
    // Se ambos têm débito ou ambos não têm débito, ordena por valor restante
    if ((a.valorRestante < 0 && b.valorRestante < 0) || (a.valorRestante >= 0 && b.valorRestante >= 0)) {
      return Math.abs(b.valorRestante) - Math.abs(a.valorRestante);
    }
    // Se um tem débito e outro não, o com débito vem primeiro
    return a.valorRestante < 0 ? -1 : 1;
  });

  // 5. Distribuir o valor pago sequencialmente
  let valorRestanteParaDistribuir = pago;
  const itensAtualizados = [];


  // Se todos os itens têm valor restante 0, distribuir proporcionalmente
  const todosZerados = itensComRestante.every(item => item.valorRestante === 0);
  
  if (todosZerados) {
    const valorTotalItens = itensComRestante.reduce((sum, item) => sum + item.valorTotal, 0);
    
    for (let item of itensComRestante) {
      if (valorRestanteParaDistribuir <= 0) break;
      
      const proporcao = valorTotalItens > 0 ? item.valorTotal / valorTotalItens : 1 / itensComRestante.length;
      const valorAPagar = Math.round((valorRestanteParaDistribuir * proporcao) * 100) / 100;
      
      const novoValorPago = valorAPagar; // Agora é 0 + valorAPagar
      
      itensAtualizados.push({
        ...item,
        valorPagoAtualizado: Math.round(novoValorPago * 100) / 100
      });

      valorRestanteParaDistribuir -= valorAPagar;
      
    }
  } else {
    // Lógica original para itens com débito
    for (let item of itensComRestante) {
      if (valorRestanteParaDistribuir <= 0) break;

      // Se o item tem débito (valor restante negativo), pagar o débito primeiro
      if (item.valorRestante < 0) {
        const valorNecessario = Math.abs(item.valorRestante);
        const valorAPagar = Math.min(valorRestanteParaDistribuir, valorNecessario);
        
        const novoValorPago = valorAPagar; // Agora é 0 + valorAPagar
        
        itensAtualizados.push({
          ...item,
          valorPagoAtualizado: Math.round(novoValorPago * 100) / 100
        });

        valorRestanteParaDistribuir -= valorAPagar;
      } else if (item.valorRestante > 0) {
        // Se o item ainda tem valor a pagar (valor restante positivo)
        const valorNecessario = item.valorRestante;
        const valorAPagar = Math.min(valorRestanteParaDistribuir, valorNecessario);
        
        const novoValorPago = valorAPagar; // Agora é 0 + valorAPagar
        
        itensAtualizados.push({
          ...item,
          valorPagoAtualizado: Math.round(novoValorPago * 100) / 100
        });

        valorRestanteParaDistribuir -= valorAPagar;
      }
    }
  }

  // 6. Atualizar cada item na aba Vendas com o novo valor pago
  for (let item of itensAtualizados) {
    try {
      await sheets.spreadsheets.values.update({
      spreadsheetId,
        range: `Vendas!I${item.linha}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[item.valorPagoAtualizado]]
        }
      });
    } catch (error) {
      console.error(`Erro ao atualizar item ${item.produto} na linha ${item.linha}:`, error);
    }
  }

  // 7. Atualizar aba Pedidos (mantendo o status atual)
  const resP = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!C2:C',
  });

  const linhas = resP.data.values || [];
  const index = linhas.findIndex(l => String(l[0]) === String(id));
  if (index === -1) throw new Error('Pedido não encontrado');

  const linhaDestino = index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Pedidos!I${linhaDestino}:M${linhaDestino}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[pago, `=I${linhaDestino}-(H${linhaDestino}-G${linhaDestino})`, entrega || '', status, obs || '']]
    }
  });

};

exports.getAvisos = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Avisos!A2:D',
  });

  const linhas = res.data.values || [];

  return linhas
    .map((l, i) => ({
      linha: i + 2,
      data: l[0] || '',
      para: l[1] || '',
      whatsapp: l[2] || '',
      texto: l[3] || '',
    }))
    .filter(l => l.data && l.texto); // 👈 ignora se estiver vazio
};

exports.salvarAviso = async ({ para, whatsapp, texto }) => {
  const sheets = await authSheets();
  const dataHora = dayjs.tz().format('DD-MM-YYYY HH:mm:ss');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Avisos!A2',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[dataHora, para, whatsapp || '', texto]]
    }
  });
};

exports.deletarAviso = async (linha) => {
  const sheets = await authSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `Avisos!A${linha}:D${linha}`
  });
};

// Função para buscar estatísticas de pedidos arquivados
exports.getEstatisticasArquivados = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!A2:M',
  });

  const linhas = res.data.values || [];
  const hoje = dayjs.tz();
  const inicioMes = hoje.startOf('month');
  
  let totalArquivados = 0;
  let arquivadosEsteMes = 0;
  let ultimoArquivamento = null;
  
  linhas.forEach(linha => {
    const status = linha[11];
    const dataHora = linha[0];
    
    if (status === 'Arquivado') {
      totalArquivados++;
      
      try {
        const dataPedido = dayjs.tz(dataHora, 'DD-MM-YYYY HH:mm:ss');
        if (dataPedido.isAfter(inicioMes)) {
          arquivadosEsteMes++;
        }
        
        if (!ultimoArquivamento || dataPedido.isAfter(ultimoArquivamento)) {
          ultimoArquivamento = dataPedido.format('DD/MM/YYYY HH:mm');
        }
      } catch (error) {
        console.error('Erro ao processar data do pedido arquivado:', error);
      }
    }
  });
  
  return {
    totalArquivados,
    arquivadosEsteMes,
    ultimoArquivamento
  };
};