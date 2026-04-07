// FraudShield — Full Backend
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const WebSocket  = require('ws');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const Database   = require('better-sqlite3');
const nodemailer = require('nodemailer');
const PDFDoc     = require('pdfkit');
const path       = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'fraudshield-secret-2024';
const PORT       = process.env.PORT || 3000;

// ── Database setup ───────────────────────────────────────
const db = new Database('fraudshield.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email    TEXT,
    role     TEXT DEFAULT 'analyst'
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id        TEXT PRIMARY KEY,
    time      TEXT,
    amount    REAL,
    channel   TEXT,
    merchant  TEXT,
    country   TEXT,
    city      TEXT,
    device    TEXT,
    score     INTEGER,
    status    TEXT,
    factors   TEXT,
    timestamp INTEGER
  );
`);

// Seed default admin if not exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, email, role) VALUES (?,?,?,?)').run('admin', hash, 'admin@fraudshield.com', 'admin');
}

// ── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── WebSocket broadcast ──────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'connected', message: 'FraudShield live feed connected' }));
});

// ── Email alerts (Nodemailer + Ethereal free SMTP) ───────
let mailer = null;
nodemailer.createTestAccount().then(account => {
  mailer = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: account.user, pass: account.pass },
  });
  console.log('📧 Email preview at: https://ethereal.email');
}).catch(() => {});

async function sendFraudAlert(txn) {
  if (!mailer) return;
  try {
    const info = await mailer.sendMail({
      from: '"FraudShield" <alerts@fraudshield.com>',
      to:   'admin@fraudshield.com',
      subject: `🚨 Fraud Alert: ${txn.id} — Score ${txn.score}`,
      html: `
        <h2 style="color:#f05252">Fraud Detected</h2>
        <table>
          <tr><td><b>ID</b></td><td>${txn.id}</td></tr>
          <tr><td><b>Amount</b></td><td>₹${txn.amount.toLocaleString('en-IN')}</td></tr>
          <tr><td><b>Channel</b></td><td>${txn.channel}</td></tr>
          <tr><td><b>Country</b></td><td>${txn.country}</td></tr>
          <tr><td><b>Risk Score</b></td><td>${txn.score}/99</td></tr>
        </table>
      `,
    });
    console.log('📧 Alert sent:', nodemailer.getTestMessageUrl(info));
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

// ── Fraud scoring engine ─────────────────────────────────
function scoreTransaction(data) {
  const { amount, country, merchant, device, velocity, timeSlot } = data;
  let score = 0;
  const factors = [];

  if (amount > 100000)     { score += 28; factors.push({ name: 'High Amount (>₹1L)', impact: 'high', pts: 28 }); }
  else if (amount > 50000) { score += 12; factors.push({ name: 'Large Amount', impact: 'med', pts: 12 }); }
  else                     { factors.push({ name: 'Normal Amount', impact: 'low', pts: 0 }); }

  if (country === 'Russia' || country === 'Nigeria') { score += 35; factors.push({ name: 'High-Risk Country', impact: 'high', pts: 35 }); }
  else if (country !== 'India')                      { score += 10; factors.push({ name: 'Cross-Border', impact: 'med', pts: 10 }); }
  else                                               { factors.push({ name: 'Domestic Transaction', impact: 'low', pts: 0 }); }

  if (merchant === 'Gambling' || merchant === 'Crypto Exchange') { score += 25; factors.push({ name: 'Blacklisted Category', impact: 'high', pts: 25 }); }
  else { factors.push({ name: 'Merchant Category OK', impact: 'low', pts: 0 }); }

  if (device === 'TOR Exit Node')    { score += 40; factors.push({ name: 'TOR Network', impact: 'high', pts: 40 }); }
  else if (device === 'VPN Detected') { score += 15; factors.push({ name: 'VPN Detected', impact: 'med', pts: 15 }); }
  else if (device === 'New Device')  { score += 8;  factors.push({ name: 'Unrecognized Device', impact: 'med', pts: 8 }); }
  else                               { factors.push({ name: 'Known Device', impact: 'low', pts: 0 }); }

  if (velocity === 'Burst (5 in 1 min)') { score += 30; factors.push({ name: 'Burst Velocity', impact: 'high', pts: 30 }); }
  else if (velocity === 'High (10+/day)') { score += 15; factors.push({ name: 'High Velocity', impact: 'med', pts: 15 }); }
  else                                    { factors.push({ name: 'Normal Velocity', impact: 'low', pts: 0 }); }

  if (timeSlot === 'Night (22–6)') { score += 10; factors.push({ name: 'Night Transaction', impact: 'med', pts: 10 }); }

  score = Math.min(score, 99);
  const status = score >= 70 ? 'fraud' : score >= 40 ? 'review' : 'clear';
  return { score, status, factors };
}

// ── Exchange rate ────────────────────────────────────────
async function getExchangeRate(country) {
  const map = { India:'INR', USA:'USD', UK:'GBP', Russia:'RUB', Nigeria:'NGN', China:'CNY', Germany:'EUR' };
  const currency = map[country] || 'INR';
  if (currency === 'INR') return { currency: 'INR', rate: 1 };
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/INR');
    const data = await res.json();
    return { currency, rate: data.rates?.[currency] ?? 1 };
  } catch { return { currency, rate: 1 }; }
}

// ── AUTH ROUTES ──────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username: user.username, role: user.role });
});

// POST /api/auth/register (admin only in production — open for demo)
app.post('/api/auth/register', (req, res) => {
  const { username, password, email, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password, email, role) VALUES (?,?,?,?)').run(username, hash, email || '', role || 'analyst');
    res.json({ message: 'User created' });
  } catch {
    res.status(409).json({ error: 'Username already exists' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// GET /api/users (admin only)
app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare('SELECT id, username, email, role FROM users').all();
  res.json(users);
});

// DELETE /api/users/:id (admin only)
app.delete('/api/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// ── TRANSACTION ROUTES ───────────────────────────────────

// POST /api/analyze
app.post('/api/analyze', authMiddleware, async (req, res) => {
  const { amount, channel, merchant, country, timeSlot, device, velocity } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  const { score, status, factors } = scoreTransaction(req.body);
  const fx = await getExchangeRate(country);

  const id  = `TXN${Date.now()}`;
  const txn = {
    id, time: new Date().toTimeString().slice(0, 8),
    amount: Number(amount), channel, merchant, country,
    city: 'Simulated', device, score, status,
    factors, fx, timestamp: Date.now(),
  };

  db.prepare(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    txn.id, txn.time, txn.amount, txn.channel, txn.merchant,
    txn.country, txn.city, txn.device, txn.score, txn.status,
    JSON.stringify(txn.factors), txn.timestamp
  );

  // WebSocket broadcast
  broadcast({ type: 'transaction', data: txn });

  // Email alert for fraud
  if (status === 'fraud') {
    broadcast({ type: 'alert', data: { message: `🚨 Fraud: ${id} — ₹${amount} via ${channel}`, txn } });
    sendFraudAlert(txn);
  }

  res.json(txn);
});

// GET /api/transactions
app.get('/api/transactions', authMiddleware, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  const query = status
    ? db.prepare('SELECT * FROM transactions WHERE status=? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(status, limit, offset)
    : db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset);

  const total = status
    ? db.prepare('SELECT COUNT(*) as c FROM transactions WHERE status=?').get(status).c
    : db.prepare('SELECT COUNT(*) as c FROM transactions').get().c;

  const data = query.map(t => ({ ...t, factors: JSON.parse(t.factors || '[]') }));
  res.json({ total, data });
});

// GET /api/stats
app.get('/api/stats', authMiddleware, (req, res) => {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status='fraud'  THEN 1 ELSE 0 END) as fraud,
      SUM(CASE WHEN status='clear'  THEN 1 ELSE 0 END) as clear,
      SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
      COUNT(*) as total
    FROM transactions
  `).get();
  res.json(row);
});

