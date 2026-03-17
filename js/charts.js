/**
 * ══════════════════════════════════════════
 * CHARTS.JS - Chart.js Logic
 * ══════════════════════════════════════════
 * Contains all chart rendering functions
 */

import { S, DATA, t } from './state.js';
import { toDisp, dispPrice, formatChartY, totals, stockPrice, cryptoPrice, stockMul } from './storage.js';
import { PLAT_COLORS, STK_MKT_COLORS, STK_MKT_LABELS, SAV_CCY_COLORS, BENCH_IHSG, BENCH_SP500, RANGE_DAYS } from './config.js';
import { fetchAssetPriceHistory } from './api.js';

// ── Chart Instances ──────────────────────────────────────────────
let pieChart = null, lineChart = null, platPie = null, benchChart = null;
let stocksPie = null, savingsPie = null, coinPie = null, stocksTickerPie = null;
let _acChart = null;

// ── Accumulation Chart Instances ─────────────────────────────────
let _cryptoAccumChart = null, _stkAccumChart = null, _savAccumChart = null;
let _cryptoAccumRange = '3M', _stkAccumRange = '3M', _savAccumRange = '3M';

// ── Slide State ──────────────────────────────────────────────────
let _cryptoSlide = 0, _stkSlide = 0, _savSlide = 0;

// ── Destroy All Charts (called on theme toggle) ───────────────────
// Chart.js tooltip/grid colors are baked in at creation time.
// The only reliable way to update them is destroy + rebuild,
// which _renderAll() will do immediately after this call.
export function destroyAllCharts() {
  [pieChart, lineChart, platPie, benchChart,
   stocksPie, savingsPie, coinPie, stocksTickerPie, _acChart,
   _cryptoAccumChart, _stkAccumChart, _savAccumChart,
   histLineChart
  ].forEach(ch => { try { ch?.destroy(); } catch(e) {} });

  pieChart = lineChart = platPie = benchChart = null;
  stocksPie = savingsPie = coinPie = stocksTickerPie = _acChart = null;
  _cryptoAccumChart = _stkAccumChart = _savAccumChart = null;
  histLineChart = null;

  // Update Chart.js global defaults AFTER destroy, BEFORE rebuild
  applyChartTheme();
  console.log('[CHARTS] All chart instances destroyed for theme re-render');
}

// ── Theme Helpers ────────────────────────────────────────────────
const _LIGHT_THEMES_SET = new Set(['light', 'solarized']);
function _isLightTheme() { return _LIGHT_THEMES_SET.has(S.theme); }
function tooltipBg()     { return _isLightTheme() ? '#ffffff'              : '#12122a'; }
function tooltipBorder() { return _isLightTheme() ? 'rgba(0,0,0,.12)'      : 'rgba(255,255,255,.1)'; }
function tooltipTitle()  { return _isLightTheme() ? '#0f172a'              : '#e2e8f0'; }
function tooltipBody()   { return _isLightTheme() ? '#475569'              : '#94a3b8'; }
function gridColor()     { return _isLightTheme() ? 'rgba(0,0,0,.06)'      : 'rgba(255,255,255,.04)'; }
function tickColor()     { return _isLightTheme() ? '#64748b'              : '#475569'; }
function borderColor()   { return _isLightTheme() ? 'rgba(0,0,0,.08)'      : 'rgba(255,255,255,.06)'; }
function canvasBg()      { return _isLightTheme() ? '#ffffff'              : '#0c0c1e'; }

// ── Shared Canvas Background Plugin ─────────────────────────────
// Fills chart canvas with card background color using destination-over
// compositing, so the canvas always matches the light/dark card bg.
const _canvasBgPlugin = {
  id: 'canvasBg',
  beforeDraw(chart) {
    const ctx2 = chart.canvas.getContext('2d');
    ctx2.save();
    ctx2.globalCompositeOperation = 'destination-over';
    ctx2.fillStyle = canvasBg();
    ctx2.fillRect(0, 0, chart.width, chart.height);
    ctx2.restore();
  }
};


// Apply Chart.js global defaults for current theme.
// Must be called BEFORE any chart is created so new instances pick up
// the right colors. Called in destroyAllCharts() before _renderAll().
function applyChartTheme() {
  if (typeof Chart === 'undefined') return;
  const isLight = _isLightTheme();
  Chart.defaults.color       = isLight ? '#64748b' : '#475569';
  Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)';
  Chart.defaults.backgroundColor = 'transparent';
}

// ── Init Chart.js Defaults & Global Plugins ─────────────────────
if (typeof Chart !== 'undefined') {
  Chart.defaults.elements = Chart.defaults.elements || {};
  Chart.defaults.elements.arc = Object.assign(Chart.defaults.elements.arc || {}, { hoverOffset: 0 });
  // Apply theme defaults on first load
  applyChartTheme();
  // Register canvas background plugin globally — applies to ALL charts
  // This fills the chart canvas with card bg color on every draw,
  // ensuring correct background in both dark and light mode.
  Chart.register(_canvasBgPlugin);
}

// ── Render Main Charts ───────────────────────────────────────────
export function renderCharts(T) {
  // Render allocation charts for each section
  renderCryptoPlatformAlloc(T);
  renderCryptoCoinPie();
  renderStocksProportion(T);
  renderStocksTickerPie();
  renderSavingsProportion(T);

  // Pie chart data
  const pd = [
    { label: 'Crypto', value: T.c, color: '#8b5cf6' },
    { label: 'Gold', value: T.g, color: '#f5c518' },
    { label: 'Stocks', value: T.k, color: '#22d3ee' },
    { label: 'Savings', value: T.sv, color: '#f472b6' }
  ];

  // Render legend
  document.getElementById('pieLegend').innerHTML = pd.map(d => {
    const pct = T.t > 0 ? (d.value / T.t * 100).toFixed(1) : '0.0';
    return `<div class="legend-row">
      <div class="legend-left">
        <div class="legend-dot" style="background:${d.color}"></div>
        <span>${d.label}</span>
      </div>
      <div class="legend-right">
        <span class="legend-val">${toDisp(d.value)}</span>
        <span class="legend-pct">${pct}%</span>
      </div>
    </div>`;
  }).join('');

  // Pie chart — update existing instance if it exists, create otherwise
  const pieValues = pd.map(d => d.value);
  if (pieChart) {
    pieChart.data.datasets[0].data = pieValues;
    // Update tooltip callback to use fresh T
    pieChart.options.plugins.tooltip.callbacks.label =
      ctx => `  ${toDisp(ctx.raw)}  (${T.t > 0 ? (ctx.raw / T.t * 100).toFixed(1) : 0}%)`;
    pieChart.update('none');
  } else {
    pieChart = new Chart(document.getElementById('pieChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: pd.map(d => d.label),
        datasets: [{
          data: pieValues,
          backgroundColor: pd.map(d => d.color + 'bb'),
          borderColor: pd.map(d => d.color),
          borderWidth: 1.5,
          hoverBorderWidth: 1,
          hoverOffset: 0
        }]
      },
      options: {
        cutout: '68%',
        elements: { arc: { hoverOffset: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => `  ${toDisp(ctx.raw)}  (${T.t > 0 ? (ctx.raw / T.t * 100).toFixed(1) : 0}%)` },
            backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
            titleColor: tooltipTitle(), bodyColor: tooltipBody(),
            titleFont: { family: 'JetBrains Mono', size: 11 },
            bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10
          }
        },
        animation: { animateRotate: true, duration: 900 }
      }
    });
  }

  // Update range buttons
  ['1W', '1M', '6M', '1Y', 'ALL'].forEach(r => {
    const b = document.getElementById('btn' + r);
    if (b) b.classList.toggle('active', S.historyRange === r);
  });

  renderLineChart(T);
}

