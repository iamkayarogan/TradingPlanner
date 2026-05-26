const BASE = '/nseapi'

async function get(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`NSE ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function getText(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'text/csv, text/plain, */*' },
      credentials: 'include',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`NSE ${res.status}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur.trim())
  return result
}

function parseNseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])

  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').replace(/,/g, '').trim() })

    // Actual NSE CSV columns: Symbol, Open, High, Low, Prev. Close, LTP, %chng, Volume, Value, CA
    const symbol    = row['Symbol'] || row['SYMBOL'] || ''
    const lastPrice = parseFloat(row['LTP'] || '0') || 0
    const prevClose = parseFloat(row['Prev. Close'] || row['PREV. CLOSE'] || '0') || 0
    const pChange   = parseFloat(row['%chng'] || row['% Chng'] || row['%Chng'] || row['% Change'] || '0') || 0
    const change    = prevClose > 0 ? parseFloat((lastPrice - prevClose).toFixed(2)) : 0
    const volume    = parseInt(row['Volume'] || row['VOLUME (shares)'] || row['VOLUME'] || '0') || 0

    return { symbol, lastPrice, change, pChange, prevClose, totalTradedVolume: volume }
  }).filter(s => s.symbol && s.lastPrice > 0)
}

export async function fetchMarketStatus() {
  return get('/api/marketStatus')
}

// ── Nifty 50 pre-open market data ─────────────────────────────────────────────
export async function fetchPreOpenNifty50() {
  return get('/api/market-data-pre-open?key=NIFTY')
}

// ── Top gainers / losers via NSE CSV download ─────────────────────────────────
// Source: https://www.nseindia.com/api/live-analysis-variations?index=gainers&type=allSec&csv=true
export async function fetchTopMoversCSV(type = 'allSec') {
  const [gText, lText] = await Promise.all([
    getText(`/api/live-analysis-variations?index=gainers&type=${type}&csv=true`),
    getText(`/api/live-analysis-variations?index=loosers&type=${type}&csv=true`),
  ])
  const byPctDesc = (a, b) => (b.pChange - a.pChange) || (b.totalTradedVolume - a.totalTradedVolume)
  const byPctAsc  = (a, b) => (a.pChange - b.pChange) || (b.totalTradedVolume - a.totalTradedVolume)
  return {
    gainers: parseNseCSV(gText).sort(byPctDesc).slice(0, 20),
    losers:  parseNseCSV(lText).sort(byPctAsc).slice(0, 20),
  }
}
