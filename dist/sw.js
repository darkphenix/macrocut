const CACHE = 'coupure-v2'
const ASSETS = ['./', './index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request)
      try {
        const fresh = await fetch(e.request)
        if (fresh.ok) cache.put(e.request, fresh.clone())
        return fresh
      } catch {
        return cached ?? new Response('Offline', { status: 503 })
      }
    })
  )
})

// ---- Notification depuis l'app ----
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SHOW_NOTIF') {
    const { title, body, tag, route = 'today' } = e.data
    self.registration.showNotification(title, {
      body,
      tag,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: './', route },
    })
  }
})

// ---- Click sur notification → ouvre l'app ----
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const route = e.notification.data?.route || 'today'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const existing = cs.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.postMessage({ type: 'OPEN_TAB', tab: route })
        return existing.focus()
      }
      return clients.openWindow(`./#${route}`)
    })
  )
})

// ---- Periodic Background Sync (expérimental, Chrome Android) ----
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'coupure-daily') {
    e.waitUntil(
      self.registration.showNotification('COUPURE', {
        body: 'N\'oublie pas de logger ton poids et tes repas aujourd\'hui.',
        icon: './icon-192.png',
        tag: 'periodic',
        vibrate: [100, 50, 100],
      })
    )
  }
})
