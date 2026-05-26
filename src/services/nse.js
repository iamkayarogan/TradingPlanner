const BASE = '/nseapi'

let bootstrapped = false
async function bootstrap() {
  if (bootstrapped) return
  try {
    await fetch(`${BASE}/`, { credentials: 'include', mode: 'no-cors' })
  } catch (_) {}
  bootstrapped = true
}

async function get(path) {
  await bootstrap()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json, text/plain, */*' },
      credentials: 'include',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`NSE ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchMarketStatus() {
  return get('/api/marketStatus')
}
