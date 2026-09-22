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
  // There WAS an exemption here for `#fff` on a --red or --green fill,
  // justified by there being no token for it. The contrast fix gave it one:
  // --on-fill is the ink on any saturated fill and flips with the theme,
  // which is what those three rules actually needed — the hard-coded white
  // failed in dark mode at 2.32:1 the whole time. The exemption is gone
  // rather than kept as a courtesy: an allowance for a case that no longer
  // exists is the next literal's way back in.
  cssFound.push(`${cssCode.slice(0, at).split('\n').length}: ${m[0]}`);
}
ok(cssFound.length === 0,
   `every colour reads a token${cssFound.length ? ` — these do not: ${cssFound.slice(0, 12).join(', ')}${cssFound.length > 12 ? ` (+${cssFound.length - 12} more)` : ''}` : ''}`);

console.log('— and a token-paired fallback holds that token\'s value —');
// THE EXEMPTION ABOVE CHECKS A SHAPE, NOT A VALUE. `v('--green') || '#0E9463'`
// is allowed because it names its token, and for as long as that rule has
// existed nothing compared the literal to what --green actually holds. All
// five of chartTheme's fallbacks were still the pre-contrast-fix palette:
// correct shape, retired hues, and every chart would have drawn in them on
// any load where the stylesheet had not arrived. Same defect as the chevron
// one screen up — a copy of the palette that no check re-derived.
//
// Two kinds of fallback live in app.js and only one of them is a copy:
//
//   copy    — the stylesheet is expected, the literal is insurance, and it
//             must equal what the token holds in one of the two themes.
//   absent  — the stylesheet is NOT expected. showFatalError renders when
//             boot threw; it sets system-ui rather than --font-body for the
//             same reason. A neutral that never matches any token is right
//             there, so it is declared by name with its reason rather than
//             pattern-matched into silence.
const STYLESHEET_ABSENT = {
  'showFatalError': 'the recovery screen for a fatal boot error — it renders when the ' +
                    'stylesheet may be absent, so its fallbacks are a deliberate neutral ' +
                    'no-theme palette, not a copy of the app\'s',
};
// Which function a character offset sits in. NOT "the nearest preceding
// `function NAME(`" — the first version of this was exactly that, and it
// reported chartTheme's drift against `applyPaywall`, because chartTheme is
// an arrow const inside an IIFE module and the nearest top-level declaration
// above it belongs to something else entirely. A check that names the wrong
// function sends the next reader to the wrong file, which is the same cost
// as naming none. So: every named function, arrow or otherwise, gets its
// body brace-matched, and the INNERMOST range containing the offset wins.
const SCOPES = [];
for (const m of code.matchAll(/(?:^|[;{}\s])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g)) {
  const open = code.indexOf('{', m.index + m[0].length - 1);
  if (open < 0) continue;
  let i = open + 1, depth = 1;
  while (i < code.length && depth > 0) { if (code[i] === '{') depth++; else if (code[i] === '}') depth--; i++; }
  SCOPES.push({ name: m[1] || m[2], from: open, to: i });
}
const fnAt = at => {
  let best = null;
  for (const sc of SCOPES) {
    if (at < sc.from || at >= sc.to) continue;
    if (!best || (sc.to - sc.from) < (best.to - best.from)) best = sc;
  }
  return best ? best.name : '(top level)';
};
const lineAt = at => code.slice(0, at).split('\n').length;
// The two token blocks, brace-matched — the same walk the chevron pin below
// uses, hoisted so both read one definition of "what the palette declares".
const tokenBlock = sel => {
  const at = css.indexOf(sel + ' {');
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let i = open + 1, depth = 1;
  while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
  return css.slice(open + 1, i - 1);
};
const lightBlock = tokenBlock(':root'), darkBlock = tokenBlock('html.dark');
const tokenValues = t => [lightBlock, darkBlock]
  .map(blk => (new RegExp('\\' + t + '\\s*:\\s*(#[0-9a-fA-F]{3,8})').exec(blk) || [])[1])
  .filter(Boolean).map(h => h.toLowerCase());
