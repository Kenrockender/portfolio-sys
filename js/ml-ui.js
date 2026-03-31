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

// ── Gauge SVG ─────────────────────────────────────────────────────
// Semicircle gauge: arc goes from 180° (left) → 0° (right) through the top.
// Center (cx, cy) sits at the bottom of the viewBox so the arc stays inside.
function buildGauge(score, color) {
  const W = 200, H = 115;
  const cx = 100, cy = 105; // hub at bottom-centre
  const R  = 88;            // radius — top of arc is at y = 105-88 = 17 ✓

  const toRad = d => d * Math.PI / 180;
  // Point on circle at standard math angle `deg`
  const pt = deg => [
    +(cx + R * Math.cos(toRad(deg))).toFixed(1),
    +(cy - R * Math.sin(toRad(deg))).toFixed(1),
  ];

  // Full track: 180° (left) → 0° (right) counter-clockwise through top
  // SVG arc: sweep-flag=0 = counter-clockwise (= visually upward)
  const [lx, ly] = pt(180); // ≈ (12, 105)
  const [rx, ry] = pt(0);   // ≈ (188, 105)

  // Score position: 0% → 180° (left), 100% → 0° (right)
  const scoreDeg = 180 - score * 1.8;
  const [sx, sy] = pt(scoreDeg);

  // Needle
  const nl = 72;
  const nx = +(cx + nl * Math.cos(toRad(scoreDeg))).toFixed(1);
  const ny = +(cy - nl * Math.sin(toRad(scoreDeg))).toFixed(1);

  // Zone ticks at 0 / 25 / 50 / 75 / 100 %
  const ticks = [0, 25, 50, 75, 100].map(v => {
    const d = 180 - v * 1.8;
    const [ix, iy] = [+(cx + (R-7) * Math.cos(toRad(d))).toFixed(1), +(cy - (R-7) * Math.sin(toRad(d))).toFixed(1)];
    const [ox, oy] = [+(cx + (R+4) * Math.cos(toRad(d))).toFixed(1), +(cy - (R+4) * Math.sin(toRad(d))).toFixed(1)];
    return `<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <!-- Gray track (full semicircle) -->
    <path d="M ${lx} ${ly} A ${R} ${R} 0 0 0 ${rx} ${ry}"
      fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10" stroke-linecap="round"/>
    <!-- Coloured score arc -->
    <path d="M ${lx} ${ly} A ${R} ${R} 0 0 0 ${sx} ${sy}"
      fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      style="filter:drop-shadow(0 0 8px ${color}90)"/>
    ${ticks}
    <!-- Needle -->
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"
      stroke="${color}" stroke-width="2.5" stroke-linecap="round"
      style="filter:drop-shadow(0 0 4px ${color})"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="${color}"
      style="filter:drop-shadow(0 0 8px ${color})"/>
    <!-- Score label (inside arc, above hub) -->
    <text x="${cx}" y="${cy - 32}" text-anchor="middle"
      font-family="Syne,sans-serif" font-size="26" font-weight="800" fill="${color}">${score}</text>
    <text x="${cx}" y="${cy - 16}" text-anchor="middle"
      font-family="JetBrains Mono,monospace" font-size="8" fill="rgba(255,255,255,0.4)"
      letter-spacing="1">/ 100</text>
  </svg>`;
}

// ── Bar for sub-score ─────────────────────────────────────────────
function riskBar(score, weight, color, label, desc) {
  const barColor = score < 30 ? '#34d399' : score < 60 ? '#fbbf24' : '#fb7185';
  return `<div class="ml-risk-row">
    <div class="ml-risk-row-head">
      <span class="ml-risk-label">${label}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="ml-risk-weight">w: ${weight}%</span>
        <span class="ml-risk-score" style="color:${barColor}">${Math.round(score)}</span>
      </div>
    </div>
    <div class="ml-bar-track">
      <div class="ml-bar-fill" style="width:${score.toFixed(1)}%;background:${barColor};box-shadow:0 0 8px ${barColor}50;"></div>
    </div>
    <div class="ml-risk-desc">${desc}</div>
  </div>`;
}

// ── Health metric chip ────────────────────────────────────────────
function healthChip(label, val, unit, hint, good, warn) {
  const numVal = parseFloat(val);
  const color = good == null ? 'var(--text)'
    : typeof good === 'function' ? (good(numVal) ? 'var(--up)' : 'var(--down)')
    : !isNaN(numVal) && numVal >= good ? 'var(--up)'
    : !isNaN(numVal) && numVal >= (warn ?? 0) ? 'var(--warn)'
    : 'var(--down)';

  return `<div class="ml-health-chip">
    <div class="ml-health-label">${label}</div>
    <div class="ml-health-val" style="color:${color}">${val != null ? val + (unit||'') : '–'}</div>
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

// ── Main render function ──────────────────────────────────────────
export function renderMLPanel() {
  const el = document.getElementById('mlPanel');
  if (!el) return;

  _riskResult    = computeRiskScore();
  _signals       = computeTechnicalSignals(S.historyData || []);
  _healthMetrics = computeHealthMetrics();

  const { total, grade, color, breakdown } = _riskResult;
  const h = _healthMetrics;

  el.innerHTML = `
  <!-- ── HEADER ── -->
  <div class="ml-panel-header">
    <div>
      <div class="ml-panel-tag">ML MODEL · QUANTITATIVE</div>
      <div class="ml-panel-title">Portfolio Intelligence Dashboard</div>
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
      <div class="ml-gauge-zones">
        <span style="color:#34d399">●</span> Rendah
        <span style="color:#fbbf24">●</span> Moderat
        <span style="color:#fb923c">●</span> Tinggi
        <span style="color:#fb7185">●</span> Ekstrem
      </div>
      <div class="ml-card-footer">
        <button class="ml-action-btn" id="mlRiskAiBtn" onclick="window.runRiskAI()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          AI Risk Analysis
        </button>
      </div>
    </div>

    <!-- Risk Breakdown Card -->
    <div class="ml-card">
      <div class="ml-card-label">RISK BREAKDOWN</div>
      <div class="ml-breakdown-list">
        ${Object.values(breakdown).map(b =>
          riskBar(b.score, b.weight, color, b.label, b.desc)
        ).join('')}
      </div>
    </div>

  </div>

  <!-- ── AI RISK NARRATIVE ── -->
  <div class="ml-card" id="mlRiskAiCard" style="display:none;">
    <div class="ml-card-label" style="display:flex;align-items:center;gap:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      AI RISK NARRATIVE
    </div>
    <div class="ml-ai-output" id="mlRiskAiOutput">
      <div class="ml-skeleton-wrap">
        <div class="ml-skeleton w80"></div>
        <div class="ml-skeleton wfull"></div>
        <div class="ml-skeleton w60"></div>
      </div>
    </div>
  </div>

  <!-- ── ROW 2: HEALTH METRICS ── -->
  <div class="ml-card">
    <div class="ml-card-label">PORTFOLIO HEALTH METRICS</div>
    <div class="ml-health-grid">
      ${healthChip('Total Return', h.totalReturn, '%', 'Sejak awal investasi', 0, -10)}
      ${healthChip('Ann. Return', h.annualReturn, '%', 'Diannualisasi', 5, 0)}
      ${healthChip('Sharpe Ratio', h.sharpe, '', 'Risk-adj. return (Rf=6%)', n => n > 1, n => n > 0)}
      ${healthChip('Max Drawdown', '-'+h.maxDD, '%', 'Penurunan terbesar dari puncak', null, null)}
      ${healthChip('Calmar Ratio', h.calmar, '', 'Return/Max Drawdown', n => n > 1, n => n > 0.5)}
      ${healthChip('Win Rate', h.winRate, '%', 'Hari portofolio naik', n => n > 55, n => n > 45)}
      ${healthChip('Data Points', h.dataPoints, ' hari', 'Snapshot historis tersimpan', n => n >= 30, n => n >= 7)}
      ${healthChip('Unrealized P&L', h.unrealizedPnl != null ? toDisp(Math.abs(h.unrealizedPnl)) : null, '',
        h.unrealizedPnl != null ? (h.unrealizedPnl >= 0 ? 'Keuntungan belum terealisasi' : 'Kerugian belum terealisasi') : 'Belum ada cost basis',
        n => h.unrealizedPnl >= 0, null)}
    </div>
    ${h.dataPoints < 7 ? `<div class="ml-info-note">💡 Sync harga setiap hari untuk mendapatkan analisis yang lebih akurat. Butuh minimal 7 snapshot.</div>` : ''}
  </div>

  <!-- ── ROW 3: TECHNICAL SIGNALS + PREDICTION ── -->
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
        <span style="font-size:9px;color:var(--muted)">Bear ${_signals.bearSignals}</span>
        <div class="ml-signal-bar-track">
          <div class="ml-signal-bar-fill" style="width:${(_signals.bullSignals/(_signals.bullSignals+_signals.bearSignals||1)*100).toFixed(0)}%;background:${_signals.signal==='BULLISH'?'var(--up)':_signals.signal==='BEARISH'?'var(--down)':'var(--warn)'}"></div>
        </div>
        <span style="font-size:9px;color:var(--muted)">Bull ${_signals.bullSignals}</span>
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
            ${_signals.projected7d>=_signals.currentVal?'+':''}${(((_signals.projected7d-_signals.currentVal)/_signals.currentVal)*100).toFixed(1)}%
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
            ${_signals.projected30d>=_signals.currentVal?'+':''}${(((_signals.projected30d-_signals.currentVal)/_signals.currentVal)*100).toFixed(1)}%
          </span>
        </div>
        <div class="ml-proj-band">Menggunakan slope ${_signals.trend30>0?'+':''}${_signals.trend30}% / 30 hari</div>
      </div>

      <div class="ml-proj-divider"></div>

      <button class="ml-action-btn" style="width:100%;margin-top:8px;" id="mlPredAiBtn" onclick="window.runPredictionAI()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        AI Price Prediction
      </button>
    </div>

  </div>

  <!-- AI Prediction output -->
  <div class="ml-card" id="mlPredAiCard" style="display:none;">
    <div class="ml-card-label" style="display:flex;align-items:center;gap:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      AI PRICE PREDICTION ANALYSIS
    </div>
    <div class="ml-ai-output" id="mlPredAiOutput">
      <div class="ml-skeleton-wrap">
        <div class="ml-skeleton w80"></div>
        <div class="ml-skeleton wfull"></div>
        <div class="ml-skeleton w60"></div>
      </div>
    </div>
  </div>

  ` : `
  <div class="ml-card">
    <div class="ml-info-note" style="text-align:center;padding:24px;font-size:11px;">
      📈 <strong>Sinyal teknikal & proyeksi harga</strong> akan muncul setelah minimal 7 snapshot historis.<br>
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
    out.innerHTML = `<div style="color:var(--down);font-size:11px;padding:12px;">Error: ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Refresh AI Analysis`;
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
    out.innerHTML = `<div style="color:var(--down);font-size:11px;padding:12px;">Error: ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Refresh AI Prediction`;
    _predLoading = false;
  }
};

window.refreshMLAnalysis = function () {
  renderMLPanel();
};

// Expose to window so app.js setTab('ml') can call it
window.renderMLPanel = renderMLPanel;

console.log('[ML-UI] ML UI module loaded');
