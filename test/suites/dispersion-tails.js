const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Dispersion: D, Metrics, Conditions } = M;

// A shot at a given offline ANGLE, on a given ball. 200 yd carry throughout so
// the angle is the only thing that varies.
const shot = (deg, ball = 'premium', club = 'd', aligned = false, carry = 200) => ({
  clubType: club, carryDistance: carry,
  sideCarry: carry * Math.tan(deg * Math.PI / 180),
  _ball: ball, _surface: 'grass', _aligned: aligned,
});
// Exactly-normal angles rather than pseudo-random ones: the sample is the
// normal quantiles at evenly spaced probabilities, rescaled so its SD is
// exactly `sd`. A heavy-tail test is only worth anything if the fixture it
// calls "normal-shaped" genuinely is one.
function invNorm(p) {                       // Abramowitz & Stegun 26.2.23
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const z = t - ((0.010328 * t + 0.802853) * t + 2.515517) /
                (((0.001308 * t + 0.189269) * t + 1.432788) * t + 1);
  return p < 0.5 ? -z : z;
}
function normal(n, sd, centre) {
  const z = Array.from({ length: n }, (_, i) => invNorm((i + 0.5) / n));
  const s = Math.sqrt(z.reduce((a, v) => a + v * v, 0) / n);
  return z.map(v => centre + sd * v / s);
}
const spread = (n, sd, centre = 0, opts = {}) =>
  normal(n, sd, centre).map(d => shot(d, opts.ball, opts.club, opts.aligned));

console.log('— the measurement is an angle, and it refuses impossible geometry —');
ok(Math.abs(D.offlineAngle({ sideCarry: 20, carryDistance: 200 }) - 5.711) < 0.01, 'right miss is a positive angle');
ok(D.offlineAngle({ sideCarry: -20, carryDistance: 200 }) < 0, 'left miss is negative');
ok(D.offlineAngle({ sideCarry: 5, carryDistance: null }) === null, 'no carry distance -> no angle, not a zero');
ok(D.offlineAngle({ sideCarry: null, carryDistance: 200 }) === null, 'no side carry -> no angle');
ok(D.offlineAngle({ sideCarry: 2, carryDistance: 5 }) === null, `a ${D.MIN_CARRY}-yard "shot" is screened out as geometry, not trimmed as an outlier`);
ok(D.offlineAngle({ sideCarry: 400, carryDistance: 100 }) === null, 'a 76-degree offline reading is a mis-read');

console.log('— range balls disqualify the whole tail —');
const rangeSet = spread(40, 4, 0, { ball: 'range' });
const rg = D.eligible(rangeSet);
ok(rg.ok === false, 'a 40-shot range-ball session is refused outright');
ok(/2–4×|Range balls/.test(rg.reasons.join(' ')), 'and says the spread would be the ball\'s, not the golfer\'s');
ok(D.eligible(spread(40, 4, 0, { ball: 'unknown' })).ok === false, 'an unrecorded ball type is refused too');
ok(D.eligible(spread(40, 4, 0, { ball: 'rpt' })).ok === true, 'an RPT ball is accepted');
ok(rg.reasons.length === 1, 'and the refusal is stated once, not as a ball problem plus a phantom sample-size one');

console.log(`— and so does a sample under ${Metrics.MIN_SHOTS_TAIL} —`);
const small = D.eligible(spread(20, 4));
ok(small.ok === false, `20 shots is refused at the ${Metrics.MIN_SHOTS_TAIL}-shot floor`);
ok(small.need === Metrics.MIN_SHOTS_TAIL - 20, 'and says how many more are needed');
ok(/rare by definition|contains none/.test(small.reasons.join(' ')), 'giving the reason: a small sample usually contains no bad shot');
ok(D.tail(spread(20, 4)).ok === false, 'tail() refuses rather than returning a number');
ok(D.report(spread(20, 4), 'd').ok === false, 'and so does report()');

