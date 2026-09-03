const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { RangeCard: RC, PracticeLog: PL, PracticePlan: PP } = R.app;
const doc = R.window.document;
const store = R.window.localStorage;
const reset = () => { store.removeItem('slPracticeLog'); RC.close(); };

// A practice plan you have to pinch-zoom on a phone between shots is a plan
// that gets read once and ignored. This is the same plan in the form it is
// actually used in — and it must invent nothing on the way.

const block = (o = {}) => ({ name: 'Low point', icon: '🎯', faultId: 'low-point', clubType: '7i',
  minutes: 20, balls: 30, drill: { name: 'Towel drill', desc: 'Towel a hand behind the ball.' }, ...o });

console.log('— it opens on a plan and refuses to open on nothing —');
reset();
ok(RC.open([]) === false, 'an empty plan does not open an empty card');
ok(RC.open(null) === false, 'nor does no plan at all');
ok(doc.getElementById('rangeCard') === null, 'and nothing is left in the DOM');
ok(RC.open([block(), block({ name: 'Path', faultId: 'over-the-top' })]) === true, 'a real plan opens');
ok(doc.getElementById('rangeCard') !== null, 'the card is in the DOM');
ok(doc.documentElement.classList.contains('range-open'),
   'and the root carries the class that stops the page behind it scrolling — a class survives a re-render, `hidden` does not');

console.log('— ONE BLOCK AT A TIME, which is the rule, not the styling —');
// Rule 9 of the research base is one cue and never a checklist. A card showing
// five blocks at once is the checklist the app refuses everywhere else, printed
// larger.
const card = doc.getElementById('rangeCard');
ok(card.querySelectorAll('.rc-name').length === 1, 'exactly one block name is on screen');
ok(/Low point/.test(card.textContent), 'the first one');
ok(!/Path/.test(card.querySelector('.rc-body').textContent), 'and not the second');
ok(card.querySelectorAll('.rc-dot').length === 2, 'the dots show how many there are without showing their content');

console.log('— it invents nothing: cue and caveats come from the plan —');
const cue = RC.cueFor(block());
ok(cue.name === 'Towel drill' && /Towel a hand/.test(cue.desc), 'the cue is the drill from the plan');
const lib = RC.cueFor(block({ libraryDrill: { name: 'Gate drill', desc: 'Two tees.' } }));
ok(lib.name === 'Gate drill',
   'the LIBRARY drill wins when there is one — it is the one whose gate the session actually passed');

ok(RC.notesFor(block()).length === 0, 'a checkable drill carries no caveat');
ok(/feel/i.test(RC.notesFor(block({ libraryDrill: { name: 'X', desc: 'y', feel: true } }))[0] || ''),
   'a feel library drill keeps its caveat — a small screen is not a licence to drop the part that says what the data cannot support');
ok(/Every drill for this fault is one/.test(RC.notesFor(block({ drillIsFeel: true }))[0] || ''),
   'a fault whose every drill is a feel says so, exactly as the list does');
ok(RC.notesFor(block({ lockedNote: 'Needs 30 shots of one club.' })).some(t => /30 shots/.test(t)),
   'a locked section keeps its reason rather than being silently dropped');

console.log('— ticking a block writes to the log —');
reset();
RC.open([block(), block({ name: 'Path', faultId: 'over-the-top' })]);
ok(PL.all().length === 0, 'nothing logged yet');
doc.querySelector('[data-rc="done"]').dispatchEvent(new R.window.Event('click', { bubbles: true }));
const rows = PL.all();
ok(rows.length === 1, 'one entry lands');
ok(rows[0].faultId === 'low-point' && rows[0].clubType === '7i', 'with the join keys the probe needs');
ok(rows[0].balls === 30 && rows[0].minutes === 20, 'and the block\'s own balls and minutes');
ok(/Path/.test(doc.getElementById('rangeCard').textContent), 'and it advances to the next block');

console.log('— and does not double-log —');
doc.querySelector('[data-rc="prev"]').dispatchEvent(new R.window.Event('click', { bubbles: true }));
doc.querySelector('[data-rc="done"]').dispatchEvent(new R.window.Event('click', { bubbles: true }));
ok(PL.all().length === 1, 'ticking the same block twice records it once');

console.log('— the end screen reports what was ticked, and what an un-ticked block is not —');
doc.querySelector('[data-rc="next"]').dispatchEvent(new R.window.Event('click', { bubbles: true }));
const end = doc.querySelector('.rc-end');
ok(end !== null, 'past the last block there is a summary');
ok(/1 of 2/.test(end.textContent), 'it counts what was actually logged, not what was shown');
ok(/not the same as nothing done/i.test(end.textContent),
   'with three blocks left un-ticked it repeats that they are not recorded as skipped — the same rule PracticeLog follows');
ok(/within-session numbers\s+cannot tell you/i.test(end.textContent),
   'and points at the retention check rather than congratulating the session');

console.log('— and drops that line when there is nothing un-ticked to explain —');
reset();
RC.open([block()]);
doc.querySelector('[data-rc="done"]').dispatchEvent(new R.window.Event('click', { bubbles: true }));
const allDone = doc.querySelector('.rc-end');
ok(allDone && /1 of 1/.test(allDone.textContent), 'every block ticked');
ok(!/not the same as nothing done/i.test(allDone.textContent),
   'the un-ticked caveat is not printed when nothing was left un-ticked — a caveat with no referent reads as a reproach');

console.log('— a block with no fault to log still shows, with no Done button —');
reset();
RC.open([{ name: 'Transfer', minutes: 10, balls: 15, drill: { name: 'Play nine holes on the range', desc: 'Different club every shot.' } }]);
ok(doc.querySelector('[data-rc="done"]') === null,
   'the transfer block has nothing to attribute, so it offers nothing to log');
ok(/Transfer/.test(doc.getElementById('rangeCard').textContent), 'but it is still on the card');

console.log('— closing cleans up after itself —');
RC.close();
ok(doc.getElementById('rangeCard') === null, 'the card is removed');
ok(!doc.documentElement.classList.contains('range-open'), 'and the scroll lock with it');
ok(RC.isOpen() === false, 'isOpen agrees');

console.log('— it is the same plan, not a second one —');
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 96, clubSpeed: 85, smashFactor: 1.18,
  launchAngle: 17, attackAngle: -3, carryDistance: 158, ...o });
const sess = { id: 'F', date: '2026-09-01',
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' },
  shots: Array.from({ length: 20 }, () => shot()) };
const plan = PP.generate(sess.shots, 45, sess);
ok(Array.isArray(plan) && plan.length > 0, 'the fixture generates a plan');
ok(RC.open([...plan, PP.transferBlock()], sess) === true, 'and the card opens straight off it — no second generator');
RC.close();
reset();

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
