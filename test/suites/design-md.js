// DESIGN.md has not drifted from style.css.
//
// The document states hex values, type sizes, spacing and component geometry
// that also live in the stylesheet — which makes it a second copy of the
// truth, and second copies rot here without anyone noticing. Benchmarks.TARGET
// once had twelve disagreeing copies. The privacy policy was wrong on every
// fact that mattered. CLAUDE.md claimed an og-image generator that did not
// exist anywhere in the repository, for months.
//
// So the front matter is GENERATED, and this suite re-runs the generator and
// fails if the committed file differs. Same arrangement as
// tools/build-legal-pages.js + legal-pages.js. Without it, the document is
// worse than nothing: it reads as surveyed.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const doc = path.join(root, 'DESIGN.md');
const tool = path.join(root, 'tools', 'build-design-md.js');

console.log('— the document and the generator exist —');
ok(fs.existsSync(doc), 'DESIGN.md is committed');
ok(fs.existsSync(tool), 'tools/build-design-md.js is committed');
const md = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8') : '';

console.log('— and the committed file matches a fresh generation —');
// The real tool, in a real process. A reimplementation of the generator inside
// the test would only prove the reimplementation agrees with itself.
const r = spawnSync(process.execPath, [tool, '--check'], { cwd: root, encoding: 'utf8' });
ok(r.status === 0,
   `regenerating changes nothing${r.status === 0 ? '' : ` — ${(r.stderr || '').trim().split('\n')[0]}\n        run: node tools/build-design-md.js`}`);

console.log('— the prose is fenced off from the generator —');
// The generator preserves everything between these and writes none of it. A
// tool that could rewrite prose would eventually rewrite a rule.
ok(md.includes('<!-- prose:start -->') && md.includes('<!-- prose:end -->'),
   'the prose markers are present');
const prose = md.slice(md.indexOf('<!-- prose:start -->'), md.indexOf('<!-- prose:end -->'));
ok(prose.length > 4000, `the prose is actually written (${prose.length} chars)`);

console.log('— and no value is typed into the prose that lives in a token —');
// The front matter may carry hex values; it is generated from them. The PROSE
// may not, because nothing regenerates it — a hex typed into a paragraph is
// exactly the copy that goes stale. Fenced code and the tables of file paths
// are not values.
const hexes = [...prose.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0]);
ok(hexes.length === 0,
   `the prose names no colour literal${hexes.length ? ` — found: ${[...new Set(hexes)].join(', ')}` : ''}`);

console.log('— the club scale is referenced, never copied —');
// Fourteen hex values in a second file is the drift this whole arrangement
// exists to prevent, and CLUB_COLORS is the most tempting table in the app.
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const clubBlock = (app.match(/const CLUB_COLORS = \{[^}]*\}/) || [''])[0];
const clubHexes = [...clubBlock.matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0].toLowerCase());
ok(clubHexes.length > 5, `CLUB_COLORS holds ${clubHexes.length} values in app.js`);
const copied = clubHexes.filter(h => md.toLowerCase().includes(h));
ok(copied.length === 0,
   `none of them is copied into DESIGN.md${copied.length ? ` — found ${copied.length}` : ''}`);
ok(/CLUB_COLORS in app\.js/.test(md), 'it is named by reference instead');

console.log('— every token the document names is still declared —');
// The inverse of the drift check: a token renamed in style.css leaves the
// document pointing at nothing, and a var() that resolves to nothing is a
// property that silently does not apply.
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
const named = new Set([...md.matchAll(/`(--[a-z0-9-]+)`|var\((--[a-z0-9-]+)\)/g)]
  .map(m => m[1] || m[2]));
const gone = [...named].filter(t => !declared.has(t)).sort();
ok(gone.length === 0,
   `${named.size} tokens named, all declared${gone.length ? ` — these are not: ${gone.join(', ')}` : ''}`);

console.log('— and it does not claim the app is something it is not —');
// An orientation document is the easiest place in a codebase to ship a
// fabricated constant: nothing downstream consumes the text, so a wrong figure
// never surfaces anywhere else. These are the three fabrications this repo has
// actually shipped — a fake community average, "6 lessons" with locked badges,
// twelve videos with runtimes — named so they cannot come back.
//
// The first version of this check banned the WORDS, and failed on the
// paragraph warning against them. That is the same trap a source scan falls
// into when it reads its own explanatory comment, and this repo has hit it six
// times. The fix is to anchor on the CLAIM, not the vocabulary: these patterns
// are the shapes the fabrications actually took on a screen. A document that
// says "there is no video content" must stay sayable.
for (const [claim, why] of [
  [/\b(our|the|your) community\b/i, 'there is no community — sessions are per user behind row-level security'],
  [/\bcommunity (average|benchmark|data|insight)/i, 'nothing aggregates sessions across users'],
  [/\b\d+\s+lessons?\b/i, 'there are no lessons to count'],
  [/\b\d+\s+videos?\b/i, 'there is no video content'],
  [/\b\d+:\d{2}\b/, 'no runtime — nothing here has a duration'],
  [/\bwatch (the|this|our|a) \w+/i, 'there is nothing to watch'],
]) ok(!claim.test(prose), why);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
