// ── Local Auth — no third-party services ──────────────────────────────────────
// Credentials stored in localStorage, passwords hashed with SHA-256 (Web Crypto API)

const USERS_KEY   = 'rp_users'
const SESSION_KEY = 'rp_session'

// SHA-256 hash via built-in browser crypto (no library needed)
async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') }
  catch { return [] }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

export async function signUp({ name, email, password }) {
  const users = getUsers()
  if (users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()))
    throw new Error('Email already registered. Try logging in.')

  const passwordHash = await hashPassword(password)
  const user = {
    id:           crypto.randomUUID(),
    name:         name.trim(),
    email:        email.trim().toLowerCase(),
    passwordHash,
    createdAt:    new Date().toISOString(),
  }
  saveUsers([...users, user])

  const session = { id: user.id, name: user.name, email: user.email }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export async function signIn({ email, password }) {
  const users = getUsers()
  const user  = users.find(u => u.email === email.trim().toLowerCase())
  if (!user) throw new Error('Incorrect email or password.')

  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) throw new Error('Incorrect email or password.')

  const session = { id: user.id, name: user.name, email: user.email }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
}
