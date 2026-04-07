// ─────────────────────────────────────────────────────────
//  FraudShield — Main Application Logic
// ─────────────────────────────────────────────────────────
const API_BASE = '/api';

// ── Auth helpers ───────────────────────────────────────
function getToken() { return localStorage.getItem('fs_token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('fs_user')); } catch { return null; } }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }; }
function logout() { localStorage.removeItem('fs_token'); localStorage.removeItem('fs_user'); window.location.replace('/'); }

// Show logged-in user in topbar
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (user) {
    const topRight = document.querySelector('.topbar-right');
    if (topRight) {
      const userEl = document.createElement('div');
      userEl.style.cssText = 'font-size:12px;color:var(--text-sub);font-family:var(--font-mono);display:flex;align-items:center;gap:8px';
      userEl.innerHTML = `<span>👤 ${user.username}</span><button onclick="logout()" style="background:none;border:1px solid var(--border);color:var(--text-sub);padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px">Logout</button>`;
      topRight.prepend(userEl);
    }
  }
});

// ── WebSocket ───────────────────────────────────────────
function connectWS() {
  const ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'transaction') {
        const txn = { ...msg.data, city: msg.data.city || 'Unknown' };
        if (txn.status === 'fraud') {
          state.fraudCount++;
          state.alertCount++;
          document.getElementById('bellCount').textContent = state.alertCount;
          addAlert(txn); // Add to alert history
          const banner = document.getElementById('alertBanner');
          banner.style.display = 'flex';
          document.getElementById('alertText').textContent =
            `⚠ Fraud detected: ${txn.id} — ${formatINR(txn.amount)} via ${txn.channel} from ${txn.country} (Score: ${txn.score})`;
          setTimeout(() => { banner.style.display = 'none'; }, 5000);
        } else if (txn.status === 'review') state.reviewCount++;
        else state.clearCount++;
        document.getElementById('kpi-fraud').textContent  = state.fraudCount;
        document.getElementById('kpi-clear').textContent  = state.clearCount;
        document.getElementById('kpi-review').textContent = state.reviewCount;
        if (document.getElementById('page-dashboard')?.classList.contains('active')) addToFeed(txn);
        addToHistory(txn);
        updateDonut();
        updateGeoStats(txn);
      }
    } catch {}
  };
  ws.onclose = () => setTimeout(connectWS, 3000);
}

// ── State ──────────────────────────────────────────────
const state = {
  transactions: [],
  fraudCount: 0,
  clearCount: 0,
  reviewCount: 0,
  alertCount: 0,
  alerts: [], // Store alert history
  volumeData: Array(24).fill(0).map(() => Math.floor(Math.random() * 80 + 20)),
  riskData: [0, 0, 0],
};

// ── Data generators ─────────────────────────────────────
const CHANNELS    = ['UPI', 'Net Banking', 'Credit Card', 'NEFT', 'IMPS', 'RTGS'];
const MERCHANTS   = ['Amazon', 'Flipkart', 'Zomato', 'PhonePe', 'Swiggy', 'Crypto Bazar', 'Lucky Slots', 'OnePlus', 'MakeMyTrip', 'BigBasket'];
const COUNTRIES   = ['India', 'India', 'India', 'India', 'USA', 'UK', 'Russia', 'Nigeria', 'China', 'Germany'];
const DEVICES     = ['Known Device', 'New Device', 'VPN Detected', 'TOR Exit Node'];
const CITIES      = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat'];

let txnCounter = 1000;

function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

function now() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatINR(amt) {
  return '₹' + amt.toLocaleString('en-IN');
}

function generateTransaction() {
  const amount   = randomBetween(100, 250000);
  const channel  = CHANNELS[randomBetween(0, CHANNELS.length - 1)];
  const merchant = MERCHANTS[randomBetween(0, MERCHANTS.length - 1)];
  const country  = COUNTRIES[randomBetween(0, COUNTRIES.length - 1)];
  const device   = DEVICES[randomBetween(0, 1)];
  const city     = CITIES[randomBetween(0, CITIES.length - 1)];

  // Scoring logic
  let score = 0;
  if (amount > 100000)      score += 30;
  else if (amount > 50000)  score += 15;
  if (country === 'Russia' || country === 'Nigeria') score += 35;
  if (merchant === 'Crypto Bazar' || merchant === 'Lucky Slots') score += 25;
  if (device === 'VPN Detected') score += 15;
  if (device === 'TOR Exit Node') score += 40;
  score += randomBetween(0, 20);
  score = Math.min(score, 99);

  let status;
  if (score >= 70)       status = 'fraud';
  else if (score >= 40)  status = 'review';
  else                   status = 'clear';

  txnCounter++;
  return {
    id: `TXN${txnCounter}`,
    time: now(),
    amount,
    channel,
    merchant,
    country,
    city,
    device,
    score,
    status,
    timestamp: Date.now(),
  };
}

