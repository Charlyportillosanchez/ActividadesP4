const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vehiculos.controller');
const autenticar = require('../middlewares/autenticar');

router.get('/', autenticar, ctrl.mios);
router.post('/', autenticar, ctrl.crear);
router.post('/:id/documento', autenticar, ctrl.subirDocumento);
router.get('/pendientes', autenticar, ctrl.pendientes);
router.put('/:id/revisar', autenticar, ctrl.revisar);
router.delete('/:id', autenticar, ctrl.eliminar);

module.exports = router;
