// Colour in app.js comes from a token, not from a literal somebody typed.
//
// This exists because the first sweep missed a third of its targets. It
// grepped for `background:<literal>` with a character class that stops at a
// quote — so every colour hidden inside a ternary
// (`background:${x ? 'rgba(238,0,0,.06)' : ...}`) or inside an array of five
// pastels survived it, and those render in whatever palette they were typed
// for. A literal that renders in the OLD palette is not a style bug you
// notice: it is one block that looks slightly off on a screen full of blocks.
//
// So this scans for the literal ANYWHERE in the file and names every
// survivor with its reason.
const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

// Comments are stripped first. This repo has been bitten four times by a
// source scan reading its own explanation — including once by this very
// pass, whose fix comment quotes the literal it removed.
const code = src
  .replace(/\/\*[^]*?\*\//g, '')
  .split('\n')
  .map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
  .join('\n');

// The club scale is the one legitimate block of literals in app.js: an OKLCH
// sweep computed offline precisely so there is no runtime colour dependency.
const clubBlock = (code.match(/const CLUB_COLORS = \{[^}]*\}/) || [''])[0];

const ALLOWED = {
  // dev-only debug banner, never rendered for a user
  '#111': 'slDebug banner', '#0f0': 'slDebug banner', '#000': 'slDebug banner',
  // console.log("%c…") styles. Not the DOM — a var() does not resolve there.
  '#0070f3': 'console.log %c style', '#888888': 'console.log %c style',
  // clubColor's fallback for an unrecognised club. It has to be a literal:
  // the value is handed to a <canvas>, where a var() resolves to nothing.
  // It is --withheld's value, and colours-are-tokens pins that below.
  '#8b93a0': "clubColor fallback — --withheld, for a canvas that cannot read a var()",
};

// A literal that sits on the same line as a token is standing in FOR that
// token: `var(--bg, #fafafa)` or `getPropertyValue('--bg') || '#0B0D10'`.
// That is the correct shape for a value that must survive the stylesheet
// being absent, so it is allowed — the token is still the source of truth.
// The statement, not just the line: `v('--line') || '#E4E6EA'` names its
// token inline, while applyTheme's reads --bg on the line above its fallback.
const pairedWithToken = stmt => /--[a-z][a-z0-9-]*/.test(stmt);

const LITERAL = /rgba?\([0-9]+\s*,[0-9\s.,]+\)|#[0-9a-fA-F]{3,8}\b/g;
const found = [];
const codeLines = code.split('\n');
codeLines.forEach((ln, i) => {
  const prev = codeLines[i - 1] || '';
  for (const m of ln.matchAll(LITERAL)) {
    const lit = m[0];
    if (clubBlock.includes(lit)) continue;
    if (ALLOWED[lit.toLowerCase()] || ALLOWED[lit]) continue;
    if (pairedWithToken(prev + ' ' + ln)) continue;
    found.push(`${i + 1}: ${lit}`);
  }
});

console.log('— no colour literal in app.js outside the club scale —');
ok(found.length === 0,
   `every colour reads a token${found.length ? ` — these do not: ${found.slice(0, 12).join(', ')}${found.length > 12 ? ` (+${found.length - 12} more)` : ''}` : ''}`);

// The other half: the tokens those var() calls name have to exist. A
// var(--nosuch) is not an error — it computes to nothing and the property is
// dropped, which is a colour that silently does not apply.
console.log('— and every token it names is defined —');
// Not anchored to the start of a line. The spacing scale is declared as
// `--s1: 4px; --s2: 8px; ... --s7: 64px;` all on ONE line, so a `^\s*` anchor
// saw --s1 and none of the other six — and would have passed a var(--s5) that
// nobody had declared. app.js never reads those, which is the only reason the
// app.js half of this check was not already wrong.
const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
const used = new Set([...code.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]));
ok(used.size > 15, `${used.size} distinct tokens read from app.js`);
const undef = [...used].filter(t => !declared.has(t)).sort();
ok(undef.length === 0,
   `all defined in style.css${undef.length ? ` — these are not: ${undef.join(', ')}` : ''}`);

