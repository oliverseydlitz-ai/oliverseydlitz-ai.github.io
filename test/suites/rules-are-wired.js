const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const M = require('../harness.js').load();
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');

// The single most repeated defect in this codebase is not a wrong number. It is
// a rule that is written down, has correct working code, and is never run:
//   · `Store.saveSession`   — imports bypassed device storage entirely
//   · `Router.showPractice` — the Practice tab rendered nothing
//   · four `FeedbackEngine` functions — the whole feedback setting did nothing
//   · `Conditions.comparable` — sessions were compared across ball types
//   · `Benchmarks.TARGET`   — targets were hardcoded in a second copy
//   · `Spin.summary`        — fully tested, called by nothing
//   · `DrillLibrary.FAULT_SECTION` — mapped faults that did not exist
//   · `Conditions.gappingValid` — the gapping table graded range balls anyway
//
// Every one of them passed `npm test`, because a unit suite answers "does this
// work" and never "is this reached". This suite asks the second question. It is
// deliberately crude: an identifier defined in one module and referenced from
// nowhere else is the tell, and it is cheap enough to run on every commit.

// Where each module's own source starts and ends, so "used elsewhere" means
// what it says.
function moduleBody(name) {
  const i = src.indexOf(`const ${name} = (() => {`);
  if (i < 0) return null;
  const j = src.indexOf('\n})();', i);
  return src.slice(i, j > 0 ? j : src.length);
}

// [identifier, defining module, what breaks silently if nothing calls it]
const WIRED = [
  ['gappingValid',    'Conditions',     'range-ball sessions get graded gap sizes'],
  ['dispersionValid', 'Conditions',     'range-ball spread is reported as if it were your own ball'],
  ['comparable',      'Conditions',     'sessions get compared across ball types'],
  ['MIN_SHOTS_REPORT','Metrics',        'club means print off any number of shots'],
  ['MIN_SHOTS_TAIL',  'Metrics',        'dispersion tails are computed off too few shots'],
  ['interval',        'Metrics',        'means are shown as bare points'],
  ['targetsFor',      'Benchmarks',     'the launch table grows a second copy of the target bands'],
  ['splitCauses',     'FaultEngine',    'body positions are asserted as measured findings'],
  ['splitDrills',     'FaultEngine',    'drills prescribe body positions the app cannot see'],
  ['admissible',      'DrillLibrary',   'locked drills are offered as if they could be run'],
  ['openProbes',      'RetentionProbe', 'nothing ever asks whether a change actually held'],
  ['libraryDrill',    'PracticePlan',   'the plan stops using the gated library'],
  ['transferBlock',   'PracticePlan',   'no plan ends with the block that transfers'],
  ['conditionGroups', 'Analytics',      'the yardage book pools across ball types again'],
  ['MIN_SHOTS_DELIVERY','Metrics',      'the four tier-2 fault rules keep their own copy of the 15-shot floor'],
  ['BALLS',           'Conditions',     'the import menu becomes a second hand-maintained copy of the ball list'],
  ['SURFACES',        'Conditions',     'the same, for the surface list'],
  ['movedToward',     'Benchmarks',     'the progress trend grades an angle on a fixed sign again'],
  ['changeIsReal',    'Metrics',        'a 1% move gets an arrow and a colour'],
];

console.log('— every gate the app defines is read by something outside its module —');
for (const [id, mod, consequence] of WIRED) {
  const body = moduleBody(mod);
  ok(body !== null, `${mod} is a module this check can find`);
  if (!body) continue;
  const uses = src.split(id).length - 1;
  const own = body.split(id).length - 1;
  ok(uses - own > 0, `${mod}.${id} is called from outside ${mod} — otherwise ${consequence}`);
}

