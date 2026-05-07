const Database = require('better-sqlite3');
const path     = require('path');
const bcrypt   = require('bcryptjs');

// Usa DB_PATH definido pelo server.js (suporta Railway volume)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/chale.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    seedDefaults();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      price       REAL NOT NULL,
      capacity    INTEGER DEFAULT 2,
      emoji       TEXT DEFAULT '🛏️',
      description TEXT DEFAULT '',
      img_url     TEXT DEFAULT '',
      breakfast   INTEGER DEFAULT 1,
      active      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      price       REAL DEFAULT 0,
      emoji       TEXT DEFAULT '✨',
      category    TEXT DEFAULT 'Outro',
      description TEXT DEFAULT '',
      active      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS price_tiers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL,
      price      REAL NOT NULL,
      date_start TEXT DEFAULT '',
      date_end   TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      date TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name   TEXT NOT NULL,
      guest_phone  TEXT NOT NULL,
      guest_email  TEXT DEFAULT '',
      guests       TEXT DEFAULT '2 pessoas',
      observation  TEXT DEFAULT '',
      room_id      INTEGER NOT NULL,
      room_name    TEXT NOT NULL,
      check_in     TEXT NOT NULL,
      check_out    TEXT NOT NULL,
      nights       INTEGER NOT NULL,
      total        REAL NOT NULL,
      status       TEXT DEFAULT 'pending',
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );
  `);
}

function seedDefaults() {
  const cfgCount = db.prepare('SELECT COUNT(*) as c FROM config').get().c;
  if (cfgCount === 0) {
    const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
    const configs = [
      ['admin_password_hash', adminHash],
      ['whatsapp',   process.env.WHATSAPP_NUMBER || '5532985003002'],
      ['email',      'contato@gratitudechale.com.br'],
      ['address',    'Rodovia MG 120, km 715 - Zona Rural, Cataguases - MG, 36775-899'],
      ['checkinout', 'Check-in 15h · Check-out 12h'],
    ];
    const insert = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
    configs.forEach(([k, v]) => insert.run(k, v));
  }

  const roomCount = db.prepare('SELECT COUNT(*) as c FROM rooms').get().c;
  if (roomCount === 0) {
    db.prepare(`INSERT INTO rooms (name,price,capacity,emoji,description,breakfast) VALUES (?,?,?,?,?,?)`)
      .run('Chalé Casal — Vista Privilegiada', 350, 2, '🛏️',
        'Cama queen size, ar condicionado quente e frio, Smart TV, cozinha completa e vista privilegiada para a natureza.', 1);
  }

  const svcCount = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
  if (svcCount === 0) {
    db.prepare('INSERT INTO services (name,price,emoji,category,description) VALUES (?,?,?,?,?)').run(
      'Café da Manhã Completo', 0, '☕', 'Alimentação', 'Mesa farta com pães caseiros, frutas, ovos e sucos naturais. Incluso.');
    db.prepare('INSERT INTO services (name,price,emoji,category,description) VALUES (?,?,?,?,?)').run(
      'Cozinha Completa', 0, '🍳', 'Comodidade', 'Cozinha totalmente equipada à sua disposição.');
  }

  const tierCount = db.prepare('SELECT COUNT(*) as c FROM price_tiers').get().c;
  if (tierCount === 0) {
    db.prepare('INSERT INTO price_tiers (name,type,price) VALUES (?,?,?)').run('Semana (Seg–Qui)', 'week', 350);
    db.prepare('INSERT INTO price_tiers (name,type,price) VALUES (?,?,?)').run('Fim de semana (Sex–Dom)', 'weekend', 420);
    db.prepare('INSERT INTO price_tiers (name,type,price) VALUES (?,?,?)').run('Feriados', 'holiday', 480);
  }
}

// ── CONFIG ──
function getConfig() {
  return Object.fromEntries(db.prepare('SELECT key,value FROM config').all().map(r=>[r.key,r.value]));
}
function setConfig(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key,value) VALUES (?,?)').run(key, value);
}

// ── ROOMS ──
function getRooms()       { return db.prepare('SELECT * FROM rooms WHERE active=1 ORDER BY id').all(); }
function getRoomById(id)  { return db.prepare('SELECT * FROM rooms WHERE id=?').get(id); }
function createRoom(d) {
  return db.prepare('INSERT INTO rooms (name,price,capacity,emoji,description,img_url,breakfast) VALUES (?,?,?,?,?,?,?)')
    .run(d.name, d.price, d.capacity||2, d.emoji||'🛏️', d.description||'', d.img_url||'', d.breakfast?1:0);
}
function updateRoom(id, d) {
  db.prepare('UPDATE rooms SET name=?,price=?,capacity=?,emoji=?,description=?,img_url=?,breakfast=? WHERE id=?')
    .run(d.name, d.price, d.capacity||2, d.emoji||'🛏️', d.description||'', d.img_url||'', d.breakfast?1:0, id);
}
function deleteRoom(id)   { db.prepare('UPDATE rooms SET active=0 WHERE id=?').run(id); }

// ── SERVICES ──
function getServices()    { return db.prepare('SELECT * FROM services WHERE active=1 ORDER BY id').all(); }
function createService(d) {
  return db.prepare('INSERT INTO services (name,price,emoji,category,description) VALUES (?,?,?,?,?)')
    .run(d.name, d.price||0, d.emoji||'✨', d.category||'Outro', d.description||'');
}
function deleteService(id){ db.prepare('UPDATE services SET active=0 WHERE id=?').run(id); }

// ── PRICE TIERS ──
function getPriceTiers()  { return db.prepare('SELECT * FROM price_tiers ORDER BY id').all(); }
function upsertPriceTier(d) {
  if (['week','weekend','holiday'].includes(d.type)) {
    const ex = db.prepare("SELECT id FROM price_tiers WHERE type=? AND (date_start='' OR date_start IS NULL)").get(d.type);
    if (ex) { db.prepare('UPDATE price_tiers SET price=? WHERE id=?').run(d.price, ex.id); return ex.id; }
  }
  return db.prepare('INSERT INTO price_tiers (name,type,price,date_start,date_end) VALUES (?,?,?,?,?)')
    .run(d.name, d.type||'custom', d.price, d.date_start||'', d.date_end||'').lastInsertRowid;
}
function deletePriceTier(id){ db.prepare('DELETE FROM price_tiers WHERE id=?').run(id); }

// ── BLOCKED DATES ──
function getBlockedDates()   { return db.prepare('SELECT date FROM blocked_dates').all().map(r=>r.date); }
function blockDate(date)     { db.prepare('INSERT OR IGNORE INTO blocked_dates (date) VALUES (?)').run(date); }
function unblockDate(date)   { db.prepare('DELETE FROM blocked_dates WHERE date=?').run(date); }

// ── RESERVATIONS ──
function getReservations(filters={}) {
  let sql = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];
  if (filters.status) { sql += ' AND status=?'; params.push(filters.status); }
  if (filters.search) { sql += ' AND guest_name LIKE ?'; params.push('%'+filters.search+'%'); }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}
function getReservationById(id){ return db.prepare('SELECT * FROM reservations WHERE id=?').get(id); }
function createReservation(d) {
  return db.prepare(`INSERT INTO reservations
    (guest_name,guest_phone,guest_email,guests,observation,room_id,room_name,check_in,check_out,nights,total,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')`)
    .run(d.guest_name,d.guest_phone,d.guest_email||'',d.guests||'2 pessoas',d.observation||'',
         d.room_id,d.room_name,d.check_in,d.check_out,d.nights,d.total);
}
function updateReservationStatus(id, status) {
  db.prepare('UPDATE reservations SET status=? WHERE id=?').run(status, id);
  const resv = getReservationById(id);
  if (!resv) return;
  if (status === 'confirmed') {
    datesBetween(resv.check_in, resv.check_out).forEach(d => blockDate(d));
  }
  if (status === 'cancelled') {
    datesBetween(resv.check_in, resv.check_out).forEach(d => {
      const stillUsed = db.prepare(
        "SELECT id FROM reservations WHERE id!=? AND status='confirmed' AND check_in<=? AND check_out>?"
      ).get(id, d, d);
      if (!stillUsed) unblockDate(d);
    });
  }
}

// ── HELPERS ──
function datesBetween(start, end) {
  const dates = [];
  const cur = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  while (cur < endD) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }
  return dates;
}
function isDateAvailable(date) {
  if (db.prepare('SELECT date FROM blocked_dates WHERE date=?').get(date)) return false;
  return !db.prepare("SELECT id FROM reservations WHERE status!='cancelled' AND check_in<=? AND check_out>?").get(date, date);
}

module.exports = {
  getDb, getConfig, setConfig,
  getRooms, getRoomById, createRoom, updateRoom, deleteRoom,
  getServices, createService, deleteService,
  getPriceTiers, upsertPriceTier, deletePriceTier,
  getBlockedDates, blockDate, unblockDate, datesBetween,
  getReservations, getReservationById, createReservation, updateReservationStatus,
  isDateAvailable
};