// ── Charts ─────────────────────────────────────────────
let volumeChart = null;
let riskDonut   = null;

function initCharts() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? '#6b7594' : '#6b7594';

  // Volume Chart
  const vCtx = document.getElementById('volumeChart');
  if (!vCtx) return;

  const hours = Array.from({length:24}, (_,i) => `${pad(i)}:00`);

  volumeChart = new Chart(vCtx, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'All Transactions',
          data: state.volumeData,
          borderColor: '#4f8ef7',
          backgroundColor: 'rgba(79,142,247,0.08)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
        },
        {
          label: 'Fraud',
          data: state.volumeData.map(v => Math.floor(v * (Math.random() * 0.15))),
          borderColor: '#f05252',
          backgroundColor: 'rgba(240,82,82,0.06)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: labelColor, font: { family: "'JetBrains Mono'" }, boxWidth: 12 } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: labelColor, maxTicksLimit: 8, font: { family: "'JetBrains Mono'", size: 10 } } },
        y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { family: "'JetBrains Mono'", size: 10 } } }
      }
    }
  });

  // Donut
  const dCtx = document.getElementById('riskDonut');
  if (!dCtx) return;
  
  riskDonut = new Chart(dCtx, {
    type: 'doughnut',
    data: {
      labels: ['Fraud', 'Review', 'Cleared'],
      datasets: [{
        data: [state.fraudCount || 1, state.reviewCount || 1, state.clearCount || 1],
        backgroundColor: ['#f05252', '#f5a623', '#22d3a0'],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { 
            color: labelColor, 
            font: { family: "'JetBrains Mono'", size: 11 }, 
            padding: 12, 
            boxWidth: 10,
            usePointStyle: true
          }
        }
      }
    }
  });
}

let donutTimer = null;
function updateDonut() {
  if (!riskDonut) return;
  clearTimeout(donutTimer);
  donutTimer = setTimeout(() => {
    riskDonut.data.datasets[0].data = [state.fraudCount || 1, state.reviewCount || 1, state.clearCount || 1];
    riskDonut.update('none');
  }, 500);
}

// ── Alert Management ───────────────────────────────────
function addAlert(txn) {
  console.log('🚨 Adding alert for transaction:', txn.id);
  
  const alert = {
    id: Date.now(),
    time: now(),
    message: `Fraud detected: ${txn.id}`,
    details: `${formatINR(txn.amount)} via ${txn.channel} from ${txn.country}`,
    score: txn.score,
    txn: txn,
    read: false,
    timestamp: Date.now()
  };
  
  state.alerts.unshift(alert);
  // Keep only last 50 alerts
  if (state.alerts.length > 50) state.alerts.pop();
  
  console.log('✅ Alert added to state. Total alerts:', state.alerts.length);
  console.log('📊 Current state.alerts:', state.alerts.slice(0, 3)); // Show first 3
  
  updateAlertDropdown();
}

function toggleAlertDropdown() {
  console.log('🔔 Bell clicked - toggling dropdown');
  
  const dropdown = document.getElementById('alertDropdown');
  if (!dropdown) {
    console.error('❌ alertDropdown element not found!');
    return;
  }
  
  const isVisible = dropdown.classList.contains('show');
  console.log('👁️ Dropdown currently visible:', isVisible);
  
  // Close if open, open if closed
  if (isVisible) {
    dropdown.classList.remove('show');
    console.log('✅ Dropdown closed');
  } else {
    dropdown.classList.add('show');
    console.log('✅ Dropdown opened');
    // Mark all alerts as read when dropdown is opened
    state.alerts.forEach(alert => alert.read = true);
    updateAlertDropdown();
    console.log('📚 Marked', state.alerts.length, 'alerts as read');
  }
}

