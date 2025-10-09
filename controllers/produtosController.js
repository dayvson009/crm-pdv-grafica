const sheets = require('../services/googleSheetsService');

exports.renderProdutos = async (req, res) => {
  res.render('produtos', { currentPage: 'produtos', usuario: req.session.usuario });
};

exports.cadastrarProduto = async (req, res) => {
  try {
    const { produto, custo, preco, tipo, minimo } = req.body;

    // Validações básicas
    if (!produto || !custo || !preco || !tipo) {
      return res.status(400).json({ 
        message: 'Produto, Custo, Preço e Tipo são obrigatórios.' 
      });
    }

    // Converter valores para números
    const custoNum = parseFloat(custo.replace(',', '.')) || 0;
    const precoNum = parseFloat(preco.replace(',', '.')) || 0;
    const minimoNum = parseFloat((minimo || '0').replace(',', '.')) || 0;

    if (custoNum <= 0 || precoNum <= 0) {
      return res.status(400).json({ 
        message: 'Custo e Preço devem ser maiores que zero.' 
      });
    }

    if (minimoNum < 0) {
      return res.status(400).json({ 
        message: 'Valor mínimo não pode ser negativo.' 
      });
    }

    // Verificar se produto já existe
    const produtoExistente = await sheets.getProdutoPorNome(produto);
    if (produtoExistente) {
      return res.status(400).json({ 
        message: 'Produto com este nome já existe.' 
      });
    }

    // Criar objeto com dados do produto
    const dadosProduto = {
      produto: produto.trim(),
      custo: custoNum,
      preco: precoNum,
      tipo: tipo.toLowerCase() === 'metro' ? 'metro' : 'unidade',
      minimo: minimoNum
    };

    // Cadastrar produto na planilha
    await sheets.addProduto(dadosProduto);

    res.status(200).json({ 
      message: 'Produto cadastrado com sucesso!' 
    });

  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor ao cadastrar produto.' 
    });
  }
};
