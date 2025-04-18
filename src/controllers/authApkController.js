
import { FormModel } from '../models/FormModel.js'; // Asegúrate de usar la ruta correcta
import Application from '../models/ApplicationsCollection.js';
import VerificationCollection from '../models/VerificationCollection.js';
import { uploadFileToS3, } from './S3Controller.js';
import {SmsModel} from '../models/smsModel.js';

// Obtener todos los usuarios
export const getFilterUsers = async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    // Validación de phoneNumber
    if (phoneNumber && typeof phoneNumber !== "string") {
      return res.status(400).json({ message: "El campo phoneNumber debe ser un string válido." });
    }
    // Construcción dinámica del filtro
    const filter = {};
    if (phoneNumber) {
      // Buscar dentro de formData usando la notación de punto
      filter["formData.phoneNumber"] = { $regex: phoneNumber, $options: "i" }; // Insensible a mayúsculas
    }
    // Consulta a MongoDB con filtro dinámico
    const users = await FormModel.find(filter);
    // Respuesta
    if (users.length === 0) {
      return res.status(404).json({ message: "No se encontraron usuarios que coincidan con el filtro." });
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Ocurrió un error al obtener los usuarios.", error: error.message });
  }
};

// Validaddor de número de celular para registro
export const validateNumberForSignup = async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    // Verificación de parámetros
    if (!phoneNumber) {
      return res.status(400).json({ error: "El número de teléfono es requerido." });
    }
    if (!code) {
      return res.status(400).json({ error: "El código OTP es requerido." });
    }

    // Verificación del OTP
    const otpResult = await verificarOTP(phoneNumber, code);
    if (!otpResult.success) {
      return res.status(401).json({ error: otpResult.error }); // Unauthorized
    }

    // Construir el filtro para la búsqueda del número
    const filter = {
      "formData.contacto": { $regex: phoneNumber, $options: "i" },
    };

    // Buscar el número en la base de datos
    const users = await FormModel.find(filter);

    // Si no se encuentran usuarios con ese número
    if (users.length === 0) {
      return res.status(200).json({ message: "Número de celular disponible para registro." });
    }

    // Si ya existe un solo registro con el mismo número
    if (users.length === 1) {
      return res.status(409).json({ error: "Número de celular ya registrado." }); // Conflict
    }

    // Si hay más de un registro con el mismo número (violación de integridad de datos)
    return res.status(409).json({
      error: "Número de celular registrado múltiples veces. Verifique los registros.",
    }); // Conflict

  } catch (error) {
    console.error("Error en validateNumberForSignup:", error);
    return res.status(500).json({
      error: "Ocurrió un error al validar el número de celular.",
      details: error.message,
    });
  }
};


