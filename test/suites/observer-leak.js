// ── A chart nobody scrolls to is not kept alive (R29) ────────────────────
//
// ScrollMotion watches each chart and section rule until it is first seen,
// then disconnects. One that is never scrolled to never fires, so it never
// disconnected — and it held the canvas and, through its callback, the
// destroyed chart: ~190 KB per session detail opened, growing without bound.
// A fake IntersectionObserver counts what is still being watched.
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const connected = new Set();
const R = require('../load.js').load({ before: w => {
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.el = el; connected.add(this); }
    disconnect() { connected.delete(this); }
  };
}});
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const SM = R.app.ScrollMotion, doc = R.window.document;
ok(SM.SUPPORTED === true, 'the fake observer is what the module sees');

const base = connected.size;
const host = doc.createElement('div'); doc.body.appendChild(host);
const charts = [];
for (let i = 0; i < 5; i++) {
  const c = doc.createElement('canvas'); host.appendChild(c);
  charts.push(SM.chart(c, { type: 'line', data: { datasets: [] }, options: {} }));
}
ok(connected.size === base + 5, `each chart is watched until seen (${connected.size - base})`);
charts.forEach(c => c.destroy());
ok(connected.size === base, 'destroying a chart ends its watch');

const blocks = [];
for (let i = 0; i < 4; i++) {
  const b = doc.createElement('canvas'); host.appendChild(b); blocks.push(b);
  SM.chart(b, { type: 'bar', data: { datasets: [] }, options: {} });
}
const sec = doc.createElement('div'); sec.className = 'section-block'; host.appendChild(sec);
SM.scan();
const before = SM.watching(), ioBefore = connected.size;
ok(before >= 5, `the four charts and the section rules are pending (${before})`);
host.innerHTML = '';                       // a re-render throws them away undestroyed
SM.scan();
ok(SM.watching() === before - 5 && connected.size === ioBefore - 5,
  `a re-render drops the five watches whose elements left the page (${before - SM.watching()} dropped)`);
const rest = SM.watching();

// Seen once, then released — the original contract still holds.
const c = doc.createElement('canvas'); doc.body.appendChild(c);
let drawn = 0;
const stop = SM.observe(c, () => drawn++);
const io = [...connected].find(o => o.el === c);
io.cb([{ isIntersecting: true }]);
ok(drawn === 1 && !connected.has(io) && SM.watching() === rest, 'first sight fires once and disconnects');
ok(typeof stop === 'function', 'observe hands back a stop handle');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exitCode = fail ? 1 : 0;
