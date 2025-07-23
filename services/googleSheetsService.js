const { google } = require('googleapis');
const creds = require('../credentials.json');
const dayjs = require('dayjs');

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
  console.log("Linhas"+linhas)
  return linhas + 2; // +2 porque começa da linha 2
};

exports.getProximaLinhaPedidos = async () => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!A2:A',
  });
  const linhas = res.data.values?.length || 0;
  console.log("Linhas"+linhas)
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
    range: 'Pedidos!A2:L',
  });

  const linhas = res.data.values || [];

  return linhas.map((linha) => ({
    dataHora: linha[0],
    id: linha[1],
    nome: linha[2],
    telefone: linha[3],
    email: linha[4],
    desconto: linha[5],
    total: linha[6],
    pago: linha[7],
    restante: linha[8],
    dataEntrega: linha[9],
    status: linha[10],
    observacao: linha[11],
  }));
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
    range: `Pedidos!K${linhaDestino}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[novoStatus]] }
  });
};

exports.getItensDoPedido = async (idPedido) => {
  const sheets = await authSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!A2:L',
  });

  const dados = res.data.values || [];

  return dados
    .filter(l => l[1] == idPedido)
    .map(l => ({
      produto: l[2],
      qtd: parseInt(l[3]),
      desconto: parseFloat(l[6]),
      valorPago: parseFloat(l[7]),
      formaPagamento: l[9],
      observacao: l[11]
    }));
};

exports.atualizarPedidoCompleto = async (id, itens, pago, entrega, obs) => {
  const sheets = await authSheets();

  // Apagar linhas antigas da aba Vendas com esse ID
  const resV = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!A2:L',
  });

  const valores = resV.data.values || [];
  const linhasApagar = valores.map((v, i) => ({ index: i + 2, id: v[1] }))
    .filter(v => v.id == id);

  for (let linha of linhasApagar) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `Vendas!A${linha.index}:L${linha.index}`
    });
  }

  // Inserir novamente os itens
  const dataHora = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const novasLinhas = itens.map(item => [
    dataHora, id, item.produto, item.quantidade, '', '', item.desconto,
    item.valorPago, '', item.formaPagamento, 'Pedidos', item.observacao || ''
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Vendas!A2',
    valueInputOption: 'USER_ENTERED',
    resource: { values: novasLinhas }
  });

  // Atualizar aba Pedidos
  const resP = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pedidos!C2:C',
  });

  const linhas = resP.data.values || [];
  const index = linhas.findIndex(l => l[0] == id);
  if (index === -1) throw new Error('Pedido não encontrado');

  const linhaDestino = index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Pedidos!H${linhaDestino}:L${linhaDestino}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[pago, '', entrega || '', 'Pedidos', obs || '']]
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
  const dataHora = dayjs().format('YYYY-MM-DD HH:mm:ss');

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
