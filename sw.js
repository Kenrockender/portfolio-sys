/**
 * ══════════════════════════════════════════
 * SW.JS — PORTFOLIO.SYS Service Worker
 * ══════════════════════════════════════════
 * Strategy:
 *   - App shell (HTML, CSS, JS, fonts) → Cache First
 *   - API calls (CoinGecko, Yahoo, Firebase) → Network First with Cache Fallback
 *   - Price data → Stale-While-Revalidate (5 min max age)
 *   - On install: pre-cache all app shell files
 *   - On activate: delete old caches
 */

const CACHE_NAME = 'portfolio-sys-v6';
const RUNTIME_CACHE = 'portfolio-runtime-v1';
const API_CACHE = 'portfolio-api-v1';
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// All app shell files to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/mobile.css',
  '/js/app.js',
  '/js/api.js',
  '/js/charts.js',
  '/js/config.js',
  '/js/import-parsers.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/parsers/binance.js',
  '/js/parsers/parser-utils.js',
  '/js/parsers/savings.js',
  '/js/parsers/stock.js',
  '/js/parsers/tokocrypto.js',
  '/js/pwa-install.js',
  '/js/loading-states.js',
  '/css/pwa-install.css',
  '/css/loading-states.css',
  '/firebase/firebase-config.js',
  '/manifest.json',
  '/favicon.ico',
];

// Firebase auth & write endpoints must always go to network (no cache)
const NETWORK_ONLY_DOMAINS = [
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'generativelanguage.googleapis.com', // Gemini AI
];

// API domains that can be cached temporarily with stale-while-revalidate
const CACHEABLE_API_DOMAINS = [
  'api.coingecko.com',
  'query2.finance.yahoo.com',
  'api.allorigins.win',
  'corsproxy.io',
  'api.exchangerate-api.com',
];

// Firebase read operations can be cached briefly
const FIREBASE_READ_DOMAINS = [
  'firestore.googleapis.com',
];

// ── Install: pre-cache app shell ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each file individually — don't fail everything if one 404s
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Failed to cache:', url, e))
        )
      );
    }).then(() => {
      console.log('[SW] App shell cached');
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────────
self.addEventListener('activate', event => {
  const validCaches = [CACHE_NAME, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Take control of all open tabs
  );
});

// ── Fetch: hybrid caching strategy ──────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // 1. Network-only for auth & AI endpoints
  if (NETWORK_ONLY_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Stale-While-Revalidate for price APIs
  if (CACHEABLE_API_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 3. Network-first with cache fallback for Firebase reads
  if (FIREBASE_READ_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(networkFirstWithCache(event.request));
    return;
  }

  // 4. Cache-first for app shell (HTML, CSS, JS, images)
  event.respondWith(cacheFirstWithNetworkFallback(event.request));
});

// ── Cache Strategies ─────────────────────────────────────────────

/**
 * Stale-While-Revalidate: Serve from cache, update in background
 * Perfect for price data that changes but stale data is acceptable
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  // Fetch in background to update cache
  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached immediately if available and fresh enough
  if (cached) {
    const cachedDate = new Date(cached.headers.get('sw-cached-date') || 0);
    const age = Date.now() - cachedDate.getTime();
    
    if (age < API_CACHE_DURATION) {
      return cached;
    }
  }

  // If no valid cache, wait for network
  return fetchPromise || cached || new Response('Offline', { status: 503 });
}

/**
 * Network-First with Cache Fallback
 * Try network, use cache only if offline
 */
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Cache-First with Network Fallback
 * Serve from cache if available, fetch if not
 */
async function cacheFirstWithNetworkFallback(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // For HTML pages, return cached index as fallback
    if (request.destination === 'document') {
      const indexCache = await caches.match('/index.html');
      if (indexCache) {
        return indexCache;
      }
    }
    throw error;
  }
}

// ── Message Handler (for manual cache refresh) ──────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(API_CACHE),
        caches.delete(RUNTIME_CACHE),
      ]).then(() => {
        event.ports[0].postMessage({ cleared: true });
      })
    );
  }
});

console.log('[SW] Service worker loaded — PORTFOLIO.SYS v6 (Enhanced Offline)');
