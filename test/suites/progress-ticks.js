// ── Progress chart axes print at the metric's own precision (V31) ────────
//
// Chart.js picks tick steps such as 0.00625 and prints them in full, so the
// smash axis read "1.43125". The configs are captured from the real render.
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const cfgs = [];
const R = require('../load.js').load({ before: w => {
  w.Chart = function Chart(canvas, cfg) { cfgs.push(cfg); return { destroy(){}, update(){}, reset(){}, options: cfg.options }; };
}});
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { MemDB, UI, Store } = R.app;
const shots = n => Array.from({ length: n }, (_, i) => ({ clubType: '7i', ballSpeed: 120 + i % 3,
  clubSpeed: 85, smashFactor: 1.38 + (i % 4) / 100, launchAngle: 17, attackAngle: -3.5, clubPath: 1,
  carryDistance: 165 + i % 5, totalDistance: 175, spinRate: 6500 }));
['p1', 'p2', 'p3'].forEach((id, k) => MemDB.saveSession(Store.stamp({ id, date: `2026-09-0${k + 1}T10:00:00Z`,
  conditions: { ball: 'premium', surface: 'grass' }, shots: shots(12) })));

(async () => {
  await UI.renderProgress(await Store.getSessions());
  await new Promise(r => setTimeout(r, 50));
  const by = t => cfgs.find(c => c.options?.scales?.y?.title?.text === t);
  const cases = [['Smash Factor', 1.43125, '1.43'], ['Carry (yds)', 166.25, '166'],
                 ['Attack Angle (°)', -3.4375, '-3.4'], ['Session Score', 72.5, '73']];
  for (const [title, v, want] of cases) {
    const cfg = by(title);
    const cb = cfg && cfg.options.scales.y.ticks.callback;
    ok(typeof cb === 'function' && String(cb(v)) === want,
      `${title} axis prints ${v} as ${want} (${cb ? cb(v) : 'no callback'})`);
  }
  const aa = by('Attack Angle (°)');
  ok(aa && aa.data.datasets[0].fill === false, 'the attack-angle series has no area fill');
  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
