import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchSymbolInfo, fetchLivePrice, fetchGapInfo } from '../services/orb'

// ── Persistence (per-user localStorage keys) ──────────────────────────────────
const DEFAULTS = { dailyLossLimit: 2000, maxPositions: 3 }

function todayKey() { return new Date().toISOString().slice(0, 10) }

function posKey(uid)  { return uid ? `rp_pos_${uid}`  : 'rp_pos_guest' }
function setKey(uid)  { return uid ? `rp_set_${uid}`  : 'rp_set_guest' }

function loadSettings(uid) {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(setKey(uid)) || '{}') } }
  catch { return { ...DEFAULTS } }
}

function loadPositions(uid) {
  try { return JSON.parse(localStorage.getItem(posKey(uid)) || '{}')?.[todayKey()] || [] }
  catch { return [] }
}

function persistPositions(uid, pos) {
  try {
    const key    = posKey(uid)
    const all    = JSON.parse(localStorage.getItem(key) || '{}')
    all[todayKey()] = pos
    const pruned = Object.fromEntries(Object.keys(all).sort().slice(-7).map(k => [k, all[k]]))
    localStorage.setItem(key, JSON.stringify(pruned))
  } catch { /* ignore */ }
}

// ── Calc helpers ──────────────────────────────────────────────────────────────
function calcRisk(direction, entry, qty, sl) {
  if (!entry || !qty || !sl || qty <= 0) return null
  const dist = direction === 'BUY' ? entry - sl : sl - entry
  return dist > 0 ? Math.round(qty * dist) : null
}

function calcReward(direction, entry, qty, target) {
  if (!entry || !qty || !target || qty <= 0) return null
  const dist = direction === 'BUY' ? target - entry : entry - target
  return dist > 0 ? Math.round(qty * dist) : null
}

