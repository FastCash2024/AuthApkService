import express from 'express';
import multer from 'multer';
import {handleFileUpload,handleFileUploadMultiples} from '../controllers/uploadControllerS3.js';
import {getChatsUser, getFilterUsersApk, getFilterUsersApkRefresh, getFilterUsersApkFromWeb} from '../controllers/authApkController.js';

const router = express.Router();

// Configurar multer
const storage = multer.memoryStorage();

// Configuración de Multer para manejar múltiples archivos
const upload = multer({
  storage: multer.memoryStorage(),  // Almacenamiento en memoria
  limits: { fileSize: 10 * 1024 * 1024 },  // Límite de tamaño de archivo (10MB)
});
// Rutas de S3
router.post('/upload', upload.single('file'), handleFileUpload);

//Registers APP
router.post('/register', upload.array('files', 3), handleFileUploadMultiples);  // Permite hasta 10 archivos

//Login APK
router.get('/usersApk', getFilterUsersApk);
router.get('/usersApkRefresh', getFilterUsersApkRefresh);
router.get('/usersApkFromWeb', getFilterUsersApkFromWeb);
router.get('/usersChat', getChatsUser);

export default router;