const PAIRED = /(?:v\(\s*'(--[a-z0-9-]+)'\s*\)\s*\|\|\s*'(#[0-9a-fA-F]{3,8})'|var\(\s*(--[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\))/g;
const drifted = [];
const absentSeen = new Set();
let pairCount = 0;
for (const m of code.matchAll(PAIRED)) {
  const tok = m[1] || m[3], lit = (m[2] || m[4]).toLowerCase();
  pairCount++;
  const where = fnAt(m.index), line = lineAt(m.index);
  if (STYLESHEET_ABSENT[where]) { absentSeen.add(where); continue; }
  const vals = tokenValues(tok);
  // An expanded #fff has to compare equal to #ffffff, or the check reports a
  // drift that is only a spelling.
  const norm = h => (h.length === 4 ? '#' + h.slice(1).split('').map(c => c + c).join('') : h);
  if (!vals.length) { drifted.push(`${where} (app.js:${line}): ${tok} is not declared in either theme`); continue; }
  if (!vals.map(norm).includes(norm(lit))) {
    drifted.push(`${where} (app.js:${line}): ${tok} falls back to ${lit}, but holds ${vals.join(' / ')}`);
  }
}
ok(drifted.length === 0,
   `every token-paired fallback matches its token${drifted.length ? ` — these do not: ${drifted.join('; ')}` : ` (${pairCount} pairs)`}`);
// The count is asserted so the check cannot shrink to nothing unnoticed, and
// a declared exemption that no longer names a real call site is a stale one.
ok(pairCount >= 10, `and it found ${pairCount} pairs to check, not zero`);
for (const where of Object.keys(STYLESHEET_ABSENT)) {
  ok(absentSeen.has(where),
     `the "${where}" exemption still names a function that holds token-paired fallbacks`);
}

console.log('— and a percent-encoded colour is still a colour —');
// THE ENCODING IS THE HIDING PLACE. `stroke='%23E24E12'` inside a data-URI
// SVG is the accent, written as a literal, in a rule — and the sweep above
// never saw it, because the `#` it anchors on is spelled `%23`. One survived
// the entire "Range" redesign that way: the select chevron kept painting the
// RETIRED red-orange in both themes while every suite reported green, which
// is the same shape as the whole retired palette surviving inside style.css
// because the scan only read app.js. A guard that covers one spelling of the
// thing it bans is not a guard.
//
// A data-URI SVG cannot read a var() — it is a separate document — so the
// literal is unavoidable. What is avoidable is it living anywhere but a token
// declaration, and drifting from the token it is supposed to be.
const ENCODED = /%23([0-9a-fA-F]{3,8})\b/g;
const encFound = [];
for (const m of cssCode.matchAll(ENCODED)) {
  const at = m.index;
  if (inPrint(at)) continue;
  const ls = cssCode.lastIndexOf('\n', at) + 1;
  let le = cssCode.indexOf('\n', at); if (le < 0) le = cssCode.length;
  if (/^\s*--[a-z0-9-]+\s*:/i.test(cssCode.slice(ls, le))) continue;
  encFound.push(`${cssCode.slice(0, at).split('\n').length}: %23${m[1]}`);
}
ok(encFound.length === 0,
   `no percent-encoded colour outside a token declaration${encFound.length ? ` — these are: ${encFound.join(', ')}` : ''}`);

// The positive control. `0 found` and `the pattern stopped matching` print
// identically, and this repository has shipped the second as the first.
const encControl = [...'.x{background-image:url("%3Csvg stroke=\'%23ABCDEF\'/%3E")}'.matchAll(ENCODED)];
ok(encControl.length === 1 && encControl[0][1] === 'ABCDEF',
   'and the encoded-colour pattern finds one in a rule that holds one');

// --chevron is the only token whose value is a data URI, and the hex inside
// it is a SECOND copy of --accent that nothing else re-derives. Pinned per
// theme: the copy exists because a data URI cannot read a var(), not because
// it is allowed to disagree.
for (const [theme, sel] of [['light', ':root'], ['dark', 'html.dark']]) {
  const at = css.indexOf(sel + ' {');
  const open = css.indexOf('{', at);
  let i = open + 1, depth = 1;
  while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
  const blk = css.slice(open + 1, i - 1);
  const chev = /--chevron:[^;]*%23([0-9a-fA-F]{6})/.exec(blk);
  const acc = /--accent:\s*#([0-9a-fA-F]{6})/.exec(blk);
  ok(!!chev && !!acc && chev[1].toLowerCase() === acc[1].toLowerCase(),
     `${theme}: the chevron is drawn in --accent (#${(chev || [, '?'])[1]} vs #${(acc || [, '?'])[1]})`);
}

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
