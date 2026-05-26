import { useState, useEffect } from 'react'
import MarketStatus from './components/MarketStatus'
import RiskPlanner, { useRiskPlanner } from './components/RiskPlanner'

export default function App() {
  const [tick, setTick] = useState(0)
  const { settings, setSettings, positions, addPosition, removePosition, updatePosition } = useRiskPlanner()

  // Clock tick — drives MarketStatus live clock
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-bg text-gray-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg border-b border-border px-4 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <span className="text-accent font-bold text-lg tracking-tight">⚡ TradingPlanner</span>
          <MarketStatus lastUpdated={tick} />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <RiskPlanner
          positions={positions}
          settings={settings}
          onSettingsChange={setSettings}
          onAdd={addPosition}
          onRemove={removePosition}
          onUpdate={updatePosition}
        />
      </main>
    </div>
  )
}
