require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// ── Garante que a pasta data/ existe (Railway volume ou local) ──
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
process.env.DB_PATH = path.join(DATA_DIR, 'chale.db');

// Inicializa banco
const { getDb } = require('./database');
getDb();

const routes = require('./routes');
const app    = express();
const PORT   = process.env.PORT || 3000;

// ── MIDDLEWARE ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── STATIC FILES ──
app.use(express.static(path.join(__dirname, '../public')));

// ── HEALTH CHECK (Railway usa isso) ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API ──
app.use('/api', routes);

// ── CATCH-ALL ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── START ──
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  🌿 ================================');
  console.log('     Chalé Gratitude — Servidor');
  console.log('  🌿 ================================');
  console.log(`  ✅ Porta:   ${PORT}`);
  console.log(`  🗄️  Banco:  ${process.env.DB_PATH}`);
  console.log(`  🌐 Env:     ${process.env.NODE_ENV || 'development'}`);
  console.log('  ================================');
  console.log('');
});
