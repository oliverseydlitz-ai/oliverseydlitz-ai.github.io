const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { ShortGame: SG } = M;
SG.clear();

console.log('— the three structures the 2024 review of 52 RCTs named superior —');
ok(Object.keys(SG.STRUCTURES).length === 3, 'errorless, random order, external focus');
ok(SG.STRUCTURES.errorless.tier === 'strong' && SG.STRUCTURES.random.tier === 'strong',
   'the two with trial evidence behind them are marked strong');
ok(SG.STRUCTURES.external.tier === 'moderate',
   'external focus is not — the effect is about g = 0.15 after bias correction');
ok(/g = 0\.15/.test(SG.STRUCTURES.external.why), 'and the module says the number rather than implying more');
ok(/Maxwell, Masters/.test(SG.STRUCTURES.errorless.why), 'errorless cites the study it comes from');
ok(/Fazeli/.test(SG.STRUCTURES.random.why), 'so does random order');
ok(/feel worse than blocked practice while you do it/.test(SG.STRUCTURES.random.why),
   'and warns that random practice feels worse at the time — which is why golfers abandon it');
ok(Object.values(SG.STRUCTURES).every(s => s.how && s.why), 'each says how to do it and why it works');

console.log('— the drills —');
ok(SG.PUTTING.length >= 10, `${SG.PUTTING.length} putting drills`);
ok(SG.CHIPPING.length >= 10, `${SG.CHIPPING.length} chipping drills`);
ok(new Set(SG.ALL().map(d => d.id)).size === SG.ALL().length, 'every id is unique');
ok(SG.ALL().every(d => d.name && d.trains && d.protocol), 'each has a name, what it trains, and a protocol');
ok(SG.ALL().every(d => ['strong','moderate','weak'].includes(d.tier)), 'and an evidence tier');
ok(SG.ALL().every(d => d.why), 'and a reason it is in the list at all');
ok(SG.byId('c-three-var').tier === 'strong', 'the chip drill from a published trial is marked strong');
ok(/54 acquisition trials/.test(SG.byId('c-three-var').why), 'and describes the actual trial');
ok(SG.byId('p-firstputt').tier === 'weak', 'a drill with no trial behind it is marked weak');
ok(/No trial has tested this in golf/.test(SG.byId('p-firstputt').why), 'and says so outright');
ok(SG.byId('c-pressure-updown').tier === 'weak' && /not because a trial supports/.test(SG.byId('c-pressure-updown').why),
   'so is the pressure drill — the failure is real, the format is not evidenced');
ok(SG.byId('nope') === null, 'an unknown id is null');

console.log('— structures attach to drills, and resolve —');
ok(SG.structuresFor(SG.byId('p-gate'))[0].id === 'errorless', 'the ladder resolves to errorless');
ok(SG.structuresFor(SG.byId('c-landing'))[0].id === 'external', 'the landing spot to external focus');
ok(SG.ALL().every(d => SG.structuresFor(d).length === d.structures.length),
   'every named structure exists — no drill points at one that does not');

console.log('— the session builds errorless BEFORE random, which is the finding —');
const s = SG.session(30);
ok(s.blocks.length >= 3, `${s.blocks.length} blocks`);
const phases = s.blocks.map(b => b.phase);
ok(phases.indexOf('Warm up without missing') < phases.indexOf('Then make it random'),
   'errorless comes first');
ok(/just missing in a varied sequence/.test(s.note),
   'and it says why: random order before anything is repeatable is not practice');
ok(s.blocks[s.blocks.length-1].phase === 'Finish on the real thing', 'and it ends on one ball, no retries');
ok(SG.session(30, 'putting').blocks.every(b => SG.PUTTING.includes(b.drill)), 'a putting-only session stays on the green');
ok(SG.session(30, 'chipping').blocks.every(b => SG.CHIPPING.includes(b.drill)), 'and a chipping-only one does not wander');
ok(s.minutes >= 20, 'the total is a real number of minutes');

console.log('— chipping is scored on proximity, because that is what strokes gained uses —');
const chips = fts => ({ chips: fts.map(f => ({ leaveFt: f })) });
ok(SG.proximity([]) === null, 'nothing to score with no chips');
ok(SG.proximity(chips([3,4,5]).chips) !== null, 'three is enough to compute');
ok(SG.proximity(chips([3,4,5]).chips).enough === false, `but under ${SG.MIN_CHIPS} it is not called a measurement`);

const tidy = SG.proximity(chips([2,3,3,4,4,5,5,6,7,8]).chips);
ok(tidy.enough === true && tidy.disasters === 0, 'a clean set has no blow-ups');
ok(Math.abs(tidy.mean - tidy.median) < 1, 'and its mean and median agree');
ok(/describes your chipping rather than one bad contact/.test(SG.describe(tidy)), 'which the wording says');

// One chunk in ten drags a mean four feet. The median does not move.
const chunked = SG.proximity(chips([2,3,3,4,4,5,5,6,7,45]).chips);
ok(chunked.median === tidy.median || Math.abs(chunked.median - 4.5) < 1, 'a single chunk barely moves the median');
ok(chunked.mean > tidy.mean + 3, 'while it drags the mean several feet');
ok(chunked.disasters === 1, 'and is counted as a blow-up');
ok(/that is where the strokes went/.test(SG.describe(chunked)),
   'the description points at the bad one rather than the average');
ok(/work on is the bad one, not the standard one/.test(SG.describe(chunked)), 'and says which to fix');
ok(SG.proximity(chips([0,0,3,4,5,5,6,6,7,8]).chips).holed === 2, 'holed chips are counted, at zero feet');

console.log('— logging round-trips —');
SG.clear();
ok(SG.record({ chips: [] }) === null, 'an empty log records nothing');
ok(SG.record({ chips: [{ leaveFt: 4 }, { leaveFt: 9 }], lie: 'rough' }) !== null, 'a real one records');
ok(SG.all().length === 1 && SG.all()[0].lie === 'rough', 'and the lie travels with it');
ok(SG.all()[0].chips.length === 2, 'with the chips intact');
SG.clear();
ok(SG.all().length === 0, 'clear empties it');

console.log('— the tour reference is scale, not a target —');
ok(SG.TOUR.make30ft === 0.07 && SG.TOUR.threePutt30ft === 0.05, 'tour makes 7% and three-putts 5% from 30 ft');
ok(/it is two putts, not one/.test(SG.TOUR.note), 'and the note says the target from long range is two putts');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
