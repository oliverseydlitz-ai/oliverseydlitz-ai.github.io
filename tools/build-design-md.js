#!/usr/bin/env node
// Generates the front matter of DESIGN.md from style.css.
//
// WHY IT IS GENERATED. A design document that restates hex values, sizes and
// spacing that also live in the stylesheet is a second copy of the truth, and
// second copies rot here without anyone noticing: Benchmarks.TARGET once had
// twelve disagreeing copies, the privacy policy was wrong on every fact that
// mattered, and CLAUDE.md claimed an og-image generator that did not exist.
// So every number below is read out of style.css, and test/suites/design-md.js
// fails if the committed file and a fresh generation disagree. Same
// arrangement as tools/build-legal-pages.js + legal-pages.js.
//
// The PROSE is hand-written and preserved verbatim between markers. The tool
// never writes prose and never reads meaning out of CSS — it cannot know why a
// token exists, only what it is.
//
//   node tools/build-design-md.js          # rewrite DESIGN.md in place
//   node tools/build-design-md.js --check  # exit 1 if it would change anything
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const CSS = path.join(root, 'style.css');
const OUT = path.join(root, 'DESIGN.md');
const START = '<!-- prose:start -->';
const END = '<!-- prose:end -->';

const css = fs.readFileSync(CSS, 'utf8');
// Comments out, always first. Several token declarations carry an explanation
// that itself contains a colon and a value.
const bare = css.replace(/\/\*[^]*?\*\//g, '');

const block = sel => {
  const i = bare.indexOf(sel + ' {');
  if (i < 0) throw new Error(`no ${sel} block in style.css`);
  return bare.slice(i, bare.indexOf('\n}', i));
};
// Not anchored to line start: the spacing scale is declared as
// `--s1: 4px; --s2: 8px; ... --s7: 64px;` all on ONE line.
const tokens = sel => {
  const out = {};
  for (const m of block(sel).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi))
    out[m[1]] = m[2].trim();
  return out;
};
const LIGHT = tokens(':root');
const DARK = tokens('html.dark');

// A hex says what a colour IS; it cannot say what it is FOR. The role is the
// only thing in this file that is authored rather than read, and it is kept
// here — one line per token — rather than in the markdown, so a token added to
// style.css without a role shows up as a build failure instead of as a silent
// gap in the document.
const ROLE = {
  '--bg': 'page ground. The canvas is flat — there is no decorative background',
  '--surface': 'a card or panel, one step up from the ground',
  '--surface2': 'a block inside a card; the second rung of the ladder',
  '--surface3': 'the third rung — an inset, a hover ground, an idle heatmap cell',
  '--line': 'the card-defining element. A 1px hairline, NEVER a shadow',
  '--line-strong': 'a hairline that has to win against a busy surface',
  '--text': 'primary text',
  '--text-muted': 'secondary text, captions, units',
  '--text-dim': 'the lowest-emphasis text the palette allows',
  '--accent': 'signal orange. The ONE accent. Never a surface fill, never decorative',
  '--accent-ink': 'text and icons on an accent fill (~2x the contrast of white)',
  '--accent-weak': 'focus ring and the faintest accent wash',
  '--forest': 'accent hover / pressed',
  '--hm1': 'activity heatmap, step 1 of 3 (level 0 is --surface3: no shots that day)',
  '--hm2': 'activity heatmap, step 2 of 3',
  '--hm3': 'activity heatmap, step 3 of 3 (level 4 is --accent at full strength)',
  '--green': 'a real gain. A verdict, not a mood',
  '--green-light': 'a lower grade band',
  '--green-glow': 'the status dot\'s expanding ring',
  '--withheld': 'gated / no answer. Intentionally dull — the app withholds often',
  '--yellow': 'caution, a tentative fault',
  '--red': 'a real loss, a regression, a destructive control',
  '--blue': 'information, a "modelled" tag, a secondary link',
  '--overlay': 'modal scrim',
};
// Aliases resolve to another token. They exist because app.js reads the old
// names inline in six runtime-injected modals, and constraint C1 freezes them.
const ALIAS = { '--border': '--line', '--border-hi': '--line-strong',
                '--pine': '--accent', '--turf': '--red', '--accent-glow': '--accent-weak' };

const isColour = v => /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/i.test(v);

let fm = [];
const push = (...l) => fm.push(...l);

