import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema({
  originalName: String,
  savedAs: String,
  mimeType: String,
  size: Number,
  path: String
});

const CuentasBancariasSchema = new mongoose.Schema({
  titular: String,
  nombreBanco: String,
  claveBanco: String,
  numeroDeCuenta: String,
  estadoDeCuenta: {
    type: String,
    enum: ['Activo', 'Bloqueado'],
    default: 'Activo',
  },
  // acotacion: String,
});

const FormSchema = new mongoose.Schema({
  celular: String,
  formData: Object, // Puedes ajustar este tipo según los campos de tu formulario
  images: [String],
  cuentasBancarias: [CuentasBancariasSchema],
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'usuariosApk'
});

export const FormModel = mongoose.model('usuariosApk', FormSchema);