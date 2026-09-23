const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { RetentionProbe: RP, Metrics } = M;
RP.clear();

const day = 864e5;
const mk = (dateMs, mean, n = 12, club = '7i') => ({
  id: 's'+dateMs, date: new Date(dateMs).toISOString(),
  shots: Array.from({length:n}, (_,i) => ({ clubType: club, _row: i,
    smashFactor: mean + ((i % 5) - 2) * 0.01 })),
});
const fault = { id:'poor-contact', name:'Poor Contact', clubType:'7i', metric:'smashFactor' };
const hist = n => Array.from({length:n}, (_,i) => mk(Date.now()-i*day, 1.30));

console.log('— opening a probe —');
const t0 = Date.now() - 3*day;
ok(!!RP.open(mk(t0,1.30), fault), 'opens on a session with enough shots');
ok(RP.open(mk(t0,1.30,4), fault)===null, `refuses below the ${RP.MIN_SHOTS}-shot floor`);
ok(RP.openProbes().length===1, 'one probe open');

console.log('— only a LATER session can answer it —');
ok(RP.due(mk(t0 + 2*36e5,1.34)).length===0, `same-day follow-up does not count (needs ${RP.MIN_GAP_HOURS}h)`);
ok(RP.due(mk(t0 + 30*day,1.34)).length===0, `and neither does one ${RP.MAX_GAP_DAYS}+ days later`);
ok(RP.due(mk(t0 + 2*day,1.34)).length===1, 'a next-day session is eligible');

console.log('— the verdict is three-valued, judged on the golfer\'s own noise —');
const probe = RP.due(mk(t0+2*day,1.34))[0];
const big = RP.settle(probe, mk(t0+2*day,1.42), hist(6), true);
ok(big.outcome==='retained', `a change beyond the golfer's variation reads as retained (${big.delta.toFixed(3)})`);
ok(/strongest evidence this app can produce/.test(RP.describe(big)),
   'and, when the golfer confirms they practised, says why that matters');

RP.clear(); RP.open(mk(t0,1.30), fault);
const p2 = RP.due(mk(t0+2*day,1.301))[0];
const tiny = RP.settle(p2, mk(t0+2*day,1.301), hist(6));
ok(tiny.outcome==='no-change', 'a change inside it reads as no detectable change');
ok(/Not the same as "no improvement"/.test(RP.describe(tiny)), 'and refuses to call that "no improvement"');

RP.clear(); RP.open(mk(t0,1.40), fault);
const p3 = RP.due(mk(t0+2*day,1.28))[0];
const worse = RP.settle(p3, mk(t0+2*day,1.28), hist(6));
ok(worse.outcome==='regressed', 'a drop beyond variation reads as regressed');
ok(/would have hidden it/.test(RP.describe(worse)), 'and notes within-session numbers would have missed it');

// The probe settles against whatever session comes next, and it cannot see
// whether the drill was done. Without that, a golfer who ignored it entirely
// was told "the strongest evidence this app can produce that something worked"
// — the measurement was fine and the attribution was invented, which is the
// same failure as reading strokes off a face angle, one layer up.
console.log('— the change and the credit for it are separate questions —');
RP.clear(); RP.open(mk(t0,1.30), fault);
const unclaimed = RP.settle(RP.due(mk(t0+2*day,1.42))[0], mk(t0+2*day,1.42), hist(6), false);
ok(unclaimed.outcome==='retained', 'the change is still measured and still reads as real');
ok(unclaimed.attributable===false, 'but the drill is not credited with it');
ok(!/strongest evidence/.test(RP.describe(unclaimed)), 'and the claim about the drill is not made');
ok(/not a verdict on the drill/.test(RP.describe(unclaimed)), 'it says so outright');
ok(/can happen on their own/.test(RP.describe(unclaimed)),
   'and turns it into the useful fact: changes this size occur without practice');

RP.clear(); RP.open(mk(t0,1.30), fault);
const unasked = RP.settle(RP.due(mk(t0+2*day,1.42))[0], mk(t0+2*day,1.42), hist(6));
ok(unasked.practised===null && unasked.attributable===false, 'an unanswered probe assumes neither way');
ok(/is how a measurement turns into a story/.test(RP.describe(unasked)), 'and names the failure it is avoiding');

RP.clear(); RP.open(mk(t0,1.40), fault);
const droppedOff = RP.settle(RP.due(mk(t0+2*day,1.28))[0], mk(t0+2*day,1.28), hist(6), true);
ok(/about the drill rather than about the week/.test(RP.describe(droppedOff)),
   'a confirmed practice that regressed is still attributed — the drill is allowed to have not worked');