push('---',
  'version: 1',
  'name: ShotLab-TOUR',
  'source: generated from style.css by tools/build-design-md.js — do not hand-edit',
  'description: |',
  '  A measurement instrument, not a dashboard. Near-monochrome graphite chrome,',
  '  one signal-orange accent, zero border radius, 1px hairlines instead of',
  '  shadows, and a flat canvas with no decoration on it at all. Saturated colour',
  '  is reserved for data: the club scale, the verdict semantics, the activity',
  '  ramp. The protagonist of every screen is the measured figure.',
  '');

push('colors:');
for (const [k, v] of Object.entries(LIGHT)) {
  if (!isColour(v) || ALIAS[k]) continue;
  const d = DARK[k];
  push(`  ${k.slice(2)}:`);
  push(`    light: "${v}"`);
  push(`    dark: "${d || v + '   # inherited — no dark override'}"`);
  if (ROLE[k]) push(`    role: ${ROLE[k]}`);
}
push('  aliases:');
for (const [k, t] of Object.entries(ALIAS))
  push(`    ${k.slice(2)}: "var(${t})"   # frozen name, read inline by app.js`);
// Never copied. It is an OKLCH sweep generated in app.js, and fourteen hex
// values in a second file is exactly the drift this tool exists to prevent.
push('  club-scale:',
  '    source: CLUB_COLORS in app.js',
  '    construction: even OKLCH sweep, fixed L and C, hue 45deg to 345deg',
  '    rule: do not hand-pick these. Fixed lightness and chroma is the point —',
  '      it is the one categorical scale in the app and no club may read as louder',
  '      than another.',
  '');

