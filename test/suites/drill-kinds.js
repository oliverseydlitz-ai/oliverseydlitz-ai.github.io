const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { DrillLibrary: DL } = R.app;
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app.js'), 'utf8');

// The library was one flat list of 104 things called drills, and a quarter of
// them were not drills. Eight were instructions to read a screen this app
// already renders. Six were gym sessions. Two were equipment checks. Nine were
// measurement sessions where nothing is trained. Listed together with "hit ten
// shots through a gate", the real drills were buried in the noise.

console.log('— every entry declares what it is —');
ok(DL.ALL.length === 104, `all 104 still here (${DL.ALL.length}) — nothing was deleted`);
ok(DL.ALL.every(d => DL.KINDS[d.kind]), 'every entry has a kind the table knows');
ok(DL.ALL.every(d => DL.kindOf(d) === d.kind), 'kindOf agrees with the field');
ok(DL.kindOf(null) === 'drill' && DL.kindOf({}) === 'drill',
   'and an unlabelled entry reads as a drill — the default is the common case, not a hidden category');

console.log('— a "trend review" is not a drill —');
// "Trend across five or more sessions with a band" is the Progress tab. An
// entry telling a golfer to do by hand what the app computes is the same
// defect as LearningPath's fake lessons: content that duplicates what exists.
const reviews = DL.ALL.filter(d => d.kind === 'review');
ok(reviews.length === 8, `the eight screen-reads are typed as reviews (${reviews.length})`);
for (const id of ['a18','b32','c42','d52','e64','f76','g85','i104']) {
  ok(reviews.some(d => d.id === id), `  ${id} is a review, not a drill`);
}
ok(/this app computes it for you/i.test(DL.KINDS.review.blurb),
   'and the label says the app does it, so nobody runs one by hand');

console.log('— a med-ball throw is not range work —');
const fit = DL.ALL.filter(d => d.kind === 'fitness');
ok(fit.length === 6, `six gym entries (${fit.length})`);
for (const id of ['g78','g79','g80','g81','g83','g86']) {
  ok(fit.some(d => d.id === id), `  ${id} is off-course work`);
}
ok(/not something you do in a bay/i.test(DL.KINDS.fitness.blurb), 'and the label says so plainly');

console.log('— a baseline trains nothing, and says so —');
const meas = DL.ALL.filter(d => d.kind === 'measure');
ok(meas.length === 9, `nine measurement sessions (${meas.length})`);
ok(meas.some(d => d.id === 'a1') && meas.some(d => d.id === 'b19'),
   'the smash baseline and the tail audit are measurements');
ok(/Expect no\s+improvement/i.test(DL.KINDS.measure.blurb),
   'and the label sets that expectation rather than letting a golfer feel it failed');

console.log('— equipment is not technique —');
ok(DL.ALL.filter(d => d.kind === 'equipment').length === 2, 'two equipment checks');
ok(DL.byId('f73').kind === 'equipment', 'the groove check is one of them');

console.log('— what is left is actually drills —');
const drills = DL.ALL.filter(d => d.kind === 'drill');
ok(drills.length === 79, `79 real drills (${drills.length})`);
ok(drills.every(d => !/trend (review|block)|trend across/i.test(d.name + ' ' + d.desc)),
   'and not one of them is a trend review wearing a drill label');

console.log('— the counts still add up —');
const total = Object.keys(DL.KINDS).reduce((a, k) => a + DL.ALL.filter(d => d.kind === k).length, 0);
ok(total === DL.ALL.length, `every entry lands in exactly one group (${total}/${DL.ALL.length})`);
ok(Object.values(DL.SECTIONS).reduce((a, s) => a + s.count, 0) === DL.ALL.length,
   'and the section counts still match the list');

console.log('— the render groups them, drills first —');
const ui = src.slice(src.indexOf('function renderDrills'), src.indexOf('// ── Short game'));
ok(/const ORDER = \['drill', 'measure', 'equipment', 'fitness', 'review'\]/.test(ui),
   'range work comes first — it is what someone opening this screen came for');
ok(/DrillLibrary\.kindOf\(r\.drill\)/.test(ui), 'grouping reads the kind rather than guessing from the name');
ok(/k === 'drill' \? '' :/.test(ui),
   'the drills need no heading — they are what the section is; everything else gets one because it is not');
ok(/KINDS\[k\]\.blurb|meta\.blurb/.test(ui), 'and each group renders its explanation');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
