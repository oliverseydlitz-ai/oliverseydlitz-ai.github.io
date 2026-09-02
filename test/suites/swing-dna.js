const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { SwingDNA: DNA, Benchmarks: B, Metrics } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
const mod = src.slice(src.indexOf('const SwingDNA'), src.indexOf('\n})();', src.indexOf('const SwingDNA')));
const code = mod.split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');

// The largest concentration of forbidden claims left in the app, and a
// pre-research-base module that never got revisited.
const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 152, clubSpeed: 104, smashFactor: 1.46,
  launchAngle: 12, attackAngle: 2, clubPath: 0.5, sideCarry: 2, spinRate: 2400,
  carryDistance: 235, totalDistance: 258, ...o });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));
const pills = (shots) => DNA.analyze(shots);
const cats = (shots) => pills(shots).map(p => p.category);
const val = (shots, cat) => (pills(shots).find(p => p.category === cat) || {}).value || '';
const tone = (shots, cat) => (pills(shots).find(p => p.category === cat) || {}).tone;

console.log('— no private copies of anything survive —');
ok(!/1\.35|1\.43/.test(code), 'the hardcoded smash benchmarks are gone — Benchmarks.get() has them per club');
ok(!/2500|3200|3800/.test(code), 'and the private driver-spin bands');
ok(!/aa >= 1|aa >= -1/.test(code), 'and the seventh copy of the driver attack target');
ok(/targetsFor/.test(code), 'the bands are read from the one table');
ok(/Benchmarks\.get/.test(code), 'and so are the amateur/tour rows');

console.log('— it reads on ONE club and says which —');
const mixed = [...many(30, { clubType: 'd' }), ...many(12, { clubType: 'pw', smashFactor: 1.22, carryDistance: 110 })];
ok(cats(mixed).includes('Read on'), 'the first pill names what it is reading');
ok(/Driver/.test(val(mixed, 'Read on')) && /30 shots/.test(val(mixed, 'Read on')),
   'the most-hit club, with its count');
ok(!/1\.2\d/.test(val(mixed, 'Smash factor')),
   'the wedge does not drag the driver smash figure down — the old version pooled them');

console.log('— nothing at all below the floor —');
const thin = pills(many(5));
ok(thin.length === 1 && thin[0].category === 'Not yet',
   `5 shots produces one honest pill, not six verdicts (floor ${Metrics.MIN_SHOTS_REPORT})`);
ok(/more shots/.test(thin[0].value), 'and it says what it needs');

console.log('— a verdict tone only on tier 1 —');
const full = many(20);
const graded = pills(full).filter(p => p.tone === 'good' || p.tone === 'bad').map(p => p.category);
ok(graded.every(c => /Strike|Smash/.test(c)),
   `only strike metrics carry a good/bad tone (${graded.join(', ') || 'none'})`);
ok(tone(full, 'Club path') === 'ok', 'club path is tier 2 — described, never graded');
ok(tone(full, 'Where it finishes') === 'ok', 'and side carry is tier 3');
ok(/modelled figure, not a measurement/.test(val(full, 'Where it finishes')),
   'which it says on the pill');

console.log('— "Hooker" and "Slicer" are gone —');
// The old module called a golfer a Hooker, tone `bad`, off a mean side carry —
// a tier-3 modelled output — with no floor and every club pooled together.
const hooky = many(20, { sideCarry: -22 });
ok(!/Hook|Slic/i.test(pills(hooky).map(p => p.value).join(' ')),
   'a 22-yard average miss is described, not given a label about the golfer');
ok(/left of target/.test(val(hooky, 'Where it finishes')), 'it says where the ball finished');

console.log('— the tier-2 angles need the bigger floor —');
const twelve = many(12);
ok(!cats(twelve).includes('Club path'),
   `12 shots is under the delivery floor of ${Metrics.MIN_SHOTS_DELIVERY}, so no path pill`);
ok(cats(twelve).includes('Smash factor'), 'while tier-1 smash clears the smaller floor and still shows');
ok(cats(many(20)).includes('Club path'), 'at 20 the path pill appears');

console.log('— attack angle is stated against its own band —');
ok(/target/.test(val(full, 'Attack angle')), 'the pill carries the target band');
ok(/\+2° to \+5°/.test(val(full, 'Attack angle')),
   `which is Benchmarks.TARGET's, not a private one (${B.targetsFor('d').attack.label})`);
ok(/inside it/.test(val(many(20, { attackAngle: 3 }), 'Attack angle')),
   'and says when the golfer is inside it');

console.log('— spin is described and disclaimed, never judged —');
const rpt = many(20, { _ball: 'rpt', spinRate: 4200 });
const spinPill = pills(rpt.map(s => ({ ...s, _ball: 'rpt' }))).find(p => p.category === 'Spin');
if (spinPill) {
  ok(spinPill.tone === 'ok', 'no good/bad on spin');
  ok(/never a prescription/.test(spinPill.value), 'and the pill says so outright');
} else {
  ok(true, 'spin is suppressed without an RPT ball, which is the other correct answer');
}

console.log('— and face-to-path has no pill at all —');
ok(!/[Ff]ace.?to.?[Pp]ath|faceP/.test(code),
   'a five-shot mean with "Open (fading) ✗" was the worst claim in the module');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
