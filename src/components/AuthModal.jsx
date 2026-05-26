import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../services/firebase'

export default function AuthModal() {
  const [mode,     setMode]     = useState('signup')  // 'login' | 'signup'
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      // Auth state change is picked up by onAuthStateChanged in App.jsx
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  function friendlyError(code) {
    switch (code) {
      case 'auth/email-already-in-use':   return 'Email already registered. Try logging in.'
      case 'auth/invalid-email':          return 'Invalid email address.'
      case 'auth/weak-password':          return 'Password must be at least 6 characters.'
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':     return 'Incorrect email or password.'
      case 'auth/too-many-requests':      return 'Too many attempts. Try again later.'
      default:                            return 'Something went wrong. Try again.'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="text-accent font-bold text-lg tracking-tight mb-0.5">⚡ TradingPlanner</div>
          <div className="text-muted text-[11px]">Sign in to sync positions across all your browsers</div>
        </div>

        {/* Toggle */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors
              ${mode === 'login'
                ? 'text-white border-b-2 border-accent bg-accent/10'
                : 'text-muted hover:text-white'}`}>
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError('') }}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors
              ${mode === 'signup'
                ? 'text-white border-b-2 border-accent bg-accent/10'
                : 'text-muted hover:text-white'}`}>
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-3">

          {mode === 'signup' && (
            <div>
              <label className="text-[10px] text-muted block mb-1">Name</label>
              <input
                type="text" value={name} placeholder="Your name"
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-900 border border-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent placeholder:text-gray-600"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] text-muted block mb-1">Email</label>
            <input
              type="email" value={email} placeholder="you@example.com" required
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="text-[10px] text-muted block mb-1">Password</label>
            <input
              type="password" value={password} placeholder="••••••••" required minLength={6}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent placeholder:text-gray-600"
            />
            {mode === 'signup' && (
              <p className="text-[9px] text-gray-600 mt-1">Minimum 6 characters</p>
            )}
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
              ⚠ {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors mt-1">
            {loading
              ? (mode === 'login' ? 'Logging in…' : 'Creating account…')
              : (mode === 'login' ? 'Log In' : 'Create Account')}
          </button>

          <p className="text-center text-[10px] text-muted">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              className="text-accent hover:underline">
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
