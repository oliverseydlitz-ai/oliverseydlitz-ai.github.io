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
const declared = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gmi)].map(m => m[1]));
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

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
