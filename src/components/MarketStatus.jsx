import { useEffect, useState } from 'react'
import { fetchMarketStatus } from '../services/nse'

const SESSIONS = {
  'Pre Open Market': { label: 'Pre-Open', color: 'text-yellow-400' },
  'Normal Market': { label: 'Market Open', color: 'text-up' },
  'Closing Session': { label: 'Closing', color: 'text-yellow-400' },
  'After Market': { label: 'Closed', color: 'text-muted' },
  'Market Closed': { label: 'Closed', color: 'text-muted' },
}

export default function MarketStatus() {
  const [status, setStatus] = useState(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const clockId = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(clockId)
  }, [])

  useEffect(() => {
    function load() {
      fetchMarketStatus()
        .then(d => {
          const markets = d.marketState || []
          const nse = markets.find(m => m.market === 'Capital Market') || markets[0]
          setStatus(nse)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const session = status ? (SESSIONS[status.marketStatus] || { label: status.marketStatus, color: 'text-accent' }) : null

  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="text-gray-300 font-bold">{timeStr}</span>
      {session && (
        <span className={`px-2 py-0.5 rounded border border-current ${session.color}`}>
          {session.label}
        </span>
      )}
      {status?.tradeDate && (
        <span>{status.tradeDate}</span>
      )}
    </div>
  )
}
