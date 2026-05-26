import { useEffect, useState, useCallback } from 'react'
import { fetchTopMoversCSV } from '../services/nse'


function fmt(n, d = 2) {
  if (n == null || n === 0) return '—'
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtVol(n) {
  if (!n) return '—'
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(1) + 'Cr'
  if (n >= 1_00_000)    return (n / 1_00_000).toFixed(1) + 'L'
  if (n >= 1_000)       return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function MoverRow({ rank, item, isGainer }) {
  const pct = item.pChange ?? 0
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
      <span className="text-[10px] text-gray-600 w-4 shrink-0 text-right tabular-nums">{rank}</span>
      <span className="flex-1 text-xs font-semibold text-white truncate">{item.symbol}</span>
      <span className="text-xs tabular-nums text-gray-300 shrink-0 w-20 text-right">₹{fmt(item.lastPrice)}</span>
      <span className="text-[10px] tabular-nums text-gray-600 shrink-0 w-10 text-right">
        {fmtVol(item.totalTradedVolume)}
      </span>
      <span className={`text-xs font-bold tabular-nums shrink-0 w-16 text-right
        ${isGainer ? 'text-emerald-400' : 'text-red-400'}`}>
        {pct > 0 ? '+' : ''}{fmt(pct)}%
      </span>
      <span className={`text-[10px] tabular-nums shrink-0 w-14 text-right hidden sm:block
        ${isGainer ? 'text-emerald-700' : 'text-red-700'}`}>
        {item.change > 0 ? '+' : ''}₹{fmt(item.change)}
      </span>
    </div>
  )
}

function MoverPanel({ title, items, isGainer, loading }) {
  const accent    = isGainer ? 'border-t-emerald-700' : 'border-t-red-800'
  const labelCls  = isGainer ? 'text-emerald-400' : 'text-red-400'
  const arrow     = isGainer ? '▲' : '▼'

  return (
    <div className={`flex-1 min-w-0 rounded-xl border border-border bg-gray-900/40 overflow-hidden border-t-2 ${accent}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className={`text-xs font-bold ${labelCls}`}>{arrow} {title}</span>
        <div className="flex gap-2 text-[9px] text-gray-600 tabular-nums">
          <span className="w-20 text-right">LTP</span>
          <span className="w-10 text-right">Vol</span>
          <span className="w-16 text-right">Chg%</span>
          <span className="w-14 text-right hidden sm:block">Chg ₹</span>
        </div>
      </div>

      {loading ? (
        <div className="px-3 py-2 space-y-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-5 bg-gray-800/70 rounded animate-pulse"
              style={{ opacity: 1 - i * 0.07 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="text-[11px] text-muted mb-1">No data</p>
          <p className="text-[10px] text-gray-600">NSE data available during market hours (9:15 AM – 3:30 PM IST)</p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {items.map((item, i) => (
            <MoverRow key={item.symbol} rank={i + 1} item={item} isGainer={isGainer} />
          ))}
        </div>
      )}
    </div>
  )
}

const CACHE_KEY = 'top_movers_cache'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}
function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch {}
}

export default function TopMovers() {
  const cached = loadCache()
  const [gainers,     setGainers]     = useState(cached?.gainers ?? [])
  const [losers,      setLosers]      = useState(cached?.losers  ?? [])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(cached?.ts ? new Date(cached.ts) : null)
  const [collapsed,   setCollapsed]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { gainers: g, losers: l } = await fetchTopMoversCSV('allSec')
      setGainers(g)
      setLosers(l)
      const ts = new Date()
      setLastUpdated(ts)
      saveCache({ gainers: g, losers: l, ts: ts.toISOString() })
    } catch (e) {
      const msg = e.message?.includes('abort') ? 'Request timed out' : e.message || 'Could not fetch NSE data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">📈 Top Movers</span>
          <span className="text-[10px] text-muted border border-border/40 rounded px-1.5 py-0.5">NSE · All Securities</span>
          {timeStr && !loading && (
            <span className="text-[10px] text-gray-600">· {timeStr}</span>
          )}
          {loading && (
            <span className="text-[10px] text-muted animate-pulse">· Fetching…</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {error && <span className="text-[10px] text-red-400 max-w-[180px] truncate" title={error}>⚠ {error}</span>}
          <button onClick={load} disabled={loading}
            className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40">
            ↻ Refresh
          </button>
          <button onClick={() => setCollapsed(c => !c)}
            className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted hover:text-white hover:border-gray-500 transition-colors">
            {collapsed ? '▼ Show' : '▲ Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <MoverPanel title="Top Gainers" items={gainers} isGainer={true}  loading={loading} />
          <MoverPanel title="Top Losers"  items={losers}  isGainer={false} loading={loading} />
        </div>
      )}
    </div>
  )
}
