/* ============================================================
   portfolio.sys — minimal 3-tab router
   hashchange + History API. No framework.
   - URL #home | #transaksi | #analisis selects the matching panel
   - Falls back to #home when hash is empty or unknown
   - Updates aria-current on the corresponding tab link
   - Emits `psys:tab-change` event { tab } for lazy-load consumers
   ============================================================ */

(function () {
  'use strict';

  var TABS = ['home', 'transaksi', 'analisis'];

  function tabFromHash() {
    var h = (location.hash || '').replace(/^#/, '').toLowerCase();
    return TABS.indexOf(h) !== -1 ? h : 'home';
  }

  function setActive(tab) {
    // panels
    var panels = document.querySelectorAll('.tab-panel[data-tab]');
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      if (p.getAttribute('data-tab') === tab) p.setAttribute('data-active', 'true');
      else p.removeAttribute('data-active');
    }
    // tab links
    var links = document.querySelectorAll('.tab[data-tab]');
    for (var j = 0; j < links.length; j++) {
      var l = links[j];
      if (l.getAttribute('data-tab') === tab) l.setAttribute('aria-current', 'page');
      else l.removeAttribute('aria-current');
    }
    // scroll to top of main on tab change for predictable UX
    if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: 'smooth' });
    // event for lazy-load consumers (e.g. ANALISIS imports Chart.js on demand)
    window.dispatchEvent(new CustomEvent('psys:tab-change', { detail: { tab: tab } }));
  }

  function onHashChange() {
    setActive(tabFromHash());
  }

  function init() {
    // If no hash, set the default without polluting history.
    if (!location.hash) {
      try { history.replaceState(null, '', '#home'); } catch (e) { location.hash = '#home'; }
    }
    setActive(tabFromHash());
    window.addEventListener('hashchange', onHashChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Cloud-status pill data-state writer.
     firebase-config.js writes text into #cloudStatusText; this observer
     mirrors the text into a `data-state` attribute on the parent
     `.cloud-pill` so CSS can colour the dot per state. */
  function wireCloudPill() {
    var pill = document.getElementById('cloudStatus');
    var text = document.getElementById('cloudStatusText');
    if (!pill || !text) return;
    function reflect() {
      var s = (text.textContent || '').toLowerCase().trim();
      var state = 'offline';
      if (s.indexOf('synced')  !== -1) state = 'synced';
      else if (s.indexOf('saving')   !== -1) state = 'saving';
      else if (s.indexOf('loading')  !== -1) state = 'loading';
      else if (s.indexOf('denied')   !== -1 || s.indexOf('error') !== -1) state = 'error';
      else if (s.indexOf('offline')  !== -1) state = 'offline';
      pill.setAttribute('data-state', state);
    }
    reflect();
    new MutationObserver(reflect).observe(text, { childList: true, characterData: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireCloudPill);
  } else {
    wireCloudPill();
  }

  /* Online/offline banner */
  function wireOfflineBanner() {
    var b = document.getElementById('offlineBanner');
    if (!b) return;
    function update() {
      if (navigator.onLine === false) b.removeAttribute('hidden');
      else b.setAttribute('hidden', '');
    }
    update();
    window.addEventListener('online',  update);
    window.addEventListener('offline', update);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireOfflineBanner);
  } else {
    wireOfflineBanner();
  }

  // Expose for debugging
  if (typeof window !== 'undefined') {
    window.psys = window.psys || {};
    window.psys.router = { goto: function (t) { if (TABS.indexOf(t) !== -1) location.hash = '#' + t; }, getTab: tabFromHash };
  }
})();
