/**
 * ══════════════════════════════════════════
 * ML.JS — Portfolio Risk Scoring & Price Prediction
 * ══════════════════════════════════════════
 *
 * Two complementary layers:
 *   1. Quantitative (client-side): deterministic scoring from portfolio data
 *   2. AI Narrative (Claude API): rich language analysis + prediction rationale
 *
 * Risk Score: 0–100 (0 = minimal risk, 100 = extreme risk)
 * Prediction: directional signal + confidence + key drivers
 */

import { S, DATA } from './state.js';
import { totals, computeMetrics, savingsIdr, stockMul, cryptoPrice, stockPrice } from './storage.js';
import { toDisp } from './storage.js';

// ─────────────────────────────────────────
//  CLAUDE API CONFIG
// ─────────────────────────────────────────
const CLAUDE_URL   = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
function getClaudeApiKey() {
  return typeof window !== 'undefined' ? (window.CLAUDE_API_KEY || '') : '';
}

async function callClaude(prompt, maxTokens = 1200) {
  const CLAUDE_API_KEY = getClaudeApiKey();
  if (!CLAUDE_API_KEY) throw new Error('Claude API key not configured');
  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01', // Required stable version per Anthropic API docs
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return d.content?.map(b => b.text || '').join('') || '';
}

// ─────────────────────────────────────────
//  1. QUANTITATIVE RISK ENGINE
// ─────────────────────────────────────────

/**
 * Compute a deterministic portfolio risk score (0–100).
 * Higher = riskier.
 *
 * Sub-scores (each 0–100, then weighted):
 *   A. Concentration Risk (20%)
 *   B. Crypto Exposure   (20%)
 *   C. Volatility Risk   (20%)
 *   D. Diversification   (15%)
 *   E. P&L Drawdown      (10%)
 *   F. Currency Risk     (10%)
 *   G. Platform Risk     (5%)
 */
