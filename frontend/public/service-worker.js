/**
 * 香蕉猫 PWA Service Worker
 *
 * 策略:
 *   - app shell (HTML/JS/CSS): stale-while-revalidate
 *   - 后端 API: network-first(尽量实时数据,失败用缓存)
 *   - 图片/字体: cache-first(7 天过期)
 *   - 其他静态资源: stale-while-revalidate
 *
 * 离线 fallback: /offline.html
 */
const CACHE_VERSION = 'bananacat-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const IMG_CACHE = `${CACHE_VERSION}-img`

// SW scope = registration URL 的前缀。在 repo site (GH Pages) 下为
// '/bananacat/'；在 user site / custom domain 下为 '/'。
const BASE = self.location.pathname.replace(/service-worker\.js$/, '')

const PRE_CACHE = [
  BASE,
  BASE + 'manifest.json',
  BASE + 'offline.html',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
]

// ============= 安装:预缓存 =============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRE_CACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ============= 激活:清旧缓存 =============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  )
})

// ============= 拦截请求 =============
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过 POST/DELETE/PUT(写操作必须走网络)
  if (request.method !== 'GET') return

  // ========== 后端 API:network-first ==========
  if (url.pathname.startsWith(BASE + 'api/') || url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // ========== 图片:cache-first ==========
  if (request.destination === 'image' || /\.(png|jpg|jpeg|svg|gif|webp)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMG_CACHE, 7 * 24 * 60 * 60))  // 7 天
    return
  }

  // ========== 静态资源(JSCSS font)=SW-Revalidate ==========
  if (/\.(js|css|woff2?|ttf)$/.test(url.pathname) || url.pathname.startsWith(BASE + 'assets/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // ========== HTML 页面:network-first + offline fallback ==========
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) => r || caches.match(BASE + 'offline.html'))
      )
    )
    return
  }
})

// ============= 策略实现 =============

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const clone = res.clone()
      caches.open(cacheName).then((c) => c.put(request, clone))
    }
    return res
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function cacheFirst(request, cacheName, maxAge) {
  const cached = await caches.match(request)
  if (cached) {
    // 检查过期
    const dateHeader = cached.headers.get('date')
    if (dateHeader && (Date.now() - new Date(dateHeader).getTime()) < maxAge * 1000) {
      return cached
    }
  }
  try {
    const res = await fetch(request)
    if (res.ok) {
      const clone = res.clone()
      caches.open(cacheName).then((c) => c.put(request, clone))
    }
    return res
  } catch {
    return cached || new Response('', { status: 504 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request).then((res) => {
    if (res.ok) {
      const clone = res.clone()
      caches.open(cacheName).then((c) => c.put(request, clone))
    }
    return res
  }).catch(() => cached)

  return cached || fetchPromise
}
