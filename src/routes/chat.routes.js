const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chat.controller');
const autenticar = require('../middlewares/autenticar');

router.get('/conversaciones', autenticar, ctrl.conversaciones);
router.get('/:garajeId/:clienteId', autenticar, ctrl.mensajes);
router.post('/:garajeId/:clienteId', autenticar, ctrl.enviar);

module.exports = router;
