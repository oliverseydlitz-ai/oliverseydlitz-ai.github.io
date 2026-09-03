// This suite needs the DOM as well as the modules, so it loads directly rather
// than through the harness shim — same whole-file load, one window.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Conditions: C, ImportFlow } = R.app;

// Ball type and surface are the two inputs every condition gate in the app
// hangs off, and the import form asked for both from a blank slate every time.
// 'Not recorded' is not a neutral default: it fails dispersionValid and
// gappingValid, so the cheapest answer to give is the one that silently
// switches off the gapping sizes, the tail engine and the fault condition gates.

const doc = R.window.document;
const store = R.window.localStorage;
const KEY = 'slLastConditions';

console.log('— nothing remembered until something worth remembering —');
store.removeItem(KEY);
ok(C.recall() === null, 'a first-time golfer gets no prefill');
ok(C.remember({ ball: 'unknown', surface: 'unknown' }) === null,
   'an all-unknown session is not stored — a prefill hint claiming it was carried forward would be a lie');
ok(C.recall() === null, '  …and nothing lands in storage');
ok(C.remember(null) === null, 'a missing conditions object is survivable');
ok(C.remember({}) === null, 'an empty conditions object is survivable');

console.log('— a real venue is remembered —');
C.remember({ ball: 'range', surface: 'mat', alignment: 'confirmed', wind: '10mph' });
const r = C.recall();
ok(r && r.ball === 'range', 'ball comes back');
ok(r && r.surface === 'mat', 'surface comes back');
ok(r && !('alignment' in r), 'alignment does NOT come back — it is an action taken on the day, not a property of the venue');
ok(r && !('wind' in r), 'nor does wind, which is a note rather than a gate');

console.log('— half a venue is still worth remembering —');
store.removeItem(KEY);
C.remember({ ball: 'premium', surface: 'unknown' });
const half = C.recall();
ok(half && half.ball === 'premium' && half.surface === 'unknown',
   'ball alone is stored, surface stays unrecorded rather than being guessed');
ok(C.recallNote(half).includes('Premium'), 'the note names only what was actually carried forward');
ok(!/not recorded/i.test(C.recallNote(half)), '  …and does not announce the half it does not know');

console.log('— the golfer is told a value was carried forward —');
// A prefill nobody can see is the same failure as a blank form: both end with a
// session stamped with conditions nobody chose.
C.remember({ ball: 'range', surface: 'mat' });
const note = C.recallNote(C.recall());
ok(typeof note === 'string' && note.length > 30, 'there is a sentence to show');
ok(/Range balls/i.test(note) && /mat/i.test(note), 'it names both values');
ok(/different/i.test(note), 'and tells the golfer to change them if today was not the same');
ok(C.recallNote(null) === null, 'no recall, no note');

console.log('— corrupt storage never breaks the import —');
store.setItem(KEY, 'not json');
ok(C.recall() === null, 'unparseable storage reads as no recall');
store.setItem(KEY, '"a string"');
ok(C.recall() === null, 'a non-object reads as no recall');
store.setItem(KEY, '{"ball":"moon-rock","surface":"lava"}');
ok(C.recall() === null, 'values that are not in the tables read as no recall, never as a made-up ball type');

console.log('— the form is actually filled in —');
C.remember({ ball: 'range', surface: 'mat' });
const ballSel = doc.getElementById('metaBall');
const surfSel = doc.getElementById('metaSurface');
const align   = doc.getElementById('metaAligned');
const recallP = doc.getElementById('conditionsRecall');
ok(ballSel && surfSel && align && recallP, 'the meta step has all four elements');
ballSel.value = 'premium'; surfSel.value = 'grass'; align.checked = true; recallP.hidden = true;
ImportFlow.prefillConditions();
ok(ballSel.value === 'range', 'the ball menu is set from the recall');
ok(surfSel.value === 'mat', 'the surface menu is set from the recall');
ok(align.checked === false,
   'the alignment box is CLEARED — carrying it forward would unlock the tighter start-line floor on a confirmation the golfer never gave');
ok(recallP.hidden === false && recallP.textContent.length > 30, 'and the note is visible');

console.log('— no recall, no note —');
store.removeItem(KEY);
ImportFlow.prefillConditions();
ok(recallP.hidden === true && recallP.textContent === '', 'the note is cleared rather than left showing a stale venue');
ok(align.checked === false, 'and the alignment box is still cleared');

console.log('— forgetting —');
C.remember({ ball: 'range', surface: 'mat' });
ok(C.recall() !== null, 'something to forget');
C.forget();
ok(C.recall() === null, 'erasing the device copy erases the remembered venue with it');

// Leave storage clean for whatever suite runs next.
store.removeItem(KEY);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
