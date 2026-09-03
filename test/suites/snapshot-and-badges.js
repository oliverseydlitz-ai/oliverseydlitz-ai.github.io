const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { SessionSnapshot: SS, Features, Metrics, Store } = M;

const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 104, smashFactor: 1.40,
  launchAngle: 12, attackAngle: 2, carryDistance: 245, totalDistance: 268, ...o });
const sess = (id, ball, shots) => Store.stamp({ id, date: '2026-08-01',
  conditions: { ball, surface: 'grass' }, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));

console.log('— a shared snapshot names its club, its spread and its ball —');
// "Avg Carry: 199 yds" for a session of drivers and wedges is a number
// describing no club anyone owns, and it went into text a golfer sends to
// other people with no mention of what ball produced it.
const mixed = sess('a', 'premium', [
  ...many(20, { clubType: 'd', carryDistance: 250 }),
  ...many(6,  { clubType: 'pw', carryDistance: 110, smashFactor: 1.22, ballSpeed: 95 }),
]);
const snap = SS.create(mixed);
ok(snap.club === 'Driver', 'the carry figure is one named club');
ok(snap.carry && snap.carry.n === 20, 'with the shots behind it');
ok(Math.round(snap.carry.mean) === 250, `and it is the driver's 250, not the 218 pooled mean`);
const text = SS.toShareText(snap);
ok(/Driver carry: 250/.test(text), 'the share text names the club');
ok(/±/.test(text), 'gives an interval rather than a bare point');
ok(/Ball: Premium/.test(text), 'and says what ball it was hit with');
ok(!/Avg Carry/.test(text), 'the old bag-pooled line is gone');

console.log('— off range balls it says so, in the text people will read —');
const rangeText = SS.toShareText(SS.create(sess('b', 'range', many(20, { clubType: 'd' }))));
ok(/Range balls/.test(rangeText), 'the ball is named');
ok(/indicative only/.test(rangeText), 'and the distances are qualified where someone will see it');

console.log('— below the floor it declines rather than rounding something up —');
const thin = SS.create(sess('c', 'premium', many(4, { clubType: 'd' })));
ok(thin.carry === null, `4 shots gives no carry (floor ${Metrics.MIN_SHOTS_REPORT})`);
ok(/No club reached/.test(SS.toShareText(thin)), 'and the text says why rather than omitting the line');

console.log('— badges do not unlock on a device misread —');
// "Pure Contact — hit 1.45+ smash" fired on one glitched 1.71, past what a
// legal clubface can produce.
const glitched = sess('d', 'premium', [
  ...many(20, { smashFactor: 1.40, ballSpeed: 150, carryDistance: 245 }),
  { _row: 99, ...shot({ smashFactor: 1.71, ballSpeed: 244, carryDistance: 402 }) },
]);
const a = Features.achievements([glitched]);
const badge = id => a.defs.find(d => d.id === id);
ok(badge('smash').got === false,
   `the smash badge stays locked on a real 1.40 (ceiling ${Metrics.CEILING.smashFactor})`);
ok(badge('bomb').got === true,
   'the 250-yard badge still unlocks off the 402 — carry is deliberately unscreened');
ok(badge('speed').got === true, 'and ball speed likewise');
ok(badge('first').got === true, 'session-count badges are unaffected');
ok(a.total === a.defs.length && a.unlocked <= a.total, 'and the counts stay coherent');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
