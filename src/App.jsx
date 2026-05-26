import MarketStatus from './components/MarketStatus'
import RiskPlanner, { useRiskPlanner } from './components/RiskPlanner'
import TopMovers from './components/TopMovers'

export default function App() {
  const { settings, setSettings, positions, addPosition, removePosition, updatePosition } =
    useRiskPlanner(null)

  return (
    <div className="min-h-screen bg-bg text-gray-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg border-b border-border px-4 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <span className="text-accent font-bold text-lg tracking-tight">⚡ TradingPlanner</span>
          <MarketStatus />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <TopMovers />
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
