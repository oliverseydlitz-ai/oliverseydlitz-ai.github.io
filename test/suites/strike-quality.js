const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { Strike: S, Metrics, Benchmarks } = M;

// Shots with a controlled smash mean and spread. The spread is exact (a
// symmetric ± pattern) so "is this gap bigger than your own noise" is a
// question with a known answer rather than a coin toss.
const shots = (n, smashMean, spread = 0.01, club = 'd', clubSpeed = 100) =>
  Array.from({ length: n }, (_, i) => ({
    clubType: club, clubSpeed,
    smashFactor: smashMean + (i % 2 ? spread : -spread),
    ballSpeed: clubSpeed * smashMean, carryDistance: 240,
  }));

console.log('— the reference is per club, because tour smash falls with loft —');
ok(S.reference('d') > S.reference('7i'), 'driver sits above 7-iron');
ok(S.reference('7i') > S.reference('lw'), 'and 7-iron above lob wedge');
ok(S.reference('d') === Benchmarks.get('d').pga.sf, 'and it comes from the benchmark table, not a second copy');
ok(S.reference('nope') === null, 'an unknown club has no reference rather than a default');

console.log(`— a mean needs ${Metrics.MIN_SHOTS_REPORT} shots —`);
const thin = S.baseline(shots(6, 1.42), 'd');
ok(thin.ok === false, '6 shots is refused');
ok(thin.need === Metrics.MIN_SHOTS_REPORT - 6, 'and it says how many more are needed');
ok(S.baseline(shots(12, 1.42), 'd').ok === true, '12 shots is enough');
ok(S.headroom(shots(6, 1.42), 'd').ok === false, 'and headroom refuses on the same floor');

console.log('— a gap inside your own noise is not a gap —');
const noisy = S.headroom(shots(10, 1.475, 0.05), 'd');
ok(noisy.real === false, 'a 0.005 shortfall under a wide spread does not count as a gap');
ok(/same number measured twice/.test(noisy.note), 'and says why, rather than going quiet');
const above = S.headroom(shots(12, 1.50), 'd');
ok(above.real === false && /no strike gap to work on/.test(above.note),
   'a golfer at or above the reference is told to look elsewhere, not flattered');

console.log('— a real gap is priced in ball speed, and in yards for the driver only —');
const h = S.headroom(shots(20, 1.43, 0.01, 'd', 93), 'd');
ok(h.real === true, 'the average male amateur\'s 1.430 is a real gap against the tour 1.48');
ok(Math.abs(h.gap - 0.05) < 0.001, `the gap is the arithmetic, not a lookup (${h.gap.toFixed(3)})`);
ok(Math.abs(h.ballGain - 0.05 * 93) < 0.01, 'ball speed gained is the gap times their own club speed');
ok(h.carry && h.carry.lo < h.carry.hi, 'carry comes as a range, not a false point estimate');
ok(Math.abs(h.carry.lo / h.ballGain - 7 / 4.5) < 1e-9, 'and the range is the research base\'s own worked example');
ok(h.chained === true, 'the result is flagged as a chained inference');
ok(/roughly/.test(h.note), 'and hedged in the wording a golfer actually reads');

const iron = S.headroom(shots(20, 1.25, 0.01, '7i', 85), '7i');
ok(iron.real === true, 'an iron gap is still reported');
ok(iron.ballGain !== null && iron.carry === null,
   'but gets no yardage: the yards-per-mph anchor is a driver figure');

console.log('— no strokes number is offered here, by design —');
ok(!('strokes' in h) && !/stroke/i.test(h.note),
   'the chain stops at yards; the app keeps one strokes figure, in Dispersion');