RP.clear(); RP.open(mk(t0,1.30), fault);
const flatUnpractised = RP.settle(RP.due(mk(t0+2*day,1.301))[0], mk(t0+2*day,1.301), hist(6), false);
ok(/baseline any future change has to beat/.test(RP.describe(flatUnpractised)),
   'and no change without practice is framed as the baseline, not a failure');

console.log('— with no history it waits for one, rather than guessing or giving up (C42) —');
// Every golfer's FIRST probe has fewer than three sessions behind it, so it
// used to be settled "unknown" and burnt, every time. The delta is measured
// and kept; only the verdict waits for the golfer's own noise floor.
RP.clear(); RP.open(mk(t0,1.30), fault);
const p4 = RP.due(mk(t0+2*day,1.45))[0];
const waiting = RP.settle(p4, mk(t0+2*day,1.45), []);
ok(waiting.outcome==='awaiting-history', 'no personal error yet -> awaiting history, not a population fallback');
ok(Number.isFinite(waiting.delta) && waiting.delta > 0.1, 'the change itself is measured and kept');
ok(/judged then, not thrown away/.test(RP.describe(waiting)), 'and the golfer is told it is kept, not burnt');
ok(RP.rejudge([]) === 0 && RP.settled()[0].outcome === 'awaiting-history', 'rejudging with still no history changes nothing');
ok(RP.rejudge(hist(6)) === 1 && RP.settled()[0].outcome === 'retained', 'and once the history exists, it gets its verdict');

console.log('— the probe measures the fault, in the fault\'s direction (C5) —');
// Every probe measured smash factor whatever opened it. And "retained" meant
// "went up", which for a slice's face-to-path is the fault getting worse.
const d0 = t0;
const drv = (ms, aa, extra = {}) => ({ id: 'd' + ms, date: new Date(ms).toISOString(),
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' },
  shots: Array.from({ length: 16 }, (_, i) => ({ clubType: 'd', _row: i, smashFactor: 1.45, ballSpeed: 150, clubSpeed: 103,
    launchAngle: 12, attackAngle: aa + ((i % 5) - 2) * 0.2, clubPath: 0, launchDirection: 0, ...extra })) });
RP.clear();
const aaProbe = RP.openAtImport(drv(d0, -3), [drv(d0, -3)], d0 + 36e5);
ok(aaProbe && aaProbe.faultId === 'driver-negative-aa' && aaProbe.metric === 'attackAngle',
   `a negative-attack-angle probe measures attack angle, not smash (${aaProbe && aaProbe.metric})`);
const aaHist = Array.from({ length: 4 }, (_, i) => drv(d0 - (i + 1) * day, -3));
const aaDone = RP.settle(RP.due(drv(d0 + 2 * day, 1))[0], drv(d0 + 2 * day, 1), aaHist, true);
ok(aaDone.outcome === 'retained', 'and hitting UP afterwards is "retained"');
const sliceSpec = M.FaultEngine.detectFaults(drv(d0, 0, { launchDirection: 4, clubPath: -8 }).shots, drv(d0, 0))
  .find(f => f.id === 'slice');
ok(!!sliceSpec && sliceSpec.probe.metric === 'facePath' && sliceSpec.probe.better === -1,
   'a slice is measured on face-to-path, where DOWN is better');

console.log('— opened once, at import, never replacing a live probe (C6, C26) —');
RP.clear();
const s1 = drv(d0, -3), s2 = drv(d0 + 2 * day, -3);
RP.openAtImport(s1, [s1], d0 + 36e5);
ok(RP.openProbes(d0 + 2 * day).length === 1, 'the first session opens one');
RP.openAtImport(s2, [s1, s2], d0 + 2 * day + 36e5);
const both = RP.allOpen();
ok(both.length === 2 && both.some(p => p.sessionId === s1.id),
   'the follow-up where the fault PERSISTED does not delete the probe it is about to answer');
ok(RP.due(s2, d0 + 2 * day + 36e5).map(p => p.sessionId).join() === s1.id,
   'the follow-up answers the earlier probe, never its own');
RP.openAtImport(s1, [s1, s2], d0 + 3 * day);
ok(RP.allOpen().length === 2, 'importing (or viewing) an older session opens and re-baselines nothing');
RP.clear();
const old = drv(d0 - 30 * day, -3);
ok(RP.openAtImport(old, [old], d0) === null, 'a backdated session whose window has closed opens nothing');
ok(RP.expired().length === 0, 'so it cannot count as a miss against the golfer');
RP.clear();
console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
