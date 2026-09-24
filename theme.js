// Runs in <head>, before the stylesheet paints anything (R27). app.js loads at
// the end of <body> behind ~300 KB of vendor scripts, so a dark-scheme phone
// used to paint the light theme first and flip — about 1.8 s of white on a
// slow connection. Same rule as app.js's initThemeEarly, which stays as the
// fallback for anything that loads app.js without this file (the tests).
(function () {
  try {
    var saved = localStorage.getItem('slTheme');
    var dark = saved ? saved === 'dark'
      : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (_) {}
})();
