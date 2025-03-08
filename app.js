import express from 'express'; 
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import bodyParser from  'body-parser';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url'; // Asegúrate de importar fileURLToPath

import uploadRoutesS3 from './src/routes/uploadRoutesS3.js';

dotenv.config();
const app = express();
app.use(bodyParser.json());


app.use(cors());
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Conectar a MongoDB
connectDB();

app.use(express.json({ limit: '100mb' })); // Ajusta el límite según el tamaño de las solicitudes esperadas
app.use(express.urlencoded({ limit: '100mb', extended: true }));

//Auth APK Routes
app.use('/api/authApk', uploadRoutesS3); // AuthAndSMS ---> LoginAPK

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use('/public', express.static(path.join(__dirname, 'public')));

// Middleware de manejo de errores
app.use(errorHandler);

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

                  







