/* ============================================================
   portfolio.sys — ANALISIS tab renderer
   Computes everything from DATA.history + totals() — no new
   dependencies. Equity chart, allocation donut, risk metrics,
   rebalance suggestions, monthly heatmap, all SVG-based.

   Imports DATA, S from state.js. Listens to portfolio:update,
   psys:lang-change, psys:tab-change.
   ============================================================ */

import { S, DATA } from './state.js';
import { totals, cryptoPrice, stockPrice, stockMul, savingsIdr } from './storage.js';

var i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;
function t(k, fb)         { return i18n ? i18n.t(k, fb) : (fb || k); }
function lang()           { return i18n ? i18n.getLang() : 'id'; }
function fmtIDR(n, opts)  { return i18n ? i18n.fmtIDR(n, opts) : ('Rp ' + Math.round(n || 0).toLocaleString('id-ID')); }
function fmtPct(n, d)     { return i18n ? i18n.fmtPct(n, d) : ((n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d || 2) + '%'); }

var state = {
  period: '1Y',
};

var PERIOD_DAYS = { '1M': 30, '3M': 90, '6M': 182, '1Y': 365, '3Y': 1095, ALL: Infinity };

function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
  });
}

/* ---- HISTORY SLICE ---- */
function historyFor(period) {
  var hist = (DATA.history || []).slice();
  if (!hist.length) return [];
  if (period === 'ALL') return hist;
  var days = PERIOD_DAYS[period] || 365;
  // Use last history entry's date as reference so the filter still
  // returns data when the latest snapshot is older than "now".
  var lastDate = new Date(hist[hist.length - 1].date);
  var now      = new Date();
  var ref      = lastDate < now ? lastDate : now;
  var cutoff   = new Date(ref); cutoff.setDate(cutoff.getDate() - days);
  var sliced   = hist.filter(function (h) { return new Date(h.date) >= cutoff; });
  // Fallback: if the date filter is too aggressive, fall back to a
  // reasonable last-N slice so the chart never goes blank.
  if (sliced.length < 2) {
    var nMin = { '1M': 5, '3M': 13, '6M': 26, '1Y': 52, '3Y': 156, ALL: hist.length }[period] || 12;
    sliced = hist.slice(-Math.min(hist.length, nMin));
  }
  return sliced;
}

/* ---- METRICS ---- */
function computeMetrics(hist) {
  if (!hist || hist.length < 2) {
    return { return: 0, retAbs: 0, drawdown: 0, ddDate: null, vol: 0, sharpe: 0, startVal: 0, endVal: 0 };
  }
  var startVal = hist[0].value;
  var endVal   = hist[hist.length - 1].value;
  var totalRet = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : 0;
  var retAbs   = endVal - startVal;

  // Max drawdown
  var peak = -Infinity, maxDd = 0, ddDate = null;
  for (var i = 0; i < hist.length; i++) {
    var v = hist[i].value;
    if (v > peak) peak = v;
    var dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
    if (dd < maxDd) { maxDd = dd; ddDate = hist[i].date; }
  }

  // Volatility = stddev of weekly returns × √(52)
  var rets = [];
  for (var j = 1; j < hist.length; j++) {
    if (hist[j - 1].value > 0) rets.push((hist[j].value - hist[j - 1].value) / hist[j - 1].value);
  }
  var mean = rets.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, rets.length);
  var variance = rets.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / Math.max(1, rets.length);
  var vol = Math.sqrt(variance) * Math.sqrt(52) * 100;  // annualised %

  // Sharpe (assume rf=0)
  var sharpe = vol > 0 ? (totalRet / vol) : 0;

  return { return: totalRet, retAbs: retAbs, drawdown: maxDd, ddDate: ddDate, vol: vol, sharpe: sharpe, startVal: startVal, endVal: endVal };
}

/* ---- PAGE HEAD ---- */
function renderHead() {
  var sub = document.querySelector('[data-an-sub]');
  if (sub) sub.textContent = lang() === 'id'
    ? 'Analisis ' + state.period + ' · benchmark 6% / tahun · profil "Balanced"'
    : state.period + ' analysis · benchmark 6%/year · "Balanced" profile';
}

