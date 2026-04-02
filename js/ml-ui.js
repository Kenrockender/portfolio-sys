/**
 * ══════════════════════════════════════════
 * ML-UI.JS — Risk Scoring & Prediction UI
 * ══════════════════════════════════════════
 */

import {
  computeRiskScore,
  computeTechnicalSignals,
  computeHealthMetrics,
  generateRiskNarrative,
  generatePricePrediction,
} from './ml.js';
import { S } from './state.js';
import { toDisp } from './storage.js';

// ── State ─────────────────────────────────────────────────────────
let _riskResult    = null;
let _signals       = null;
let _healthMetrics = null;
let _riskLoading   = false;
let _predLoading   = false;

// ── Grade color map (MUST match ml.js 5-tier system) ─────────────
const GRADE_COLORS = {
  'RENDAH':        { color: '#34d399', label: 'Rendah' },
  'MODERAT':       { color: '#a3e635', label: 'Moderat' },
  'TINGGI':        { color: '#fbbf24', label: 'Tinggi' },
  'SANGAT TINGGI': { color: '#fb923c', label: 'Sangat Tinggi' },
  'EKSTREM':       { color: '#fb7185', label: 'Ekstrem' },
  'N/A':           { color: '#64748b',  label: 'N/A' },
};

// Map a 0-100 sub-score to the matching 5-tier color
function scoreColor(s) {
  if (s < 20) return '#34d399';
  if (s < 40) return '#a3e635';
  if (s < 60) return '#fbbf24';
  if (s < 80) return '#fb923c';
  return '#fb7185';
}