// The check has exactly two known false-positive modes, both found the hard
// way, and both are why it names an alias rather than being made stricter:
//
//   1. A function called UNQUALIFIED from inside its own module is invisible to
//      a `Module.name` search. `Trajectory.arc` and `UI.renderSessionList` both
//      looked dead and both are live.
//   2. A constant RE-EXPORTED UNDER A DIFFERENT KEY is referenced by that key,
//      never by its own name. `Dispersion.CAVEATS` is returned as
//      `caveats:` and rendered as `r.value.caveats`; `Rounds.FIR_NOTE` as
//      `firNote:`. This check reported both as dead on its first run.
//
// So a caveat passes if EITHER its constant name or the key it ships under is
// read from outside. Weakening it further would defeat the point.
console.log('— and the caveats are rendered, not merely written —');
const CAVEAT_ALIASES = [
  ['CAVEATS',      'caveats',  'Dispersion'],
  ['BODY_CAVEAT',  null,       'FaultEngine'],
  ['FEEL_CAVEAT',  null,       'FaultEngine'],
  ['FIR_NOTE',     'firNote',  'Rounds'],
  ['caveats',      null,       'Conditions'],
  ['describe',     null,       'LocalDB'],
];
for (const [id, alias, mod] of CAVEAT_ALIASES) {
  const body = moduleBody(mod) || '';
  const outside = n => (src.split(n).length - 1) - (body.split(n).length - 1);
  ok(outside(id) > 0 || (alias && outside(alias) > 0),
     `${mod}.${id} reaches a render path${alias ? ` (as \`${alias}\`)` : ''} — a caveat nothing renders is not a caveat`);
}

console.log('— and the target bands have exactly one copy —');
// `Benchmarks.TARGET` is the only place the target bands may live. The
// launch-window table used to hardcode them inline, which is how the tour
// AVERAGE and the TARGET got conflated the first time — the PGA driver attack
// angle is -1.3°, descending, and +3.0° is the LPGA average, neither of which
// is what to aim at. The benchmark table was still carrying a third copy:
// `c==='d' ? uAA>=1 : isIron(c) ? (uAA<=-2 && uAA>=-6) : (uAA<=-0.5)`, captioned
// "+3° ideal", disagreeing with the real bands in both directions.
{
  // Scan CODE, not comments. The first version of this check failed on the
  // comment that explains it: the note recording what the old inline copy
  // looked like contains the very string the check forbids. A source-scanning
  // test has to strip the prose or it will eventually be turned off by someone
  // who documented something well.
  const code = src.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  const callSites = (src.split('targetsFor(').length - 1);
  ok(callSites >= 3, `targetsFor is read from more than one render path (${callSites} call sites)`);
  ok(!/\+3°[^<]*ideal|ideal[^<]*\+3°/i.test(code),
     'no "+3° ideal" caption survives — that number is the LPGA average, not a target');
  const benchStart = code.indexOf('function renderBenchTable');
  const bench = code.slice(benchStart, src.indexOf('  // ── Shot log', benchStart));
  ok(/targetsFor\(/.test(bench), 'the benchmark table reads the bands rather than restating them');
  ok(!/uAA\s*[<>]=/.test(bench), 'and has no inline attack-angle comparison of its own left');
}

console.log('— and no replaced formula is still in use anywhere —');
// The other half of "is this rule reached": a helper written to REPLACE
// something, with the old thing still live somewhere else. `consistencyScore`
// was written to replace `100 - stdDev(carries)`, its comment says so, and
// three call sites were never migrated — one of them 30% of the letter grade.
// A partial fix is worse than none, because the comment reads as done.
//
// Each entry names the dead expression and what supersedes it. Comments are
// stripped first, so the note explaining a fix does not fail the check on it.
{
  const code = src.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  const ZOMBIES = [
    ['100 - stdDev',  'consistencyScore() / bagConsistency() — a yard figure is not a percentage'],
    ['100-stdDev',    'the same, unspaced'],
    ['faults[0].pct', 'a fault carries `rate`, not `pct` — this rendered as NaN in a red alert'],
    ['minShots: 15',  'Metrics.MIN_SHOTS_DELIVERY — four rules kept private copies of the 15'],
  ];
  for (const [dead, instead] of ZOMBIES) {
    const n = code.split(dead).length - 1;
    ok(n === 0, `no live \`${dead}\` left${n ? ` (${n} found)` : ''} — use ${instead}`);
  }
}