function rrLabel(risk, reward) {
  if (!risk || !reward || risk <= 0) return null
  return `1 : ${(reward / risk).toFixed(2)}`
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useRiskPlanner(userId = null) {
  const [settings,  setSettings]  = useState(() => loadSettings(userId))
  const [positions, setPositions] = useState(() => loadPositions(userId))

  // Reload when user switches (login / logout)
  useEffect(() => {
    setSettings(loadSettings(userId))
    setPositions(loadPositions(userId))
  }, [userId])

  useEffect(() => {
    localStorage.setItem(setKey(userId), JSON.stringify(settings))
  }, [settings, userId])

  useEffect(() => {
    persistPositions(userId, positions)
  }, [positions, userId])

  function addPosition(p) {
    setPositions(prev => [...prev, { ...p, id: Date.now() }])
  }

  function removePosition(id) {
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  function updatePosition(id, updates) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  return { settings, setSettings, positions, addPosition, removePosition, updatePosition }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtInt(n) {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('en-IN')
}

// ── Sub-components ────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, placeholder, prefix = '₹', step = 1, min = 0 }) {
  return (
    <div>
      {label && <label className="text-[10px] text-muted block mb-1">{label}</label>}
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">{prefix}</span>}
        <input
          type="number" value={value} min={min} step={step} placeholder={placeholder}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`w-full bg-gray-900 border border-border rounded py-1.5 text-xs text-white
            focus:outline-none focus:border-accent
            ${prefix ? 'pl-6 pr-2' : 'px-3'}`}
        />
      </div>
    </div>
  )
}

function DirToggle({ value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-muted block mb-1">Direction</label>
      <div className="flex rounded overflow-hidden border border-border h-[30px]">
        <button type="button" onClick={() => onChange('BUY')}
          className={`flex-1 text-xs font-bold transition-colors
            ${value === 'BUY' ? 'bg-emerald-700 text-white' : 'bg-gray-900 text-muted hover:text-white'}`}>
          ⬆ BUY
        </button>
        <button type="button" onClick={() => onChange('SHORT')}
          className={`flex-1 text-xs font-bold border-l border-border transition-colors
            ${value === 'SHORT' ? 'bg-red-700 text-white' : 'bg-gray-900 text-muted hover:text-white'}`}>
          ⬇ SHORT
        </button>
      </div>
    </div>
  )
}

// ── Mini candlestick chart (15 days) ─────────────────────────────────────────
function MiniChart({ history }) {
  if (!history?.length) return null
  const BAR_W = 5, GAP = 3, H = 56, PAD = 4
  const W = history.length * (BAR_W + GAP) - GAP

  const allH = history.map(d => d.high).filter(Boolean)
  const allL = history.map(d => d.low).filter(Boolean)
  if (!allH.length) return null
  const maxP = Math.max(...allH), minP = Math.min(...allL)
  const span = maxP - minP || 1
  const scaleY = price => PAD + (H - 2 * PAD) * (1 - (price - minP) / span)

  return (
    <svg width={W} height={H} className="overflow-visible">
      {history.map((d, i) => {
        if (!d.high || !d.low || !d.close) return null
        const isUp  = d.changePct == null ? d.close >= d.open : d.changePct >= 0
        const color = isUp ? '#10b981' : '#ef4444'
        const cx    = i * (BAR_W + GAP) + BAR_W / 2
        const yH    = scaleY(d.high), yL = scaleY(d.low)
        const yO    = scaleY(d.open ?? d.close), yC = scaleY(d.close)
        const bodyT = Math.min(yO, yC), bodyH = Math.max(1.5, Math.abs(yC - yO))
        return (
          <g key={i}>
            <line x1={cx} y1={yH} x2={cx} y2={yL} stroke={color} strokeWidth={1} opacity={0.5} />
            <rect x={i * (BAR_W + GAP)} y={bodyT} width={BAR_W} height={bodyH} fill={color} rx={0.5} />
          </g>
        )
      })}
    </svg>
  )
}

// ── Symbol info panel ─────────────────────────────────────────────────────────
function SymbolInfoPanel({ info, loading, error, onRefresh }) {
  function fmtP(n) {
    if (n == null) return '—'
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) return (
    <div className="mb-3 rounded-lg border border-border/40 bg-gray-900/60 px-3 py-2 flex items-center justify-between">
      <span className="text-[10px] text-muted animate-pulse">Fetching market data…</span>
    </div>
  )
  if (error) return (
    <div className="mb-3 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 flex items-center justify-between">
      <span className="text-[10px] text-red-400">⚠ {error}</span>
      {onRefresh && (
        <button type="button" onClick={onRefresh}
          className="text-[10px] text-muted hover:text-white px-2 py-0.5 rounded border border-border/40 hover:border-gray-500 transition-colors ml-2">
          ↻ Retry
        </button>
      )}
    </div>
  )
  if (!info) return null

  const { history, todayHigh, todayLow, currentPrice, todayOpen, prevClose } = info
  const gapPct = todayOpen && prevClose && prevClose > 0
    ? ((todayOpen - prevClose) / prevClose) * 100
    : null
  const todayRange    = todayHigh && todayLow ? todayHigh - todayLow : null
  const todayRangePct = todayRange && todayLow ? (todayRange / todayLow) * 100 : null
  const upDays    = history.filter(d => (d.changePct ?? 0) >= 0).length
  const downDays  = history.filter(d => (d.changePct ?? 0) < 0).length
  const ranges    = history.map(d => d.rangePct).filter(Boolean)
  const avgRange  = ranges.length ? ranges.reduce((a, b) => a + b, 0) / ranges.length : null
  const maxRange  = ranges.length ? Math.max(...ranges) : null

  // Last 5 daily change % pills
  const last5 = history.slice(-5)

  return (
    <div className="mb-3 rounded-lg border border-border/40 bg-gray-900/60 p-3">
      {/* Today row */}
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {currentPrice != null && (
            <span className="text-sm font-bold text-white">₹{fmtP(currentPrice)}</span>
          )}
          {gapPct != null && Math.abs(gapPct) >= 0.1 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-none
              ${gapPct > 0
                ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-700/50'
                : 'bg-red-900/70 text-red-300 border border-red-700/50'}`}>
              {gapPct > 0 ? '▲ Gap UP' : '▼ Gap DOWN'} {Math.abs(gapPct).toFixed(2)}%
            </span>
          )}
          {todayHigh && (
            <span className="text-[11px]">
              <span className="text-muted">H </span>
              <span className="text-up font-semibold">₹{fmtP(todayHigh)}</span>
            </span>
          )}
          {todayLow && (
            <span className="text-[11px]">
              <span className="text-muted">L </span>
              <span className="text-down font-semibold">₹{fmtP(todayLow)}</span>
            </span>
          )}
          {todayRange != null && (
            <span className="text-[10px] text-muted">
              <span className="text-gray-600">Day range </span>₹{fmtP(todayRange)}
              {todayRangePct != null && <span className="ml-1">({todayRangePct.toFixed(1)}%)</span>}
            </span>
          )}
        </div>

        {/* Last 5 days pills + refresh button */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            {last5.map((d, i) => (
              <span key={i} className={`text-[9px] font-semibold px-1 py-0.5 rounded
                ${(d.changePct ?? 0) >= 0 ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
                {(d.changePct ?? 0) >= 0 ? '+' : ''}{(d.changePct ?? 0).toFixed(1)}%
              </span>
            ))}
          </div>
          {onRefresh && (
            <button type="button" onClick={onRefresh}
              title="Refresh price & H/L"
              className="text-muted hover:text-white text-xs w-5 h-5 flex items-center justify-center rounded border border-border/40 hover:border-gray-500 transition-colors shrink-0">
              ↻
            </button>
          )}
        </div>
      </div>

      {/* Mini chart */}
      <div className="mb-2">
        <MiniChart history={history} />
      </div>

      {/* 15D stats */}
      <div className="flex items-center gap-3 text-[10px] text-muted flex-wrap">
        <span>15D:</span>
        <span className="text-emerald-400 font-semibold">{upDays}↑</span>
        <span className="text-red-400 font-semibold">{downDays}↓</span>
        {avgRange != null && (
          <span>
            Avg range{' '}
            <span className="text-white font-semibold">{avgRange.toFixed(1)}%</span>
            {currentPrice != null && (
              <span className="text-accent font-semibold ml-1">
                ≈ ₹{fmtP(currentPrice * avgRange / 100)}
              </span>
            )}
            <span className="text-gray-600 ml-1 text-[9px]">← used for SL/Target</span>
          </span>
        )}
        {maxRange != null && <span>Max <span className="text-white">{maxRange.toFixed(1)}%</span></span>}
      </div>
    </div>
  )
}

// ── Add-position form ─────────────────────────────────────────────────────────
const BLANK = { symbol: '', direction: 'BUY', entry: '', qty: '', sl: '', target: '' }

