const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Features, Metrics, Store } = M;

// `avg(s.shots, 'carryDistance')` over every club in a session is a bag mix.
// A driver-heavy session against a wedge-heavy one reported "Avg carry −60
// yds" as a decline, when the golfer had simply hit different clubs.
const shot = (club, carry, o = {}) => ({ clubType: club, carryDistance: carry,
  ballSpeed: 150, clubSpeed: 104, smashFactor: 1.44, launchAngle: 12, attackAngle: 2, apex: 30, ...o });
const sess = (id, shots, ball = 'premium') => Store.stamp({ id, date: '2026-08-01',
  conditions: { ball, surface: 'grass' }, shots });
const many = (n, club, carry, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(club, carry, o) }));
const carryRow = rows => rows.find(r => r.label === 'Avg carry');

console.log('— the comparison is one club, named —');
// Both sessions hit the same driver identically. One also hit 20 wedges.
const driverOnly = sess('a', many(20, 'd', 250));
const plusWedges = sess('b', [...many(20, 'd', 250), ...many(20, 'pw', 110, { ballSpeed: 95, smashFactor: 1.22 })]);
const r = Features.compare(driverOnly, plusWedges);
ok(r.club === 'd', 'it picks the club both sessions hit most');
ok(r.enough === true, `with ${r.clubShots} shots of it in each`);
ok(carryRow(r).delta === '0',
   `identical drivers compare as no change (${carryRow(r).delta}) — pooled, this read as a 70-yard gap`);
ok(r.caveats.some(c => /Driver only|Driver/.test(c)), 'and the table says which club it compared');
ok(r.caveats.some(c => /which clubs you happened to hit/.test(c)), 'and why that matters');

console.log('— below the floor it downgrades rather than refusing —');
const thin = Features.compare(sess('c', many(4, 'd', 250)), driverOnly);
ok(thin.enough === false, `4 shots of the club is under ${Metrics.MIN_SHOTS_REPORT}`);
ok(thin.caveats.some(c => /a look rather than a result/.test(c)),
   'it still shows the rows, and says what they are worth');

console.log('— with no club in common it says so —');
const none = Features.compare(sess('d', many(20, 'd', 250)), sess('e', many(20, 'pw', 110)));
ok(none.club === null, 'no shared club');
ok(none.caveats.some(c => /share no club/.test(c)), 'and it says that rather than comparing two different clubs');

console.log('— the conditions rules still hold —');
const crossBall = Features.compare(sess('f', many(20, 'd', 250)), sess('g', many(20, 'd', 250), 'range'));
ok(crossBall.comparable === false, 'a premium session and a range-ball one are not comparable');
ok(carryRow(crossBall).withheld === true, 'so the distance row is withheld');
ok(carryRow(crossBall).good === null, 'and carries no verdict');
ok(crossBall.caveats.some(c => /different balls/i.test(c)), 'with the reason stated');

console.log('— and spin is dropped rather than shown unmeasured —');
ok(!Features.compare(driverOnly, plusWedges).some(x => x.label === 'Spin'),
   'no RPT ball, no spin row');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