console.log('— outliers are kept, because the outlier IS the measurement —');
const clean = spread(34, 3);
const withBlowups = [...clean, shot(14), shot(-15), shot(16), shot(13), shot(-14), shot(15)];
const tClean = D.tail(clean), tBad = D.tail(withBlowups);
ok(tBad.sigma > tClean.sigma, 'three blow-ups widen sigma instead of being trimmed away');
ok(tBad.p95 > tClean.p95, 'and widen the p95 tail');
ok(tBad.bad >= 6, 'they are counted as bad-component shots');
ok(tBad.heavyTailed === true, 'and the distribution is flagged heavy-tailed');
ok(tClean.heavyTailed === false, 'a clean Gaussian-ish set is not');
ok(tBad.pValue < 0.05, 'the heavy-tail call is a tested claim, not an assertion');
ok(tBad.core < tBad.sigma, 'the robust core stays narrower than the contaminated SD');

// Regression. The core scale is refined by re-measuring inside its own cut,
// and that iteration has a second, wrong fixed point: once the cut sits past
// every shot nothing is truncated, so the truncation correction inflates a
// scale that was never shrunk and the cut widens again. An unguarded version
// walked a 40-shot set from a 7.5° MAD up to 9.3° and then reported zero bad
// shots in a pattern that plainly had some. Only downward steps are taken now.
console.log('— a heavy tail cannot hide by inflating the yardstick —');
const contaminated = [...spread(35, 6.5), shot(27), shot(-29), shot(31), shot(-26), shot(25)];
const tc = D.tail(contaminated);
ok(tc.core < 8, `the core stays near the good shots (${tc.core.toFixed(1)}°), not dragged up by the misses`);
ok(tc.core < D.tail(contaminated.slice(0, 35)).core * 1.25,
   'and stays close to what the same shots give without the blow-ups in them');
ok(tc.bad >= 5, `all five blow-ups are counted as bad shots (${tc.bad})`);
ok(tc.heavyTailed === true, 'and a one-in-eight bad-shot rate reads as heavy-tailed');
ok(tc.sigma > tc.core, 'the full SD carries the tail, which is what the valuation is fed');
ok(Math.abs(D.tail(spread(40, 6.5)).core - 6.5) < 0.3,
   'on clean data the refinement leaves the true spread where it is');

// The other half of the same lesson: a 15° miss on a 6.5° spread is 2.3 sigma,
// which a normal curve produces often enough on its own. Calling that a
// blow-up would flag a heavy tail on a pattern that does not have one.
const marginal = [...spread(35, 6.5), shot(15.5), shot(-15.2), shot(16.1), shot(-15.8), shot(15.4)];
ok(D.tail(marginal).heavyTailed === false,
   'misses only 2.3 sigma out are an ordinary tail, not a bad-shot component');

console.log('— absolute miss needs alignment; spread does not —');
const off = spread(34, 3, 6);          // 6 degrees of aiming error, unconfirmed
const on  = spread(34, 3, 6, { aligned: true });
ok(Math.abs(D.tail(off).sigma - D.tail(spread(34, 3, 0)).sigma) < 0.01,
   'a constant aiming offset cancels out of sigma entirely');
ok(D.tail(off).bias === null, 'bias is withheld without confirmed alignment');
ok(D.tail(on).bias !== null, 'and reported once alignment is confirmed');

console.log('— the two-sided miss census —');
const oneWay = [...spread(34, 2), shot(9), shot(10), shot(11)];
const twoWay = [...spread(34, 2), shot(9), shot(10), shot(-9), shot(-11)];
ok(D.census(oneWay).verdict === 'one-way', 'a tail that only goes right reads as one-way');
ok(/aimed around/.test(D.census(oneWay).note), 'and says it can be aimed around');
ok(D.census(twoWay).verdict === 'two-way', 'a tail that goes both ways reads as two-way');
ok(/no side of the target/.test(D.census(twoWay).note), 'and says why that costs more');
ok(D.census(spread(34, 2)).verdict === 'indeterminate', 'a thin tail is not classified either way');