// ── Get Filtered History ──────────────────────────────────────────
function getFilteredHistory() {
  const data = [...S.historyData].sort((a, b) => a.date.localeCompare(b.date));
  if (!data.length) return [];
  if (S.historyRange === 'ALL') return data;

  const now = new Date(), cutoff = new Date(now);
  if (S.historyRange === '1W') cutoff.setDate(now.getDate() - 7);
  else if (S.historyRange === '1M') cutoff.setMonth(now.getMonth() - 1);
  else if (S.historyRange === '6M') cutoff.setMonth(now.getMonth() - 6);
  else if (S.historyRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);

  const filtered = data.filter(d => new Date(d.date) >= cutoff);
  // Jika data di rentang ini kurang dari 2 titik, tampilkan semua data yang ada
  return filtered.length >= 2 ? filtered : data;
}

// ── Render Line Chart ─────────────────────────────────────────────
function renderLineChart(T) {
  const wrap = document.getElementById('lineChartWrap');
  const hist = getFilteredHistory();
  const isDown = hist.length >= 2 && hist[hist.length - 1].value < hist[0].value;
  const lineCol = isDown ? '#fb7185' : '#8b5cf6';

  if (hist.length < 2) {
    // Need placeholder — always recreate so the message stays current
    if (lineChart) { lineChart.destroy(); lineChart = null; }
    wrap.innerHTML = `<div style="position:relative;">
      <canvas id="lineChart" height="190"></canvas>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);text-align:center;pointer-events:none;">
        <div style="font-size:20px;opacity:.35">📈</div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:.14em;margin-top:4px">
          ${S.historyLoaded ? 'DATA ' + S.historyData.length + ' HARI — PERLU LEBIH BANYAK DATA' : 'MEMUAT HISTORY...'}
        </div>
      </div>
    </div>`;
    const lctx = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(lctx, buildLineConfig([new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })], [T.t], T));
    return;
  }

  const labels = hist.map(d => {
    const dt = new Date(d.date);
    if (S.historyRange === '1W') return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    if (S.historyRange === '1Y' || S.historyRange === 'ALL') return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  const values = hist.map(d => S.currency === 'USD' ? d.value / S.usdIdr : d.value);

  if (lineChart) {
    // Update data and colour in-place — no canvas re-injection, no flicker
    const ds = lineChart.data.datasets[0];
    lineChart.data.labels = labels;
    ds.data = values;
    ds.borderColor = lineCol;
    ds.pointBackgroundColor = lineCol;

    // Regenerate gradient with current canvas dimensions
    const lctx = document.getElementById('lineChart').getContext('2d');
    const grad = lctx.createLinearGradient(0, 0, 0, 190);
    if (isDown) {
      grad.addColorStop(0, 'rgba(251,113,133,.25)');
      grad.addColorStop(1, 'rgba(251,113,133,0)');
    } else {
      grad.addColorStop(0, 'rgba(139,92,246,.32)');
      grad.addColorStop(1, 'rgba(139,92,246,0)');
    }
    ds.backgroundColor = grad;
    ds.pointRadius = values.length > 30 ? 0 : 4;
    ds.pointHoverRadius = values.length > 30 ? 0 : 4;
    lineChart.update('none');
  } else {
    wrap.innerHTML = '<canvas id="lineChart" height="190"></canvas>';
    const lctx = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(lctx, buildLineConfig(labels, values, T));
  }
}
// ── Render History Line Chart (panelHistory tab) ──────────────────
let histLineChart = null;
export function renderHistoryLineChart(T) {
  const wrap = document.getElementById('histLineWrap');
  if (!wrap) return;
  if (histLineChart) { histLineChart.destroy(); histLineChart = null; }

  const hist = getFilteredHistory();

  if (hist.length < 2) {
    wrap.innerHTML = `<div style="position:relative;height:280px;">
      <canvas id="histLineChart"></canvas>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
        <div style="font-size:20px;opacity:.35">📈</div>
        <div style="font-size:9px;color:var(--muted);letter-spacing:.14em;margin-top:4px">
          ${S.historyLoaded ? 'BUTUH MIN. 2 SNAPSHOT HISTORIS' : 'MEMUAT HISTORY...'}
        </div>
      </div>
    </div>`;
  } else {
    wrap.innerHTML = '<canvas id="histLineChart"></canvas>';
  }

  const labels = hist.map(d => {
    const dt = new Date(d.date);
    if (S.historyRange === '1W') return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    if (S.historyRange === '1Y' || S.historyRange === 'ALL') return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });

  const values = hist.length >= 2
    ? hist.map(d => S.currency === 'USD' ? d.value / S.usdIdr : d.value)
    : [T ? (S.currency === 'USD' ? T.t / S.usdIdr : T.t) : 0];

  const canvas = document.getElementById('histLineChart');
  if (!canvas) return;
  const isDown = values.length >= 2 && values[values.length - 1] < values[0];
  const lineCol = isDown ? '#fb7185' : '#8b5cf6';
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, isDown ? 'rgba(251,113,133,.25)' : 'rgba(139,92,246,.32)');
  grad.addColorStop(1, isDown ? 'rgba(251,113,133,0)' : 'rgba(139,92,246,0)');

  histLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Portfolio',
        data: values,
        borderColor: lineCol,
        borderWidth: 2,
        backgroundColor: grad,
        pointRadius: values.length > 30 ? 0 : 4,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => '  ' + (S.currency === 'IDR'
              ? 'Rp ' + Math.round(ctx.raw).toLocaleString('id-ID')
              : '$' + ctx.raw.toFixed(0))
          },
          backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
          titleColor: tooltipTitle(), bodyColor: tooltipBody(),
          titleFont: { family: 'JetBrains Mono', size: 11 }, bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10
        },
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 }, border: { color: borderColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, callback: v => formatChartY(v) }, border: { color: borderColor() } }
      },
      animation: { duration: 600 }
    }
  });

  // Update range buttons
  ['1W', '1M', '6M', '1Y', 'ALL'].forEach(r => {
    document.getElementById('btn' + r)?.classList.toggle('active', S.historyRange === r);
    // Also sync the history panel range buttons
    document.querySelectorAll(`[onclick*="setHistoryRange('${r}')"]`).forEach(b => {
      b.classList.toggle('active', S.historyRange === r);
    });
  });
}