function clearAllAlerts(event) {
  event.stopPropagation(); // Prevent dropdown from closing
  state.alerts = [];
  state.alertCount = 0;
  document.getElementById('bellCount').textContent = '0';
  updateAlertDropdown();
}

function updateAlertDropdown() {
  const dropdownBody = document.getElementById('alertDropdownBody');
  if (!dropdownBody) return;
  
  if (state.alerts.length === 0) {
    dropdownBody.innerHTML = '<div class="no-alerts">No alerts yet</div>';
    return;
  }
  
  dropdownBody.innerHTML = state.alerts.slice(0, 20).map(alert => `
    <div class="alert-item ${alert.read ? '' : 'unread'}" onclick="openAlertModal('${alert.id}')">
      <div class="alert-time">${alert.time}</div>
      <div class="alert-message">${alert.message}</div>
      <div class="alert-details">${alert.details} • Score: ${alert.score}</div>
    </div>
  `).join('');
}

function openAlertModal(alertId) {
  const alert = state.alerts.find(a => a.id == alertId);
  if (alert) {
    openModal(alert.txn);
    // Close dropdown
    document.getElementById('alertDropdown').classList.remove('show');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const alertBell = document.getElementById('alertBell');
  const dropdown = document.getElementById('alertDropdown');
  if (alertBell && dropdown && !alertBell.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});
const MAX_FEED = 20;

function addToFeed(txn) {
  const feedRows = document.getElementById('feedRows');
  if (!feedRows) return;

  const fillColor = txn.score >= 70 ? '#f05252' : txn.score >= 40 ? '#f5a623' : '#22d3a0';
  const pct = txn.score + '%';

  const row = document.createElement('div');
  row.className = 'feed-row';
  row.innerHTML = `
    <span style="color:var(--text-sub)">${txn.time}</span>
    <span>${formatINR(txn.amount)}</span>
    <span>${txn.channel}</span>
    <span>${txn.city}, ${txn.country}</span>
    <span class="risk-bar">
      <div class="risk-track"><div class="risk-fill" style="width:${pct};background:${fillColor}"></div></div>
      <span style="font-size:11px;color:${fillColor}">${txn.score}</span>
    </span>
    <span><span class="badge badge-${txn.status}">${txn.status.toUpperCase()}</span></span>
  `;
  row.addEventListener('click', () => openModal(txn));

  feedRows.insertBefore(row, feedRows.firstChild);
  const rows = feedRows.querySelectorAll('.feed-row');
  if (rows.length > MAX_FEED) rows[rows.length - 1].remove();
}

// ── History ────────────────────────────────────────────
const MAX_HISTORY = 200;

let historyRenderTimer = null;
function addToHistory(txn) {
  state.transactions.unshift(txn);
  if (state.transactions.length > MAX_HISTORY) state.transactions.pop();
  // Only re-render history table if that page is active
  if (document.getElementById('page-history')?.classList.contains('active')) {
    clearTimeout(historyRenderTimer);
    historyRenderTimer = setTimeout(renderHistory, 800);
  }
}

function renderHistory(filter = null) {
  const searchVal = (document.getElementById('histSearch')?.value || '').toLowerCase();
  const statusVal = document.getElementById('histFilter')?.value || 'all';

  const tbody = document.getElementById('histBody');
  if (!tbody) return;

  const filtered = state.transactions.filter(t => {
    const matchStatus = statusVal === 'all' || t.status === statusVal;
    const matchSearch = !searchVal ||
      t.id.toLowerCase().includes(searchVal) ||
      String(t.amount).includes(searchVal) ||
      t.country.toLowerCase().includes(searchVal) ||
      t.merchant.toLowerCase().includes(searchVal) ||
      t.channel.toLowerCase().includes(searchVal);
    return matchStatus && matchSearch;
  });

  tbody.innerHTML = filtered.slice(0, 100).map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.time}</td>
      <td>${formatINR(t.amount)}</td>
      <td>${t.channel}</td>
      <td>${t.merchant}</td>
      <td>${t.country}</td>
      <td style="color:${t.score>=70?'var(--danger)':t.score>=40?'var(--warn)':'var(--safe)'}">${t.score}</td>
      <td><span class="badge badge-${t.status}">${t.status.toUpperCase()}</span></td>
      <td><button class="action-btn" onclick="openModal(window.__txnMap?.['${t.id}'])">Details</button></td>
    </tr>
  `).join('');

  // Expose map for onclick
  window.__txnMap = {};
  filtered.forEach(t => window.__txnMap[t.id] = t);
}

function filterHistory() { renderHistory(); }

function exportCSV() {
  const headers = 'ID,Time,Amount,Channel,Merchant,Country,Score,Status\n';
  const rows = state.transactions.map(t =>
    `${t.id},${t.time},${t.amount},${t.channel},${t.merchant},${t.country},${t.score},${t.status}`
  ).join('\n');
  const blob = new Blob([headers + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'fraudshield_transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Heatmap ─────────────────────────────────────────────
const GEO_DATA = [
  { name: 'Mumbai',    risk: 'high',   count: 0 },
  { name: 'Delhi',     risk: 'medium', count: 0 },
  { name: 'Bangalore', risk: 'low',    count: 0 },
  { name: 'Chennai',   risk: 'low',    count: 0 },
  { name: 'Kolkata',   risk: 'medium', count: 0 },
];

function initHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < 100; i++) {
    const cell = document.createElement('div');
    cell.className = 'heat-cell';
    const r = Math.random();
    let color, risk;
    if (r < 0.15)      { color = '#f05252'; risk = 'HIGH'; }
    else if (r < 0.40) { color = '#f5a623'; risk = 'MED'; }
    else               { color = '#22d3a0'; risk = 'LOW'; }
    cell.style.background = color + (r < 0.15 ? '99' : r < 0.40 ? '77' : '44');
    cell.title = `Zone ${i+1} — Risk: ${risk}`;
    grid.appendChild(cell);
  }

  // Geo stats
  const statsDiv = document.getElementById('geoStats');
  if (!statsDiv) return;
  statsDiv.innerHTML = GEO_DATA.map(g => `
    <div class="geo-item">
      <div class="geo-name">${g.name}</div>
      <div class="geo-count" style="color:${g.risk==='high'?'var(--danger)':g.risk==='medium'?'var(--warn)':'var(--safe)'}" id="geo-${g.name}">${g.count}</div>
      <div class="geo-risk-label" style="color:${g.risk==='high'?'var(--danger)':g.risk==='medium'?'var(--warn)':'var(--safe)'}">${g.risk} risk</div>
    </div>
  `).join('');
}

function updateGeoStats(txn) {
  const city = GEO_DATA.find(g => g.name === txn.city);
  if (city) {
    city.count++;
    const el = document.getElementById('geo-' + city.name);
    if (el) el.textContent = city.count;
  }
}

// ── Network Graph ──────────────────────────────────────
const nodes = [];
const edges = [];
let networkAnimFrame = null;

function initNetwork() {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;

  const W = canvas.offsetWidth || 700;
  const H = 480;
  canvas.width  = W;
  canvas.height = H;

  nodes.length = 0;
  edges.length = 0;

  // Generate nodes
  for (let i = 0; i < 30; i++) {
    nodes.push({
      x: randomBetween(60, W - 60),
      y: randomBetween(60, H - 60),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: randomBetween(8, 16),
      fraud: Math.random() < 0.25,
      id: i,
      label: `ACC${1000 + i}`,
    });
  }

  // Generate edges between nearby nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 140 && Math.random() < 0.35) {
        edges.push({ from: i, to: j, suspicious: nodes[i].fraud || nodes[j].fraud });
      }
    }
  }

  drawNetwork(canvas);
}

function drawNetwork(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Move nodes
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < n.r || n.x > W - n.r) n.vx *= -1;
      if (n.y < n.r || n.y > H - n.r) n.vy *= -1;
    });

    // Draw edges
    edges.forEach(e => {
      const a = nodes[e.from], b = nodes[e.to];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.suspicious
        ? 'rgba(240,82,82,0.35)'
        : (isDark ? 'rgba(79,142,247,0.15)' : 'rgba(37,99,235,0.12)');
      ctx.lineWidth = e.suspicious ? 1.5 : 1;
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      if (n.fraud) {
        ctx.fillStyle = 'rgba(240,82,82,0.25)';
        ctx.fill();
        ctx.strokeStyle = '#f05252';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = isDark ? 'rgba(79,142,247,0.2)' : 'rgba(37,99,235,0.15)';
        ctx.fill();
        ctx.strokeStyle = isDark ? '#4f8ef7' : '#2563eb';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = isDark ? '#e8eaf2' : '#1a1e2e';
      ctx.font = '9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y + n.r + 12);
    });

    networkAnimFrame = requestAnimationFrame(draw);
  }

  if (networkAnimFrame) cancelAnimationFrame(networkAnimFrame);
  draw();
}

// ── Simulation ─────────────────────────────────────────
document.getElementById('runSim')?.addEventListener('click', runSimulation);

async function runSimulation() {
  const btn = document.getElementById('runSim');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing...';

  const payload = {
    amount:   parseFloat(document.getElementById('sim-amount').value) || randomBetween(500, 50000),
    channel:  document.getElementById('sim-channel').value,
    merchant: document.getElementById('sim-merchant').value,
    country:  document.getElementById('sim-country').value,
    timeSlot: document.getElementById('sim-time').value,
    device:   document.getElementById('sim-device').value,
    velocity: document.getElementById('sim-velocity').value,
  };

  let txn;
  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return logout();
    txn = await res.json();
  } catch {
    // Fallback: score locally if backend is offline
    txn = localScore(payload);
  }

  btn.disabled = false;
  btn.textContent = '▶ Run Analysis';

  const { score, status, factors, fx } = txn;
  const color = score >= 70 ? '#f05252' : score >= 40 ? '#f5a623' : '#22d3a0';
  const verdict = score >= 70 ? '🚨 FRAUD DETECTED' : score >= 40 ? '⚠ FLAGGED FOR REVIEW' : '✓ TRANSACTION CLEARED';
  const vClass  = score >= 70 ? 'verdict-fraud' : score >= 40 ? 'verdict-review' : 'verdict-safe';
  const fxNote  = fx && fx.currency !== 'INR' ? `<div style="font-size:11px;color:var(--text-sub);margin-top:6px">Live FX: 1 INR = ${fx.rate?.toFixed(4)} ${fx.currency}</div>` : '';

  const result = document.getElementById('simResult');
  result.style.alignItems = 'flex-start';
  result.innerHTML = `
    <div class="result-display">
      <div class="result-score-ring">
        <div class="score-circle" style="border-color:${color}">
          <div class="score-number" style="color:${color}">${score}</div>
          <div class="score-label" style="color:${color}">RISK</div>
        </div>
        <div class="result-verdict ${vClass}">${verdict}</div>
      </div>
      ${fxNote}
      <div style="margin-bottom:12px;margin-top:14px;font-size:12px;color:var(--text-sub);font-weight:700;text-transform:uppercase;letter-spacing:0.7px">Factor Analysis</div>
      <div class="factors-list">
        ${factors.map(f => `
          <div class="factor-item">
            <span class="factor-name">${f.name}</span>
            <span class="factor-impact impact-${f.impact}">${f.pts > 0 ? '+'+f.pts : '—'}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--surface2);border-radius:8px;font-size:12px;font-family:var(--font-mono);color:var(--text-sub)">
        Recommendation: <strong style="color:var(--text)">${score>=70?'Block & Alert User':score>=40?'Hold for manual review':'Approve transaction'}</strong>
      </div>
    </div>
  `;

  // Add to live feed & history
  const enriched = { ...txn, city: 'Simulated', timestamp: Date.now() };
  addToFeed(enriched);
  addToHistory(enriched);
}

function localScore(data) {
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
  return { id: `TXN-LOCAL`, score, status: score>=70?'fraud':score>=40?'review':'clear', factors, fx: null };
}

// ── Modal ───────────────────────────────────────────────
function openModal(txn) {
  if (!txn) return;
  document.getElementById('modalContent').innerHTML = `
    <h2 style="font-size:18px;font-weight:800;margin-bottom:20px">Transaction Details</h2>
    ${[
      ['Transaction ID', txn.id],
      ['Time', txn.time],
      ['Amount', formatINR(txn.amount)],
      ['Channel', txn.channel],
      ['Merchant', txn.merchant],
      ['City', txn.city],
      ['Country', txn.country],
      ['Device', txn.device],
      ['Risk Score', txn.score + ' / 99'],
      ['Status', txn.status.toUpperCase()],
    ].map(([l,v]) => `
      <div class="modal-txn-row">
        <span class="modal-txn-label">${l}</span>
        <span class="modal-txn-value" style="${l==='Status'?`color:${txn.status==='fraud'?'var(--danger)':txn.status==='review'?'var(--warn)':'var(--safe)'}`:''}">${v}</span>
      </div>
    `).join('')}
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn-secondary" style="flex:1" onclick="closeModal()">Close</button>
      ${txn.status !== 'clear' ? `<button class="btn-primary" style="flex:1" onclick="markAsFalsePositive('${txn.id}')">Mark as False Positive</button>` : ''}
    </div>
  `;
  document.getElementById('modalOverlay').style.display = 'flex';
}

function markAsFalsePositive(txnId) {
  console.log('🔄 Marking transaction as false positive:', txnId);
  
  // Find the transaction in state
  const txnIndex = state.transactions.findIndex(t => t.id === txnId);
  if (txnIndex !== -1) {
    const txn = state.transactions[txnIndex];
    const oldStatus = txn.status;
    
    // Update transaction status
    txn.status = 'clear';
    txn.falsePositive = true;
    txn.reviewedAt = new Date().toISOString();
    
    console.log(`✅ Transaction ${txnId} marked as false positive (was: ${oldStatus})`);
    
    // Update counters
    if (oldStatus === 'fraud') {
      state.fraudCount = Math.max(0, state.fraudCount - 1);
      state.clearCount++;
    } else if (oldStatus === 'review') {
      state.reviewCount = Math.max(0, state.reviewCount - 1);
      state.clearCount++;
    }
    
    // Update UI
    document.getElementById('kpi-fraud').textContent = state.fraudCount;
    document.getElementById('kpi-clear').textContent = state.clearCount;
    document.getElementById('kpi-review').textContent = state.reviewCount;
    updateDonut();
    
    // Remove from alerts if it was a fraud alert
    if (oldStatus === 'fraud') {
      const alertIndex = state.alerts.findIndex(a => a.txn.id === txnId);
      if (alertIndex !== -1) {
        state.alerts.splice(alertIndex, 1);
        state.alertCount = Math.max(0, state.alertCount - 1);
        document.getElementById('bellCount').textContent = state.alertCount;
        updateAlertDropdown();
        console.log('🗑️ Removed alert for false positive');
      }
    }
    
    // Show success message
    showNotification('✅ Transaction marked as false positive', 'success');
    
    // Refresh history if visible
    if (document.getElementById('page-history')?.classList.contains('active')) {
      renderHistory();
    }
  } else {
    console.error('❌ Transaction not found:', txnId);
    showNotification('❌ Transaction not found', 'error');
  }
  
  closeModal();
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${type === 'success' ? 'var(--safe)' : type === 'error' ? 'var(--danger)' : 'var(--accent)'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  // Add animation keyframes
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

document.getElementById('modalOverlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ── Navigation ─────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`page-${page}`)?.classList.add('active');
    document.getElementById('breadcrumb').textContent = item.textContent.trim().replace(/^[^ ]+\s/, '');
    if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
    if (page === 'network') setTimeout(() => initNetwork(), 100);
    if (page === 'users') loadUsers();
  });
});

// ── Theme toggle ────────────────────────────────────────
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeIcon').textContent = isDark ? '☾' : '☀';

  // Rebuild charts with new colors
  if (volumeChart) { volumeChart.destroy(); volumeChart = null; }
  if (riskDonut)   { riskDonut.destroy();   riskDonut   = null; }
  initCharts();
  updateDonut();
});

