/* Offline support: after the first visit the app opens even with a weak or no connection.
   - Pages: try the network for up to 4 s, then use the saved copy.
   - Built files (/assets/*, the icon, Google Fonts): saved copy first (asset names change on every deploy).
   - Supabase and the mirror's model files (/mediapipe/*) are not handled here; the mirror keeps its own cache. */
const APP = 'app-v1'
const FONTS = 'fonts-v1'
const KEEP = [APP, FONTS, 'mirror-models-v1']
const WAIT_MS = 4000

const isHtml = r => (r.headers.get('content-type') || '').includes('text/html')

/** Save index.html plus every asset it needs (including lazy chunks named inside the JS), and drop older deploys' assets. */
async function saveShell(res) {
  const html = await res.clone().text()
  const c = await caches.open(APP)
  await c.put('/index.html', res)
  const need = new Set(['/icon.svg', ...[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])])
  for (const u of [...need]) if (u.endsWith('.js')) {
    const r = (await c.match(u)) || (await fetch(u))
    if (!r.ok) continue
    await c.put(u, r.clone())
    // lazy chunks appear as "assets/x.js" (preload list) or "./x.js" (import() from inside /assets/)
    for (const m of (await r.text()).matchAll(/(?:assets\/|\.\/)([\w.-]+\.(?:js|css))/g)) need.add('/assets/' + m[1])
  }
  await Promise.all([...need].map(async u => { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r) } }))
  for (const k of await c.keys()) {
    const p = new URL(k.url).pathname
    if (p.startsWith('/assets/') && !need.has(p)) await c.delete(k)
  }
}

async function cacheFirst(name, req) {
  const c = await caches.open(name)
  const hit = await c.match(req)
  if (hit) return hit
  const r = await fetch(req)
  if (r.ok || r.type === 'opaque') await c.put(req, r.clone())
  return r
}

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(fetch('/').then(r => (r.ok && isHtml(r) ? saveShell(r) : null)).catch(() => {}))
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k) && /^(app|fonts)-v/.test(k)) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {
      const net = fetch(req)
      e.waitUntil(net.then(r => (r.ok && isHtml(r) ? saveShell(r.clone()) : null)).catch(() => {}))
      const saved = () => caches.open(APP).then(c => c.match('/index.html')).then(r => r || net)
      e.respondWith(Promise.race([net, new Promise((_, no) => setTimeout(no, WAIT_MS))]).catch(saved))
      return
    }
    if (url.pathname.startsWith('/assets/') || url.pathname === '/icon.svg') e.respondWith(cacheFirst(APP, req))
    return
  }
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') e.respondWith(cacheFirst(FONTS, req))
})
