exports.renderUtilidades = async (req, res) => {
    res.render('utilidades', { currentPage: 'utilidades', usuario: req.session.usuario });
};
  
exports.geradorCurriculos = async (req, res) => {
   res.render('utilidades/geradorcurriculos', { currentPage: 'geradorcurriculos', usuario: req.session.usuario });
};