console.log('— the weak link is ranked across the bag —');
const bag = [...shots(14, 1.47, 0.01, 'd', 100), ...shots(14, 1.20, 0.01, '7i', 85), ...shots(4, 1.0, 0.01, 'pw', 70)];
const wl = S.weakLink(bag);
ok(wl.ok === true, 'it ranks what it can');
ok(wl.worst.club === '7i', 'the 7-iron 0.16 below reference outranks the driver 0.01 below');
ok(!wl.rows.some(r => r.club === 'pw'), 'the 4-shot wedge does not enter the ranking at all');
ok(/rarely uniform/.test(wl.note), 'and it says why looking across the bag is the point');
ok(S.weakLink(shots(4, 1.2, 0.01, 'd')).ok === false, 'with nothing above the floor it ranks nothing');

console.log('— does swinging harder cost the strike? —');
const flat = S.speedCost(shots(20, 1.45, 0.005, 'd', 100).map((s, i) => ({ ...s, clubSpeed: 90 + i })), 'd');
ok(flat.ok === true && flat.real === false, 'a steady strike across a 19 mph spread reads as no evidence');
ok(/no evidence here/.test(flat.note), 'and is worded as absence of evidence, not proof of absence');

const costly = Array.from({ length: 20 }, (_, i) => {
  const cs = 90 + i;                       // 90..109 mph
  return { clubType: 'd', clubSpeed: cs, smashFactor: 1.50 - (cs - 90) * 0.004, ballSpeed: cs * 1.4 };
});
const cc = S.speedCost(costly, 'd');
ok(cc.real === true && cc.slope < 0, 'a genuine decline with speed is detected');
ok(Math.abs(cc.perTen + 0.04) < 0.005, `and quantified per 10 mph (${cc.perTen.toFixed(3)})`);
ok(/shorter, not longer/.test(cc.note), 'and names the consequence a speed trainer would hide');

const oneEffort = S.speedCost(shots(20, 1.45, 0.005, 'd', 100), 'd');
ok(oneEffort.ok === false, 'twenty swings at one effort cannot answer the question');
ok(/does not mean anything/.test(oneEffort.note), 'and it refuses rather than fitting a line to nothing');
ok(S.speedCost(shots(10, 1.45, 0.005, 'd'), 'd').ok === false, `and it needs ${S.MIN_SPEED_SHOTS} shots`);

console.log('— fatigue across a long block —');
const tiring = [...shots(9, 1.47, 0.002), ...shots(9, 1.46, 0.002), ...shots(9, 1.40, 0.002)];
const f = S.fatigue(tiring, 'd');
ok(f.real === true && f.drop > 0, 'a real fade from the first third to the last is caught');
ok(/a strike you do not have fresh/.test(f.note), 'and framed as what it costs the practice');
const steady = shots(30, 1.46, 0.002);
ok(S.fatigue(steady, 'd').real === false, 'a steady block is not called fatigue');
const warming = [...shots(9, 1.40, 0.002), ...shots(9, 1.44, 0.002), ...shots(9, 1.47, 0.002)];
ok(/warming up/.test(S.fatigue(warming, 'd').note), 'and a rise is named as a warm-up, not ignored');
ok(S.fatigue(shots(12, 1.46), 'd').ok === false, 'under 15 shots it will not split the block');

console.log('— trends need three sessions, never a paired comparison —');
const sess = (i, m) => ({ id: 's'+i, date: new Date(2026, 0, i+1).toISOString(), shots: shots(12, m, 0.004) });
ok(S.trend([sess(1, 1.42), sess(2, 1.47)], 'd').ok === false, 'two sessions is refused');
ok(/cannot tell a change from an ordinary week/.test(S.trend([sess(1,1.42), sess(2,1.47)], 'd').note),
   'and says why a before-and-after is the wrong shape');
const climbing = S.trend([sess(1,1.400), sess(2,1.404), sess(3,1.402), sess(4,1.460)], 'd');
ok(climbing.ok === true && climbing.real === true, 'a move beyond their own session variation is real');
const wandering = S.trend([sess(1,1.440), sess(2,1.410), sess(3,1.470), sess(4,1.445)], 'd');
ok(wandering.real === false, 'and a wander inside it is not');
ok(/not the same as no change/.test(wandering.note), 'refusing to call that no change');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
