import { FormModel } from "../models/FormModel.js";
import { getApplications } from "./authApkController.js";

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
    const { titular, nombreBanco, claveBanco, numeroDeCuenta, estadoDeCuenta, tipoCuenta } = req.body;

    try {
        const usuario = await FormModel.findById(usuarioId);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const cuentaBancaria = usuario.cuentasBancarias.id(cuentaId);
        if (!cuentaBancaria) {
            return res.status(404).json({ message: 'Cuenta bancaria no encontrada' });
        }

        if (titular !== undefined) cuentaBancaria.titular = titular;
        if (nombreBanco !== undefined) cuentaBancaria.nombreBanco = nombreBanco;
        if (claveBanco !== undefined) cuentaBancaria.claveBanco = claveBanco;
        if (numeroDeCuenta !== undefined) cuentaBancaria.numeroDeCuenta = numeroDeCuenta;
        if (estadoDeCuenta !== undefined) cuentaBancaria.estadoDeCuenta = estadoDeCuenta;
        if (tipoCuenta !== undefined) cuentaBancaria.tipoCuenta = tipoCuenta;


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

        const user = await usuario.save();
        console.log("user", user)

        const formData = { ...user.formData }
        delete formData['contactos']
        delete formData['sms']
        const resultAplication = await getApplications(formData)

        const dataRes = {
            userID: user.id,
            ...formData,
            applications: resultAplication,
            cuentasBancarias: user.cuentasBancarias,
        }
        res.status(200).json(dataRes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar la cuenta bancaria' });
    }
};