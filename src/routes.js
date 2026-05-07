const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('./database');

const router  = express.Router();
const SECRET  = process.env.JWT_SECRET || 'gratitude_secret';

// ── AUTH MIDDLEWARE ──
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token necessário' });
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ════════════════════════════
//  PUBLIC ROUTES
// ════════════════════════════

// GET /api/rooms — list active rooms
router.get('/rooms', (req, res) => {
  res.json(db.getRooms());
});

// GET /api/services — list active services
router.get('/services', (req, res) => {
  res.json(db.getServices());
});

// GET /api/price-tiers — pricing table
router.get('/price-tiers', (req, res) => {
  res.json(db.getPriceTiers());
});

// GET /api/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/availability', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start e end são obrigatórios' });
  const blocked = db.getBlockedDates();
  const allDates = db.datesBetween(start, end);
  const availability = allDates.map(d => ({
    date: d,
    available: db.isDateAvailable(d),
    blocked: blocked.includes(d)
  }));
  res.json(availability);
});

// GET /api/blocked-dates — all blocked dates
router.get('/blocked-dates', (req, res) => {
  res.json(db.getBlockedDates());
});

// POST /api/reservations — create reservation (public)
router.post('/reservations', (req, res) => {
  const { guest_name, guest_phone, guest_email, guests, observation,
          room_id, check_in, check_out, nights, total } = req.body;

  if (!guest_name || !guest_phone || !room_id || !check_in || !check_out) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }
  const room = db.getRoomById(room_id);
  if (!room) return res.status(404).json({ error: 'Acomodação não encontrada' });

  const result = db.createReservation({
    guest_name, guest_phone, guest_email, guests, observation,
    room_id, room_name: room.name, check_in, check_out, nights, total
  });
  res.status(201).json({ id: result.lastInsertRowid, message: 'Reserva criada com sucesso!' });
});

// POST /api/auth/login — admin login
router.post('/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Senha obrigatória' });
  const cfg = db.getConfig();
  const valid = bcrypt.compareSync(password, cfg.admin_password_hash || '');
  if (!valid) return res.status(401).json({ error: 'Senha incorreta' });
  const token = jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// ════════════════════════════
//  ADMIN ROUTES (protected)
// ════════════════════════════

// GET /api/admin/config
router.get('/admin/config', auth, (req, res) => {
  const cfg = db.getConfig();
  delete cfg.admin_password_hash;
  res.json(cfg);
});

// PUT /api/admin/config
router.put('/admin/config', auth, (req, res) => {
  const { whatsapp, email, address, checkinout, new_password } = req.body;
  if (whatsapp)   db.setConfig('whatsapp', whatsapp);
  if (email)      db.setConfig('email', email);
  if (address)    db.setConfig('address', address);
  if (checkinout) db.setConfig('checkinout', checkinout);
  if (new_password) {
    const hash = bcrypt.hashSync(new_password, 10);
    db.setConfig('admin_password_hash', hash);
  }
  res.json({ message: 'Configurações salvas!' });
});

// GET /api/admin/reservations
router.get('/admin/reservations', auth, (req, res) => {
  const { status, search } = req.query;
  res.json(db.getReservations({ status, search }));
});

// PATCH /api/admin/reservations/:id/status
router.patch('/admin/reservations/:id/status', auth, (req, res) => {
  const { status } = req.body;
  if (!['pending','confirmed','cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  db.updateReservationStatus(Number(req.params.id), status);
  res.json({ message: 'Status atualizado!' });
});

// POST /api/admin/rooms
router.post('/admin/rooms', auth, (req, res) => {
  const r = db.createRoom(req.body);
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /api/admin/rooms/:id
router.put('/admin/rooms/:id', auth, (req, res) => {
  db.updateRoom(Number(req.params.id), req.body);
  res.json({ message: 'Acomodação atualizada!' });
});

// DELETE /api/admin/rooms/:id
router.delete('/admin/rooms/:id', auth, (req, res) => {
  db.deleteRoom(Number(req.params.id));
  res.json({ message: 'Acomodação removida!' });
});

// POST /api/admin/services
router.post('/admin/services', auth, (req, res) => {
  const r = db.createService(req.body);
  res.status(201).json({ id: r.lastInsertRowid });
});

// DELETE /api/admin/services/:id
router.delete('/admin/services/:id', auth, (req, res) => {
  db.deleteService(Number(req.params.id));
  res.json({ message: 'Serviço removido!' });
});

// GET /api/admin/price-tiers
router.get('/admin/price-tiers', auth, (req, res) => {
  res.json(db.getPriceTiers());
});

// POST /api/admin/price-tiers
router.post('/admin/price-tiers', auth, (req, res) => {
  const id = db.upsertPriceTier(req.body);
  res.status(201).json({ id });
});

// DELETE /api/admin/price-tiers/:id
router.delete('/admin/price-tiers/:id', auth, (req, res) => {
  db.deletePriceTier(Number(req.params.id));
  res.json({ message: 'Período removido!' });
});

// POST /api/admin/blocked-dates — block range
router.post('/admin/blocked-dates', auth, (req, res) => {
  const { start, end } = req.body;
  if (!start || !end) return res.status(400).json({ error: 'start e end obrigatórios' });
  const dates = db.datesBetween(start, new Date(new Date(end).getTime()+86400000).toISOString().split('T')[0]);
  dates.forEach(d => db.blockDate(d));
  res.json({ message: `${dates.length} datas bloqueadas` });
});

// DELETE /api/admin/blocked-dates — unblock range
router.delete('/admin/blocked-dates', auth, (req, res) => {
  const { start, end } = req.body;
  if (!start || !end) return res.status(400).json({ error: 'start e end obrigatórios' });
  const dates = db.datesBetween(start, new Date(new Date(end).getTime()+86400000).toISOString().split('T')[0]);
  dates.forEach(d => db.unblockDate(d));
  res.json({ message: `${dates.length} datas desbloqueadas` });
});

// GET /api/admin/stats
router.get('/admin/stats', auth, (req, res) => {
  const all = db.getReservations();
  const pending   = all.filter(r => r.status === 'pending').length;
  const confirmed = all.filter(r => r.status === 'confirmed').length;
  const cancelled = all.filter(r => r.status === 'cancelled').length;
  const revenue   = all.filter(r => r.status !== 'cancelled').reduce((a, r) => a + r.total, 0);
  res.json({ total: all.length, pending, confirmed, cancelled, revenue });
});

module.exports = router;
