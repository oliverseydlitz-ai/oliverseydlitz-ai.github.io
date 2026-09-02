const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { SmartRecommendations: SR, RetentionProbe: RP, Rounds: R, Store } = M;
RP.clear(); R.clear();

// The old version ranked by SESSION COUNT: under five sessions it said "build
// your baseline" whatever the data showed, then named a fault, then suggested
// starting a streak. It knew nothing about the retention probe — the app's own
// stated efficacy metric — nor about on-course data, nor about whether the
// drill it named could be run at all.
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 80, clubSpeed: 62, smashFactor: 1.05,
  launchAngle: 18, attackAngle: -4, clubPath: -1, carryDistance: 150, sideCarry: 3,
  _ball: 'premium', _surface: 'grass', _aligned: true, ...o });
const sess = (id, n = 14, o = {}) => Store.stamp({ id, date: '2026-07-01',
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' },
  shots: Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) })) });
const rd = (o = {}) => ({ holes: 18, par: 72, score: 90, putts: 31, threePutts: 2, penalties: 4.6,
  fairwaysHit: 7, fairwaysPossible: 14, girHit: 8, upDowns: 6, upDownAttempts: 14, ...o });

console.log('— with nothing at all, the answer is the work that needs no device —');
const first = SR.getNextStep([]);
ok(first.type === 'offdevice', 'not "go import a CSV"');
ok(/short game/i.test(first.title), 'it points at the short game');
ok(/20-putt session produced the published result/.test(first.why),
   'because the best-evidenced intervention in the base is a putting one');
ok(first.action === 'practice', 'and it routes somewhere they can act today');

console.log('— a due retention probe outranks everything —');
const s1 = sess('a');
RP.open({ ...s1, date: new Date(Date.now() - 3 * 864e5).toISOString() },
        { id: 'poor-contact', name: 'Poor Contact', clubType: '7i', metric: 'smashFactor' });
ok(RP.openProbes().length === 1, 'a probe is open');
for (let i = 0; i < 4; i++) R.record(rd());          // a lopsided profile exists too
const withProbe = SR.getNextStep([s1]);
ok(withProbe.type === 'probe', 'the probe wins over both the round profile and the fault');
ok(/expires/.test(withProbe.why), 'because it is time-boxed');
ok(/only efficacy evidence this app can produce/.test(withProbe.why), 'and it is the efficacy metric');
ok(new RegExp(RP.MIN_SHOTS + '\\+').test(withProbe.desc), 'the instruction says how many shots to hit');
RP.clear();

console.log('— then on-course data, because it outranks anything from a range —');
const withRounds = SR.getNextStep([s1]);
ok(withRounds.type === 'category', 'the round profile beats the range fault');
ok(/penalties/i.test(withRounds.title), 'naming the outlier category');
ok(/A range fault is a hypothesis about your scoring; a category gap is your scoring/.test(withRounds.why),
   'and the reason is exactly that');

console.log('— a level profile does not outrank anything —');
R.clear();
for (let i = 0; i < 4; i++) R.record(rd({ penalties: 1.62, girHit: 6, putts: 31.2, upDowns: 5, upDownAttempts: 16 }));
ok(SR.getNextStep([s1]).type === 'drill', 'with no outlier it falls through to the session fault');
R.clear();

console.log('— the fault step checks the drill can actually be run —');
const drill = SR.getNextStep([s1]);
ok(drill.type === 'drill', 'a recurring fault is named');
ok(/of \d+ shots/.test(drill.why), 'with how often it recurred');
ok(/past what measurement noise produces/.test(drill.why), 'and why that clears the bar');
ok(drill.desc.length > 30 && drill.desc !== drill.title,
   'the description is a drill, not the title repeated — which the old version did');

console.log('— a clean session is a result, not an empty state —');
const clean = sess('b', 14, { ballSpeed: 83, smashFactor: 1.34, attackAngle: -3.5, clubPath: -0.5, sideCarry: 1 });
const none = SR.getNextStep([clean]);
ok(none.type === 'transfer', 'it points at the transfer block');
ok(/which is a real result/.test(none.why), 'and calls the absence of faults a real result');
ok(/most golfers skip/.test(none.why), 'naming why that block is the one worth doing');

console.log('— every branch is usable —');
for (const step of [first, withRounds, drill, none]) {
  ok(step.title && step.desc && step.icon && step.action, `${step.type}: has title, desc, icon and route`);
  ok(step.why && step.why.length > 40, `${step.type}: says why it ranks where it does`);
}
ok(new Set([first, withRounds, drill, none].map(s => s.action))
     .size <= 4, 'and each routes somewhere real');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
