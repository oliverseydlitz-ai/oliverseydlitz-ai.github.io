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

// §9.1 of short-game-evidence.md: `strong` needs "a trial you can cite in the
// `why`". The app renders `strong` as the words "trial evidence", so a strong
// drill whose why is only a rationale is telling the golfer something untrue.
// Six drills had drifted that way — a landing-spot drill marked strong on
// external focus while the external STRUCTURE is only moderate for the same
// g ≈ 0.15, a proximity ladder marked strong on a measurement principle. This
// pins the rule rather than the individual verdicts, so a new strong drill has
// to bring a citation with it.
console.log('— every "strong" drill actually cites a trial in its why —');
const strong = SG.ALL().filter(d => d.tier === 'strong');
ok(strong.length >= 2, `there are strong drills to check (${strong.length})`);
for (const d of strong) {
  ok(/\b(19|20)\d{2}\b/.test(d.why) || /\btrials?\b/i.test(d.why),
     `${d.id}: the why names a study year or a trial — not just a rationale`);
}
// And the ones deliberately at moderate stay there unless a citation is added.
for (const id of ['p-speed', 'p-circle', 'c-landing', 'c-proximity', 'c-errorless-lie']) {
  ok(SG.byId(id).tier === 'moderate',
     `${id} is moderate — rationale or a cross-skill inference, not a trial of the drill`);
}

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

console.log('— chipping is scored on a rate you can actually observe —');
// It used to ask for the leave in FEET, per chip, typed into a phone. Nobody
// standing on a green reliably tells 5 ft from 7 ft, and the median-vs-mean
// machinery on top of it — a "blow-up" at three times the median — needed a
// precision the input never had. Estimating a thing and then reporting it to
// one decimal place is the error this app polices everywhere else.
const chips = (outcomes, yards = 10) =>
  outcomes.map(inside => ({ inside, yards, lie: 'fairway' }));

ok(SG.rate([]) === null, 'nothing to score with no chips');
ok(SG.rate([{ leaveFt: 4 }]) === null,
   'and an old feet-only entry scores nothing rather than being silently reinterpreted');

const few = SG.rate(chips([true, false, true]));
ok(few !== null && few.n === 3, 'three chips compute');
ok(few.enough === false, `but under ${SG.MIN_CHIPS} it is not called a rate`);
ok(/impression rather than a rate/i.test(SG.describe(few)), 'and the wording says so');
ok(/most of the range there is/i.test(SG.describe(few)),
   'naming how wide the interval still is, rather than printing a bare percentage');

const solid = SG.rate(chips([true,true,true,false,true,false,true,true,false,true]));
ok(solid.enough === true && solid.n === 10, 'ten is enough');
ok(solid.inside === 7, 'the count is right');
ok(Math.abs(solid.overall.p - 0.7) < 1e-9, 'and so is the rate');

console.log('— it is a proportion, so it gets a Wilson interval —');
ok(solid.overall.lo > 0 && solid.overall.hi <= 1, 'the interval is inside [0,1]');
const perfect = SG.rate(chips(Array.from({ length: 10 }, () => true)));
ok(perfect.overall.p === 1, 'ten from ten reads as 100%');
ok(perfect.overall.lo < 1,
   'but the lower bound is NOT 1 — the normal approximation claims certainty here, which is why QuietEye\'s Wilson is reused rather than a second one written');
ok(perfect.overall.lo > 0.6, 'while still being a useful bound');

console.log('— distances are not pooled, because they are different skills —');
const mixed = SG.rate([
  ...chips([true,true,true,true,true,true,true,true,true,true], 5),
  ...chips([false,false,false,false,false,false,false,false,false,true], 40),
]);
ok(mixed.distances.length === 2, 'the two distances are reported apart');
ok(mixed.distances[0].yards === 5 && mixed.distances[1].yards === 40, 'in order, nearest first');
ok(mixed.distances[0].wilson.p === 1 && mixed.distances[1].wilson.p === 0.1,
   'each with its own rate — pooling these would report 55% and describe neither');
ok(mixed.distances.every(d => d.enough), 'both above the floor here');
ok(/different skill/i.test(SG.describe(mixed)), 'and the description says why they are kept apart');

const thin = SG.rate([...chips([true,true,true,true,true,true,true,true,true,true], 5),
                      ...chips([true, false], 40)]);
ok(thin.distances.find(d => d.yards === 40).enough === false,
   'a distance under the floor is flagged rather than dropped — the row says what it still needs');

console.log('— the distance a golfer picked is bucketed, not stored raw —');
ok(SG.distanceBucket(11) === 10 && SG.distanceBucket(38) === 40, 'to the nearest offered distance');
ok(SG.distanceBucket('nonsense') === null, 'and nonsense buckets to nothing');
ok(SG.DISTANCES.length >= 3 && SG.DISTANCES.every(Number.isFinite), 'the offered distances are real numbers');
ok(SG.INSIDE_FT === 3, 'and "inside" means 3 feet, stated once rather than typed into the copy');

console.log('— logging round-trips —');
SG.clear();
ok(SG.record({ chips: [] }) === null, 'an empty log records nothing');
ok(SG.record({ chips: chips([true, false]), lie: 'rough' }) !== null, 'a real one records');
ok(SG.all().length === 1 && SG.all()[0].lie === 'rough', 'and the lie travels with it');
ok(SG.all()[0].chips.length === 2, 'with the chips intact');
SG.clear();
ok(SG.all().length === 0, 'clear empties it');

console.log('— the tour reference is scale, not a target —');
ok(SG.TOUR.make30ft === 0.07 && SG.TOUR.threePutt30ft === 0.05, 'tour makes 7% and three-putts 5% from 30 ft');
ok(/it is two putts, not one/.test(SG.TOUR.note), 'and the note says the target from long range is two putts');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