export function computeRiskScore() {
  const T = totals();
  const M = computeMetrics(T);

  if (T.t <= 0) return { total: 0, breakdown: {}, raw: {}, grade: 'N/A', color: '#64748b' };

  // ── A. Concentration Risk ──────────────────────────────────────
  // How much of the portfolio is in a single asset?
  const allAssets = [
    ...DATA.crypto.map(a => ({ val: a.amount * cryptoPrice(a), label: a.coin })),
    ...DATA.gold.map(h => ({ val: h.grams * S.goldGramIdr, label: h.name })),
    ...DATA.stocks.map(h => ({ val: h.shares * stockMul(h) * stockPrice(h), label: h.ticker })),
    ...DATA.savings.map(a => ({ val: savingsIdr(a), label: a.name })),
  ].filter(a => a.val > 0);

  const maxSinglePct = allAssets.length > 0
    ? Math.max(...allAssets.map(a => a.val / T.t)) * 100 : 0;
  const topAsset = allAssets.length > 0
    ? allAssets.reduce((m, a) => a.val > m.val ? a : m, allAssets[0]) : null;

  // Score: 0% → 0, 50%+ → 100
  const concentrationScore = Math.min(100, maxSinglePct * 2);

  // ── B. Crypto Exposure ─────────────────────────────────────────
  const cryptoPct = T.t > 0 ? (T.c / T.t) * 100 : 0;
  // 0% crypto → 0, 100% crypto → 100
  const cryptoScore = cryptoPct;

  // ── C. Historical Volatility ───────────────────────────────────
  const hist = [...(S.historyData || [])].sort((a, b) => a.date.localeCompare(b.date));
  let volScore = 50; // default if insufficient data
  let annualVol = null;
  if (hist.length >= 7) {
    const vals = hist.map(h => h.value);
    const returns = [];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i - 1] > 0) returns.push((vals[i] - vals[i - 1]) / vals[i - 1]);
    }
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stdDaily = Math.sqrt(variance);
    annualVol = stdDaily * Math.sqrt(252) * 100; // in %
    // <10% = 0, 10-30% = 0-60, 30-60% = 60-100, >60% = 100
    volScore = annualVol < 10 ? 0
      : annualVol < 30 ? ((annualVol - 10) / 20) * 60
      : annualVol < 60 ? 60 + ((annualVol - 30) / 30) * 40
      : 100;
  }

  // ── D. Diversification ─────────────────────────────────────────
  // Count how many asset classes have meaningful weight (>5%)
  const classWeights = [
    T.c / T.t, T.g / T.t, T.k / T.t, T.sv / T.t
  ].filter(w => w > 0.05);
  const numClasses = classWeights.length;
  // Herfindahl index (sum of squared weights) → lower is better
  const hhi = classWeights.reduce((s, w) => s + w * w, 0);
  // hhi 1.0 = fully concentrated (100), 0.25 = perfectly diversified (0)
  const diversificationScore = Math.min(100, Math.max(0, (hhi - 0.25) / 0.75 * 100));

  // ── E. Drawdown / P&L Health ───────────────────────────────────
  let drawdownScore = 30; // default
  if (hist.length >= 2) {
    const vals = hist.map(h => h.value);
    let peak = vals[0], maxDD = 0;
    for (const v of vals) {
      peak = Math.max(peak, v);
      if (peak > 0) maxDD = Math.max(maxDD, (peak - v) / peak);
    }
    // 0% drawdown → 0, 30%+ → 100
    drawdownScore = Math.min(100, maxDD * 333);
  }
  // Also factor in unrealized loss
  if (M.total.ret != null && M.total.ret < 0) {
    drawdownScore = Math.min(100, drawdownScore + Math.abs(M.total.ret));
  }

  // ── F. Currency Risk ───────────────────────────────────────────
  const foreignSavings = DATA.savings.filter(a => a.currency !== 'IDR');
  const foreignVal = foreignSavings.reduce((s, a) => s + savingsIdr(a), 0);
  const foreignPct = T.t > 0 ? (foreignVal / T.t) * 100 : 0;
  // Also count US stocks
  const usStocksVal = DATA.stocks
    .filter(h => h.market === 'US')
    .reduce((s, h) => s + h.shares * stockMul(h) * stockPrice(h), 0);
  const totalForeignPct = T.t > 0 ? ((foreignVal + usStocksVal) / T.t) * 100 : 0;
  // Moderate foreign = good, too high = risky (IDR investor)
  // 0–20% = 10, 20–40% = 5 (optimal), 40–70% = 20, 70%+ = 60
  const currencyScore = totalForeignPct < 20 ? 10
    : totalForeignPct < 40 ? 5
    : totalForeignPct < 70 ? 20
    : 60;

  // ── G. Platform/Custody Risk ───────────────────────────────────
  const platforms = new Set([
    ...DATA.crypto.map(a => a.platform),
    ...DATA.stocks.map(h => h.broker),
  ].filter(Boolean));
  // 1 platform = 80, 2 = 40, 3+ = 15
  const platformScore = platforms.size === 1 ? 80
    : platforms.size === 2 ? 40
    : 15;

  // ── WEIGHTED TOTAL ─────────────────────────────────────────────
  const weights = {
    concentration: 0.20,
    crypto:        0.20,
    volatility:    0.20,
    diversification: 0.15,
    drawdown:      0.10,
    currency:      0.10,
    platform:      0.05,
  };

  const raw = {
    concentration: concentrationScore,
    crypto:        cryptoScore,
    volatility:    volScore,
    diversification: diversificationScore,
    drawdown:      drawdownScore,
    currency:      currencyScore,
    platform:      platformScore,
  };

  const total = Math.round(
    raw.concentration * weights.concentration +
    raw.crypto        * weights.crypto +
    raw.volatility    * weights.volatility +
    raw.diversification * weights.diversification +
    raw.drawdown      * weights.drawdown +
    raw.currency      * weights.currency +
    raw.platform      * weights.platform
  );

  const grade = total < 20 ? 'RENDAH'
    : total < 40 ? 'MODERAT'
    : total < 60 ? 'TINGGI'
    : total < 80 ? 'SANGAT TINGGI'
    : 'EKSTREM';

  const color = total < 20 ? '#34d399'
    : total < 40 ? '#a3e635'
    : total < 60 ? '#fbbf24'
    : total < 80 ? '#fb923c'
    : '#fb7185';

  return {
    total,
    grade,
    color,
    annualVol,
    maxSinglePct,
    topAsset,
    numClasses,
    cryptoPct,
    totalForeignPct,
    numPlatforms: platforms.size,
    raw,
    weights,
    breakdown: {
      concentration: { score: Math.round(raw.concentration), label: 'Konsentrasi Aset', weight: 20, desc: `Aset terbesar: ${topAsset ? topAsset.label : '–'} (${maxSinglePct.toFixed(1)}% portofolio)` },
      crypto:        { score: Math.round(raw.crypto), label: 'Eksposur Kripto', weight: 20, desc: `${cryptoPct.toFixed(1)}% portofolio dalam aset kripto (volatil)` },
      volatility:    { score: Math.round(raw.volatility), label: 'Volatilitas Historis', weight: 20, desc: annualVol != null ? `Volatilitas tahunan: ${annualVol.toFixed(1)}%` : 'Data historis belum cukup (sync tiap hari)' },
      diversification: { score: Math.round(raw.diversification), label: 'Diversifikasi Kelas Aset', weight: 15, desc: `${numClasses} kelas aset aktif dengan bobot >5%` },
      drawdown:      { score: Math.round(raw.drawdown), label: 'Risiko Drawdown', weight: 10, desc: 'Berdasarkan penurunan terbesar dari puncak historis' },
      currency:      { score: Math.round(raw.currency), label: 'Risiko Mata Uang', weight: 10, desc: `${totalForeignPct.toFixed(1)}% dalam aset valuta asing (USD, dll)` },
      platform:      { score: Math.round(raw.platform), label: 'Risiko Platform/Custody', weight: 5, desc: `${platforms.size} broker/exchange unik` },
    },
  };
}

