/**
 * ══════════════════════════════════════════
 * SW.JS — PORTFOLIO.SYS Service Worker
 * ══════════════════════════════════════════
 * Strategy:
 *   - App shell (HTML, CSS, JS, fonts) → Cache First
 *   - API calls (CoinGecko, Yahoo, Firebase) → Network Only
 *   - On install: pre-cache all app shell files
 *   - On activate: delete old caches
 */

const CACHE_NAME = 'portfolio-sys-v5';

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
  '/js/gemini.js',
  '/js/gemini-ui.js',
  '/js/import-parsers.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/parsers/binance.js',
  '/js/parsers/parser-utils.js',
  '/js/parsers/savings.js',
  '/js/parsers/stock.js',
  '/js/parsers/tokocrypto.js',
  '/firebase/firebase-config.js',
];

// Domains that should NEVER be served from cache (live data APIs)
const NETWORK_ONLY_DOMAINS = [
  'api.coingecko.com',
  'query2.finance.yahoo.com',
  'api.allorigins.win',
  'corsproxy.io',
  'api.exchangerate-api.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'generativelanguage.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
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
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Take control of all open tabs
  );
});

// ── Fetch: cache-first for app shell, network-only for APIs ──────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-only for all external APIs and auth endpoints
  if (NETWORK_ONLY_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) return;

  // Cache-first for everything else (app shell)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network and cache for next time
      return fetch(event.request).then(response => {
        // Only cache successful same-origin responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline and not cached — for HTML pages return the cached index
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

console.log('[SW] Service worker loaded — PORTFOLIO.SYS v1');
