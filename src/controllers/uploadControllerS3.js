import { uploadFile, uploadFileToS3, getFile, deleteFile, getSignedUrl } from '../models/S3Model.js';
import { FormModel } from '../models/FormModel.js'; // Asegúrate de usar la ruta correcta
import { getApplications } from './authApkController.js';
import { SmsModel } from '../models/smsModel.js';

export const handleFileUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  try {
    const data = await uploadFile(req.file, req.file.originalname);
    res.status(200).json({ url: data.Location });
  } catch (error) {
    res.status(500).json({ error: 'Error uploading file', details: error.message });
  }
};
// Controlador para manejar la carga de múltiples archivos
export const handleFileUploadMultiples = async (req, res) => {
  const { body, files } = req;

  console.log("req", body.formData, files)

  try {
    const { contacto } = body;
    // Verificar que los archivos estén presentes
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileUrls = [];

    // Subir cada archivo a S3
    for (let file of req.files) {
      const fileName = file.originalname;  // Usar el nombre original o generar uno único
      const result = await uploadFileToS3(file, fileName);  // Subir archivo
      fileUrls.push(result.Location);  // Guardar la URL del archivo cargado
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Debe enviar al menos un archivo' });
    }
    const formData = await JSON.parse(body.formData)


    console.log("formData:::", formData)
    console.log("formDataContacto", formData.contacto)


    formData.phoneNumber = contacto;

    const resultApplications = await getApplications(formData);

    // Crear un nuevo documento en la base de datos
    const newForm = new FormModel({
      formData: formData,// Datos del formulario
      images: fileUrls       // Información de las imágenes
    });

    // Guardar en MongoDB
    const savedForm = await newForm.save();

    // Responder con las URLs de los archivos cargados
    return res.status(200).json({
      message: 'Files uploaded successfully',
      data: { ...formData, applications: resultApplications }
    });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ "Error": error, });
  }
};

export const handleFileGet = async (req, res) => {
  try {
    const data = await getFile(req.params.fileName);
    res.setHeader('Content-Type', data.ContentType);
    res.send(data.Body);
  } catch (error) {
    res.status(500).json({ error: 'Error getting file', details: error.message });
  }
};

export const handleFileDelete = async (req, res) => {
  try {
    await deleteFile(req.params.fileName);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting file', details: error.message });
  }
};

export const handleGetSignedUrl = async (req, res) => {
  try {
    const url = await getSignedUrl(req.params.fileName);
    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Error generating signed URL', details: error.message });
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

