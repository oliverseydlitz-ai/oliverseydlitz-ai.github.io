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
// C16: the app keeps exactly ONE strokes figure, and it lives in Dispersion.
// Section A's "roughly 0.8–1.3 strokes a round" and B's restated Broadie & Ko
// valuation were a second and third, rendered as the section's evidence.
// C17: D quoted "±1.8° of single-shot noise", the figure Metrics.DEVICE_ERROR
// retracted because nobody ever measured it.
const whys = Object.values(L.SECTIONS).map(sc => `${sc.id}: ${sc.why}`);
const strokeClaims = whys.filter(w => /\d[\d.,–-]*\s*strokes?\b/i.test(w));
ok(strokeClaims.length === 0, `no section states a strokes figure${strokeClaims.length ? ' — ' + strokeClaims.join(' | ') : ''}`);
ok(!whys.some(w => /1\.8\s*°/.test(w)), 'and none quotes the retracted 1.8° noise constant');
ok(/\d[\d.,–-]*\s*strokes?\b/i.test('roughly 0.8–1.3 strokes a round'), 'and the pattern finds the shipped claim');
ok(L.SECTIONS.B.gate.shots === 30 && !L.SECTIONS.B.gate.ball,
   'dispersion needs 30 shots, on any ball (v2: range balls are near-normal data)');
ok(L.SECTIONS.C.gate.alignment === true, 'start line needs confirmed alignment');
ok(!L.SECTIONS.F.gate.ball && L.SECTIONS.F.gate.shots === 10, 'gapping needs 10 shots a club, on any ball (v2)');
ok(L.SECTIONS.H.gate.none === true, 'and putting is gated on nothing, because no metric here is measured');
ok(Object.values(L.SECTIONS).every(s => s.why && s.structure),
   'each section states why it exists and how it is structured');

console.log('— a gate that fails returns the reason, it does not hide the drill —');
const thin = L.admissible(L.byId('b19'), { shots: many(12), clubType: '7i' });
ok(thin.ok === false, 'a 12-shot set cannot run a tail audit');
ok(/Needs 30 shots/.test(thin.reasons.join(' ')), 'and says how many it needs');
ok(L.forSection('B', { shots: many(12), clubType: '7i' }).length === 14,
   'the locked drills are still returned, with their verdicts');

console.log('— range balls no longer lock anything (v2) —');
const range = many(40, { _ball: 'range' });
ok(L.admissible(L.byId('b19'), { shots: range, clubType: '7i' }).ok === true, 'dispersion runs on range balls');
ok(L.admissible(L.byId('f65'), { shots: range, clubType: '7i' }).ok === true, 'so does gapping');
ok(L.admissible(L.byId('b19'), { shots: many(12, { _ball: 'range' }), clubType: '7i' }).ok === false,
   'the 30-shot floor still applies — floors are unchanged');
ok(L.admissible(L.byId('a1'), { shots: range, clubType: '7i' }).ok === true,
   'but strike quality is not — smash does not care what ball it was');

console.log('— an unaligned unit locks start line and nothing else —');
const unaligned = many(20, { _aligned: false });
ok(L.admissible(L.byId('c33'), { shots: unaligned, clubType: '7i' }).ok === false, 'start line is held back');
ok(/Needs 30 shots/.test(L.admissible(L.byId('c33'), { shots: unaligned, clubType: '7i' }).reasons.join(' ')) &&
   /alignment wasn't confirmed/.test(L.admissible(L.byId('c33'), { shots: unaligned, clubType: '7i' }).reasons.join(' ')),
   'an unconfirmed alignment raises the floor to 30 and says why, rather than banning the section');
ok(L.admissible(L.byId('c33'), { shots: many(32, { _aligned: false }), clubType: '7i' }).ok === true,
   'and at 30 shots start-line work opens, aligned or not');
ok(L.admissible(L.byId('c33'), { shots: many(12, { _aligned: true }), clubType: '7i' }).ok === false &&
   L.admissible(L.byId('c33'), { shots: many(16, { _aligned: true }), clubType: '7i' }).ok === true,
   'aligned, the section keeps its own 15-shot floor');