// ── Hamburger ───────────────────────────────────────────
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── Rule toggles ────────────────────────────────────────
document.querySelectorAll('.toggle input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const card = cb.closest('.rule-card');
    const statusEl = card?.querySelector('.rule-status');
    if (!statusEl) return;
    if (cb.checked) {
      statusEl.textContent = 'Active';
      statusEl.className = 'rule-status on';
    } else {
      statusEl.textContent = 'Inactive';
      statusEl.className = 'rule-status off';
    }
  });
});

// ── Live simulation loop ────────────────────────────────
function tick() {
  console.log('🔄 Generating transaction...');
  const txn = generateTransaction();
  console.log('📊 Transaction generated:', txn);

  // Update counters
  if (txn.status === 'fraud')       state.fraudCount++;
  else if (txn.status === 'review') state.reviewCount++;
  else                              state.clearCount++;

  document.getElementById('kpi-fraud').textContent   = state.fraudCount;
  document.getElementById('kpi-clear').textContent   = state.clearCount;
  document.getElementById('kpi-review').textContent  = state.reviewCount;

  // Only update feed if dashboard is visible
  if (document.getElementById('page-dashboard')?.classList.contains('active')) {
    addToFeed(txn);
  }
  addToHistory(txn);
  updateDonut();
  updateGeoStats(txn);

  if (txn.status === 'fraud') {
    console.log('🚨 FRAUD DETECTED! Adding alert...');
    state.alertCount++;
    document.getElementById('bellCount').textContent = state.alertCount;
    addAlert(txn); // Add to alert history
    const banner = document.getElementById('alertBanner');
    banner.style.display = 'flex';
    document.getElementById('alertText').textContent =
      `⚠ Fraud detected: ${txn.id} — ${formatINR(txn.amount)} via ${txn.channel} from ${txn.country} (Score: ${txn.score})`;
    setTimeout(() => { banner.style.display = 'none'; }, 5000);
    console.log('✅ Alert added, count now:', state.alertCount);
  }
}

