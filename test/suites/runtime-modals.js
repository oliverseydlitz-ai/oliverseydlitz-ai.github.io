// ── The six Settings dialogs are the system's modal, not a copy of it (V38) ──
//
// Each one typed the whole .modal rule inline — a 4px radius in a square
// system, blue figures, a z-index of 9999, its own padding — so the redesign
// never reached them and no stylesheet change could. They are built by
// runtimeModal() now. This opens every one from its real Settings row, with
// real sessions, and reads what rendered.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, MemDB } = R.app;
const doc = R.window.document;
const wait = (ms = 30) => new Promise(r => setTimeout(r, ms));
R.window.scrollTo = () => {};

const jit = [-9, -4, 0, 3, 8, -6, 5, -2, 7, -8, 2, 6];
const sess = (id, date, ball, club, base) => Store.stamp({ id, date,
  conditions: { ball, surface: 'grass' },
  shots: jit.map((j, i) => ({ _row: i + 2, clubType: club, ballSpeed: 150 + j / 2, clubSpeed: 104,
    smashFactor: 1.44, launchAngle: 12, attackAngle: 2, carryDistance: base + j, totalDistance: base + 20 })) });

(async () => {
  await wait(50);
  MemDB.saveSession(sess('a', '2026-08-10', 'premium', 'd', 250));
  MemDB.saveSession(sess('b', '2026-08-05', 'range', 'd', 220));
  MemDB.saveSession(sess('c', '2026-08-01', 'premium', '7i', 160));

  const ROWS = { showAnalyticsBtn: 'analyticsModal', showBenchmarksBtn: 'benchmarkModal',
                 showLearningBtn: 'learningModal', showClubAnalysisBtn: 'clubModal',
                 showEfficiencyBtn: 'efficiencyModal' };
  for (const [btn, id] of Object.entries(ROWS)) {
    doc.getElementById(btn).click();
    await wait();
    const m = doc.getElementById(id);
    if (!m) { ok(false, `${btn} opens ${id}`); continue; }
    const styled = [m, ...m.querySelectorAll('*')].filter(e => e.hasAttribute('style'));
    ok(m.classList.contains('modal-overlay') && m.querySelector(':scope > .modal.rt-modal')
       && m.querySelector('.modal-head > .modal-title') && m.querySelector('.modal-head > [data-close]'),
       `${id}: the .modal shell, with a head, a title and a close`);
    ok(!styled.length, `${id}: no inline style anywhere in it${styled.length ? ` (${styled.length})` : ''}`);
    const row = doc.getElementById(btn).querySelector('span').textContent.trim();
    const title = (m.querySelector('.modal-title') || { textContent: '' }).textContent.trim();
    ok(row === title, `${id}: the Settings row says what opens ("${row}" → "${title}")`);
    ok(!/NaN|undefined|Infinity|\[object/.test(m.textContent), `${id}: nothing unrendered in it`);
    const close = m.querySelector('[data-close]');
    if (close) close.click(); else m.remove();
    await wait();
    ok(!doc.getElementById(id), `${id}: ✕ removes it`);
  }

  console.log('— the analytics dialog reads the benchmark\'s group (V39) —');
  doc.getElementById('showAnalyticsBtn').click(); await wait();
  const an = doc.getElementById('analyticsModal').textContent.replace(/\s+/g, ' ');
  doc.getElementById('showBenchmarksBtn').click(); await wait();
  const bm = doc.getElementById('benchmarkModal').textContent.replace(/\s+/g, ' ');
  const carryA = (an.match(/carry (\d+)/i) || [])[1];
  const carryB = (bm.match(/Carry You (\d+)/) || [])[1];
  ok(carryA && carryA === carryB, `the same driver carry on both (${carryA} / ${carryB})`);
  ok(/2 sessions on premium/i.test(an), 'and it names the group it read, which leaves the range session out');
  ok(!/Community/.test(doc.getElementById('showBenchmarksBtn').textContent),
     'no row promises a community the app does not have');

  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exitCode = fail ? 1 : 0;
})();
