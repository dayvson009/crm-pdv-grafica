const express = require('express');
const router = express.Router();
const pdvController = require('./controllers/pdvController');

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

module.exports = router;
