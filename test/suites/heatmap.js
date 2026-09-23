// ── The practice heatmap shows this week, on the right day (V3) ─────────
//
// It stepped back 125 days and then back again to a Monday, so the last
// column ended up to six days before today: the week you are in was never on
// it. And days were keyed by toISOString() of a local midnight — the previous
// day anywhere east of UTC — while a stored '2026-07-01' parsed as UTC
// midnight, which is 30 June anywhere west of it.
//
// Run under three timezones, because the second defect does not exist in UTC,
// which is what CI and this container run in.
const { execFileSync } = require('child_process');
if (!process.env.HM_CHILD) {
  let fail = 0;
  for (const tz of ['UTC', 'Europe/Berlin', 'America/Los_Angeles']) {
    let out = '';
    try { out = execFileSync(process.execPath, [__filename], { env: { ...process.env, TZ: tz, HM_CHILD: '1' }, encoding: 'utf8', stdio: 'pipe' }); }
    catch (e) { out = (e.stdout || '') + (e.stderr || ''); fail++; }
    out.split('\n').filter(l => /PASS|FAIL/.test(l)).forEach(l => console.log(l.replace(/(PASS|FAIL)  /, `$1  [${tz}] `)));
  }
  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
}

const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { UI } = R.app;
const W = R.window;

// A Wednesday. The session is dated the Monday of the same week, as the
// import form writes it: a bare calendar date.
const now = new W.Date(2026, 8, 23, 15, 0, 0);          // Wed 23 Sep 2026, 15:00 local
const cells = UI.heatmapCells([{ date: '2026-09-21', shots: new Array(20).fill({}) },
                               { date: '2026-09-23', shots: new Array(5).fill({}) }], now);
const past = cells.filter(c => !c.future);
ok(cells.length === 18 * 7, `18 full weeks (${cells.length} cells)`);
ok(past[past.length - 1].key === '2026-09-23', `the last day drawn is today (got ${past[past.length - 1].key})`);
ok(cells.filter(c => c.future).length === 4, 'and Thursday to Sunday of this week are drawn empty');
const mon = past.find(c => c.key === '2026-09-21');
ok(mon && mon.n === 20, `a session dated Monday lands on Monday, in any timezone (${mon ? mon.n : 'missing'})`);
ok((past.find(c => c.key === '2026-09-23') || {}).n === 5, 'and today\'s lands on today');
ok(past[0].key === '2026-05-25', `the first column starts on a Monday 17 weeks back (${past[0].key})`);

process.exit(fail ? 1 : 0);