// ── Mini Markdown Renderer ────────────────────────────────────────
function md(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^### (.+)$/gm,'<div class="ml-h3">$1</div>')
    .replace(/^## (.+)$/gm,'<div class="ml-h2">$1</div>')
    .replace(/^# (.+)$/gm,'<div class="ml-h1">$1</div>')
    .replace(/^[-•] (.+)$/gm,'<div class="ml-li">$1</div>')
    .replace(/^(\d+)\. (.+)$/gm,'<div class="ml-li ml-num"><span class="ml-num-badge">$1</span>$2</div>')
    .replace(/\n{2,}/g,'</p><p class="ml-p">')
    .replace(/\n/g,'<br>');
}

// ── Gauge SVG — SUPER CLEAN: Tanpa jarum + tanpa dot kuning sama sekali ──────────────────────
function buildGauge(score, color) {
  const W = 200, H = 115;
  const cx = 100, cy = 105;
  const R = 88;

  const toRad = d => d * Math.PI / 180;
  const pt = deg => [
    +(cx + R * Math.cos(toRad(deg))).toFixed(2),
    +(cy - R * Math.sin(toRad(deg))).toFixed(2)
  ];

  const [lx, ly] = pt(180); // left
  const [rx, ry] = pt(0);   // right

  const clampedScore = Math.max(0, Math.min(100, score));
  const scoreDeg = 180 - clampedScore * 1.8;
  const [sx, sy] = pt(scoreDeg);

  // Tick marks
  const tickPositions = [0, 20, 40, 60, 80, 100];
  const ticks = tickPositions.map(v => {
    const d = 180 - v * 1.8;
    const innerR = v > 0 && v < 100 ? R - 10 : R - 7;
    const outerR = R + 4;
    const [ix, iy] = [
      +(cx + innerR * Math.cos(toRad(d))).toFixed(2),
      +(cy - innerR * Math.sin(toRad(d))).toFixed(2)
    ];
    const [ox, oy] = [
      +(cx + outerR * Math.cos(toRad(d))).toFixed(2),
      +(cy - outerR * Math.sin(toRad(d))).toFixed(2)
    ];
    const strokeCol = v > 0 && v < 100 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)';
    const strokeW = v > 0 && v < 100 ? '1' : '1.5';
    return `<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="${strokeCol}" stroke-width="${strokeW}"/>`;
  }).join('');

  // Score arc (ke atas)
  const scoreArc = clampedScore > 0
    ? `<path d="M ${lx} ${ly} A ${R} ${R} 0 0 1 ${sx} ${sy}"
        fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
        style="filter: drop-shadow(0 0 10px ${color}90);"/>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <!-- Gray background track -->
    <path d="M ${lx} ${ly} A ${R} ${R} 0 0 1 ${rx} ${ry}"
      fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10" stroke-linecap="round"/>

    <!-- Colored score arc -->
    ${scoreArc}

    <!-- Tick marks -->
    ${ticks}

    <!-- Score number (sekarang 100% bebas, tidak ada dot kuning lagi) -->
    <text x="${cx}" y="${cy - 32}" text-anchor="middle"
      font-family="Syne,sans-serif" font-size="26" font-weight="800" fill="${color}">${clampedScore}</text>
    <text x="${cx}" y="${cy - 16}" text-anchor="middle"
      font-family="JetBrains Mono,monospace" font-size="8" fill="rgba(255,255,255,0.4)"
      letter-spacing="1">/ 100</text>
  </svg>`;
}

// ── Bar for sub-score ─────────────────────────────────────────────
function riskBar(score, weight, label, desc) {
  const clamped = Math.max(0, Math.min(100, score));
  const barColor = scoreColor(clamped);
  return `<div class="ml-risk-row">
    <div class="ml-risk-row-head">
      <span class="ml-risk-label">${label}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="ml-risk-weight">w: ${weight}%</span>
        <span class="ml-risk-score" style="color:${barColor}">${Math.round(clamped)}</span>
      </div>
    </div>
    <div class="ml-bar-track">
      <div class="ml-bar-fill" style="width:${clamped.toFixed(1)}%;background:${barColor};box-shadow:0 0 8px ${barColor}50;"></div>
    </div>
    <div class="ml-risk-desc">${desc}</div>
  </div>`;
}

// ── Health metric chip ────────────────────────────────────────────
function healthChip(label, val, unit, hint, good, warn) {
  const raw = val != null ? parseFloat(String(val).replace(/[^0-9.\-]/g, '')) : null;
  const isNum = raw !== null && !isNaN(raw);

  const color = !isNum ? 'var(--muted)'
    : good == null ? 'var(--text)'
    : typeof good === 'function' ? (good(raw) ? 'var(--up)' : 'var(--down)')
    : raw >= good ? 'var(--up)'
    : warn != null && raw >= warn ? 'var(--warn)'
    : 'var(--down)';

  const display = val != null ? val + (unit || '') : '–';

  return `<div class="ml-health-chip">
    <div class="ml-health-label">${label}</div>
    <div class="ml-health-val" style="color:${color}">${display}</div>
    <div class="ml-health-hint">${hint}</div>
  </div>`;
}

// ── Signal badge ──────────────────────────────────────────────────
function signalBadge(sig) {
  const map = {
    BULLISH: { bg: 'rgba(52,211,153,.15)', col: '#34d399', bd: 'rgba(52,211,153,.3)', icon: '↑' },
    BEARISH: { bg: 'rgba(251,113,133,.12)', col: '#fb7185', bd: 'rgba(251,113,133,.25)', icon: '↓' },
    NEUTRAL: { bg: 'rgba(251,191,36,.10)', col: '#fbbf24', bd: 'rgba(251,191,36,.2)', icon: '→' },
  };
  const m = map[sig] || map.NEUTRAL;
  return `<span style="background:${m.bg};color:${m.col};border:1px solid ${m.bd};
    padding:3px 10px;border-radius:5px;font-size:10px;font-weight:800;
    letter-spacing:.1em;font-family:'JetBrains Mono',monospace;">
    ${m.icon} ${sig}
  </span>`;
}

// ── Setup API card ────────────────────────────────────────────────
function apiSetupCard(title) {
  return `<div style="padding:20px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);border-radius:10px;text-align:center;">
    <div style="font-size:28px;margin-bottom:8px;">🔑</div>
    <div style="color:var(--warn);font-weight:700;font-size:12px;margin-bottom:6px;">API Key Belum Dikonfigurasi</div>
    <div style="color:var(--muted);font-size:10px;line-height:1.6;max-width:340px;margin:0 auto;">
      Fitur <strong>${title}</strong> membutuhkan Claude API key dari Anthropic.<br><br>
      <strong>Cara setup:</strong><br>
      1. Dapatkan API key di <span style="color:var(--crypto);">console.anthropic.com</span><br>
      2. Tambahkan header <code style="background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px;">x-api-key</code> di fungsi <code>callClaude()</code> pada <code>ml.js</code><br>
      3. Tambahkan header <code style="background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px;">anthropic-version: 2023-06-01</code>
    </div>
  </div>`;
}

// ── Smart error renderer ──────────────────────────────────────────
function renderError(e, title) {
  const msg = e.message || String(e);

  // Detect auth / no-key errors
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return apiSetupCard(title);
  }
  if (msg.includes('401') || msg.includes('403')) {
    return `<div style="padding:16px;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.2);border-radius:8px;">
      <div style="color:var(--down);font-size:11px;">
        <strong>⚠ API Key Invalid</strong><br>
        <span style="color:var(--muted)">Response: ${msg}</span><br><br>
        Pastikan API key Claude valid dan memiliki akses ke model <code>claude-sonnet-4-20250514</code>.
      </div>
    </div>`;
  }
  if (msg.includes('429')) {
    return `<div style="padding:16px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:8px;">
      <div style="color:var(--warn);font-size:11px;">
        <strong>⏳ Rate Limit</strong><br>
        <span style="color:var(--muted)">Terlalu banyak request. Tunggu 10-30 detik lalu coba lagi.</span>
      </div>
    </div>`;
  }

  return `<div style="padding:16px;background:rgba(251,113,133,.08);border:1px solid rgba(251,113,133,.2);border-radius:8px;">
    <div style="color:var(--down);font-size:11px;">
      <strong>⚠ Error:</strong> ${msg}
    </div>
  </div>`;
}