function AddForm({ onSubmit, onCancel, initialValues = null }) {
  const isEditing = initialValues != null
  const [f,           setF]          = useState(isEditing ? {
    symbol:    initialValues.symbol,
    direction: initialValues.direction,
    entry:     initialValues.entry,
    qty:       initialValues.qty,
    sl:        initialValues.sl,
    target:    initialValues.target,
  } : { ...BLANK })
  const [err,         setErr]        = useState('')
  const [symInfo,     setSymInfo]    = useState(null)
  const [symLoading,  setSymLoading] = useState(false)
  const [symError,    setSymError]   = useState(null)
  const [symRangeRs,  setSymRangeRs] = useState(null)  // 15D avg range in ₹
  const [capital,     setCapital]    = useState('')     // 5x margin capital helper
  const fetchRef = useRef(null)

  // Named fetch — called by debounce effect AND the refresh button
  async function doFetch(sym) {
    clearTimeout(fetchRef.current)
    setSymLoading(true)
    setSymInfo(null)
    setSymError(null)
    try {
      const info = await fetchSymbolInfo(sym)
      setSymInfo(info)
    } catch (e) {
      setSymError(e.message?.includes('404') || e.message?.includes('not found')
        ? 'Symbol not found on NSE'
        : 'Could not fetch market data')
    } finally { setSymLoading(false) }
  }

  // Debounced symbol fetch — triggers 700ms after user stops typing
  useEffect(() => {
    const sym = f.symbol.trim()
    setSymInfo(null); setSymError(null); setSymRangeRs(null)
    if (sym.length < 2) return
    clearTimeout(fetchRef.current)
    fetchRef.current = setTimeout(() => doFetch(sym), 700)
    return () => clearTimeout(fetchRef.current)
  }, [f.symbol])

  // In edit mode, fetch symbol info on mount to show chart/price panel
  // (without overwriting form fields — that's guarded below)
  useEffect(() => {
    if (isEditing && initialValues?.symbol) doFetch(initialValues.symbol)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill form fields when symbol info loads (new positions only)
  useEffect(() => {
    if (isEditing) return  // never overwrite manually-saved values in edit mode
    if (!symInfo?.currentPrice) return
    const { currentPrice, history } = symInfo
    const ranges   = history.map(d => d.rangePct).filter(Boolean)
    const avgPct   = ranges.length ? ranges.reduce((a, b) => a + b, 0) / ranges.length : null
    if (!avgPct) return

    const rangeRs = parseFloat((currentPrice * avgPct / 100).toFixed(2))
    setSymRangeRs(rangeRs)

    const entry = parseFloat(currentPrice.toFixed(2))
    setErr('')
    setF(prev => {
      const dir = prev.direction
      return {
        ...prev,
        entry,
        qty:    1,
        sl:     parseFloat((dir === 'BUY' ? Math.max(0.05, entry - rangeRs) : entry + rangeRs).toFixed(2)),
        target: parseFloat((dir === 'BUY' ? entry + rangeRs : Math.max(0.05, entry - rangeRs)).toFixed(2)),
      }
    })
  }, [symInfo])

  function set(key, val) { setF(p => ({ ...p, [key]: val })); setErr('') }

  const risk   = calcRisk(f.direction, Number(f.entry), Number(f.qty), Number(f.sl))
  const reward = calcReward(f.direction, Number(f.entry), Number(f.qty), Number(f.target))
  const rr     = rrLabel(risk, reward)

  function validate() {
    if (!f.symbol.trim())       return 'Enter a symbol'
    if (!f.entry || f.entry <= 0) return 'Enter entry price'
    if (!f.qty   || f.qty   <= 0) return 'Enter qty'
    if (!f.sl    || f.sl    <= 0) return 'Enter stop loss'
    if (!f.target|| f.target<= 0) return 'Enter target'
    if (f.direction === 'BUY') {
      if (Number(f.sl) >= Number(f.entry))     return 'BUY: SL must be below entry'
      if (Number(f.target) <= Number(f.entry)) return 'BUY: Target must be above entry'
    } else {
      if (Number(f.sl) <= Number(f.entry))     return 'SHORT: SL must be above entry'
      if (Number(f.target) >= Number(f.entry)) return 'SHORT: Target must be below entry'
    }
    return null
  }

  function submit(e) {
    e.preventDefault()
    const e2 = validate()
    if (e2) { setErr(e2); return }
    onSubmit({
      symbol:    f.symbol.trim().toUpperCase(),
      direction: f.direction,
      entry:     Number(f.entry),
      qty:       Number(f.qty),
      sl:        Number(f.sl),
      target:    Number(f.target),
    })
    setF({ ...BLANK })
    setCapital('')
  }

  return (
    <form onSubmit={submit}
      className="mb-4 rounded-xl border border-accent/30 bg-gray-800/50 p-4">
      <div className="text-[10px] text-accent uppercase tracking-widest font-semibold mb-3">
        {isEditing ? `Edit Position · ${initialValues.symbol}` : 'Add Position'}
      </div>

      {/* Row 1: symbol + direction */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-muted block mb-1">Symbol</label>
          <input
            type="text" value={f.symbol} placeholder="RELIANCE" autoFocus
            onChange={e => set('symbol', e.target.value.toUpperCase())}
            className="w-full bg-gray-900 border border-border rounded px-3 py-1.5 text-xs text-white uppercase placeholder:normal-case focus:outline-none focus:border-accent"
          />
        </div>
        <DirToggle value={f.direction} onChange={v => {
          setErr('')
          if (symRangeRs && f.entry) {
            // Flip SL and Target for the new direction
            const entry = Number(f.entry)
            setF(prev => ({
              ...prev,
              direction: v,
              sl:     parseFloat((v === 'BUY' ? Math.max(0.05, entry - symRangeRs) : entry + symRangeRs).toFixed(2)),
              target: parseFloat((v === 'BUY' ? entry + symRangeRs : Math.max(0.05, entry - symRangeRs)).toFixed(2)),
            }))
          } else {
            setF(prev => ({ ...prev, direction: v }))
          }
        }} />
      </div>

      {/* Symbol info panel — appears after symbol is typed */}
      <SymbolInfoPanel
        info={symInfo}
        loading={symLoading}
        error={symError}
        onRefresh={f.symbol.trim().length >= 2 && !symLoading
          ? () => doFetch(f.symbol.trim())
          : null}
      />

      {/* Row 2: entry + qty */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <NumInput label="Entry price (₹)" value={f.entry} onChange={v => set('entry', v)} placeholder="0.00" step={0.05} />
        <NumInput label="Qty (shares)"    value={f.qty}   onChange={v => {
          set('qty', v)
          if (v > 0 && Number(f.entry) > 0) setCapital(Math.round(Number(v) * Number(f.entry) / 5))
        }} placeholder="0"    step={1} prefix="" />
      </div>

      {/* 5× Margin helper */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-gray-900/50 border border-border/30 rounded-lg px-3 py-2">
        <span className="text-[10px] text-accent font-semibold shrink-0">5× Margin</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted">Capital</span>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">₹</span>
            <input
              type="number" value={capital} placeholder="25000" min={0} step={1000}
              onChange={e => {
                const cap = e.target.value === '' ? '' : Number(e.target.value)
                setCapital(cap)
                if (cap > 0 && Number(f.entry) > 0)
                  set('qty', Math.floor((Number(cap) * 5) / Number(f.entry)))
              }}
              className="w-24 bg-gray-800 border border-border/40 rounded pl-5 pr-1 py-1 text-xs text-white focus:outline-none focus:border-accent"
            />
          </div>
          {capital > 0 && (
            <>
              <span className="text-[10px] text-muted">× 5 =</span>
              <span className="text-[11px] font-semibold text-white">
                ₹{(Number(capital) * 5).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-muted">exposure</span>
            </>
          )}
        </div>
        {f.qty > 0 && f.entry > 0 && (
          <span className="text-[10px] text-muted ml-auto">
            {f.qty} × ₹{Number(f.entry).toLocaleString('en-IN')} =
            <span className="text-white font-semibold mx-1">₹{fmtInt(Number(f.qty) * Number(f.entry))}</span>
            <span className="text-accent font-semibold">(÷5 = ₹{fmtInt(Number(f.qty) * Number(f.entry) / 5)} cap)</span>
          </span>
        )}
      </div>

      {/* Row 3: SL + target */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <NumInput
          label={f.direction === 'BUY' ? 'Stop Loss ₹ (below entry)' : 'Stop Loss ₹ (above entry)'}
          value={f.sl} onChange={v => set('sl', v)} placeholder="0.00" step={0.05}
        />
        <NumInput
          label={f.direction === 'BUY' ? 'Target ₹ (above entry)' : 'Target ₹ (below entry)'}
          value={f.target} onChange={v => set('target', v)} placeholder="0.00" step={0.05}
        />
      </div>

      {/* Live calc preview */}
      {(risk != null || reward != null) && (
        <div className="flex items-center gap-4 mb-3 px-3 py-2 bg-gray-900/60 rounded-lg border border-border/40">
          <div className="text-center">
            <div className="text-[9px] text-muted mb-0.5">Risk (max loss)</div>
            <div className="text-sm font-bold text-down">{risk != null ? `₹${fmtInt(risk)}` : '—'}</div>
          </div>
          <div className="h-6 border-l border-border/40" />
          <div className="text-center">
            <div className="text-[9px] text-muted mb-0.5">Reward (max gain)</div>
            <div className="text-sm font-bold text-up">{reward != null ? `₹${fmtInt(reward)}` : '—'}</div>
          </div>
          <div className="h-6 border-l border-border/40" />
          <div className="text-center">
            <div className="text-[9px] text-muted mb-0.5">R : R</div>
            <div className="text-sm font-bold text-white">{rr ?? '—'}</div>
          </div>
          {f.qty && f.entry && (
            <>
              <div className="h-6 border-l border-border/40" />
              <div className="text-center">
                <div className="text-[9px] text-muted mb-0.5">Exposure</div>
                <div className="text-sm font-bold text-white">₹{fmtInt(Number(f.qty) * Number(f.entry))}</div>
                <div className="text-[9px] text-accent mt-0.5">÷5 = ₹{fmtInt(Number(f.qty) * Number(f.entry) / 5)} cap</div>
              </div>
            </>
          )}
        </div>
      )}

      {err && <p className="text-red-400 text-[10px] mb-2">⚠ {err}</p>}

      <div className="flex gap-2">
        <button type="submit"
          className="px-4 py-1.5 bg-accent hover:bg-accent/80 text-white text-xs font-semibold rounded transition-colors">
          {isEditing ? 'Save Changes' : 'Add Position'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-muted hover:text-white text-xs rounded transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Settings fields ───────────────────────────────────────────────────────────
function SettingsPanel({ draft, setDraft, onSave }) {
  function field(label, key, step, min) {
    return (
      <div>
        <label className="text-[10px] text-muted block mb-1">{label}</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">₹</span>
          <input type="number" value={draft[key]} min={min} step={step}
            onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
            className="w-full bg-gray-800 border border-border rounded pl-6 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 bg-gray-800/40 border border-border rounded-lg p-4">
      <div className="text-[10px] text-muted uppercase tracking-widest mb-3">Daily Limits</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        {field('Daily loss limit (₹)', 'dailyLossLimit', 500, 500)}
        <div>
          <label className="text-[10px] text-muted block mb-1">Max positions</label>
          <input type="number" value={draft.maxPositions} min={1} max={10} step={1}
            onChange={e => setDraft(d => ({ ...d, maxPositions: Number(e.target.value) }))}
            className="w-full bg-gray-800 border border-border rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent" />
        </div>
      </div>
      <div className="text-[10px] text-gray-600 mb-3">Saved locally · Positions reset daily</div>
      <button onClick={onSave}
        className="px-4 py-1.5 bg-accent text-white text-xs font-semibold rounded hover:bg-accent/80 transition-colors">
        Save
      </button>
    </div>
  )
}

// ── Position row ──────────────────────────────────────────────────────────────
function PositionRow({ p, onRemove, onEdit, isEditing, isTracking, onUpdate }) {
  const risk   = calcRisk(p.direction, p.entry, p.qty, p.sl)
  const reward = calcReward(p.direction, p.entry, p.qty, p.target)
  const rr     = rrLabel(risk, reward)
  const isUp   = p.direction === 'BUY'

  // ── Gap info (one-time fetch on mount) ─────────────────────────
  const [gapPct, setGapPct] = useState(null)
  useEffect(() => {
    fetchGapInfo(p.symbol).then(g => {
      if (g?.todayOpen && g?.prevClose && g.prevClose > 0)
        setGapPct(((g.todayOpen - g.prevClose) / g.prevClose) * 100)
    }).catch(() => {})
  }, [p.symbol])

  // ── Tracking state ─────────────────────────────────────────────
  const pRef                = useRef(p)
  const alreadyTriggeredRef = useRef(false)
  const [showExitForm,   setShowExitForm]   = useState(false)
  const [exitInputPrice, setExitInputPrice] = useState('')
  const [showLog,        setShowLog]        = useState(true)

  useEffect(() => { pRef.current = p }, [p])

  // Reset trigger guard when position restarts watching
  useEffect(() => {
    if (p.trackingStatus === 'watching') alreadyTriggeredRef.current = false
  }, [p.trackingStatus])

  // ── Live price polling ──────────────────────────────────────────
  const [livePrice,    setLivePrice]    = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [lastUpdated,  setLastUpdated]  = useState(null)

  const doFetchPrice = useCallback(async () => {
    const pos = pRef.current
    // Stop polling once position is closed
    if (['sl_hit', 'target_hit', 'exited'].includes(pos.trackingStatus)) return

    setPriceLoading(true)
    try {
      const price = await fetchLivePrice(pos.symbol)
      if (price != null) {
        setLivePrice(price)
        setLastUpdated(new Date())

        // ── Auto-detect SL / Target hit ───────────────────────────
        if (isTracking && pos.trackingStatus === 'watching' && !alreadyTriggeredRef.current) {
          const up     = pos.direction === 'BUY'
          const slHit  = up ? price <= pos.sl     : price >= pos.sl
          const tgtHit = up ? price >= pos.target : price <= pos.target

          if (slHit || tgtHit) {
            alreadyTriggeredRef.current = true
            const pnl      = Math.round(up ? pos.qty * (price - pos.entry) : pos.qty * (pos.entry - price))
            const timeStr  = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const newStatus = slHit ? 'sl_hit' : 'target_hit'
            const event     = slHit ? '🔴 SL HIT' : '🎯 Target HIT'
            onUpdate(pos.id, {
              trackingStatus: newStatus,
              finalPnl: pnl,
              activityLog: [...(pos.activityLog || []), { time: timeStr, event, price, pnl }],
            })
          }
        }
      }
    } catch { /* ignore — keep showing last known price */ }
    finally { setPriceLoading(false) }
  }, [isTracking, onUpdate])

  useEffect(() => {
    doFetchPrice()
    const id = setInterval(doFetchPrice, 30_000)
    return () => clearInterval(id)
  }, [doFetchPrice])

  // ── Manual exit ────────────────────────────────────────────────
  function handleManualExit() {
    const exitPrice = parseFloat(exitInputPrice)
    if (!exitPrice || exitPrice <= 0) return
    const up  = p.direction === 'BUY'
    const pnl = Math.round(up ? p.qty * (exitPrice - p.entry) : p.qty * (p.entry - exitPrice))
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    onUpdate(p.id, {
      trackingStatus: 'exited',
      finalPnl: pnl,
      exitPrice,
      activityLog: [...(p.activityLog || []), { time: timeStr, event: '🚪 Manual Exit', price: exitPrice, pnl }],
    })
    setShowExitForm(false)
  }

  // ── P&L calc ────────────────────────────────────────────────────
  const pnl = livePrice != null
    ? Math.round(isUp ? p.qty * (livePrice - p.entry) : p.qty * (p.entry - livePrice))
    : null
  const pnlPct = livePrice != null
    ? ((livePrice - p.entry) / p.entry * 100) * (isUp ? 1 : -1)
    : null

  const slDist  = Math.abs(p.entry - p.sl)
  const tgtDist = Math.abs(p.target - p.entry)
  const moved   = livePrice != null ? (isUp ? livePrice - p.entry : p.entry - livePrice) : 0
  const pnlPositive = pnl != null && pnl >= 0

  const status   = p.trackingStatus || 'idle'
  const isClosed = ['sl_hit', 'target_hit', 'exited'].includes(status)
  const actLog   = p.activityLog || []

  return (
    <div className={`rounded-lg border p-3 group relative flex flex-col gap-2.5 transition-all
      ${isEditing
        ? 'border-accent bg-accent/5 ring-1 ring-accent/40'
        : isUp ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-red-950/20 border-red-900/50'
      }`}>

      {/* Edit + Remove buttons (show on hover) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={() => onEdit(p.id)} title="Edit position"
          className="text-gray-500 hover:text-accent text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
          ✎
        </button>
        <button onClick={() => onRemove(p.id)} title="Remove position"
          className="text-gray-500 hover:text-red-400 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
          ✕
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
          ${isUp ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
          {isUp ? '⬆' : '⬇'} {p.direction}
        </span>
        <span className="font-bold text-white text-sm">{p.symbol}</span>
        {gapPct != null && Math.abs(gapPct) >= 0.1 && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none
            ${gapPct > 0
              ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-700/50'
              : 'bg-red-900/70 text-red-300 border border-red-700/50'}`}>
            {gapPct > 0 ? '▲ Gap UP' : '▼ Gap DOWN'} {Math.abs(gapPct).toFixed(2)}%
          </span>
        )}
        <span className="text-[10px] text-muted">
          {p.qty} shares ·{' '}
          <span className="text-white font-semibold">₹{fmtInt(p.qty * p.entry)}</span>
          {' exp · '}
          <span className="text-accent font-semibold">₹{fmtInt(p.qty * p.entry / 5)}</span>
          {' cap(5×)'}
        </span>
      </div>

      {/* ── Tracking status banner ─────────────────────────────── */}
      {status !== 'idle' && (
        <div className={`rounded-lg px-3 py-2 flex items-center justify-between text-xs font-semibold
          ${status === 'watching'
            ? 'bg-blue-950/40 border border-blue-800/50 text-blue-300'
            : status === 'sl_hit'
              ? 'bg-red-950/60 border border-red-600 text-red-300'
              : status === 'target_hit'
                ? 'bg-emerald-950/60 border border-emerald-600 text-emerald-300'
                : 'bg-gray-800/60 border border-border text-muted'}`}>
          <span className="flex items-center gap-2">
            {status === 'watching' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
            )}
            {status === 'watching'   && 'Watching…'}
            {status === 'sl_hit'     && `🔴 SL HIT · ₹${fmt(actLog.slice().reverse().find(l => l.event === '🔴 SL HIT')?.price)}`}
            {status === 'target_hit' && `🎯 Target HIT · ₹${fmt(actLog.slice().reverse().find(l => l.event === '🎯 Target HIT')?.price)}`}
            {status === 'exited'     && `🚪 Exited · ₹${fmt(p.exitPrice)}`}
          </span>
          {p.finalPnl != null && (
            <span className={`text-base font-bold ${p.finalPnl >= 0 ? 'text-up' : 'text-down'}`}>
              {p.finalPnl >= 0 ? '+' : ''}₹{Math.abs(p.finalPnl).toLocaleString('en-IN')}
            </span>
          )}
        </div>
      )}

      {/* Price levels grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="text-center bg-gray-900/60 rounded px-2 py-1.5">
          <div className="text-[9px] text-muted mb-0.5">Entry</div>
          <div className="text-xs font-semibold text-white">₹{fmt(p.entry)}</div>
        </div>
        <div className="text-center bg-red-950/40 rounded px-2 py-1.5">
          <div className="text-[9px] text-muted mb-0.5">Stop Loss</div>
          <div className="text-xs font-bold text-down">₹{fmt(p.sl)}</div>
        </div>
        <div className="text-center bg-emerald-950/40 rounded px-2 py-1.5">
          <div className="text-[9px] text-muted mb-0.5">Target</div>
          <div className="text-xs font-bold text-up">₹{fmt(p.target)}</div>
        </div>
      </div>

      {/* ── Live P&L card (hidden when position is closed) ─────── */}
      {!isClosed && (
        <div className={`rounded-lg border px-3 py-2 transition-colors
          ${livePrice == null
            ? 'bg-gray-800/30 border-border/30'
            : pnlPositive
              ? 'bg-emerald-950/40 border-emerald-800/50'
              : 'bg-red-950/40 border-red-800/50'
          }`}>

          {livePrice == null && priceLoading ? (
            <div className="text-[10px] text-muted animate-pulse py-0.5">Fetching live price…</div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0
                    ${priceLoading ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="text-[9px] text-muted">Unrealised P&L</span>
                </div>
                <div className={`text-xl font-bold leading-none
                  ${pnl == null ? 'text-muted' : pnlPositive ? 'text-up' : 'text-down'}`}>
                  {pnl == null ? '—'
                    : `${pnlPositive ? '+' : ''}₹${Math.abs(pnl).toLocaleString('en-IN')}`}
                </div>
                {pnlPct != null && (
                  <div className={`text-[10px] font-semibold mt-0.5 ${pnlPositive ? 'text-up' : 'text-down'}`}>
                    {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}% from entry
                  </div>
                )}
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1 mb-0.5">
                  <span className="text-[9px] text-muted">LTP</span>
                  <button onClick={doFetchPrice} disabled={priceLoading} title="Refresh price"
                    className="text-[10px] text-gray-600 hover:text-white w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-colors disabled:opacity-30">
                    ↻
                  </button>
                </div>
                <div className="text-sm font-bold text-white">
                  {livePrice != null ? `₹${fmt(livePrice)}` : '—'}
                </div>
                {lastUpdated && (
                  <div className="text-[9px] text-gray-600 mt-0.5">
                    {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress bar: SL ←——●——→ Target */}
          {livePrice != null && slDist > 0 && tgtDist > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[9px] text-muted mb-1">
                <span className="text-down">SL ₹{fmt(p.sl)}</span>
                <span className="text-up">Tgt ₹{fmt(p.target)}</span>
              </div>
              <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="absolute inset-0 rounded-full"
                  style={{ background: isUp
                    ? 'linear-gradient(to right, #ef4444, #374151 40%, #10b981)'
                    : 'linear-gradient(to right, #10b981, #374151 40%, #ef4444)',
                    opacity: 0.5 }} />
                {(() => {
                  const totalRange = tgtDist + slDist
                  const entryPos   = (slDist / totalRange) * 100
                  const pricePos   = entryPos + (moved / totalRange) * 100
                  const clamped    = Math.min(98, Math.max(2, pricePos))
                  return (
                    <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow ring-1 ring-gray-400 -translate-x-1/2"
                      style={{ left: `${clamped}%`, background: pnlPositive ? '#10b981' : '#ef4444' }} />
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manual Exit button ─────────────────────────────────── */}
      {isTracking && status === 'watching' && (
        <div>
          {!showExitForm ? (
            <button
              onClick={() => { setShowExitForm(true); setExitInputPrice(livePrice ? livePrice.toFixed(2) : '') }}
              className="w-full text-[10px] py-1.5 rounded border border-border/40 text-muted hover:text-red-300 hover:border-red-700/50 transition-colors">
              🚪 Exit Position
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-gray-900/50 rounded-lg p-2 border border-border/40">
              <span className="text-[10px] text-muted shrink-0">Exit ₹</span>
              <input
                type="number" value={exitInputPrice} step={0.05} autoFocus
                onChange={e => setExitInputPrice(e.target.value)}
                className="flex-1 bg-gray-800 border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              />
              <button onClick={handleManualExit}
                className="px-2.5 py-1 bg-accent text-white text-[10px] rounded font-semibold hover:bg-accent/80 transition-colors">
                Confirm
              </button>
              <button onClick={() => setShowExitForm(false)}
                className="px-2 py-1 bg-gray-700 text-muted text-[10px] rounded hover:text-white transition-colors">
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Activity Log ───────────────────────────────────────── */}
      {actLog.length > 0 && (
        <div className="border-t border-border/30 pt-2">
          <button onClick={() => setShowLog(v => !v)}
            className="text-[9px] text-muted hover:text-white mb-1.5 flex items-center gap-1 transition-colors">
            {showLog ? '▾' : '▸'} Activity Log ({actLog.length})
          </button>
          {showLog && (
            <div className="space-y-1">
              {actLog.map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-gray-600 shrink-0 tabular-nums">{log.time}</span>
                  <span className="font-semibold text-white flex-1">{log.event}</span>
                  {log.price != null && (
                    <span className="text-muted tabular-nums">₹{fmt(log.price)}</span>
                  )}
                  {log.pnl != null && (
                    <span className={`font-bold shrink-0 tabular-nums ${log.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                      {log.pnl >= 0 ? '+' : ''}₹{Math.abs(log.pnl).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk / Reward / R:R footer */}
      <div className="flex items-center justify-between text-[11px]">
        <div>
          <span className="text-muted">Risk </span>
          <span className="font-bold text-down">₹{risk != null ? fmtInt(risk) : '—'}</span>
        </div>
        <div>
          <span className="text-muted">Reward </span>
          <span className="font-bold text-up">₹{reward != null ? fmtInt(reward) : '—'}</span>
        </div>
        <div>
          <span className="text-muted">R:R </span>
          <span className="font-bold text-white">{rr ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RiskPlanner({ positions, settings, onSettingsChange, onAdd, onRemove, onUpdate }) {  // eslint-disable-line no-unused-vars
  const [showForm,     setShowForm]     = useState(false)
  const [editingId,    setEditingId]    = useState(null)   // null = adding new
  const [showSettings, setShowSettings] = useState(false)
  const [draft,        setDraft]        = useState(settings)
  const [isTracking,   setIsTracking]   = useState(false)

  useEffect(() => { setDraft(settings) }, [settings])

  function openAdd()     { setShowForm(true);  setEditingId(null); setShowSettings(false) }
  function openEdit(id)  { setShowForm(true);  setEditingId(id);   setShowSettings(false) }
  function closeForm()   { setShowForm(false); setEditingId(null) }

  function handleStartTracking() {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setIsTracking(true)
    positions.forEach(p => {
      if (['sl_hit', 'target_hit', 'exited'].includes(p.trackingStatus)) return
      onUpdate(p.id, {
        trackingStatus: 'watching',
        activityLog: [...(p.activityLog || []), { time: now, event: '▶ Tracking Started', price: null, pnl: null }],
      })
    })
  }

  function handleStopTracking() {
    setIsTracking(false)
  }

  function handleResetTracking() {
    setIsTracking(false)
    positions.forEach(p => {
      onUpdate(p.id, { trackingStatus: 'idle', activityLog: [], finalPnl: null, exitPrice: null })
    })
  }

  // ── Export / Import ───────────────────────────────────────────
  const importRef = useRef(null)

  function handleExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-IN'),
      positions,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `risk-planner-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data     = JSON.parse(ev.target.result)
        const imported = Array.isArray(data.positions) ? data.positions : []
        if (!imported.length) { alert('No positions found in file'); return }
        if (!window.confirm(`Import ${imported.length} position(s)? This will replace your current positions.`)) return
        // Remove existing, then add imported
        positions.forEach(p => onRemove(p.id))
        imported.forEach(p => onAdd({
          symbol:         p.symbol,
          direction:      p.direction,
          entry:          p.entry,
          qty:            p.qty,
          sl:             p.sl,
          target:         p.target,
          trackingStatus: 'idle',
          activityLog:    [],
          finalPnl:       null,
          exitPrice:      null,
        }))
      } catch {
        alert('Invalid file — could not read positions')
      }
      e.target.value = ''   // reset so same file can be re-imported
    }
    reader.readAsText(file)
  }

  // Aggregate totals
  const totalRisk   = positions.reduce((s, p) => s + (calcRisk(p.direction, p.entry, p.qty, p.sl) ?? 0), 0)
  const totalReward = positions.reduce((s, p) => s + (calcReward(p.direction, p.entry, p.qty, p.target) ?? 0), 0)
  const riskPct     = Math.min(100, settings.dailyLossLimit > 0 ? (totalRisk / settings.dailyLossLimit) * 100 : 0)
  const posCount    = positions.length

  // Status
  let statusLabel, statusColor, statusMsg
  if (posCount >= settings.maxPositions && settings.maxPositions > 0) {
    statusLabel = '🛑 Position limit reached'; statusColor = 'red'
    statusMsg   = `${settings.maxPositions} positions — max for today`
  } else if (totalRisk >= settings.dailyLossLimit) {
    statusLabel = '🛑 Risk limit reached'; statusColor = 'red'
    statusMsg   = 'Total risk equals your daily loss limit. No more positions.'
  } else if (riskPct >= 70) {
    statusLabel = '⚠ High risk'; statusColor = 'yellow'
    statusMsg   = `${riskPct.toFixed(0)}% of daily loss limit committed`
  } else if (posCount === 0) {
    statusLabel = '— No positions'; statusColor = 'gray'
    statusMsg   = 'Add a position to see your risk'
  } else {
    statusLabel = '✓ Risk OK'; statusColor = 'emerald'
    statusMsg   = `${riskPct.toFixed(0)}% of ₹${settings.dailyLossLimit.toLocaleString('en-IN')} limit committed`
  }

  const bannerCls = {
    emerald: 'bg-emerald-950/40 border-emerald-700 text-emerald-300',
    yellow:  'bg-yellow-950/30  border-yellow-700  text-yellow-300',
    red:     'bg-red-950/40     border-red-700     text-red-300',
    gray:    'bg-gray-800/40    border-border      text-muted',
  }[statusColor]

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">📊 Risk Planner</span>
          <span className="text-[10px] text-muted border border-border/40 rounded px-1.5 py-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          {posCount > 0 && (
            <span className="text-[10px] text-muted">{posCount} position{posCount > 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Export */}
          {positions.length > 0 && (
            <button onClick={handleExport} title="Export positions to JSON"
              className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted hover:text-white hover:border-gray-500 transition-colors">
              ↓ Export
            </button>
          )}
          {/* Import */}
          <button onClick={() => importRef.current?.click()} title="Import positions from JSON"
            className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted hover:text-white hover:border-gray-500 transition-colors">
            ↑ Import
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />

          <button
            onClick={() => showForm ? closeForm() : openAdd()}
            className={`text-[10px] px-2.5 py-1 rounded font-semibold transition-colors border ${
              showForm
                ? 'bg-accent border-accent text-white'
                : 'border-border text-muted hover:text-white hover:border-gray-500'
            }`}>
            {showForm ? '✕ Cancel' : '+ Add Position'}
          </button>
          <button
            onClick={() => { setShowSettings(s => !s); closeForm() }}
            className="text-[10px] text-muted hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors">
            ⚙
          </button>
        </div>
      </div>

      {/* ── Tracking control bar ────────────────────────────────── */}
      {posCount > 0 && (
        <div className={`flex items-center justify-between px-4 py-2 border-b border-border transition-colors
          ${isTracking ? 'bg-emerald-950/20' : 'bg-gray-900/30'}`}>
          <div className="flex items-center gap-2">
            {isTracking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            <span className="text-[10px] text-muted">
              {isTracking
                ? 'Tracking active · auto-detects SL / Target · polls every 30s'
                : 'Click ▶ Start to begin live tracking'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isTracking && positions.some(p => p.trackingStatus && p.trackingStatus !== 'idle') && (
              <button onClick={handleResetTracking}
                className="text-[10px] px-2 py-1 text-muted hover:text-white border border-border/40 rounded transition-colors">
                ↺ Reset
              </button>
            )}
            {isTracking ? (
              <button onClick={handleStopTracking}
                className="text-[10px] px-3 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded font-semibold border border-red-700/50 transition-colors">
                ⏹ Stop
              </button>
            ) : (
              <button onClick={handleStartTracking}
                className="text-[10px] px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded font-semibold border border-emerald-700/50 transition-colors">
                ▶ Start
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-4">

        {/* ── Settings ─────────────────────────────────────────── */}
        {showSettings && (
          <SettingsPanel draft={draft} setDraft={setDraft}
            onSave={() => { onSettingsChange(draft); setShowSettings(false) }} />
        )}

        {/* ── Add / Edit form ───────────────────────────────────── */}
        {showForm && (
          <AddForm
            initialValues={editingId ? positions.find(p => p.id === editingId) ?? null : null}
            onSubmit={p => {
              if (editingId) {
                onUpdate(editingId, p)
              } else {
                const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                onAdd({
                  ...p,
                  trackingStatus: isTracking ? 'watching' : 'idle',
                  activityLog: isTracking
                    ? [{ time: now, event: '▶ Added & Tracking', price: null, pnl: null }]
                    : [],
                  finalPnl: null,
                  exitPrice: null,
                })
              }
              closeForm()
            }}
            onCancel={closeForm}
          />
        )}

        {/* ── Positions ────────────────────────────────────────── */}
        {positions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {positions.map(p => (
              <PositionRow
                key={p.id}
                p={p}
                onRemove={onRemove}
                onEdit={openEdit}
                isEditing={editingId === p.id}
                isTracking={isTracking}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}

        {/* ── Risk summary ─────────────────────────────────────── */}
        <div className={`rounded-lg border px-4 py-3 mb-3 ${bannerCls}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm">{statusLabel}</span>
            <span className="text-[10px] opacity-70">{statusMsg}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[9px] opacity-60 uppercase tracking-widest mb-0.5">Total Risk</div>
              <div className="text-lg font-bold text-down">
                {totalRisk > 0 ? `₹${fmtInt(totalRisk)}` : '₹0'}
              </div>
              <div className="text-[9px] opacity-50">if all SLs hit</div>
            </div>
            <div>
              <div className="text-[9px] opacity-60 uppercase tracking-widest mb-0.5">Total Reward</div>
              <div className="text-lg font-bold text-up">
                {totalReward > 0 ? `₹${fmtInt(totalReward)}` : '₹0'}
              </div>
              <div className="text-[9px] opacity-50">if all targets hit</div>
            </div>
            <div>
              <div className="text-[9px] opacity-60 uppercase tracking-widest mb-0.5">Net R:R</div>
              <div className="text-lg font-bold text-white">
                {totalRisk > 0 && totalReward > 0 ? `1 : ${(totalReward / totalRisk).toFixed(2)}` : '—'}
              </div>
              <div className="text-[9px] opacity-50">portfolio R:R</div>
            </div>
          </div>
        </div>

        {/* ── Risk bar vs daily limit ───────────────────────────── */}
        <div>
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>Risk vs daily limit (₹{settings.dailyLossLimit.toLocaleString('en-IN')})</span>
            <span className={riskPct >= 70 ? (riskPct >= 100 ? 'text-red-400' : 'text-yellow-400') : ''}>
              {riskPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                riskPct >= 100 ? 'bg-red-500' : riskPct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, riskPct)}%` }}
            />
          </div>
          {positions.length === 0 && !showForm && (
            <p className="text-center text-muted text-[11px] mt-4">
              Click <span className="text-accent font-semibold">+ Add Position</span> to plan your trade risk
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
