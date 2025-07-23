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

  return linhas.map((linha) => ({
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
    .filter(l => l[2] == idPedido)
    .map(l => ({
      loja: l[1],
      produto: l[3],
      qtd: parseInt(l[4]),
      desconto: (l[7]),
      valorPago: (l[8]),
      formaPagamento: l[10],
      status: l[11],
      observacao: l[12]
    }));
};

exports.atualizarPedidoCompleto = async (id, pago, entrega, status, obs) => {
  const sheets = await authSheets();

  // Apagar linhas antigas da aba Vendas com esse ID
  const resV = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Vendas!A2:M',
  });

  const valores = resV.data.values || [];
  const linhasApagar = valores.map((v, i) => ({ index: i + 2, id: v[1] }))
    .filter(v => v.id == id);

  for (let linha of linhasApagar) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `Vendas!A${linha.index}:M${linha.index}`
    });
  }

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
    range: `Pedidos!I${linhaDestino}:M${linhaDestino}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[pago, `=H${linhaDestino}-(I${linhaDestino}+G${linhaDestino})`, entrega || '', status, obs || '']]
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
