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
// The 402 and the 244 are the SAME shot as the 1.71: one misread, of the whole
// shot (C12). Screening the smash and then crowning that shot's carry and ball
// speed as personal bests was the defect. A long carry on a plausible shot is
// still counted — carry has no ceiling of its own, because a long drive is
// unusual, not impossible.
ok(Goals.getProgress('carry', [glitched]) !== 402,
   `carry does not read 402 off the misread shot (${Goals.getProgress('carry', [glitched])})`);
ok(Goals.getProgress('ball_speed', [glitched]) !== 244, 'and neither does its ball speed');
const bomb = sess('a2', '2026-08-02', [...many(20), { _row: 98, ...shot({ smashFactor: 1.49, ballSpeed: 190, carryDistance: 330 }) }]);
ok(Goals.getProgress('carry', [bomb]) === 330, 'while a long drive on a plausible strike still counts');
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
// `s.launchAngle || 0` turned every absent reading into a 0° launch. The
// figure is now one club's interval, so a gap must not drag its mean.
const noLaunch = AH.generateMetricsDashboard([sess('h','2026-08-01',
  many(12).map(s => { const { launchAngle, ...rest } = s; return rest; }))]);
ok(noLaunch.launch === null, 'with no launch data there is no launch figure at all');
const partial = AH.generateMetricsDashboard([sess('i','2026-08-01',
  many(12).map((s, i) => { if (i % 2) return s; const { launchAngle, ...rest } = s; return rest; }))]);
ok(partial.launch && partial.launch.mean === 12,
   `six readings of 12° and six gaps read 12°, not 6° (${partial.launch && partial.launch.mean})`);

console.log('— V39: one club, one ball, the same figure as "Where you sit" —');
// It pooled every session on every ball, so the carry beside the benchmark
// disagreed with it by a yard and the consistency with the home row.
const jit = [-9, -4, 0, 3, 8, -6, 5, -2, 7, -8, 2, 6];
const mix = (id, date, ball, club, base) => Store.stamp({ id, date,
  conditions: { ball, surface: 'grass' },
  shots: jit.map((j, i) => ({ _row: i + 2, ...shot({ clubType: club, carryDistance: base + j,
    ballSpeed: (club === 'd' ? 150 : 120) + j / 2, launchAngle: 12 + j / 10 }) })) });
const hist = [mix('p','2026-08-10','premium','d',250), mix('q','2026-08-05','range','d',220),
              mix('r','2026-08-01','premium','7i',160)];
const hub = AH.generateMetricsDashboard(hist);
const pub = M.CommunityInsights.published(hist);
ok(hub.clubType === 'd' && pub.club === 'd', 'both read the driver');
ok(Math.round(hub.carry.mean) === Math.round(pub.rows[0].you.mean),
   `the carry is the benchmark's carry (${Math.round(hub.carry.mean)} vs ${Math.round(pub.rows[0].you.mean)})`);
ok(hub.group.sessions === 2 && hub.group.shots === 24,
   `the range-ball session is not pooled in (${hub.group.sessions} sessions, ${hub.group.shots} shots)`);
ok(hub.ballSpeed && Math.abs(hub.ballSpeed.mean - 150) < 1,
   'ball speed is the driver\'s, not averaged with a 7-iron');
ok(!('improvementTrend' in hub) && hub.trend && typeof hub.trend.real === 'boolean',
   `the trend is ClubAnalyzer's verdict, not "any positive delta is an improvement" (${hub.trend.label})`);
const thin = AH.generateMetricsDashboard([sess('t','2026-08-01', many(4))]);
ok(thin.carry === null && thin.need === 6, 'below the floor there is no club figure, and it says how many more');
ok(thin.clubs[0].carry === null && thin.clubs[0].need === 6, 'nor a per-club carry in the list');
const CA = M.ClubAnalyzer.compareClubs(hist);
const drv = CA.find(c => c.club === M.clubLabel('d'));
ok(drv && drv.shotCount === 12 && Math.abs(drv.avgCarry - pub.rows[0].you.mean) <= 1,
   `club by club reads the same group (${drv && drv.shotCount} driver shots, ${drv && drv.avgCarry} yds)`);
ok(!CA.some(c => c.club === M.clubLabel('7i') && c.avgCarry !== null && c.shotCount < 10),
   'and a club under the floor prints no carry');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
