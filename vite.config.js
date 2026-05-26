import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

let nseCookies = ''

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function mergeCookies(base, added) {
  const map = new Map()
  for (const chunk of [base, added]) {
    for (const pair of chunk.split(';')) {
      const i = pair.indexOf('=')
      if (i > 0) {
        const k = pair.slice(0, i).trim()
        const v = pair.slice(i + 1).trim()
        if (k) map.set(k, v)
      }
    }
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function nseGet(path, cookieStr = '') {
  return new Promise(resolve => {
    const req = https.request(
      {
        hostname: 'www.nseindia.com',
        path,
        method: 'GET',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          ...(cookieStr ? { Cookie: cookieStr } : {}),
        },
      },
      res => {
        // Drain body so connection closes cleanly
        res.resume()
        res.on('end', () => {
          const raw = res.headers['set-cookie'] || []
          const newCookies = raw.map(c => c.split(';')[0]).join('; ')
          resolve(newCookies)
        })
      }
    )
    req.on('error', () => resolve(''))
    req.end()
  })
}

async function refreshCookies() {
  try {
    const c1 = await nseGet('/')
    const c2 = await nseGet('/market-data/top-gainers-losers', c1)
    nseCookies = mergeCookies(c1, c2)
    console.log(`[nse-proxy] session ready — ${nseCookies.split(';').length} cookies`)
  } catch (e) {
    console.error('[nse-proxy] cookie refresh failed:', e.message)
  }
}

refreshCookies()
setInterval(refreshCookies, 4 * 60 * 1000)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8443,
    strictPort: true,
    allowedHosts: ['kayaroganamv-cictt0n1-8443.zcodecorp.in'],
    proxy: {
      '/yahooapi': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/yahooapi/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      },
      '/nseapi': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/nseapi/, ''),
        configure: proxy => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('User-Agent', UA)
            proxyReq.setHeader('Referer', 'https://www.nseindia.com/market-data/top-gainers-losers')
            proxyReq.setHeader('Accept', 'application/json, text/csv, text/plain, */*')
            proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9')
            proxyReq.setHeader('X-Requested-With', 'XMLHttpRequest')
            if (nseCookies) proxyReq.setHeader('Cookie', nseCookies)
          })
          proxy.on('error', err => console.error('[nse-proxy]', err.message))
        },
      },
    },
  },
})
