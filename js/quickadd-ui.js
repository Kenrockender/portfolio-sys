/* ============================================================
   portfolio.sys — quick-add UI wiring (shared by HOME + TRANSAKSI)
   Finds every `.quickadd` container and wires:
   - input focus from `T` keyboard shortcut (active tab only)
   - Enter submit + Save-button click → psys.quickadd.run()
   - inline result row (ok/err)

   Classic script. No imports. Runs once on DOMContentLoaded
   then again whenever the DOM changes (mutation observer on
   #tab-transaksi etc, in case transaksi.js re-renders).
   ============================================================ */

(function () {
  'use strict';

  function activeTab() {
    return document.querySelector('.tab-panel[data-active="true"]') || document;
  }

  function getInputFor(quick) {
    return quick.querySelector('.quickadd__input input, input.quickadd__input__field');
  }

  function wireOne(quick) {
    if (!quick || quick.dataset.psysQa) return;
    quick.dataset.psysQa = '1';
    var input  = getInputFor(quick);
    var submit = quick.querySelector('.quickadd__submit, .btn--primary');
    var result = quick.querySelector('.quickadd__result');
    var inputWrap = quick.querySelector('.quickadd__input');

    function showResult(r) {
      if (!result) return;
      if (!r) { result.hidden = true; result.textContent = ''; result.classList.remove('is-ok', 'is-err'); return; }
      result.hidden = false;
      result.classList.toggle('is-ok',  !!r.ok);
      result.classList.toggle('is-err', !r.ok);
      result.textContent = r.message || '';
      if (inputWrap) inputWrap.classList.toggle('is-error', !r.ok);
      if (r.ok) setTimeout(function () {
        if (inputWrap) inputWrap.classList.remove('is-error');
        if (result) { result.hidden = true; result.textContent = ''; result.classList.remove('is-ok', 'is-err'); }
      }, 3000);
    }

    function submitNow() {
      if (!input) return;
      var cmd = (input.value || '').trim();
      if (!cmd) return;
      var qa = window.psys && window.psys.quickadd;
      if (!qa || typeof qa.run !== 'function') {
        showResult({ ok: false, message: 'Quick-add not loaded yet.' });
        return;
      }
      var r = qa.run(cmd);
      showResult(r);
      if (r && r.ok) input.value = '';
    }

    if (submit) submit.addEventListener('click', submitNow);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitNow(); }
        if (e.key === 'Escape') { input.blur(); }
      });
      input.addEventListener('input', function () {
        if (inputWrap) inputWrap.classList.remove('is-error');
        if (result && !result.hidden) showResult(null);
      });
    }
  }

  function wireAll() {
    document.querySelectorAll('.quickadd').forEach(wireOne);
  }

  /* Global T shortcut — focus quick-add in the currently-active tab. */
  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 't' && e.key !== 'T') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(document.activeElement)) return;
    var quick = activeTab().querySelector('.quickadd');
    if (!quick) quick = document.querySelector('.quickadd');
    if (!quick) return;
    var input = getInputFor(quick);
    if (!input) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  /* Re-wire when tabs change (transaksi.js may re-render its quickadd) */
  window.addEventListener('psys:tab-change', wireAll);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAll);
  } else {
    wireAll();
  }
})();
