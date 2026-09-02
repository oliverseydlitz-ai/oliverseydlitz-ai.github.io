const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Benchmarks: B, Metrics, Conditions, Store } = M;

// The Progress trend box is the app's headline "am I getting better" surface,
// and it had the three faults the rest of the app exists to avoid: it pooled
// across ball types, it had no significance test, and it graded tier-2 angles
// on a fixed sign across a whole bag — "attack angle: higher is better" is
// true of a driver and is a thin strike with a 7-iron.

console.log('— an angle is judged against its band, never a fixed sign —');
const band = { lo: 2, hi: 5, label: '+2 to +5°' };
ok(B.movedToward(band, -2, 0) === 'toward', 'moving up toward the band is toward it');
ok(B.movedToward(band, 8, 6) === 'toward', 'and so is moving DOWN toward it from above');
ok(B.movedToward(band, 0, -2) === 'away', 'moving further below is away');
ok(B.movedToward(band, 6, 9) === 'away', 'and so is moving further above');
ok(B.movedToward(band, 3, 4) === 'inside', 'a move inside the band is not a regression either way');
ok(B.movedToward(band, 3, 3) === 'inside', 'nor is no move at all');
ok(B.movedToward(band, 0, 8) === 'away', 'crossing the band and overshooting further out is away');
ok(B.movedToward(band, -1, 8) === 'level',
   'an exactly equal distance the other side of the band is level, not progress');
ok(B.movedToward(null, 1, 2) === null, 'no band, no verdict');
ok(B.movedToward(band, NaN, 2) === null, 'and a missing reading is not a verdict either');

console.log('— the driver band is the target, not the tour average —');
// The original bug this whole area came from: the PGA driver attack angle is
// -1.3° (descending). Aiming at the tour average is aiming at the wrong thing.
const d = B.targetsFor('d');
ok(d.attack.lo > 0, `the driver attack target is positive (${d.attack.lo}–${d.attack.hi})`);
ok(B.movedToward(d.attack, -3, -1) === 'toward', 'a driver climbing out of a descending blow is progress');
const i7 = B.targetsFor('7i');
ok(i7.attack.hi <= 0, `the 7-iron attack target is descending (${i7.attack.lo}–${i7.attack.hi})`);
ok(B.movedToward(i7.attack, -1, 2) === 'away',
   'the SAME move that helps a driver is a thin strike with a 7-iron — which a fixed sign cannot express');

console.log('— a change is only a change when it beats your own spread —');
const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 105, smashFactor: 1.43,
  launchAngle: 13, attackAngle: -1, carryDistance: 250, totalDistance: 270, ...o });
const sess = (id, date, o) => Store.stamp({ id, date,
  conditions: { ball: 'premium', surface: 'grass' },
  shots: Array.from({ length: 12 }, (_, i) => ({ _row: i + 2, ...shot(o) })) });
const history = [
  sess('a','2026-08-01'), sess('b','2026-07-25'), sess('c','2026-07-18'),
  sess('d','2026-07-11'), sess('e','2026-07-04'),
];
// Identical shots every session give a typical error of exactly zero, and the
// threshold is 2.77 * that. `Math.abs(delta) >= 0` is true for EVERY delta —
// including a delta of nothing — so a perfectly uniform history used to make
// any number at all a real change. `Rounds.trend()` had the same hole.
const flat = Metrics.changeIsReal('carryDistance', 1, 12, history, 'd');
ok(flat.real === null, 'a history with zero spread cannot judge a change, rather than judging every change');
ok(flat.source === 'flat-history', 'and it says which kind of "cannot say" this is');
ok(Metrics.changeIsReal('carryDistance', 0, 12, history, 'd').real !== true,
   'a delta of exactly nothing is never a real change');

// A history with real scatter behaves normally.
const vary = history.map((sn, k) => Store.stamp({ ...sn, id: sn.id + 'v',
  shots: sn.shots.map((s, i) => ({ ...s, carryDistance: 250 + ((i * 7 + k * 3) % 11) - 5 })) }));
const tiny = Metrics.changeIsReal('carryDistance', 1, 12, vary, 'd');
const big  = Metrics.changeIsReal('carryDistance', 40, 12, vary, 'd');
ok(tiny.real === false, 'a 1-yard move off a real spread is not a move');
ok(big.real === true, 'a 40-yard move is');
ok(typeof tiny.threshold === 'number' && tiny.threshold > 0,
   `and the box can say what it would take (${tiny.threshold.toFixed(1)} yds)`);
const noHistory = Metrics.changeIsReal('carryDistance', 40, 12, [history[0]], 'd');
ok(noHistory.real === null && /more session/.test(noHistory.note || ''),
   'with too little history it says so rather than guessing');

console.log('— and only sessions on the same equipment are compared —');
const prem = sess('p','2026-08-01');
const rng  = Store.stamp({ id: 'r', date: '2026-08-02',
  conditions: { ball: 'range', surface: 'mat' }, shots: prem.shots });
ok(Conditions.comparable(prem, history[0]) === true, 'two premium/grass sessions are comparable');
ok(Conditions.comparable(prem, rng) === false,
   'a premium session and a range-ball one are not — a ball change moves every carry at once');
ok(Conditions.comparable(rng, rng) === true, 'and a session is comparable with itself');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
