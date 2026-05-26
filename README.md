# 📊 TradingTool

A personal intraday trading dashboard for NSE stocks. Built with React + Vite + Tailwind CSS. Runs entirely on your local machine — no server, no database, no cloud.

---

## Features

- **Pre-Open Screener** — fetches NSE pre-open data, scores and ranks stocks by gap, volume, and momentum
- **Risk Planner** — add positions with entry, SL, target; auto-fills from 15-day average range; shows live P&L
- **Live Position Tracking** — start tracking with one click; auto-detects SL HIT / Target HIT; activity log per position; manual exit with custom price
- **Gap Indicator** — shows Gap UP / Gap DOWN % on every stock and position card
- **5× Margin Helper** — enter your capital → auto-computes quantity via Groww 5× intraday margin
- **Mini Candlestick Chart** — 15-day price history chart inside the symbol info panel

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Tailwind CSS |
| Build tool | Vite 5 |
| Data — Price/History | Yahoo Finance API (proxied) |
| Data — Pre-open | NSE India API (proxied) |
| Storage | Browser localStorage (no database) |
| Backend | None — runs fully local |

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

**Option A: Copy folder directly**
- Copy the entire `TradingTool` folder to the new machine (USB, AirDrop, Google Drive, etc.)
- Skip the `node_modules` folder — it is large and will be reinstalled

**Option B: Zip and transfer**
```bash
# On the source machine — zip without node_modules
cd /path/to/
zip -r TradingTool.zip TradingTool --exclude "TradingTool/node_modules/*"
```
Then unzip on the new machine.

**Option C: Git (if you use it)**
```bash
git clone <your-repo-url>
cd TradingTool
```

---

### Step 2 — Install dependencies

```bash
cd TradingTool
npm install
```

This downloads all required packages into `node_modules/`. Takes 1–2 minutes on first run.

---

### Step 3 — Run the app

```bash
npm run dev
```

Open your browser and go to:
```
http://localhost:5173
```

The app is ready. Keep the terminal open while using it.

---

## Daily Usage

Every time you want to use the tool:

```bash
cd TradingTool
npm run dev
```

Then open `http://localhost:5173` in your browser.

To stop: press `Ctrl + C` in the terminal.

---

## Project Structure

```
TradingTool/
├── src/
│   ├── App.jsx                  # Root component — wires everything together
│   ├── main.jsx                 # React entry point
│   ├── index.css                # Global styles (Tailwind)
│   ├── components/
│   │   ├── RiskPlanner.jsx      # Risk Planner + Position Tracker
│   │   ├── MarketStatus.jsx     # Market open/close status bar
│   │   └── (other components)
│   └── services/
│       ├── orb.js               # Yahoo Finance API calls (price, history, gap)
│       └── nse.js               # NSE India API calls (pre-open data)
├── vite.config.js               # Proxy config for Yahoo + NSE APIs
├── tailwind.config.js
├── package.json
└── index.html
```

---

## How Data Works

### Yahoo Finance (price data)
Vite proxies requests through `/yahooapi` → `https://query1.finance.yahoo.com`

- 15-day daily OHLC history → used for average range (SL/Target calculation)
- Today's intraday 5-min candles → Gap %, today High/Low, open price
- 1-min candles → live price (polled every 30 seconds)

### NSE India (pre-open data)
Vite proxies requests through `/nseapi` → `https://www.nseindia.com`

- NSE requires session cookies — `vite.config.js` auto-fetches and refreshes them every 4 minutes
- If pre-open data stops loading, restart the dev server (`Ctrl+C` then `npm run dev`)

> ⚠️ **These proxies only work when `npm run dev` is running.** They are built into the Vite development server.

---

## Risk Planner — How It Works

| Field | Logic |
|---|---|
| Entry | Current live price (auto-filled) |
| Stop Loss | Entry ± 15-day average range in ₹ |
| Target | Entry ± 15-day average range in ₹ |
| Qty | `floor(Capital × 5 / Entry)` using Groww 5× intraday margin |
| Live P&L | Polled every 30 seconds from Yahoo Finance |

Positions are saved in **browser localStorage** and reset daily.

---

## Position Tracking

1. Add your positions using **+ Add Position**
2. Click **▶ Start** in the tracking bar
3. The app polls live price every 30 seconds and:
   - Detects **SL HIT** or **Target HIT** automatically
   - Logs each event with timestamp, price, and P&L
4. Use **🚪 Exit Position** to manually exit at any price
5. Click **⏹ Stop** to pause tracking
6. Click **↺ Reset** to clear all tracking logs

---

## Common Issues

| Problem | Fix |
|---|---|
| `npm install` fails | Make sure Node.js v18+ is installed |
| App shows blank page | Open browser console (F12) and check for errors |
| Pre-open data not loading | Restart the dev server — NSE cookies may have expired |
| Yahoo price not loading | Check internet connection; Yahoo may rate-limit briefly |
| Port 5173 already in use | Vite will auto-use next port (5174, 5175…) — check terminal output |

---

## Important Notes

- **Personal use only** — Yahoo Finance and NSE APIs are public but not meant for commercial scraping
- **No real-time guarantee** — Yahoo Finance free tier has ~15-minute delay outside market hours; during market hours 1-min data is near real-time
- **localStorage resets daily** — positions from yesterday do not carry over (by design)
- **5× margin is Groww intraday only** — positions are auto-squared off at 3:20 PM; always exit manually before 3:10 PM to avoid ₹50 + GST penalty

---

## Build for Static Hosting (Advanced)

> ⚠️ The proxies **will not work** in a static build. Use this only if you set up your own backend proxy.

```bash
npm run build
```

Output goes to `dist/`. You can serve it with:
```bash
npm run preview   # local preview of the built app
```

For full deployment with working APIs, you would need to set up a separate Node.js/Express proxy server — not covered here since this tool is designed for local use.
