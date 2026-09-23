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

console.log('— a tour-average club raises no fault, and scores like one (C7, C35) —');
// Every threshold used to be one number per club FAMILY: smash 1.33 for every
// non-wood, 1.41 as "elite" for every iron, one spin-loft band from the 8-iron
// to the lob wedge. Against Benchmarks' own PGA rows, a tour 9-iron to lob
// wedge tripped "Poor Contact", tour AW/SW/LW tripped "Adding Loft", and a
// tour sand wedge scored 59. Every PGA row is now run through the engine.
//
// ONE named exemption: driver-negative-aa. The PGA average attack angle is
// -1.3° (descending) and the TARGET is +2..+5°, deliberately — "what to aim at
// is not what the tour averages" (Benchmarks.TARGET). That fault firing on the
// tour row is the target working, not a threshold that forgot the club.
const EXEMPT = { 'driver-negative-aa': 'the target band is deliberately not the tour average' };
const ALL_CLUBS = ['d','2w','3w','4w','5w','7w','2h','3h','4h','5h','1i','2i','3i','4i','5i','6i','7i','8i','9i','pw','aw','sw','lw'];
const asShots = (club, r) => Array.from({ length: 24 }, (_, i) => ({ _row: i + 2, clubType: club, smashFactor: r.sf,
  carryDistance: r.carry, totalDistance: r.carry + 10, ballSpeed: r.bs, clubSpeed: +(r.bs / r.sf).toFixed(1),
  launchAngle: r.la, attackAngle: r.aa, clubPath: 0, launchDirection: 0, sideCarry: 0 }));
const tripped = [], lowScores = [], amWorse = [];
for (const club of ALL_CLUBS) {
  const row = B.get(club);
  const pga = session(asShots(club, row.pga));
  FE.detectFaults(pga.shots, pga).filter(f => !(f.id in EXEMPT)).forEach(f => tripped.push(`${club}: ${f.id}`));
  const sc = M.ShotScorer.score(pga.shots[0]);
  if (club !== 'd' && sc < 90) lowScores.push(`${club} ${sc}`);
  const am = session(asShots(club, row.am));
  FE.detectFaults(am.shots, am).filter(f => f.id === 'poor-contact' || f.id === 'high-spin-loft')
    .forEach(f => amWorse.push(`${club}: ${f.id}`));
}
ok(tripped.length === 0, `no PGA-average club raises a fault${tripped.length ? ' — ' + tripped.join(', ') : ''}`);
ok(lowScores.length === 0, `and every PGA-average club but the driver scores 90+${lowScores.length ? ' — ' + lowScores.join(', ') : ''}`);
ok(amWorse.length === 0, `the average AMATEUR strike is not "poor contact" or "adding loft" on any club${amWorse.length ? ' — ' + amWorse.join(', ') : ''}`);
ok(M.Benchmarks.smashRef('d').floor === 1.40 && M.Benchmarks.smashRef('d').good === 1.44,
   'the driver keeps the thresholds it always had (1.40 floor, 1.44 good) — the margins are read off it');

console.log('— a bag is not one club (C1, C2, C34) —');
// Twenty identical drivers, then twenty identical wedges. Per club there is
// nothing to say. Pooled, the old session rules saw a 55 mph "fatigue" drop,
// a smash spread, a launch spread and a side-carry spread — the driver-to-
// wedge gap, reported as four faults on the session.
{
  const drv = Array.from({ length: 20 }, (_, i) => ({ _row: i + 2, clubType: 'd', ...base({ launchAngle: 12, attackAngle: 3, sideCarry: 18 }) }));
  const sw = Array.from({ length: 20 }, (_, i) => ({ _row: i + 22, clubType: 'sw', ...base({ smashFactor: 1.20, ballSpeed: 95,
    clubSpeed: 79, carryDistance: 95, totalDistance: 98, launchAngle: 31, attackAngle: -5, spinRate: 9000, sideCarry: -18 }) }));
  const s = session([...drv, ...sw]);
  const pooled = FE.detectFaults(s.shots, s).filter(f => f.total === s.shots.length && new Set(s.shots.map(x => x.clubType)).size > 1
    && /Consistency/.test(f.category));
  ok(pooled.length === 0, `no fault is raised on the whole bag at once${pooled.length ? ' — ' + pooled.map(f => f.name).join(', ') : ''}`);
}

console.log('— the floor and the rate are per club (C28) —');
// Four mishit 7-irons, three 9-irons and three PWs made "Poor Contact, 10 of
// 10 shots" — a #1-priority fault off a 10-shot floor no club had reached.
{
  const poor = (club, n, from) => Array.from({ length: n }, (_, i) => ({ _row: from + i, clubType: club,
    ...base({ smashFactor: 1.05, ballSpeed: 90, clubSpeed: 86, carryDistance: 120, launchAngle: 18, attackAngle: -4 }) }));
  const fine = (club, n, from) => Array.from({ length: n }, (_, i) => ({ _row: from + i, clubType: club,
    ...base({ smashFactor: B.get(club).pga.sf, ballSpeed: B.get(club).pga.bs, clubSpeed: +(B.get(club).pga.bs / B.get(club).pga.sf).toFixed(1),
      carryDistance: B.get(club).pga.carry, launchAngle: B.get(club).pga.la, attackAngle: B.get(club).pga.aa }) }));
  const mixed = session([...poor('7i', 4, 2), ...poor('9i', 3, 6), ...poor('pw', 3, 9)]);
  const pc = FE.detectFaults(mixed.shots, mixed).find(f => f.id === 'poor-contact');
  ok(!pc, `three clubs under their floor do not add up to one over it${pc ? ' — got ' + pc.evidence : ''}`);

  const one = session([...poor('7i', 12, 2), ...poor('9i', 3, 14), ...fine('pw', 12, 17)]);
  const pc1 = FE.detectFaults(one.shots, one).find(f => f.id === 'poor-contact');
  ok(pc1 && pc1.total === 12 && pc1.count === 12 && pc1.clubType === '7i',
     `a club over its floor is reported on its own shots only (${pc1 ? pc1.evidence : 'none'})`);
  ok(pc1 && !pc1.affectedShots.some(r => r >= 14 && r < 17), 'and the under-floor 9-irons are not counted into it');
}

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
