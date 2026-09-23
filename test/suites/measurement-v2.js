// Measurement model v2 (Oliver, 22 Sep 2026; killer plan Phase 9), pinned by
// behaviour rather than by wording.
//
//   · EVERY tier prescribes. A tier sets how hard a fault is judged — the
//     recurrence rate it must reach — never whether it may report at all.
//   · Range balls are near-normal data: a little less weight in a pool that
//     spans sessions, a slightly higher bar for a fault, never a source of spin.
//   · The minimum-shot floors are unchanged.
//   · The main screens are clean: the explanations live in Settings → How the
//     numbers work (MeasurementReference), and nowhere else.
//
// The proposed numbers (0.30/0.35/0.40, x0.8, +0.05) are defaults Oliver can
// tune; they live in Metrics and nowhere else, so this suite reads them rather
// than restating them where it can.
const M = require('../harness.js').load();
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const { Metrics, FaultEngine: FE, Conditions, Spin, MeasurementReference: MR } = M;
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');

console.log('— the numbers, in one place —');
ok(Metrics.tierRates(1).min === 0.30 && Metrics.tierRates(2).min === 0.35 && Metrics.tierRates(3).min === 0.40,
   'recurrence bars 30% / 35% / 40% by tier (Oliver: "judge it harder, not too different")');
ok([1, 2, 3].every(t => Metrics.tierRates(t).firm > Metrics.tierRates(t).min), 'each tier confirms above where it reports');
ok(Metrics.conditionWeight('range') === 0.8 && Metrics.conditionWeight('premium') === 1 && Metrics.conditionWeight('rpt') === 1,
   'range balls weigh 0.8 in a pool; premium and RPT weigh 1');
ok(Metrics.rateBump('range') === 0.05 && Metrics.rateBump('premium') === 0, 'range balls raise the fault bar by 0.05');
ok(Metrics.tier('facePath') === 3 && Metrics.tier('spinLoft') === 2,
   'derived metrics take the tier of their weakest input (face-to-path 3, spin loft 2)');
ok(Metrics.MIN_SHOTS_REPORT === 10 && Metrics.MIN_SHOTS_DELIVERY === 15 && Metrics.MIN_SHOTS_TAIL === 30,
   'the minimum-shot floors are unchanged: 10 / 15 / 30');

// Twenty 7-irons: `k` of them trip the rule, the rest are neutral.
const neutral = { clubType: '7i', ballSpeed: 120, clubSpeed: 88, smashFactor: 1.36, launchAngle: 16,
  attackAngle: -4, clubPath: 0, launchDirection: 0, carryDistance: 170, sideCarry: 0, totalDistance: 180 };
const set = (k, trip, extra = {}) => Array.from({ length: 20 }, (_, i) =>
  ({ ...neutral, ...extra, _row: i + 1, ...(i < k ? trip : {}) }));
const has = (shots, id, session) => FE.detectFaults(shots, session).some(f => f.id === id);
const thin = { smashFactor: 1.10, ballSpeed: 97 };          // poor contact, tier 1
const open = { launchDirection: 6, clubPath: 0 };           // slice via face-to-path, tier 3

console.log('— every tier prescribes; a lower tier is judged harder —');
ok(has(set(7, thin), 'poor-contact'), 'tier 1 at 35% (7 of 20) reports');
ok(!has(set(7, open), 'slice'), 'tier 3 at 35% does not — its bar is 40%');
ok(has(set(9, open), 'slice'), 'tier 3 at 45% does: face-to-path, derived and all, prescribes (v2)');
ok(FE.detectFaults(set(9, open)).find(f => f.id === 'slice').tier === 3, 'and the fault says which tier judged it');

console.log('— range balls: near-normal, judged a little harder —');
const premium = { conditions: { ball: 'premium', surface: 'grass' } };
const range = { conditions: { ball: 'range', surface: 'grass' } };
ok(has(set(7, thin), 'poor-contact', premium), 'tier 1 at 35% reports on premium balls');
ok(!has(set(6, thin), 'poor-contact', range) && has(set(6, thin), 'poor-contact', premium),
   'at 30% it reports on premium and not on range balls (30% + 5%)');
ok(has(set(8, thin), 'poor-contact', range), 'and at 40% it reports on range balls too — nothing is switched off');

console.log('— spin: prescribed only when it is a reading —');
ok(Spin.measured({ conditions: { ball: 'rpt' } }) === true, 'an RPT ball measures spin');
ok(!Spin.measured({ conditions: { ball: 'range' } }) && !Spin.measured({ conditions: { ball: 'premium' } }),
   'range and premium balls never do — range balls are never a source of spin');
const axis = { _ball: 'rpt', spinAxis: 20, spinRate: 3000 };
ok(has(set(9, axis), 'high-spin-axis'), 'with an RPT ball, a spin-axis fault prescribes at the tier-3 bar');
ok(!has(set(9, { ...axis, _ball: 'range' }), 'high-spin-axis'), 'without one it never fires');

console.log('— main screens are clean: the explanations live in one place —');
// Every caveat that used to sit beside the numbers is referenced, outside its
// own module, ONLY from MeasurementReference (Settings → How the numbers work).
const body = name => {
  const i = src.indexOf(`const ${name} = (() => {`);
  return i < 0 ? '' : src.slice(i, src.indexOf('\n})();', i));
};
const refBody = body('MeasurementReference');
const outsideRef = needle => (src.split(needle).length - 1) - (refBody.split(needle).length - 1);
const CAVEATS = [
  ['FaultEngine.BODY_CAVEAT', 'FaultEngine'], ['FaultEngine.FEEL_CAVEAT', 'FaultEngine'],
  ['Conditions.NOTES', 'Conditions'], ['Dispersion.CAVEATS', 'Dispersion'],
  ['Spin.NOT_MEASURED', 'Spin'], ['Spin.CHANGE_CAVEAT', 'Spin'], ['Spin.ALTERNATIVE', 'Spin'],
];
for (const [needle] of CAVEATS) {
  ok(refBody.includes(needle), `${needle} is rendered in How the numbers work`);
  ok(outsideRef(needle) === 0, `and nowhere else — not on a main screen`);
}
// Positive control: the same count must see a reference planted elsewhere.
ok((src + '\nfoo(FaultEngine.BODY_CAVEAT);').split('FaultEngine.BODY_CAVEAT').length - 1 - (refBody.split('FaultEngine.BODY_CAVEAT').length - 1) === 1,
   'positive control: a stray render outside Settings would be counted');
const html = MR.howItWorks();
ok(/Every number gives advice/.test(html) && html.includes('40%') && html.includes('35%'),
   'the explanation screen states the rule and reads the bars from Metrics');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
