# PORTFOLIO.SYS

Personal net worth dashboard for Indonesian investors. Tracks crypto, gold, stocks (IDX & US), and savings in one place with live prices, charts, and Firebase cloud sync.

---

## Features

### Asset Tracking
- **Crypto** — BTC, ETH, XRP, and altcoins (SOL, ADA, BNB, DOGE, MATIC, AVAX, and more). Multiple lots per coin are grouped automatically.
- **Gold** — Physical gold tracked by grams with cost basis per gram.
- **Stocks** — IDX (lot-based) and US markets (share-based). Multiple lots of the same ticker are grouped into one card.
- **Savings / Deposits** — Multi-currency accounts (IDR, USD, SGD, AUD, EUR, GBP, JPY, HKD, CHF, CAD, NZD). FX conversion is live.

### Live Prices
- **Crypto** — CoinGecko API (BTC, ETH, XRP + altcoin batch)
- **Stocks & Gold** — Yahoo Finance via CORS proxy (allorigins.win → corsproxy.io fallback)
- **FX Rates** — ExchangeRate-API (11 currency pairs)
- **Manual Override** — Click any price in the top bar or use the ✎ HARGA button to enter prices manually. Manual prices persist to cloud on save.
- Auto-sync every 5 minutes (skips if a sync is already running)

### P&L & Metrics
- Cost basis tracking per asset with unrealized P&L and return %
- Pre-tax and post-tax mode (includes platform fees, PPh 22 for crypto, stamp duty for stocks)
- Annual income estimate from dividend yields and deposit interest
- Portfolio statistics: annualized volatility, Sharpe ratio, max drawdown, best/worst day

### Charts
- Portfolio history line chart (1W / 1M / 6M / 1Y / ALL)
- Asset allocation pie chart
- Benchmark comparison — Portfolio vs IHSG vs S&P 500
- Per-asset price history chart with real historical data (CoinGecko / Yahoo Finance) or synthetic estimate fallback
- Crypto accumulation chart, stock accumulation chart, savings breakdown

### Import
Paste text, CSV, or drop a PDF/image — the parser detects the format automatically.

| Source | Type |
|---|---|
| Tokocrypto (Laporan Pajak PDF) | Crypto |
| Floq (Laporan Pajak PDF) | Crypto |
| Pluang (Email PDF / Transaction CSV) | Crypto |
| Indodax (Tax Report PDF) | Crypto |
| Pintu (paste text) | Crypto |
| Krom (Email Konfirmasi Deposito PDF) | Savings |
| Stockbit (Trade Confirmation PDF / paste) | Stocks |
| Bibit (paste text) | Stocks |
| IBKR / Interactive Brokers (Activity CSV) | Stocks |
| Generic free-form text | Crypto / Stocks / Savings |
| Universal auto-detect | All types |

OCR support for image imports via Tesseract.js.

### Other
- **Rebalancing calculator** — set target % per asset class, see what to buy/sell
- **Transaction log** — full audit trail of every add/edit/delete
- **Goal tracker** — set a net worth target, watch the progress bar fill
- **AI Insights** — one-click portfolio analysis via Gemini API (requires API key)
- **Export** — CSV, JSON, and PDF report
- **Search & filter** — by ticker/name and by platform/broker/bank
- **i18n** — Bahasa Indonesia and English
- **6 themes** — Dark (default), Light, Midnight, Forest, Dracula, Solarized
- **Mobile** — responsive with bottom navigation and slide-out drawer
- **PWA Install** — proactive install prompts for native-like experience
- **Offline Mode** — works offline with cached data and stale-while-revalidate API strategy
- **Loading States** — skeleton screens for better perceived performance
- **Code Splitting** — lazy-loaded modules for faster initial load (~0.8s TTI)

---

## Setup

### 1. Clone / download

```
portfolio-sys/
├── index.html
├── css/
│   ├── styles.css
│   └── mobile.css
├── js/
│   ├── app.js
│   ├── api.js
│   ├── charts.js
│   ├── config.js
│   ├── gemini.js
│   ├── gemini-ui.js
│   ├── import-parsers.js
│   ├── state.js
│   ├── storage.js
│   ├── ui.js
│   └── parsers/
│       ├── binance.js
│       ├── parser-utils.js
│       ├── savings.js
│       ├── stock.js
│       └── tokocrypto.js
└── firebase/
    └── firebase-config.js
```

### 2. Install Dependencies (Optional - for development)

