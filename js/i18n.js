/* ============================================================
   portfolio.sys — i18n + locale-aware formatters
   Exposes window.psys.i18n for classic-script consumers.
   See: docs/superpowers/specs/2026-05-28-app-redesign-design.md §10.2
   ============================================================ */

(function () {
  'use strict';

  /* ---- STRING DICTIONARIES ----
     Per-phase additions: as each tab is built, its strings are added
     here. Keep keys flat with namespaces ("nav.home", "hero.greet"). */

  var STRINGS = {
    id: {
      /* nav + topbar */
      'nav.home':       'Home',
      'nav.aset':       'Aset',
      'nav.tx':         'Transaksi',
      'nav.an':         'Analisis',
      'nav.start':      'Mulai',
      'nav.signin':     'Masuk dengan Google',
      'nav.signout':    'Keluar',

      /* theme + lang */
      'theme.dark':     'Dark',
      'theme.light':    'Light',

      /* common buttons */
      'btn.save':       'Simpan',
      'btn.cancel':     'Batal',
      'btn.delete':     'Hapus',
      'btn.edit':       'Edit',
      'btn.confirm':    'Konfirmasi',
      'btn.add':        'Tambah',
      'btn.import':     'Impor CSV',
      'btn.export':     'Ekspor',
      'btn.more':       'Lainnya',

      /* time relative */
      'time.now':       'Baru saja',
      'time.today':     'Hari ini',
      'time.yesterday': 'Kemarin',
      'time.lastweek':  'Minggu lalu',

      /* quick-add */
      'qa.placeholder': 'beli 10 BBCA @ 9.425  ·  dividen BMRI 250.000  ·  expense makan siang 35.000',
      'qa.title':       'Catat sesuatu',
      'qa.shortcut':    'tekan',
      'qa.tofocus':     'untuk fokus',
      'qa.examples':    'Contoh:',
      'qa.fail':        'Format tidak dikenali. Coba: ',

      /* status / system */
      'sys.live':       'live',
      'sys.connected':  'tersambung',
      'sys.offline':    'Tidak ada koneksi · harga mungkin tertunda',
      'sys.loading':    'Memuat…',
      'sys.synced':     'semua tersinkron',
      'sys.notadvice':  'BUKAN SARAN INVESTASI',

      /* greeting time-of-day (see spec §7.1) */
      'greet.pagi':     'Selamat pagi,',
      'greet.siang':    'Selamat siang,',
      'greet.sore':     'Selamat sore,',
      'greet.malam':    'Selamat malam,',
    },
    en: {
      'nav.home':       'Home',
      'nav.aset':       'Assets',
      'nav.tx':         'Transactions',
      'nav.an':         'Analysis',
      'nav.start':      'Start',
      'nav.signin':     'Sign in with Google',
      'nav.signout':    'Sign out',

      'theme.dark':     'Dark',
      'theme.light':    'Light',

      'btn.save':       'Save',
      'btn.cancel':     'Cancel',
      'btn.delete':     'Delete',
      'btn.edit':       'Edit',
      'btn.confirm':    'Confirm',
      'btn.add':        'Add',
      'btn.import':     'Import CSV',
      'btn.export':     'Export',
      'btn.more':       'More',

      'time.now':       'Just now',
      'time.today':     'Today',
      'time.yesterday': 'Yesterday',
      'time.lastweek':  'Last week',

      'qa.placeholder': 'buy 10 BBCA @ 9425  ·  div BMRI 250000  ·  expense 35000 lunch',
      'qa.title':       'Log something',
      'qa.shortcut':    'press',
      'qa.tofocus':     'to focus',
      'qa.examples':    'Examples:',
      'qa.fail':        'Unrecognised format. Try: ',

      'sys.live':       'live',
      'sys.connected':  'connected',
      'sys.offline':    'No internet · prices may be stale',
      'sys.loading':    'Loading…',
      'sys.synced':     'all synced',
      'sys.notadvice':  'NOT INVESTMENT ADVICE',

      'greet.pagi':     'Good morning,',
      'greet.siang':    'Good day,',
      'greet.sore':     'Good afternoon,',
      'greet.malam':    'Good evening,',
    }
  };

  /* ---- STATE ---- */

  var LS_KEY = 'portfolio.lang';
  var lang =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY))
    || (typeof navigator !== 'undefined' && /^id/.test(navigator.language || '') ? 'id' : 'id');
  // default 'id' even if navigator is en — primary audience is Indonesian.

  if (lang !== 'id' && lang !== 'en') lang = 'id';

  /* ---- CORE API ---- */

  function getLang() { return lang; }

  function t(key, fallback) {
    var dict = STRINGS[lang] || STRINGS.id;
    return (dict[key] !== undefined) ? dict[key] : (fallback !== undefined ? fallback : key);
  }

  function setLang(next) {
    if (next !== 'id' && next !== 'en') return;
    lang = next;
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, lang);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('data-lang', lang);
    }
    applyI18n();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('psys:lang-change', { detail: { lang: lang } }));
    }
  }

  function applyI18n(root) {
    root = root || document;
    var els = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val !== key) el.textContent = val;
    }
    var elsHtml = root.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < elsHtml.length; j++) {
      var h = elsHtml[j];
      var hk = h.getAttribute('data-i18n-html');
      var hv = t(hk);
      if (hv !== hk) h.innerHTML = hv;
    }
    var elsPh = root.querySelectorAll('[data-i18n-placeholder]');
    for (var k = 0; k < elsPh.length; k++) {
      var p = elsPh[k];
      var pk = p.getAttribute('data-i18n-placeholder');
      var pv = t(pk);
      if (pv !== pk) p.setAttribute('placeholder', pv);
    }
    var elsTitle = root.querySelectorAll('[data-i18n-title]');
    for (var ti = 0; ti < elsTitle.length; ti++) {
      var te = elsTitle[ti];
      var tk = te.getAttribute('data-i18n-title');
      var tv = t(tk);
      if (tv !== tk) te.setAttribute('title', tv);
    }
    // sync lang buttons
    var btns = (root.querySelectorAll ? root : document).querySelectorAll('[data-lang-btn]');
    for (var b = 0; b < btns.length; b++) {
      btns[b].setAttribute('aria-pressed',
        btns[b].getAttribute('data-lang-btn') === lang ? 'true' : 'false');
    }
  }

  /* Allow runtime extension of the dictionary (per-phase additions). */
  function extend(dict) {
    if (!dict) return;
    if (dict.id) for (var ki in dict.id) STRINGS.id[ki] = dict.id[ki];
    if (dict.en) for (var ke in dict.en) STRINGS.en[ke] = dict.en[ke];
  }

  /* ---- FORMATTERS ---- */

  function localeFor() { return lang === 'id' ? 'id-ID' : 'en-US'; }

  /** Format rupiah. `compact: true` → "Rp 1,2 jt" / "Rp 1.2M" style. */
  function fmtIDR(n, opts) {
    opts = opts || {};
    if (n === null || n === undefined || isNaN(n)) return '…';
    var loc = localeFor();
    if (opts.compact) {
      var abs = Math.abs(n);
      if (lang === 'id') {
        if (abs >= 1e12) return (n / 1e12).toLocaleString(loc, { maximumFractionDigits: 1 }) + ' T';
        if (abs >= 1e9)  return 'Rp ' + (n / 1e9).toLocaleString(loc, { maximumFractionDigits: 1 }) + ' M';
        if (abs >= 1e6)  return 'Rp ' + (n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 }) + ' jt';
        if (abs >= 1e3)  return 'Rp ' + (n / 1e3).toLocaleString(loc, { maximumFractionDigits: 1 }) + ' rb';
      } else {
        if (abs >= 1e12) return 'Rp ' + (n / 1e12).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'T';
        if (abs >= 1e9)  return 'Rp ' + (n / 1e9).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'B';
        if (abs >= 1e6)  return 'Rp ' + (n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'M';
        if (abs >= 1e3)  return 'Rp ' + (n / 1e3).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'k';
      }
      return 'Rp ' + Math.round(n).toLocaleString(loc);
    }
    return 'Rp ' + Math.round(n).toLocaleString(loc);
  }

  /** Format a plain number with locale separators. */
  function fmtNum(n, opts) {
    if (n === null || n === undefined || isNaN(n)) return '…';
    return Number(n).toLocaleString(localeFor(), opts || {});
  }

  /** Format a percentage with sign. */
  function fmtPct(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '…';
    if (digits === undefined) digits = 2;
    var formatted = Math.abs(n).toLocaleString(localeFor(),
      { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (n >= 0 ? '+' : '−') + formatted + '%';
  }

  /** Format an absolute delta with sign and "Rp" prefix. */
  function fmtDeltaIDR(n, opts) {
    if (n === null || n === undefined || isNaN(n)) return '…';
    var prefix = n >= 0 ? '+' : '−';
    return prefix + fmtIDR(Math.abs(n), opts);
  }

  function fmtTime(date) {
    var d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleTimeString(localeFor(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }

  function fmtDate(date) {
    var d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleDateString(localeFor(), { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Relative time, locale-aware. "Baru saja", "Kemarin", "3 hari lalu", etc. */
  function relTime(date) {
    var d = (date instanceof Date) ? date : new Date(date);
    var now = new Date();
    var diff = (now - d) / 1000; // seconds
    if (diff < 30)   return t('time.now');
    if (diff < 60)   return lang === 'id' ? Math.floor(diff) + ' detik lalu'    : Math.floor(diff)        + 's ago';
    if (diff < 3600) return lang === 'id' ? Math.floor(diff / 60) + ' menit lalu' : Math.floor(diff / 60) + 'm ago';
    if (sameDay(d, now))                   return fmtTime(d);
    if (sameDay(d, addDays(now, -1)))      return t('time.yesterday');
    if (diff < 7 * 86400) {
      var days = Math.floor(diff / 86400);
      return lang === 'id' ? days + ' hari lalu' : days + 'd ago';
    }
    if (diff < 30 * 86400) {
      var weeks = Math.floor(diff / (7 * 86400));
      return lang === 'id' ? weeks + ' minggu lalu' : weeks + 'w ago';
    }
    return fmtDate(d);
  }

  /** Parse Indonesian-flavoured number idioms: "9.425", "9,425", "9425",
      "9k", "9 jt", "1,5jt", "1.2M". Returns Number or NaN. */
  function parseAmount(input) {
    if (input === null || input === undefined) return NaN;
    if (typeof input === 'number') return input;
    var s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s) return NaN;
    // remove currency markers
    s = s.replace(/^rp\.?\s*/i, '').replace(/idr\s*/i, '');
    // multiplier
    var mult = 1;
    var m = s.match(/^([\d.,\s]+)\s*(t|m|b|k|jt|rb|ribu|juta|jt\.|mil|miliar|triliun|t\.?)$/i);
    if (m) {
      s = m[1].trim();
      var unit = m[2].toLowerCase();
      if (unit === 't' || unit === 'triliun')                  mult = 1e12;
      else if (unit === 'b' || unit === 'm' || unit === 'mil' || unit === 'miliar') mult = 1e9;
      else if (unit === 'jt' || unit === 'jt.' || unit === 'juta')                  mult = 1e6;
      else if (unit === 'k' || unit === 'rb' || unit === 'ribu')                    mult = 1e3;
    }
    // Now normalise the digit string.
    // Heuristic: in Bahasa, "." is thousands sep, "," is decimal.
    // In English, ","  is thousands sep, "." is decimal.
    // We pick by which separator appears LAST.
    var hasDot   = s.indexOf('.') !== -1;
    var hasComma = s.indexOf(',') !== -1;
    if (hasDot && hasComma) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // ID style: 9.425,50
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // EN style: 9,425.50
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Ambiguous comma — decide by count of comma groups
      var parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Likely decimal: "1,5"
        s = parts[0] + '.' + parts[1];
      } else {
        // Thousands: "1,000"
        s = s.replace(/,/g, '');
      }
    } else if (hasDot) {
      // Ambiguous dot
      var dparts = s.split('.');
      if (dparts.length === 2 && dparts[1].length <= 2 && dparts[0].length <= 3) {
        // Likely decimal in EN: "1.5"
        // (but in ID could be thousands: "1.234" — covered by length check)
        // Keep as-is
      } else {
        // Thousands sep (ID-style): "9.425"
        s = s.replace(/\./g, '');
      }
    }
    var n = parseFloat(s);
    if (isNaN(n)) return NaN;
    return n * mult;
  }

  /* ---- HELPERS ---- */

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
  }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }

  /** Greeting key per local time-of-day, per spec §7.1.
      Returns 'greet.pagi' | 'greet.siang' | 'greet.sore' | 'greet.malam'. */
  function greetingKey(now) {
    var h = (now || new Date()).getHours();
    if (h >= 4  && h < 11) return 'greet.pagi';
    if (h >= 11 && h < 15) return 'greet.siang';
    if (h >= 15 && h < 18) return 'greet.sore';
    return 'greet.malam';
  }

  /* ---- WIRE LANG TOGGLES + RE-APPLY ON CHANGE ---- */

  function wireGlobalListeners() {
    var btns = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < btns.length; i++) {
      // Avoid double-binding if called more than once
      if (btns[i].dataset.psysLangWired) continue;
      btns[i].dataset.psysLangWired = '1';
      btns[i].addEventListener('click', (function (btn) {
        return function () { setLang(btn.getAttribute('data-lang-btn')); };
      })(btns[i]));
    }
  }

  /* ---- BOOTSTRAP ---- */

  if (typeof document !== 'undefined') {
    // Apply early so document.documentElement[lang] is correct before paint
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        applyI18n();
        wireGlobalListeners();
      });
    } else {
      applyI18n();
      wireGlobalListeners();
    }
  }

  /* ---- EXPORT ---- */

  var api = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    applyI18n: applyI18n,
    extend: extend,
    fmtIDR: fmtIDR,
    fmtNum: fmtNum,
    fmtPct: fmtPct,
    fmtDeltaIDR: fmtDeltaIDR,
    fmtTime: fmtTime,
    fmtDate: fmtDate,
    relTime: relTime,
    parseAmount: parseAmount,
    greetingKey: greetingKey
  };

  if (typeof window !== 'undefined') {
    window.psys = window.psys || {};
    window.psys.i18n = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
