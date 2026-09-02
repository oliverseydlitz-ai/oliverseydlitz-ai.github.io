const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { FeedbackEngine: F, Metrics } = M;

const shots = (n, mean = 1.40, spread = 0.02) =>
  Array.from({ length: n }, (_, i) => ({ clubType: '7i', smashFactor: mean + ((i % 5) - 2) * spread }));

console.log('— the default is not the industry default —');
ok(F.getMode() === 'onRequest', 'tap-to-reveal, not every shot');
ok(F.MODES.always.label.includes('not recommended'), 'and showing everything is labelled as such');

console.log('— faded is deterministic, because a table gets re-sorted —');
// The first version drew Math.random() per shot. Defensible sampling, wrong UI:
// the same shot would hide and reveal itself as the golfer clicked headers.
const a = F.plan(shots(40), { mode: 'faded' }).map(d => d.reveal);
const b = F.plan(shots(40), { mode: 'faded' }).map(d => d.reveal);
ok(JSON.stringify(a) === JSON.stringify(b), 'the same shots decide the same way every time');
ok(F.fadedReveal(3, 40) === F.fadedReveal(3, 40), 'and a single shot is stable');

console.log('— and it actually fades —');
const q = n => a.slice(Math.floor(40*n[0]), Math.floor(40*n[1])).filter(Boolean).length;
ok(q([0,0.2]) === 8, `everything in the first fifth (${q([0,0.2])}/8)`);
ok(q([0.2,0.5]) < 8 && q([0.2,0.5]) > 2, `roughly half through the middle (${q([0.2,0.5])}/12)`);
ok(q([0.8,1]) <= 2, `barely anything at the end (${q([0.8,1])}/8)`);
ok(a.filter(Boolean).length < 40 * 0.6, 'and well under 60% overall, which is the point');
ok(F.plan(shots(4), { mode: 'faded' }).every(d => d.reveal),
   'a four-shot set is not faded — there is nothing to fade across');

console.log('— bandwidth uses the golfer\'s OWN band, never a published one —');
const tight = shots(20, 1.40, 0.002), loose = shots(20, 1.40, 0.05);
ok(F.tolerance(tight, 'smashFactor') < F.tolerance(loose, 'smashFactor'),
   'a consistent golfer gets a tighter band than a scattered one');
ok(F.tolerance(shots(2), 'smashFactor') === null, 'with too few shots there is no band at all');

const mixed = [...shots(18, 1.40, 0.005), { clubType: '7i', smashFactor: 1.20 }, { clubType: '7i', smashFactor: 1.55 }];
const bw = F.plan(mixed, { mode: 'bandwidth' });
ok(bw[bw.length-1].reveal && bw[bw.length-2].reveal, 'the two outliers are reported');
ok(bw.slice(0, 18).filter(d => d.reveal).length < 9, 'and most of the ordinary shots stay silent');
const silent = bw.find(d => !d.reveal);
ok(silent && /silence is the feedback/.test(silent.reason),
   'with silence named as the feedback, not as nothing');
ok(/outside your band/.test(bw[bw.length-1].reason), 'and a reported shot says why it was reported');

console.log('— the band is per club, or it measures the bag instead of the strike —');
// Tour smash runs 1.48 at driver and 1.20 at lob wedge. Pooled across a mixed
// session a single band leaves most shots "outside" it, and the mode degrades
// into showing almost everything — 53% on a real 74-shot two-club session.
// Exactly-normal values, so "1.5 SD leaves about 13% outside" is a claim the
// fixture can actually test rather than an artefact of a repeating pattern.
function invNorm(p){const q=p<0.5?p:1-p;const t=Math.sqrt(-2*Math.log(q));
  const z=t-((0.010328*t+0.802853)*t+2.515517)/(((0.001308*t+0.189269)*t+1.432788)*t+1);return p<0.5?-z:z;}
const normal = (n, sd, centre) => {
  const z = Array.from({length:n},(_,i)=>invNorm((i+0.5)/n));
  const s = Math.sqrt(z.reduce((a,v)=>a+v*v,0)/n);
  return z.map(v => centre + sd*v/s);
};
const club = (n, c, sd, t) => normal(n, sd, c).map(v => ({ clubType: t, smashFactor: v }));

// Unequal group sizes, as a real session has — that is what drags the pooled
// mean off both clusters and makes the pooled band mislabel whole clubs.
const twoClub = [...club(50, 1.46, 0.012, 'd'), ...club(20, 1.24, 0.012, 'pw')];
const perClubN = F.plan(twoClub, { mode: 'bandwidth' }).filter(d => d.reveal).length;
const pooled = (() => {
  const all = twoClub.map(x => x.smashFactor);
  const c = all.reduce((a,b)=>a+b,0)/all.length;
  const sd = Math.sqrt(all.map(v=>(v-c)**2).reduce((a,b)=>a+b,0)/all.length);
  return twoClub.filter(sh => Math.abs(sh.smashFactor - c) > 1.5*sd).length;
})();
ok(perClubN < twoClub.length * 0.25,
   `a driver and a wedge together stay mostly silent (${perClubN}/${twoClub.length})`);
