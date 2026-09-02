const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { DrillLibrary: L } = M;

const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 80, smashFactor: 1.35, carryDistance: 150,
  sideCarry: 3, clubSpeed: 59, launchDirection: 1, clubPath: -1, attackAngle: -4,
  _ball: 'premium', _surface: 'grass', _aligned: true, ...o });
const many = (n, o) => Array.from({ length: n }, () => shot(o));

console.log('— the library is the whole spec, section by section —');
ok(L.count() === 104, `104 drills (${L.count()})`);
for (const [id, sec] of Object.entries(L.SECTIONS)) {
  ok(L.bySection(id).length === sec.count, `${id} ${sec.name}: ${sec.count} drills`);
}
ok(new Set(L.ALL.map(d => d.id)).size === 104, 'every id is unique');
ok(L.ALL.every(d => d.name && d.desc), 'every drill has a name and a description');
ok(L.byId('a1').name === 'Smash Baseline Audit', 'lookup by id works');
ok(L.byId('nope') === null, 'and an unknown id is null rather than a default');

console.log('— every section carries its measurement gate as data —');
ok(L.SECTIONS.B.gate.shots === 30 && L.SECTIONS.B.gate.ball === 'premium',
   'dispersion needs 30 shots on a premium ball');
ok(L.SECTIONS.C.gate.alignment === true, 'start line needs confirmed alignment');
ok(L.SECTIONS.F.gate.ball === 'premium', 'gapping is premium-ball only');
ok(L.SECTIONS.H.gate.none === true, 'and putting is gated on nothing, because no metric here is measured');
ok(Object.values(L.SECTIONS).every(s => s.why && s.structure),
   'each section states why it exists and how it is structured');

console.log('— a gate that fails returns the reason, it does not hide the drill —');
const thin = L.admissible(L.byId('b19'), { shots: many(12), clubType: '7i' });
ok(thin.ok === false, 'a 12-shot set cannot run a tail audit');
ok(/Needs 30 shots/.test(thin.reasons.join(' ')), 'and says how many it needs');
ok(L.forSection('B', { shots: many(12), clubType: '7i' }).length === 14,
   'the locked drills are still returned, with their verdicts');

console.log('— range balls lock the sections that depend on the ball —');
const range = many(40, { _ball: 'range' });
ok(L.admissible(L.byId('b19'), { shots: range, clubType: '7i' }).ok === false, 'dispersion is refused');
ok(/2–4× wider/.test(L.admissible(L.byId('b19'), { shots: range, clubType: '7i' }).reasons.join(' ')),
   'with the reason a golfer can act on');
ok(L.admissible(L.byId('f65'), { shots: range, clubType: '7i' }).ok === false, 'so is gapping');
ok(L.admissible(L.byId('a1'), { shots: range, clubType: '7i' }).ok === true,
   'but strike quality is not — smash does not care what ball it was');

console.log('— an unaligned unit locks start line and nothing else —');
const unaligned = many(20, { _aligned: false });
ok(L.admissible(L.byId('c33'), { shots: unaligned, clubType: '7i' }).ok === false, 'start line is held back');
ok(/constant offset/.test(L.admissible(L.byId('c33'), { shots: unaligned, clubType: '7i' }).reasons.join(' ')),
   'because aiming error is a bias, not noise');
ok(L.admissible(L.byId('d43'), { shots: many(22, { _aligned: false }), clubType: '7i' }).ok === true,
   'while face-to-path, which is a spread around your own centre, is not');

console.log('— a mat is flagged, never refused —');
const mat = L.admissible(L.byId('e53'), { shots: many(20, { _surface: 'mat' }), clubType: '7i' });
ok(mat.ok === true, 'a low-point drill still runs on a mat');
ok(mat.flaggedOnly === true, 'but it is flagged');
ok(/hides? the fat strikes|hide the fat strikes|not the fat strikes/.test(mat.reasons.join(' ')),
   'with the thing it will fail to show you');

console.log('— off-device drills need nothing at all —');
ok(L.admissible(L.byId('h88'), {}).ok === true, 'the quiet-eye protocol runs with no data');
ok(L.admissible(L.byId('h88'), {}).offDevice === true, 'and is marked as off-device');
ok(L.admissible(L.byId('g80'), {}).ok === true, 'so does a gym block');
ok(L.bySection('H').every(d => d.noDevice), 'every putting drill is off-device — the MLM2PRO cannot see a putt');

console.log('— per-drill overrides beat the section gate —');
ok(L.admissible(L.byId('d43'), { shots: many(16), clubType: '7i' }).ok === false,
   'the face-to-path baseline asks for 20 where its section asks for 15');
ok(L.admissible(L.byId('d45'), { shots: many(16), clubType: '7i' }).ok === true,
   'while the bracket drills in the same section are happy at 15');

