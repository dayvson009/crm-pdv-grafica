exports.renderUtilidades = async (req, res) => {
    res.render('utilidades', { currentPage: 'utilidades' });
};
  
exports.geradorCurriculos = async (req, res) => {
   res.render('utilidades/geradorcurriculos', { currentPage: 'geradorcurriculos' });
};