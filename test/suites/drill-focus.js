const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { FaultEngine: FE, PracticePlan: PP, Store } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// The app splits a fault's CAUSES at the inference boundary — what the monitor
// measured versus what it cannot see — and then, for five faults, prescribed
// straight across it: "the app cannot see your wrist" three lines above "hold
// your wrist angle". These assertions read the real drills out of app.js, so a
// drill added later cannot land on the wrong side without failing here.
const block = (() => {
  const i = src.indexOf('const FaultEngine');
  return src.slice(i, src.indexOf('\nconst ', i + 10));
})();
// `[^']*` for the NAME is what let "Swing to 3 o\'clock" slip through both the
// labelling script and the first version of this count: the class stops at the
// backslash, so the whole drill never matched and both sides agreed there were
// 52. A regex blind spot shared by the check and the thing it checks reports
// green for the wrong reason. Escape-aware on both fields now.
const DRILL_RE = /\{name:'((?:[^'\\]|\\.)*)',desc:'((?:[^'\\]|\\.)*)'(?:,focus:'(\w+)')?\}/g;
const parsed = [...block.matchAll(DRILL_RE)].map(m => ({ name: m[1], desc: m[2], focus: m[3] }));
const drills = parsed.filter(d => d.focus);
const unlabelled = parsed.filter(d => !d.focus).map(d => d.name);

console.log('— every drill declares where the golfer\'s attention goes —');
ok(parsed.length === 53, `read every drill out of the source (found ${parsed.length})`);
ok(drills.length === 53, `all 53 carry a focus (found ${drills.length})`);
ok(unlabelled.length === 0,
   `no drill is missing one${unlabelled.length ? ': ' + unlabelled.join(', ') : ''}`);
ok(drills.every(d => FE.DRILL_FOCUS.includes(d.focus)), 'and every value is one of the three');

console.log('— an "external" drill may not contain an in-swing body position —');
// Deliberately narrower than BODY_CONSTRUCT: "hands" and "arm" appear as
// landmarks ("shake hands with the target", "the club's heel") and flagging
// those would make the guard cry wolf until someone turned it off.
const INSWING = /\b(wrist|wrists|hip|hips|elbow|forearm|forearms|spine|shoulder tilt|lag|casting)\b/i;
const leaked = drills.filter(d => d.focus === 'external' && INSWING.test(d.name + ' ' + d.desc));
ok(leaked.length === 0,
   `nothing classified external names one${leaked.length ? ': ' + leaked.map(d=>d.name).join(', ') : ''}`);

console.log('— the split is the same shape as splitCauses —');
const mixed = [{ name: 'a', desc: 'x', focus: 'external' }, { name: 'b', desc: 'y', focus: 'feel' },
               { name: 'c', desc: 'z', focus: 'setup' }];
const s = FE.splitDrills(mixed);
ok(s.checkable.length === 2 && s.feel.length === 1, 'setup counts as checkable, feel does not');
ok(FE.splitDrills(null).checkable.length === 0, 'and it survives no drills at all');
ok(FE.drillFocus({ name: 'x' }) === 'feel',
   'an unlabelled drill defaults to feel — the cautious side, not the flattering one');
ok(FE.drillFocus({ focus: 'nonsense' }) === 'feel', 'as does a focus nobody defined');
ok(FE.FEEL_CAVEAT.length > 100 && /cannot|not/.test(FE.FEEL_CAVEAT),
   'and the caveat says outright that nothing confirms these');

console.log('— the practice plan leads with a drill something can check —');
const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 80, clubSpeed: 62, smashFactor: 1.05,
  launchAngle: 18, attackAngle: -4, clubPath: -1, carryDistance: 150, sideCarry: 3,
  _ball: 'premium', _surface: 'grass', _aligned: true, ...o });