// The type scale, read off the real rules rather than the token list: a font
// size lives in a selector, not in :root.
// @media blocks are lifted out before the base pass. This is a MOBILE-FIRST
// system — 393px is the design viewport, not a width to degrade to — so the
// base value is the phone value, and a `min-width` override is a step-up that
// gets reported as one. Reading them together and taking the last declaration
// would have documented `.view-title` as 2rem, which is only ever true on a
// desktop, and silently dropped the 1.7rem every phone actually renders.
const MEDIA = [];
{
  const re = /@media([^{]*)\{/g; let m;
  while ((m = re.exec(bare))) {
    let i = m.index + m[0].length, depth = 1;
    while (i < bare.length && depth > 0) {
      if (bare[i] === '{') depth++; else if (bare[i] === '}') depth--;
      i++;
    }
    MEDIA.push({ q: m[1].trim(), body: bare.slice(m.index + m[0].length, i - 1), a: m.index, b: i });
    re.lastIndex = i;
  }
}
let baseCss = bare;
for (const b of [...MEDIA].reverse()) baseCss = baseCss.slice(0, b.a) + baseCss.slice(b.b);

// EVERY matching rule, concatenated in source order — not the first one.
// `.view-title` is declared twice, 1,400 lines apart: `{ flex: 1 }` up in the
// layout section and the whole type treatment down in the editorial one. A
// reader of the first would document a rule the browser never applies, which
// is the same defect as `.session-card` being redeclared 1,900 lines below
// itself with a different shadow. The cascade is what ships, so the cascade is
// what gets written down.
const rule = (sel, src) => {
  const re = new RegExp(`(^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'gm');
  return [...(src === undefined ? baseCss : src).matchAll(re)].map(m => m[2]).join(';\n');
};
// What a min-width query changes about a selector, so a step-up is reported as
// a step-up rather than replacing the value a phone renders.
const stepUps = (sel, props) => {
  const out = [];
  for (const b of MEDIA) {
    if (!/min-width/.test(b.q)) continue;
    const body = rule(sel, b.body);
    if (!body) continue;
    const changed = props.map(p => [p, prop(body, p)]).filter(([, v]) => v);
    if (changed.length) out.push([b.q, changed]);
  }
  return out;
};
// The LAST declaration wins, for the same reason.
const prop = (body, p) => {
  const all = [...body.matchAll(new RegExp(`(?:^|;)\\s*${p}\\s*:\\s*([^;]+)`, 'g'))];
  return all.length ? all[all.length - 1][1].trim().replace(/\s*!important/, '') : null;
};
const TYPE = [
  ['display', '.stat-hero, .score-number', 'the measured figure — the billboard'],
  ['h1', 'h1', 'view name'],
  ['view-title', '.view-title', 'view name as rendered (condenses on scroll, phone)'],
  ['h2', 'h2', 'section heading'],
  ['h3', 'h3', 'sub-heading'],
  ['section-title', '.section-title', 'the heading on a section block'],
  ['kicker', '.kicker', 'a small upper-case label above a heading or a number'],
  ['body', 'body', 'everything else'],
];
push('typography:');
push('  families:');
for (const k of ['--font-display', '--font-body', '--font-mono'])
  push(`    ${k.slice(7)}: ${LIGHT[k]}`);
push('    note: self-hosted in fonts/. The site makes ZERO third-party requests on',
  '      load — a deliberate EU-law position, not a performance tweak. Do not add a',
  '      CDN tag; test/browser/sync.sh fails if one appears.');
push('  scale:');
for (const [name, sel, use] of TYPE) {
  const body = rule(sel);
  if (!body) continue;
  push(`    ${name}:`);
  push(`      selector: "${sel}"`);
  const tp = ['font-size', 'font-weight', 'line-height', 'letter-spacing',
              'text-transform', 'font-family'];
  for (const p of tp) {
    const v = prop(body, p);
    if (v) push(`      ${p}: "${v}"`);
  }
  for (const [q, changed] of stepUps(sel, tp)) {
    push(`      at "${q}":`);
    for (const [p, v] of changed) push(`        ${p}: "${v}"`);
  }
  push(`      use: ${use}`);
}
push('');

push('spacing:');
for (let i = 1; i <= 7; i++) if (LIGHT[`--s${i}`]) push(`  s${i}: ${LIGHT[`--s${i}`]}`);
push(`  note: the base unit is ${LIGHT['--s1'] || '4px'}. Section rhythm is --s6.`);
push('');

push('geometry:');
for (const k of ['--radius', '--radius-md', '--radius-sm'])
  if (LIGHT[k] !== undefined) push(`  ${k.slice(2)}: "${LIGHT[k]}"`);
push(`  cut: "${LIGHT['--cut']}"   # NOT a radius. The chamfer on .btn-*, cut by clip-path`,
  '  rule: zero radius is the dominant geometry. A rounded button reads as consumer',
  '    software; the cut corner is the one shape this app owns.');
push(`  nav-h: ${LIGHT['--nav-h']}`,
  `  bottom-nav-h: ${LIGHT['--bottom-nav-h']}`,
  `  tap: ${LIGHT['--tap']}   # minimum touch target`);
push('');

push('elevation:');
push(`  sm: "${LIGHT['--shadow-sm']}"   # literally none. Chrome is FLAT`);
push(`  md: "${LIGHT['--shadow-md']}"`);
push(`  lg: "${LIGHT['--shadow-lg']}"`);
push('  rule: shadows exist for overlays only. Hierarchy on screen is carried by the',
  '    four-step surface ladder and a 1px hairline, never by a lift.');
push('');

push('motion:');
push(`  dur: ${LIGHT['--dur']}`);
push('  rule: animate FROM a visible resting state, never TO one. Nothing may rest at',
  '    opacity 0, visibility hidden, or translated off its own box before JS runs.',
  '    See ScrollMotion in app.js and test/suites/scroll-motion.js.');
push('');

// Components, read from their real declarations so a padding change here
// cannot be reported from memory.
const COMPONENTS = [
  ['button', ':where(.btn-primary, .btn-secondary, .btn-danger, .btn-ghost)'],
  ['card', '.card'],
  ['section-block', '.section-block'],
  ['top-nav', '.top-nav'],
];
push('components:');
for (const [name, sel] of COMPONENTS) {
  const body = rule(sel);
  if (!body) continue;
  push(`  ${name}:`);
  push(`    selector: "${sel}"`);
  for (const p of ['background', 'border', 'border-radius', 'padding', 'min-height',
                   'height', 'box-shadow', 'text-transform', 'letter-spacing', 'clip-path']) {
    const v = prop(body, p);
    if (v) push(`    ${p}: "${v}"`);
  }
}
push('');

// ── The three claims the prose used to state, and got wrong ──────────────
//
// This document said `.stat-hero` was "under-used" when it had zero referents
// and Task 2 had already wired it; named `.tnum` as the mechanism for tabular
// numerals when nothing in any file applies it; and counted "two" legal colour
// literals in style.css when there are three. Every one was a hand-typed count
// of something the tree can answer, which is the same defect as the twelve
// copies of `Benchmarks.TARGET` — and it is invisible, because nothing
// downstream consumes a sentence.
//
// They are MEASURED here, not corrected and re-typed. A re-run cannot carry a
// stale number forward, and the prose now has an authority to be checked
// against rather than a second opinion. Same discipline as `--cut` being read
// out of the cascade instead of described from memory.
//
// (The prose itself is hand-written and this tool never touches it. If a
// paragraph still disagrees with the block below, the paragraph is wrong —
// which is exactly what was true of all three until the ship task.)
// NOTHING IN THE BLOCK BELOW CITES A LINE NUMBER. The first version did — it
// printed `app.js:8286, app.js:9000` and `style.css:220, 2142, 2143` — and a
// line number in a committed document is a claim about a tree state that stops
// being true the next time anything above it is edited. This repository's rule
// is that a number which can drift will; a line number is the purest case of
// one, because appending a single rule to style.css invalidates every citation
// into it without changing a single fact the citation was about.
//
// Every anchor below is a NAME: a function, a selector, a class. Names move
// with the thing they name, so the count and the anchor stay true together.
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
// Comments out, newlines kept — `rules-are-wired.js` strips comments this way
// so that a note recording what a fix removed cannot be read as the thing
// itself.
const appCode = appSrc
  .replace(/\/\*[^]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
// The nearest enclosing top-level `function name(` above a match. A function is
// a stable address for a call site in a way a line number is not.
const enclosingFns = (text, needle) => {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const out = [];
  for (const m of text.matchAll(re)) {
    const f = [...text.slice(0, m.index)
      .matchAll(/\n\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].pop();
    if (f) out.push(f[1] + '()');
  }
  return [...new Set(out)];
};

// 1. How many referents the display tier has. Zero is the number that matters:
//    a display tier nothing applies is a rule that does nothing, which is how
//    this class survived a complete redesign.
const heroFns = enclosingFns(appCode, 'stat-hero');
const heroCount = (appCode.match(/stat-hero/g) || []).length;

// Every rule, as {selector, from, to} over `bare`, so a fact can be attached to
// the SELECTOR that holds it rather than to a line.
//
// Walked rule by rule rather than with one regex over the file: a
// `[^{}]*\{[^{}]*tabular-nums[^{}]*\}` match swallows a whole run of preceding
// selectors as soon as one body is multi-line, which is how the first version
// of this reported thirty-four selectors for a single declaration.
const RULES = [];
{
  let start = 0;
  for (let i = 0; i < bare.length; i++) {
    if (bare[i] === '{') {
      const sel = bare.slice(start, i).trim().replace(/\s+/g, ' ');
      let d = 1, j = i + 1;
      while (j < bare.length && d > 0) {
        if (bare[j] === '{') d++; else if (bare[j] === '}') d--;
        j++;
      }
      if (!sel.startsWith('@')) RULES.push({ sel, from: i + 1, to: j - 1 });
      i = j - 1; start = j;
    } else if (bare[i] === '}') start = i + 1;
  }
}

// 2. What actually carries tabular numerals, read from the cascade. The
//    document named `.tnum` first; nothing applies it, and the declaration is
//    held by the table elements. Both halves are reported, because "the class
//    exists" and "the class is doing the work" are different claims.
const numeralRules = RULES
  .filter(r => /font-variant-numeric:\s*tabular-nums/.test(bare.slice(r.from, r.to)))
  .map(r => r.sel);
const numeralElements = new Set();
const numeralClasses = new Set();
for (const sel of numeralRules)
  for (const part of sel.split(',')) {
    const t = part.trim();
    if (!t) continue;
    for (const m of t.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) numeralClasses.add(m[1]);
    if (/^[a-z]+$/i.test(t)) numeralElements.add(t);
  }
// A class that declares it and is applied by nothing is a utility, not the
// mechanism. Searched for as a name across both markup sources — this is the
// cheap version of what test/suites/class-is-wired.js does properly, and it is
// only asked of a handful of names.
const markupText = ['index.html', 'app.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const numeralUnapplied = [...numeralClasses].filter(c => !markupText.includes(c)).sort();

// 3. The legal colour literals in style.css, counted with the SAME same-line
//    pattern test/suites/colours-are-tokens.js exempts — a `#fff` on a rule
//    that also names `var(--red)` or `var(--green)` on its own line. Inventing
//    an `--on-red` token for three rules would be a token nobody reads; the
//    count is the thing that was wrong, not the arrangement.
const LITERAL = /rgba?\([0-9]+\s*,[0-9\s.,]+\)|#[0-9a-fA-F]{3,8}\b/g;
const printRanges = [];
for (const m of bare.matchAll(/@media\s+print[^{]*\{/g)) {
  let i = m.index + m[0].length, depth = 1;
  while (i < bare.length && depth > 0) {
    if (bare[i] === '{') depth++; else if (bare[i] === '}') depth--;
    i++;
  }
  printRanges.push([m.index, i]);
}
const legalLiterals = new Set();
for (const m of bare.matchAll(LITERAL)) {
  if (printRanges.some(([a, b]) => m.index >= a && m.index < b)) continue;
  const ls = bare.lastIndexOf('\n', m.index) + 1;
  let le = bare.indexOf('\n', m.index); if (le < 0) le = bare.length;
  const line = bare.slice(ls, le);
  if (/^\s*--[a-z0-9-]+\s*:/i.test(line)) continue;                       // a token declaration
  if (/#fff\b/i.test(m[0]) && /var\(--(red|green)\)/.test(line)) {
    // The SELECTOR the literal sits in, not the line it sits on.
    const rule = RULES.find(r => m.index >= r.from && m.index < r.to);
    legalLiterals.add(rule ? rule.sel : '(top level)');
  }
}
const literalSels = [...legalLiterals].sort();

push('claims:');
push('  note: three counts this document states, measured from the tree rather than',
  '    typed. Each was wrong here once; each is re-derived on every run so it cannot',
  '    be wrong again. The prose is hand-written and may still disagree — if it does,',
  '    it is the prose that is out of date.',
  '    Every anchor below is a NAME — a function, a selector, a class — and never a',
  '    line number. A point in a file names nothing once anything above it is edited,',
  '    and this file is regenerated on a tree that keeps moving.');
push('  display-tier:');
push(`    selector: ".stat-hero, .score-number"`);
push(`    applied-by-app-js: ${heroCount}`);
push(`    applied-in: "${heroFns.join(', ') || 'nothing'}"`);
push(`    rule: a display tier with no referent is a rule that does nothing. 0 is a defect.`);
push('  tabular-numerals:');
push(`    carried-by: "${[...numeralElements].sort().join(', ')}"   # element selectors: app-wide`);
push(`    also-declared-on: ${numeralRules.length - numeralElements.size} class rules`);
push(`    declared-but-applied-nowhere: "${numeralUnapplied.map(c => '.' + c).join(', ') || 'none'}"`);
push(`    rule: "${[...numeralElements].sort().join(', ')}" is what holds the declaration on every table in the`,
  `      app; ${numeralUnapplied.map(c => '`.' + c + '`').join(', ') || 'the named class'} is an available utility that nothing applies. Listing it first`,
  '      as the mechanism describes something that never runs.');
push('  colour-literals:');
push(`    count: ${literalSels.length}`);
push(`    on: "${literalSels.join('  ·  ')}"`);
push(`    rule: "#fff on a --red or --green fill, declared on the same line.`,
  '      test/suites/colours-are-tokens.js exempts exactly this pattern, so the',
  '      enforcement is right and only the count was wrong."');

// A count of zero would mean the scan stopped matching rather than that the
// stylesheet changed, and a claim block that quietly reports 0 is worse than no
// claim block at all. The same reflex as render-scan.js's exit code.
if (literalSels.length === 0 || numeralRules.length === 0) {
  console.error('\nclaims: the scan found nothing to measure — ' +
    `${literalSels.length} legal colour literals, ${numeralRules.length} tabular-numerals rules. ` +
    'That is the detector failing, not the stylesheet, and a claim block that quietly ' +
    'reports 0 is worse than no claim block at all.');
  process.exit(1);
}
push('---');

const frontMatter = fm.join('\n');

const STUB = `${START}

## Overview

_(prose not yet written — author it here; the generator preserves everything
between the prose markers and will never overwrite it.)_

${END}`;

let prose = STUB;
if (fs.existsSync(OUT)) {
  const cur = fs.readFileSync(OUT, 'utf8');
  const a = cur.indexOf(START), b = cur.indexOf(END);
  if (a < 0 || b < 0)
    throw new Error(`DESIGN.md has no ${START} / ${END} markers — refusing to overwrite prose`);
  prose = cur.slice(a, b + END.length);
}

const next = frontMatter + '\n\n' + prose + '\n';

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur === next) { console.log('DESIGN.md is current'); process.exit(0); }
  const a = cur.split('\n'), b = next.split('\n');
  const i = a.findIndex((l, n) => l !== b[n]);
  console.error(`DESIGN.md is stale at line ${i + 1}:\n  committed: ${a[i]}\n  generated: ${b[i]}`);
  process.exit(1);
}
fs.writeFileSync(OUT, next);
console.log(`DESIGN.md written (${next.split('\n').length} lines, ${Object.keys(LIGHT).length} tokens read)`);

// Every token that carries a colour needs a role. A token added to style.css
// without one is a gap in the document that nothing else would report.
const missing = Object.keys(LIGHT)
  .filter(k => isColour(LIGHT[k]) && !ALIAS[k] && !ROLE[k]);
if (missing.length) {
  console.error(`\nthese colour tokens have no role in ROLE{}: ${missing.join(', ')}`);
  process.exit(1);
}
