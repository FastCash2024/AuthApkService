import express from 'express';
import multer from 'multer';
import {getChatsUser, validateNumberForLogin,registerAfterValidateOTP, getFilterUsersApkRefresh, getFilterUsersApkFromWeb, updateUserAPK, validateNumberForSignup} from '../controllers/authApkController.js';

const router = express.Router();

// Configurar multer
const storage = multer.memoryStorage();

// Configuración de Multer para manejar múltiples archivos
const upload = multer({
  storage: multer.memoryStorage(),  // Almacenamiento en memoria
  limits: { fileSize: 10 * 1024 * 1024 },  // Límite de tamaño de archivo (10MB)
});

//Verification OTP for Signup  APK
router.post('/verifyOTPforSignup', validateNumberForSignup); 

//Registers APK
router.post('/register', upload.array('files', 3), registerAfterValidateOTP);  

//Verificacion de OTP yLogin APK
router.get('/usersApk', validateNumberForLogin);

//Update APK
router.put('/:userApkID', updateUserAPK);

router.get('/usersApkRefresh', getFilterUsersApkRefresh);
router.get('/usersApkFromWeb', getFilterUsersApkFromWeb);
router.get('/usersChat', getChatsUser);

export default router;