// ─────────────────────────────────────────
//  2. AI RISK NARRATIVE (Claude)
// ─────────────────────────────────────────

export async function generateRiskNarrative(riskResult) {
  const T = totals();
  const M = computeMetrics(T);

  const prompt = `Kamu adalah risk analyst portofolio investasi profesional. Analisis SINGKAT dan ACTIONABLE.

DATA PORTOFOLIO:
- Total aset: ${toDisp(T.t)}
- Crypto: ${toDisp(T.c)} (${(T.c/T.t*100).toFixed(1)}%)
- Emas: ${toDisp(T.g)} (${(T.g/T.t*100).toFixed(1)}%)
- Saham: ${toDisp(T.k)} (${(T.k/T.t*100).toFixed(1)}%)
- Tabungan: ${toDisp(T.sv)} (${(T.sv/T.t*100).toFixed(1)}%)
- Total return: ${M.total.ret != null ? M.total.ret.toFixed(1)+'%' : 'N/A'}

SKOR RISIKO KUANTITATIF: ${riskResult.total}/100 (${riskResult.grade})
- Konsentrasi aset: ${riskResult.raw.concentration.toFixed(0)}/100
- Eksposur kripto: ${riskResult.raw.crypto.toFixed(0)}/100
- Volatilitas: ${riskResult.raw.volatility.toFixed(0)}/100
- Diversifikasi: ${riskResult.raw.diversification.toFixed(0)}/100
- Drawdown: ${riskResult.raw.drawdown.toFixed(0)}/100
- Risiko mata uang: ${riskResult.raw.currency.toFixed(0)}/100
${riskResult.annualVol ? `- Volatilitas tahunan: ${riskResult.annualVol.toFixed(1)}%` : ''}

Berikan analisis PADAT dalam format PERSIS ini (WAJIB ikuti format, isi dalam bahasa Indonesia):

**🎯 Ringkasan Risiko**
[1–2 kalimat intisari profil risiko portofolio ini]

**⚠️ 3 Risiko Utama**
1. [Risiko terbesar + angka spesifik]
2. [Risiko kedua]
3. [Risiko ketiga]

**✅ 3 Langkah Mitigasi**
1. [Aksi konkret + target alokasi spesifik]
2. [Aksi konkret kedua]
3. [Aksi konkret ketiga]

**📊 Profil Investor Cocok**
[Tipe investor yang sesuai dengan portofolio ini dalam 1 kalimat]`;

  return callClaude(prompt, 800);
}

// ─────────────────────────────────────────
//  3. PRICE PREDICTION ENGINE
// ─────────────────────────────────────────

/**
 * Compute local technical signals from history for an asset class.
 * Returns: trend, momentum, support, resistance, signal
 */
