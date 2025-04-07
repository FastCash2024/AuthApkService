import { FormModel } from "../models/FormModel.js";

export async function agregarCuentaBancaria(req, res) {
    const { usuarioId } = req.params;
    const nuevaCuenta = req.body;

    try {
        const usuario = await FormModel.findById(usuarioId);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (usuario.cuentasBancarias.length >= 5) {
            return res.status(400).json({ error: 'Máximo 5 cuentas permitidas' });
        }

        usuario.cuentasBancarias.push(nuevaCuenta);
        await usuario.save();

        res.status(200).json(usuario.cuentasBancarias);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al agregar cuenta bancaria' });
    }
}

export const actualizarCuentaBancaria = async (req, res) => {
    const { usuarioId, cuentaId } = req.params;
    const { nombreDeBanco, numeroDeCuenta, estadoDeCuenta, acotacion } = req.body;

    try {
        const usuario = await FormModel.findById(usuarioId);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const cuentaBancaria = usuario.cuentasBancarias.id(cuentaId);
        if (!cuentaBancaria) {
            return res.status(404).json({ message: 'Cuenta bancaria no encontrada' });
        }

        if (nombreDeBanco !== undefined) cuentaBancaria.nombreDeBanco = nombreDeBanco;
        if (numeroDeCuenta !== undefined) cuentaBancaria.numeroDeCuenta = numeroDeCuenta;
        if (estadoDeCuenta !== undefined) cuentaBancaria.estadoDeCuenta = estadoDeCuenta;
        if (acotacion !== undefined) cuentaBancaria.acotacion = acotacion;

        await usuario.save();
        res.json({ message: 'Cuenta bancaria actualizada con éxito', cuentaBancaria });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar la cuenta bancaria' });
    }
};

export const eliminarCuentaBancaria = async (req, res) => {
    const { usuarioId, cuentaId } = req.params;

    try {
        const usuario = await FormModel.findById(usuarioId);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        usuario.cuentasBancarias = usuario.cuentasBancarias.filter(
            cuenta => cuenta._id.toString() !== cuentaId
        );

        await usuario.save();
        res.json({ message: 'Cuenta bancaria eliminada con éxito', cuentasBancarias: usuario.cuentasBancarias });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar la cuenta bancaria' });
    }
};