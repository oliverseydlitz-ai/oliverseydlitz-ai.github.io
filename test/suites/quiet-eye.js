const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { QuietEye: Q } = M;
Q.clear();

const putts = (n, ft, holedCount) =>
  Array.from({ length: n }, (_, i) => ({ ft, holed: i < holedCount, inches: i < holedCount ? undefined : 14 }));

console.log('— the protocol carries the timings, because the timings ARE the intervention —');
ok(Q.PROTOCOL.length === 4, 'four steps');
ok(/2–3 seconds/.test(Q.PROTOCOL.map(p => p.title + p.detail).join(' ')), 'the 2–3 s pre-stroke fixation');
ok(/200–300 ms/.test(Q.PROTOCOL.map(p => p.title + p.detail).join(' ')), 'and the 200–300 ms hold after impact');
ok(/single 20-putt session/.test(Q.PROTOCOL.map(p => p.detail).join(' ')), 'and that one session is the whole intervention');

console.log('— the effect cannot be shown without what qualifies it —');
ok(/0\.69/.test(Q.EVIDENCE.effect), 'the bias-corrected effect size, not the raw one');
ok(/0\.15/.test(Q.EVIDENCE.effect), 'set against external focus, so the size means something');
ok(Q.EVIDENCE.caveats.some(c => /handicap of 2\.78/.test(c)),
   'the −1.92 putts came from elite golfers and the module says so');
ok(Q.EVIDENCE.caveats.some(c => /cannot see your eyes/.test(c)),
   'and that the app cannot see gaze at all');
ok(Q.EVIDENCE.caveats.some(c => /does not measure putting/.test(c)),
   'and that none of this comes from the launch monitor');

console.log('— there is no gaze field anywhere, on purpose —');
const rec = Q.record({ putts: [{ ft: 8, holed: true, gaze: 2500 }], protocol: true });
ok(JSON.stringify(Q.score([{ ft: 8, holed: true }])).indexOf('gaze') === -1,
   'nothing the app cannot measure survives into a score');
Q.clear();

console.log('— distance bands keep the 6–10 ft signal out of the tap-ins —');
ok(Q.band(3).id === 'short' && Q.band(8).id === 'mid' && Q.band(15).id === 'long' && Q.band(40).id === 'lag',
   'four bands, split where the study split them');
ok(Q.BANDS.find(b => b.id === 'mid').focus === true, '6–10 ft is flagged as the band the training moved');
ok(Q.BANDS.find(b => b.id === 'lag').lag === true, 'and 20 ft+ is scored on proximity, not on holing');

console.log('— Wilson, because the naive interval lies at these sample sizes —');
const perfect = Q.wilson(20, 20);
ok(perfect.lo < 1 && perfect.lo > 0.7, `20 from 20 does not claim certainty (lo ${perfect.lo.toFixed(2)})`);
const none = Q.wilson(0, 20);
ok(none.lo === 0 && none.hi > 0, '0 from 20 has a lower bound of zero, not a negative probability');
ok(Q.wilson(6, 20).lo > 0 && Q.wilson(6, 20).hi < 1, 'and an ordinary rate sits strictly inside 0–1');
ok(Q.wilson(60, 200).hi - Q.wilson(60, 200).lo < Q.wilson(6, 20).hi - Q.wilson(6, 20).lo,
   'ten times the putts narrows the interval');

console.log('— how many putts it takes to see the study\'s own effect —');
const need = Q.puttsToDetect(0.30, 0.05);
ok(need > 300, `detecting +5% at a 30% hole rate needs ${need} putts per side, not 20`);
ok(Q.puttsToDetect(0.30, 0.15) < need, 'a bigger change needs fewer putts');

console.log('— a session is scored per band —');
const s = Q.score([...putts(10, 3, 9), ...putts(10, 8, 3), ...putts(6, 30, 0)]);
ok(s.n === 26 && s.holed === 12, 'totals are right');
const mid = s.bands.find(b => b.band === 'mid');
ok(mid.n === 10 && mid.holed === 3, 'the 6–10 ft band is separated out');
ok(mid.rate.lo < 0.3 && mid.rate.hi > 0.3, 'with an interval around its rate, not a bare percentage');
const lag = s.bands.find(b => b.band === 'lag');
ok(lag.proximity === 14, 'and long putts carry proximity, which is what they should be judged on');
ok(Q.score([]) === null, 'an empty session scores nothing rather than zero');

console.log('— the trend refuses to call a difference a difference too early —');
Q.clear();
Q.record({ date: '2026-01-01T00:00:00Z', protocol: false, putts: putts(20, 8, 6) });
Q.record({ date: '2026-01-05T00:00:00Z', protocol: true,  putts: putts(20, 8, 11) });
const t = Q.trend();
ok(t.ok === true, 'it reports on what is there');
ok(t.comparable === false, 'but will not compare 20 putts against 20 putts');
ok(/cannot confirm it either way yet/.test(t.note), 'and says the gap showing is not yet a gap');
ok(t.need > 300, `it states the sample actually required (${t.need})`);

// The dead end, and the way out of it. Nobody hits 1,400 six-footers, so a
// module that only ever answers "not enough putts" is a module nobody opens
// twice. Turning the question round — what size of change CAN this log show —
// is always answerable and shrinks usefully as the log grows.
console.log('— so it also says what change your own log CAN resolve —');
ok(t.mde > 0.05, `20-a-side can only see a change of ${(t.mde*100).toFixed(0)} points or more`);
ok(/rule out anything larger/.test(t.note), 'and frames that as a bound rather than a failure');

Q.clear();
for (let i = 0; i < 25; i++) Q.record({ date: `2026-02-${String(i+1).padStart(2,'0')}T00:00:00Z`, protocol: false, putts: putts(20, 8, 6) });
for (let i = 0; i < 25; i++) Q.record({ date: `2026-03-${String(i+1).padStart(2,'0')}T00:00:00Z`, protocol: true,  putts: putts(20, 8, 9) });
const big = Q.trend();
ok(big.mde < t.mde, `500 putts a side narrows what is visible to ${(big.mde*100).toFixed(0)} points`);
ok(big.comparable === false,
   'and even 500 a side still cannot confirm the study\'s 5 points — which is the honest answer, not a bug');
ok(big.protocolled.p > big.plain.p, 'both sides are reported rather than a single headline');
ok(Q.detectableDelta(3, 0.3) === null, 'a handful of putts resolves nothing and says so');
ok(Q.detectableDelta(5000, 0.3) < 0.05, 'and a very large log could finally see the study\'s effect');

Q.clear();
ok(Q.trend([{ date: '2026-01-01', putts: putts(10, 3, 9) }]).ok === false,
   'tap-ins alone give nothing to report on');
ok(/inside 6 ft almost everything drops/.test(Q.trend([{ date: '2026-01-01', putts: putts(10, 3, 9) }]).note),
   'and it says why that band cannot carry the signal');

console.log('— one session still gets an answer —');
// Replying "nothing to compare" to someone who has just logged twenty putts
// hides the one number they came for.
Q.clear();
Q.record({ date: '2026-01-01T00:00:00Z', protocol: true, putts: putts(20, 8, 6) });
const one = Q.trend();
ok(one.ok === true, 'a single session reports rather than refusing');
ok(one.overall.n === 20 && one.overall.lo < 0.3 && one.overall.hi > 0.3, 'with an interval on the rate');
ok(/baseline, not a score/.test(one.note), 'named as a baseline, never as a trend');
Q.clear();

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
