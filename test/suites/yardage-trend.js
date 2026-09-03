const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Analytics: A, ClubAnalyzer: CA, Metrics } = R.app;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// The book says what you carry. The question straight after it is whether that
// is moving, and the book could not answer it.

const JITTER = [-4, 3, -2, 5, -1, 2, -3, 1, 4, -5, 0, 2];
const sess = (date, carry, club = '7i', n = 12, cond = {}) => ({
  id: 'S' + date + club, date,
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed', ...cond },
  shots: Array.from({ length: n }, (_, i) => ({
    clubType: club, ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
    launchAngle: 17, attackAngle: -3, carryDistance: carry + JITTER[i % JITTER.length] })),
});

console.log('— a session below the club floor is dropped, not plotted thin —');
const thin = sess('2026-08-05', 160, '7i', 4);
const full = ['2026-08-10', '2026-08-17', '2026-08-24'].map(d => sess(d, 160));
const withThin = A.clubSeries([thin, ...full], '7i');
ok(withThin && withThin.n === 3,
   'the 4-shot session is not a point — on a sparkline it looks exactly like a 20-shot one, and the eye reads the line');
ok(A.clubSeries([thin], '7i') === null, 'a series of nothing is null');

console.log('— two points is a difference, not a shape —');
ok(A.clubSeries(full.slice(0, 2), '7i') === null,
   'two qualifying sessions give no series — a two-point line is a number drawn as if it were a direction');
ok(A.clubSeries(full, '7i').n === 3, 'three do');

console.log('— oldest first, whatever order they arrive in —');
const shuffled = [full[2], full[0], full[1]];
const ser = A.clubSeries(shuffled, '7i');
ok(ser.points[0].date === '2026-08-10' && ser.points[2].date === '2026-08-24',
   'the series is in date order regardless of the array it came in');
ok(ser.points.every(p => p.n >= Metrics.MIN_SHOTS_REPORT), 'every point is above the floor');
ok(ser.hi >= ser.lo, 'and it carries the range the sparkline is scaled to');

console.log('— a club that is not there has no series —');
ok(A.clubSeries(full, 'd') === null, 'no driver, no driver trend');

console.log('— there is exactly ONE trend calculator —');
ok(typeof CA.calculateClubTrend === 'function',
   'ClubAnalyzer.calculateClubTrend is exported so the book can read it');
// A second copy is how Benchmarks.TARGET ended up with twelve disagreeing ones.
const uiSlice = src.slice(src.indexOf('function renderYardages'), src.indexOf('// ── Progress'));
ok(/ClubAnalyzer\.calculateClubTrend/.test(uiSlice),
   'the yardage book calls it rather than computing its own');
ok(!/changeIsReal/.test(uiSlice),
   'and does not run its own significance test — a second one is how the target bands ended up with twelve copies');

console.log('— the sparkline is drawn only when the move is real —');
ok(/t\.real \? Analytics\.clubSeries/.test(uiSlice),
   'the series is only fetched when the verdict says the change cleared the golfer\'s own spread');
ok(/series \? spark\(series\) : ''/.test(uiSlice),
   'and nothing is drawn without one — a flat line and a rising one read the same way to the eye');

console.log('— the verdict itself still behaves —');
const flatRun = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31']
  .map(d => sess(d, 160)).reverse();          // newest first, as the book passes them
const flatT = CA.calculateClubTrend(flatRun, '7i');
ok(flatT.real === false, 'an unchanged run is not a trend');
ok(/spread|history|session/i.test(flatT.label), `and says why (${flatT.label})`);

const rising = [sess('2026-08-31', 182), sess('2026-08-24', 160), sess('2026-08-17', 159), sess('2026-08-10', 161)];
const riseT = CA.calculateClubTrend(rising, '7i');
ok(riseT.real === true, `a 22-yard move is (${riseT.label})`);
ok(riseT.delta > 0, 'in the right direction');
ok(A.clubSeries([...rising].reverse(), '7i').n === 4, 'and it has a series to draw');

console.log('— conditions still gate it —');
const mixed = [sess('2026-08-31', 182, '7i', 12, { ball: 'range' }), ...rising.slice(1)];
const mixT = CA.calculateClubTrend(mixed, '7i');
ok(mixT.real === false,
   'a range-ball session at the top is not compared against premium ones — a change of ball moves every carry');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
