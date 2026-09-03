const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');

// The module map is the first thing anyone starting cold reads, and it was
// wrong in BOTH directions: it named 17 modules that had been deleted in an
// earlier cleanup, and it omitted the ten that matter most — `Metrics`,
// `Conditions`, `FeedbackEngine`, `Rounds`, `ShortGame` among them. A map that
// sends you looking for `WeeklySummary` and never mentions `Metrics` is worse
// than no map, because it reads as surveyed.
//
// Same shape as `DrillLibrary.FAULT_SECTION`, and checked the same way: both
// directions, against the source.
const real = new Set([...src.matchAll(/^const ([A-Z][A-Za-z]*) = \(\(\) => \{/gm)].map(m => m[1]));
const section = doc.slice(doc.indexOf('### Core Modules (in app.js)'), doc.indexOf('### Key Data Shape'));
// Top-level helpers and constant tables are named in the same section but are
// not IIFE modules, so they are listed here rather than inferred.
const NOT_MODULES = new Set([
  'CLUB_ORDER','CLUB_COLORS','CLUB_LABELS','TARGET','CEILING','FAULT_SECTION',
  'bagConsistency','consistencyScore','facePath','spinLoft',
]);
const named = new Set([...section.matchAll(/`([A-Z][A-Za-z]+)`/g)].map(m => m[1])
  .filter(n => !NOT_MODULES.has(n)));

console.log('— the map names nothing that does not exist —');
const ghosts = [...named].filter(n => !real.has(n)).sort();
ok(ghosts.length === 0,
   `no module in CLAUDE.md is missing from app.js${ghosts.length ? ': ' + ghosts.join(', ') : ''}`);

console.log('— and omits nothing that does —');
const missing = [...real].filter(n => !named.has(n)).sort();
ok(missing.length === 0,
   `every module in app.js appears in the map${missing.length ? ': ' + missing.join(', ') : ''}`);

console.log('— the count in the map matches the count in the file —');
ok(real.size >= 50, `app.js defines ${real.size} IIFE modules`);
// Anchored on the two places that make the CLAIM, not on any sentence that
// happens to contain the word — the first version of this matched "17 modules
// that had been deleted" inside the note explaining the fix.
for (const m of doc.matchAll(/~?(\d+) (?:feature modules|modules listed in Core Modules|modules across measurement)/g)) {
  ok(Number(m[1]) === real.size,
     `the "${m[1]} modules" claim matches the real ${real.size}`);
}

console.log('— and the modules with their own CLAUDE.md section all exist —');
// A section header naming a module is a stronger claim than a list entry: it
// says "read this before touching it". `MIN_CLUB_SHOTS` was invented in one of
// these once and cost a load-gate failure to find.
const headers = [...doc.matchAll(/^#{3,4} .*?\(`([A-Za-z]+)(?:\.[A-Za-z]+)?`/gm)].map(m => m[1]);
const badHeaders = [...new Set(headers)].filter(h => !real.has(h) && !NOT_MODULES.has(h));
ok(badHeaders.length === 0,
   `every module with its own section exists${badHeaders.length ? ': ' + badHeaders.join(', ') : ''}`);

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
