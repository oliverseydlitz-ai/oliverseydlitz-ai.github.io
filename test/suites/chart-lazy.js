// ── Chart.js off the critical path (payload plan, Task 2, 4 Oct 2026) ─────
//
// 70 KB gzip / 208 KB raw, paid on every single load (plus the main-thread
// cost of parsing and compiling it) for a library untouched until a chart
// actually renders. The blocking <script> tag is gone; ScrollMotion.chart()
// now builds the real Chart.js instance when the library is already there,
// and otherwise hands back a small pending handle and kicks a one-time
// `ensureChart()` loader, which the app also warms on idle after boot.
//
// Three things this suite protects against, all found while writing it:
//   1. A second `new Chart(` site — scroll-motion.js already counts these,
//      and this suite counts them again, independently, because this is the
//      change that could have introduced one.
//   2. `destroyChart()` (called unconditionally, in a try/catch, every time a
//      chart section re-renders) throwing on a handle that has no real
//      Chart.js instance behind it yet.
//   3. `retintCharts()` — which reads `c.options.scales` on every live
//      chart on a theme toggle — doing the same on a still-pending handle.
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// Comments stripped before scanning — matching this repo's own established
// discipline (a source-scan check has read its own explanatory comment three
// times already, each one named in CLAUDE.md). Several comments in this very
// change quote `new Chart(` and `ensureChart()` as literal text.
const code = src
  .replace(/\/\*[^]*?\*\//g, '')
  .split('\n')
  .map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
  .join('\n');

console.log('— the blocking script tag is gone —');
ok(!/<script[^>]*\bsrc=["']vendor\/chart\.umd\.js["']/.test(html),
   'index.html no longer loads vendor/chart.umd.js via a blocking <script> tag');
ok(/vendor\/chart\.umd\.js/.test(html),
   'the file is still named in index.html (a comment explaining the on-demand load), so this is a deliberate removal, not a dangling reference');

console.log('— the loader exists and is wired into chart() —');
ok(/function ensureChart\(\)/.test(code), 'ScrollMotion.ensureChart() is defined');
ok(/ensureChart,/.test(code) || /ensureChart\s*\}/.test(code),
   'and exported from the ScrollMotion module so the idle warm-up can reach it');
const chartFn = (code.match(/function chart\(canvas, cfg\)[^]*?\n  \}/) || [''])[0];
ok(chartFn.length > 200 && /ensureChart\(\)/.test(chartFn),
   'chart() itself calls ensureChart() on the not-yet-loaded path');
ok(/window\.addEventListener\('load', runWhenIdle\);[^]*?ScrollMotion\.ensureChart\(\)/.test(code) ||
   /ScrollMotion\.ensureChart\(\)\.catch/.test(code),
   'something warms Chart.js on idle after boot, independent of the on-demand path');

console.log('— still exactly one construction site (belt and braces with scroll-motion.js) —');
const newChartCount = [...code.matchAll(/new Chart\(/g)].length;
ok(newChartCount === 1, `exactly one `+'`new Chart(`'+` in app.js (found ${newChartCount})`);
ok(/const inst = new Chart\(canvas, cfg\);/.test(code),
   'and it is still the literal line scroll-motion.js also pins');

console.log('— a pending handle behaves —');
{
  const { load } = require('../load.js');
  const R = load({ before: bw => { delete bw.Chart; } });
  if (!R.ok) { ok(false, 'app.js did not load: ' + R.errors.join('; ')); }
  else {
    const { ScrollMotion } = R.app;
    const canvas = R.window.document.createElement('canvas');
    const cfg = { type: 'line', data: { datasets: [{ label: 'x' }] }, options: {} };
    const handle = ScrollMotion.chart(canvas, cfg);
    ok(!!handle && typeof handle.destroy === 'function',
       'with no Chart global yet, chart() returns a pending handle, not null and not a thrown error');
    ok(canvas.getAttribute('role') === 'img' && !!canvas.getAttribute('aria-label'),
       'the canvas still gets its accessibility attributes while the library is still loading');
    ok(!handle || handle.options === undefined, 'and its .options reads as undefined until a real instance exists');
    let threw = false;
    try { handle && handle.destroy(); } catch (_) { threw = true; }
    ok(!threw, 'destroying a pending handle before Chart.js ever arrives does not throw');
    // Idempotent: a render path can call destroyChart() again defensively.
    try { handle && handle.destroy(); } catch (_) { threw = true; }
    ok(!threw, 'and destroying it twice is still safe');
  }
}

console.log('— retintCharts() tolerates a handle with no .options —');
{
  const { load } = require('../load.js');
  const R = load({ before: bw => { delete bw.Chart; } });
  if (!R.ok) { ok(false, 'app.js did not load: ' + R.errors.join('; ')); }
  else {
    const { Store, UI } = R.app;
    const shot = (i, o) => ({ _row: i + 2, clubType: '7i', ballSpeed: 110, clubSpeed: 85, smashFactor: 1.29,
      launchAngle: 17, attackAngle: -4, clubPath: 0, launchDirection: 0, carryDistance: 160,
      totalDistance: 168, sideCarry: 2, apex: 90, ...o });
    const shots = [
      ...Array.from({ length: 12 }, (_, i) => shot(i, { clubType: 'd', ballSpeed: 150, clubSpeed: 102,
        smashFactor: 1.47, launchAngle: 13, attackAngle: 2, carryDistance: 240, totalDistance: 262 })),
      ...Array.from({ length: 12 }, (_, i) => shot(i + 20, {})),
    ];
    const session = Store.stamp({ id: 'cl1', date: '2026-09-20',
      conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' }, shots });
    let threw = null;
    try {
      // Chart is undefined in this window, so both charts this renders come
      // back as pending handles — exactly the scenario a theme toggle during
      // the brief window before Chart.js arrives would hit.
      UI.renderDetail(session);
      UI.retintCharts();
    } catch (e) { threw = e; }
    ok(!threw, 'rendering a session detail with Chart.js not yet loaded, then retinting, does not throw' +
       (threw ? `: ${threw.message}` : ''));
  }
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exitCode = fail ? 1 : 0;
