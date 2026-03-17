/**
 * ══════════════════════════════════════════
 * STATE.JS - State Management
 * ══════════════════════════════════════════
 * Contains all application state and data
 */

import { I18N } from './config.js';

// ── UID Generator ───────────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Application State ────────────────────────────────────────────
export const S = {
  currency: 'IDR',
  historyRange: '6M',
  theme: 'dark',
  lang: 'id',
  searchQuery: '',
  filterPlatform: '',
  benchTab: 'total',
  benchRange: '6M',
  taxMode: 'pre',
  isSyncing: false,
  usdIdr: 16_200,
  btcIdr: 1_590_000_000,
  ethIdr: 52_000_000,
  xrpIdr: 10_800,
  goldGramIdr: 1_680_000,
  stockPrices: {},
  altcoinPrices: {},
  fxRates: {
    USD: 16200, AUD: 10300, SGD: 12000, JPY: 107, HKD: 2070,
    EUR: 17600, GBP: 20400, NZD: 9600, CHF: 18200, CAD: 11800,
    CNH: 2230, IDR: 1
  },
  fxStatus: {
    USD: 'stale', AUD: 'stale', SGD: 'stale', JPY: 'stale', HKD: 'stale',
    EUR: 'stale', GBP: 'stale', NZD: 'stale', CHF: 'stale', CAD: 'stale', CNH: 'stale'
  },
  status: { btc: 'stale', eth: 'stale', xrp: 'stale', gold: 'stale', fx: 'stale' },
  historyData: [],
  historyLoaded: false,
  goalTarget: 1_000_000_000,
  // Rebalancing targets — saved per user
  rebalTargets: {
    crypto: 40, gold: 15, stocks: 30, savings: 15,  // % target per asset class
    tickers: {}   // { 'BBCA': 10, 'BTC': 25, ... } % of total portfolio
  },
};

