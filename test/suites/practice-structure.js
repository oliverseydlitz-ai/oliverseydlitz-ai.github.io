const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { PracticeEfficiency: PE, Metrics, Store } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
const mod = src.slice(src.indexOf('const PracticeEfficiency'), src.indexOf('\n})();', src.indexOf('const PracticeEfficiency')));
const code = mod.split(/\r?\n/).map(l => l.replace(/^\s*\/\/.*/, '')).join('\n');

// What was here could only return one answer:
//   ratio = (quality/100) * (shots/(sessions*60))   tested against 80/60/40
// Quality over 100 is at most 1 and shots-per-minute is well under 1, so the
// ratio rounded to 0 or 1 and EVERY golfer got "Low" — rendered at 2rem, in
// green, including one striking it at 96 out of 100. The hours it divided by
// were invented: the app has never recorded how long a session took.
console.log('— the invented clock is gone —');
ok(!/assume 1 hour|totalTime/.test(code), 'no assumed hour per session');
ok(!/efficiencyRating|efficiencyRatio/.test(code), 'and no efficiency score computed from it');
ok(!/hoursSpent|shotsPerHour|qualityPerHour/.test(code), 'nor anything else denominated in time');

const shot = (club, row, o = {}) => ({ _row: row, clubType: club, ballSpeed: 150, clubSpeed: 105,
  smashFactor: 1.45, launchAngle: 12, attackAngle: 3, carryDistance: 250, ...o });
const sess = shots => Store.stamp({ id: 's', date: '2026-08-01',
  conditions: { ball: 'premium', surface: 'grass' }, shots });

console.log('— order is read off the shots, not assumed —');
// Blocked: ten drivers, then ten 7-irons. One club change in twenty shots.
const blocked = sess([...Array.from({length:10},(_,i)=>shot('d', i+2)),
                      ...Array.from({length:10},(_,i)=>shot('7i', i+12, { carryDistance: 165 }))]);
const b = PE.structure(blocked);
ok(b.ok === true, 'a two-club session can be read');
ok(b.mode === 'blocked', `ten of one then ten of the other is blocked (${Math.round(b.rate*100)}% switches)`);
ok(b.switches === 1, 'one club change across the whole session');
ok(/feels better during the session/.test(b.note),
   'and it says the thing the evidence actually claims — better now, worse tomorrow');

// Varied: alternating every shot.
const varied = sess(Array.from({length:20},(_,i)=>shot(i%2 ? '7i':'d', i+2, { carryDistance: i%2?165:250 })));
const v = PE.structure(varied);
ok(v.mode === 'varied', `alternating every shot is varied (${Math.round(v.rate*100)}%)`);
ok(/contextual interference/.test(v.note), 'named as what it is');
ok(/meant to feel worse/.test(v.note), 'including that it is meant to feel worse at the time');

console.log('— and the reviewers\' own limitation travels with it —');
for (const r of [b, v]) {
  ok(/underpowered/.test(r.caveat), 'over half the 52 trials were underpowered');
  ok(/novices/.test(r.caveat), 'and most used novices on simple putting tasks');
  ok(/after something repeatable/.test(r.caveat),
     'and varying comes after something repeatable, not instead of it');
}

console.log('— it refuses rather than guessing —');
ok(PE.structure(sess(Array.from({length:20},(_,i)=>shot('d', i+2)))).single === true,
   'one club is not an order — it says so rather than reporting 0% as "blocked"');
ok(PE.structure(sess([shot('d',2), shot('7i',3)])).ok === false,
   `two shots is under the floor of ${Metrics.MIN_SHOTS_REPORT}`);
const noOrder = PE.structure(sess(Array.from({length:20},(_,i)=>({ clubType: i%2?'d':'7i' }))));
ok(noOrder.ok === false && /no shot order/.test(noOrder.why),
   'without _row there is no hit order, and the array\'s sort is not one');
ok(PE.structure(null).ok === false, 'and no session is not a crash');

console.log('— volume is stated against the plan, not against a clock —');
const vol = PE.volume(blocked);
ok(vol && vol.shots === 20, 'it counts the shots');
// It may SAY the word minutes — "the plan counts balls and not just minutes"
// is the reason the ball count exists — but it must never report a duration,
// because the app has never recorded one.
ok(!/hour/i.test(vol.note), 'no hours, invented or otherwise');
ok(!/\d+\s*(min|minute|hour)/i.test(vol.note), 'and no duration is reported at all');
ok(/exercise rather than practice/.test(vol.note) || vol.prescribed === null,
   'when there is a prescription it says why balls are counted');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