// ── Build Line Chart Config ───────────────────────────────────────
function buildLineConfig(labels, values, T) {
  const lctx = document.getElementById('lineChart').getContext('2d');
  const isDown = values.length >= 2 && values[values.length - 1] < values[0];
  const lineCol = isDown ? '#fb7185' : '#8b5cf6';
  const grad = lctx.createLinearGradient(0, 0, 0, 190);

  if (isDown) {
    grad.addColorStop(0, 'rgba(251,113,133,.25)');
    grad.addColorStop(1, 'rgba(251,113,133,0)');
  } else {
    grad.addColorStop(0, 'rgba(139,92,246,.32)');
    grad.addColorStop(1, 'rgba(139,92,246,0)');
  }

  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Portfolio',
        data: values,
        borderColor: lineCol,
        borderWidth: 2,
        backgroundColor: grad,
        pointBackgroundColor: lineCol,
        pointBorderColor: _isLightTheme() ? '#fff' : '#07070f',
        pointBorderWidth: 2,
        pointRadius: values.length > 30 ? 0 : 4,
        pointHoverRadius: values.length > 30 ? 0 : 4,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `  ${toDisp(ctx.raw)}` },
          backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
          titleColor: tooltipTitle(), bodyColor: tooltipBody(),
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10
        },
        canvasBg: _canvasBgPlugin
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 }, border: { color: borderColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 10 }, callback: v => formatChartY(v) }, border: { color: borderColor() } }
      },
      animation: { duration: 900 }
    }
  };
}

// ── Build Pie Chart Helper ────────────────────────────────────────
function _buildPie(canvasId, labelsIn, valsIn, colsIn, total) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  // Destroy existing instance on this canvas if any
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();

  const nonZero = labelsIn.map((l, i) => ({ l, v: valsIn[i], c: colsIn[i] })).filter(x => x.v > 0);
  const labels = nonZero.map(x => x.l);
  const vals = nonZero.map(x => x.v);
  const cols = nonZero.map(x => x.c);

  return new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: cols.map(c => c + 'bb'),
        borderColor: cols,
        borderWidth: 1.5,
        hoverOffset: 0
      }]
    },
    options: {
      cutout: '62%',
      elements: { arc: { hoverOffset: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `  ${toDisp(ctx.raw)}  (${(ctx.raw / total * 100).toFixed(1)}%)` },
          backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
          titleColor: tooltipTitle(), bodyColor: tooltipBody(),
          titleFont: { family: 'JetBrains Mono', size: 10 },
          bodyFont: { family: 'JetBrains Mono', size: 9 }, padding: 8
        }
      },
      animation: { animateRotate: true, duration: 700 }
    }
  });
}