export const registerAfterValidateOTP = async (req, res) => {
  const { body, files } = req;

  try {
    const { contacto, formData: formDataRaw } = body;

    // ⚠️ Validar campos requeridos
    if (!contacto) {
      return res.status(400).json({ error: 'El campo "contacto" es obligatorio.' });
    }

    // ⚠️ Validar cantidad de archivos
    if (!files || files.length !== 3) {
      return res.status(400).json({ error: 'Debe enviar exactamente 3 archivos.' });
    }

    // 🧾 Parsear formData
    let formData;
    try {
      formData = JSON.parse(formDataRaw);
    } catch (parseError) {
      return res.status(400).json({ error: 'El campo "formData" debe ser un JSON válido.' });
    }

    formData.phoneNumber = contacto;

    // 🔎 Validar que el número no esté registrado
    const existingUserByPhone = await FormModel.findOne({
      "formData.contacto": { $regex: contacto, $options: "i" }
    });

    if (existingUserByPhone) {
      return res.status(409).json({ error: "El número de celular ya está registrado." });
    }

    // 🔎 Validar que el DNI no esté registrado
    const existingUserByDNI = await FormModel.findOne({
      "formData.dni": formData.dni
    });

    if (existingUserByDNI) {
      return res.status(409).json({ error: "El CURP ya está registrado." });
    }

    // ☁️ Subir archivos a S3
    const fileUrls = [];
    for (const file of files) {
      const fileName = file.originalname || `${Date.now()}-${file.originalname}`;
      const result = await uploadFileToS3(file, fileName);
      fileUrls.push(result.Location);
    }

    // 📄 Obtener aplicaciones relacionadas
    const resultApplications = await getApplications(formData);

    // 🗃 Crear documento en MongoDB
    const newForm = new FormModel({
      formData,
      images: fileUrls,
      cuentasBancarias: [
        {
          titular: true,
          nombreBanco: formData.nombreBanco,
          claveBanco: formData.claveBanco,
          numeroDeCuenta: formData.numeroDeTarjetaBancari,
          tipoCuenta: formData.tipoCuenta,
        }
      ]
    });

    const savedForm = await newForm.save();

    return res.status(201).json({
      message: "Registro completado con éxito.",
      data: {
        formData,
        applications: resultApplications,
        uploadedFiles: fileUrls,
        formId: savedForm._id
      }
    });

  } catch (error) {
    console.error("Error en registerAfterValidateOTP:", error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

// Obtener todos los usuarios
export const validateNumberForLogin = async (req, res) => {
  try {
    const { phoneNumber, code } = req.query;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: "El número de teléfono y el código son requeridos." });
    }

    // Verificar OTP
    const otpResult = await verificarOTP(phoneNumber, code);
    if (!otpResult.success) {
      return res.status(400).json({ error: otpResult.error });
    }

    // Construcción dinámica del filtro
    const filter = phoneNumber ? { "formData.contacto": { $regex: phoneNumber, $options: "i" } } : {};

    // Consulta a MongoDB con filtro dinámico
    const users = await FormModel.find(filter);
    
    if (users.length === 0) {
      // Reemplazado 404 por 401: No se encontró un usuario registrado con el número de teléfono
      return res.status(401).json({ error: "Número de celular no registrado." });
    }

    if (users.length > 1) {
      // Reemplazado 204 por 409: Hay un conflicto porque hay múltiples cuentas
      return res.status(409).json({ error: "Existen múltiples cuentas asociadas con este número." });
    }

    // Si hay exactamente un usuario, procesamos sus datos
    const user = users[0];
    const formData = { ...user.formData };
    delete formData.contactos;
    delete formData.sms;

    // Obtener aplicaciones asociadas al usuario
    const resultApplication = await getApplications(formData);
    console.log("Resultado aplicación: ", resultApplication);

    // Construcción de la respuesta
    const responseData = {
      userID: user.id,
      ...formData,
      applications: resultApplication,
      cuentasBancarias: user.cuentasBancarias,
    };

    return res.json(responseData);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Ocurrió un error al obtener los usuarios.", error: error.message });
  }
};


export const updateUserAPK = async (req, res) => {
  const { userApkID } = req.params;
  const body = req.body;

  if (!body || typeof body !== "object") {
    return res.status(400).json({ message: "Datos inválidos o no proporcionados" });
  }

  const camposPermitidos = [
    "apellidos", "nombres", "contacto", "dni", "provinciaCiudad", "estadoCivil",
    "trabajo", "prestamoEnLinea", "prestamosPendientes", "ingreso", "nivelDePrestamo",
    "nombreBanco", "claveBanco", "tipoCuenta", "numeroDeTarjetaBancari", "fechaNacimiento",
    "sexo", "nivelEducativo", "contactNameAmigo", "contactNameFamiliar",
    "phoneNumberAmigo", "phoneNumberFamiliar"
  ];

  const updateFields = {};

  camposPermitidos.forEach((campo) => {
    if (body[campo] !== undefined) {
      updateFields[`formData.${campo}`] = body[campo]; // <-- NOTACIÓN ANIDADA
    }
  });

  try {
    const updated = await FormModel.findByIdAndUpdate(
      userApkID,
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Formulario no encontrado" });
    }


    const formData = { ...updated.formData }
    delete formData['contactos']
    delete formData['sms']
    const resultAplication = await getApplications(formData)
    console.log("resultado aplicacion: ", resultAplication);
    const dataRes = {
      userID: updated.id,
      ...formData,
      applications: resultAplication,
      cuentasBancarias: updated.cuentasBancarias,
    }
    return res.json(dataRes);

    // res.json({ message: "Formulario actualizado correctamente", data: updated });
  } catch (error) {
    console.error("Error al actualizar:", error);
    res.status(500).json({ message: "Error interno al actualizar el formulario" });
  }
};

// Obtener todos los usuarios cuando haga un refresh en apk
export const getFilterUsersApkRefresh = async (req, res) => {
  console.log(req)
  try {
    const { phoneNumber } = req.query;
    console.log(phoneNumber)

    const filter = {};
    if (phoneNumber) {
      // Buscar dentro de formData usando la notación de punto
      filter["formData.contacto"] = { $regex: phoneNumber, $options: "i" }; // Insensible a mayúsculas
    }
    // Consulta a MongoDB con filtro dinámico
    const users = await FormModel.find(filter);
    console.log(phoneNumber)
    console.log(users)
    // Respuesta
    if (users.length === 0) {
      return res.status(404).json({ message: "No se encontraron usuarios que coincidan con el filtro." });
    }
    if (users.length > 1) {
      return res.status(204).json({ message: "Many Accounts" });
    }
    if (users.length === 1) {
      const formData = { ...users[0].formData }
      delete formData['contactos']
      delete formData['sms']
      const resultAplication = await getApplications(formData)
      console.log("resultado aplicacion: ", resultAplication);
      const dataRes = {
        userID: users[0].id,
        ...formData,
        applications: resultAplication,
        cuentasBancarias: users[0].cuentasBancarias,
      }
      return res.json(dataRes);
      ;
    }
    return res.status(404).json({ message: "non exist" });
  } catch (error) {
    res.status(500).json({ message: "Ocurrió un error al obtener los usuarios.", error: error.message });
  }
};