export function computeTechnicalSignals(historyData) {
  if (!historyData || historyData.length < 7) return null;

  const sorted = [...historyData].sort((a, b) => a.date.localeCompare(b.date));
  const vals = sorted.map(h => h.value);
  const n = vals.length;

  // Simple Moving Averages
  const sma = (arr, period) => {
    const slice = arr.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  };

  const sma7  = sma(vals, Math.min(7,  n));
  const sma14 = sma(vals, Math.min(14, n));
  const sma30 = sma(vals, Math.min(30, n));

  const currentVal = vals[n - 1];
  const prev7Val   = vals[Math.max(0, n - 8)];
  const prev30Val  = vals[Math.max(0, n - 31)];

  // Trend strength (% change over 30 days)
  const trend30 = ((currentVal - prev30Val) / prev30Val) * 100;
  const trend7  = ((currentVal - prev7Val) / prev7Val) * 100;

  // Momentum: is short-term MA above long-term?
  const maSignal = sma7 > sma14 ? 'bullish' : 'bearish';

  // RSI-style overbought/oversold from recent returns
  const returns14 = [];
  for (let i = Math.max(1, n - 14); i < n; i++) {
    if (vals[i - 1] > 0) returns14.push((vals[i] - vals[i - 1]) / vals[i - 1]);
  }
  const gains  = returns14.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const losses = Math.abs(returns14.filter(r => r < 0).reduce((s, r) => s + r, 0));
  const rsi = losses === 0 ? 100 : (100 - (100 / (1 + gains / losses)));

  // Support & Resistance (simple: 14-day low/high)
  const recent14 = vals.slice(-14);
  const support    = Math.min(...recent14);
  const resistance = Math.max(...recent14);

  // Composite signal
  let bullSignals = 0, bearSignals = 0;
  if (sma7 > sma14)    bullSignals++;
  if (sma14 > sma30)   bullSignals++;
  if (trend7 > 0)      bullSignals++;
  if (trend30 > 0)     bullSignals++;
  if (rsi < 40)        bullSignals++; // oversold = buy signal
  if (sma7 < sma14)    bearSignals++;
  if (sma14 < sma30)   bearSignals++;
  if (trend7 < 0)      bearSignals++;
  if (trend30 < 0)     bearSignals++;
  if (rsi > 70)        bearSignals++; // overbought = sell signal

  const signal = bullSignals > bearSignals ? 'BULLISH'
    : bearSignals > bullSignals ? 'BEARISH' : 'NEUTRAL';

  const signalStrength = Math.abs(bullSignals - bearSignals) / 5; // 0–1
  const confidence = Math.round(50 + signalStrength * 50);

  // Projected range (naive linear regression on last 14 points)
  const x = recent14.map((_, i) => i);
  const xMean = x.reduce((s, v) => s + v, 0) / x.length;
  const yMean = recent14.reduce((s, v) => s + v, 0) / recent14.length;
  const slope = x.reduce((s, xi, i) => s + (xi - xMean) * (recent14[i] - yMean), 0) /
                x.reduce((s, xi) => s + (xi - xMean) ** 2, 0.0001);

  const projected7d  = currentVal + slope * 7;
  const projected30d = currentVal + slope * 30;

  // Volatility band (std dev of last 14 returns)
  const retMean = returns14.reduce((s, r) => s + r, 0) / (returns14.length || 1);
  const retStd  = Math.sqrt(returns14.reduce((s, r) => s + (r - retMean) ** 2, 0) / (returns14.length || 1));

  return {
    currentVal,
    sma7, sma14, sma30,
    trend7: +trend7.toFixed(2),
    trend30: +trend30.toFixed(2),
    rsi: +rsi.toFixed(1),
    support, resistance,
    signal, confidence,
    bullSignals, bearSignals,
    projected7d:  Math.max(0, projected7d),
    projected30d: Math.max(0, projected30d),
    retStd: +retStd.toFixed(4),
    bandPct: +(retStd * 2 * 100).toFixed(1), // ±% band
  };
}

// ─────────────────────────────────────────
//  4. AI PRICE PREDICTION (Claude)
// ─────────────────────────────────────────