// ── Portfolio Data ───────────────────────────────────────────────
// [Fix 4] dividendsReceived dihapus dari mock data
//
// [Fix 8] Kenapa pakai _store wrapper?
// Semua modul melakukan: import { DATA } from './state.js'
// JS live binding hanya berlaku satu arah — jika setDATA() melakukan
// DATA = newData (reassign), modul lain tetap pegang referensi LAMA.
// Solusi: DATA selalu menunjuk ke _store.data yang tidak pernah
// di-reassign. setDATA() cukup mutate isinya di tempat.
const _store = { data: {
  crypto: [
    { id: uid(), coin: 'BTC', name: 'Bitcoin', amount: 0.045, platform: 'floq', costBasisIdr: 95_000_000, date: '2023-10-15' },
    { id: uid(), coin: 'BTC', name: 'Bitcoin', amount: 0.012, platform: 'triv', costBasisIdr: 23_500_000, date: '2023-11-20' },
    { id: uid(), coin: 'BTC', name: 'Bitcoin', amount: 0.020, platform: 'pintu', costBasisIdr: 38_000_000, date: '2023-12-01' },
    { id: uid(), coin: 'ETH', name: 'Ethereum', amount: 0.80, platform: 'floq', costBasisIdr: 33_000_000, date: '2024-01-05' },
    { id: uid(), coin: 'ETH', name: 'Ethereum', amount: 0.25, platform: 'triv', costBasisIdr: 10_000_000, date: '2024-02-10' },
    { id: uid(), coin: 'XRP', name: 'XRP', amount: 500, platform: 'pintu', costBasisIdr: 7_500_000, date: '2024-03-15' },
  ],
  gold: [
    { id: uid(), name: 'Antam 10g Bar', grams: 10, costBasisPerGram: 1_250_000, date: '2023-05-12' },
    { id: uid(), name: 'Antam 5g Bar', grams: 5, costBasisPerGram: 1_280_000, date: '2023-08-21' },
    { id: uid(), name: 'Antam 2g Bar', grams: 2, costBasisPerGram: 1_350_000, date: '2024-01-11' },
  ],
  stocks: [
    { id: uid(), ticker: 'BBCA', name: 'Bank Central Asia Tbk', shares: 2, seedPrice: 9200, broker: 'bibit', market: 'IDX', date: '2023-11-12', annualYield: 2.1 },
    { id: uid(), ticker: 'TLKM', name: 'Telkom Indonesia Tbk', shares: 5, seedPrice: 3850, broker: 'indopremier', market: 'IDX', date: '2023-12-05', annualYield: 5.8 },
    { id: uid(), ticker: 'ASII', name: 'Astra International Tbk', shares: 3, seedPrice: 4550, broker: 'bibit', market: 'IDX', date: '2024-01-20', annualYield: 4.2 },
    { id: uid(), ticker: 'BBRI', name: 'Bank Rakyat Indonesia Tbk', shares: 4, seedPrice: 4120, broker: 'bibit', market: 'IDX', date: '2024-02-15', annualYield: 6.0 },
    { id: uid(), ticker: 'AAPL', name: 'Apple Inc.', shares: 3, seedPrice: 185, broker: 'other', market: 'US', date: '2023-10-01', annualYield: 0.5 },
    { id: uid(), ticker: 'TSLA', name: 'Tesla Inc.', shares: 2, seedPrice: 250, broker: 'other', market: 'US', date: '2024-01-10', annualYield: 0 },
    { id: uid(), ticker: '^IHSG', name: 'IHSG Index (RDPU)', shares: 1, seedPrice: 7200, broker: 'bibit', market: 'IDX', date: '2023-09-01', annualYield: 3.5 },
  ],
  savings: [
    { id: uid(), name: 'BCA Tabungan', bank: 'bca', currency: 'IDR', foreignAmt: 45_000_000, idr: 45_000_000, note: '', date: '2023-01-10', annualYield: 1.5 },
    { id: uid(), name: 'BRI Tabungan', bank: 'bri', currency: 'IDR', foreignAmt: 12_500_000, idr: 12_500_000, note: '', date: '2023-06-15', annualYield: 2.0 },
    { id: uid(), name: 'Krom Deposito', bank: 'krom', currency: 'IDR', foreignAmt: 10_000_000, idr: 10_000_000, note: '6% p.a.', date: '2024-01-05', annualYield: 6.0 },
    { id: uid(), name: 'USD Savings', bank: 'bca', currency: 'USD', foreignAmt: 1550, idr: 25_110_000, note: '', date: '2024-02-20', annualYield: 4.5 },
    { id: uid(), name: 'SGD Savings', bank: 'ocbc', currency: 'SGD', foreignAmt: 800, idr: 9_600_000, note: '', date: '2024-03-10', annualYield: 3.2 },
  ],
  history: [
    { date: '2025-02-01', value: 385000000 },
    { date: '2025-02-05', value: 392000000 },
    { date: '2025-02-10', value: 388000000 },
    { date: '2025-02-15', value: 401000000 },
    { date: '2025-02-20', value: 395000000 },
    { date: '2025-02-25', value: 410000000 },
    { date: '2025-03-01', value: 418000000 },
    { date: '2025-03-05', value: 425000000 },
    { date: '2025-03-10', value: 420000000 },
    { date: '2025-03-13', value: 432000000 },
  ],
  lastRates: {
    usdIdr: 16250,
    goldGramIdr: 1_685_000,
    btcIdr: 1_592_000_000,
    ethIdr: 52_300_000,
    xrpIdr: 10_850,
    fxRates: {
      IDR: 1, USD: 16250, AUD: 10_480, SGD: 12_050, JPY: 108,
      EUR: 17_650, GBP: 20_800, NZD: 9_650, CHF: 18_200, CAD: 11_850, CNH: 2_250
    },
    timestamp: Date.now()
  },
  txLog: []   // transaction audit log: { id, ts, action, type, name, detail, snapshot }
}};  // end _store.data

// DATA adalah referensi ke _store.data — tidak pernah di-reassign,
// sehingga semua importers selalu mendapat data terbaru.
export const DATA = _store.data;

// ── State Setters ────────────────────────────────────────────────
export function setDATA(newData) {
  // Mutate di tempat — jangan reassign, agar semua importers tetap sync
  Object.keys(_store.data).forEach(k => delete _store.data[k]);
  Object.assign(_store.data, newData);
}

export function setHistoryData(data) {
  S.historyData = data;
  S.historyLoaded = true;
}

export function setPrice(key, value) {
  if (key in S) {
    S[key] = value;
  }
}

export function setStockPrice(ticker, price) {
  S.stockPrices[ticker] = price;
}

// [Fix 1] Setter untuk altcoin prices (SOL, ADA, BNB, dll)
export function setAltcoinPrice(coin, priceIdr) {
  S.altcoinPrices[coin.toUpperCase()] = priceIdr;
}

export function setFxRate(ccy, rate) {
  S.fxRates[ccy] = rate;
}

export function setFxStatus(ccy, status) {
  S.fxStatus[ccy] = status;
}

export function setStatus(key, status) {
  S.status[key] = status;
}

// ── I18N Helper ──────────────────────────────────────────────────
export function t(key, vars = {}) {
  let str = (I18N[S.lang] || I18N.id)[key] || I18N.id[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(`{${k}}`, v);
  });
  return str;
}

console.log('[STATE] State management loaded');