// ── Build Bars Helper ─────────────────────────────────────────────
function _buildBars(containerId, entries, total, col_fn) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = entries.filter(([, v]) => v > 0).map(([label, val]) => {
    const pct = val / total * 100, col = col_fn(label);
    return `<div class="plat-bar-row">
      <div class="plat-bar-meta">
        <div class="plat-bar-left">${ptag(label)}<span class="plat-bar-pct">${pct.toFixed(1)}%</span></div>
        <span class="plat-bar-val">${toDisp(val)}</span>
      </div>
      <div class="plat-bar-track">
        <div class="plat-bar-fill" style="width:${pct}%;background:${col}"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Platform Tag Helper ───────────────────────────────────────────
function ptag(key) {
  const k = String(key).toLowerCase();
  const M = {
    floq: 't-floq', triv: 't-triv', pintu: 't-pintu', pluang: 't-pluang',
    indodax: 't-indodax', tokocrypto: 't-tokocrypto',
    binance: 't-binance', bitget: 't-bitget', physical: 't-physical',
    manual: 't-manual', bibit: 't-bibit', indopremier: 't-indopremier',
    stockbit: 't-stockbit', bca: 't-bca', bri: 't-bri', bni: 't-bni',
    mandiri: 't-mandiri', ocbc: 't-ocbc', krom: 't-krom', cash: 't-cash', other: 't-other'
  };
  const L = {
    floq: 'FLOQ', triv: 'TRIV', pintu: 'PINTU', pluang: 'PLUANG',
    indodax: 'INDODAX', tokocrypto: 'TOKOCRYPTO',
    binance: 'BINANCE', bitget: 'BITGET', physical: 'PHYSICAL',
    manual: 'MANUAL', bibit: 'BIBIT', indopremier: 'INDOPREMIER',
    stockbit: 'STOCKBIT', bca: 'BCA', bri: 'BRI', bni: 'BNI',
    mandiri: 'MANDIRI', ocbc: 'OCBC', krom: 'KROM', cash: 'CASH', other: 'OTHER'
  };
  return `<span class="ptag ${M[k] || 't-other'}">${L[k] || key.toUpperCase()}</span>`;
}

// ── Render Crypto Platform Allocation ─────────────────────────────
export function renderCryptoPlatformAlloc(T) {
  const m = {};
  DATA.crypto.forEach(a => {
    const p = a.platform || 'other', v = a.amount * cryptoPrice(a);
    m[p] = (m[p] || 0) + v;
  });

  const tot = Object.values(m).reduce((s, v) => s + v, 0) || 1;
  const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);

  _buildBars('platBars', entries, tot, k => PLAT_COLORS[k] || '#64748b');

  if (platPie) { platPie.destroy(); platPie = null; }

  const labels = entries.map(([p]) => p.toUpperCase());
  const vals = entries.map(([, v]) => v);
  const cols = entries.map(([p]) => PLAT_COLORS[p] || '#64748b');

  platPie = _buildPie('platPie', labels, vals, cols, tot);

  document.getElementById('platPieLegend').innerHTML = entries.map(([p, val]) => {
    const pct = (val / tot * 100).toFixed(1), col = PLAT_COLORS[p] || '#64748b';
    return `<div class="plm-row">
      <div class="plm-left"><div class="plm-dot" style="background:${col}"></div><span>${p.toUpperCase()}</span></div>
      <span style="color:var(--muted)">${pct}%</span>
    </div>`;
  }).join('');
}

// ── Render Crypto Coin Allocation Pie Chart ─────────────────────────
export function renderCryptoCoinPie() {
  if (coinPie) { coinPie.destroy(); coinPie = null; }

  const canvas = document.getElementById('coinPie');
  if (!canvas) return;

  // Group by coin — aggregate semua platform per koin
  const coinMap = {};
  DATA.crypto.forEach(a => {
    const coin = (a.coin || 'OTHER').toUpperCase();
    const val  = a.amount * cryptoPrice(a);
    coinMap[coin] = (coinMap[coin] || 0) + val;
  });

  const total   = Object.values(coinMap).reduce((s, v) => s + v, 0) || 1;
  const entries = Object.entries(coinMap).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return;

  // Warna per koin — identik di mana-mana di app ini
  const COIN_COLORS = {
    BTC: '#f7931a', ETH: '#627eea', XRP: '#00a7e4', SOL: '#9945FF',
    BNB: '#f3ba2f', ADA: '#0033ad', DOGE: '#c3a634', AVAX: '#e84142',
    DOT: '#e6007a', MATIC: '#8247e5', LINK: '#375bd2', UNI: '#ff007a',
    ATOM: '#2e3148', LTC: '#bfbbbb', SHIB: '#ffa409', USDT: '#26a17b',
    USDC: '#2775ca', ARB: '#12aaff', OP: '#ff0420',  SUI: '#6fbcf0',
    APT: '#00b5d2', NEAR: '#00c08b', TRX: '#ff0013', ONDO: '#5865f2',
    TON: '#0098ea',  PEPE: '#479f53', FIL: '#0090ff', AAVE: '#b6509e',
    CRV:  '#3a3a3a', DAI: '#f5ac37', OTHER: '#64748b',
  };

  // Fallback palette untuk koin yang tidak ada di COIN_COLORS
  const EXTRA_PALETTE = [
    '#e879f9','#34d399','#f472b6','#a78bfa','#67e8f9',
    '#4ade80','#fbbf24','#60a5fa','#f87171','#a3e635',
  ];
  let extraIdx = 0;
  const getColor = coin => COIN_COLORS[coin] || EXTRA_PALETTE[extraIdx++ % EXTRA_PALETTE.length];

  const labels = entries.map(([c]) => c);
  const vals   = entries.map(([, v]) => v);
  const cols   = entries.map(([c]) => getColor(c));

  coinPie = _buildPie('coinPie', labels, vals, cols, total);

  // Render legend
  const legendEl = document.getElementById('coinPieLegend');
  if (!legendEl) return;

  legendEl.innerHTML = entries.map(([coin, val]) => {
    const pct = (val / total * 100).toFixed(1);
    const col = getColor(coin);
    return `<div class="plm-row">
      <div class="plm-left">
        <div class="plm-dot" style="background:${col}"></div>
        <span style="font-weight:600">${coin}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="color:var(--muted);font-size:9px;">${toDisp(val)}</span>
        <span style="color:var(--text);font-weight:700;min-width:36px;text-align:right">${pct}%</span>
      </div>
    </div>`;
  }).join('');
}

// ── Render Stocks Proportion ──────────────────────────────────────
let _stkPieTab = 'broker';

export function setStkPieTab(tab) {
  _stkPieTab = tab;
  document.getElementById('stkPieTabBroker')?.classList.toggle('active', tab === 'broker');
  document.getElementById('stkPieTabMkt')?.classList.toggle('active', tab === 'market');
  renderStocksProportion(totals());
}

export function renderStocksProportion(T) {
  if (stocksPie) { stocksPie.destroy(); stocksPie = null; }

  const assets = DATA.stocks;
  if (!assets.length) return;

  if (_stkPieTab === 'broker') {
    const m = {};
    assets.forEach(h => {
      const broker = h.broker || 'other';
      const val = h.shares * stockMul(h) * stockPrice(h);
      m[broker] = (m[broker] || 0) + val;
    });

    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
    const tot = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const col_fn = k => PLAT_COLORS[k] || '#64748b';

    _buildBars('stocksBrokerBars', entries, tot, col_fn);

    const labels = entries.map(([k]) => k.toUpperCase());
    const vals = entries.map(([, v]) => v);
    const cols = entries.map(([k]) => col_fn(k));

    stocksPie = _buildPie('stocksPie', labels, vals, cols, tot);

    // Render legend with percentages
    document.getElementById('stocksPieLegend').innerHTML = entries.map(([k, val]) => {
      const pct = (val / tot * 100).toFixed(1);
      const col = col_fn(k);
      return `<div class="plm-row">
        <div class="plm-left"><div class="plm-dot" style="background:${col}"></div><span>${k.toUpperCase()}</span></div>
        <span style="color:var(--muted)">${pct}%</span>
      </div>`;
    }).join('');
  } else {
    const m = { IDX: 0, US: 0, INDEX: 0 };
    assets.forEach(h => {
      const mkt = ['IDX', 'US', 'INDEX'].includes(h.market) ? h.market : 'IDX';
      m[mkt] += h.shares * stockMul(h) * stockPrice(h);
    });

    const entries = Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const tot = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const col_fn = k => STK_MKT_COLORS[k] || '#64748b';

    _buildBars('stocksBrokerBars', entries, tot, col_fn);

    const labels = entries.map(([k]) => STK_MKT_LABELS[k] || k);
    const vals = entries.map(([, v]) => v);
    const cols = entries.map(([k]) => col_fn(k));

    stocksPie = _buildPie('stocksPie', labels, vals, cols, tot);

    // Render legend with percentages
    document.getElementById('stocksPieLegend').innerHTML = entries.map(([k, val]) => {
      const pct = (val / tot * 100).toFixed(1);
      const col = col_fn(k);
      const label = STK_MKT_LABELS[k] || k;
      return `<div class="plm-row">
        <div class="plm-left"><div class="plm-dot" style="background:${col}"></div><span>${label}</span></div>
        <span style="color:var(--muted)">${pct}%</span>
      </div>`;
    }).join('');
  }
}

// ── Render Stocks Ticker Allocation Pie Chart ─────────────────────
// Menampilkan alokasi per individual ticker (BBCA %, AAPL %, dll)
export function renderStocksTickerPie() {
  if (stocksTickerPie) { stocksTickerPie.destroy(); stocksTickerPie = null; }

  const canvas = document.getElementById('stocksTickerPie');
  if (!canvas) return;

  const assets = DATA.stocks;
  if (!assets.length) return;

  // Nilai per ticker — jika ada 2 lot BBCA gabungkan
  const tickerMap = {};
  assets.forEach(h => {
    const ticker = h.ticker || 'OTHER';
    const val = h.shares * stockMul(h) * stockPrice(h);
    tickerMap[ticker] = (tickerMap[ticker] || 0) + val;
  });

  const total   = Object.values(tickerMap).reduce((s, v) => s + v, 0) || 1;
  const entries = Object.entries(tickerMap).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return;

  // Palette — cukup banyak untuk cover banyak saham sekaligus
  const PALETTE = [
    '#22d3ee','#f5c518','#8b5cf6','#34d399','#fb7185',
    '#f472b6','#a78bfa','#67e8f9','#fcd34d','#4ade80',
    '#60a5fa','#fdba74','#fca5a5','#c4b5fd','#86efac',
    '#38bdf8','#e879f9','#facc15','#a3e635','#2dd4bf',
  ];

  // Warna khusus saham populer biar konsisten
  const TICKER_COLORS = {
    BBCA:'#0050b3', BBRI:'#cc0000', BMRI:'#1a5fa8', BBNI:'#e87722',
    TLKM:'#cc0000', GOTO:'#00aed9', BREN:'#16a34a', ASII:'#0052cc',
    AMMN:'#92400e', ANTM:'#047857', UNVR:'#1d4ed8', KLBF:'#059669',
    ADRO:'#78350f', BYAN:'#1e3a5f', MDKA:'#7c3aed', INCO:'#0e7490',
    AAPL:'#555555', MSFT:'#00a4ef', NVDA:'#76b900', TSLA:'#cc0000',
    GOOGL:'#4285f4', META:'#0866ff', AMZN:'#ff9900', BTPN:'#5b21b6',
    BBTN:'#1d4ed8', HMSP:'#dc2626', GGRM:'#92400e',
    BRIS:'#16a34a', SMGR:'#b45309', PTBA:'#1e40af',
    SPY:'#94a3b8', QQQ:'#0f172a', VTI:'#334155',
  };

  const getColor = (ticker, i) => TICKER_COLORS[ticker] || PALETTE[i % PALETTE.length];

  const labels = entries.map(([t]) => t);
  const vals   = entries.map(([, v]) => v);
  const cols   = entries.map(([t], i) => getColor(t, i));

  stocksTickerPie = _buildPie('stocksTickerPie', labels, vals, cols, total);

  // Legend
  const legendEl = document.getElementById('stocksTickerPieLegend');
  if (!legendEl) return;

  legendEl.innerHTML = entries.map(([ticker, val], i) => {
    const pct = (val / total * 100).toFixed(1);
    const col = getColor(ticker, i);
    // Cari nama perusahaan dari DATA
    const item = DATA.stocks.find(h => h.ticker === ticker);
    const name = item?.name || ticker;
    return `<div class="plm-row" title="${name}">
      <div class="plm-left">
        <div class="plm-dot" style="background:${col}"></div>
        <span style="font-weight:700">${ticker}</span>
        <span style="color:var(--muted);font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;">${name !== ticker ? name : ''}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
        <span style="color:var(--muted);font-size:9px;">${toDisp(val)}</span>
        <span style="color:var(--text);font-weight:700;min-width:36px;text-align:right">${pct}%</span>
      </div>
    </div>`;
  }).join('');
}

// ── Render Savings Proportion ─────────────────────────────────────
let _savPieTab = 'bank';

export function setSavPieTab(tab) {
  _savPieTab = tab;
  document.getElementById('savPieTabBank')?.classList.toggle('active', tab === 'bank');
  document.getElementById('savPieTabCcy')?.classList.toggle('active', tab === 'currency');
  renderSavingsProportion(totals());
}

export function renderSavingsProportion(T) {
  if (savingsPie) { savingsPie.destroy(); savingsPie = null; }

  const assets = DATA.savings;
  if (!assets.length) return;

  if (_savPieTab === 'bank') {
    const m = {};
    assets.forEach(a => {
      const bank = a.bank || 'other';
      m[bank] = (m[bank] || 0) + a.idr;
    });

    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
    const tot = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const col_fn = k => PLAT_COLORS[k] || '#64748b';

    _buildBars('savingsBankBars', entries, tot, col_fn);

    const labels = entries.map(([k]) => k.toUpperCase());
    const vals = entries.map(([, v]) => v);
    const cols = entries.map(([k]) => col_fn(k));

    savingsPie = _buildPie('savingsPie', labels, vals, cols, tot);

    // Render legend with percentages
    document.getElementById('savingsPieLegend').innerHTML = entries.map(([k, val]) => {
      const pct = (val / tot * 100).toFixed(1);
      const col = col_fn(k);
      return `<div class="plm-row">
        <div class="plm-left"><div class="plm-dot" style="background:${col}"></div><span>${k.toUpperCase()}</span></div>
        <span style="color:var(--muted)">${pct}%</span>
      </div>`;
    }).join('');
  } else {
    const m = {};
    assets.forEach(a => {
      const ccy = a.currency || 'IDR';
      m[ccy] = (m[ccy] || 0) + a.idr;
    });

    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
    const tot = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const col_fn = k => SAV_CCY_COLORS[k] || '#64748b';

    _buildBars('savingsBankBars', entries, tot, col_fn);

    const labels = entries.map(([k]) => k);
    const vals = entries.map(([, v]) => v);
    const cols = entries.map(([k]) => col_fn(k));

    savingsPie = _buildPie('savingsPie', labels, vals, cols, tot);

    // Render legend with percentages
    document.getElementById('savingsPieLegend').innerHTML = entries.map(([k, val]) => {
      const pct = (val / tot * 100).toFixed(1);
      const col = col_fn(k);
      return `<div class="plm-row">
        <div class="plm-left"><div class="plm-dot" style="background:${col}"></div><span>${k}</span></div>
        <span style="color:var(--muted)">${pct}%</span>
      </div>`;
    }).join('');
  }
}

// ── Render Benchmark Chart ────────────────────────────────────────
export function renderBenchChart(T) {
  if (benchChart) { benchChart.destroy(); benchChart = null; }

  const canvas = document.getElementById('benchChart');
  if (!canvas) return;

  const bd = getBenchData(T);
  if (!bd) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('benchLegend').innerHTML = '';
    return;
  }

  const ctx = canvas.getContext('2d');
  benchChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: bd.labels,
      datasets: [
        { label: 'Portfolio', data: bd.portNorm, borderColor: '#8b5cf6', borderWidth: 2.5, backgroundColor: 'rgba(139,92,246,.1)', pointRadius: 0, tension: 0.4, fill: true },
        { label: 'IHSG', data: bd.ihsgVals, borderColor: '#f5c518', borderWidth: 1.5, backgroundColor: 'transparent', borderDash: [4, 3], pointRadius: 0, tension: 0.4 },
        { label: 'S&P 500', data: bd.sp500Vals, borderColor: '#22d3ee', borderWidth: 1.5, backgroundColor: 'transparent', borderDash: [4, 3], pointRadius: 0, tension: 0.4 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ${ctx.raw} (base 100)` },
          backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
          titleColor: tooltipTitle(), bodyColor: tooltipBody(),
          titleFont: { family: 'JetBrains Mono', size: 11 }, bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10
        }
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 7 }, border: { color: borderColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, callback: v => `${v}` }, border: { color: borderColor() } }
      },
      animation: { duration: 700 }
    }
  });

  // Legend
  const datasets = [
    { label: 'Portfolio', col: '#8b5cf6' },
    { label: 'IHSG', col: '#f5c518' },
    { label: 'S&P 500', col: '#22d3ee' }
  ];

  const synthNote = getBenchData._synthetic ?
    `<span style="font-size:8px;color:var(--warn);letter-spacing:.1em;margin-left:8px;">⚠ ESTIMASI — sync tiap hari untuk data nyata</span>` : '';

  document.getElementById('benchLegend').innerHTML = datasets.map(d =>
    `<div class="bl-item"><div class="bl-line" style="background:${d.col}"></div><span>${d.label} (base 100)</span></div>`
  ).join('') + synthNote;

  // Update buttons
  ['6M', '1Y', 'ALL'].forEach(r => {
    const b = document.getElementById('benchBtn' + r);
    if (b) b.classList.toggle('active', S.benchRange === r);
  });

  document.getElementById('benchTabTotal')?.classList.toggle('active', S.benchTab === 'total');
  document.getElementById('benchTabEquity')?.classList.toggle('active', S.benchTab === 'equity');
}

