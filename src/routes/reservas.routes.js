const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reservas.controller');
const autenticar = require('../middlewares/autenticar');

router.get('/', autenticar, ctrl.getAll);
router.post('/', autenticar, ctrl.create);
router.get('/todas', autenticar, ctrl.getAllAdmin);
router.get('/todas', autenticar, ctrl.getAll);
module.exports = router;