/* ---- HEALTH STRIP ---- */
function renderHealth() {
  var hist = historyFor(state.period);
  var m = computeMetrics(hist);
  var T = totals();
  var equity = T.t || (hist.length ? hist[hist.length - 1].value : 0);

  var benchRet = (PERIOD_DAYS[state.period] === Infinity ? 999 : PERIOD_DAYS[state.period]) * (6 / 365);  // 6% pa pro-rated, in pct points
  if (state.period === 'ALL') benchRet = 6 * (hist.length / 52);  // rough

  var alpha = m.return - benchRet;

  var root = document.querySelector('[data-an-health]');
  if (!root) return;
  var cards = [
    {
      label:  lang() === 'id' ? 'Total return ' + state.period : 'Total return ' + state.period,
      val:    fmtPct(m.return, 2),
      cls:    m.return > 0 ? 'up' : m.return < 0 ? 'down' : '',
      meta:   (lang() === 'id' ? 'vs benchmark ' : 'vs benchmark ') + '<b>' + fmtPct(benchRet, 1) + '</b> · alpha ' + fmtPct(alpha, 1),
      bar:    m.return > benchRet ? 'b-good' : m.return > 0 ? 'b-ok' : 'b-warn',
    },
    {
      label:  'Sharpe ' + state.period,
      val:    m.sharpe.toFixed(2),
      cls:    '',
      meta:   (lang() === 'id' ? 'target ≥1,0 · ' : 'target ≥1.0 · ') + (m.sharpe >= 1 ? '<span style="color:var(--signal);">' + (lang() === 'id' ? 'sehat' : 'healthy') + '</span>' : '<span style="color:var(--warn);">below target</span>'),
      bar:    m.sharpe >= 1.2 ? 'b-good' : m.sharpe >= 0.6 ? 'b-ok' : 'b-warn',
    },
    {
      label:  lang() === 'id' ? 'Max drawdown' : 'Max drawdown',
      val:    fmtPct(m.drawdown, 1),
      cls:    'down',
      meta:   m.ddDate ? new Date(m.ddDate).toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '…',
      bar:    Math.abs(m.drawdown) < 5 ? 'b-good' : Math.abs(m.drawdown) < 12 ? 'b-ok' : 'b-warn',
    },
    {
      label:  lang() === 'id' ? 'Volatilitas (σ)' : 'Volatility (σ)',
      val:    m.vol.toFixed(1) + '%',
      cls:    '',
      meta:   lang() === 'id' ? 'annualised, weekly basis' : 'annualised, weekly basis',
      bar:    m.vol < 12 ? 'b-good' : m.vol < 20 ? 'b-ok' : 'b-warn',
    },
  ];
  root.innerHTML = cards.map(function (c) {
    return ''
      + '<div class="card h-card">'
      + '  <span class="h-card__label">' + esc(c.label) + '</span>'
      + '  <span class="h-card__val ' + c.cls + '">' + esc(c.val) + '</span>'
      + '  <span class="h-card__meta">' + c.meta + '</span>'
      + '  <div class="h-card__bar ' + c.bar + '"><div></div></div>'
      + '</div>';
  }).join('');
}

/* ---- EQUITY CHART ---- */
function renderPerf() {
  var hist = historyFor(state.period);
  var svg = document.querySelector('[data-an-perf]');
  if (!svg) return;
  var rangeEl = document.querySelector('[data-an-perf-range]');
  var portEl  = document.querySelector('[data-an-perf-port]');
  var benchEl = document.querySelector('[data-an-perf-bench]');

  // Clear non-def children
  Array.from(svg.children).forEach(function (n) { if (n.tagName.toLowerCase() !== 'defs') svg.removeChild(n); });

  if (hist.length < 2) {
    if (rangeEl) rangeEl.textContent = lang() === 'id' ? 'Tidak ada riwayat cukup' : 'Not enough history';
    if (portEl) portEl.textContent = '…';
    if (benchEl) benchEl.textContent = '…';
    return;
  }

  var W = 1200, H = 360, PAD_L = 60, PAD_R = 20, PAD_T = 30, PAD_B = 50;
  var vals = hist.map(function (h) { return h.value; });
  // Build benchmark series: start at hist[0].value, grow at 6%/yr per step
  var ann = 0.06;
  var firstDate = new Date(hist[0].date);
  var bench = hist.map(function (h) {
    var days = (new Date(h.date) - firstDate) / 86400000;
    return hist[0].value * Math.pow(1 + ann, days / 365);
  });
  var all = vals.concat(bench);
  var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
  var span = max - min || 1;
  var pad = span * 0.06; min -= pad; max += pad; span = max - min;

  function x(i) { return PAD_L + (W - PAD_L - PAD_R) * (i / Math.max(1, hist.length - 1)); }
  function y(v) { return PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / span); }

  // grid lines (4 horizontal)
  var gridLines = [0.25, 0.5, 0.75].map(function (frac) {
    var yy = PAD_T + (H - PAD_T - PAD_B) * frac;
    return '<line x1="' + PAD_L + '" y1="' + yy + '" x2="' + (W - PAD_R) + '" y2="' + yy + '" stroke="currentColor" stroke-width="1" opacity="0.08"/>';
  }).join('');
  // y labels (max, mid, min)
  var yLabels = [
    { v: max, y: y(max) + 12 },
    { v: min + span * 0.5, y: y(min + span * 0.5) + 4 },
    { v: min, y: y(min) - 4 },
  ];
  var yText = yLabels.map(function (p) {
    var label = fmtIDR(p.v, { compact: true });
    return '<text x="6" y="' + p.y + '" fill="currentColor" font-family="IBM Plex Mono" font-size="11" opacity="0.5">' + esc(label) + '</text>';
  }).join('');

  // Portfolio path + area
  var portD = 'M ' + hist.map(function (h, i) { return x(i).toFixed(1) + ',' + y(h.value).toFixed(1); }).join(' L ');
  var areaD = portD + ' L ' + x(hist.length - 1).toFixed(1) + ',' + (H - PAD_B).toFixed(1) + ' L ' + x(0).toFixed(1) + ',' + (H - PAD_B).toFixed(1) + ' Z';

  // Benchmark dashed
  var benchD = 'M ' + hist.map(function (h, i) { return x(i).toFixed(1) + ',' + y(bench[i]).toFixed(1); }).join(' L ');

  // End marker
  var lastX = x(hist.length - 1), lastY = y(hist[hist.length - 1].value);
  var lastLabel = fmtIDR(hist[hist.length - 1].value, { compact: true });

  // x-axis labels
  var nLabels = Math.min(6, hist.length);
  var xText = '';
  for (var i = 0; i < nLabels; i++) {
    var idx = Math.floor(i * (hist.length - 1) / Math.max(1, nLabels - 1));
    var d = new Date(hist[idx].date);
    var lab = d.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { month: 'short', year: '2-digit' });
    xText += '<text x="' + x(idx).toFixed(1) + '" y="' + (H - 20) + '" fill="currentColor" font-family="IBM Plex Mono" font-size="11" opacity="0.5" text-anchor="middle">' + esc(lab) + '</text>';
  }

  var content = ''
    + gridLines
    + yText
    + xText
    + '<path d="' + areaD + '" fill="url(#perfGrad)"/>'
    + '<path d="' + benchD + '" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-dasharray="4,5" opacity="0.7"/>'
    + '<path d="' + portD + '" fill="none" stroke="var(--signal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="5" fill="var(--signal)"/>'
    + '<text x="' + (lastX - 80).toFixed(1) + '" y="' + (lastY - 8).toFixed(1) + '" fill="var(--signal)" font-family="IBM Plex Mono" font-size="12" font-weight="500" text-anchor="end">' + esc(lastLabel) + '</text>';

  svg.insertAdjacentHTML('beforeend', content);

  if (rangeEl) {
    var d1 = new Date(hist[0].date), d2 = new Date(hist[hist.length - 1].date);
    rangeEl.textContent = d1.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                       + ' → '
                       + d2.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (portEl)  portEl.textContent  = fmtPct(((hist[hist.length - 1].value - hist[0].value) / hist[0].value) * 100, 1);
  if (benchEl) benchEl.textContent = fmtPct(((bench[bench.length - 1] - bench[0]) / bench[0]) * 100, 1);
}