// Three club groups so the plan has to choose a drill several times over,
// including for the faults whose first-listed drill is a feel.
const mk = (id, shots) => Store.stamp({ id, date: '2026-07-01',
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' }, shots });
const sess = mk('p', [
  ...Array.from({ length: 12 }, (_, i) => ({ _row: i + 2, ...shot() })),
  // low-ball-speed: ratio under 1.30 with the smash still over 1.28
  ...Array.from({ length: 12 }, (_, i) => ({ _row: i + 20,
    ...shot({ clubType: '9i', ballSpeed: 80, clubSpeed: 62, smashFactor: 1.33 }) })),
  // shallow iron attack angle
  ...Array.from({ length: 12 }, (_, i) => ({ _row: i + 40,
    ...shot({ clubType: '6i', attackAngle: 2.5, smashFactor: 1.35, ballSpeed: 88, clubSpeed: 65 }) })),
]);
// generate(shots, totalMin, session). The first version of this passed the
// session as `totalMin`, which made every block's minutes and balls NaN — and
// this suite still passed, because it only asserted on the drills. Two live
// call sites had the same mistake.
const plan = PP.generate(sess.shots, 45, sess);
const blocks = Array.isArray(plan) ? plan : (plan.blocks || plan.items || []);
const withDrill = blocks.filter(b => b && b.drill);
ok(withDrill.length >= 2, `the plan produced ${withDrill.length} blocks with a drill`);
for (const b of withDrill) {
  const feels = FE.splitDrills([b.drill]).feel.length > 0;
  const hadChoice = !b.drillIsFeel;
  ok(!(feels && hadChoice),
     `${b.name}: leads with a feel only when every drill for it is one`);
}
ok(withDrill.every(b => typeof b.drillIsFeel === 'boolean'),
   'and every block says which case it is, so the renderer can caveat it');
ok(withDrill.every(b => Number.isFinite(b.minutes) && b.minutes > 0),
   'every block has real minutes, not NaN');
ok(withDrill.every(b => Number.isFinite(b.balls) && b.balls > 0),
   'and real balls — volume past attention is exercise, so the count has to exist');
ok(withDrill.reduce((a2, b) => a2 + b.minutes, 0) <= 60,
   'and the whole plan fits in the time it was asked for');

// low-ball-speed is the one that made this concrete: "Lag preservation — hold
// your wrist angle" was drills[0], with "Towel swings" (an audible whoosh, and
// entirely external) sitting right behind it.
console.log('— the case that started it —');
const lbs = [...block.matchAll(/id:'low-ball-speed'[\s\S]*?optimalRange/g)][0][0];
const lbsDrills = [...lbs.matchAll(/\{name:'([^']*)',desc:'(?:[^'\\]|\\.)*',focus:'(\w+)'\}/g)]
  .map(m => ({ name: m[1], focus: m[2] }));
ok(lbsDrills.some(d => d.focus !== 'feel'),
   'low-ball-speed has a checkable drill available');
ok(FE.splitDrills(lbsDrills).checkable[0].name === 'Towel swings',
   'and the split surfaces it ahead of "Lag preservation"');

console.log('— the 104-drill library is held to it too —');
// The library was written from the research base and is almost entirely
// external already — one drill in 104 asks for a body position mid-swing. So
// the default here is "external" and the EXCEPTION is declared, rather than
// labelling all 104 by hand. The guard runs both ways: a drill that trips the
// regex must carry `feel:true`, and a drill carrying it must actually need it.
const lib = (() => {
  const i = src.indexOf('const DrillLibrary');
  return src.slice(i, src.indexOf('\nconst ', i + 10));
})();
const libDrills = [...lib.matchAll(/D\((\d+),'(\w)','((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'([^)]*)\)/g)]
  .map(m => ({ n: +m[1], section: m[2], name: m[3], desc: m[4], feel: /feel:\s*true/.test(m[5]) }));
ok(libDrills.length === 104, `read all 104 library drills (found ${libDrills.length})`);

// Two drills trip the word list without meaning it: a junior's "growing spine"
// is an injury-load statement, and a "lag block" in putting is lag putting.
// Named here rather than weakened out of the regex, so the exemption is visible.
const NOT_A_CUE = new Set(['Junior swing-volume monitor', 'Three-putt-avoidance lag block']);
const tripped = libDrills.filter(d => INSWING.test(d.name + ' ' + d.desc) && !NOT_A_CUE.has(d.name));
ok(tripped.every(d => d.feel),
   `every library drill naming an in-swing body position declares it${
     tripped.filter(d => !d.feel).length ? ': ' + tripped.filter(d=>!d.feel).map(d=>d.name).join(', ') : ''}`);
ok(tripped.length === 1 && tripped[0].name === 'Posture-hold block',
   'and there is exactly one — "Posture-hold block", kept because standing up is a real toe-strike cause');
ok(libDrills.filter(d => d.feel).every(d => INSWING.test(d.name + ' ' + d.desc)),
   'nothing carries the flag without needing it');

console.log('— and the coaching tips hold the same line —');
// CLAUDE.md used to claim TIPS "never" named the golfer's own body parts. Four
// of them did: a trail elbow dropping to a hip pocket, a trail shoulder working
// down and under, a lead heel pressing into the ground, and a finish measured
// by where the hands ended up. All four are rewritten onto the club, the ball
// or the turf. A body word is still allowed as a landmark or a static setup
// check — purging every noun produces contorted prose — but not as an in-swing
// position to hold, which is what this asserts.
const tips = (() => {
  const i = src.indexOf('const TIPS');
  return src.slice(i, src.indexOf('\n  }', i));
})();
const lines = [...tips.matchAll(/^\s*'([^']+)',?$/gm)].map(m => m[1]);
ok(lines.length >= 20, `read ${lines.length} tips out of app.js`);
const HOLD = /\b(wrist|wrists|hip|hips|elbow|forearm|forearms|spine|shoulder|shoulders|knee|torso|lag|casting)\b/i;
const inward = lines.filter(t => HOLD.test(t));
ok(inward.length === 0,
   `no tip asks for an in-swing body position${inward.length ? ': ' + inward.map(t=>t.slice(0,40)).join(' | ') : ''}`);
ok(lines.filter(t => /knuckle|at address/i.test(t)).length > 0,
   'static setup checks are still allowed, and one is still there');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