// `.pct` on its own is NOT dead — `Features.focus()` and `Goals` both return a
// real `pct`. Only a FAULT does not have one, so that invariant is asserted on
// the object rather than by grepping for a property name that has honest uses.
{
  const { FaultEngine: FE2, Store: St } = M;
  const shots = Array.from({ length: 24 }, (_, i) => ({ _row: i + 2, clubType: 'd',
    ballSpeed: 150, clubSpeed: 105, smashFactor: 1.43, launchAngle: 12,
    attackAngle: -6, clubPath: 0, carryDistance: 250, totalDistance: 270 }));
  const sn = St.stamp({ id: 'z', date: '2026-07-01',
    conditions: { ball: 'premium', surface: 'grass' }, shots });
  const f = FE2.detectFaults(sn.shots, sn)[0];
  ok(!!f, 'a fault is produced to inspect');
  ok(f && f.pct === undefined, 'a fault has no `pct` field — anything rendering one printed NaN');
  ok(f && typeof f.rate === 'number', 'it has `rate`, which is what a percentage should come from');
  ok(f && typeof f.count === 'number' && typeof f.total === 'number',
     'plus the raw counts, so a message can say "N of M" instead of a bare percentage');
}

console.log('— and no module keeps its own copy of a launch-metric threshold —');
// The target bands were copied NINE times before this check existed: the
// launch-window table, the benchmark table, ShotScorer, SwingDNA (twice — the
// attack target and the spin window), Insights (twice — the attack target and
// the smash benchmarks), and the two found by the wiring audit. Every copy
// disagreed with `Benchmarks.TARGET`, and several disagreed in the direction
// that flatters the golfer.
//
// `Benchmarks` owns the bands. `FaultEngine` owns the fault triggers, which
// are a separate and deliberately buffered concept — `faults-vs-targets.js`
// guards the one relationship between them. NOBODY ELSE compares a launch
// metric against a number.
{
  const strip = (name, s2) => {
    const i = s2.indexOf('const ' + name);
    if (i < 0) return s2;
    const j = s2.indexOf('\n})();', i);
    return s2.slice(0, i) + '\n'.repeat(s2.slice(i, j).split('\n').length) + s2.slice(j);
  };
  const bare = src.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  const rest = strip('FaultEngine', strip('Benchmarks', bare));
  // `x > 0` and `x !== 0` are sign and presence checks, not thresholds, so the
  // pattern requires a non-zero literal. Narrowing it here rather than letting
  // it cry wolf is the point: a check that fires on `spinRate > 0` gets
  // deleted by the next person.
  const PAT = /\b(attackAngle|launchAngle|spinRate|clubPath|aa|uAA|uLA)\s*[<>]=?\s*-?(?!0\b)\d+(?:\.\d+)?/g;
  const found = [...rest.matchAll(PAT)].map(m => `${m[0]} (line ${rest.slice(0, m.index).split('\n').length})`);
  ok(found.length === 0,
     `no launch-metric threshold outside Benchmarks/FaultEngine${found.length ? ': ' + found.join(', ') : ''}`);
  // And the smash benchmarks, copied twice as `allIron ? 1.35 : 1.43`.
  ok(!/1\.35\s*:\s*1\.43|1\.43\s*:\s*1\.35/.test(bare),
     'and no private copy of the amateur smash rows — Benchmarks.get(club).am.sf has them per club');
}

// A check that cannot fail proves nothing, and this one is a string search —
// exactly the shape that quietly stops discriminating. `ViewPrefs.setPref` is
// confirmed dead and deliberately left in place (HANDOVER lists it), so it is
// the negative control: if this stops reading as unwired, the check above has
// gone blind and its passes are worthless.
console.log('— and the check can still tell the difference —');
{
  const body = moduleBody('ViewPrefs') || '';
  const outside = (src.split('setPref').length - 1) - (body.split('setPref').length - 1);
  ok(outside === 0,
     'ViewPrefs.setPref still reads as called by nothing — the control the detector is measured against');
}

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
