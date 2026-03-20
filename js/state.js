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
  goalTarget: 2_000_000_000,
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
    // ── Bitcoin (3 platforms)
    { id: uid(), coin: 'BTC', name: 'Bitcoin', amount: 0.085, platform: 'floq',    costBasisIdr: 178_000_000, date: '2023-08-10' },
    { id: uid(), coin: 'BTC', name: 'Bitcoin', amount: 0.032, platform: 'pintu',   costBasisIdr:  58_000_000, date: '2023-12-01' },
    { id: uid(), coin: 'BTC', name: 'Bitcoin', amount: 0.015, platform: 'indodax', costBasisIdr:  24_500_000, date: '2024-03-20' },
    // ── Ethereum (2 platforms)
    { id: uid(), coin: 'ETH', name: 'Ethereum', amount: 1.50, platform: 'floq',  costBasisIdr: 60_000_000, date: '2023-09-15' },
    { id: uid(), coin: 'ETH', name: 'Ethereum', amount: 0.60, platform: 'triv',  costBasisIdr: 21_000_000, date: '2024-01-22' },
    // ── XRP
    { id: uid(), coin: 'XRP', name: 'XRP', amount: 2500, platform: 'pintu', costBasisIdr: 16_000_000, date: '2024-02-14' },
    // ── Altcoins
    { id: uid(), coin: 'SOL', name: 'Solana',   amount: 12,      platform: 'pintu',   costBasisIdr: 28_000_000, date: '2024-03-01' },
    { id: uid(), coin: 'BNB', name: 'BNB',      amount: 2.5,     platform: 'binance', costBasisIdr: 18_500_000, date: '2024-01-05' },
    { id: uid(), coin: 'ADA', name: 'Cardano',  amount: 8000,    platform: 'indodax', costBasisIdr:  9_600_000, date: '2023-11-08' },
    { id: uid(), coin: 'DOGE', name: 'Dogecoin', amount: 15000,  platform: 'pintu',   costBasisIdr:  7_200_000, date: '2024-04-01' },
    { id: uid(), coin: 'AVAX', name: 'Avalanche', amount: 30,    platform: 'floq',    costBasisIdr: 11_000_000, date: '2024-02-28' },
  ],
  gold: [
    { id: uid(), name: 'Antam 25g Bar',   grams: 25, costBasisPerGram: 1_100_000, date: '2022-11-05' },
    { id: uid(), name: 'Antam 10g Bar',   grams: 10, costBasisPerGram: 1_250_000, date: '2023-05-12' },
    { id: uid(), name: 'Antam 10g Bar',   grams: 10, costBasisPerGram: 1_310_000, date: '2023-10-30' },
    { id: uid(), name: 'Antam 5g Bar',    grams:  5, costBasisPerGram: 1_280_000, date: '2023-08-21' },
    { id: uid(), name: 'Antam 5g Bar',    grams:  5, costBasisPerGram: 1_390_000, date: '2024-04-15' },
    { id: uid(), name: 'Antam 2g Bar',    grams:  2, costBasisPerGram: 1_350_000, date: '2024-01-11' },
    { id: uid(), name: 'Antam 1g Koin',   grams:  1, costBasisPerGram: 1_420_000, date: '2024-06-01' },
  ],
  stocks: [
    // ── IDX Blue Chips
    { id: uid(), ticker: 'BBCA', name: 'Bank Central Asia Tbk',       shares: 5, seedPrice: 9200,  broker: 'bibit',       market: 'IDX', date: '2023-07-10', annualYield: 2.1 },
    { id: uid(), ticker: 'BBRI', name: 'Bank Rakyat Indonesia Tbk',   shares: 8, seedPrice: 4120,  broker: 'bibit',       market: 'IDX', date: '2023-09-20', annualYield: 6.0 },
    { id: uid(), ticker: 'BMRI', name: 'Bank Mandiri Tbk',            shares: 6, seedPrice: 6050,  broker: 'stockbit',    market: 'IDX', date: '2023-11-01', annualYield: 5.2 },
    { id: uid(), ticker: 'TLKM', name: 'Telkom Indonesia Tbk',        shares: 10, seedPrice: 3850, broker: 'indopremier', market: 'IDX', date: '2023-12-05', annualYield: 5.8 },
    { id: uid(), ticker: 'ASII', name: 'Astra International Tbk',     shares: 5, seedPrice: 4550,  broker: 'bibit',       market: 'IDX', date: '2024-01-20', annualYield: 4.2 },
    { id: uid(), ticker: 'GOTO', name: 'GoTo Gojek Tokopedia Tbk',    shares: 20, seedPrice: 68,   broker: 'stockbit',    market: 'IDX', date: '2024-02-10', annualYield: 0   },
    { id: uid(), ticker: 'UNVR', name: 'Unilever Indonesia Tbk',      shares: 4, seedPrice: 2600,  broker: 'indopremier', market: 'IDX', date: '2024-03-05', annualYield: 7.5 },
    // ── US Stocks
    { id: uid(), ticker: 'AAPL', name: 'Apple Inc.',       shares: 5,  seedPrice: 185,  broker: 'pluang', market: 'US', date: '2023-10-01', annualYield: 0.5 },
    { id: uid(), ticker: 'MSFT', name: 'Microsoft Corp.',  shares: 3,  seedPrice: 330,  broker: 'pluang', market: 'US', date: '2023-10-15', annualYield: 0.8 },
    { id: uid(), ticker: 'NVDA', name: 'NVIDIA Corp.',     shares: 4,  seedPrice: 480,  broker: 'pluang', market: 'US', date: '2024-01-08', annualYield: 0.03},
    { id: uid(), ticker: 'TSLA', name: 'Tesla Inc.',       shares: 3,  seedPrice: 250,  broker: 'pluang', market: 'US', date: '2024-01-10', annualYield: 0   },
    { id: uid(), ticker: 'AMZN', name: 'Amazon.com Inc.', shares: 2,  seedPrice: 178,  broker: 'pluang', market: 'US', date: '2024-02-20', annualYield: 0   },
    // ── Index / ETF
    { id: uid(), ticker: '^IHSG', name: 'IHSG Index (RDPU)', shares: 1, seedPrice: 7200, broker: 'bibit', market: 'IDX', date: '2023-09-01', annualYield: 3.5 },
  ],
  savings: [
    // ── IDR accounts
    { id: uid(), name: 'BCA Tabungan',         bank: 'bca',     currency: 'IDR', foreignAmt: 75_000_000, idr: 75_000_000, note: 'Dana darurat', date: '2022-06-01', annualYield: 1.5 },
    { id: uid(), name: 'BRI Tabungan',          bank: 'bri',     currency: 'IDR', foreignAmt: 18_500_000, idr: 18_500_000, note: '',             date: '2023-03-15', annualYield: 2.0 },
    { id: uid(), name: 'Mandiri Giro',          bank: 'mandiri', currency: 'IDR', foreignAmt: 22_000_000, idr: 22_000_000, note: 'Operasional',  date: '2023-07-20', annualYield: 0.5 },
    { id: uid(), name: 'BNI Deposito 6 bln',   bank: 'bni',     currency: 'IDR', foreignAmt: 30_000_000, idr: 30_000_000, note: '5% p.a.',      date: '2024-01-01', annualYield: 5.0 },
    { id: uid(), name: 'Krom Deposito',         bank: 'krom',    currency: 'IDR', foreignAmt: 15_000_000, idr: 15_000_000, note: '6.5% p.a.',    date: '2024-04-05', annualYield: 6.5 },
    // ── Foreign currency accounts
    { id: uid(), name: 'BCA USD Savings',       bank: 'bca',     currency: 'USD', foreignAmt: 2500,  idr: 40_500_000, note: '', date: '2023-11-10', annualYield: 4.5 },
    { id: uid(), name: 'OCBC SGD Savings',      bank: 'ocbc',    currency: 'SGD', foreignAmt: 1200,  idr: 14_400_000, note: '', date: '2024-02-14', annualYield: 3.2 },
    { id: uid(), name: 'BCA AUD Savings',       bank: 'bca',     currency: 'AUD', foreignAmt: 1800,  idr: 18_540_000, note: '', date: '2024-03-22', annualYield: 3.8 },
    // ── Cash
    { id: uid(), name: 'Dana Tunai',            bank: 'cash',    currency: 'IDR', foreignAmt: 5_000_000, idr: 5_000_000, note: 'Di brankas', date: '2024-01-01', annualYield: 0 },
  ],
  history: [
    // 14 months of weekly-ish snapshots (Jan 2025 → Mar 2026)
    { date: '2025-01-03', value:  820_000_000 },
    { date: '2025-01-10', value:  845_000_000 },
    { date: '2025-01-17', value:  838_000_000 },
    { date: '2025-01-24', value:  862_000_000 },
    { date: '2025-02-01', value:  878_000_000 },
    { date: '2025-02-08', value:  855_000_000 },
    { date: '2025-02-15', value:  891_000_000 },
    { date: '2025-02-22', value:  910_000_000 },
    { date: '2025-03-01', value:  935_000_000 },
    { date: '2025-03-08', value:  920_000_000 },
    { date: '2025-03-15', value:  948_000_000 },
    { date: '2025-03-22', value:  972_000_000 },
    { date: '2025-03-29', value:  965_000_000 },
    { date: '2025-04-05', value:  990_000_000 },
    { date: '2025-04-12', value: 1_015_000_000 },
    { date: '2025-04-19', value: 1_002_000_000 },
    { date: '2025-04-26', value: 1_038_000_000 },
    { date: '2025-05-03', value: 1_055_000_000 },
    { date: '2025-05-10', value: 1_070_000_000 },
    { date: '2025-05-17', value: 1_048_000_000 },
    { date: '2025-05-24', value: 1_080_000_000 },
    { date: '2025-05-31', value: 1_095_000_000 },
    { date: '2025-06-07', value: 1_120_000_000 },
    { date: '2025-06-14', value: 1_105_000_000 },
    { date: '2025-06-21', value: 1_138_000_000 },
    { date: '2025-06-28', value: 1_160_000_000 },
    { date: '2025-07-05', value: 1_145_000_000 },
    { date: '2025-07-12', value: 1_175_000_000 },
    { date: '2025-07-19', value: 1_195_000_000 },
    { date: '2025-07-26', value: 1_210_000_000 },
    { date: '2025-08-02', value: 1_185_000_000 },
    { date: '2025-08-09', value: 1_220_000_000 },
    { date: '2025-08-16', value: 1_245_000_000 },
    { date: '2025-08-23', value: 1_230_000_000 },
    { date: '2025-08-30', value: 1_260_000_000 },
    { date: '2025-09-06', value: 1_285_000_000 },
    { date: '2025-09-13', value: 1_270_000_000 },
    { date: '2025-09-20', value: 1_305_000_000 },
    { date: '2025-09-27', value: 1_330_000_000 },
    { date: '2025-10-04', value: 1_310_000_000 },
    { date: '2025-10-11', value: 1_350_000_000 },
    { date: '2025-10-18', value: 1_375_000_000 },
    { date: '2025-10-25', value: 1_360_000_000 },
    { date: '2025-11-01', value: 1_395_000_000 },
    { date: '2025-11-08', value: 1_420_000_000 },
    { date: '2025-11-15', value: 1_408_000_000 },
    { date: '2025-11-22', value: 1_445_000_000 },
    { date: '2025-11-29', value: 1_468_000_000 },
    { date: '2025-12-06', value: 1_450_000_000 },
    { date: '2025-12-13', value: 1_490_000_000 },
    { date: '2025-12-20', value: 1_520_000_000 },
    { date: '2025-12-27', value: 1_505_000_000 },
    { date: '2026-01-03', value: 1_545_000_000 },
    { date: '2026-01-10', value: 1_570_000_000 },
    { date: '2026-01-17', value: 1_555_000_000 },
    { date: '2026-01-24', value: 1_595_000_000 },
    { date: '2026-02-01', value: 1_620_000_000 },
    { date: '2026-02-08', value: 1_605_000_000 },
    { date: '2026-02-15', value: 1_648_000_000 },
    { date: '2026-02-22', value: 1_672_000_000 },
    { date: '2026-03-01', value: 1_658_000_000 },
    { date: '2026-03-08', value: 1_695_000_000 },
    { date: '2026-03-15', value: 1_720_000_000 },
    { date: '2026-03-18', value: 1_735_000_000 },
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
  txLog: [
    { id: uid(), ts: '2026-03-15T09:12:00Z', action: 'buy',    type: 'crypto',  name: 'AVAX',  detail: 'Beli 30 AVAX @ Rp 367.000/koin via Floq',            snapshot: null },
    { id: uid(), ts: '2026-03-10T14:30:00Z', action: 'buy',    type: 'stocks',  name: 'AMZN',  detail: 'Beli 2 saham AMZN @ $178 via Pluang',                 snapshot: null },
    { id: uid(), ts: '2026-02-28T10:00:00Z', action: 'add',    type: 'savings', name: 'Krom',  detail: 'Top-up Krom Deposito Rp 5.000.000',                   snapshot: null },
    { id: uid(), ts: '2026-02-14T08:45:00Z', action: 'buy',    type: 'crypto',  name: 'XRP',   detail: 'Beli 2.500 XRP @ Rp 6.400/koin via Pintu',            snapshot: null },
    { id: uid(), ts: '2026-01-22T11:20:00Z', action: 'buy',    type: 'stocks',  name: 'NVDA',  detail: 'Beli 4 saham NVDA @ $480 via Pluang',                 snapshot: null },
    { id: uid(), ts: '2026-01-10T09:00:00Z', action: 'buy',    type: 'gold',    name: 'Antam', detail: 'Beli Antam 1g Koin @ Rp 1.420.000/gram',              snapshot: null },
    { id: uid(), ts: '2025-12-05T15:00:00Z', action: 'buy',    type: 'crypto',  name: 'SOL',   detail: 'Beli 12 SOL @ Rp 2.333.333/koin via Pintu',           snapshot: null },
    { id: uid(), ts: '2025-11-20T10:30:00Z', action: 'buy',    type: 'stocks',  name: 'GOTO',  detail: 'Beli 20 lot GOTO @ Rp 68/saham via Stockbit',         snapshot: null },
    { id: uid(), ts: '2025-10-15T13:00:00Z', action: 'add',    type: 'savings', name: 'BCA',   detail: 'Top-up BCA USD Savings $500',                         snapshot: null },
    { id: uid(), ts: '2025-09-01T09:15:00Z', action: 'buy',    type: 'gold',    name: 'Antam', detail: 'Beli Antam 5g Bar @ Rp 1.390.000/gram',               snapshot: null },
    { id: uid(), ts: '2025-08-10T11:00:00Z', action: 'buy',    type: 'crypto',  name: 'DOGE',  detail: 'Beli 15.000 DOGE @ Rp 480/koin via Pintu',            snapshot: null },
    { id: uid(), ts: '2025-07-20T14:00:00Z', action: 'buy',    type: 'stocks',  name: 'UNVR',  detail: 'Beli 4 lot UNVR @ Rp 2.600/saham via Indopremier',   snapshot: null },
  ]
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