console.log('— the strokes valuation, and where it refuses —');
const v = D.value(7.9, 2);
ok(Math.abs(v.strokes - 2.6) < 0.01, 'at the calibrated 100-golfer, -2 degrees is Broadie & Ko\'s 2.6 strokes');
ok(Math.abs(D.value(5.5, 2).strokes - 2.1) < 0.01, 'and at the 80-golfer it is 2.1');
const mid = D.value(6.7, 2).strokes;
ok(mid > 2.1 && mid < 2.6, 'a golfer between them interpolates between the two curves');
ok(D.value(7.9, 1.5).strokes > 1.4 && D.value(7.9, 1.5).strokes < 2.6, 'and a part-degree target interpolates along the curve');
ok(D.value(12, 2).strokes === null, 'far outside the calibrated band it returns no number at all');
ok(/inventing a figure/.test(D.value(12, 2).note), 'and says extending the curves that far would be inventing one');
ok(D.value(8.5, 2).mode === 'clamped', 'just outside it clamps rather than extrapolates');
ok(/nearest calibrated golfer/.test(D.value(8.5, 2).note), 'and flags that the number is not theirs');
ok(D.value(7.9, 0) === null, 'a zero-degree "improvement" is not worth strokes');

console.log('— every valuation carries the caveats that make it honest —');
const cav = v.caveats.join(' ');
ok(/treed course/.test(cav), 'names the course architecture that flips the verdict');
ok(/difficulty-equated/.test(cav), 'names that the published units are not difficulty-equated');
ok(/at most/.test(cav), 'says the measured spread is an upper bound, so the strokes are too');
ok(/says nothing about what caused it/.test(cav), 'and refuses to attribute the spread to a cause');

console.log('— the valuation is driver-only, because the curves are —');
const irons = spread(34, 3, 0, { club: '7i' });
const ri = D.report(irons, '7i');
ok(ri.ok === true, 'an iron still gets the full tail audit');
ok(ri.value === null, 'but no strokes figure');
ok(/no published equivalent/.test(ri.valuationWithheld), 'and says there is no published curve for it');
const rd = D.report(spread(40, 6.7), 'd');
ok(rd.value.strokes > 0 && rd.value.mode === 'interpolated', 'the driver gets priced');

console.log('— trend: judged on the golfer\'s own session-to-session variation —');
// The fixtures produce a session whose sigma is exactly the sd asked for, so
// the golfer's own between-session wobble here is a known quantity: 0.14 deg.
const sess = (i, sd) => ({ id: 's'+i, date: new Date(2026, 0, i + 1).toISOString(),
  conditions: { ball: 'premium', surface: 'grass' }, shots: spread(34, sd) });
const wobble = [3.8, 4.2, 3.9, 4.1, 4.0];
const steady = [3.8, 4.2, 3.9, 4.1].map((sd, i) => sess(i, sd));
ok(D.trend(steady).real === null, 'under five sessions it will not rule on a change');
ok(/five before your own/.test(D.trend(steady).note), 'and says how many it needs');
const jump = [...wobble, 2.0].map((sd, i) => sess(i, sd));
ok(D.trend(jump).real === true, 'a move beyond the golfer\'s own variation reads as real');
ok(/Tighter/.test(D.trend(jump).note), 'and says which way it went');
const flat = [...wobble, 4.05].map((sd, i) => sess(i, sd));
ok(D.trend(flat).real === false, 'a move inside it does not');
ok(/not the same as no change/.test(D.trend(flat).note), 'and refuses to call that no change');
ok(D.trend([sess(1, 4.0)]).ok === false, 'one session is not a trend');
const ranged = [1,2].map(i => ({ ...sess(i, 4.0), conditions: { ball: 'range', surface: 'grass' } }));
ok(D.trend(ranged).ok === false, 'range-ball sessions never enter the trend');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
