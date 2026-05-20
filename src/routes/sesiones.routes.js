const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sesiones.controller');
const autenticar = require('../middlewares/autenticar');

/**
 * @swagger
 * /api/sesiones:
 *   get:
 *     summary: Listar todas las sesiones
 *     tags: [Sesiones]
 *     responses:
 *       200:
 *         description: Lista de sesiones
 */
router.get('/', ctrl.getAll);

/**
 * @swagger
 * /api/sesiones/{id}:
 *   get:
 *     summary: Obtener sesión por ID
 *     tags: [Sesiones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sesión encontrada
 *       404:
 *         description: Sesión no encontrada
 */
router.get('/:id', ctrl.getById);

/**
 * @swagger
 * /api/sesiones:
 *   post:
 *     summary: Crear nueva sesión
 *     tags: [Sesiones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tema:
 *                 type: string
 *               materia:
 *                 type: string
 *               fecha:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sesión creada
 *       401:
 *         description: Token requerido
 */
router.post('/', autenticar, ctrl.create);

/**
 * @swagger
 * /api/sesiones/{id}:
 *   put:
 *     summary: Actualizar sesión
 *     tags: [Sesiones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sesión actualizada
 *       404:
 *         description: Sesión no encontrada
 */
router.put('/:id', autenticar, ctrl.update);

/**
 * @swagger
 * /api/sesiones/{id}:
 *   delete:
 *     summary: Eliminar sesión
 *     tags: [Sesiones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sesión eliminada
 *       404:
 *         description: Sesión no encontrada
 */
router.delete('/:id', autenticar, ctrl.remove);

module.exports = router;