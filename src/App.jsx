import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './services/firebase'
import MarketStatus from './components/MarketStatus'
import RiskPlanner, { useRiskPlanner } from './components/RiskPlanner'
import AuthModal from './components/AuthModal'

function AppContent({ user }) {
  const [tick, setTick] = useState(0)
  const { settings, setSettings, positions, addPosition, removePosition, updatePosition, syncing } =
    useRiskPlanner(user?.uid ?? null)

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

          <div className="flex items-center gap-3">
            <MarketStatus lastUpdated={tick} />

            {/* Sync indicator */}
            {syncing && (
              <span className="text-[10px] text-muted flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Syncing…
              </span>
            )}

            {/* User info + logout */}
            <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
              <span className="text-[10px] text-muted hidden sm:block">
                {user.displayName || user.email}
              </span>
              <button
                onClick={() => signOut(auth)}
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
  const [user,        setUser]        = useState(undefined)  // undefined = loading
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u)
      setAuthChecked(true)
    })
    return () => unsub()
  }, [])

  // Loading splash while Firebase checks existing session
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-accent font-bold text-xl tracking-tight">⚡ TradingPlanner</span>
          <span className="text-muted text-xs animate-pulse">Loading…</span>
        </div>
      </div>
    )
  }

  // Not logged in — show auth modal
  if (!user) return <AuthModal />

  // Logged in — show full app
  return <AppContent user={user} />
}