// ── Boot ────────────────────────────────────────────────
async function boot() {
  initCharts();
  initHeatmap();
  connectWS();

  try {
    const [txnRes, statsRes] = await Promise.all([
      fetch(`${API_BASE}/transactions?limit=50`, { headers: authHeaders() }),
      fetch(`${API_BASE}/stats`,                 { headers: authHeaders() }),
    ]);
    if (txnRes.status === 401) return logout();
    const { data }     = await txnRes.json();
    const backendStats = await statsRes.json();

    if (data && data.length > 0) {
      data.forEach(t => { const e = { ...t, city: t.city || 'Unknown' }; addToFeed(e); state.transactions.unshift(e); updateGeoStats(e); });
      state.fraudCount  = backendStats.fraud;
      state.clearCount  = backendStats.clear;
      state.reviewCount = backendStats.review;
    }
  } catch {
    for (let i = 0; i < 15; i++) {
      const t = generateTransaction();
      if (t.status === 'fraud') state.fraudCount++;
      else if (t.status === 'review') state.reviewCount++;
      else state.clearCount++;
      addToFeed(t);
      state.transactions.unshift(t);
      updateGeoStats(t);
    }
  }

  document.getElementById('kpi-fraud').textContent  = state.fraudCount;
  document.getElementById('kpi-clear').textContent  = state.clearCount;
  document.getElementById('kpi-review').textContent = state.reviewCount;
  updateDonut();
  setTimeout(loadUsers, 300);
  
  // Start live transaction simulation
  startLiveSimulation();
}