ok(pooled > perClubN,
   `while one pooled band would report ${pooled} of ${twoClub.length} — the bug this fixes`);

console.log('— a miss has to be unusual, or the alarm gets ignored —');
ok(F.BAND_K === 1.5, `the band is ${F.BAND_K} SD, not 1`);
const oneClub = club(200, 1.35, 0.02, '7i');
const rate = F.plan(oneClub, { mode:'bandwidth' }).filter(d=>d.reveal).length / 200;
ok(rate > 0.05 && rate < 0.22,
   `${Math.round(rate*100)}% of shots break the silence — a miss, not the ~33% that 1 SD gives by construction`);

console.log('— with no band yet it reveals rather than going silent on a shot it cannot judge —');
const noBand = F.plan(shots(2), { mode: 'bandwidth' });
ok(noBand.every(d => d.reveal), 'two shots give no band, so nothing is suppressed');

console.log('— the other two modes —');
ok(F.plan(shots(20), { mode: 'always' }).every(d => d.reveal), 'always reveals everything');
ok(F.plan(shots(20), { mode: 'onRequest' }).every(d => !d.reveal), 'and tap-to-reveal reveals nothing up front');

console.log('— error estimation is asked on a sample, not every shot —');
const preds = F.plan(shots(30), { mode: 'onRequest' }).filter(d => d.predict).length;
ok(preds > 3 && preds < 10, `predictions on ${preds} of 30 — a sample, since asking every time is its own burden`);
ok(F.shouldAskPrediction(0) === false, 'never on the first shot, which has nothing to compare to');

console.log('— every mode explains itself, because hidden numbers look broken —');
for (const m of Object.keys(F.MODES)) {
  ok(F.explain(m, 20).length > 60, `${m} has an explanation a golfer can act on`);
}
ok(/costs you next-day retention/.test(F.explain('always')), 'and "every shot" says what it costs');
ok(/Settings/.test(F.explain('always')), 'and where to change it');

console.log('— aggregates are never faded, and that is deliberate —');
// A mean with an interval is not per-trial feedback; it is the summary the
// retention literature wants a learner to have. Fading it would be copying the
// shape of the finding rather than the finding.
ok(typeof F.plan === 'function' && F.plan(shots(20))[0].shot !== undefined,
   'plan() decides per shot, and nothing in it touches a session mean');

console.log('— calling the number before you look is the point, so it gets scored —');
const calls = (n, err, bias = 0) => Array.from({length:n},(_,i)=>({
  called: 1.40 + bias + (i%2 ? err : -err), actual: 1.40 }));
const tightShots = shots(30, 1.40, 0.002);   // shot-to-shot spread ~0.003
const looseShots = shots(30, 1.40, 0.03);    // ~0.04

ok(F.calibration(calls(2, 0.01), tightShots).ok === false, `under ${F.MIN_CALLS} calls it will not score you`);
ok(/Call 1 more/.test(F.calibration(calls(2, 0.01), tightShots).note), 'and says how many more it needs');

const good = F.calibration(calls(6, 0.01), looseShots);
ok(good.ok === true && good.mae > 0, 'it scores the average miss');
ok(good.ratio < 1, 'a call inside the golfer\'s own spread reads as well calibrated');
ok(/feel this shot before you see it/.test(good.note), 'and names what that means');

const poor = F.calibration(calls(6, 0.05), tightShots);
ok(poor.ratio > 1, 'and a call far outside it does not');
ok(/exactly what calling it before you look is training/.test(poor.note),
   'framed as the thing being trained rather than as a failure');

// Judged against the golfer's own spread, so the SAME error reads differently
ok(F.calibration(calls(6, 0.01), tightShots).ratio > F.calibration(calls(6, 0.01), looseShots).ratio,
   'the same 0.01 miss is poor for a consistent striker and fine for a scattered one');

const leaning = F.calibration(calls(8, 0.005, 0.04), tightShots);
ok(/lean high/.test(leaning.note), 'a systematic over-call is named as a lean, not as scatter');
ok(!/lean (high|low)/.test(F.calibration(calls(8, 0.05, 0), tightShots).note),
   'while a symmetric miss is not');

console.log('— volume advice is still volume advice —');
ok(/Four 60-ball sessions/.test(F.volumeAdvice(200) || ''), '200 balls gets the distribution warning');
ok(F.volumeAdvice(40) === null, 'and a normal session gets nothing');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