ok(L.admissible(L.byId('d43'), { shots: many(22, { _aligned: false }), clubType: '7i' }).ok === true,
   'while face-to-path, which is a spread around your own centre, is not');

console.log('— a mat is neither refused nor flagged (v2: the mat note lives in Settings) —');
const mat = L.admissible(L.byId('e53'), { shots: many(20, { _surface: 'mat' }), clubType: '7i' });
ok(mat.ok === true && mat.reasons.length === 0, 'a low-point drill runs on a mat with no caveat attached');

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

console.log('— the pick is a range drill that fits the club (C10) —');
// A driver attack-angle fault was handed the divot-line drill: a teed driver
// takes no divot, and the tee-height ladder sat in the same section.
const drvPick = P.libraryDrill(fault('driver-negative-aa', []), mk(20, { clubType: 'd', attackAngle: -3 }));
ok(drvPick.section === 'E' && drvPick.libraryDrill && L.fitsClub(drvPick.libraryDrill, 'd'),
   `a driver low-point fault gets a drill a driver can run (${drvPick.libraryDrill && drvPick.libraryDrill.name})`);
ok(drvPick.libraryDrill && drvPick.libraryDrill.name !== 'Divot-line drill', 'not the divot-line drill');
const ironPick = P.libraryDrill(fault('iron-very-steep', []), mk(20, { clubType: '7i', attackAngle: -8 }));
ok(ironPick.libraryDrill && !/\(driver\)/.test(ironPick.libraryDrill.name) && L.fitsClub(ironPick.libraryDrill, '7i'),
   `and a 7-iron one does not get the tee-height ladder (${ironPick.libraryDrill && ironPick.libraryDrill.name})`);
ok([drvPick, ironPick, good].every(x => !x.libraryDrill || L.kindOf(x.libraryDrill) === 'drill'),
   'every pick is range work — never a measurement session or a review');
ok(!L.fitsClub(L.ALL.find(d => d.name === 'Divot-line drill'), 'd') && L.fitsClub(L.ALL.find(d => d.name === 'Divot-line drill'), '7i'),
   'fitsClub: a divot needs turf');

// Section B (dispersion tails) is premium-only. No fault reaches it any more —
// the pooled 'dispersion-wide' session rule was deleted (C2) and spread is
// raised per club by Dispersion — so its gate is checked directly.
const bGates = L.forSection('B', { shots: mk(40, { _ball: 'range' }), sessions: 1 }).filter(x => !x.offDevice);
ok(bGates.length > 0 && bGates.some(x => x.ok) &&
   bGates.filter(x => !x.ok).every(x => x.reasons.every(r => /qualifying sessions/.test(r))),
   'the tail section is open on range balls (v2): the only locks left are session counts, none about the ball');

// A start-line fault from an unaligned unit.
const unaligned2 = P.libraryDrill(fault('pull-left', []), mk(20, { _aligned: false }));
ok(unaligned2.libraryDrill === null && /alignment wasn't confirmed/.test(unaligned2.lockedNote),
   'under 30 unaligned shots, start-line work waits, and says what would open it');

ok(Object.keys(P.libraryDrill({ id: 'not-a-fault', drills: [] }, mk(20))).length === 0,
   'an unmapped fault falls back to the fault\'s own drill rather than guessing');

console.log('— and every plan carries the wrapper that decides whether it transfers —');
// This used to be keyed off a display setting in the app, which was the wrong
// variable entirely: how a golfer reads their data afterwards says nothing
// about how they ran the session. It is now the range default.
ok(P.wrapperFor().section === 'I', 'the default wrapper is a section-I one');
ok(P.wrapperFor().id === FE.DEFAULT_WRAPPER, 'and it is the faded session the research base names');
for (const id of ['i95','i96','i97','i98']) {
  ok(P.wrapperFor(id).id === id, `${id} can still be asked for by name`);
}
ok(P.wrapperFor('nonsense').id === FE.DEFAULT_WRAPPER, 'and an unknown one falls back rather than returning null');
ok(/matters more than/.test(P.wrapperFor().note), 'the wrapper outranks the drill choice');
ok(/rule for the mat/i.test(P.wrapperFor().note),
   'and it says it is a rule for the range, not for what this app displays');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
