// Landing-page skip: returning users who have already signed in get sent
// straight to /app.html. External file so the CSP script-src stays 'self'.
// Append ?stay=1 to force the landing page to render.
(function () {
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('stay') === '1') return;
    if (localStorage.getItem('cf-returning') === '1') {
      location.replace('/app.html');
    }
  } catch (e) {
    /* ignore */
  }
})();
