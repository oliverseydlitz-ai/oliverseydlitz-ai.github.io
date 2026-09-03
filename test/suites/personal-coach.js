const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { PersonalCoach: PC, Metrics, Store } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
const mod = src.slice(src.indexOf('const PersonalCoach'), src.indexOf('\n})();', src.indexOf('const PersonalCoach')));
const code = mod.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');

const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 150, clubSpeed: 105, smashFactor: 1.43,
  launchAngle: 12, attackAngle: -6, clubPath: 0, sideCarry: 2,
  carryDistance: 250, totalDistance: 270, ...o });
const sess = (id, date, shots, conditions = { ball: 'premium', surface: 'grass' }) =>
  Store.stamp({ id, date, conditions, shots });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));

console.log('— the drill comes from the gated library, not a private map —');
// This module kept four of its own: "swing keeping your hands ahead at
// impact", "4 o'clock to 10 o'clock feeling". Body-position cues that bypass
// `splitDrills` entirely, keyed on a fault NAME rather than on anything the
// session measured.
ok(!/4 o.clock|hands ahead at impact|Outside-in feel/.test(code),
   'the four hardcoded cues are gone');
ok(/libraryDrill/.test(code), 'it asks PracticePlan for an admissible drill');
ok(/splitDrills/.test(code), 'and falls back through the checkable/feel split, not to drills[0]');

const plan = PC.analyzeSessions([sess('a','2026-08-01', many(24))]);
ok(plan && typeof plan.drillRecommendation === 'string', 'a drill recommendation is produced');
ok(!/hands ahead|o.clock/.test(plan.drillRecommendation),
   `and it is not one of the old cues (${plan.drillRecommendation.slice(0, 60)}…)`);

console.log('— faults come from the latest session, with its own conditions —');
// `detectFaults(allShots)` flattened five sessions and passed no session, so
// the condition gating inside the engine received nothing at all.
ok(/detectFaults\(latest\.shots, latest\)/.test(code),
   'the session is passed, so range-ball gating applies');
ok(!/detectFaults\(allShots\)/.test(code), 'and five sessions are not flattened into one call');

console.log('— the milestone counts toward a gate that exists —');
// "250 shots unlocks new insights!" — nothing happens at 250 shots.
ok(!/unlocks new insights/.test(code), 'the empty promise is gone');
ok(!/\[100, 250, 500, 1000, 2500, 5000\]/.test(code), 'as are the round-number milestones');

const early = PC.analyzeSessions([sess('b','2026-08-01', many(4))]).nextMilestone;
ok(early.milestone === Metrics.MIN_SHOTS_REPORT,
   `under ten shots of a club, the next gate is the ${Metrics.MIN_SHOTS_REPORT}-shot floor`);
ok(/interval/.test(early.message), 'and it says what crossing it gives you');

const oneSession = PC.analyzeSessions([sess('c','2026-08-01', many(20))]).nextMilestone;
ok(oneSession.milestone === 3, 'past that, the next gate is three sessions');
ok(/own shot-to-shot spread/.test(oneSession.message),
   'because that is when typicalError stops using a published average — a real change, not a badge');

// Twenty shots a session, three sessions. Pooled that is sixty and the tail
// gate would read as passed — but the tail needs 30 usable shots of one club
// IN ONE SITTING, so no session here can produce one. Counting pooled was the
// bug this fixture found.
const three = PC.analyzeSessions([
  sess('d','2026-08-01', many(20)), sess('e','2026-07-25', many(20)), sess('f','2026-07-18', many(20)),
]).nextMilestone;
ok(three.current === 20, 'the count is the best SINGLE session, not the sum of three');
ok(three.milestone === Metrics.MIN_SHOTS_TAIL,
   `then ${Metrics.MIN_SHOTS_TAIL} shots of one club for the dispersion tail`);
ok(/strokes-gained/.test(three.message), 'the app\'s only strokes figure');

const done = PC.analyzeSessions([
  sess('g','2026-08-01', many(40)), sess('h','2026-07-25', many(40)), sess('i','2026-07-18', many(40)),
]).nextMilestone;
ok(done.milestone === null && done.progress === 100, 'and with every gate open it says so');
ok(/retention probe/.test(done.message), 'pointing at the one thing only time answers');

console.log('— the greeting does not change when you look at it —');
// `Math.random()` re-rolled on every render, and the home view re-renders on a
// tab change. `fadedReveal` was made deterministic for exactly this reason.
ok(!/Math\.random/.test(code), 'no Math.random left in the module');
const s1 = sess('j','2026-08-01', many(20));
const a1 = PC.analyzeSessions([s1]).greeting;
const a2 = PC.analyzeSessions([s1]).greeting;
ok(a1 === a2, 'the same session greets you the same way twice');
const other = PC.analyzeSessions([sess('zzzz','2026-08-02', many(20))]).greeting;
ok(typeof other === 'string' && other.length > 0, 'and a different session still gets one');

console.log('— and an empty history returns nothing rather than guessing —');
ok(PC.analyzeSessions([]) === null, 'no sessions, no coaching plan');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
