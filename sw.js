// Cache strategy: Cache First for assets, Network First for HTML
const CACHE_VERSION = 'temple-tools-v1';
const STATIC_CACHE = 'temple-static-v1';
const DYNAMIC_CACHE = 'temple-dynamic-v1';

// Core files to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/tools/index.html',
  '/tools/hash.html',
  '/tools/recon.html',
  '/tools/osint.html',
  '/tools/password.html',
  '/tools/scanner.html',
  '/tools/jwt.html',
  '/tools/encode.html',
  '/tools/email.html',
  '/tools/regex.html',
  '/tools/cidr.html',
  '/tools/cron.html',
  '/tools/headers.html',
  '/tools/pwgen.html',
  '/tools/ssl.html',
  '/tools/payloads.html',
  '/tools/cve.html',
  '/tools/whois.html',
  '/tools/ctf.html',
  '/tools/pwdaudit.html',
  '/tools/httpreq.html',
  '/tools/pentest.html',
  '/tools/dnsprop.html',
  '/globe.html',
  '/writeups.html',
  '/timeline.html',
  '/game.html',
  '/runner.html',
];

// API hostnames that should never be cached
const NETWORK_ONLY_HOSTS = [
  'dns.google',
  'cloudflare-dns.com',
  'api.hackertarget.com',
  'ipapi.co',
  'ipinfo.io',
  'cve.circl.lu',
  'rdap.org',
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(name => !currentCaches.includes(name))
            .map(name => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http/https
  if (!url.protocol.startsWith('http')) return;

  // Network Only — external APIs
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(fetch(request));
    return;
  }

  // Network First — HTML pages
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Cache First — CSS, JS, fonts, images
  const dest = request.destination;
  if (['style', 'script', 'font', 'image'].includes(dest)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stale While Revalidate — everything else
  event.respondWith(staleWhileRevalidate(request));
});

// ── STRATEGIES ────────────────────────────────────────────────────────────────

async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    // Update the dynamic cache with fresh response
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    // Try cache first
    const cached = await caches.match(request);
    if (cached) return cached;

    // Final fallback: serve /index.html with an offline overlay injected
    const fallback = await caches.match('/index.html');
    if (fallback) {
      const html = await fallback.text();
      const offlineHtml = html.replace(
        '</body>',
        `<div id="sw-offline-banner" style="
          position:fixed;bottom:0;left:0;right:0;z-index:99999;
          background:#0a0a0c;border-top:2px solid #00d4ff;
          color:#f5f2ec;font-family:monospace;font-size:0.85rem;
          padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;">
          <span style="color:#00d4ff;font-size:1.2rem;">⚠</span>
          <span>You are offline. Showing cached version of Temple Tools.</span>
          <button onclick="document.getElementById('sw-offline-banner').remove()"
            style="margin-left:auto;background:none;border:1px solid rgba(0,212,255,0.4);
            color:#00d4ff;padding:0.25rem 0.75rem;cursor:pointer;font-family:monospace;">
            Dismiss
          </button>
        </div></body>`
      );
      return new Response(offlineHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response('<h1>Offline</h1><p>Temple Tools is unavailable offline.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Revalidate in background
    fetch(request).then(async response => {
      if (response && response.status === 200) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response);
      }
    }).catch(() => {});
    return cached;
  }
  // Not in cache — fetch and store
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset unavailable offline.', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('Unavailable offline.', { status: 503 });
}