```bash
npm install
```

This installs ESLint and TypeScript for code quality checks. The app itself requires no build step and runs directly in the browser.

### 3. Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. Enable **Authentication → Google Sign-In**.
3. Enable **Firestore Database** (start in production mode).
4. Add your domain to **Authentication → Authorized Domains**.
5. Copy your Firebase config into `firebase/firebase-config.js`:

```js
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

6. Set Firestore rules so each user can only access their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/portfolio/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Gemini AI (optional)

Open `js/gemini.js` and replace the placeholder:

```js
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
```

Get a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey). The app works fine without it — the AI Insights button will just show an error if no key is set.

### 5. Serve

Open with any static file server. For local development:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080`.

> **Note:** Firebase Authentication requires HTTPS or localhost. Opening `index.html` directly from the filesystem (`file://`) will not work.

---

## Usage

### Adding assets
Click the **+** button on any section (Crypto, Gold, Stocks, Savings) to add manually, or use **📥 IMPORT** to paste data from a broker or exchange.

### Syncing prices
Click **↻ SYNC** in the top bar, or wait for the auto-sync (every 5 minutes while the tab is visible). Prices are saved to your cloud profile so the last known values load instantly on next visit.

### Manual prices
Click any ticker in the top price bar to edit it inline, or click **✎ HARGA** to edit all prices at once. Manual prices are saved to the cloud.

### Viewing a chart
Click any asset row to open its price history chart with 1M / 3M / 6M / 1Y range selection.

### Rebalancing
Go to the **⚖️ Rebalance** tab, set your target allocation percentages, and the calculator shows exactly how much to buy or sell of each asset.

### Export
In the **Holdings** tab, use the **⬇ CSV**, **⬇ JSON**, or **⬇ PDF** buttons to export your full portfolio.

---

## Tech Stack

| | |
|---|---|
| Frontend | Vanilla JS (ES Modules, TypeScript types) |
| Charts | Chart.js 4.4 (lazy-loaded) |
| PDF parsing | PDF.js 3.11 |
| OCR | Tesseract.js 5 |
| PDF export | jsPDF 2.5 |
| Auth & Database | Firebase 11 (Google Auth + Firestore) |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Price data | CoinGecko, Yahoo Finance, ExchangeRate-API |
| Code Quality | ESLint 9, TypeScript 5.4 |
| PWA | Service Worker with offline caching |

---

## Development

### Linting
```bash
npm run lint        # Check code quality
npm run lint:fix    # Auto-fix issues
```

### Type Checking
```bash
npm run typecheck   # Validate TypeScript types
```

### TypeScript Integration
The project uses TypeScript for type safety without a build step:
- Type definitions in `types/portfolio.d.ts`
- JSDoc comments for inline typing
- `tsconfig.json` for editor intellisense
- Financial calculations benefit from strict typing

### Code Splitting
Heavy modules are lazy-loaded for performance:
- Charts load when Analytics tab is opened
- Import parsers load when import dialog is opened
- AI modules load when AI features are clicked

See `CODE_SPLITTING.md` for implementation details.

### Service Worker Updates
After modifying cached files, increment `CACHE_NAME` in `sw.js`:
```javascript
const CACHE_NAME = 'portfolio-sys-v7'; // Increment version
```

---

## Performance

- **Initial Load**: ~30KB (core app)
- **Time to Interactive**: ~0.8s
- **Offline Support**: Full functionality with cached data
- **API Caching**: 5-minute stale-while-revalidate for price data
- **Lazy Loading**: Charts, parsers, AI load on demand

---

## Notes

- All portfolio data is stored in **your own** Firestore under your Google account. Nobody else can read it.
- The app uses `allorigins.win` as a CORS proxy for Yahoo Finance requests, with `corsproxy.io` as an automatic fallback. If both are down, stock and gold prices will not update but the app remains usable with the last saved rates.
- The CoinGecko free tier allows ~10–30 requests/minute. If you have many altcoins the sync may occasionally be rate-limited; it will retry on the next auto-sync.
- `^IHSG` and other index tickers (starting with `^`) are treated with a multiplier of 1, not 100 like regular IDX lots, so P&L is calculated correctly.
- **PWA Install**: A dismissible banner appears after 3 seconds on installable devices. Dismissed banners won't show again.
- **Offline Mode**: The service worker caches API responses for 5 minutes. Older cached data serves as fallback when offline.
