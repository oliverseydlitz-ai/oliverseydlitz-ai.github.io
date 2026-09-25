// C40, the half v2 kept: never pool across the bag, and never call a move
// without the app's one significance rule. (The ball half of C40, and all of
// C39, asked for range-ball gates that measurement v2 removed on purpose.)
//
// Each block is a fixture on which the old code gave a wrong answer:
//   · Best Smash crowned a driver over the club the golfer actually hits;
//   · Club Benchmarks printed an unweighted, untrimmed carry that disagreed
//     with the yardage book on the same page;
//   · the coach's assessment called a tight bag "widely varied" off the gap
//     between a driver and a wedge;
//   · the form alerts and the dashboard arrow fired on a fixed 10 points or on
//     any positive delta, whatever this golfer's sessions usually do.
const L = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!L.ok) { console.log('  FAIL  app.js did not load: ' + L.errors.join('; ')); process.exit(1); }
const { Analytics, Features, PersonalCoach, Metrics, Store, ShotScorer, UI } = L.app;
const doc = L.window.document;

const shot = o => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 87, smashFactor: 1.36, launchAngle: 17,
  attackAngle: -3, clubPath: 0, carryDistance: 160, totalDistance: 170, apex: 80, ...o });
const sess = (id, date, shots, ball = 'premium') => Store.stamp({ id, date,
  conditions: { ball, surface: 'grass' }, shots: shots.map((s, i) => ({ _row: i + 2, ...s })) });
// Deterministic spread: offsets that sum to zero.
const OFF = [-2, 1, 0, 2, -1, 1, -2, 0, 1, -1, 2, -1];

console.log('— smash and apex records are read for one club, not the bag —');
{
  // The golfer hits mostly 7-iron. Their best 7-iron strike, 1.39, is past the
  // tour 7-iron average; a handful of ordinary drivers top out at 1.45.
  const s = sess('pb', '2026-09-01', [
    ...Array.from({ length: 36 }, (_, i) => shot({ smashFactor: 1.33 + (i % 7) / 100, apex: 80 + (i % 5) })),
    ...Array.from({ length: 12 }, (_, i) => shot({ clubType: 'd', smashFactor: 1.40 + (i % 6) / 100,
      ballSpeed: 150, clubSpeed: 104, carryDistance: 240, totalDistance: 262, apex: 95 })),
  ]);
  const bests = Analytics.personalBests([s]);
  const by = l => bests.find(b => b.label === l);
  ok(by('Best Smash').value === '1.39',
     `Best Smash is the most-hit club's best strike (${by('Best Smash').value} ${by('Best Smash').club}), not the driver's 1.45`);
  ok(/7/.test(by('Best Smash').club) && by('Best Smash').perClub === true, 'and it names the club it was read for');
  ok(by('Highest Apex').value === '84', `Highest Apex is the 7-iron's too (${by('Highest Apex').value} ft), not whichever club flies highest`);
  ok(by('Longest Carry').value === '240' && /D|driver/i.test(by('Longest Carry').club),
     'the longest carry stays the bag\'s, naming the driver — a maximum that names its club is a fact, not a pool');
  ok(Analytics.personalBests([s], 'd').find(b => b.label === 'Best Smash').value === '1.45',
     'and a caller can ask for another club\'s records');
}

console.log('— Club Benchmarks print the yardage book\'s carry, not a second one —');
{
  const list = [
    sess('b1', '2026-09-01', OFF.map(o => shot({ carryDistance: 160 + o }))),
    sess('b2', '2026-09-02', [...OFF.map(o => shot({ carryDistance: 150 + o })), shot({ carryDistance: 62 })], 'range'),
  ];
  const b = Features.benchmarks(list)['7i'];
  const book = Analytics.yardageBook(list).find(r => r.club === '7i');
  const naive = Math.round([...OFF.map(o => 160 + o), ...OFF.map(o => 150 + o), 62].reduce((a, v) => a + v, 0) / 25);
  ok(b.avg === Math.round(book.carry.mean) && b.ci === Math.round(book.carry.ci),
     `the table and the book agree (${b.avg} ± ${b.ci})`);
  ok(b.avg !== naive, `where the old flat, untrimmed average read ${naive} — the 62-yard duff and the range balls at full weight`);
  ok(b.enough === true && b.count === 25, 'the floor and the count come from the same row');
}