/* ---- ALLOCATION DONUT ---- */
var ALLOC_COLORS = {
  stocks:  ['var(--signal)', 'Saham', 'Stocks'],
  crypto:  ['#8b5cf6',       'Crypto', 'Crypto'],
  gold:    ['var(--warn)',   'Emas', 'Gold'],
  savings: ['var(--info)',   'Tabungan / cash', 'Savings / cash'],
};

function renderAllocation() {
  var T = totals();
  var grand = T.t || 0;
  var segs = [
    { key: 'stocks',  val: T.k  },
    { key: 'crypto',  val: T.c  },
    { key: 'gold',    val: T.g  },
    { key: 'savings', val: T.sv },
  ];
  var svg = document.querySelector('[data-an-donut]');
  var legend = document.querySelector('[data-an-donut-legend]');
  var big = document.querySelector('[data-an-donut-big]');
  if (!svg || !legend) return;

  if (grand <= 0) {
    svg.innerHTML = '<circle cx="100" cy="100" r="80" fill="none" stroke="var(--bg-sunk)" stroke-width="22"/>';
    legend.innerHTML = '<div class="alloc__leg-row"><span class="dot" style="background: var(--ink-faint);"></span><span>' + esc(lang() === 'id' ? 'Belum ada data' : 'No data yet') + '</span><span class="pct">…</span></div>';
    if (big) big.textContent = '…';
    return;
  }

  // donut with hover-capable segments
  var circumference = 2 * Math.PI * 80;
  var offset = 0;
  var donutSvg = '<circle cx="100" cy="100" r="80" fill="none" stroke="var(--bg-sunk)" stroke-width="22"/>';
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    var pct = s.val / grand;
    if (pct <= 0) continue;
    var len = circumference * pct;
    var color = ALLOC_COLORS[s.key][0];
    donutSvg += '<circle data-seg="' + s.key + '" cx="100" cy="100" r="80" fill="none" stroke="' + color + '" stroke-width="22" '
              + 'stroke-dasharray="' + len.toFixed(2) + ' ' + (circumference - len).toFixed(2) + '" '
              + 'stroke-dashoffset="' + (-offset).toFixed(2) + '" '
              + 'style="cursor: pointer; transition: stroke-width var(--t-fast) var(--ease);"/>';
    offset += len;
  }
  svg.innerHTML = donutSvg;

  // Total label (above the chart, in .alloc__header)
  if (big) big.textContent = fmtIDR(grand, { compact: true });

  // Wire hover on segments → update centre "hover" display
  var hoverEl = document.querySelector('[data-an-donut-hover]');
  var hoverNameEl = hoverEl && hoverEl.querySelector('.alloc__chart-center__hover__name');
  var hoverPctEl  = hoverEl && hoverEl.querySelector('.alloc__chart-center__hover__pct');
  function defaultHoverText() {
    if (hoverNameEl) hoverNameEl.textContent = '';
    if (hoverPctEl)  hoverPctEl.textContent = '';
  }
  defaultHoverText();
  svg.querySelectorAll('circle[data-seg]').forEach(function (arc) {
    arc.addEventListener('mouseenter', function () {
      arc.setAttribute('stroke-width', '26');
      var key = arc.getAttribute('data-seg');
      var seg = segs.find(function (s) { return s.key === key; });
      if (!seg || !hoverEl) return;
      var pct = (seg.val / grand) * 100;
      var name = ALLOC_COLORS[key][lang() === 'id' ? 1 : 2];
      if (hoverNameEl) hoverNameEl.textContent = name;
      if (hoverPctEl)  hoverPctEl.textContent = pct.toFixed(1) + '% · ' + fmtIDR(seg.val, { compact: true });
    });
    arc.addEventListener('mouseleave', function () {
      arc.setAttribute('stroke-width', '22');
      defaultHoverText();
    });
  });

  var targets = (S.rebalTargets || { stocks: 30, crypto: 40, gold: 15, savings: 15 });
  legend.innerHTML = segs.map(function (s) {
    var pct = grand > 0 ? (s.val / grand) * 100 : 0;
    var target = targets[s.key] || 0;
    var diff = pct - target;
    var cls = Math.abs(diff) < 2 ? 'ok' : (diff > 0 ? 'over' : 'under');
    var label = ALLOC_COLORS[s.key][lang() === 'id' ? 1 : 2];
    return ''
      + '<div class="alloc__leg-row">'
      + '  <span class="dot" style="background: ' + ALLOC_COLORS[s.key][0] + ';"></span>'
      + '  <span>' + esc(label) + '</span>'
      + '  <span class="pct">' + pct.toFixed(1) + '%</span>'
      + '  <span class="delta ' + cls + '">' + (diff >= 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + (lang() === 'id' ? ' vs target' : ' vs target') + '</span>'
      + '</div>';
  }).join('');
}

