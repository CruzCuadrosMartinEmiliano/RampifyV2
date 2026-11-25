require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);   // Render pone un proxy delante

const allowedOrigins = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '7mb' }));
app.use(cookieParser());
app.use((req, res, next) => { console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`); next(); });

// Frontend estático (carpeta frontend/ junto a backend/)
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get('/', (req, res) => res.redirect('/html/index.html'));
app.get('/health', (req, res) => res.json({ ok: true, service: 'rampify-api' }));

app.use('/api/auth', require('./Routers/auth'));
app.use('/api/registro', require('./Routers/registro'));
app.use('/api/dashboard', require('./Routers/dashboard'));
app.use('/api/reportes', require('./Routers/reportes'));
app.use('/api/solicitudes', require('./Routers/solicitudes'));
app.use('/api/empleados', require('./Routers/empleados'));
app.use('/api/administradores', require('./Routers/administradores'));
app.use('/api/catalogos', require('./Routers/catalogos'));
app.use('/api/usuarios', require('./Routers/usuarios'));
app.use('/api/denuncias', require('./Routers/denuncias'));
app.use('/api/perfil', require('./Routers/perfil'));
app.use('/api/v1', require('./Routers/mobile'));

app.use('/api', (req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
app.use((err, req, res, next) => {
  console.error('Error no manejado COMPLETO:', err); // Cambiar a err para ver toda la traza
  res.status(500).json({ ok: false, code: 'SERVER_ERROR', error: err.message });
});
app.listen(PORT, () => { console.log(`Servidor Rampify en http://localhost:${PORT}`); require('./Services/mantenimiento').iniciar(); });