// Every font a screen renders in comes from a family this site actually ships.
//
// Written because the grade badge — the single largest glyph on the session
// detail — rendered in the browser's default sans for the whole life of the
// "Range" redesign. Two inline SVGs set font-family="Outfit,sans-serif" on
// their <text> node. Outfit is the typeface the redesign REPLACED: nothing
// loads it, and `font-src 'self'` would refuse it if a tag remained. So both
// fell through to the generic, beside headings set in Archivo Expanded.
//
// It was invisible to every check this repo had. colours-are-tokens scans
// colours. no-emoji scans characters. render-scan greps for NaN and measures
// width, and a fallback font is neither wrong text nor wrong width. The load
// gate loads the file, and a font-family attribute on an SVG text node throws
// nothing. Nobody reading the badge would necessarily know what it was
// supposed to look like — which is the whole difficulty with this class of
// defect and the reason it needs a test rather than an eye.
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// Comments first. This repository has been bitten five times by a source scan
// reading its own explanation, and the comment above names the dead family.
const code = src
  .replace(/\/\*[^]*?\*\//g, '')
  .split('\n')
  .map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
  .join('\n');
const cssCode = css.replace(/\/\*[^]*?\*\//g, '');

// What the site actually ships, read from the @font-face blocks rather than
// typed here — a list of font names in a test is a second copy of the truth.
const SHIPPED = new Set(
  [...cssCode.matchAll(/@font-face\s*\{[^}]*?font-family:\s*['"]?([^;'"]+)['"]?\s*;/g)]
    .map(m => m[1].trim().toLowerCase()));

// Generic keywords resolve to whatever the device has and are always legal.
// system-ui in particular is the CORRECT answer in showFatalError, which runs
// when the stylesheet may never have loaded and must not depend on a webfont.
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
  'inherit', 'initial', 'unset', 'currentcolor', '-apple-system',
  'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'helvetica',
  'arial', 'sf mono', 'roboto mono', 'menlo', 'monaco', 'consolas']);

console.log('— app.js names no typeface this site does not ship —');
const stray = [];
// Both shapes: the SVG presentation attribute and a CSS declaration inside a
// template literal. The bug was in the first, which is the easier to miss.
for (const m of code.matchAll(/font-family\s*[:=]\s*["']?([^"';}>]+)/g)) {
  const line = code.slice(0, m.index).split('\n').length;
  for (const raw of m[1].split(',')) {
    const fam = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
    if (!fam) continue;
    if (fam.startsWith('var(--')) continue;      // a token: the right answer
    if (GENERIC.has(fam)) continue;
    if (SHIPPED.has(fam)) continue;
    stray.push(`${line}: ${raw.trim()}`);
  }
}
ok(stray.length === 0,
   `every family is a token, a generic, or an @font-face${stray.length ? ` — these are not: ${stray.join(', ')}` : ''}`);

console.log('— and the retired typeface is gone from every file —');
// The negative control. If this ever passes while a reference exists, the
// check above is worthless — a family list that has quietly stopped matching
// reports clean on a file full of dead names.
const retired = ['Outfit', 'DM Serif', 'JetBrains Mono'];
const hits = [];
for (const [name, text] of [['app.js', code], ['index.html', html], ['style.css', cssCode]])
  for (const f of retired) if (text.includes(f)) hits.push(`${f} in ${name}`);
ok(hits.length === 0, `no retired family is referenced${hits.length ? ` — found: ${hits.join(', ')}` : ''}`);

console.log('— and every typeface the site ships is actually used —');
// The other direction. A webfont in fonts/ that nothing references is dead
// weight downloaded by a PWA that promises to work offline.
const unused = [...SHIPPED].filter(f => {
  const uses = [...cssCode.matchAll(new RegExp(`font-family:[^;{}]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'))];
  const tokens = [...cssCode.matchAll(new RegExp(`--font-[a-z]+:[^;]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'))];
  return uses.length + tokens.length === 0;
});
ok(unused.length === 0,
   `${SHIPPED.size} shipped families, all referenced${unused.length ? ` — these are not: ${unused.join(', ')}` : ''}`);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
