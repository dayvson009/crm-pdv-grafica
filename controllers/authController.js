const bcrypt = require('bcrypt');
const sheets = require('../services/googleSheetsService'); // o mesmo que você usa para buscar dados

exports.renderLogin = (req, res) => {
  res.render('login', { erro: null });
};

exports.login = async (req, res) => {
  const { email, senha } = req.body;

  try {
    // Busca lista de vendedores
    const vendedores = await sheets.getVendedoresComSenha(); 
    // Esperado: cada item { email, senha }

    const usuario = vendedores.find(v => v.email === email);

    if (!usuario) {
      return res.render('login', { erro: 'Usuário não encontrado.' });
    }

    // Compara senha com hash da planilha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.render('login', { erro: 'Senha incorreta.' });
    }

    // Cria sessão persistente
    req.session.usuario = {
        nome: usuario.nome,
        email: usuario.email
      };
    
      res.redirect('/');

  } catch (error) {
    console.error('Erro no login:', error);
    res.render('login', { erro: 'Erro interno. Tente novamente.' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

exports.renderMudarSenha = (req, res) => {
    res.render('mudar-senha', { usuario: req.session.usuario, mensagem: null });
  };
  
  exports.mudarSenha = async (req, res) => {
    try {
      const { senhaAtual, novaSenha, confirmarSenha } = req.body;
      const email = req.session.usuario.email;
  
      if (!senhaAtual || !novaSenha || !confirmarSenha) {
        return res.render('mudar-senha', { usuario: req.session.usuario, mensagem: 'Preencha todos os campos!' });
      }
  
      if (novaSenha !== confirmarSenha) {
        return res.render('mudar-senha', { usuario: req.session.usuario, mensagem: 'As senhas não conferem!' });
      }
  
      // Busca todos os usuários
      const vendedores = await sheets.getVendedoresComSenha(); // criaremos isso já já
      const usuario = vendedores.find(u => u.email === email);
  
      if (!usuario) {
        return res.render('mudar-senha', { usuario: req.session.usuario, mensagem: 'Usuário não encontrado!' });
      }
  
      const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
      if (!senhaValida) {
        return res.render('mudar-senha', { usuario: req.session.usuario, mensagem: 'Senha atual incorreta!' });
      }
  
      // Gera novo hash
      const novoHash = await bcrypt.hash(novaSenha, 10);
  
      // Atualiza a senha no Sheets
      await sheets.atualizarSenhaVendedor(email, novoHash);
  
      res.render('mudar-senha', { usuario: req.session.usuario, mensagem: 'Senha alterada com sucesso!' });
  
    } catch (error) {
      console.error('Erro ao mudar senha:', error);
      res.render('mudar-senha', { usuario: req.session.usuario, mensagem: 'Erro ao alterar senha. Tente novamente.' });
    }
  };