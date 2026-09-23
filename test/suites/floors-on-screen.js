// ── No club mean on screen below its floor (C44) ─────────────────────────
//
// Metrics sets 10 shots before any club mean and 15 before a tier-2 angle, and
// the engines obeyed it — but four surfaces printed the numbers anyway: the
// session card (a 9-shot carry), the launch windows (attack angle at 9), the
// averaged ball flight, and the Progress club benchmarks. Each now says how
// many shots it has instead.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, UI, MemDB, Metrics } = R.app;
const doc = R.window.document;

const mk = (id, n, date) => Store.stamp({ id, date, conditions: { ball: 'premium', surface: 'grass' },
  shots: Array.from({ length: n }, (_, i) => ({ _row: i + 2, clubType: '7i', ballSpeed: 112, clubSpeed: 85,
    smashFactor: 1.32, launchAngle: 17.3, attackAngle: -4.1, carryDistance: 163, totalDistance: 170,
    launchDirection: 0, clubPath: 0, sideCarry: 1, apex: 90 })) });

(async () => {
  const nine = mk('nine', 9, '2026-09-20');
  UI.renderDetail(nine);
  await new Promise(r => setTimeout(r, 20));
  const lw = (doc.getElementById('launchWindows') || {}).textContent || '';
  ok(/9\/15 shots/.test(lw), `launch windows at 9 shots say 9/15 (${lw.replace(/\s+/g, ' ').slice(0, 80)})`);
  ok(!/17\.3°|-4\.1°/.test(lw), 'and print no launch or attack angle');
  const bf = (doc.getElementById('ballFlight') || {}).textContent || '';
  ok(/not enough to average a flight/.test(bf), 'the ball flight waits for the floor');

  // The session card, on the home list.
  if (typeof UI.renderSessionList === 'function') {
    UI.renderSessionList([nine]);
    const card = (doc.querySelector('.session-card') || {}).textContent || '';
    ok(!/\b163\b/.test(card) && /9 of 10\s*\S+ carry/.test(card.replace(/\s+/g, ' ')), 'the session card shows 9/10, not a 9-shot carry');
    ok(/9 of 15\s*\S+ launch/.test(card.replace(/\s+/g, ' ')), 'and launch waits for 15');
  } else ok(false, 'UI.renderSessionList is exported');

  // Above the floor the numbers come back.
  const fifteen = mk('fifteen', 15, '2026-09-21');
  UI.renderDetail(fifteen);
  await new Promise(r => setTimeout(r, 20));
  const lw2 = (doc.getElementById('launchWindows') || {}).textContent || '';
  ok(/17\.3°/.test(lw2) && /-4\.1°/.test(lw2), 'at 15 shots the angles are shown');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
