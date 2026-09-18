const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const db = new Database('historial.db');

// Configuración para fotos de exámenes y muestras
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));

// Base de Datos SQLite Actualizada
db.exec(`
  CREATE TABLE IF NOT EXISTS familiari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    parentela TEXT,
    piano_sottoscrizione TEXT DEFAULT 'PRO FAMILY'
  );

  CREATE TABLE IF NOT EXISTS medici (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    familiare_id INTEGER,
    nome TEXT,
    specialita TEXT,
    struttura TEXT,
    indirizzo TEXT,
    telefono TEXT
  );

  CREATE TABLE IF NOT EXISTS consulte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    familiare_id INTEGER,
    tipo_evento TEXT,
    motivo TEXT,
    data TEXT,
    ora TEXT,
    medico TEXT,
    luogo TEXT,
    indicazioni TEXT
  );

  CREATE TABLE IF NOT EXISTS farmaci (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    familiare_id INTEGER,
    nome TEXT,
    dose TEXT,
    frequenza TEXT,
    orario TEXT,
    scorta INTEGER DEFAULT 20,
    stato TEXT DEFAULT 'Attivo'
  );

  CREATE TABLE IF NOT EXISTS diario_sintomi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    familiare_id INTEGER,
    data TEXT,
    livello_umore INTEGER,
    livello_dolore INTEGER,
    sintomi_note TEXT
  );

  CREATE TABLE IF NOT EXISTS esami (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    familiare_id INTEGER,
    titolo TEXT,
    categoria TEXT,
    data TEXT,
    file_path TEXT
  );

  CREATE TABLE IF NOT EXISTS suggerimenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    testo TEXT,
    data TEXT
  );
`);

// Primer usuario por defecto
const count = db.prepare('SELECT COUNT(*) as count FROM familiari').get();
if (count.count === 0) {
  db.prepare("INSERT INTO familiari (nome, parentela) VALUES ('Paziente Principale', 'Me stesso')").run();
}

// APIs Familiari
app.get('/api/familiari', (req, res) => res.json(db.prepare('SELECT * FROM familiari').all()));
app.post('/api/familiari', (req, res) => {
  const result = db.prepare('INSERT INTO familiari (nome, parentela) VALUES (?, ?)').run(req.body.nome, req.body.parentela);
  res.json({ id: result.lastInsertRowid });
});

// APIs Medici
app.get('/api/medici', (req, res) => {
  res.json(db.prepare('SELECT * FROM medici WHERE familiare_id = ?').all(req.query.familiare_id || 1));
});
app.post('/api/medici', (req, res) => {
  db.prepare('INSERT INTO medici (familiare_id, nome, specialita, struttura, indirizzo, telefono) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.body.familiare_id, req.body.nome, req.body.specialita, req.body.struttura, req.body.indirizzo, req.body.telefono
  );
  res.json({ success: true });
});
app.delete('/api/medici/:id', (req, res) => {
  db.prepare('DELETE FROM medici WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// APIs Visite ed Esami Prenotati
app.get('/api/consulte', (req, res) => {
  res.json(db.prepare('SELECT * FROM consulte WHERE familiare_id = ? ORDER BY data ASC').all(req.query.familiare_id || 1));
});
app.post('/api/consulte', (req, res) => {
  db.prepare('INSERT INTO consulte (familiare_id, tipo_evento, motivo, data, ora, medico, luogo, indicazioni) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    req.body.familiare_id, req.body.tipo_evento, req.body.motivo, req.body.data, req.body.ora, req.body.medico, req.body.luogo, req.body.indicazioni
  );
  res.json({ success: true });
});
app.delete('/api/consulte/:id', (req, res) => {
  db.prepare('DELETE FROM consulte WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// APIs Farmaci ed Allarmi
app.get('/api/farmaci', (req, res) => {
  res.json(db.prepare('SELECT * FROM farmaci WHERE familiare_id = ?').all(req.query.familiare_id || 1));
});
app.post('/api/farmaci', (req, res) => {
  db.prepare('INSERT INTO farmaci (familiare_id, nome, dose, frequenza, orario, scorta, stato) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    req.body.familiare_id, req.body.nome, req.body.dose, req.body.frequenza, req.body.orario, req.body.scorta || 20, req.body.stato || 'Attivo'
  );
  res.json({ success: true });
});
app.put('/api/farmaci/:id/stato', (req, res) => {
  db.prepare('UPDATE farmaci SET stato = ? WHERE id = ?').run(req.body.stato, req.params.id);
  res.json({ success: true });
});
app.delete('/api/farmaci/:id', (req, res) => {
  db.prepare('DELETE FROM farmaci WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// APIs Diario Clinico e Sintomi
app.get('/api/diario', (req, res) => {
  res.json(db.prepare('SELECT * FROM diario_sintomi WHERE familiare_id = ? ORDER BY data ASC').all(req.query.familiare_id || 1));
});
app.post('/api/diario', (req, res) => {
  db.prepare('INSERT INTO diario_sintomi (familiare_id, data, livello_umore, livello_dolore, sintomi_note) VALUES (?, ?, ?, ?, ?)').run(
    req.body.familiare_id, req.body.data, req.body.livello_umore, req.body.livello_dolore, req.body.sintomi_note
  );
  res.json({ success: true });
});

// APIs Esami e Documenti (Cámara / Subir archivos)
app.get('/api/esami', (req, res) => {
  res.json(db.prepare('SELECT * FROM esami WHERE familiare_id = ? ORDER BY data DESC').all(req.query.familiare_id || 1));
});
app.post('/api/esami', upload.single('documento'), (req, res) => {
  const filePath = req.file ? `/uploads/${req.file.filename}` : '';
  db.prepare('INSERT INTO esami (familiare_id, titolo, categoria, data, file_path) VALUES (?, ?, ?, ?, ?)').run(
    req.body.familiare_id, req.body.titolo, req.body.categoria, req.body.data, filePath
  );
  res.json({ success: true });
});
app.delete('/api/esami/:id', (req, res) => {
  db.prepare('DELETE FROM esami WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// APIs Suggerimenti
app.post('/api/suggerimenti', (req, res) => {
  db.prepare('INSERT INTO suggerimenti (testo, data) VALUES (?, ?)').run(req.body.testo, new Date().toISOString());
  res.json({ success: true });
});
app.get('/api/suggerimenti', (req, res) => {
  const rows = db.prepare('SELECT * FROM suggerimenti ORDER BY id DESC').all();
  res.json(rows);
});
app.listen(3000, () => console.log('🚀 Cartella Clinica Personale attiva su http://localhost:3000'));