// ── Get Benchmark Data ────────────────────────────────────────────
function getBenchData(T) {
  const hist = [...S.historyData].sort((a, b) => a.date.localeCompare(b.date));
  const rangeMonths = S.benchRange === '1Y' ? 12 : S.benchRange === 'ALL' ? 36 : 6;
  let useSynthetic = false;
  let workingHist = hist;

  if (hist.length < 2) {
    workingHist = generateSyntheticHistory(rangeMonths, T);
    useSynthetic = true;
  }

  getBenchData._synthetic = useSynthetic;

  let filtered;
  if (S.benchRange === 'ALL') {
    filtered = workingHist;
  } else {
    const now = new Date(), cutoff = new Date(now);
    if (S.benchRange === '6M') cutoff.setMonth(now.getMonth() - 6);
    else if (S.benchRange === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
    filtered = workingHist.filter(d => new Date(d.date) >= cutoff);
    if (filtered.length < 2) filtered = workingHist;
  }

  const step = Math.max(1, Math.floor(filtered.length / 60));
  const sampled = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);

  const labels = sampled.map(d => {
    const dt = new Date(d.date);
    return (S.benchRange === '1Y' || S.benchRange === 'ALL')
      ? dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });

  let portNorm;
  if (S.benchTab === 'equity') {
    const stocksCost = DATA.stocks.reduce((s, h) => s + h.shares * stockMul(h) * h.seedPrice, 0);
    const stocksCurr = DATA.stocks.reduce((s, h) => s + h.shares * stockMul(h) * stockPrice(h), 0);
    const stocksRet = stocksCost > 0 ? (stocksCurr - stocksCost) / stocksCost : 0;
    const n = sampled.length;
    const endVal = 100 * (1 + stocksRet);

    let seed2 = 77;
    const rand2 = () => { seed2 = (seed2 * 1664525 + 1013904223) & 0xffffffff; return (seed2 >>> 0) / 4294967296; };
    const randn2 = () => { const u = rand2() + 1e-10, v = rand2(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

    const raw = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 1;
      const trend = 100 + (endVal - 100) * t;
      raw.push(Math.max(20, +(trend + trend * 0.028 * randn2()).toFixed(2)));
    }
    raw[0] = 100;
    raw[n - 1] = +endVal.toFixed(2);
    portNorm = raw;
  } else {
    const portfolioVals = sampled.map(d => d.value);
    const portBase = portfolioVals[0] || 1;
    portNorm = portfolioVals.map(v => +((v / portBase) * 100).toFixed(2));
  }

  // Interpolate index data
  const interpIdx = (idxData, dates) => {
    return dates.map(dateStr => {
      const dt = new Date(dateStr).getTime();
      const times = idxData.map(x => new Date(x.date).getTime());
      if (dt <= times[0]) return +idxData[0].idx.toFixed(2);
      if (dt >= times[times.length - 1]) return +idxData[times.length - 1].idx.toFixed(2);
      for (let i = 0; i < idxData.length - 1; i++) {
        if (dt >= times[i] && dt <= times[i + 1]) {
          const t = (dt - times[i]) / (times[i + 1] - times[i]);
          return +(idxData[i].idx * (1 - t) + idxData[i + 1].idx * t).toFixed(2);
        }
      }
      return +idxData[idxData.length - 1].idx.toFixed(2);
    });
  };

  const baseDate = sampled[0].date;
  const ihsgBase = interpIdx(BENCH_IHSG, [baseDate])[0];
  const sp500Base = interpIdx(BENCH_SP500, [baseDate])[0];
  const ihsgRaw = interpIdx(BENCH_IHSG, sampled.map(d => d.date));
  const sp500Raw = interpIdx(BENCH_SP500, sampled.map(d => d.date));
  const ihsgNorm = ihsgRaw.map(v => +((v / ihsgBase) * 100).toFixed(2));
  const sp500Norm = sp500Raw.map(v => +((v / sp500Base) * 100).toFixed(2));

  return { labels, portNorm, ihsgVals: ihsgNorm, sp500Vals: sp500Norm };
}

// ── Generate Synthetic History ────────────────────────────────────
function generateSyntheticHistory(rangeMonths, T) {
  if (!T) T = totals();
  const totalCost =
    DATA.crypto.reduce((s, h) => s + (h.costBasisIdr || 0), 0) +
    DATA.gold.reduce((s, h) => s + h.grams * (h.costBasisPerGram || 0), 0) +
    DATA.stocks.reduce((s, h) => s + h.shares * stockMul(h) * (h.seedPrice || 0), 0) +
    DATA.savings.reduce((s, h) => s + (h.idr || 0), 0);

  const totalNow = T.t || totalCost || 1;
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - rangeMonths);
  const nPts = Math.max(14, rangeMonths * 3);
  const pts = [];

  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 4294967296; };
  const randn = () => { const u = rand() + 1e-10, v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  for (let i = 0; i < nPts; i++) {
    const t2 = nPts > 1 ? i / (nPts - 1) : 1;
    const d = new Date(start.getTime() + (now.getTime() - start.getTime()) * t2);
    const dateStr = d.toISOString().split('T')[0];
    const trend = totalCost + (totalNow - totalCost) * t2;
    const noise = trend * 0.022 * randn();
    pts.push({ date: dateStr, value: Math.max(1, Math.round(trend + noise)) });
  }

  pts[0].value = totalCost > 0 ? totalCost : totalNow * 0.9;
  pts[pts.length - 1].value = totalNow;

  return pts;
}

