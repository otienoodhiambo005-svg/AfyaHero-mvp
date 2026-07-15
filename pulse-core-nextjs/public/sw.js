// AFYAHERO Service Worker — Offline-first caching strategy
// Handles: static assets (cache-first), API calls (network-first w/ fallback),
// dashboard pages (stale-while-revalidate), and background sync for offline writes.

const CACHE_VERSION = 'afyahero-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Core shell — always cached on install
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
];

// ─── Message handler: allow client to force-activate new SW ──────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Install: precache shell ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(
        PRECACHE_ASSETS.filter((url) => !url.includes('/dashboard/'))
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('afyahero-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: tiered caching strategy ──────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache/serve Next.js Flight (RSC) and route payload requests.
  // These must come from the network or App Router navigation can get stuck.
  const isNextFlightRequest =
    url.searchParams.has('_rsc') ||
    request.headers.get('rsc') === '1' ||
    request.headers.get('next-router-state-tree') !== null ||
    request.headers.get('next-router-prefetch') !== null;

  if (isNextFlightRequest) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Skip non-GET requests for caching (handle separately for background sync)
  if (request.method !== 'GET') {
    event.respondWith(networkWithOfflineQueue(request));
    return;
  }

  // Skip chrome-extension and non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // External AI/Supabase API calls → network-first, no cache
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('upstash')
  ) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Internal API routes → network-first with stale fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Next.js _next/static assets — network-first to prevent stale chunk errors
  // Falls back to cache only if offline
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Portal pages → stale-while-revalidate
  if (url.pathname.startsWith('/portal') || url.pathname === '/') {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Everything else → network-first
  event.respondWith(networkFirstWithFallback(request));
});

// ─── Background Sync: flush offline queue ────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'afyahero-offline-sync') {
    event.waitUntil(flushOfflineQueue());
  }
});

// ─── Push Notifications ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'AfyaHero Alert', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'afyahero-notification',
      data: { url: data.url || '/dashboard' },
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ─── Strategy implementations ────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || offlineFallback();
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Offline — request queued for sync' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function networkWithOfflineQueue(request) {
  try {
    return await fetch(request);
  } catch {
    // Queue the failed mutation for background sync
    await queueOfflineRequest(request);
    return new Response(
      JSON.stringify({ queued: true, message: 'Saved offline. Will sync when connected.' }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function offlineFallback() {
  const cached = await caches.match('/offline.html');
  return (
    cached ||
    new Response(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#1B262C;color:#fff">
        <h1 style="color:#3282B8">AfyaHero</h1>
        <p>You are offline. Critical modules (queue, notes, dispensing) are still available.</p>
        <p>Changes will sync automatically when you reconnect.</p>
        <a href="/" style="color:#3282B8">Go to Home</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  );
}

async function queueOfflineRequest(request) {
  try {
    const body = await request.clone().text();
    const queuedRequest = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now(),
    };
    const allClients = await clients.matchAll();
    allClients.forEach((client) =>
      client.postMessage({ type: 'OFFLINE_MUTATION_CAPTURED', request: queuedRequest })
    );
  } catch (e) {
    console.warn('[SW] Could not queue offline request', e);
  }
}

async function flushOfflineQueue() {
  // Notify clients to re-attempt queued requests
  const allClients = await clients.matchAll();
  allClients.forEach((client) =>
    client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' })
  );
}