// GET /api/geo
app.get('/api/geo', authMiddleware, async (req, res) => {
  try {
    const r    = await fetch('https://ipapi.co/json/');
    const data = await r.json();
    res.json({ city: data.city, country: data.country_name, ip: data.ip });
  } catch { res.json({ city: 'Unknown', country: 'Unknown', ip: '' }); }
});

// GET /api/report/pdf — download PDF report
app.get('/api/report/pdf', authMiddleware, (req, res) => {
  const txns = db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 100').all();
  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN status='fraud'  THEN 1 ELSE 0 END) as fraud,
      SUM(CASE WHEN status='clear'  THEN 1 ELSE 0 END) as clear,
      SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
      COUNT(*) as total
    FROM transactions
  `).get();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="fraudshield-report.pdf"');

  const doc = new PDFDoc({ margin: 40 });
  doc.pipe(res);

  // Header
  doc.fontSize(22).fillColor('#f05252').text('FraudShield — Fraud Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#888').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1);

  // Stats
  doc.fontSize(14).fillColor('#333').text('Summary');
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#000')
    .text(`Total Transactions: ${stats.total}`)
    .text(`Fraud Detected:     ${stats.fraud}`)
    .text(`Under Review:       ${stats.review}`)
    .text(`Cleared:            ${stats.clear}`);
  doc.moveDown(1);

  // Table header
  doc.fontSize(14).fillColor('#333').text('Recent Transactions (last 100)');
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#555');

  const cols = [40, 110, 180, 240, 300, 370, 430, 490];
  const headers = ['ID', 'Time', 'Amount', 'Channel', 'Country', 'Score', 'Status'];
  headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { continued: i < headers.length - 1 }));
  doc.moveDown(0.2);
  doc.moveTo(40, doc.y).lineTo(560, doc.y).stroke('#ccc');
  doc.moveDown(0.3);

  txns.forEach(t => {
    if (doc.y > 720) { doc.addPage(); }
    const row = [t.id, t.time, `Rs${t.amount}`, t.channel, t.country, String(t.score), t.status.toUpperCase()];
    doc.fontSize(8).fillColor(t.status === 'fraud' ? '#f05252' : t.status === 'review' ? '#f5a623' : '#22a37a');
    row.forEach((v, i) => doc.text(v, cols[i], doc.y, { continued: i < row.length - 1, width: cols[i+1] - cols[i] - 4 }));
    doc.moveDown(0.3);
  });

  doc.end();
});

// ── Page routes ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.redirect('/dashboard'));
app.use(express.static(__dirname));

// ── Start ────────────────────────────────────────────────
server.listen(PORT, () => console.log(`✅ FraudShield running → http://localhost:${PORT}`));
