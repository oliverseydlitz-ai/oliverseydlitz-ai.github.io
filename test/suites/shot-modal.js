// ── The shot pop-up reads one shot against its own club (C43) ────────────
//
// Two defects, both on every shot. "vs avg" compared one shot with the whole
// bag's mean, so a driver read "+40 yds" for being a driver. And the fault list
// ran the engine on the single shot — which can never report anything, because
// a fault needs at least MIN_AFFECTED shots and a per-club floor — so every shot
// said "No faults flagged". Now: the club's own mean (above the floor only), and
// the session's faults this shot is part of.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, UI, clubLabel } = R.app;
const doc = R.window.document;

const shot = (i, o) => ({ _row: i + 2, clubType: '7i', ballSpeed: 110, clubSpeed: 85, smashFactor: 1.29,
  launchAngle: 17, attackAngle: -4, clubPath: 0, launchDirection: 0, carryDistance: 160,
  totalDistance: 168, sideCarry: 2, apex: 90, ...o });
const shots = [
  ...Array.from({ length: 12 }, (_, i) => shot(i, { clubType: 'd', ballSpeed: 150, clubSpeed: 102, smashFactor: 1.47,
    launchAngle: 13, attackAngle: 2, carryDistance: 240, totalDistance: 262 })),
  // 7-irons, every one a poor strike: smash well under the 7-iron floor
  ...Array.from({ length: 12 }, (_, i) => shot(i + 20, { smashFactor: 1.10, ballSpeed: 94 })),
];
const session = Store.stamp({ id: 'm1', date: '2026-09-20',
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' }, shots });

(async () => {
  UI.renderDetail(session);
  await new Promise(r => setTimeout(r, 20));
  const open = row => {
    const tr = [...doc.querySelectorAll('.shot-row')].find(r => r.textContent.trim().startsWith(String(row)));
    if (tr) tr.click();
    return (doc.getElementById('shotModalBody') || {}).textContent || '';
  };
  const drv = open(2);
  ok(drv.length > 0, 'a shot row opens the pop-up');
  ok(new RegExp('vs ' + clubLabel('d') + ' avg').test(drv), `a driver is compared with the driver mean (${(drv.match(/vs [^\n]*? avg/) || [''])[0]})`);
  ok(!/\+\s*\d+(\.\d)? vs avg/.test(drv), 'never with an unnamed whole-bag average');
  ok(/Not part of any fault reported for this session/.test(drv), 'a clean driver says it is in no reported fault');

  const iron = open(22);
  ok(/Part of this session's faults/.test(iron), 'a mishit 7-iron names the session fault it belongs to');
  ok(!/No faults flagged on this shot/.test(drv + iron), 'and "No faults flagged" (true of every shot) is gone');

  // V29: the number on the row is the shot's place in the session, and the
  // pop-up title uses the same number (it used the CSV line: "1" opened "#2").
  const firstBtn = doc.querySelector('.shot-open');
  if (firstBtn) firstBtn.click();
  const title = (doc.getElementById('shotModalTitle') || {}).textContent || '';
  ok(firstBtn && new RegExp('^Shot #' + firstBtn.textContent.trim() + ' ').test(title),
     `row ${firstBtn && firstBtn.textContent.trim()} opens "${title.slice(0, 12)}"`);

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