// Obtener todos los usuarios
export const getFilterUsersApkFromWeb = async (req, res) => {
  console.log(req)
  try {
    const { phoneNumber } = req.query;

    // Construcción dinámica del filtro
    const filter = {};
    if (phoneNumber) {
      // Buscar dentro de formData usando la notación de punto
      filter["formData.contacto"] = { $regex: phoneNumber, $options: "i" }; // Insensible a mayúsculas
    }

    // Consulta a MongoDB con filtro dinámico
    const users = await FormModel.find(filter);
    // console.log(phoneNumber)
    // console.log(users)

    // Respuesta
    if (users.length === 0) {
      return res.status(404).json({ message: "No se encontraron usuarios que coincidan con el filtro de contacto." });
    }
    if (users.length > 1) {

      return res.status(204).json({ message: "Many Accounts" });

    }
    if (users.length === 1) {
      const formData = { ...users[0].formData, photoURLs: users[0].images }
      delete formData['contactos']
      delete formData['sms']


      const dataRes = {
        userID: users[0].id,
        ...formData,
        cuentasBancarias: users[0].cuentasBancarias,
      }
      return res.json(dataRes);
      ;
    }
    return res.status(404).json({ message: "non exist" });

  } catch (error) {
    res.status(500).json({ message: "Ocurrió un error al obtener los usuarios.", error: error.message });
  }
};

export const getChatsUser = async (req, res) => {
  try {
    const {
      nombreCompleto,
      limit = 5,
      page = 1
    } = req.query;

    const filter = {};

    if (nombreCompleto) {
      const regex = new RegExp(nombreCompleto, "i");
      const [nombre, apellido] = nombreCompleto.split(" ");

      if (!apellido) {
        filter.$or = [
          { "formData.nombres": regex },
          { "formData.apellidos": regex },
        ];
      } else {
        filter.$and = [
          { "formData.nombres": new RegExp(nombre, "i") },
          { "formData.apellidos": new RegExp(apellido, "i") },
        ];
      }
    }


    const forms = await FormModel.find(filter, 'formData.nombres formData.apellidos formData.contacto formData.sms')
      .skip((parseInt(page) - 1) * parseInt(limit))  // Paginación
      .limit(parseInt(limit));  // Límite

    const totalDocuments = await FormModel.countDocuments(filter);

    const totalPages = Math.ceil(totalDocuments / limit);

    const result = forms.map(form => {
      const { nombres, apellidos, contacto, sms } = form.formData;
      return {
        _id: form._id,
        nombreCompleto: `${nombres} ${apellidos}`,
        contacto,
        cantidadSms: sms?.length
      };
    });

    res.status(200).json({
      data: result,
      currentPage: parseInt(page),
      totalPages,
      totalDocuments,
    });
  } catch (error) {
    console.error("Error al obtener los usuarios:", error);
    res.status(500).json({
      error: "Error al obtener los los usuarios",
      details: error.message,
    });
  }
};

