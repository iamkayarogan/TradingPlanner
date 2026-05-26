async function yahooFetch(symbol, interval, range = '1d') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      `/yahooapi/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?range=${range}&interval=${interval}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
    )
    if (!res.ok) throw new Error(`Yahoo ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ── Symbol info: 15-day history + today H/L + current price ──────────────────
export async function fetchSymbolInfo(symbol) {
  const [histData, todayData] = await Promise.all([
    yahooFetch(symbol, '1d', '1mo'),   // 15D daily candles
    yahooFetch(symbol, '5m', '1d'),    // today intraday for live H/L
  ])

  // ── 15-day history ───────────────────────────────────────────
  const result = histData?.chart?.result?.[0]
  if (!result) throw new Error('Symbol not found')
  const ts = result.timestamp || []
  const q  = result.indicators?.quote?.[0] || {}
  const n  = ts.length
  const from = Math.max(0, n - 15)
  const history = []
  for (let i = from; i < n; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
    const prev = i > 0 ? q.close?.[i - 1] : null
    if (h == null || l == null || c == null) continue
    history.push({
      date: new Date(ts[i] * 1000),
      open: o, high: h, low: l, close: c,
      prevClose: prev,
      changePct: prev ? ((c - prev) / prev) * 100 : null,
      rangePct:  prev ? ((h - l) / prev) * 100 : ((h - l) / l) * 100,
    })
  }

  // ── Today H/L + open from intraday data ──────────────────────
  const todayResult = todayData?.chart?.result?.[0]
  const iq     = todayResult?.indicators?.quote?.[0] || {}
  const highs  = (iq.high  || []).filter(x => x != null && isFinite(x) && x > 0)
  const lows   = (iq.low   || []).filter(x => x != null && isFinite(x) && x > 0)
  const closes = (iq.close || []).filter(x => x != null && isFinite(x) && x > 0)
  const opens  = (iq.open  || []).filter(x => x != null && isFinite(x) && x > 0)
  const todayHigh    = highs.length  ? Math.max(...highs)         : null
  const todayLow     = lows.length   ? Math.min(...lows)          : null
  const currentPrice = closes.length ? closes[closes.length - 1] : null
  const todayOpen    = opens.length  ? opens[0]                   : null  // first candle open = day open

  // Previous close from Yahoo meta — reliable even on market holidays
  const prevClose = todayResult?.meta?.chartPreviousClose ?? null

  return { history, todayHigh, todayLow, currentPrice, todayOpen, prevClose }
}

// ── Gap info: today's open vs previous close (lightweight single call) ────────
export async function fetchGapInfo(symbol) {
  const data = await yahooFetch(symbol, '5m', '1d')
  const result = data?.chart?.result?.[0]
  if (!result) return null
  const iq    = result.indicators?.quote?.[0] || {}
  const opens = (iq.open || []).filter(x => x != null && isFinite(x) && x > 0)
  return {
    todayOpen: opens.length ? opens[0] : null,
    prevClose: result.meta?.chartPreviousClose ?? null,
  }
}

// ── Live price from latest 1-min candle close ─────────────────────────────────
export async function fetchLivePrice(symbol) {
  const data = await yahooFetch(symbol, '1m')
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []
  for (let i = closes.length - 1; i >= 0; i--) {
    if (closes[i] != null) return closes[i]
  }
  return null
}

// ── ORB candles: high & low of the 9:15–9:25 AM IST opening range ─────────────
// Yahoo timestamps are UTC. 9:15 IST = 3:45 UTC (225 min), 9:25 IST = 3:55 UTC (235 min)
export async function fetchOrbCandles(symbol) {
  const data = await yahooFetch(symbol, '5m', '1d')
  const result = data?.chart?.result?.[0]
  if (!result) return null

  const ts = result.timestamp || []
  const q  = result.indicators?.quote?.[0] || {}

  const orbCandles = []
  for (let i = 0; i < ts.length; i++) {
    const d      = new Date(ts[i] * 1000)
    const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes()
    // 3:45–3:55 UTC = 9:15–9:25 IST (first two 5-min candles of the session)
    if (utcMin >= 225 && utcMin < 235) {
      const h = q.high?.[i], l = q.low?.[i]
      if (h != null && l != null && isFinite(h) && isFinite(l) && h > 0 && l > 0) {
        orbCandles.push({ high: h, low: l })
      }
    }
  }

  if (!orbCandles.length) return null

  return {
    orbHigh: Math.max(...orbCandles.map(c => c.high)),
    orbLow:  Math.min(...orbCandles.map(c => c.low)),
  }
}