console.log('— and the one allowed stand-in still matches its token —');
// --withheld is declared twice, once per theme. clubColor's fallback goes to
// a <canvas>, which has no theme, so it has to be ONE of them and cannot be
// both — the dark value, which is the lighter grey and the one that stays
// legible on either ground.
const withheld = [...css.matchAll(/--withheld:\s*(#[0-9a-fA-F]{6})/g)].map(m => m[1].toLowerCase());
ok(withheld.includes('#8b93a0'),
   `clubColor's fallback is a declared --withheld value (${withheld.join(' / ') || 'none found'})`);

// ── The other file. ──────────────────────────────────────────────────────
//
// This pass only ever read app.js, and style.css is where the colour actually
// lives — so the entire retired palette survived the redesign inside the
// stylesheet while every suite reported green. Found by looking, not by a
// test: a 28px graph-paper background still tinted with the old red, the
// activity heatmap painted in three steps of it, two focus rings glowing it,
// a peach streak chip and a red-to-green achievements wash from the palette
// before that, and three dark surfaces typed as hexes beside a four-step
// ladder that already had the values.
//
// A guard that covers one of the two files colour can hide in is not a guard.

console.log('— and no colour literal in style.css outside the token blocks —');

// Comments first, for the fifth time in this repository: several of the fixes
// above quote the literal they removed, in the comment explaining why.
const cssCode = css.replace(/\/\*[^]*?\*\//g, '');

// @media print is ink on paper. #000, #fff and a #999 rule are the correct
// values there and a token would be the wrong answer — the whole point of
// those blocks is that they do NOT follow the theme. Ranges, not a literal
// allow-list, so the exemption cannot leak outside the block.
const printRanges = [];
for (const m of cssCode.matchAll(/@media\s+print[^{]*\{/g)) {
  let i = m.index + m[0].length, depth = 1;
  while (i < cssCode.length && depth > 0) {
    if (cssCode[i] === '{') depth++;
    else if (cssCode[i] === '}') depth--;
    i++;
  }
  printRanges.push([m.index, i]);
}
const inPrint = at => printRanges.some(([a, b]) => at >= a && at < b);

const cssFound = [];
for (const m of cssCode.matchAll(LITERAL)) {
  const at = m.index;
  if (inPrint(at)) continue;
  const lineStart = cssCode.lastIndexOf('\n', at) + 1;
  let lineEnd = cssCode.indexOf('\n', at); if (lineEnd < 0) lineEnd = cssCode.length;
  const line = cssCode.slice(lineStart, lineEnd);
  // A custom-property DECLARATION is where a literal belongs. That is the
  // whole design: :root and html.dark hold the values, everything else reads
  // them. `--hm1: rgba(226,78,18,.30);` is the token, not a violation of it.
  if (/^\s*--[a-z0-9-]+\s*:/i.test(line)) continue;
  // White on a --red or --green fill. There is no --on-red token and inventing
  // one for two rules would be a token nobody reads; the pairing is required
  // on the same line so it cannot drift onto an accent fill, which has
  // --accent-ink and is ~2x the contrast.
  if (/#fff\b/i.test(m[0]) && /var\(--(red|green)\)/.test(line)) continue;
  cssFound.push(`${cssCode.slice(0, at).split('\n').length}: ${m[0]}`);
}
ok(cssFound.length === 0,
   `every colour reads a token${cssFound.length ? ` — these do not: ${cssFound.slice(0, 12).join(', ')}${cssFound.length > 12 ? ` (+${cssFound.length - 12} more)` : ''}` : ''}`);

console.log('— and style.css names no token it has not defined —');
// var(--nosuch) is not an error: it computes to nothing and the declaration is
// dropped, so the colour silently does not apply. Only calls WITHOUT a
// fallback are checked — `var(--gap, var(--s2))` and `var(--col, 160px)` are
// contextual properties set by a utility class and are correct as they stand.
const cssUsed = new Set(
  [...cssCode.matchAll(/var\((--[a-z0-9-]+)\s*(,?)/g)].filter(m => !m[2]).map(m => m[1]));
const cssUndef = [...cssUsed].filter(t => !declared.has(t)).sort();
ok(cssUndef.length === 0,
   `${cssUsed.size} tokens read, all declared${cssUndef.length ? ` — these are not: ${cssUndef.join(', ')}` : ''}`);

console.log('— and the background grid stays gone —');
// It was three !important declarations spread over 600 lines of stylesheet,
// two of them overriding the first. Removing one and leaving another is how
// it would come back, so the control is the pattern, not a line number.
ok(!/linear-gradient\([^)]*\)\s*1px|1px,\s*transparent\s*1px/.test(cssCode),
   'no repeating 1px-line gradient is painted behind the app');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
