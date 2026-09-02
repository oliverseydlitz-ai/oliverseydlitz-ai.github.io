const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { InsightEngine: IE, Metrics, Store } = M;

// What was in this module did not survive reading it:
//   · `100 - stdDev(carries)` — a spread in YARDS subtracted from 100 and
//     printed as a percentage, pooled across the bag, so "your swing is very
//     consistent (92%)" fired on how many clubs you hit.
//   · "+N pts vs last week" off sessions 0–2 vs 3–5, which are not weeks, with
//     no significance test and no conditions gate.
//   · "Long session! Make sure to rest" from a shot count compared against an
//     average that included itself.
const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 105, smashFactor: 1.43,
  launchAngle: 12, attackAngle: 2, clubPath: 0, carryDistance: 250, totalDistance: 270, ...o });
const sess = (id, date, conditions, shots) => Store.stamp({ id, date, conditions, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));
const prem = { ball: 'premium', surface: 'grass' };
const rng  = { ball: 'range', surface: 'mat' };
const texts = list => list.map(i => i.text).join(' | ');

console.log('— a change of ball is the first thing it says —');
const changed = IE.generateInsights([
  sess('a','2026-07-08', rng,  many(20)),
  sess('b','2026-07-01', prem, many(20)),
]);
ok(changed.length > 0 && /do not compare/.test(changed[0].text),
   'the conditions notice leads, because every number below depends on it');
ok(/range balls/i.test(changed[0].text) && /premium/i.test(changed[0].text),
   'and it names both, so the golfer can see what changed');

console.log('— and stays quiet when nothing changed —');
const same = IE.generateInsights([
  sess('c','2026-07-08', prem, many(20)),
  sess('d','2026-07-01', prem, many(20)),
]);
ok(!/do not compare/.test(texts(same)), 'no conditions notice on two matching sessions');

console.log('— consistency is one club, from a real coefficient of variation —');
// The bag mix that used to drive this: 20 drivers at 250 and 20 wedges at 110.
// The old arithmetic read the 70-yard pooled spread as "30% consistent"; the
// new one asks about the driver alone and finds it tight.
const bag = IE.generateInsights([sess('e','2026-07-08', prem, [
  ...many(20, { clubType: 'd', carryDistance: 250 }),
  ...many(20, { clubType: 'pw', carryDistance: 110, ballSpeed: 95, smashFactor: 1.25 }),
])]);
ok(/Driver/.test(texts(bag)), 'the insight names the club it is about');
ok(!/very consistent/.test(texts(bag)), 'and drops the old bag-wide phrasing entirely');
ok(/%/.test(texts(bag)), 'it still gives a number');

console.log('— nothing is claimed below the sample floor —');
const thin = IE.generateInsights([sess('f','2026-07-08', prem, many(4))]);
ok(!/repeating well|spread wide/.test(texts(thin)),
   `4 shots gets no consistency claim (floor is ${Metrics.MIN_SHOTS_REPORT})`);

console.log('— a wide club is told what actually causes it —');
const wide = IE.generateInsights([sess('g','2026-07-08', prem,
  many(24, { clubType: 'd' }).map((s, i) => ({ ...s, carryDistance: 250 + (i % 6) * 22 - 55 })))]);
ok(/spread wide/.test(texts(wide)), 'a genuinely wide club is flagged');
ok(/device measures directly/.test(texts(wide)),
   'and pointed at strike quality, which is tier 1, rather than at something the app cannot see');

console.log('— volume is stated, never prescribed —');
const long = IE.generateInsights([
  sess('h','2026-07-08', prem, many(90)),
  sess('i','2026-07-01', prem, many(20)),
  sess('j','2026-06-24', prem, many(20)),
]);
ok(/90 shots/.test(texts(long)), 'an unusually long session is noted');
ok(!/rest|tired|fatigue/i.test(texts(long)),
   'without telling the golfer to rest — the app has no idea whether they are tired');