console.log('— the coach reads each club against itself —');
{
  // A tight driver and a tight wedge: nothing about this bag is varied.
  const s = sess('c1', '2026-09-01', [
    ...OFF.map(o => shot({ clubType: 'd', carryDistance: 250 + o, ballSpeed: 150, clubSpeed: 104, smashFactor: 1.44 })),
    ...OFF.map(o => shot({ clubType: 'pw', carryDistance: 110 + o, ballSpeed: 90, clubSpeed: 73, smashFactor: 1.23 })),
  ]);
  const a = PersonalCoach.analyzeSessions([s]);
  const text = (a && a.assessment) || '';
  ok(/Very tight/.test(text), `a tight bag reads as tight (${text})`);
  ok(!/varied/i.test(text), 'not "varied" off the 140 yards between a driver and a wedge');
}

console.log('— form moves are called on the app\'s one rule —');
{
  const realScore = ShotScorer.score;
  ShotScorer.score = s => (Number.isFinite(s._score) ? s._score : null);
  const at = (id, day, score) => sess(id, `2026-09-${String(day).padStart(2, '0')}`,
    Array.from({ length: 12 }, () => shot({ _score: score })));
  // Newest first. This golfer's sessions swing by about 8 points either way,
  // and the latest is 12 up on the one before: over the old fixed 10, inside
  // their own 2.77 x SD bar.
  const swingy = [at('f6', 20, 74), at('f5', 18, 62), at('f4', 16, 70), at('f3', 14, 58), at('f2', 12, 72), at('f1', 10, 60)];
  const alerts = Features.performanceAlerts(swingy);
  ok(!alerts.some(a => a.type === 'improvement'),
     'a 12-point session inside the golfer\'s usual swing raises no "improvement" alert (the old fixed 10 did)');
  const steady = [at('g6', 20, 80), at('g5', 18, 65), at('g4', 16, 66), at('g3', 14, 64), at('g2', 12, 65), at('g1', 10, 66)];
  const a2 = Features.performanceAlerts(steady);
  ok(a2.some(a => a.type === 'improvement'), 'a 15-point jump off a steady run still does');
  ok(a2.some(a => /usual session-to-session swing of \d+/.test(a.msg)), 'and says what bar it cleared');
  // The dashboard's three-session form arrow, rendered.
  UI.renderHome(swingy);
  const dashTrend = doc.querySelector('.dash-trend');
  ok(!dashTrend, 'the dashboard draws no "▲ pts vs prior" for a three-session move inside the noise');
  const lifted = [at('h9', 28, 90), at('h8', 26, 91), at('h7', 24, 89), ...[60, 61, 59, 60, 62, 58].map((v, i) => at('h' + i, 10 + i, v))];
  UI.renderHome(lifted);
  ok(/▲/.test((doc.querySelector('.dash-trend') || {}).textContent || ''), 'and still draws it for one well past it');
  const mv = Metrics.realMove ? Metrics.realMove(12, [62, 70, 58, 72, 60]) : {};
  ok(mv.real === false && Math.abs(mv.threshold - Metrics.mdcOf(Math.sqrt(((62 - 64.4) ** 2 + (70 - 64.4) ** 2 + (58 - 64.4) ** 2 + (72 - 64.4) ** 2 + (60 - 64.4) ** 2) / 4))) < 1e-9,
     `realMove is mdcOf on the golfer's own session SD (bar ${mv.threshold && mv.threshold.toFixed(1)})`);
  ok(!!Metrics.realMove && Metrics.realMove(5, [60, 61]).real === null && Metrics.realMove(5, [60, 60, 60]).real === null,
     'under three baseline sessions, or off a baseline that never moved, it declines to judge');

  ShotScorer.score = realScore;
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
