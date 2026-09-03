const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Features: F, Conditions: C } = R.app;

// The question a golfer has on the way home. Two things stop it being a
// highlight reel: the session it reads against is picked by conditions rather
// than by date, and the arrows come from changeIsReal rather than from a sign.

const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
  launchAngle: 17, attackAngle: -3, carryDistance: 160, apex: 90, ...o });
// Real shot-to-shot spread inside each session, because that spread IS the
// threshold. A fixture of fourteen identical shots has a zero noise floor, and
// Metrics.changeIsReal correctly refuses to call anything against it — the
// 'flat-history' guard. That would make this suite test the guard, not the row.
const JITTER = [-4, 3, -2, 5, -1, 2, -3, 1, 4, -5, 0, 2, -2, 3];
const sess = (id, date, cond, over = {}) => ({ id, date,
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed', ...cond },
  shots: JITTER.map(j => {
    const base = shot(over);
    return { ...base, carryDistance: base.carryDistance + j, ballSpeed: base.ballSpeed + j * 0.2 };
  }) });

console.log('— the comparison session is picked by conditions, not by date —');
const today   = sess('now',   '2026-09-03', {});
const rangeYd = sess('range', '2026-09-02', { ball: 'range' });
const premium = sess('older', '2026-08-20', {});
const pick = F.lastComparable(today, [today, rangeYd, premium]);
ok(pick && pick.id === 'older',
   'it skips YESTERDAY\'s range-ball session for the older premium one — a premium round read against a range bucket reports the ball as progress');
ok(F.lastComparable(today, [today, rangeYd]) === null,
   'and when nothing comparable exists it returns null rather than reaching further back and pretending');
ok(F.lastComparable(today, [today]) === null, 'one session compares against nothing');
ok(F.lastComparable(null, [today]) === null, 'no session, no answer');

console.log('— and must share a club —');
const wedgeOnly = { ...sess('w', '2026-08-25', {}), shots: Array.from({ length: 14 }, () => shot({ clubType: 'pw' })) };
ok(F.lastComparable(today, [today, wedgeOnly]) === null,
   'a session with no club in common is not a comparison — there is nothing to put side by side');
ok(F.lastComparable(today, [today, wedgeOnly, premium]).id === 'older', 'the one that does share a club is found');

console.log('— a future session is never the "last" one —');
const tomorrow = sess('future', '2026-09-10', {});
ok(F.lastComparable(today, [today, tomorrow, premium]).id === 'older',
   'a later session cannot be what this one is read against');

console.log('— without history, arrows are a sign; with it, they are a claim —');
const before = sess('b', '2026-08-20', {}, { carryDistance: 160, ballSpeed: 118 });
const after  = sess('a', '2026-09-03', {}, { carryDistance: 161, ballSpeed: 118.3 });
const bare = F.compare(after, before);
ok(bare.every(r => r.real === null), 'with no history every row is untested — null, not false');
ok(bare.tested === false, 'and the block says it was not tested');

// A flat run of sessions is the case Metrics.changeIsReal has a named guard
// for, so build a history with real spread instead.
const history = [155, 162, 158, 164, 159, 161].map((c, i) =>
  sess('h' + i, `2026-0${7 + Math.floor(i / 4)}-${String(10 + i * 3).padStart(2, '0')}`, {}, { carryDistance: c }));
const tested = F.compare(after, before, [...history, before, after]);
ok(tested.tested === true, 'with history the block says it was tested');
const carry = tested.find(r => r.label === 'Avg carry');
ok(carry.real === false, `a 1-yard move against a 155-164 spread is NOT real (real=${carry.real})`);
ok(carry.good === null, 'so it gets no colour — a green arrow on a yard is the same mistake as a personal best off one reading');
ok(carry.delta === '1', 'the number is still shown, because a golfer is entitled to see what they hit');
ok(tested.caveats.some(c => /not "no improvement"/i.test(c)),
   'and the block says plainly that "within your own variation" is not the same as "no improvement"');

console.log('— a move that clears the spread does get a verdict —');
const big = sess('big', '2026-09-03', {}, { carryDistance: 178, ballSpeed: 118 });
const bigRows = F.compare(big, before, [...history, before, big]);
const bigCarry = bigRows.find(r => r.label === 'Avg carry');
ok(bigCarry.real === true, `an 18-yard move clears it (real=${bigCarry.real})`);
ok(bigCarry.good === true, 'and gets its verdict');
ok(bigCarry.dir === 'up', 'in the right direction');

console.log('— conditions still outrank everything —');
// Even a real move is left without a verdict when the ball changed: the
// difference is the equipment as much as the golfer.
const rangeAfter = sess('ra', '2026-09-03', { ball: 'range' }, { carryDistance: 178 });
const mixed = F.compare(rangeAfter, before, [...history, before, rangeAfter]);
const mc = mixed.find(r => r.label === 'Avg carry');
ok(mc.withheld === true, 'the carry row is withheld across ball types');
ok(mc.good === null, 'with no verdict on it');
ok(mixed.comparable === false, 'and the block knows the two are not comparable');
ok(mixed.caveats.some(c => /different balls/i.test(c)), 'and says which difference it was');

console.log('— never the bag —');
ok(tested.club === '7i', 'the comparison names one club');
ok(tested.clubShots >= 10, 'above the report floor, in both sessions');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
