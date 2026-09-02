const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { FaultEngine: FE, Benchmarks: B, Metrics, Store } = M;

// Fault thresholds are NOT the target bands and should not be — a fault marks
// "far enough outside to be worth reporting" and is deliberately buffered past
// the target, so a golfer 0.5° off ideal is not told they have a fault. The
// numbers are separate on purpose (driver attack fires below -1° against a
// +2..+5° target, driver launch below 9° against a 10–15° band, and so on).
//
// But one relationship has to hold, and nothing checked it: the app must never
// report a fault about a number it elsewhere calls the target. This walks each
// band and asserts silence, behaviourally rather than by parsing thresholds
// out of the source, so a rule rewritten in a different shape is still caught.
const base = (o = {}) => ({ smashFactor: 1.45, ballSpeed: 150, clubSpeed: 104,
  spinRate: 2600, carryDistance: 250, totalDistance: 270, clubPath: 0,
  launchDirection: 0, sideCarry: 2, ...o });
const session = shots => Store.stamp({ id: 't', date: '2026-07-01',
  conditions: { ball: 'premium', surface: 'grass', alignment: 'confirmed' }, shots });

// 24 identical shots clears every gate the engine has: MIN_SHOTS_REPORT (10),
// the tier-2 delivery floor (15), MIN_AFFECTED (2) and MIN_RATE (0.30). If a
// fault CAN fire on this value, it will.
const run = (club, field, value, extra = {}) => {
  const shots = Array.from({ length: 24 }, (_, i) =>
    ({ _row: i + 2, clubType: club, ...base({ [field]: value, ...extra }) }));
  const s = session(shots);
  return FE.detectFaults(s.shots, s);
};

const CLUBS = [
  ['d',   'Driver',      { smashFactor: 1.48, ballSpeed: 155, clubSpeed: 105, carryDistance: 265 }],
  ['7i',  '7-iron',      { smashFactor: 1.38, ballSpeed: 118, clubSpeed: 85, carryDistance: 165, spinRate: 6800 }],
  ['3w',  '3-wood',      { smashFactor: 1.46, ballSpeed: 143, clubSpeed: 98, carryDistance: 235, spinRate: 3200 }],
  ['pw',  'Pitching wedge', { smashFactor: 1.25, ballSpeed: 95, clubSpeed: 76, carryDistance: 120, spinRate: 8500 }],
];

console.log('— no attack-angle fault fires anywhere inside the attack target —');
for (const [club, label, extra] of CLUBS) {
  const band = B.targetsFor(club).attack;
  for (const v of [band.lo, (band.lo + band.hi) / 2, band.hi]) {
    const bad = run(club, 'attackAngle', v, { launchAngle: (B.targetsFor(club).launch.lo + B.targetsFor(club).launch.hi) / 2, ...extra })
      .filter(f => f.category === 'Attack Angle');
    ok(bad.length === 0,
       `${label} at ${v}° attack (target ${band.label}) raises no attack fault${bad.length ? ': ' + bad.map(f=>f.id).join(', ') : ''}`);
  }
}

console.log('— nor a launch fault inside the launch target —');
for (const [club, label, extra] of CLUBS) {
  const band = B.targetsFor(club).launch;
  const aBand = B.targetsFor(club).attack;
  for (const v of [band.lo, (band.lo + band.hi) / 2, band.hi]) {
    const bad = run(club, 'launchAngle', v, { attackAngle: (aBand.lo + aBand.hi) / 2, ...extra })
      .filter(f => f.category === 'Launch');
    ok(bad.length === 0,
       `${label} at ${v}° launch (target ${band.label}) raises no launch fault${bad.length ? ': ' + bad.map(f=>f.id).join(', ') : ''}`);
  }
}

console.log('— and the buffer is real: just outside the band still says nothing —');
// The gap between the target band and the fault threshold is deliberate. A
// golfer one degree the wrong side of ideal has not developed a fault, and a
// tool that says otherwise trains people to chase noise.
const dAttack = B.targetsFor('d').attack;
const justUnder = run('d', 'attackAngle', dAttack.lo - 1,
  { launchAngle: 12, smashFactor: 1.48, ballSpeed: 155, clubSpeed: 105, carryDistance: 265 })
  .filter(f => f.category === 'Attack Angle');
ok(justUnder.length === 0, `a driver at ${dAttack.lo - 1}° — one degree under target — is not yet a fault`);

console.log('— but a genuinely steep one is still caught —');
const steep = run('d', 'attackAngle', -6,
  { launchAngle: 12, smashFactor: 1.48, ballSpeed: 155, clubSpeed: 105, carryDistance: 265 })
  .filter(f => f.category === 'Attack Angle');
ok(steep.length > 0, `a driver chopping down at -6° does raise one (${steep.map(f=>f.id).join(', ')})`);

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
