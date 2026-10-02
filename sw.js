// Cache strategy: Cache First for assets, Network First for HTML.
// Bump CACHE_VERSION whenever precached files change so old caches are purged.
const CACHE_VERSION = 'v6';
const STATIC_CACHE = `temple-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `temple-dynamic-${CACHE_VERSION}`;

// Core files to precache on install.
// Every entry MUST exist — cache.addAll() rejects the whole install on a single 404.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/assets/css/site.css',
  '/assets/js/main.js',
  '/assets/js/particles.js',
  '/assets/js/visitor-intel.js',
  '/img/snhu-logo.webp',
  '/img/cu-boulder-logo.webp',
  // Standalone content pages (self-contained, usable offline)
  '/career.html',
  '/ctf-writeups.html',
  '/attack-viz.html',
  '/pentest-sim.html',
  '/hacker-feed.html',
  // 3D / WebGL pages and the vendored three.js they run on. The large Earth
  // textures are left out on purpose: they're cached on first view instead.
  '/threat-globe.html',
  '/soc.html',
  '/insane-engine.html',
  '/game.html',
  '/world.html',
  '/vendor/three/three.min.js',
  '/vendor/three/CopyShader.js',
  '/vendor/three/EffectComposer.js',
  '/vendor/three/LuminosityHighPassShader.js',
  '/vendor/three/RenderPass.js',
  '/vendor/three/ShaderPass.js',
  '/vendor/three/UnrealBloomPass.js',
  // Knights Templar real-time 3D renderer (game.html)
  '/game3d/core.js',
  '/game3d/props.js',
  '/game3d/rooms.js',
  '/game3d/engine.js',
  // REALM (world.html) ES modules + three.js r158
  '/src/activities/ActivitySystem.js',
  '/src/audio/AudioSystem.js',
  '/src/combat/CombatSystem.js',
  '/src/core/Game.js',
  '/src/hud/HUD.js',
  '/src/hud/Minimap.js',
  '/src/main.js',
  '/src/npcs/NPCSystem.js',
  '/src/player/Camera.js',
  '/src/player/Player.js',
  '/src/quests/QuestSystem.js',
  '/src/systems/CollisionSystem.js',
  '/src/systems/Input.js',
  '/src/systems/Particles.js',
  '/src/systems/PoliceSystem.js',
  '/src/systems/WorldEvents.js',
  '/src/vehicles/VehicleSystem.js',
  '/src/world/City.js',
  '/src/world/Environment.js',
  '/src/world/Lighting.js',
  '/src/world/Terrain.js',
  '/vendor/three-r158/build/three.module.min.js',
  '/vendor/three-r158/examples/jsm/environments/RoomEnvironment.js',
  '/vendor/three-r158/examples/jsm/objects/Sky.js',
  '/vendor/three-r158/examples/jsm/postprocessing/EffectComposer.js',
  '/vendor/three-r158/examples/jsm/postprocessing/MaskPass.js',
  '/vendor/three-r158/examples/jsm/postprocessing/Pass.js',
  '/vendor/three-r158/examples/jsm/postprocessing/RenderPass.js',
  '/vendor/three-r158/examples/jsm/postprocessing/ShaderPass.js',
  '/vendor/three-r158/examples/jsm/postprocessing/UnrealBloomPass.js',
  '/vendor/three-r158/examples/jsm/shaders/CopyShader.js',
  '/vendor/three-r158/examples/jsm/shaders/LuminosityHighPassShader.js',
  // Tools
  '/tools/index.html',
  '/tools/tools.css',
  '/tools/tools.js',
  '/tools/llm-top10.html',
  '/tools/sysprompt-analyzer.html',
  '/tools/bluetooth-locator.html',
  '/tools/cidr.html',
  '/tools/cracker.html',
  '/tools/cron.html',
  '/tools/cve.html',
  '/tools/dns.html',
  '/tools/email.html',
  '/tools/encode.html',
  '/tools/hash.html',
  '/tools/headers.html',
  '/tools/http-builder.html',
  '/tools/jwt.html',
  '/tools/osint.html',
  '/tools/password.html',
  '/tools/payloads.html',
  '/tools/pentest.html',
  '/tools/pwgen.html',
  '/tools/recon.html',
  '/tools/regex.html',
  '/tools/scanner.html',
  '/tools/ssl.html',
  '/tools/whois.html',
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
  'api.github.com',
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

  // Only handle http/https GET requests
  if (!url.protocol.startsWith('http') || request.method !== 'GET') return;

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
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
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
          <span>You are offline. Showing cached version of this site.</span>
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

    return new Response('<h1>Offline</h1><p>This site is unavailable offline.</p>', {
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