export const getApplications = async (userData) => {
  try {
    const { contacto, dni, apellidos, nombres } = userData;
    const nombreDelCliente = `${nombres} ${apellidos}`;

    if (!contacto || !dni || !nombreDelCliente) {
      throw new Error("Todos los campos (numeroDeTelefono, dni, nombreDelCliente) son obligatorios.");
    }


    const obj = {
      numeroDeTelefonoMovil: contacto,
      nombreDelCliente,
      dni
    }
    console.log("dataParaMatch", obj)

    const userLoans = await VerificationCollection.find({
      numeroDeTelefonoMovil: contacto,
      nombreDelCliente,
    });

    console.log("user loans: ", userLoans);


    const applications = await Application.find();
    console.log("app", applications)


    if (userLoans.length === 0) {
      return applications.map(app => {
        const nivel1 = app.niveles.find(n => n.nivelDePrestamo == 1) || {};
        return {
          nombre: app.nombre,
          icon: app.icon,
          calificacion: app.calificacion,
          prestamoMaximo: nivel1.valorPrestadoMasInteres || 0,
          interesDiarioMaximo: nivel1.interesDiario || 0,
          interesDiario: nivel1.interesDiario || 0,
          interesTotal: nivel1.interesTotal || 0,
          valorDepositoLiquido: nivel1.valorDepositoLiquido || 0,
          valorExtencion: nivel1.valorExtencion || 0,
          valorPrestado: nivel1.valorPrestadoMasInteres || 0,
          valorPrestamoMenosInteres: nivel1.valorPrestamoMenosInteres || 0,
          estadoDeNivel: "Disponible",
          nivelDePrestamo: 1
        };
      });
    }

    return applications.map(app => {
      const nivelesOrdenados = app.niveles
        .sort((a, b) => parseInt(a.nivelDePrestamo) - parseInt(b.nivelDePrestamo));

      if (!nivelesOrdenados.length) return null;

      // Verificar si hay un préstamo en esta aplicación diferente de "pagado"
      const tieneCreditoNoPagadoEnEstaApp = userLoans.some(loan =>
        loan.nombreDelProducto === app.nombre && loan.estadoDeCredito.trim().toLowerCase() !== "pagado"
      );
      console.log("creditos no pagados", tieneCreditoNoPagadoEnEstaApp)
      // Contar cuántos préstamos pagados tiene el usuario en esta app
      const prestamosPagados = userLoans.filter(loan =>
        loan.estadoDeCredito.trim().toLowerCase() === "pagado" && loan.nombreDelProducto === app.nombre
      ).length;

      // console.log("userLoans", userLoans);
      // console.log("prestamosPagados", prestamosPagados);

      // Nivel que le tocaría según los préstamos pagados
      const nivelSiguiente = prestamosPagados + 1;
      // console.log("nivelSiguiente", nivelSiguiente);

      // Verificar si el nivel siguiente existe en la aplicación
      const nivelCorrespondiente = nivelesOrdenados.find(n => Number(n.nivelDePrestamo) === nivelSiguiente);
      const existeNivel = nivelesOrdenados.some(n => Number(n.nivelDePrestamo) === nivelSiguiente);

      // Si el usuario ya ha alcanzado el último nivel, devolver "Próximamente"
      const maximoNivelDisponible = Math.max(...nivelesOrdenados.map(n => Number(n.nivelDePrestamo)));
      // console.log("maximoNivelDisponible", maximoNivelDisponible);


      const estadoDeNivel = tieneCreditoNoPagadoEnEstaApp
        ? "No disponible"
        : nivelSiguiente > maximoNivelDisponible
          ? "Próximamente"
          : "Disponible";

      return {
        nombre: app.nombre,
        icon: app.icon,
        calificacion: app.calificacion,
        prestamoMaximo: nivelesOrdenados[nivelesOrdenados.length - 1]?.valorPrestadoMasInteres || 0,
        interesDiarioMaximo: nivelesOrdenados[nivelesOrdenados.length - 1]?.interesDiario || 0,
        interesDiario: nivelCorrespondiente?.interesDiario || 0,
        interesTotal: nivelCorrespondiente?.interesTotal || 0,
        valorDepositoLiquido: nivelCorrespondiente?.valorDepositoLiquido || 0,
        valorExtencion: nivelCorrespondiente?.valorExtencion || 0,
        valorPrestado: nivelCorrespondiente?.valorPrestadoMasInteres || 0,
        valorPrestamoMenosInteres: nivelCorrespondiente?.valorPrestamoMenosInteres || 0,
        estadoDeNivel,
        nivelDePrestamo: tieneCreditoNoPagadoEnEstaApp
          ? 1
          : nivelSiguiente > maximoNivelDisponible
            ? null
            : nivelSiguiente
      };
    }).filter(app => app !== null);

  } catch (error) {
    throw new Error(`Error al obtener las aplicaciones: ${error.message}`);
  }
};

export const verificarOTP = async (telefono, codigo) => {
  if (!telefono || !codigo) {
    return { success: false, error: "El número de teléfono y el código OTP son requeridos." };
  }

  const otpRecord = await SmsModel.findOne({ telefono, code: codigo });

  if (!otpRecord) {
    const phoneExists = await SmsModel.findOne({ telefono });
    if (phoneExists) {
      return { success: false, error: "El código es incorrecto." };
    }
    return { success: false, error: "El número de teléfono no está registrado o no tiene un OTP válido." };
  }

  setTimeout(async () => {
    await SmsModel.deleteOne({ telefono, code: codigo });
  }, Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000);

  return { success: true, message: "OTP válido." };

};
