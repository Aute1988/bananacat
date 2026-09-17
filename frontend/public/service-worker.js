/**
 * ⛔ Service Worker DISABLED — see service-worker.js.disabled.
 *
 * We keep this file (rather than deleting it) because:
 *   - PWA manifest still references it.
 *   - Some users already have it cached and registered, so the browser
 *     would 404 trying to fetch a missing file and skip activation.
 *
 * By serving an immediately-self-unregistering SW, existing clients
 * pick up this version on next page load and then drop the controller.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // 卸载自身:清掉所有 cache,然后 unregister
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    ])
      .then(() => self.registration.unregister())
      // force the new controller to take over the existing page
      .then(() => self.clients.claim())
  )
})

// 不拦截任何请求,完全 pass-through 到网络