// ── Live Transaction Simulation ────────────────────────
function startLiveSimulation() {
  // Generate a transaction every 3-5 seconds
  function scheduleTick() {
    const delay = randomBetween(3000, 5000); // 3-5 seconds
    console.log(`⏰ Next transaction in ${delay}ms`);
    setTimeout(() => {
      tick();
      scheduleTick(); // Schedule next transaction
    }, delay);
  }
  
  // Start the simulation
  scheduleTick();
  console.log('🔴 Live fraud detection simulation started');
}

// ── Diagnostic Functions ────────────────────────────────────
function diagnosticCheck() {
  console.log('🔍 === DIAGNOSTIC CHECK ===');
  console.log('📊 State:');
  console.log('- fraudCount:', state.fraudCount);
  console.log('- alertCount:', state.alertCount);
  console.log('- alerts array length:', state.alerts.length);
  
  console.log('🏠 DOM Elements:');
  const bellCount = document.getElementById('bellCount');
  const alertBell = document.getElementById('alertBell');
  const alertDropdown = document.getElementById('alertDropdown');
  const alertDropdownBody = document.getElementById('alertDropdownBody');
  
  console.log('- bellCount:', bellCount, bellCount?.textContent);
  console.log('- alertBell:', alertBell);
  console.log('- alertDropdown:', alertDropdown);
  console.log('- alertDropdownBody:', alertDropdownBody);
  
  if (bellCount) {
    console.log('🔔 Bell HTML:', bellCount.parentElement.outerHTML);
  }
  
  console.log('📝 Recent alerts:', state.alerts.slice(0, 3));
  console.log('🔍 === END DIAGNOSTIC ===');
}
function testAlert() {
  console.log('📝 Manual test alert triggered');
  
  // Check if required elements exist
  const bellCount = document.getElementById('bellCount');
  const kpiFraud = document.getElementById('kpi-fraud');
  const alertBanner = document.getElementById('alertBanner');
  const alertText = document.getElementById('alertText');
  
  console.log('🔍 Element check:');
  console.log('- bellCount element:', bellCount);
  console.log('- kpi-fraud element:', kpiFraud);
  console.log('- alertBanner element:', alertBanner);
  console.log('- alertText element:', alertText);
  
  if (!bellCount) {
    console.error('❌ bellCount element not found!');
    return;
  }
  
  // Create a guaranteed fraud transaction
  const fraudTxn = {
    id: `TEST${Date.now()}`,
    time: now(),
    amount: 200000, // High amount
    channel: 'UPI',
    merchant: 'Crypto Bazar', // High risk merchant
    country: 'Russia', // High risk country
    city: 'Moscow',
    device: 'TOR Exit Node', // High risk device
    score: 95, // High fraud score
    status: 'fraud',
    timestamp: Date.now()
  };
  
  console.log('🚨 Test fraud transaction:', fraudTxn);
  
  // Process the fraud transaction
  state.fraudCount++;
  state.alertCount++;
  
  console.log('📊 Updated counts:');
  console.log('- fraudCount:', state.fraudCount);
  console.log('- alertCount:', state.alertCount);
  
  // Update UI elements
  if (kpiFraud) {
    kpiFraud.textContent = state.fraudCount;
    console.log('✅ Updated KPI fraud count to:', state.fraudCount);
  }
  
  if (bellCount) {
    bellCount.textContent = state.alertCount;
    console.log('✅ Updated bell count to:', state.alertCount);
    console.log('🔔 Bell element innerHTML:', bellCount.outerHTML);
  }
  
  // Add alert to system
  addAlert(fraudTxn);
  addToFeed(fraudTxn);
  addToHistory(fraudTxn);
  updateDonut();
  
  // Show alert banner
  if (alertBanner && alertText) {
    alertBanner.style.display = 'flex';
    alertText.textContent = `⚠ TEST FRAUD: ${fraudTxn.id} — ${formatINR(fraudTxn.amount)} via ${fraudTxn.channel} from ${fraudTxn.country} (Score: ${fraudTxn.score})`;
    setTimeout(() => { alertBanner.style.display = 'none'; }, 5000);
    console.log('✅ Alert banner displayed');
  } else {
    console.error('❌ Alert banner elements not found');
  }
  
  console.log('✅ Test alert completed, total alerts:', state.alertCount);
}

