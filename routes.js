const express = require('express');
const router = express.Router();
const pdvController = require('./controllers/pdvController');
const produtosController = require('./controllers/produtosController');
const utilidadesController = require('./controllers/utilidadesController');
const authController = require('./controllers/authController');
const authMiddleware = require('./middlewares/authMiddleware');

// Aplica o middleware globalmente
router.use(authMiddleware);

// Rotas públicas
router.get('/login', authController.renderLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

router.get('/mudar-senha', authController.renderMudarSenha);
router.post('/mudar-senha', authController.mudarSenha);

router.get('/', pdvController.renderPdvVendas);
router.get('/pdv', pdvController.renderPdvPedidos);
router.post('/registrar-venda', pdvController.registrarVenda);
router.post('/registrar-pedido', pdvController.registrarPedido);
router.get('/painelpedidos', pdvController.dashboardPedidos);
router.post('/atualizar-status', pdvController.atualizarStatusPedido);
router.get('/itens-do-pedido', pdvController.getItensDoPedido);
router.post('/editar-pedido', pdvController.editarPedido);
router.get('/avisos', pdvController.getAvisos);
router.post('/avisos', pdvController.salvarAviso);
router.post('/avisos/deletar', pdvController.deletarAviso);
router.get('/estatisticas-arquivados', pdvController.getEstatisticasArquivados);
router.get('/recibo/:id', pdvController.visualizarRecibo);

// Rotas para produtos
router.get('/produtos', produtosController.renderProdutos);
router.post('/cadastrar-produto', produtosController.cadastrarProduto);

// Rotas para utilidades
router.get('/utilidades', utilidadesController.renderUtilidades);
router.get('/utilidades/geradorcurriculos', utilidadesController.geradorCurriculos);

module.exports = router;
