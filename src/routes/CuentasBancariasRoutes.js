import express from 'express';
import { actualizarCuentaBancaria, agregarCuentaBancaria, eliminarCuentaBancaria } from '../controllers/cuentasBancariasController.js';

const router = express.Router();
// RUTA para agregar una nueva cuenta bancaria
router.post('/:usuarioId/cuentas', agregarCuentaBancaria);

// Actualizar una cuenta bancaria por su _id
router.put('/:usuarioId/cuentas/:cuentaId', actualizarCuentaBancaria);

// Eliminar una cuenta bancaria por su _id
router.delete('/:usuarioId/cuentas/:cuentaId', eliminarCuentaBancaria);

export default router;