async function createUser() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role     = document.getElementById('new-role').value;
  if (!username || !password) return alert('Username and password required');
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Failed to create user');
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    await loadUsers();
  } catch {
    alert('Network error — could not create user');
  }
}

// ── PDF Report download ──────────────────────────────────
function downloadPDF() {
  const a = document.createElement('a');
  a.href = `/api/report/pdf?token=${getToken()}`;
  a.download = 'fraudshield_report.pdf';
  a.click();
}

// ── User management (admin) ───────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;
  try {
    const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
    if (res.status === 401) return logout();
    if (res.status === 403) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-sub)">Admin access required</td></tr>';
      return;
    }
    if (!res.ok) return;
    const users = await res.json();
    tbody.innerHTML = users.length ? users.map(u => `
      <tr>
        <td>${u.id}</td><td>${u.username}</td><td>${u.role}</td>
        <td><button class="action-btn" onclick="deleteUser(${u.id})">Delete</button></td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-sub)">No users found</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-sub)">Failed to load users</td></tr>';
  }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE', headers: authHeaders() });
  loadUsers();
}

window.addEventListener('DOMContentLoaded', boot);
window.openModal     = openModal;
window.filterHistory = filterHistory;
window.exportCSV     = exportCSV;
window.downloadPDF   = downloadPDF;
window.loadUsers     = loadUsers;
window.deleteUser    = deleteUser;
window.logout        = logout;
window.createUser    = createUser;
window.toggleAlertDropdown = toggleAlertDropdown;
window.clearAllAlerts = clearAllAlerts;
window.openAlertModal = openAlertModal;
window.testAlert     = testAlert;
window.diagnosticCheck = diagnosticCheck;
window.markAsFalsePositive = markAsFalsePositive;
window.showNotification = showNotification;
