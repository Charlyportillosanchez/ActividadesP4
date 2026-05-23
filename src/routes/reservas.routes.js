const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reservas.controller');
const autenticar = require('../middlewares/autenticar');

router.get('/', autenticar, ctrl.getAll);
router.post('/', autenticar, ctrl.create);
router.put('/:id/cancelar', autenticar, ctrl.cancelar);

module.exports = router;