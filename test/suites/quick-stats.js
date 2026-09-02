const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { QuickStats: QS, ShotScorer, Benchmarks: B, Metrics, Store } = M;

// The four tiles at the top of the home screen are the most-looked-at numbers
// in the app, and three of the four were bag-mix artifacts: "Avg" was the mean
// carry of a driver, a 7-iron and a wedge together, and "Consistency" was the
// spread of that same pool — which is the driver-to-wedge gap, not
// repeatability. CLAUDE.md already says this about the feedback band in as
// many words: "Pooled across a bag it measures the driver-to-wedge gap."
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 88, clubSpeed: 65, smashFactor: 1.35,
  launchAngle: 18, attackAngle: -3.5, clubPath: -1, carryDistance: 160, totalDistance: 172, ...o });
const sess = (id, conditions, shots) => Store.stamp({ id, date: '2026-07-01', conditions, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));
const prem = { ball: 'premium', surface: 'grass' };

console.log('— the row is anchored on one club, not the whole bag —');
const mixed = sess('a', prem, [
  ...many(30, { clubType: 'd', carryDistance: 250, ballSpeed: 150, clubSpeed: 105, smashFactor: 1.43 }),
  ...many(12, { clubType: 'pw', carryDistance: 110 }),
]);
const p = QS.pick([mixed]);
ok(p.club === 'd', 'it picks the club with the most shots — the one being worked on');
ok(p.n === 30, 'and reports how many that is');
// The pooled mean of 30 drivers and 12 wedges is ~210 yards, a number that
// describes no club in the bag and moves with which clubs you happened to hit.
const pooled = mixed.shots.reduce((a,s)=>a+s.carryDistance,0) / mixed.shots.length;
ok(Math.round(pooled) === 210, `the old pooled "Avg" was ${Math.round(pooled)} yds — no club in this bag`);
ok(p.club !== null && Math.round(
     p.shots.filter(s=>s.clubType===p.club).reduce((a,s)=>a+s.carryDistance,0) /
     p.shots.filter(s=>s.clubType===p.club).length) === 250,
   'the anchored figure is the driver at 250');

console.log('— and on one set of conditions —');
const twoBalls = [
  sess('b', prem, many(30, { clubType: 'd', carryDistance: 250 })),
  sess('c', { ball: 'range', surface: 'mat' }, many(40, { clubType: '3w', carryDistance: 200 })),
];
const p2 = QS.pick(twoBalls);
ok(p2.club === 'd',
   'the range-ball session has MORE shots and is still not what the row is about');
ok(p2.ball && p2.ball.id === 'premium', 'and the row can name the ball it used');
// Deliberately a different anchor from the yardage book. That table wants the
// biggest comparable sample because you club off it; this row answers "how am
// I hitting it now", so it follows the equipment of the most recent session —
// the same anchor the Progress trend uses.
const flipped = QS.pick([twoBalls[1], twoBalls[0]]);
ok(flipped.ball.id === 'range',
   'put the range session first and the row follows it — most recent, not largest');
ok(M.Analytics.conditionGroups(twoBalls)[0].ball.id === 'range',
   'while the yardage book, on the same data, still picks the larger group');

console.log('— below the floor there is no club number to show —');
const p3 = QS.pick([sess('d', prem, many(6, { clubType: 'd' }))]);
ok(p3.n < Metrics.MIN_SHOTS_REPORT, `6 shots is under the floor of ${Metrics.MIN_SHOTS_REPORT}`);
ok(QS.pick([sess('e', prem, [])]).club === null, 'and no shots at all is not a crash');

console.log('— the shot score reads the target band, not a private ideal —');
// It scored attack angle against a single point: driver 3 (the LPGA AVERAGE,
// which is the conflation this codebase has fixed three times), other clubs +1
// where the real band is 0 to -2 — the wrong sign.
const band = B.targetsFor('d').attack;
const at = a => ShotScorer.score({ clubType: 'd', smashFactor: 1.45, attackAngle: a });
ok(at(band.lo) === at(band.hi),
   `+${band.lo}° and +${band.hi}° score the same — anywhere inside the band is full marks`);
ok(at(3) === at(band.hi), 'and +3° is worth no more than the top of the band, because it is not special');
ok(at(band.hi + 4) < at(band.hi), 'outside the band the score falls away');
ok(at(band.lo - 4) < at(band.lo), 'in both directions');
const other = B.targetsFor('3w').attack;
ok(other.hi <= 0, `a fairway wood's target is level-to-down (${other.lo}–${other.hi}), not the +1 it scored against`);
ok(ShotScorer.score({ clubType: '3w', smashFactor: 1.45, attackAngle: other.hi }) >
   ShotScorer.score({ clubType: '3w', smashFactor: 1.45, attackAngle: 1 }),
   'so a wood inside its band now outscores one at the old hardcoded ideal');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
