const M = require('../harness.js').load();
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const { LearningPath: LP, ContentLibrary: CL, DrillLibrary: DL, FaultEngine: FE, Store } = M;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');
const code = src.split(/\r?\n/).map(l => l.replace(/^\s*\/\/.*/, '')).join('\n');

// Both modules promised content that does not exist. `LearningPath` listed
// "⛳ Fundamentals — 6 lessons" and "🔄 The Swing — 8 lessons" with `locked`
// badges on modules that would never unlock, because there are no lessons
// anywhere in this app. `ContentLibrary` listed VIDEOS — "Fix Your Slice
// Forever, 12 min, video", "Lag & Release Secrets, 11 min" — with durations
// and levels, under a heading reading "Recommended Content". Nothing happened
// when you tapped one, by necessity.
console.log('— nothing fictional survives —');
ok(!/lessons:/.test(code), 'no lesson counts for lessons that do not exist');
ok(!/Fix Your Slice Forever|Lag & Release Secrets|Unlock Hidden Distance/.test(code),
   'no invented video titles');
ok(!/duration: '\d+ min'|type: 'video'/.test(code), 'and no durations or media types for them');
ok(!/Master grip, stance|Build a repeatable swing motion/.test(code), 'nor the fictional curriculum copy');

const shot = (o = {}) => ({ clubType: 'd', ballSpeed: 152, clubSpeed: 104, smashFactor: 1.46,
  launchAngle: 12, attackAngle: 2, clubPath: 0.5, sideCarry: 2, spinRate: 2400,
  carryDistance: 235, totalDistance: 258, ...o });
const sess = (id, conditions, n = 30) => Store.stamp({ id, date: '2026-08-01', conditions,
  shots: Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot() })) });
const prem = { ball: 'premium', surface: 'grass' };

console.log('— the path is the real library, gated —');
const p = LP.generatePath([sess('a', prem)]);
ok(p.modules.length === 8, `all eight drill sections appear (${p.modules.length})`);
ok(p.modules.every(m => DL.SECTIONS[m.id]), 'each is a real DrillLibrary section');
ok(p.modules.every(m => m.why && m.why.length > 40),
   'and each carries the evidence for itself — that IS the lesson, and it is already cited');
ok(p.modules.every(m => m.structure && m.structure.length > 10),
   'plus how the section is meant to be run');
ok(p.club === 'd', 'gated against the most-hit club');

console.log('— open sections lead, locked ones keep their reason —');
const opens = p.modules.filter(m => m.status === 'open');
const locks = p.modules.filter(m => m.status === 'locked');
ok(opens.length > 0, `${opens.length} sections are open on this data`);
ok(p.modules.slice(0, opens.length).every(m => m.status === 'open'),
   'every open one comes before every locked one — those are what you can do today');
ok(locks.every(m => m.lockedNote && m.lockedNote.length > 20),
   'and a locked section says WHY, rather than being hidden');
ok(/not a paywall|rather than a paywall/.test(p.note), 'the note makes clear a lock is a measurement, not a sale');

console.log('— section I is a wrapper, not a step —');
ok(p.wrappers && p.wrappers.id === 'I', 'it is returned separately');
ok(!p.modules.some(m => m.id === 'I'), 'and never appears in the sequence, because it wraps a drill');

console.log('— with nothing imported, only the off-device work is open —');
const empty = LP.generatePath([]);
ok(empty.club === null, 'no club to gate against');
const openEmpty = empty.modules.filter(m => m.status === 'open').map(m => m.id).sort();
// H is quiet eye and putting, which touches no launch-monitor data at all; G
// is speed development, which is gym work; A has one `noDevice` drill (face
// tape). Everything that needs a reading is locked. That is the same day-one
// answer `getNextStep` gives, arrived at independently through the gates.
ok(openEmpty.join(',') === 'A,G,H',
   `only the sections needing no device are open (${openEmpty.join(', ')})`);
ok(empty.modules.filter(m => ['B','C','D','E','F'].includes(m.id)).every(m => m.status === 'locked'),
   'every section that needs a measurement is locked');
ok(empty.modules.filter(m => m.status === 'locked').every(m => m.lockedNote),
   'each with its reason, so a new user can see what would open it');

console.log('— fault reading material resolves through the one mapping —');
// Every fault the engine can raise maps to a section; the old version keyed a
// parallel table on four topic names and fell back to "Consistency" for
// everything else, so a hook returned slice content.
const ids = Object.keys(DL.FAULT_SECTION);
ok(ids.length > 15, `${ids.length} faults are mapped`);
for (const id of ids.slice(0, 5)) {
  const c = CL.forFault(id);
  ok(c && c.why && DL.SECTIONS[c.section],
     `${id} resolves to section ${c && c.section} with its evidence`);
}
ok(CL.forFault('not-a-real-fault') === null,
   'an unmapped id returns nothing rather than a default topic');
ok(CL.getContentFor('not-a-real-fault').length === 0,
   'and the by-topic form does not fall back to "Consistency" either');

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