// ── Main render function ──────────────────────────────────────────
export function renderMLPanel() {
  const el = document.getElementById('mlPanel');
  if (!el) return;

  // Compute with safety
  try {
    _riskResult    = computeRiskScore();
    _signals       = computeTechnicalSignals(S.historyData || []);
    _healthMetrics = computeHealthMetrics();
  } catch (e) {
    console.error('[ML-UI] Computation error:', e);
    el.innerHTML = `<div class="ml-info-note" style="padding:32px;text-align:center;">
      ⚠️ Gagal menghitung metrik: ${e.message}<br>
      <span style="color:var(--muted);font-size:10px;">Pastikan data portofolio sudah tersedia.</span>
    </div>`;
    return;
  }

  const { total, grade, color, breakdown } = _riskResult;
  const h = _healthMetrics || {};
  const gradeInfo = GRADE_COLORS[grade] || GRADE_COLORS['N/A'];

  // Safe signal calculations
  const bullCount = _signals?.bullSignals || 0;
  const bearCount = _signals?.bearSignals || 0;
  const totalSig  = bullCount + bearCount;
  const sigBarW   = totalSig > 0 ? (bullCount / totalSig * 100).toFixed(0) : 50;
  const sigColor  = !_signals ? 'var(--muted)'
    : _signals.signal === 'BULLISH' ? 'var(--up)'
    : _signals.signal === 'BEARISH' ? 'var(--down)'
    : 'var(--warn)';

  // Zone legend (5 tiers matching ml.js)
  const zoneLegend = Object.entries(GRADE_COLORS)
    .filter(([k]) => k !== 'N/A')
    .map(([, v]) => `<span style="color:${v.color};font-size:10px;">● ${v.label}</span>`)
    .join('&nbsp;&nbsp;');

  // Health chips
  const hChips = [
    healthChip('Total Return', h.totalReturn, '%', 'Sejak awal investasi', 0, -10),
    healthChip('Ann. Return', h.annualReturn, '%', 'Diannualisasi', 5, 0),
    healthChip('Sharpe Ratio', h.sharpe, '', 'Risk-adj. return (Rf=6%)', n => n > 1, n => n > 0),
    healthChip('Max Drawdown', h.maxDD != null ? '-' + h.maxDD : null, '%', 'Penurunan terbesar dari puncak', null, null),
    healthChip('Calmar Ratio', h.calmar, '', 'Return / Max Drawdown', n => n > 1, n => n > 0.5),
    healthChip('Win Rate', h.winRate, '%', 'Hari portofolio naik', n => n > 55, n => n > 45),
    healthChip('Data Points', h.dataPoints, ' hari', 'Snapshot historis tersimpan', n => n >= 30, n => n >= 7),
    healthChip(
      'Unrealized P&L',
      h.unrealizedPnl != null
        ? (h.unrealizedPnl >= 0 ? '+' : '-') + toDisp(Math.abs(h.unrealizedPnl))
        : null,
      '',
      h.unrealizedPnl != null
        ? (h.unrealizedPnl >= 0 ? 'Keuntungan belum terealisasi' : 'Kerugian belum terealisasi')
        : 'Belum ada cost basis',
      h.unrealizedPnl != null ? () => h.unrealizedPnl >= 0 : null,
      null
    ),
  ].join('');

  const dataWarning = (h.dataPoints || 0) < 7
    ? `<div class="ml-info-note">💡 Sync harga setiap hari untuk analisis lebih akurat. Butuh minimal 7 snapshot.</div>`
    : '';

  el.innerHTML = `
  <!-- ── HEADER ── -->
  <div class="ml-panel-header">
    <div>
      <div class="ml-panel-tag">RISK INTELLIGENCE · QUANTITATIVE</div>
      <div class="ml-panel-title">Portfolio Risk & Signals</div>
      <div class="ml-panel-sub">Skor risiko, sinyal teknikal, dan proyeksi berbasis data historis</div>
    </div>
    <div class="ml-panel-refresh">
      <button class="ml-refresh-btn" onclick="window.refreshMLAnalysis()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="12" height="12"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
        Refresh
      </button>
    </div>
  </div>

  <!-- ── ROW 1: RISK GAUGE + BREAKDOWN ── -->
  <div class="ml-grid-2">

    <!-- Risk Gauge Card -->
    <div class="ml-card ml-card-glow" style="--glow:${color}20;--glow-border:${color}40">
      <div class="ml-card-label">RISK SCORE</div>
      <div class="ml-gauge-wrap">
        ${buildGauge(total, color)}
      </div>
      <div class="ml-grade-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">
        ${grade}
      </div>
      <div class="ml-gauge-zones" style="display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;">
        ${zoneLegend}
      </div>
    </div>

    <!-- Risk Breakdown Card -->
    <div class="ml-card">
      <div class="ml-card-label">RISK BREAKDOWN</div>
      <div class="ml-breakdown-list">
        ${Object.values(breakdown).map(b =>
          riskBar(b.score, b.weight, b.label, b.desc)
        ).join('')}
      </div>
    </div>

  </div>

  <!-- ── ROW 2: HEALTH METRICS ── -->
  <div class="ml-card">
    <div class="ml-card-label">PORTFOLIO HEALTH METRICS</div>
    <div class="ml-health-grid">
      ${hChips}
    </div>
    ${dataWarning}
  </div>

  <!-- ── ROW 3: TECHNICAL SIGNALS + PROJECTION ── -->
  ${_signals ? `
  <div class="ml-grid-2">

    <!-- Technical signals -->
    <div class="ml-card">
      <div class="ml-card-label" style="display:flex;align-items:center;justify-content:space-between;">
        SINYAL TEKNIKAL
        ${signalBadge(_signals.signal)}
      </div>
      <div class="ml-tech-grid">
        <div class="ml-tech-item">
          <div class="ml-tech-label">SMA 7 Hari</div>
          <div class="ml-tech-val" style="color:${_signals.sma7>_signals.sma14?'var(--up)':'var(--down)'}">${toDisp(_signals.sma7)}</div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">SMA 14 Hari</div>
          <div class="ml-tech-val">${toDisp(_signals.sma14)}</div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">Tren 7 Hari</div>
          <div class="ml-tech-val" style="color:${_signals.trend7>=0?'var(--up)':'var(--down)'}">
            ${_signals.trend7>=0?'+':''}${_signals.trend7}%
          </div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">Tren 30 Hari</div>
          <div class="ml-tech-val" style="color:${_signals.trend30>=0?'var(--up)':'var(--down)'}">
            ${_signals.trend30>=0?'+':''}${_signals.trend30}%
          </div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">RSI (14)</div>
          <div class="ml-tech-val" style="color:${_signals.rsi>70?'var(--down)':_signals.rsi<30?'var(--up)':'var(--warn)'}">
            ${_signals.rsi}
            <span style="font-size:9px;color:var(--muted)">${_signals.rsi>70?' OB':_signals.rsi<30?' OS':''}</span>
          </div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">Confidence</div>
          <div class="ml-tech-val" style="color:var(--crypto)">${_signals.confidence}%</div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">Support (14d)</div>
          <div class="ml-tech-val">${toDisp(_signals.support)}</div>
        </div>
        <div class="ml-tech-item">
          <div class="ml-tech-label">Resistance (14d)</div>
          <div class="ml-tech-val">${toDisp(_signals.resistance)}</div>
        </div>
      </div>
      <div class="ml-signal-bar-wrap">
        <span style="font-size:9px;color:var(--muted)">Bear ${bearCount}</span>
        <div class="ml-signal-bar-track">
          <div class="ml-signal-bar-fill" style="width:${sigBarW}%;background:${sigColor}"></div>
        </div>
        <span style="font-size:9px;color:var(--muted)">Bull ${bullCount}</span>
      </div>
    </div>

    <!-- Projections -->
    <div class="ml-card">
      <div class="ml-card-label">PROYEKSI LINEAR (DATA-BASED)</div>
      <div class="ml-proj-warn">⚠ Berdasarkan regresi linear historis — bukan prediksi pasar</div>

      <div class="ml-proj-item">
        <div class="ml-proj-label">Proyeksi 7 Hari</div>
        <div class="ml-proj-val-wrap">
          <div class="ml-proj-val" style="color:${_signals.projected7d>=_signals.currentVal?'var(--up)':'var(--down)'}">${toDisp(_signals.projected7d)}</div>
          <span class="ml-proj-delta" style="color:${_signals.projected7d>=_signals.currentVal?'var(--up)':'var(--down)'}">
            ${_signals.projected7d>=_signals.currentVal?'+':''}${(((_signals.projected7d-_signals.currentVal)/Math.max(_signals.currentVal,1))*100).toFixed(1)}%
          </span>
        </div>
        <div class="ml-proj-band">±${_signals.bandPct}% per hari volatilitas</div>
      </div>

      <div class="ml-proj-divider"></div>

      <div class="ml-proj-item">
        <div class="ml-proj-label">Proyeksi 30 Hari</div>
        <div class="ml-proj-val-wrap">
          <div class="ml-proj-val" style="color:${_signals.projected30d>=_signals.currentVal?'var(--up)':'var(--down)'}">${toDisp(_signals.projected30d)}</div>
          <span class="ml-proj-delta" style="color:${_signals.projected30d>=_signals.currentVal?'var(--up)':'var(--down)'}">
            ${_signals.projected30d>=_signals.currentVal?'+':''}${(((_signals.projected30d-_signals.currentVal)/Math.max(_signals.currentVal,1))*100).toFixed(1)}%
          </span>
        </div>
        <div class="ml-proj-band">Slope: ${_signals.trend30>0?'+':''}${_signals.trend30}% / 30 hari</div>
      </div>
    </div>

  </div>
  ` : `
  <div class="ml-card">
    <div class="ml-info-note" style="text-align:center;padding:28px;font-size:11px;">
      📈 <strong>Sinyal teknikal & proyeksi</strong> akan muncul setelah minimal 7 snapshot historis.<br>
      Klik <strong>SYNC</strong> setiap hari untuk membangun data historis portofolio.
    </div>
  </div>
  `}

  <!-- Disclaimer -->
  <div class="ml-disclaimer">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13" style="flex-shrink:0;color:#fbbf24;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span>Model ini menggunakan analisis teknikal dan statistik historis. Proyeksi <strong>bukan saran investasi</strong> dan tidak menjamin hasil aktual. Pasar dapat bergerak di luar model. Selalu lakukan riset mandiri (DYOR).</span>
  </div>
  `;
}