// ═════════════════════════════════════════════════════════════════
// SLIDE PANEL FUNCTIONS
// ═════════════════════════════════════════════════════════════════

// ── Crypto Slide ──────────────────────────────────────────────────
export function cryptoSlide(idx) {
  _cryptoSlide = idx;
  const track = document.getElementById('cryptoTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  document.getElementById('cryptoNavAlloc')?.classList.toggle('crypto-active', idx === 0);
  document.getElementById('cryptoNavChart')?.classList.toggle('crypto-active', idx === 1);
  document.getElementById('cryptoNavCoin')?.classList.toggle('crypto-active',  idx === 2);
  if (idx === 1) requestAnimationFrame(() => requestAnimationFrame(() => _renderAccumChart('crypto')));
  if (idx === 2) requestAnimationFrame(() => requestAnimationFrame(() => renderCryptoCoinPie()));
}

export function cryptoAccumRange(r) {
  _cryptoAccumRange = r;
  document.querySelectorAll('#cryptoAccumWrap .accum-range-row .ac-range-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === ({ '3M': '3B', '6M': '6B', '1Y': '1T' }[r] || r));
  });
  _renderAccumChart('crypto');
}

// ── Stocks Slide ──────────────────────────────────────────────────
export function stkSlide(idx) {
  _stkSlide = idx;
  const track = document.getElementById('stkTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  document.getElementById('stkNavAlloc')?.classList.toggle('active',    idx === 0);
  document.getElementById('stkNavChart')?.classList.toggle('active',    idx === 1);
  document.getElementById('stkNavTicker')?.classList.toggle('active',   idx === 2);
  if (idx === 1) requestAnimationFrame(() => requestAnimationFrame(() => _renderAccumChart('stocks')));
  if (idx === 2) requestAnimationFrame(() => requestAnimationFrame(() => renderStocksTickerPie()));
}

export function stkAccumRange(r) {
  _stkAccumRange = r;
  document.querySelectorAll('#stkAccumWrap .accum-range-row .ac-range-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === ({ '3M': '3B', '6M': '6B', '1Y': '1T' }[r] || r));
  });
  _renderAccumChart('stocks');
}

