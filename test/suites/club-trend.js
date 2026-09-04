const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { ClubAnalyzer: CA, Metrics, Store } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
const mod = src.slice(src.indexOf('const ClubAnalyzer'), src.indexOf('\n})();', src.indexOf('const ClubAnalyzer')));
const code = mod.split(/\r?\n/).map(l => l.replace(/^\s*\/\/.*/, '')).join('\n');

// The old version compared the first three shots of a FLATTENED array against
// shots four to six of it — not a chronology, just wherever `flatMap` put
// them — and called a 3-yard difference "📈 Improving", in green. Carry's
// minimum detectable change is 13 yards at ten shots, so the threshold was a
// quarter of the smallest change the device can resolve, off a sixth of the
// shots.
console.log('— no arbitrary threshold, no arbitrary slice —');
ok(!/change > 3|change < -3/.test(code), 'the ±3-yard threshold is gone');
ok(!/slice\(0, 3\)[\s\S]{0,120}slice\(3, 6\)/.test(code), 'as is the three-against-three shot slice');
ok(/changeIsReal/.test(code), 'it asks whether the change beats the golfer\'s own spread');
ok(/comparable/.test(code), 'and only compares sessions on the same ball');

// A realistic carry spread: real driver carry moves several yards a shot.
const sess = (id, date, carry, ball = 'premium') => Store.stamp({ id, date,
  conditions: { ball, surface: 'grass' },
  shots: Array.from({ length: 14 }, (_, i) => ({ _row: i + 2, clubType: 'd',
    ballSpeed: 150, clubSpeed: 104, smashFactor: 1.44, launchAngle: 12, attackAngle: 2,
    carryDistance: carry + [(-9), (-4), 0, 3, 8, -6, 5, -2, 7, -8, 2, 6, -5, 4][i] })) });
const hist = [sess('c','2026-07-18', 250), sess('d','2026-07-11', 249), sess('e','2026-07-04', 251)];
const trend = list => CA.compareClubs(list)[0].trend;

console.log('— a small move is inside the noise and says so —');
const small = trend([sess('a','2026-08-01', 253), ...hist]);
ok(small.real === false, 'a 3-yard shift off a real spread is not a trend');
ok(/spread/.test(small.label), `and the label says what it would take (${small.label})`);

console.log('— a large one is reported, with its size —');
const big = trend([sess('a','2026-08-01', 290), ...hist]);
ok(big.real === true, 'a 40-yard shift is');
ok(/\+\d+ yds/.test(big.label), `and the label carries the number rather than a word (${big.label})`);
ok(!/Improving/.test(big.label), '"Improving" is a verdict on a golfer; a delta is a measurement');

console.log('— and it refuses rather than guessing —');
ok(trend([sess('a','2026-08-01', 250)]).real === false, 'one session is not a trend');
ok(/One session/.test(trend([sess('a','2026-08-01', 250)]).label), 'and it says so');
const crossBall = trend([sess('a','2026-08-01', 290), sess('b','2026-07-25', 250, 'range')]);
ok(crossBall.real === false,
   'a premium session against a range-ball one is not compared — a ball change moves every carry');
const thinClub = trend([
  Store.stamp({ id: 'f', date: '2026-08-01', conditions: { ball: 'premium', surface: 'grass' },
    shots: [{ _row: 2, clubType: 'd', carryDistance: 250 }] }),
  hist[0],
]);
ok(thinClub.real === false, `under ${Metrics.MIN_SHOTS_REPORT} shots of the club, no trend`);
ok(new RegExp(Metrics.MIN_SHOTS_REPORT + '\\+').test(thinClub.label), 'and it names the floor');

console.log('— analyzeClub no longer invents one on its own —');
ok(!/trend: calculateClubTrend\(clubShots\)/.test(code),
   'a function that only sees shots cannot answer a session-to-session question');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
