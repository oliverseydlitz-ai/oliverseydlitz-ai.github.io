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

console.log('— with no history it says so rather than guessing —');
RP.clear(); RP.open(mk(t0,1.30), fault);
const p4 = RP.due(mk(t0+2*day,1.45))[0];
const unknown = RP.settle(p4, mk(t0+2*day,1.45), []);
ok(unknown.outcome==='unknown', 'no personal error yet -> unknown, not a population fallback');
ok(/not enough history/.test(RP.describe(unknown)), 'and asks for more sessions');
RP.clear();
console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
