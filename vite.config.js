import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

let nseCookies = ''

function refreshCookies() {
  return new Promise(resolve => {
    const req = https.request(
      {
        hostname: 'www.nseindia.com',
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      res => {
        const raw = res.headers['set-cookie'] || []
        nseCookies = raw.map(c => c.split(';')[0]).join('; ')
        console.log(`[nse-proxy] cookies refreshed (${raw.length} set)`)
        resolve()
      }
    )
    req.on('error', () => resolve())
    req.end()
  })
}

refreshCookies()
setInterval(refreshCookies, 4 * 60 * 1000)

export default defineConfig({
  plugins: [react()],
  server: {
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
          proxy.on('proxyReq', proxyReq => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
            proxyReq.setHeader('Referer', 'https://www.nseindia.com/')
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*')
            proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9')
            if (nseCookies) proxyReq.setHeader('Cookie', nseCookies)
          })
          proxy.on('error', err => console.error('[nse-proxy]', err.message))
        },
      },
    },
  },
})