console.log('— trends need sessions, and say so separately from shots —');
const t = L.admissible(L.byId('b32'), { shots: many(40), clubType: '7i', sessions: 2 });
ok(t.ok === false && /5 qualifying sessions/.test(t.reasons.join(' ')), 'a trend review needs five sessions');
ok(/not a before-and-after/.test(t.reasons.join(' ')), 'and says why two would not do');
ok(L.admissible(L.byId('b32'), { shots: many(40), clubType: '7i', sessions: 6 }).ok === true,
   'and unlocks once they exist');

console.log('— the wrappers are not drills you choose instead —');
ok(L.wrappers().length === 10, 'ten of them');
ok(L.SECTIONS.I.wrapper === true, 'the section is marked as a wrapper');
ok(L.wrappers().every(d => L.admissible(d, {}).ok), 'they never lock — they are how a session is run, not what is in it');
ok(L.byId('i99').name === 'Next-day retention probe', 'including the efficacy metric itself');

console.log('— faults join to sections, many to one —');
ok(L.sectionForFault('poor-contact') === 'A', 'contact faults go to strike quality');
ok(L.sectionForFault('slice') === 'D', 'curvature faults to face-to-path');
ok(L.sectionForFault('pull-left') === 'C', 'directional faults to start line');
ok(L.sectionForFault('fat-shot') === 'E', 'and strike-height faults to low point');
ok(L.sectionForFault('nonexistent') === null, 'an unknown fault maps to nothing rather than a default drill');
ok(Object.values(L.FAULT_SECTION).every(s => s in L.SECTIONS), 'every mapping points at a real section');

// The first version of this table was written from the section headings rather
// than from FaultEngine, so it mapped inventions like 'open-face' and
// 'two-way-miss' and returned null for almost every fault the app can raise —
// a join that looks complete and joins nothing. Both directions are checked.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../app.js'), 'utf8');
const seg = src.slice(src.indexOf('const FaultEngine'), src.indexOf('const ShotScorer'));
const realIds = [...new Set([...seg.matchAll(/id:'([a-z0-9-]+)'/g)].map(m => m[1]))];
ok(realIds.length > 15, `found ${realIds.length} real fault ids to check against`);
const unmapped = realIds.filter(i => !L.sectionForFault(i));
ok(unmapped.length === 0, `every fault FaultEngine can raise maps to a section${unmapped.length ? ' — missing: ' + unmapped.join(', ') : ''}`);
const bogus = Object.keys(L.FAULT_SECTION).filter(k => !realIds.includes(k));
ok(bogus.length === 0, `and no mapping points at a fault that does not exist${bogus.length ? ' — ' + bogus.join(', ') : ''}`);

console.log('— the plan prescribes from the gated library, not from a loose list —');
const { PracticePlan: P, FeedbackEngine: FE } = M;
const mk = (n, o = {}) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));
const fault = (id, rows) => ({ id, name: id, icon: '·', severity: 'high', drills: [{ name: 'fallback', desc: 'x' }],
  affectedShots: rows });

// A contact fault on 20 premium-ball shots: section A, and A opens at 10.
const good = P.libraryDrill(fault('poor-contact', []), mk(20), null);
ok(good.section === 'A', 'a contact fault resolves to strike quality');
ok(good.libraryDrill !== null, 'and gets a real drill from the library');
ok(good.structure.includes('Bandwidth'), 'carrying its section\'s structure, which is the part that transfers');
ok(good.lockedNote === null, 'with nothing withheld');

// The same fault on range balls: strike quality does not care about the ball.
ok(P.libraryDrill(fault('poor-contact', []), mk(20, { _ball: 'range' })).libraryDrill !== null,
   'range balls do not lock strike quality — smash does not care what ball it was');

// A dispersion fault on range balls: section B is premium-only, so it locks.
const locked = P.libraryDrill(fault('dispersion-wide', []), mk(40, { _ball: 'range' }));
ok(locked.section === 'B', 'a dispersion fault resolves to the tail section');
ok(locked.libraryDrill === null, 'which is entirely locked on range balls');
ok(/2–4× wider/.test(locked.lockedNote), 'and says what would unlock it rather than substituting a drill');

// A start-line fault from an unaligned unit.
const unaligned2 = P.libraryDrill(fault('pull-left', []), mk(20, { _aligned: false }));
ok(unaligned2.libraryDrill === null && /constant offset/.test(unaligned2.lockedNote),
   'start-line work is withheld from an unaligned unit, with the reason');

ok(Object.keys(P.libraryDrill({ id: 'not-a-fault', drills: [] }, mk(20))).length === 0,
   'an unmapped fault falls back to the fault\'s own drill rather than guessing');

console.log('— and every plan carries the wrapper that decides whether it transfers —');
for (const m of ['faded','bandwidth','onRequest','always']) {
  FE.setMode(m);
  const w = P.wrapperFor(m);
  ok(w && w.section === 'I', `${m} maps to a section-I wrapper (${w && w.name})`);
}
ok(/argues against/.test(P.wrapperFor('always').note),
   'and "show every number" is told it is the setting the evidence argues against');
ok(/matters more than/.test(P.wrapperFor('faded').note),
   'while the rest are told the wrapper outranks the drill choice');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
