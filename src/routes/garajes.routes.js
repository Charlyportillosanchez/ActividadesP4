const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/garajes.controller');
const autenticar = require('../middlewares/autenticar');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', autenticar, ctrl.create);
router.put('/:id', autenticar, ctrl.update);
router.delete('/:id', autenticar, ctrl.remove);

module.exports = router;