# FraudShield — Real-Time Fraud Detection Dashboard
### Cognizant Technoverse Hackathon 2026

---

## How to Run

1. Unzip the folder
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge)
3. No server or npm needed — runs entirely in browser

---

## Features

### Dashboard
- Live KPI cards: fraud count, cleared, under review, ML accuracy
- Real-time transaction volume chart (last 24h)
- Risk distribution donut chart
- Auto-updating live transaction feed with clickable rows

### Simulate Transaction
- Input: Amount, Channel, Merchant Category, Country, Time of Day, Device, Velocity
- Outputs risk score (0–99), factor-by-factor breakdown, and decision recommendation

### Transaction Log
- Full searchable audit trail
- Filter by status (Fraud / Cleared / Review)
- CSV export

### Geographic Risk Heatmap
- Visual heatmap grid of transaction risk zones
- Per-city fraud counters updating in real time

### Fraud Network Graph
- Animated graph of account connections
- Suspicious accounts and linked transactions highlighted in red

### Rule Engine
- 6 configurable detection rules with live toggles
- Velocity, high-value, geo-anomaly, device fingerprint, night transactions, merchant blacklist

### Dark & Light Mode
- Toggle with the ☀/☾ button in the top right

---

## Technology

- Vanilla HTML / CSS / JavaScript (zero dependencies except Chart.js)
- Chart.js v4 via CDN
- Google Fonts: Syne + JetBrains Mono
- No API keys required

---

## Fraud Scoring Logic

| Factor               | Risk Added |
|----------------------|------------|
| Amount > ₹1L         | +28        |
| High-risk country    | +35        |
| Blacklisted merchant | +25        |
| TOR network          | +40        |
| VPN detected         | +15        |
| Burst velocity       | +30        |
| Night transaction    | +10        |

Score ≥ 70 → Fraud | Score 40–69 → Review | Score < 40 → Clear
