const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Goals, AnalyticsHub: AH, Metrics, Store } = M;

const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 105, smashFactor: 1.44,
  launchAngle: 12, attackAngle: 2, carryDistance: 250, totalDistance: 270, ...o });
const sess = (id, date, shots) => Store.stamp({ id, date,
  conditions: { ball: 'premium', surface: 'grass' }, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));

console.log('— a goal is not achieved by a device misread —');
// Progress was `Math.max` over every reading ever, which is by construction
// the value most likely to be wrong. A smash goal of 1.50 was "achieved" by
// one glitched 1.71 — past what a legal clubface can produce.
const glitched = sess('a', '2026-08-01', [
  ...many(20),
  { _row: 99, ...shot({ smashFactor: 1.71, ballSpeed: 244, carryDistance: 402 }) },
]);
ok(Goals.getProgress('smash', [glitched]) === 1.44,
   `the smash goal reads 1.44, not the impossible 1.71 (ceiling ${Metrics.CEILING.smashFactor})`);
ok(Goals.getProgress('carry', [glitched]) === 402,
   'carry still reads 402 — deliberately unscreened, because a long drive is unusual, not impossible');
ok(Goals.getProgress('ball_speed', [glitched]) === 244, 'and ball speed likewise');
ok(Goals.getProgress('sessions', [glitched]) === 1, 'session counts are unaffected');
ok(Goals.getProgress('carry', []) === 0, 'and no data is not a crash');

console.log('— session frequency does not divide by zero —');
// `sessions.length / days * 7` with every session on the same day is Infinity,
// and the modal rendered "Infinity sessions/week".
const sameDay = AH.generateMetricsDashboard([
  sess('b','2026-08-01T10:00:00Z', many(10)), sess('c','2026-08-01T14:00:00Z', many(10))]);
ok(!/Infinity|NaN/.test(sameDay.sessionFrequency), `same-day sessions: "${sameDay.sessionFrequency}"`);
ok(/all one day/.test(sameDay.sessionFrequency), 'and it says what it actually saw');

// A rate off a span shorter than a week is arithmetic, not a habit.
const twoDays = AH.generateMetricsDashboard([
  sess('d','2026-08-03', many(10)), sess('e','2026-08-01', many(10))]);
ok(!/sessions\/week/.test(twoDays.sessionFrequency),
   `two sessions two days apart is not "7.0 sessions/week" (${twoDays.sessionFrequency})`);

const month = AH.generateMetricsDashboard([
  sess('f','2026-08-29', many(10)), sess('g','2026-08-01', many(10))]);
ok(/sessions\/week/.test(month.sessionFrequency),
   `over a real span it does give a rate (${month.sessionFrequency})`);

console.log('— a missing launch angle is missing, not zero —');
// `s.launchAngle || 0` turned every absent reading into a 0° launch, so the
// range always started at 0 — a launch nobody has ever produced.
const noLaunch = AH.generateMetricsDashboard([sess('h','2026-08-01',
  many(10).map(s => { const { launchAngle, ...rest } = s; return rest; }))]);
ok(noLaunch.launchAngleRange === null, 'with no launch data there is no range at all');
const partial = AH.generateMetricsDashboard([sess('i','2026-08-01', [
  { _row: 2, ...shot({ launchAngle: 12 }) },
  (() => { const { launchAngle, ...rest } = shot(); return { _row: 3, ...rest }; })(),
])]);
ok(partial.launchAngleRange[0] === 12,
   `one reading of 12° gives a range starting at 12, not 0 (${JSON.stringify(partial.launchAngleRange)})`);

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
