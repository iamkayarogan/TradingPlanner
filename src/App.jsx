import { useState } from 'react'
import { getSession, signOut } from './services/localAuth'
import MarketStatus from './components/MarketStatus'
import RiskPlanner, { useRiskPlanner } from './components/RiskPlanner'
import AuthModal from './components/AuthModal'

function AppContent({ user, onLogout }) {
  const [tick, setTick] = useState(0)
  const { settings, setSettings, positions, addPosition, removePosition, updatePosition } =
    useRiskPlanner(user.id)

  useState(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  })

  return (
    <div className="min-h-screen bg-bg text-gray-200">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg border-b border-border px-4 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <span className="text-accent font-bold text-lg tracking-tight">⚡ TradingPlanner</span>

          <div className="flex items-center gap-3">
            <MarketStatus lastUpdated={tick} />

            {/* User info + logout */}
            <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
              <span className="text-[10px] text-muted hidden sm:block truncate max-w-[140px]">
                {user.name || user.email}
              </span>
              <button onClick={onLogout}
                className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted hover:text-white hover:border-gray-500 transition-colors">
                Log out
              </button>
            </div>
          </div>
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

export default function App() {
  const [user, setUser] = useState(() => getSession())  // auto-login from saved session

  function handleAuth(session) { setUser(session) }

  function handleLogout() {
    signOut()
    setUser(null)
  }

  if (!user) return <AuthModal onAuth={handleAuth} />

  return <AppContent user={user} onLogout={handleLogout} />
}
