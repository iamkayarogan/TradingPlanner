# ⚡ TradingPlanner

A personal intraday trading dashboard for NSE stocks. Built with React + Vite + Tailwind CSS. Runs entirely on your local machine — no server, no database, no cloud, no API keys.

---

## Features

- **Sign Up / Log In** — local auth using localStorage + SHA-256 password hashing (no third-party service)
- **Pre-Open Screener** — fetches NSE pre-open data, scores and ranks stocks by gap, volume, and momentum
- **Risk Planner** — add positions with entry, SL, target; auto-fills from 15-day average range
- **5× Margin Helper** — enter your capital → auto-computes quantity via Groww 5× intraday margin
- **Gap Indicator** — shows Gap UP / Gap DOWN % on every stock and position card
- **Live Position Tracking** — click ▶ Start to begin tracking; auto-detects SL HIT / Target HIT with timestamps; manual exit with custom price
- **Activity Log** — per-position log of every tracking event with time, price, and P&L
- **Export / Import** — download positions as JSON, import on another browser or machine
- **Mini Candlestick Chart** — 15-day price history inside the symbol info panel
- **Per-user data** — each login account has its own isolated positions and settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Tailwind CSS |
| Build tool | Vite 5 |
| Auth & Storage | Browser localStorage (SHA-256 via Web Crypto API) |
| Price / History | Yahoo Finance API (proxied via Vite) |
| Pre-open data | NSE India API (proxied via Vite) |
| Backend | None — runs fully local |
| External accounts | None required |

---

## Requirements

- **Node.js** v18 or higher — [download here](https://nodejs.org/)
- **npm** v9 or higher (comes with Node.js)
- Internet connection (to fetch live NSE / Yahoo Finance data)

Check your version:
```bash
node -v   # should show v18.x.x or higher
npm -v    # should show 9.x.x or higher
```

---

## Installation on a New Machine

### Step 1 — Copy the project

**Option A: Zip and transfer**
```bash
# On source machine — zip without node_modules
zip -r TradingPlanner.zip TradingPlanner --exclude "TradingPlanner/node_modules/*"
```
Unzip on the new machine.

**Option B: Git clone**
```bash
git clone https://github.com/iamkayarogan/TradingPlanner.git
cd TradingPlanner
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Run the app

```bash
npm run dev
```

Open your browser and go to:
```
http://localhost:8443
```

> If accessing from a remote/cloud environment, use the provided tunnel URL instead.

---

## Daily Usage

```bash
npm run dev
```

Open `http://localhost:8443` → log in → trade.

To stop: press `Ctrl + C` in the terminal.

---

## Auth — How It Works

All authentication is handled **locally in the browser**. No external service, no API key, no internet required for login.

| Action | What happens |
|---|---|
| **Sign Up** | Name + email + password stored in `localStorage`. Password is SHA-256 hashed using the browser's built-in `crypto.subtle` — never stored as plain text |
| **Log In** | Password is hashed and compared against the stored hash |
| **Session** | Saved in `localStorage` — you stay logged in across page reloads and browser restarts |
| **Log Out** | Session cleared — next visit shows the login screen |
| **Multiple users** | Each account's positions and settings are stored separately (keyed by user ID) |

> **Important:** Credentials are stored in the browser's localStorage on this machine only. Clearing browser data will erase them.

---

## Moving Data Between Browsers / Machines

Since data is stored locally, it does **not** sync automatically across browsers. Use Export / Import:

1. **On Browser A** → click **↓ Export** in the Risk Planner header → saves `risk-planner-YYYY-MM-DD.json`
2. **On Browser B** → click **↑ Import** → select the file → positions load instantly

---

## Project Structure

```
TradingPlanner/
├── src/
│   ├── App.jsx                    # Root — auth state, layout
│   ├── main.jsx                   # React entry point
│   ├── index.css                  # Global styles (Tailwind)
│   ├── components/
│   │   ├── RiskPlanner.jsx        # Risk Planner + Position Tracker
│   │   ├── AuthModal.jsx          # Sign Up / Log In modal
│   │   └── MarketStatus.jsx       # Market open/close status bar
│   └── services/
│       ├── localAuth.js           # Local auth (localStorage + SHA-256)
│       ├── orb.js                 # Yahoo Finance API calls
│       └── nse.js                 # NSE India API calls
├── vite.config.js                 # Port 8443 + proxy config for Yahoo & NSE
├── tailwind.config.js
├── package.json
└── index.html
```

---

## Risk Planner — Trade Math

| Field | Logic |
|---|---|
| Entry | Current live price (auto-filled on symbol lookup) |
| Stop Loss | Entry ± 15-day average daily range (₹) |
| Target | Entry ± 15-day average daily range (₹) |
| Qty | `floor(Capital × 5 / Entry)` — Groww 5× intraday margin |
| Live P&L | Polled every 30 seconds from Yahoo Finance |

---

## Position Tracking

1. Add positions via **+ Add Position**
2. Click **▶ Start** in the tracking bar
3. App polls live price every 30s and auto-detects:
   - **🔴 SL HIT** — logs time, price, final P&L
   - **🎯 Target HIT** — logs time, price, final P&L
4. Use **🚪 Exit Position** to manually exit at any price
5. **↾ Reset** clears all tracking logs

---

## Data Sources

### Yahoo Finance
Proxied via `/yahooapi` → `https://query1.finance.yahoo.com`
- 15-day daily OHLC → average range for SL/Target
- 5-min intraday → Gap %, today High/Low
- 1-min candles → live price (every 30s)

### NSE India
Proxied via `/nseapi` → `https://www.nseindia.com`
- Pre-open IEP, volume, % change for all Nifty 50 stocks
- NSE requires session cookies — Vite auto-refreshes them every 4 minutes
- If pre-open data stops loading: restart `npm run dev`

> Both proxies **only work while `npm run dev` is running**.

---

## Common Issues

| Problem | Fix |
|---|---|
| Blank page / app not loading | Open browser console (F12) → check for errors |
| Pre-open data not loading | Restart dev server — NSE cookies may have expired |
| Yahoo price not loading | Check internet connection; retry in 30 seconds |
| Port 8443 already in use | Change `port` in `vite.config.js` to any free port |
| Forgot password | No reset option (local only) — clear `rp_users` from browser DevTools → Application → localStorage, then sign up again |
| Lost positions after clearing browser data | Use **↓ Export** regularly to keep a backup JSON |

---

## Important Notes

- **Personal use only** — Yahoo Finance and NSE APIs are public but not for commercial scraping
- **5× margin is Groww intraday only** — auto squared-off at 3:20 PM; Groww charges ₹50 + GST penalty if auto-squared; always exit manually before 3:10 PM
- **localStorage resets on browser data clear** — export your positions regularly as a backup
- **No .env file needed** — the app has zero external service dependencies
