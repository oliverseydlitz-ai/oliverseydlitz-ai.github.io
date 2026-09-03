const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { PracticeLog: PL, RetentionProbe: RP, PracticePlan: PP, FaultEngine } = R.app;
const store = R.window.localStorage;

// RetentionProbe.settle takes `practised`, and its only source was a question
// asked days later. That is a recall task — and this app refuses to trust
// recall for a carry number while happily trusting it for a whole week.

const DAY = 864e5;
const now = Date.now();
const reset = () => { store.removeItem('slPracticeLog'); store.removeItem('slProbes'); };

console.log('— an entry is a record, and a bad one is refused at the door —');
reset();
ok(PL.all().length === 0, 'an empty log reads as empty, not as an error');
ok(PL.log(null) === null, 'nothing to log is survivable');
ok(PL.log('a string') === null, 'a non-object is refused');
const e1 = PL.log({ faultId: 'low-point', clubType: '7i', balls: 40, minutes: 20, drill: 'Towel drill' });
ok(e1 && typeof e1.id === 'string', 'a real block comes back with an id');
ok(PL.all().length === 1, 'and lands in the log');
store.setItem('slPracticeLog', '{"not":"an array"}');
ok(PL.all().length === 0, 'a non-array in storage reads as empty rather than throwing');
store.setItem('slPracticeLog', '[{"faultId":"x"},{"id":"ok","at":123,"faultId":"y"}]');
ok(PL.all().length === 1, 'entries with no id or no timestamp are dropped — one would join itself to the wrong probe');

console.log('— a forward-dated entry is clamped to now —');
reset();
const future = PL.log({ faultId: 'f', at: now + 30 * DAY });
ok(future.at <= Date.now(), 'a block logged for next month is clamped — it would sit inside no probe window and count for nothing');

console.log('— THE ASYMMETRY: the log can prove practice, never its absence —');
reset();
PL.log({ faultId: 'low-point', clubType: '7i', at: now - 3 * DAY });
ok(PL.workedOn('low-point', '7i', now - 7 * DAY, now) === true, 'a logged block inside the window proves it');
ok(PL.workedOn('low-point', '7i', now - 1 * DAY, now) === null,
   'a block OUTSIDE the window returns null, not false — the log has nothing to say, which is not the same as "no"');
ok(PL.workedOn('over-the-top', '7i', now - 7 * DAY, now) === null,
   'a different fault returns null, not false');
ok(PL.workedOn('low-point', 'd', now - 7 * DAY, now) === null,
   'a different club returns null — a probe is opened per club, and a wedge drill says nothing about the driver');
const answers = new Set();
for (const [f, c] of [['low-point','7i'],['nope','7i'],['low-point','d'],[null,'7i']]) {
  answers.add(PL.workedOn(f, c, now - 7 * DAY, now));
}
ok(!answers.has(false), 'workedOn NEVER returns false — reading an empty log as "did not practise" would manufacture the same false attribution with the sign flipped');
ok(typeof PL.EMPTY_NOTE === 'string' && /not the same as nothing done/i.test(PL.EMPTY_NOTE),
   'and there is a sentence saying so to the golfer');

console.log('— windows and evidence —');
reset();
PL.log({ faultId: 'f', clubType: '7i', at: now - 5 * DAY, balls: 30 });
PL.log({ faultId: 'f', clubType: '7i', at: now - 2 * DAY, balls: 40 });
PL.log({ faultId: 'f', clubType: '7i', at: now - 40 * DAY, balls: 50 });
ok(PL.between(now - 7 * DAY, now).length === 2, 'between() is inclusive of the window and excludes what is outside it');
ok(PL.evidence('f', '7i', now - 7 * DAY, now).length === 2, 'evidence returns the actual rows, so an answer can show its working');
ok(PL.evidence('f', '7i', now - 7 * DAY, now)[0].at < PL.evidence('f', '7i', now - 7 * DAY, now)[1].at,
   'in time order');

console.log('— summary counts DAYS, not blocks —');
reset();
const t = new Date(now).setUTCHours(12, 0, 0, 0);
PL.log({ faultId: 'a', at: t - 1 * DAY, balls: 20, minutes: 10 });
PL.log({ faultId: 'b', at: t - 1 * DAY, balls: 20, minutes: 10 });
PL.log({ faultId: 'c', at: t - 1 * DAY, balls: 20, minutes: 10 });
const sum = PL.summary(28, now);
ok(sum.entries === 3, 'three blocks');
ok(sum.days === 1, 'but ONE practice day — three blocks in an afternoon is not three sessions');
ok(sum.balls === 60 && sum.minutes === 30, 'balls and minutes add up');
reset();
ok(PL.summary(28, now) === null, 'an empty log summarises as null rather than a row of zeroes');