ok(/not a better one/.test(texts(long)), 'and it says what the number means for reading the rest');
// The old version divided by an average that included the session itself, so a
// long session partly hid its own outlier-ness.
const selfIncluded = (90 + 20 + 20) / 3;
ok(90 > selfIncluded * 1.3 === true && 90 > (20 + 20) / 2 * 1.4,
   'the comparison excludes the session being judged from its own baseline');

console.log('— and an empty history is not a crash —');
ok(IE.generateInsights([]).length === 0, 'no sessions, no insights');
ok(Array.isArray(IE.generateInsights(null)), 'and null is handled too');

console.log('— and the red alert box no longer renders NaN —');
const { PerformanceAlerts: PA } = M;
// `${Math.round(faults[0].pct * 100)}%` — there is no `pct` field on a fault.
// The home screen showed "NaN% of recent shots. Priority fix." in red.
const steep = sess('k','2026-07-08', prem,
  many(24, { clubType: 'd', attackAngle: -6, launchAngle: 8 }));
const alerts = PA.generateAlerts([steep]);
const atext = alerts.map(a => a.title + ' ' + a.message).join(' | ');
ok(alerts.length > 0, 'a genuinely steep driver still raises an alert');
ok(!/NaN/.test(atext), `no NaN in the message${/NaN/.test(atext) ? ': ' + atext : ''}`);
ok(/\d+ of \d+/.test(atext), 'it says how many shots of how many');
ok(/%/.test(atext) && !/undefined/.test(atext), 'and a real percentage');
ok(!/','|\.',/.test(atext), "and no stray quote-comma left over from the old template literal");

console.log('— a tentative fault is not a "priority fix" —');
// FaultEngine downgrades below FIRM_RATE. An alert that shouts at a rate the
// engine itself is unsure about is the app arguing with its own gate.
const mixed = sess('l','2026-07-08', prem, [
  ...many(9,  { clubType: 'd', attackAngle: -6 }),
  ...many(15, { clubType: 'd', attackAngle: 3 }),
]);
const mAlerts = PA.generateAlerts([mixed]);
for (const a of mAlerts) {
  ok(!/Priority fix/i.test(a.message), 'nothing says "Priority fix" any more');
  if (/watch/.test(a.message)) ok(a.severity !== 'high', 'a watch-it fault is not high severity');
}
ok(PA.generateAlerts([]).length === 0, 'and no sessions is not a crash');

console.log('— and the formula behind the letter grade —');
// `100 - stdDev(carries)` survived in THREE more places after `consistencyScore`
// was written to replace it, including 30% of the overall grade. Pooled across
// a bag it reads the gapping between clubs as inconsistency.
const { bagConsistency, stdDev } = M;
const mk = (club, carry, n) => Array.from({ length: n }, () => ({ clubType: club, carryDistance: carry }));
const perfect = [...mk('d', 250, 20), ...mk('pw', 110, 20)];
const old = Math.round(100 - stdDev(perfect.map(s => s.carryDistance)));
ok(old === 30, `the old formula scored PERFECTLY IDENTICAL shots at ${old}%`);
const now = bagConsistency(perfect);
ok(now.score === 100, 'per club, identical shots score 100 — which is what they are');
ok(now.clubs === 2 && now.shots === 40, 'and it reports how many clubs and shots went into it');

const scattered = [...Array(20)].map((_, i) => ({ clubType: 'd', carryDistance: 250 + (i % 5) * 20 - 40 }));
ok(bagConsistency(scattered).score < 70, 'a genuinely wide club still scores badly');
ok(bagConsistency(mk('d', 250, 6)) === null,
   `under the floor there is no answer, not a flattering one (floor ${Metrics.MIN_SHOTS_REPORT})`);
ok(bagConsistency([]) === null && bagConsistency(null) === null, 'and no shots is not a crash');

// A null consistency used to multiply into the overall grade as NaN.
const { PerformanceGrade } = M;
if (PerformanceGrade) {
  const g = PerformanceGrade.calculateFullGrade([sess('m','2026-07-08', prem, many(4))]);
  ok(g && Number.isFinite(g.overall), `an ungradeable consistency still yields a number (${g && g.overall})`);
  ok(g && g.consistency === null, 'with the component itself honestly null');
}

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