// ── Savings Slide ─────────────────────────────────────────────────
export function savSlide(idx) {
  _savSlide = idx;
  const track = document.getElementById('savTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  document.getElementById('savNavAlloc')?.classList.toggle('sav-active', idx === 0);
  document.getElementById('savNavChart')?.classList.toggle('sav-active', idx === 1);
  if (idx === 1) requestAnimationFrame(() => requestAnimationFrame(() => _renderAccumChart('savings')));
}

export function savAccumRange(r) {
  _savAccumRange = r;
  document.querySelectorAll('#savAccumWrap .accum-range-row .ac-range-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === ({ '3M': '3B', '6M': '6B', '1Y': '1T' }[r] || r));
  });
  _renderAccumChart('savings');
}

// ═════════════════════════════════════════════════════════════════
// ACCUMULATION CHART RENDERING
// ═════════════════════════════════════════════════════════════════

async function _renderAccumChart(section) {
  const isCrypto = section === 'crypto';
  const isStocks = section === 'stocks';
  const isSavings = section === 'savings';

  const canvasId = isCrypto ? 'cryptoAccumChart' : isStocks ? 'stkAccumChart' : 'savAccumChart';
  const headerId = isCrypto ? 'cryptoAccumHeader' : isStocks ? 'stkAccumHeader' : 'savAccumHeader';
  const legendId = isCrypto ? 'cryptoAccumLegend' : isStocks ? 'stkAccumLegend' : 'savAccumLegend';
  const range = isCrypto ? _cryptoAccumRange : isStocks ? _stkAccumRange : _savAccumRange;
  const accentHex = isCrypto ? '#8b5cf6' : isStocks ? '#22d3ee' : '#f472b6';
  const accentRgb = isCrypto ? '139,92,246' : isStocks ? '34,211,238' : '244,114,182';

  // Destroy old chart
  if (isCrypto) { if (_cryptoAccumChart) { _cryptoAccumChart.destroy(); _cryptoAccumChart = null; } }
  else if (isStocks) { if (_stkAccumChart) { _stkAccumChart.destroy(); _stkAccumChart = null; } }
  else { if (_savAccumChart) { _savAccumChart.destroy(); _savAccumChart = null; } }

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const assets = isCrypto ? DATA.crypto : isStocks ? DATA.stocks : DATA.savings;
  const T = totals();

  const totalNow = isCrypto ? T.c : isStocks ? T.k : T.sv;
  const totalCost = isCrypto
    ? DATA.crypto.reduce((s, a) => s + (a.costBasisIdr || 0), 0)
    : isStocks
    ? DATA.stocks.reduce((s, h) => s + h.shares * stockMul(h) * (h.seedPrice || 0), 0)
    : DATA.savings.reduce((s, a) => s + (a.idr || 0), 0);
  const totalPnl = totalCost > 0 ? totalNow - totalCost : null;
  const totalRet = totalCost > 0 ? (totalPnl / totalCost * 100) : null;

  // ── KPI header ──
  const header = document.getElementById(headerId);
  if (header) {
    const pnlCls = totalPnl == null ? 'muted' : totalPnl >= 0 ? 'up' : 'down';
    const pnlStr = totalPnl != null
      ? `${totalPnl >= 0 ? '+' : ''}${toDisp(Math.abs(totalPnl))} (${totalRet?.toFixed(1)}%)`
      : '–';
    const kpiColor = isCrypto ? 'var(--crypto)' : isStocks ? 'var(--stocks)' : 'var(--savings)';
    header.innerHTML = `
      <div class="accum-kpi">
        <div class="accum-kpi-sub">${isCrypto ? 'Total Crypto' : isStocks ? 'Total Stocks' : 'Total Savings'}</div>
        <div class="accum-kpi-val" style="color:${kpiColor}">${toDisp(totalNow)}</div>
        <div class="accum-kpi-pnl ${pnlCls}">${pnlStr}</div>
      </div>
      <div class="accum-kpi" style="text-align:right">
        <div class="accum-kpi-sub">Modal</div>
        <div style="font-size:13px;font-weight:600;color:var(--muted)">${totalCost > 0 ? toDisp(totalCost) : '–'}</div>
        <div class="accum-kpi-sub" style="margin-top:2px">${assets.length} aset</div>
      </div>`;
  }

  // ── Color palette per asset ──
  const COLORS = isCrypto
    ? ['#f7931a', '#627eea', '#00a7e4', '#8b5cf6', '#34d399', '#fcd34d', '#fb7185', '#a78bfa', '#67e8f9', '#4ade80']
    : isStocks
    ? ['#22d3ee', '#f5c518', '#8b5cf6', '#34d399', '#fb7185', '#f472b6', '#a78bfa', '#67e8f9', '#fcd34d', '#4ade80']
    : ['#4ade80', '#60a5fa', '#fcd34d', '#fdba74', '#fca5a5', '#93c5fd', '#a5b4fc', '#f472b6', '#34d399'];

  const days = { '3M': 90, '6M': 180, '1Y': 365 }[range] || 90;

  // Current value per asset
  const assetNow = assets.map(item => {
    if (isCrypto) return item.amount * cryptoPrice(item);
    if (isStocks) return item.shares * stockMul(item) * stockPrice(item);
    return item.idr || 0;
  });

  const assetName = i => isCrypto ? assets[i].coin : isStocks ? assets[i].ticker : assets[i].name;

  let labels = [];
  let datasets = [];
  let isSynthetic = false;

  // ── Strategy 1: scale real portfolio history by per-asset fraction ──
  const realHist = [...S.historyData].sort((a, b) => a.date.localeCompare(b.date));
  if (realHist.length >= 4) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const histSrc = realHist.filter(d => new Date(d.date) >= cutoff);
    const src = histSrc.length >= 2 ? histSrc : realHist;

    labels = src.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });

    // Section fraction of total portfolio at current point
    const secFraction = T.t > 0 ? totalNow / T.t : 0;

    datasets = assets.map((item, i) => {
      const assetFraction = totalNow > 0 ? assetNow[i] / totalNow : 0;
      const col = COLORS[i % COLORS.length];
      const values = src.map(h => Math.round(h.value * secFraction * assetFraction));
      return _makeDataset(assetName(i), col, values, labels.length);
    });
  }

  // ── Strategy 2: synthetic per-asset ──
  if (datasets.length < 1) {
    isSynthetic = true;
    const nPts = Math.max(20, days / 3 | 0);
    const now = Date.now();
    const start = now - days * 864e5;
    const vol = isCrypto ? 0.045 : isStocks ? 0.018 : 0.003;

    labels = Array.from({ length: nPts }, (_, i) => {
      const t = nPts > 1 ? i / (nPts - 1) : 1;
      return new Date(start + t * (now - start)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });

    datasets = assets.map((item, i) => {
      const col = COLORS[i % COLORS.length];
      const assetCost = isCrypto ? (item.costBasisIdr || 0)
        : isStocks ? item.shares * stockMul(item) * (item.seedPrice || 0)
        : (item.idr || 0);
      const cost = assetCost > 0 ? assetCost : assetNow[i] * 0.92;

      let seed = 42 + i * 17;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 4294967296; };
      const rndN = () => { const u = rnd() + 1e-10, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

      const values = labels.map((_, j) => {
        const t = labels.length > 1 ? j / (labels.length - 1) : 1;
        return Math.max(1, Math.round((cost + (assetNow[i] - cost) * t) + cost * vol * rndN()));
      });
      values[0] = Math.round(cost);
      values[values.length - 1] = Math.round(assetNow[i]);
      return _makeDataset(assetName(i), col, values, labels.length);
    });
  }

  // ── Draw multi-line chart ──
  const ctx = canvas.getContext('2d');
  const chartObj = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: assets.length <= 8,
          position: 'bottom',
          labels: {
            color: tickColor(),
            font: { family: 'JetBrains Mono', size: 9 },
            boxWidth: 8, padding: 10, usePointStyle: true, pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: { label: c => `  ${c.dataset.label}: ${toDisp(c.raw)}` },
          backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
          titleColor: tooltipTitle(), bodyColor: tooltipBody(),
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10
        }
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 }, border: { color: borderColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, callback: v => formatChartY(v) }, border: { color: borderColor() } }
      },
      animation: { duration: 700 }
    }
  });

  if (isCrypto) _cryptoAccumChart = chartObj;
  else if (isStocks) _stkAccumChart = chartObj;
  else _savAccumChart = chartObj;

  // ── Legend ──
  const legendEl = document.getElementById(legendId);
  if (legendEl) {
    legendEl.innerHTML = assets.map((item, i) => {
      const col = COLORS[i % COLORS.length];
      const name = assetName(i);
      const val = isCrypto
        ? toDisp(item.amount * cryptoPrice(item))
        : isStocks
        ? toDisp(item.shares * stockMul(item) * stockPrice(item))
        : toDisp(item.idr);
      return `<div class="accum-leg-item">
        <div class="accum-leg-dot" style="background:${col}"></div>
        <span>${name}</span>
        <span style="color:var(--text);font-weight:600">${val}</span>
      </div>`;
    }).join('');
    if (isSynthetic) {
      legendEl.innerHTML += `<div style="font-size:8px;color:var(--warn);letter-spacing:.08em;width:100%;margin-top:4px">⚠ Estimasi</div>`;
    }
  }
}

// Helper: build a dataset object
function _makeDataset(label, color, values, nLabels) {
  const showDots = nLabels <= 30;
  return {
    label,
    data: values,
    borderColor: color,
    borderWidth: 1.8,
    backgroundColor: 'transparent',
    pointBackgroundColor: color,
    pointBorderColor: _isLightTheme() ? '#fff' : '#07070f',
    pointBorderWidth: 1.5,
    pointRadius: showDots ? 3 : 0,
    pointHoverRadius: 4,
    tension: 0.4,
    fill: false
  };
}

console.log('[CHARTS] Charts module loaded');