export async function generatePricePrediction(signals) {
  const T = totals();
  const hist = [...(S.historyData || [])].sort((a, b) => a.date.localeCompare(b.date));
  const recentHistory = hist.slice(-30).map(h => `${h.date}: ${toDisp(h.value)}`).join('\n');

  const prompt = `Kamu adalah quantitative analyst yang ahli dalam analisis teknikal dan fundamental portofolio investasi Indonesia.

DATA TEKNIKAL PORTOFOLIO (30 hari terakhir):
Nilai saat ini: ${toDisp(signals.currentVal)}
SMA 7 hari: ${toDisp(signals.sma7)}
SMA 14 hari: ${toDisp(signals.sma14)}
SMA 30 hari: ${toDisp(signals.sma30)}
Tren 7 hari: ${signals.trend7 > 0 ? '+' : ''}${signals.trend7}%
Tren 30 hari: ${signals.trend30 > 0 ? '+' : ''}${signals.trend30}%
RSI (14): ${signals.rsi}
Support: ${toDisp(signals.support)}
Resistance: ${toDisp(signals.resistance)}
Sinyal teknikal: ${signals.signal} (confidence: ${signals.confidence}%)
Proyeksi linier 7 hari: ${toDisp(signals.projected7d)}
Proyeksi linier 30 hari: ${toDisp(signals.projected30d)}
Volatilitas (±): ${signals.bandPct}% per hari

KOMPOSISI PORTOFOLIO:
${DATA.crypto.length} crypto, ${DATA.stocks.length} saham, ${DATA.gold.length} emas, ${DATA.savings.length} tabungan

RIWAYAT NILAI (30 hari terakhir):
${recentHistory || '(belum ada data — sync tiap hari)'}

Berikan analisis prediksi PADAT dan SPESIFIK dalam format PERSIS ini:

**🔮 Sinyal Teknikal Utama**
[Penjelasan sinyal bullish/bearish/neutral dalam 2 kalimat dengan angka konkret]

**📅 Proyeksi 7 Hari**
- Skenario Bullish: [nilai IDR target + kondisi yang mendukung]
- Skenario Base: [nilai IDR paling mungkin + reasoning]
- Skenario Bearish: [nilai IDR jika turun + trigger risiko]
- Confidence: ${signals.confidence}%

**📅 Proyeksi 30 Hari**
- Skenario Bullish: [nilai IDR target]
- Skenario Base: [nilai IDR paling mungkin]
- Skenario Bearish: [nilai IDR jika turun]

**⚡ Faktor Kunci yang Perlu Dipantau**
1. [Faktor paling penting + threshold yang perlu diperhatikan]
2. [Faktor kedua]
3. [Faktor ketiga]

**⚠️ Disclaimer**
Prediksi ini berdasarkan analisis teknikal historis dan BUKAN saran investasi. Pasar bisa bergerak di luar ekspektasi model.`;

  return callClaude(prompt, 900);
}

// ─────────────────────────────────────────
//  5. PORTFOLIO HEALTH METRICS
// ─────────────────────────────────────────

export function computeHealthMetrics() {
  const T = totals();
  const M = computeMetrics(T);
  const hist = [...(S.historyData || [])].sort((a, b) => a.date.localeCompare(b.date));

  // Sharpe Ratio
  let sharpe = null;
  if (hist.length >= 7) {
    const vals = hist.map(h => h.value);
    const returns = [];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i - 1] > 0) returns.push((vals[i] - vals[i - 1]) / vals[i - 1]);
    }
    const meanR = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
    const stdR  = Math.sqrt(returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / (returns.length || 1));
    const rfDaily = 0.06 / 252; // BI Rate
    sharpe = stdR > 0 ? ((meanR - rfDaily) / stdR * Math.sqrt(252)).toFixed(2) : null;
  }

  // Max Drawdown
  let maxDD = 0;
  if (hist.length >= 2) {
    const vals = hist.map(h => h.value);
    let peak = vals[0];
    for (const v of vals) {
      peak = Math.max(peak, v);
      if (peak > 0) maxDD = Math.max(maxDD, (peak - v) / peak);
    }
  }

  // Calmar Ratio (return / max drawdown)
  const calmar = (maxDD > 0 && M.total.ret != null)
    ? (M.total.ret / (maxDD * 100)).toFixed(2) : null;

  // Win rate (% of days portfolio gained)
  let winRate = null;
  if (hist.length >= 7) {
    const vals = hist.map(h => h.value);
    const gains = [];
    for (let i = 1; i < vals.length; i++) gains.push(vals[i] > vals[i - 1]);
    winRate = Math.round((gains.filter(Boolean).length / gains.length) * 100);
  }

  // Expected annual return (from total return / duration in days * 365)
  let annualReturn = null;
  if (hist.length >= 2 && M.total.ret != null) {
    const firstDate = new Date(hist[0].date);
    const lastDate  = new Date(hist[hist.length - 1].date);
    const days = Math.max(1, (lastDate - firstDate) / 86400000);
    annualReturn = (((1 + M.total.ret / 100) ** (365 / days)) - 1) * 100;
  }

  return {
    sharpe,
    maxDD: (maxDD * 100).toFixed(1),
    calmar,
    winRate,
    totalReturn: M.total.ret?.toFixed(1) ?? null,
    annualReturn: annualReturn?.toFixed(1) ?? null,
    totalValue: T.t,
    totalCost: M.total.cost,
    unrealizedPnl: M.total.pnl,
    dataPoints: hist.length,
  };
}

console.log('[ML] ML module loaded');