console.log('— the probe reads the log, and only ever one way —');
reset();
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
  launchAngle: 17, attackAngle: -3, carryDistance: 158, ...o });
const sess = (date, sf) => ({ id: 'S' + date, date,
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' },
  shots: Array.from({ length: 12 }, () => shot({ smashFactor: sf })) });
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const before = sess(iso(now - 6 * DAY), 1.33);
const after  = sess(iso(now), 1.42);
const probe = RP.open(before, { id: 'low-point', clubType: '7i', name: 'Low point', metric: 'smashFactor' });
ok(probe && probe.id, 'a probe opens off the earlier session');

ok(RP.evidenceFor(probe, after) === null, 'with an empty log the probe has no evidence and must ASK');
PL.log({ faultId: 'low-point', clubType: '7i', at: now - 3 * DAY, balls: 40 });
const ev = RP.evidenceFor(probe, after);
ok(ev && ev.practised === true, 'a block logged inside the probe window answers it');
ok(ev.source === 'logged', 'and says where the answer came from');
ok(ev.entries === 1 && ev.balls === 40, 'with the working attached, so the golfer can see why');

reset();
RP.open(before, { id: 'low-point', clubType: '7i', name: 'Low point', metric: 'smashFactor' });
PL.log({ faultId: 'low-point', clubType: '7i', at: now - 20 * DAY });
const p2 = RP.openProbes()[0];
ok(RP.evidenceFor(p2, after) === null,
   'practice BEFORE the baseline does not count — the probe is about what happened in between');

console.log('— settle records how it knows —');
// `describe` returns early on an 'unknown' outcome, so the attribution sentence
// only appears once there is enough history for changeIsReal to call it. Give
// it a real run of sessions rather than asserting against the early return.
const history = [1.31, 1.32, 1.33, 1.32, 1.34].map((sf, i) => sess(iso(now - (30 - i * 5) * DAY), sf));
reset();
const p3 = RP.open(before, { id: 'low-point', clubType: '7i', name: 'Low point', metric: 'smashFactor' });
const logged = RP.settle(p3, after, [...history, before, after], true, 'logged');
ok(logged.outcome !== 'unknown', `there is enough history to reach a verdict (${logged.outcome})`);
ok(logged.practisedSource === 'logged', 'a logged answer is stored as logged');
ok(/logged the work at the time/i.test(RP.describe(logged)), 'and the sentence says so');
reset();
const p4 = RP.open(before, { id: 'low-point', clubType: '7i', name: 'Low point', metric: 'smashFactor' });
const asked = RP.settle(p4, after, [...history, before, after], true, 'recalled');
ok(asked.practisedSource === 'recalled', 'an answer given days later is stored as recalled');
ok(/You said you practised/i.test(RP.describe(asked)),
   'and reads differently — a memory is not a reading, and the record should not pretend they are equal');
reset();
const p5 = RP.open(before, { id: 'low-point', clubType: '7i', name: 'Low point', metric: 'smashFactor' });
const dunno = RP.settle(p5, after, [...history, before, after], null, 'recalled');
ok(dunno.practisedSource === null, 'no answer means no source — not a "recalled" nothing');

console.log('— plan blocks carry the join keys —');
reset();
const faultSess = { id: 'F', date: iso(now),
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' },
  shots: Array.from({ length: 20 }, (_, i) => shot({ smashFactor: 1.18, ballSpeed: 96, clubSpeed: 85 })) };
const plan = PP.generate(faultSess.shots, 45, faultSess);
ok(Array.isArray(plan) && plan.length > 0, 'the fixture produces a plan');
if (plan) {
  ok(plan.every(b => typeof b.faultId === 'string' && b.faultId),
     'every block names its fault — without it a ticked-off block is a note to nobody');
  ok(plan.every(b => 'clubType' in b), 'and its club, so the log joins to the right probe');
  ok(plan.every(b => Number.isFinite(b.minutes) && Number.isFinite(b.balls)),
     'and still has real minutes and balls');
}

reset();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
