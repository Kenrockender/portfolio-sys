/**
 * ══════════════════════════════════════════
 * GEMINI.JS — AI Portfolio Assistant
 * ══════════════════════════════════════════
 */

import { S, DATA } from './state.js';
import { totals, computeMetrics, savingsIdr } from './storage.js';
import { toDisp } from './storage.js';

// ── Config ────────────────────────────────────────────────────────
const GEMINI_API_KEY = 'AIzaSyD7QU6DIKv4AufhplH0ba_0VUd-PbBVZrc';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GEMINI_API_KEY}`;

// ── Build Portfolio Context ───────────────────────────────────────
// Merangkum semua data portfolio menjadi teks untuk dikirim ke Gemini
function buildPortfolioContext() {
  const T   = totals();
  const M   = computeMetrics(T);
  const cur = S.currency;

  const fmt = (idr) => toDisp(idr);

  const cryptoLines = DATA.crypto.map(a =>
    `  - ${a.coin} (${a.platform}): ${a.amount} coin, nilai ~${fmt(a.amount * (S.btcIdr || S.ethIdr || S.xrpIdr || 0))}`
  ).join('\n');

  const goldLines = DATA.gold.map(a =>
    `  - ${a.name}: ${a.grams}g, nilai ~${fmt(a.grams * S.goldGramIdr)}`
  ).join('\n');

  const stockLines = DATA.stocks.map(a =>
    `  - ${a.ticker} (${a.market}, ${a.broker}): ${a.shares} lot/shares`
  ).join('\n');

  const savingsLines = DATA.savings.map(a =>
    `  - ${a.name} (${a.bank}): ${a.currency} ${a.foreignAmt?.toLocaleString()}, yield ${a.annualYield}% p.a.`
  ).join('\n');

  return `
Kamu adalah asisten analis portofolio investasi pribadi.
Data portofolio user (dalam IDR kecuali disebutkan lain):

TOTAL ASET: ${fmt(T.t)}
- Crypto   : ${fmt(T.c)} (${((T.c/T.t)*100).toFixed(1)}%)
- Emas     : ${fmt(T.g)} (${((T.g/T.t)*100).toFixed(1)}%)
- Saham    : ${fmt(T.k)} (${((T.k/T.t)*100).toFixed(1)}%)
- Tabungan : ${fmt(T.sv)} (${((T.sv/T.t)*100).toFixed(1)}%)

PNL KESELURUHAN:
- Total cost basis : ${fmt(M.total.cost)}
- P&L             : ${M.total.pnl != null ? fmt(M.total.pnl) : 'N/A'}
- Return          : ${M.total.ret != null ? M.total.ret.toFixed(2) + '%' : 'N/A'}

DETAIL ASET:
Crypto:
${cryptoLines || '  (kosong)'}

Emas:
${goldLines || '  (kosong)'}

Saham:
${stockLines || '  (kosong)'}

Tabungan/Deposito:
${savingsLines || '  (kosong)'}

Kurs saat ini: 1 USD = Rp ${S.usdIdr.toLocaleString()}
Harga emas   : Rp ${S.goldGramIdr.toLocaleString()}/gram
BTC          : Rp ${(S.btcIdr/1e6).toFixed(1)}Jt

Jawab dalam Bahasa Indonesia, singkat dan to-the-point.
Gunakan data di atas sebagai konteks utama. Jangan sebut angka yang tidak ada di data.
`.trim();
}

// ── Call Gemini API ───────────────────────────────────────────────
export async function askGemini(userMessage, chatHistory = []) {
  // Bangun array contents: system context + riwayat chat + pesan baru
  const systemContext = buildPortfolioContext();

  const contents = [
    // "User" pertama membawa context portofolio
    { role: 'user',  parts: [{ text: systemContext }] },
    { role: 'model', parts: [{ text: 'Siap! Saya sudah membaca data portofolio kamu. Ada yang mau ditanyakan?' }] },
    // Riwayat chat sebelumnya
    ...chatHistory,
    // Pesan terbaru dari user
    { role: 'user',  parts: [{ text: userMessage }] },
  ];

  const res = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature:     0.7,
        maxOutputTokens: 1024,
      }
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '(tidak ada respons)';
}

// ── Auto-Analyze Portfolio ────────────────────────────────────────
// Analisis otomatis satu klik — tidak perlu input dari user
export async function analyzePortfolio() {
  const prompt = `
Berikan analisis singkat portofolio ini dalam 3 bagian:

1. **Ringkasan** (2-3 kalimat tentang kondisi portofolio saat ini)
2. **Kekuatan** (2-3 poin positif)  
3. **Risiko & Saran** (2-3 poin yang perlu diperhatikan)

Format pakai markdown. Singkat dan praktis.
`.trim();

  return askGemini(prompt);
}

console.log('[GEMINI] Gemini AI module loaded');