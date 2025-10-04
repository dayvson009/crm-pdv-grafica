// middlewares/authMiddleware.js
module.exports = (req, res, next) => {
    // Permitir acesso às rotas públicas
    if (
      req.path === '/login' ||
      req.path === '/logout' ||
      req.path.startsWith('/recibo')
    ) {
      return next();
    }
  
    // Se não estiver logado, redireciona
    if (!req.session || !req.session.usuario) {
      return res.redirect('/login');
    }
  
    // Continua se autenticado
    next();
  };
  