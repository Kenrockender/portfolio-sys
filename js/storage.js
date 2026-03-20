/**
 * ══════════════════════════════════════════
 * STORAGE.JS - Data Operations
 * ══════════════════════════════════════════
 * Contains all data computation and metrics functions
 */

import { S, DATA } from './state.js';
import { PLAT_COLORS, STOCK_FEES, CRYPTO_FEES } from './config.js';

// ── Currency Display Helpers ─────────────────────────────────────
export function toDisp(idr) {
  if (S.currency === 'USD') {
    const v = idr / S.usdIdr;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `$${v.toFixed(2)}`;
  }
  if (idr >= 1e9) return `Rp ${(idr / 1e9).toFixed(2)}B`;
  if (idr >= 1e6) return `Rp ${(idr / 1e6).toFixed(2)}Jt`;
  return `Rp ${Math.round(idr).toLocaleString('id-ID')}`;
}

export function dispPrice(idr) {
  if (S.currency === 'USD') {
    const v = idr / S.usdIdr;
    return v >= 1000 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${v.toFixed(2)}`;
  }
  return `Rp ${Math.round(idr).toLocaleString('id-ID')}`;
}

export function formatChartY(v) {
  if (v === 0) return '0';
  if (S.currency === 'USD') {
    const d = v / S.usdIdr;
    if (d >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
    if (d >= 1e3) return `$${(d / 1000).toFixed(1)}k`;
    return `$${d.toFixed(0)}`;
  }
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}Jt`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}Rb`;
  return v.toString();
}

export function dispForeign(amt, ccy) {
  const fmt = n => n.toLocaleString('en-US', {
    minimumFractionDigits: ccy === 'JPY' ? 0 : 2,
    maximumFractionDigits: ccy === 'JPY' ? 0 : 2
  });
  return `${ccy} ${fmt(amt)}`;
}

// ── [Fix 15] savingsIdr — computed on-the-fly, tidak mutate DATA ──
// Sebelumnya refreshSavingsIdr() menulis a.idr langsung ke DATA setiap
// totals() dipanggil (termasuk dari dalam loop chart). Sekarang hanya
// dihitung saat dibutuhkan tanpa side-effect.
export function savingsIdr(a) {
  if (a.currency === 'IDR') return a.foreignAmt ?? a.idr ?? 0;
  return (a.foreignAmt ?? 0) * (S.fxRates[a.currency] ?? 1);
}

// Tetap ada untuk backward-compat (dipanggil sebelum saveDataToCloud)
export function refreshSavingsIdr() {
  DATA.savings.forEach(a => { a.idr = savingsIdr(a); });
}

// ── Stock Price Helper ───────────────────────────────────────────
export function stockPrice(h) {
  return S.stockPrices[h.ticker] ?? h.seedPrice;
}

// ── Stock Lot Multiplier ─────────────────────────────────────────
// IDX: 1 lot = 100 shares, EXCEPT index tickers (^IHSG etc.) which
// represent index levels, not tradable lots — use multiplier 1.
export function stockMul(h) {
  return (h.market === 'IDX' && !h.ticker?.startsWith('^')) ? 100 : 1;
}

// ── Crypto Price Helper ──────────────────────────────────────────
export function cryptoPrice(a) {
  const coin = (a.coin || '').toUpperCase();
  if (coin === 'BTC') return S.btcIdr || 0;
  if (coin === 'ETH') return S.ethIdr || 0;
  if (coin === 'XRP') return S.xrpIdr || 0;
  // [Fix 1] Altcoin fallback
  const alt = S.altcoinPrices?.[coin];
  if (alt > 0) return alt;
  return 0;
}

export function hasCryptoPrice(coin) {
  const c = coin.toUpperCase();
  if (c === 'BTC' && S.btcIdr > 0) return true;
  if (c === 'ETH' && S.ethIdr > 0) return true;
  if (c === 'XRP' && S.xrpIdr > 0) return true;
  if (S.altcoinPrices?.[c] > 0) return true;
  return false;
}

// ── Totals Calculation ───────────────────────────────────────────
// [Fix 15] pakai savingsIdr() bukan a.idr langsung
export function totals() {
  const c  = DATA.crypto.reduce((s, a) => s + a.amount * cryptoPrice(a), 0);
  const g  = DATA.gold.reduce((s, h) => s + h.grams * S.goldGramIdr, 0);
  const k  = DATA.stocks.reduce((s, h) => s + h.shares * stockMul(h) * stockPrice(h), 0);
  const sv = DATA.savings.reduce((s, a) => s + savingsIdr(a), 0);
  return { c, g, k, sv, t: c + g + k + sv };
}

// ── Metrics Computation ──────────────────────────────────────────
export function computeMetrics(T) {
  const cryptoCost = DATA.crypto.reduce((s, a) => s + (a.costBasisIdr ?? 0), 0);
  const goldCost = DATA.gold.reduce((s, h) => s + h.grams * (h.costBasisPerGram ?? 0), 0);
  const stocksCost = DATA.stocks.reduce((s, h) => s + h.shares * stockMul(h) * h.seedPrice, 0);
  const totalCost = cryptoCost + goldCost + stocksCost;

  const mkPnl = (val, cost) => cost > 0 ? val - cost : null;
  const mkRet = (pnl, cost) => cost > 0 ? pnl / cost * 100 : null;

  const cp = mkPnl(T.c, cryptoCost), cr = mkRet(cp, cryptoCost);
  const gp = mkPnl(T.g, goldCost), gr = mkRet(gp, goldCost);
  const kp = mkPnl(T.k, stocksCost), kr = mkRet(kp, stocksCost);
  const tp = mkPnl(T.t, totalCost), tr = mkRet(tp, totalCost);

  return {
    crypto: { cost: cryptoCost, val: T.c, pnl: cp, ret: cr },
    gold: { cost: goldCost, val: T.g, pnl: gp, ret: gr },
    stocks: { cost: stocksCost, val: T.k, pnl: kp, ret: kr },
    total: { cost: totalCost, val: T.t, pnl: tp, ret: tr }
  };
}

// ── Asset Metrics ────────────────────────────────────────────────
export function assetMetrics(type, item) {
  if (type === 'crypto') {
    const val = item.amount * cryptoPrice(item), cost = item.costBasisIdr ?? 0;
    const pnl = cost > 0 ? val - cost : null, ret = cost > 0 ? pnl / cost * 100 : null;
    return { cost, val, pnl, ret };
  }
  if (type === 'gold') {
    const val = item.grams * S.goldGramIdr, cost = item.grams * (item.costBasisPerGram ?? 0);
    const pnl = cost > 0 ? val - cost : null, ret = cost > 0 ? pnl / cost * 100 : null;
    return { cost, val, pnl, ret };
  }
  if (type === 'stocks') {
    const mul = stockMul(item);
    const val = item.shares * mul * stockPrice(item), cost = item.shares * mul * item.seedPrice;
    const pnl = cost > 0 ? val - cost : null, ret = cost > 0 ? pnl / cost * 100 : null;
    return { cost, val, pnl, ret };
  }
  // savings — [Fix 15] pakai savingsIdr()
  const idr = savingsIdr(item);
  return { cost: idr, val: idr, pnl: null, ret: null };
}

// ── Tax Calculation ──────────────────────────────────────────────
export function calcStockFees(value, broker, type = 'buy', applyStampDuty = false) {
  const fees = STOCK_FEES[broker] || STOCK_FEES.other;
  const feeRate = type === 'buy' ? fees.buy : fees.sell;
  const fee = Math.round(value * feeRate);
  const stampDuty = applyStampDuty && value > STOCK_FEES.stampDutyThreshold ? STOCK_FEES.stampDutyFee : 0;
  let usFees = 0;
  if (broker === 'pluang' && fees.usSecFee) {
    usFees = Math.round(value * (fees.usSecFee + fees.usTafFee));
  }
  return { fee, stampDuty, usFees, total: fee + stampDuty + usFees };
}

export function calcCryptoFees(value, platform, type = 'buy', applyStampDuty = false) {
  const platformFees = CRYPTO_FEES[platform] || CRYPTO_FEES.other;
  let platformFee = 0;
  if (platformFees.fee !== undefined) {
    platformFee = Math.round(value * platformFees.fee);
  } else if (platformFees.taker !== undefined) {
    platformFee = Math.round(value * platformFees.taker);
  } else if (platformFees.spreadMin !== undefined) {
    const avgSpread = (platformFees.spreadMin + platformFees.spreadMax) / 2;
    platformFee = Math.round(value * avgSpread);
  }
  const pph22 = Math.round(value * CRYPTO_FEES.pph22);
  const stampDuty = applyStampDuty && value > CRYPTO_FEES.stampDutyThreshold ? CRYPTO_FEES.stampDutyFee : 0;
  return { platformFee, pph22, stampDuty, total: platformFee + pph22 + stampDuty };
}

export function applyTax(pnl, type, asset = null) {
  if (S.taxMode === 'pre' || pnl == null) return pnl;
  if (pnl <= 0) return pnl;
  if (type === 'stocks' && asset) {
    const currentValue = asset.shares * stockMul(asset) * stockPrice(asset);
    const fees = calcStockFees(currentValue, asset.broker || 'other', 'sell', true);
    return pnl - fees.total;
  }
  if (type === 'crypto' && asset) {
    const currentValue = asset.amount * cryptoPrice(asset);
    const fees = calcCryptoFees(currentValue, asset.platform || 'other', 'sell', true);
    return pnl - fees.total;
  }
  if (type === 'savings') return pnl * 0.80;
  return pnl;
}

export function assetMetricsWithTax(type, item) {
  const basic = assetMetrics(type, item);
  if (!basic.pnl) return { ...basic, pnlPostTax: null, retPostTax: null };
  const pnlPostTax = applyTax(basic.pnl, type, item);
  const retPostTax = basic.cost > 0 ? (pnlPostTax / basic.cost * 100) : null;
  return { ...basic, pnlPostTax, retPostTax };
}

// ── Annual Income Computation ─────────────────────────────────────
export function computeAnnualIncome() {
  let stocksIncome = 0, savingsIncome = 0;
  DATA.stocks.forEach(h => {
    const val = h.shares * stockMul(h) * stockPrice(h);
    stocksIncome += val * ((h.annualYield || 0) / 100);
  });
  DATA.savings.forEach(a => {
    savingsIncome += savingsIdr(a) * ((a.annualYield || 0) / 100);  // [Fix 15]
  });
  return { stocks: stocksIncome, savings: savingsIncome, total: stocksIncome + savingsIncome };
}

// ── Portfolio Analytics Computation ───────────────────────────────
export function computePortfolioAnalytics() {
  const hist = [...(S.historyData || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (hist.length < 2) return null;

  const values = hist.map(h => h.value);
  const dailyReturns = [];
  for (let i = 1; i < values.length; i++) {
    dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
  }

  const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length || 0;
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanDaily, 2), 0) / dailyReturns.length || 0;
  const stdDaily = Math.sqrt(variance) || 0;
  const annualVol = stdDaily * Math.sqrt(252) * 100;
  const sharpe = (meanDaily / stdDaily * Math.sqrt(252)) || 0;
  const totalReturn = values.length > 0 ? ((values[values.length - 1] / values[0]) - 1) * 100 : 0;

  let maxDD = 0, peak = values[0] || 0;
  for (let v of values) {
    peak = Math.max(peak, v);
    maxDD = Math.min(maxDD, (v - peak) / peak);
  }
  maxDD = maxDD * 100;

  const dailyChange = hist.length > 1
    ? ((values[values.length - 1] - values[values.length - 2]) / values[values.length - 2] * 100) : 0;
  const weeklyIdx = Math.max(0, values.length - 7);
  const weeklyChange = weeklyIdx < values.length - 1
    ? ((values[values.length - 1] - values[weeklyIdx]) / values[weeklyIdx] * 100) : 0;
  const bestDay = dailyReturns.length ? Math.max(...dailyReturns) * 100 : 0;
  const worstDay = dailyReturns.length ? Math.min(...dailyReturns) * 100 : 0;

  return {
    annualVol, sharpe, maxDD: Math.abs(maxDD),
    totalReturn, bestDay, worstDay,
    dailyChange, weeklyChange,
    dataPoints: hist.length
  };
}

// ── Filter Assets ─────────────────────────────────────────────────
export function filterAssets(assets, type) {
  return assets.filter(a => {
    const q = S.searchQuery.toLowerCase();
    let nameMatch = true;
    if (q) {
      const ticker = (a.ticker || a.coin || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      nameMatch = ticker.startsWith(q) || ticker.includes(q) || name.includes(q);
    }
    let platMatch = true;
    if (S.filterPlatform) {
      if (type === 'crypto') platMatch = a.platform === S.filterPlatform;
      if (type === 'gold') platMatch = 'physical' === S.filterPlatform;
      if (type === 'stocks') platMatch = a.broker === S.filterPlatform;
      if (type === 'savings') platMatch = a.bank === S.filterPlatform;
    }
    return nameMatch && platMatch;
  });
}

console.log('[STORAGE] Storage operations loaded');

// [Fix 7] Daftarkan totals ke window agar firebase-config.js bisa
// memanggil tanpa circular dynamic import.
window._getTotals = totals;