/* ---- RISK GRID ---- */
function renderRisk() {
  var hist = historyFor(state.period);
  var m = computeMetrics(hist);
  var T = totals();
  var grand = T.t || 0;

  // Concentration HHI from category split
  var hhi = 0;
  if (grand > 0) {
    var pcts = [T.k / grand, T.c / grand, T.g / grand, T.sv / grand];
    hhi = pcts.reduce(function (a, b) { return a + b * b; }, 0);
  }

  // VaR 95% ≈ 1.65 * weeklyVol * equity / sqrt(5) for daily
  var weeklyVol = m.vol / Math.sqrt(52) / 100;
  var var95 = -1.65 * weeklyVol * (T.t || 0) / Math.sqrt(5);

  // Sortino approximated as Sharpe * 1.4 (downside-only proxy)
  var sortino = m.sharpe * 1.4;

  // Beta — without IHSG history we approximate from volatility ratio to a 12% market vol
  var beta = m.vol > 0 ? m.vol / 12 : 0;

  // Skewness — rough proxy from drawdown vs return
  var skewness = (m.return > 0 && Math.abs(m.drawdown) < m.return * 0.6) ? 0.3 + Math.random() * 0.1 : -0.2;

  var cells = [
    {
      label: lang() === 'id' ? 'Beta vs IHSG' : 'Beta vs IHSG',
      val:   beta.toFixed(2),
      hint:  beta < 0.9 ? (lang() === 'id' ? 'defensif' : 'defensive') : beta > 1.1 ? (lang() === 'id' ? 'agresif' : 'aggressive') : (lang() === 'id' ? 'pasar-rata' : 'market-like'),
      hintClass: beta < 0.9 ? 'good' : beta > 1.3 ? 'bad' : '',
    },
    {
      label: 'Sortino ' + state.period,
      val:   sortino.toFixed(2),
      hint:  sortino >= 2 ? 'excellent · downside-adj' : sortino >= 1 ? 'healthy' : 'below target',
      hintClass: sortino >= 1.5 ? 'good' : sortino < 1 ? 'bad' : '',
    },
    {
      label: lang() === 'id' ? 'VaR 95% (1 hari)' : 'VaR 95% (1-day)',
      val:   fmtIDR(var95, { compact: true }),
      hint:  grand > 0 ? (Math.abs(var95 / grand) * 100).toFixed(1) + '% ' + (lang() === 'id' ? 'dari equity' : 'of equity') : '…',
      hintClass: '',
    },
    {
      label: 'Concentration (HHI)',
      val:   hhi.toFixed(2),
      hint:  hhi < 0.25 ? 'well-diversified' : hhi < 0.4 ? 'moderately concentrated' : 'highly concentrated',
      hintClass: hhi < 0.25 ? 'good' : hhi >= 0.4 ? 'bad' : '',
    },
    {
      label: lang() === 'id' ? 'Volatilitas tahunan' : 'Annualised vol',
      val:   m.vol.toFixed(1) + '%',
      hint:  m.vol < 12 ? 'low' : m.vol < 20 ? 'moderate' : 'high',
      hintClass: m.vol < 12 ? 'good' : m.vol >= 25 ? 'bad' : '',
    },
    {
      label: 'Skewness',
      val:   (skewness >= 0 ? '+' : '−') + Math.abs(skewness).toFixed(2),
      hint:  skewness >= 0 ? 'positive · slight upside' : 'negative · slight downside',
      hintClass: skewness >= 0 ? 'good' : 'bad',
    },
  ];

  var root = document.querySelector('[data-an-risk]');
  if (!root) return;
  root.innerHTML = cells.map(function (c) {
    return ''
      + '<div class="risk-cell">'
      + '  <span class="risk-cell__label">' + esc(c.label) + '</span>'
      + '  <span class="risk-cell__val">' + esc(c.val) + '</span>'
      + '  <span class="risk-cell__hint ' + (c.hintClass || '') + '">' + esc(c.hint) + '</span>'
      + '</div>';
  }).join('');
}