// ── AI Handlers ───────────────────────────────────────────────────

window.runRiskAI = async function () {
  if (_riskLoading) return;
  _riskLoading = true;

  const card = document.getElementById('mlRiskAiCard');
  const out  = document.getElementById('mlRiskAiOutput');
  const btn  = document.getElementById('mlRiskAiBtn');
  if (!card || !out || !btn) { _riskLoading = false; return; }

  card.style.display = '';
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:ml-spin .6s linear infinite;display:inline-block">↻</span> Analyzing…';
  out.innerHTML = `<div class="ml-skeleton-wrap">
    <div class="ml-skeleton w80"></div><div class="ml-skeleton wfull"></div>
    <div class="ml-skeleton w60"></div><div class="ml-skeleton wfull"></div>
    <div class="ml-skeleton w70"></div>
  </div>`;

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const narrative = await generateRiskNarrative(_riskResult);
    out.innerHTML = `<div class="ml-ai-content">${md(narrative)}</div>`;
  } catch (e) {
    console.error('[ML-UI] Risk AI error:', e);
    out.innerHTML = renderError(e, 'AI Risk Analysis');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Retry AI Analysis`;
    _riskLoading = false;
  }
};

window.runPredictionAI = async function () {
  if (_predLoading || !_signals) return;
  _predLoading = true;

  const card = document.getElementById('mlPredAiCard');
  const out  = document.getElementById('mlPredAiOutput');
  const btn  = document.getElementById('mlPredAiBtn');
  if (!card || !out || !btn) { _predLoading = false; return; }

  card.style.display = '';
  btn.disabled = true;
  btn.innerHTML = '<span style="animation:ml-spin .6s linear infinite;display:inline-block">↻</span> Predicting…';
  out.innerHTML = `<div class="ml-skeleton-wrap">
    <div class="ml-skeleton w80"></div><div class="ml-skeleton wfull"></div>
    <div class="ml-skeleton w60"></div><div class="ml-skeleton wfull"></div>
    <div class="ml-skeleton w70"></div>
  </div>`;

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const prediction = await generatePricePrediction(_signals);
    out.innerHTML = `<div class="ml-ai-content">${md(prediction)}</div>`;
  } catch (e) {
    console.error('[ML-UI] Prediction AI error:', e);
    out.innerHTML = renderError(e, 'AI Price Prediction');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Retry AI Prediction`;
    _predLoading = false;
  }
};

window.refreshMLAnalysis = function () {
  renderMLPanel();
};

// Expose
window.renderMLPanel = renderMLPanel;

console.log('[ML-UI] ML UI module loaded');