const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/garajes.controller');
const autenticar = require('../middlewares/autenticar');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/calificaciones', ctrl.calificaciones);
router.post('/', autenticar, ctrl.create);
router.post('/:id/calificar', autenticar, ctrl.calificar);
router.put('/:id', autenticar, ctrl.update);
router.delete('/:id', autenticar, ctrl.remove);

module.exports = router;