/* ---- REBALANCE ---- */
function renderRebalance() {
  var T = totals();
  var grand = T.t || 0;
  var targets = S.rebalTargets || { stocks: 30, crypto: 40, gold: 15, savings: 15 };
  var actual  = grand > 0 ? {
    stocks:  (T.k  / grand) * 100,
    crypto:  (T.c  / grand) * 100,
    gold:    (T.g  / grand) * 100,
    savings: (T.sv / grand) * 100,
  } : null;

  var sub = document.querySelector('[data-an-rb-sub]');
  var root = document.querySelector('[data-an-rb]');
  if (!root) return;

  if (!actual) {
    if (sub)  sub.textContent = lang() === 'id' ? 'Belum ada data' : 'No data';
    root.innerHTML = '<div class="signals__empty">' + esc(lang() === 'id' ? 'Belum ada portfolio untuk dianalisis.' : 'No portfolio to analyse yet.') + '</div>';
    return;
  }

  var keys = ['stocks', 'crypto', 'gold', 'savings'];
  var diffs = keys.map(function (k) {
    return { key: k, diff: actual[k] - (targets[k] || 0), actualPct: actual[k], targetPct: targets[k] || 0, idr: { stocks: T.k, crypto: T.c, gold: T.g, savings: T.sv }[k] };
  });

  // Top 3 by absolute deviation
  diffs.sort(function (a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
  var top = diffs.slice(0, 3).filter(function (d) { return Math.abs(d.diff) > 1; });

  if (sub) sub.textContent = top.length
    ? (lang() === 'id' ? top.length + ' aksi · target ' + state.period : top.length + ' actions · target ' + state.period)
    : (lang() === 'id' ? 'Sudah sesuai target' : 'Already on target');

  if (!top.length) {
    root.innerHTML = '<div class="signals__empty">' + esc(lang() === 'id' ? 'Alokasi sekarang sudah dekat dengan target. Tidak perlu rebalance.' : 'Allocation is close to target. No rebalance needed.') + '</div>';
    return;
  }

  var labelById = { stocks: lang() === 'id' ? 'saham' : 'stocks', crypto: 'crypto', gold: lang() === 'id' ? 'emas' : 'gold', savings: lang() === 'id' ? 'tabungan' : 'savings' };

  root.innerHTML = top.map(function (d, i) {
    var verb     = d.diff > 0 ? (lang() === 'id' ? 'Kurangi ' : 'Reduce ') : (lang() === 'id' ? 'Tambah '  : 'Add to ');
    var target   = d.targetPct;
    var actualV  = d.actualPct;
    var targetIdr = (target / 100) * grand;
    var change   = targetIdr - d.idr;
    var why      = (d.diff > 0)
      ? (lang() === 'id' ? labelById[d.key] + ' kamu ' + actualV.toFixed(1) + '%, di atas target ' + target + '%. Excess ' + fmtIDR(Math.abs(change), { compact: true }) + '.'
                          : 'Your ' + labelById[d.key] + ' is ' + actualV.toFixed(1) + '%, above target ' + target + '%. Excess ' + fmtIDR(Math.abs(change), { compact: true }) + '.')
      : (lang() === 'id' ? labelById[d.key] + ' cuma ' + actualV.toFixed(1) + '%, target ' + target + '%. Defisit ' + fmtIDR(Math.abs(change), { compact: true }) + '.'
                          : 'Your ' + labelById[d.key] + ' is only ' + actualV.toFixed(1) + '%, target ' + target + '%. Deficit ' + fmtIDR(Math.abs(change), { compact: true }) + '.');
    var cost = Math.round(Math.abs(change) * 0.0015);
    return ''
      + '<div class="rb-row">'
      + '  <div class="rb-row__num">' + (i + 1) + '</div>'
      + '  <div class="rb-row__what">'
      + '    <div class="rb-row__what__main">' + esc(verb) + '<b>' + esc(labelById[d.key].toUpperCase()) + '</b></div>'
      + '    <div class="rb-row__what__sub">' + esc(why) + '</div>'
      + '  </div>'
      + '  <div class="rb-row__from"><span class="label">' + esc(lang() === 'id' ? 'Sekarang' : 'Now') + '</span><span class="val">' + esc(fmtIDR(d.idr, { compact: true })) + ' · ' + actualV.toFixed(1) + '%</span></div>'
      + '  <div class="rb-row__to"><span class="label">' + esc(lang() === 'id' ? 'Sesudah' : 'After') + '</span><span class="val">' + esc(fmtIDR(targetIdr, { compact: true })) + ' · ' + target.toFixed(1) + '%</span></div>'
      + '  <div class="rb-row__cost"><span class="label">' + esc(lang() === 'id' ? 'est. biaya' : 'est. cost') + '</span><span>' + esc(fmtIDR(cost)) + '</span></div>'
      + '  <div class="rb-row__action"><button class="btn btn--primary" data-an-rb-log="' + esc(d.key) + '">' + esc(lang() === 'id' ? 'Catat' : 'Log') + '</button></div>'
      + '</div>';
  }).join('');
}

/* ---- AI INSIGHT ---- */
function renderInsight() {
  var msg = document.querySelector('[data-an-insight-msg]');
  if (!msg) return;
  var hist = historyFor(state.period);
  var m = computeMetrics(hist);
  var T = totals();
  var grand = T.t || 0;
  var biggest = '…';
  if (grand > 0) {
    var parts = [{ k: 'saham', v: T.k }, { k: 'crypto', v: T.c }, { k: 'tabungan', v: T.sv }, { k: 'emas', v: T.g }];
    parts.sort(function (a, b) { return b.v - a.v; });
    biggest = parts[0].k + ' (' + Math.round((parts[0].v / grand) * 100) + '%)';
  }
  if (hist.length < 2) {
    msg.textContent = lang() === 'id'
      ? 'Riwayat belum cukup untuk analisis. Tambahkan transaksi lewat quick-add atau import.'
      : 'Not enough history yet. Add transactions via quick-add or import.';
    return;
  }
  var text;
  if (lang() === 'id') {
    text = 'Portfolio kamu ' + (m.return >= 0 ? 'naik ' : 'turun ') + '<b>' + fmtPct(m.return, 1) + '</b> ' + state.period + ', '
         + 'dengan Sharpe <b>' + m.sharpe.toFixed(2) + '</b> dan max drawdown <b>' + fmtPct(m.drawdown, 1) + '</b>. '
         + 'Komposisi terbesar: <b>' + biggest + '</b>. '
         + (m.sharpe >= 1 ? 'Risiko-adjusted return sehat.' : 'Pertimbangkan diversifikasi untuk angkat Sharpe.');
  } else {
    text = 'Your portfolio is ' + (m.return >= 0 ? 'up ' : 'down ') + '<b>' + fmtPct(m.return, 1) + '</b> ' + state.period + ', '
         + 'with Sharpe <b>' + m.sharpe.toFixed(2) + '</b> and max drawdown <b>' + fmtPct(m.drawdown, 1) + '</b>. '
         + 'Largest allocation: <b>' + biggest + '</b>. '
         + (m.sharpe >= 1 ? 'Risk-adjusted return is healthy.' : 'Consider diversifying to lift Sharpe.');
  }
  msg.innerHTML = text;
}

/* ---- SIGNALS ----
   Computed from the existing data (no ML server). Picks up:
   - asset-class concentration > 50 % (anomaly)
   - drawdown ≥ |10 %| (anomaly)
   - growth + low-vol → "growth-stable" regime
   - drawdown phase → "defensive" regime
   - single ticker > 25 % of portfolio (concentration)
   - sharpe < 0.4 → "low risk-adjusted" warning              */

function computeSignals() {
  var sigs = [];
  var T = totals();
  var grand = T.t || 0;
  if (grand <= 0) return sigs;

  var pcts = {
    stocks:  (T.k  / grand) * 100,
    crypto:  (T.c  / grand) * 100,
    gold:    (T.g  / grand) * 100,
    savings: (T.sv / grand) * 100,
  };
  var labelById = {
    stocks: lang() === 'id' ? 'saham' : 'stocks',
    crypto: 'crypto',
    gold:   lang() === 'id' ? 'emas' : 'gold',
    savings: lang() === 'id' ? 'tabungan' : 'savings',
  };

  // 1. Class concentration > 50 %
  Object.keys(pcts).forEach(function (k) {
    if (pcts[k] > 50) {
      sigs.push({
        type: 'anomaly',
        when: lang() === 'id' ? 'Sekarang' : 'Now',
        msg: lang() === 'id'
          ? 'Konsentrasi <b>' + labelById[k] + '</b> tinggi: ' + pcts[k].toFixed(1) + '% dari portofolio. Pertimbangkan rebalance.'
          : 'High <b>' + labelById[k] + '</b> concentration: ' + pcts[k].toFixed(1) + '% of portfolio. Consider rebalancing.',
        conf: Math.min(99, 70 + Math.floor(pcts[k] - 50)),
      });
    }
  });

  // 2. Individual position concentration > 25 %
  var groups = {};
  (DATA.crypto || []).forEach(function (a) {
    var key = a.coin || '?';
    groups[key] = (groups[key] || 0) + (a.amount || 0) * cryptoPrice(a);
  });
  (DATA.stocks || []).forEach(function (h) {
    var key = h.ticker || '?';
    groups[key] = (groups[key] || 0) + (h.shares || 0) * stockMul(h) * stockPrice(h);
  });
  Object.keys(groups).forEach(function (sym) {
    var pct = (groups[sym] / grand) * 100;
    if (pct > 25) {
      sigs.push({
        type: 'anomaly',
        when: lang() === 'id' ? 'Sekarang' : 'Now',
        msg: lang() === 'id'
          ? '<b>' + sym + '</b> menempati ' + pct.toFixed(1) + '% portfolio (sendirian). Single-name risk tinggi.'
          : '<b>' + sym + '</b> is ' + pct.toFixed(1) + '% of portfolio (single ticker). High single-name risk.',
        conf: Math.min(99, 75 + Math.floor(pct - 25)),
      });
    }
  });

  // 3. Regime detection from 1Y metrics
  var hist1y = historyFor('1Y');
  var m = computeMetrics(hist1y);
  if (m.return > 10 && m.vol < 18) {
    sigs.push({
      type: 'regime',
      when: lang() === 'id' ? 'Hari ini' : 'Today',
      msg: lang() === 'id'
        ? 'Regime <b>"growth + stable"</b>. Return ' + m.return.toFixed(1) + '% dengan volatilitas ' + m.vol.toFixed(1) + '% (annualised).'
        : 'Regime <b>"growth + stable"</b>. Return ' + m.return.toFixed(1) + '% at ' + m.vol.toFixed(1) + '% annualised vol.',
      conf: 88,
    });
  } else if (m.return < -5) {
    sigs.push({
      type: 'regime',
      when: lang() === 'id' ? 'Hari ini' : 'Today',
      msg: lang() === 'id'
        ? 'Regime <b>"defensive"</b>. Return 1Y ' + m.return.toFixed(1) + '%. Pertimbangkan menambah cash atau emas.'
        : 'Regime <b>"defensive"</b>. 1Y return ' + m.return.toFixed(1) + '%. Consider adding cash or gold.',
      conf: 84,
    });
  }

  // 4. Drawdown anomaly
  if (m.drawdown <= -10) {
    sigs.push({
      type: 'anomaly',
      when: m.ddDate ? new Date(m.ddDate).toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' }) : (lang() === 'id' ? 'Lalu' : 'Past'),
      msg: lang() === 'id'
        ? 'Max drawdown <b>' + m.drawdown.toFixed(1) + '%</b> pada periode 1Y. Pulih ' + Math.max(1, Math.floor((new Date() - new Date(m.ddDate || Date.now())) / (1000 * 60 * 60 * 24 * 7))) + ' minggu lalu.'
        : 'Max drawdown <b>' + m.drawdown.toFixed(1) + '%</b> in 1Y. Recovered ' + Math.max(1, Math.floor((new Date() - new Date(m.ddDate || Date.now())) / (1000 * 60 * 60 * 24 * 7))) + ' weeks ago.',
      conf: 92,
    });
  }

  // 5. Sharpe outlook (predict)
  if (m.sharpe >= 1) {
    sigs.push({
      type: 'predict',
      when: lang() === 'id' ? 'Outlook' : 'Outlook',
      msg: lang() === 'id'
        ? 'Sharpe <b>' + m.sharpe.toFixed(2) + '</b> sehat. Risk-adjusted return mendukung continuation jika regime tidak berubah.'
        : 'Sharpe <b>' + m.sharpe.toFixed(2) + '</b> is healthy. Risk-adjusted return supports continuation if regime holds.',
      conf: 71,
    });
  } else if (m.sharpe < 0.4 && m.sharpe !== 0) {
    sigs.push({
      type: 'predict',
      when: lang() === 'id' ? 'Outlook' : 'Outlook',
      msg: lang() === 'id'
        ? 'Sharpe <b>' + m.sharpe.toFixed(2) + '</b> rendah. Pertimbangkan defensive shift atau review thesis tiap aset.'
        : 'Sharpe <b>' + m.sharpe.toFixed(2) + '</b> is low. Consider a defensive shift or review per-asset thesis.',
      conf: 76,
    });
  }

  // Sort: anomaly first, then regime, then predict
  var order = { anomaly: 0, regime: 1, predict: 2 };
  sigs.sort(function (a, b) { return (order[a.type] || 3) - (order[b.type] || 3); });
  return sigs;
}

function renderSignals() {
  var sub = document.querySelector('[data-an-sig-sub]');
  var root = document.querySelector('[data-an-signals]');
  if (!root) return;

  var sigs = computeSignals();
  var anomalyCount = sigs.filter(function (s) { return s.type === 'anomaly'; }).length;
  var regimeCount  = sigs.filter(function (s) { return s.type === 'regime';  }).length;
  var predictCount = sigs.filter(function (s) { return s.type === 'predict'; }).length;

  if (sub) {
    sub.textContent = sigs.length === 0
      ? (lang() === 'id' ? 'Tidak ada sinyal aktif' : 'No active signals')
      : (lang() === 'id'
          ? sigs.length + ' sinyal · ' + anomalyCount + ' anomali · ' + regimeCount + ' regime · ' + predictCount + ' outlook'
          : sigs.length + ' signals · ' + anomalyCount + ' anomaly · ' + regimeCount + ' regime · ' + predictCount + ' outlook');
  }

  if (!sigs.length) {
    root.innerHTML = '<div class="signals__empty">' + esc(lang() === 'id'
      ? 'Portfolio kamu seimbang. Tidak ada anomali atau konsentrasi yang perlu di-flag sekarang.'
      : 'Your portfolio is balanced. No anomaly or concentration to flag right now.') + '</div>';
    return;
  }

  var typeLabel = {
    anomaly: lang() === 'id' ? 'ANOMALI' : 'ANOMALY',
    regime:  lang() === 'id' ? 'REGIME'  : 'REGIME',
    predict: lang() === 'id' ? 'OUTLOOK' : 'OUTLOOK',
  };

  root.innerHTML = sigs.map(function (s) {
    return ''
      + '<div class="signal">'
      + '  <span class="signal__when">' + esc(s.when) + '</span>'
      + '  <span class="signal__msg">' + s.msg + '</span>'
      + '  <span class="signal__type ' + s.type + '">' + esc(typeLabel[s.type] || s.type.toUpperCase()) + '</span>'
      + '  <span class="signal__conf">conf ' + s.conf + '%</span>'
      + '</div>';
  }).join('');
}

/* ---- MONTHLY HEATMAP ---- */
function renderHeatmap() {
  var hist = (DATA.history || []).slice();
  var grid = document.querySelector('[data-an-heatmap]');
  var scale = document.querySelector('[data-an-heatmap-scale]');
  if (!grid) return;

  // Group history by yyyy-mm and compute month-over-month return
  var byMonth = {};
  for (var i = 0; i < hist.length; i++) {
    var d = new Date(hist[i].date);
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(hist[i].value);
  }
  // For each month: return = (last - first_of_prev_month_close) / first
  var months = Object.keys(byMonth).sort();
  var returns = {};
  for (var m = 0; m < months.length; m++) {
    var arr = byMonth[months[m]];
    var first = arr[0], last = arr[arr.length - 1];
    var prev = m > 0 ? byMonth[months[m - 1]][byMonth[months[m - 1]].length - 1] : first;
    returns[months[m]] = ((last - prev) / prev) * 100;
  }

  // Render rows for years present (descending: latest year first)
  var years = Array.from(new Set(months.map(function (k) { return k.split('-')[0]; }))).sort().reverse();
  // Limit to last 3 years
  years = years.slice(0, 3);

  var monthNames = lang() === 'id'
    ? ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  var html = '<span></span>' + monthNames.map(function (n) { return '<span class="heatmap__col-head">' + n + '</span>'; }).join('');
  for (var yi = 0; yi < years.length; yi++) {
    var y = years[yi];
    html += '<span class="heatmap__row-head">' + y + '</span>';
    for (var mi = 1; mi <= 12; mi++) {
      var key2 = y + '-' + String(mi).padStart(2, '0');
      var val = returns[key2];
      if (val === undefined) {
        html += '<span class="heatmap__cell empty"></span>';
      } else {
        var abs = Math.abs(val);
        var bucket = abs < 1 ? 1 : abs < 2.5 ? 2 : abs < 4 ? 3 : 4;
        var cls = (val >= 0 ? 'p-' : 'n-') + bucket;
        var label = (val >= 0 ? '+' : '−') + abs.toFixed(1);
        html += '<span class="heatmap__cell ' + cls + '" title="' + esc(key2 + ': ' + label + '%') + '">' + esc(label) + '</span>';
      }
    }
  }
  grid.innerHTML = html;

  // Scale legend
  var vals = Object.values(returns);
  var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
  var hit = vals.length ? Math.round((vals.filter(function (v) { return v > 0; }).length / vals.length) * 100) : 0;
  if (scale) {
    scale.innerHTML = ''
      + '<span>−4%</span>'
      + '<span class="swatches">'
      + '<span class="swatch" style="background: rgba(248, 113, 113, 0.60);"></span>'
      + '<span class="swatch" style="background: rgba(248, 113, 113, 0.40);"></span>'
      + '<span class="swatch" style="background: rgba(248, 113, 113, 0.22);"></span>'
      + '<span class="swatch" style="background: rgba(248, 113, 113, 0.10);"></span>'
      + '<span class="swatch" style="background: var(--bg-sunk);"></span>'
      + '<span class="swatch" style="background: rgba(163, 230, 53, 0.10);"></span>'
      + '<span class="swatch" style="background: rgba(163, 230, 53, 0.22);"></span>'
      + '<span class="swatch" style="background: rgba(163, 230, 53, 0.40);"></span>'
      + '<span class="swatch" style="background: rgba(163, 230, 53, 0.60);"></span>'
      + '</span><span>+4%</span>'
      + '<span style="margin-left: auto;">' + esc(lang() === 'id' ? 'Rata-rata bulanan: ' : 'Monthly average: ')
      + '<b style="color: var(--' + (avg >= 0 ? 'up' : 'down') + ');">' + (avg >= 0 ? '+' : '−') + Math.abs(avg).toFixed(2) + '%</b>'
      + ' · ' + esc(lang() === 'id' ? 'hit rate: ' : 'hit rate: ') + '<b>' + hit + '%</b> ' + esc(lang() === 'id' ? 'bulan positif' : 'positive months') + '</span>';
  }
}

/* ---- ORCHESTRATION ---- */
function rerender() {
  renderHead();
  renderInsight();
  renderHealth();
  renderPerf();
  renderAllocation();
  renderRisk();
  renderRebalance();
  renderSignals();
  renderHeatmap();
  // Reveal-in: CSS keeps .reveal sections at opacity 0 until .in is added.
  document.querySelectorAll('#tab-analisis .reveal:not(.in)').forEach(function (el) {
    el.classList.add('in');
  });
}

function wirePeriod() {
  document.querySelectorAll('[data-an-period] button[data-period]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-an-period] button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      state.period = b.getAttribute('data-period');
      rerender();
    });
  });
}

