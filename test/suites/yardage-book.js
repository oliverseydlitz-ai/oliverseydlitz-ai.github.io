const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Analytics: A, Metrics, Conditions, Store } = M;

// The yardage book is the screen a golfer stands over a shot with, and it was
// the one screen enforcing none of the app's own rules: it pooled every session
// regardless of ball type, printed a stock number off any number of shots, and
// showed a modelled carry in bold as though the device had measured it.
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 88, clubSpeed: 65, smashFactor: 1.35,
  launchAngle: 18, attackAngle: -3.5, carryDistance: 160, totalDistance: 172, ...o });
const sess = (id, conditions, shots) => Store.stamp({ id, date: '2026-07-01', conditions, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));

console.log('— ten shots before a club mean, the same floor as everything else —');
const thin = A.yardageBook([sess('a', { ball: 'premium', surface: 'grass' }, [
  ...many(12, { clubType: '7i' }),
  ...many(4,  { clubType: 'd', carryDistance: 240, totalDistance: 262 }),
])]);
const seven = thin.find(b => b.club === '7i');
const driver = thin.find(b => b.club === 'd');
ok(Metrics.MIN_SHOTS_REPORT === 10, 'the floor is the shared constant, not a local one');
ok(seven.enough === true && seven.carry !== null, '12 shots gets a mean');
ok(driver.enough === false, '4 shots does not');
ok(driver.carry === null, 'and there is no number to render by accident');
ok(driver.need === 6, 'it says how many more are needed');
ok(driver.count === 4, 'the club still appears — it is in the bag, it just has no answer yet');
ok(driver.cv === null, 'and no spread verdict either');

console.log('— the mean is an interval, never a bare point —');
ok(typeof seven.carry.mean === 'number' && typeof seven.carry.ci === 'number',
   'carry comes back as mean ± ci');
ok(seven.carry.n === 12, 'carrying its own n');
ok(Object.prototype.hasOwnProperty.call(seven.carry, 'dropped'),
   'and how many shots the trim removed');

console.log('— spread is relative, so a wedge and a driver are judged alike —');
// Same absolute SD on both clubs. On fixed ±yard bands the wedge looked tight
// and the driver looked wide for identical striking.
const spread = (c, carry) => many(14, { clubType: c, carryDistance: carry })
  .map((s, i) => ({ ...s, carryDistance: carry + (i % 2 ? 8 : -8) }));
const rel = A.yardageBook([sess('b', { ball: 'premium', surface: 'grass' },
  [...spread('pw', 110), ...spread('d', 250)])]);
const pw = rel.find(b => b.club === 'pw'), dr = rel.find(b => b.club === 'd');
ok(Math.abs(pw.stdCarry - dr.stdCarry) < 0.5, 'identical absolute spread on both clubs');
ok(pw.cv > dr.cv * 2, 'but the wedge is the wider one relative to how far it goes');

console.log('— conditions are grouped, not pooled —');
const groups = A.conditionGroups([
  sess('c', { ball: 'premium', surface: 'grass' }, many(20)),
  sess('d', { ball: 'range',   surface: 'mat'   }, many(30)),
  sess('e', { ball: 'premium', surface: 'grass' }, many(10)),
]);
ok(groups.length === 2, 'two distinct condition signatures');
ok(groups[0].sessions.length === 2 && groups[0].ball.id === 'premium',
   'the largest group by SHOT count leads, not by session count');
ok(groups[0].sessions.reduce((n,s)=>n+s.shots.length,0) === 30, 'and it is the 30-shot premium group');
ok(groups[1].ball.id === 'range', 'the range-ball sessions stay in their own group');
ok(A.conditionGroups([]).length === 0, 'and no sessions is not a crash');

console.log('— an unrecorded ball is its own group, not silently premium —');
const g2 = A.conditionGroups([
  sess('f', { ball: 'premium', surface: 'grass' }, many(10)),
  sess('g', {}, many(10)),
]);
ok(g2.length === 2, 'a session with no conditions does not join the premium pool');
ok(g2.some(g => g.ball.id === 'unknown'), 'it groups under "not recorded"');
ok(g2.every(g => !g.ball.gappingValid || g.ball.id === 'premium'),
   'and only the premium group claims gapping validity');

console.log('— the numbers themselves are unchanged where they were right —');
ok(Math.round(seven.avgCarry) === 160, 'a clean 12-shot 7-iron still averages 160');
ok(seven.minCarry === 160 && seven.maxCarry === 160, 'range still reads off the raw carries');
ok(Math.round(seven.avgTotal) === 172, 'total is still computed — it is displayed, never prescribed from');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