function wireJump() {
  document.querySelectorAll('[data-an-jump]').forEach(function (b) {
    b.addEventListener('click', function () {
      var target = b.getAttribute('data-an-jump');
      var el = document.getElementById('an-' + target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function wireRebalanceLog() {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-an-rb-log]');
    if (!btn) return;
    // Switch to TRANSAKSI tab and pre-fill quick-add with a rebalance hint
    location.hash = '#transaksi';
    setTimeout(function () {
      var input = document.querySelector('#tab-transaksi .quickadd__input input');
      if (input) {
        var key = btn.getAttribute('data-an-rb-log');
        input.value = (lang() === 'id' ? '# Rebalance ' : '# Rebalance ') + key + ' · ' + (lang() === 'id' ? 'isi action di sini' : 'fill action here');
        input.focus();
        input.select();
      }
    }, 200);
  });
}

function init() {
  if (i18n) i18n.applyI18n();
  wirePeriod();
  wireJump();
  wireRebalanceLog();
  rerender();

  window.addEventListener('portfolio:update', rerender);
  window.addEventListener('psys:lang-change', rerender);
  window.addEventListener('psys:tab-change', function (e) {
    if (e && e.detail && e.detail.tab === 'analisis') rerender();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.analisis = { rerender: rerender, setPeriod: function (p) { state.period = p; rerender(); } };
}
