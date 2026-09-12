// ── The measured contrast floor ─────────────────────────────────────────
//
// A palette fix without a floor is the same defect one commit later. This
// repo has shipped a rule that existed and did nothing at least twice:
// `.stat-hero` was written as the display tier and referenced by nothing,
// and `.session-badge` carried a retired red through the whole redesign
// while every suite reported green. An independent WCAG audit measured 138
// token pairs and found real failures. This suite is that audit as a gate,
// so the next one cannot arrive quietly.
//
// THE NEGATIVE CONTROL IS THE POINT. This suite is expected to FAIL on the
// stylesheet as it stands — the token fix is a separate task behind it. A
// guard that has never caught anything has not been tested, and the run that
// first proves it catches something is the only evidence it works.
//
// Three things it deliberately does not do:
//
// 1. IT DOES NOT HARD-CODE A HEX. Not one colour value appears below. Every
//    value is parsed out of style.css's two token blocks and resolved through
//    the var() aliases. A suite that restates the palette tests its own
//    transcription, not the stylesheet, and the restatement rots: the target
//    bands once had twelve disagreeing copies, and this repository claimed an
//    og-image generator for months while neither it nor its template existed.
//    If you are about to type a hex below, that is the bug.
//
// 2. IT DOES NOT AUDIT THE CARTESIAN PRODUCT. `--accent-ink` is a near-black
//    ink for an accent FILL. Measured against the dark page ground it computes
//    1.00 and would fail forever on a pair that never occurs — and a suite
//    red for a reason nobody can act on is a suite people re-run instead of
//    read. So a text colour is paired with the ground declared beside it, or
//    — only when it declares none — with the surface ladder. Which one it
//    gets is derived from the two files, not chosen by hand.
//
// 3. IT DOES NOT SKIP WHAT IT CANNOT RESOLVE. An unresolvable value is
//    printed as UNKNOWN and counted as a failure. An UNKNOWN read as a pass
//    is how a check stops covering the thing it names while still reporting
//    green — the failure mode `render-scan.js` was in for most of a session.
//
// Comments are stripped before either file is scanned. Five times now a
// source scan in this repository has matched its own explanation — the
// `+3° ideal` check, the module count, the "When to show your numbers"
// string, the fabrication check that banned the words it was warning
// against, and the colours sweep whose fix comment quoted the literal it
// removed. A `var(--text-dim)` inside the paragraph explaining why
// `--text-dim` fails is not a use.
const fs = require('fs');
const path = require('path');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');

// Comments out, LINE COUNTS KEPT. A block comment collapsed to nothing would
// shift every line number reported below, and a report that names the wrong
// line is worse than one that names none.
const stripComments = s => s
  .replace(/\/\*[^]*?\*\//g, m => m.split('\n').map((_, i) => (i ? '\n' : ' ')).join(''));
// The `//` sweep carries the same `[^:'"\`\\]` guard colours-are-tokens.js
// uses — without it a `https://` inside a string is a comment.
const css = stripComments(fs.readFileSync(path.join(root, 'style.css'), 'utf8'));
const js = stripComments(fs.readFileSync(path.join(root, 'app.js'), 'utf8'))
  .split('\n').map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
const jsLines = js.split('\n');
const lineOf = at => js.slice(0, at).split('\n').length;

// ── @media print is ink on paper, and deliberately not themed ────────────
// #000 on #fff is the correct answer there and a token would be the wrong
// one. Exempt by brace-matched RANGE, the same way colours-are-tokens.js does
// it, so the exemption cannot leak onto a rule outside the block. What is
// exempted is counted and printed, never silently dropped.
const printRanges = [];
for (const m of css.matchAll(/@media\s+print[^{]*\{/g)) {
  let i = m.index + m[0].length, depth = 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  printRanges.push([m.index, i]);
}
const inPrint = at => printRanges.some(([a, b]) => at >= a && at < b);

// ── The token blocks ─────────────────────────────────────────────────────
function declarationBlock(text, needle, from) {
  const at = text.indexOf(needle, from || 0);
  if (at < 0) return null;
  const open = text.indexOf('{', at);
  let i = open + 1, depth = 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }
  return text.slice(open + 1, i - 1);
}
function tokenMap(text) {
  const out = {};
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const lightTokens = tokenMap(declarationBlock(css, ':root'));
// html.dark is `html` plus a class: its declarations override :root's, and
// every name it does NOT redeclare keeps the :root value. `--accent-ink` is
// exactly that case — it is not in the dark block, so dark inherits the light
// one, which is why a pair that reads "light value, dark value" is wrong.
const darkTokens = Object.assign({}, lightTokens, tokenMap(declarationBlock(css, 'html.dark')));
const THEMES = [['light', lightTokens], ['dark', darkTokens]];

// ── The resolver ─────────────────────────────────────────────────────────
// Returns { hex, name } for an opaque sRGB colour, { noGround: true } for a
// value that paints nothing, or { unknown } with the reason. `name` is the
// canonical token: an alias resolves to what it aliases, so --pine reports as
// --accent and cannot be counted twice for one defect.
const PAINTS_NOTHING = /^(none|transparent)$/i;
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// A canonical name is a token (`--red`) or a literal (`#fff`); only the token
// form is read back through var().
const asValue = name => (name.startsWith('--') ? 'var(' + name + ')' : name);

function resolve(value, theme) {
  const v = String(value).replace(/\s*!important\s*$/i, '').trim();
  if (PAINTS_NOTHING.test(v)) return { noGround: true };

  const hex = HEX.exec(v);
  if (hex) return { hex: expand(v), name: v.toLowerCase() };

  // var() first. A generic "it looks like a function call" branch placed
  // ahead of this one swallows every var() in the sheet and reports the whole
  // palette as unresolvable — which reads exactly like a palette full of
  // failures, and is why the order here is load-bearing.
  const call = /^var\(\s*(--[a-z0-9-]+)\s*(?:,([^]*))?\)$/.exec(v);
  if (call) {
    const seen = new Set();
    let name = call[1];
    while (true) {
      if (seen.has(name)) return { unknown: name + ' is a var() cycle' };
      seen.add(name);
      const decl = theme[name];
      if (decl === undefined) {
        // A custom property set at RUNTIME by a utility class (`--mc`, `--col`)
        // is not a token, and its fallback is not what paints once the class
        // applies. Resolving to the fallback would be inventing the ground.
        return call[2] !== undefined
          ? { unknown: name + ' is set at runtime, so its fallback is not what paints: ' + v }
          : { unknown: name + ' is read as a colour but declared in neither token block' };
      }
      const inner = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(decl);
      if (inner) { name = inner[1]; continue; }
      const r = resolve(decl, theme);
      return r.hex ? { hex: r.hex, name }
                   : { unknown: name + ' resolves to "' + decl + '" — ' + (r.unknown || 'no colour') };
    }
  }

  const fn = /^([a-z-]+)\(/i.exec(v);
  if (fn) {
    const f = fn[1].toLowerCase();
    if (f === 'color-mix') return { unknown: 'color-mix() has no single ratio — it resolves against what it is mixed over: ' + v };
    if (f !== 'rgb' && f !== 'rgba') return { unknown: 'not a colour this suite can resolve: ' + v };
    const parts = v.slice(fn[0].length, -1).split(/[\s,/]+/).filter(Boolean);
    if (parts.length > 3 && parseFloat(parts[3]) < 1) {
      return { unknown: 'translucent — the ratio depends on the ground behind it: ' + v };
    }
    return { hex: rgbHex(parts), name: v.toLowerCase() };
  }
  return { unknown: 'not a colour form this suite can resolve: ' + v };
}
// A translucent background has no single ratio — the ratio depends on what it
// is washed over. Declining to answer (an UNKNOWN) would be a permanent red
// nobody can act on, and `--accent-weak` is a real ground with real text on
// it, so instead it is COMPOSITED over each ladder rung: that is the set of
// things it can sit on, and each composite is a pair with a number.
function translucent(value, theme) {
  const v = String(value).trim();
  const seen = new Set();
  let decl = v, name = v;
  for (;;) {
    const call = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(decl);
    if (!call) break;
    if (seen.has(call[1]) || theme[call[1]] === undefined) return null;
    seen.add(call[1]);
    name = call[1];
    decl = theme[name];
  }
  const rgba = /^rgba?\(([^)]*)\)$/i.exec(decl);
  const eight = /^#([0-9a-fA-F]{8})$/.exec(decl);
  if (rgba) {
    const p = rgba[1].split(/[\s,/]+/).filter(Boolean);
    if (p.length > 3 && parseFloat(p[3]) < 1) {
      return { rgb: p.slice(0, 3).map(Number), a: parseFloat(p[3]), name };
    }
    return null;
  }
  if (eight) {
    const s = eight[1];
    const a = parseInt(s.slice(6, 8), 16) / 255;
    if (a < 1) return { rgb: [0, 2, 4].map(i => parseInt(s.substr(i, 2), 16)), a, name };
    return null;
  }
  // `color-mix(in srgb, C 8%, transparent)` is C at 8% alpha, exactly — the
  // `in srgb` with a transparent partner reduces to straight alpha. That is
  // resolvable, so it is resolved rather than reported: `.sync-warn` paints
  // its banner with it and text sits on it. The GENERAL color-mix — two opaque
  // colours — is still refused, because that one has no single ratio.
  const mix = /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i.exec(decl);
  if (mix) {
    const inner = resolve(mix[1].trim(), theme);
    const a = parseFloat(mix[2]) / 100;
    // Named by what it is made of, not by its declaration: a pair printed as
    // `--accent on color-mix(--accent 8%)` says the same thing as the raw
    // formula and fits on a line.
    const tok = (mix[1].match(/--[a-z0-9-]+/) || [mix[1]])[0];
    if (inner.hex && a < 1) return { rgb: channels(inner.hex), a, name: 'color-mix(' + tok + ' ' + mix[2] + '%)' };
  }
  return null;
}
// src over base, straight alpha, in sRGB — which is what `in srgb` means and
// what the browser does for an rgba() background on an opaque parent.
function over(src, a, base) {
  const b = [1, 3, 5].map(i => parseInt(base.slice(i, i + 2), 16));
  return '#' + src.map((c, i) => Math.round(a * c + (1 - a) * b[i]).toString(16).padStart(2, '0')).join('');
}
const channels = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function expand(h) {
  const b = h.replace('#', '');
  const full = b.length === 3 ? b.split('').map(c => c + c).join('') : b;
  return '#' + full.toLowerCase();
}
function rgbHex(parts) {
  return '#' + parts.slice(0, 3).map(p => {
    const n = Math.max(0, Math.min(255, Math.round(parseFloat(p))));
    return n.toString(16).padStart(2, '0');
  }).join('');
}
function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  const [r, g, b] = c.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── The ground set ───────────────────────────────────────────────────────
// The surface ladder: the four surfaces the app paints behind content. `--bg`
// is the page; the three `--surface*` rungs are the card, section, table-head
// and control grounds. Text that declares no ground of its own sits on one of
// these, so these are the four it has to clear.
//
// The NAMES are stated — nothing in the sheet says "these four are the
// ladder" — but every one is validated against the sheet below, so a rename
// fails here loudly instead of quietly shrinking the check to nothing.
const LADDER = ['--bg', '--surface', '--surface2', '--surface3'];

// ── Derive the text-colour vocabulary, from both files ───────────────────
// A text position is a `color:` declaration. The leading `[;{\s]` is what
// keeps `background-color`, `border-left-color` and `-webkit-text-fill-color`
// out: the character before `color` there is a hyphen, not a separator.
// The capture is `[^;]+` and NOT `[^;}]+`. Both the rule bodies below and the
// quoted span below are already brace-free, and a `}` inside a template
// interpolation is not the end of a declaration — stopping there truncates
// `color:${g.color}` to `color:${g.color`, which the resolver then reports as
// an unresolvable colour that does not exist in either file.
const CSS_COLOUR = /(^|[;{\s])color\s*:\s*([^;]+)/;
const BG_COLOUR = /(^|[;{\s])(?:background|background-color)\s*:\s*([^;]+)/;
// `opacity: .82` fades the ink toward whatever is behind it. The leading
// separator is what keeps `transition: opacity …` out.
const OPACITY = /(^|[;{\s])opacity\s*:\s*([\d.]+)/;
const splitSel = s => s.split(',').map(x => x.trim()).filter(Boolean);
const VAR_IN = /var\(\s*--[a-z0-9-]+(?:\s*,[^)]*)?\)/g;

// Text colours app.js reaches INDIRECTLY — a `${expr}` whose value is chosen
// at runtime from a set this scan cannot see. Each names the tokens it can
// resolve to, and two guards below hold that honest: the expression must
// still exist in app.js (or the entry is stale), and every token it names
// must be measured on the ladder (or a colour has arrived here that nothing
// else in the sheet uses as text — which is a new colour, not an exemption).
const INDIRECT = [
  { expr: '${g.color}',                   who: 'gradeColor() — the A–F grade', to: ['--green', '--green-light', '--yellow', '--red'] },
  { expr: '${stats.color}',               who: 'the form grade, same gradeColor() set', to: ['--green', '--green-light', '--yellow', '--red'] },
  { expr: '${ShotScorer.scoreColor(sc)}', who: 'ShotScorer.scoreColor()', to: ['--green', '--yellow', '--red'] },
  { expr: '${col}',                       who: 'the launch-window band', to: ['--text', '--green-light', '--yellow'] },
  { expr: '${consC}',                     who: 'the consistency coefficient of variation', to: ['--green', '--yellow', '--red'] },
];

// A raw declaration value becomes one or more colour values. A ternary that
// picks between two tokens — `${x ? 'var(--a)' : 'var(--b)'}`, or the same
// written imperatively as `el.style.color = on ? 'var(--a)' : 'var(--b)'` —
// contributes ALL of them, which is the honest reading: the pair is real
// whichever branch runs, and only one of them needs to be below the floor.
function siteValues(raw) {
  const v = String(raw).trim();
  const vars = v.match(VAR_IN) || [];
  // Hexes are scanned OUTSIDE the var() calls. `var(--text,#171717)` carries
  // a fallback that is not a colour the app ever paints — it only applies if
  // the stylesheet is missing — and reading it as one invents a pair against
  // a value nothing renders.
  const outside = v.replace(VAR_IN, ' ');
  const hexes = (outside.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter(h => HEX.test(h));
  if (vars.length || hexes.length) return vars.concat(hexes);
  const named = INDIRECT.find(i => v.includes(i.expr));
  return named ? named.to.map(t => 'var(' + t + ')') : [v];
}

const sites = [];               // { where, fg, ground|null }
const usedAsBackground = new Set();

// style.css — rule by rule, so a background declared BESIDE a colour is proof
// the two co-occur on one element.
let droppedToPrint = 0;
const ruleColour = new Map();   // selector -> the colour it declares
const groundOnly = [];          // a rule that repaints the ground and inherits the ink
const pseudoBg = new Map();     // 'SEL::before' -> what it paints
const pseudoBody = new Map();   // 'SEL::before' -> its declarations
const groundByPart = new Map(); // a single selector -> the ground it paints, comma-parts split
const ruleList = [];            // every rule in the sheet, for the ancestor pass below
{
  let pos = 0;
  for (const chunk of css.split('}')) {
    const start = pos;
    pos += chunk.length + 1;
    const open = chunk.lastIndexOf('{');
    if (open < 0) continue;
    const body = chunk.slice(open + 1);
    const head = chunk.slice(0, open);
    const sel = head.slice(Math.max(head.lastIndexOf('{'), head.lastIndexOf('}')) + 1).trim() || '(rule)';
    for (const m of body.matchAll(new RegExp(BG_COLOUR.source, 'g'))) {
      for (const t of m[2].matchAll(/var\((--[a-z0-9-]+)/g)) usedAsBackground.add(t[1]);
    }
    const fg = CSS_COLOUR.exec(body);
    if (inPrint(start + open + 1)) { if (fg) droppedToPrint++; continue; }
    const bg = BG_COLOUR.exec(body);
    const op = OPACITY.exec(body);
    if (/::(before|after)\s*$/.test(sel)) {
      pseudoBody.set(sel, body);
      if (bg) pseudoBg.set(sel, bg[2]);
    }
    ruleList.push({ sel, fg: fg ? fg[2] : null, bg: bg ? bg[2] : null, opacity: op ? parseFloat(op[2]) : null });
    if (bg && !resolve(bg[2], lightTokens).noGround) {
      // Real grounds only: `background: none` is a pass-through, so a child
      // under it still sees whatever the NEXT ancestor paints.
      for (const part of splitSel(sel)) groundByPart.set(part, bg[2]);
    }
    if (fg) ruleColour.set(sel, fg[2]);
    else if (bg) groundOnly.push({ sel, bg: bg[2] });
  }
}

// ── The INHERITED ground ─────────────────────────────────────────────────
// `.band--signal { background: var(--text) }` and then
// `.band--signal .drill-title { color: var(--bg) }`. The child declares no
// ground because it INHERITS one, and a per-rule scan that cannot see the
// ancestor falls back to the ladder — where `--bg` measures 1.00 against
// itself and 1.03 against `--surface`, eight pairs that can never render and
// that no palette can ever satisfy. A ground token used as ink is always ink
// for a specific inverted fill; the ladder is not its business.
//
// So the ground is resolved from the longest ancestor selector that declares
// one, which is what the browser does — an inner card that paints its own
// surface shadows the band behind it, and the longest match is the nearest.
// This is the same defect as the `.sync-warn` wash: a descendant override in
// a per-rule scan.
function inheritedGround(part) {
  let best = null;
  for (const [anc, bg] of groundByPart) {
    if (anc === part) continue;
    // Two ways a rule can be inside another, and BOTH are needed:
    //  · the descendant selector — `.band--signal .drill-title`
    //  · the block-element name — `.sync-warn-head` is an element OF
    //    `.sync-warn`, so it sits inside it in the DOM even though its
    //    selector never mentions it. The hyphen is required, which is what
    //    keeps `.band--signal-x` from matching `.band--sign`.
    const descends = part.startsWith(anc) && /[\s>+~]/.test(part.charAt(anc.length));
    const blockChild = part.startsWith(anc + '-');
    if (!descends && !blockChild) continue;
    if (!best || anc.length > best.anc.length) best = { anc, bg };
  }
  return best;
}
for (const rule of ruleList) {
  for (const part of splitSel(rule.sel)) {
    if (rule.fg) {
      const own = rule.bg && !resolve(rule.bg, lightTokens).noGround ? rule.bg : null;
      const inh = own ? null : inheritedGround(part);
      const ground = own || (inh ? inh.bg : null);
      const via = inh ? '  ←  inherits ' + inh.bg + ' from ' + inh.anc : '';
      // `opacity: .82` fades the ink toward its ground, so the measured ratio
      // is not the declared one. Only modelled when the rule paints no ground
      // of its own — with one, the opacity fades the background too and the
      // arithmetic is a different question, which is stated rather than
      // guessed at.
      const alpha = own || rule.opacity === null || rule.opacity >= 1 ? null : rule.opacity;
      for (const value of siteValues(rule.fg)) {
        sites.push({ where: 'style.css  ' + part + via, fg: value, ground, alpha });
      }
    }
  }
}

// ── The state variant that only repaints the ground ──────────────────────
// `.btn-primary { background: var(--accent); color: var(--accent-ink) }` and
// then `.btn-primary:hover { background: var(--forest) }`. The hover rule
// declares no colour because it INHERITS one, and a same-rule scan is blind to
// that — which is exactly how `--accent-ink` on `--forest` shipped at 3.72:1,
// one of the three failures the audit found. A variant is matched to its base
// by stripping a trailing state; only the state pseudos and the two state
// classes are stripped, never an attribute selector, so a specificity trick
// cannot invent a pair that no element ever renders.
const STATE = /(?:::(?!before|after)[a-z-]+|:(?:hover|focus|focus-visible|active|checked|disabled|placeholder-shown)|\.(?:active|on))$/;
// A `::before` with `inset: 1.5px` COVERS its element: it is the surface the
// text actually lands on, not the element's own background. `.btn-secondary`
// paints its hover ground --accent and then covers all but a 1.5px hairline of
// it with --surface, so `--text` on that accent is a failure no text ever
// touches — a red nobody can act on, which is worse than no red at all.
const covers = p => {
  let s = p;
  for (let hop = 0; hop < 3; hop++) {
    const body = pseudoBody.get(s);
    if (body && /\binset\s*:/.test(body)) return true;
    const next = s.replace(/:[a-z-]+(?=::)/g, '');
    if (next === s) return false;
    s = next;
  }
  return false;
};
for (const { sel, bg } of groundOnly) {
  let base = sel;
  for (let hop = 0; hop < 2 && STATE.test(base); hop++) {
    base = base.replace(STATE, '').trim();
    if (!base) break;
    if (!ruleColour.has(base)) continue;
    let ground = bg, via = '';
    for (const pseudo of ['::before', '::after']) {
      const p = sel + pseudo;
      if (pseudoBg.has(p) && covers(p)) { ground = pseudoBg.get(p); via = '  (covered by ' + pseudo + ')'; break; }
    }
    for (const value of siteValues(ruleColour.get(base))) {
      sites.push({ where: 'style.css  ' + sel + via + '  ←  inherits ' + base + "'s text colour", fg: value, ground });
    }
    break;
  }
}

// ── Colour literals in a text position ───────────────────────────────────
// `#fff` on a --red or --green fill is a real pair and is measured — it is
// what the badge and the danger button paint, and it fails in dark.
//
// A literal in a CONSOLE format string or the dev-only debug banner is not
// the DOM at all: a var() does not resolve in a `console.log('%c…')` style,
// and the banner never renders for a user. colours-are-tokens.js exempts the
// same two, for the same reason. The exemption is anchored on the CONTEXT,
// not on the hex — exempt it by value and the next literal typed into a real
// inline style inherits the exemption.
const bannerRanges = [];
for (const m of js.matchAll(/debugBanner/g)) {
  const f = js.lastIndexOf('function ', m.index);
  if (f < 0) continue;
  let i = js.indexOf('{', f), depth = 1;
  i++;
  while (i < js.length && depth > 0) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') depth--;
    i++;
  }
  bannerRanges.push([f, i]);
}
const inDebugBanner = at => bannerRanges.some(([a, b]) => at >= a && at < b);

const exempt = [];
{
  let at = 0;
  for (const line of jsLines) {
    const start = at;
    at += line.length + 1;
    const m = /(^|[;{\s'"])color\s*:\s*(#[0-9a-fA-F]{3,8})/.exec(line);
    if (!m) continue;
    if (line.includes('console.log') || inDebugBanner(start + m.index)) {
      exempt.push({ at: lineOf(start) + 0, hex: m[2] });
      continue;
    }
    sites.push({ where: 'app.js:' + lineOf(start) + '  literal', fg: m[2], ground: null });
  }
}
// The reason has to be TRUE of the site, not merely attached to it: an
// exemption that claims "console" for a line that is not one is how this list
// would rot into a blanket skip.
ok(exempt.every(e => jsLines[e.at - 1].includes('console.log') || inDebugBanner(js.indexOf(jsLines[e.at - 1]))),
   `${exempt.length} colour literal(s) exempted as not-the-DOM, each verified against its marker`);

// app.js — the inline `style="…"` spans, which is where every runtime-injected
// modal, table cell and badge puts its colour. One span is one element, so a
// background in the same span is the same kind of proof the CSS half gets.
for (const span of js.matchAll(/style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/g)) {
  const body = span[1] !== undefined ? span[1] : span[2];
  const fg = CSS_COLOUR.exec(body);
  if (!fg) continue;
  const bg = BG_COLOUR.exec(body);
  for (const t of body.matchAll(/var\((--[a-z0-9-]+)/g)) usedAsBackground.add(t[1]);
  for (const value of siteValues(fg[2])) {
    sites.push({ where: 'app.js:' + lineOf(span.index) + '  style="…"', fg: value, ground: bg ? bg[2] : null });
  }
}
// `el.style.color = …` is the same declaration written imperatively.
for (const m of js.matchAll(/\.style\.color\s*=\s*([^;]+);/g)) {
  for (const value of siteValues(m[1])) {
    sites.push({ where: 'app.js:' + lineOf(m.index) + '  .style.color', fg: value, ground: null });
  }
}

// ── Classify ─────────────────────────────────────────────────────────────
// A colour with even ONE text position that declares no ground is a ladder
// colour: it can land on any card. A colour whose every position carries its
// own opaque fill is a fill colour and is measured only against that fill.
const fillPairs = new Map();     // 'fg on ground' -> { fg, ground, where }
const ladderColours = new Map(); // canonical token -> the raw value first seen
const fillOnly = new Map();
const unknown = [];

const byColour = new Map();
for (const s of sites) {
  const key = resolve(s.fg, lightTokens);
  const keyName = key.hex ? key.hex : s.fg;
  if (!byColour.has(keyName)) byColour.set(keyName, { raw: s.fg, list: [] });
  byColour.get(keyName).list.push(s);
}

for (const [, { raw, list }] of byColour) {
  const onLadder = list.some(s => {
    if (s.ground === null) return true;
    return resolve(s.ground, lightTokens).noGround === true;
  });
  const canon = resolve(raw, lightTokens);
  const name = canon.hex ? canon.name : raw;
  for (const s of list) {
    if (s.ground === null) continue;
    const g = resolve(s.ground, lightTokens);
    if (g.noGround === true) continue;
    if (!g.hex) {
      // A wash, not an opaque fill: measured once per ladder rung it can be
      // washed over. Anything else it cannot be resolved against at all.
      const t = translucent(s.ground, lightTokens);
      if (!t) {
        const k = s.fg + ' on ' + s.ground;
        if (!unknown.some(u => u.pair === k)) unknown.push({ pair: k, reason: g.unknown, where: s.where });
        continue;
      }
      for (const rung of LADDER) {
        const k = name + ' on ' + t.name + ' over ' + rung;
        // The blend is theme-specific — the rung it washes over differs — so
        // the wash and its base are stored and composited in the assert loop.
        if (!fillPairs.has(k)) {
          fillPairs.set(k, { fg: name, wash: t, rung, name: t.name + ' over ' + rung, where: s.where, alpha: s.alpha });
        }
      }
      continue;
    }
    // A ladder colour on a ladder rung is the ladder pair, already asserted
    // four lines up. Re-asserting it here would double every `--text-dim`
    // failure in the output and make the list harder to act on, which is the
    // whole reason a fill pair is a separate category in the first place. A
    // faded ink is NOT that pair — `opacity: .82` measures differently — so
    // it keeps its own line rather than being deduped into the plain one.
    // `== null`, not `=== null`: only the CSS pass records an opacity, so
    // every app.js site arrives without the key at all. `undefined !== null`
    // silently switched this dedupe off for both app.js and the state-variant
    // pass, and re-printed two ladder failures under a second heading.
    if (onLadder && LADDER.includes(g.name) && s.alpha == null) continue;
    const k = name + ' on ' + g.name + (s.alpha == null ? '' : ' @ ' + s.alpha);
    if (!fillPairs.has(k)) {
      fillPairs.set(k, { fg: name, ground: s.ground, name: g.name, where: s.where, alpha: s.alpha });
    }
  }
  if (onLadder) ladderColours.set(name, raw);
  else fillOnly.set(name, raw);
}

// ── Assertions ───────────────────────────────────────────────────────────
console.log('— the vocabulary, derived from style.css and app.js —');
const ladderNames = [...ladderColours.keys()].sort();
console.log(`          text colours: ${ladderNames.join(' ')}`);
console.log(`          fill-only:    ${[...fillOnly.keys()].join(' ') || '(none)'}  (every text position carries its own ground, so the ladder is not their business)`);
console.log(`          grounds:      ${LADDER.join(' ')}`);
ok(ladderNames.length >= 8,
   `${ladderNames.length} text colours derived — a palette that shrinks to nothing must not pass quietly`);
ok(LADDER.every(t => usedAsBackground.has(t)),
   `all ${LADDER.length} ladder rungs are used as a background in the sheet — a rename would otherwise empty this check`);
ok(INDIRECT.every(i => js.includes(i.expr)),
   `${INDIRECT.length} indirect text colour(s) resolved — each expression still exists in app.js`);
ok(INDIRECT.every(i => i.to.every(t => ladderColours.has(t))),
   'and every token they can resolve to is measured on the ladder above — a colour reachable only through an interpolation would otherwise never be measured');

// Requirement 4, demonstrated rather than asserted. The UNKNOWN path is the
// one that never fires on a healthy stylesheet, so it has to be proved
// reachable or it is a branch nobody has ever run — the same reason
// rules-are-wired.js keeps its dead negative control.
console.log('— and the resolver refuses what it cannot resolve —');
for (const value of [
  'rgba(0,0,0,.6)',
  'color-mix(in srgb, var(--surface) 88%, transparent)',
  'var(--nosuch-at-all)',
  'var(--mc, var(--line-strong))',
  'linear-gradient(90deg,#000,#fff)',
]) {
  const r = resolve(value, lightTokens);
  ok(!r.hex, `UNKNOWN, not a pass: ${value}  ←  ${r.unknown || 'it resolved anyway'}`);
}
// And the boundary of what IS resolvable, so teaching the wash form above
// cannot quietly turn every color-mix in the sheet into a confident number.
ok(translucent('color-mix(in srgb, var(--accent) 8%, transparent)', lightTokens) !== null,
   'a mix against transparent IS resolvable — it is that colour at that alpha, and `.sync-warn` paints one');
ok(translucent('color-mix(in srgb, var(--accent) 30%, var(--green))', lightTokens) === null,
   'a mix of two opaque colours is NOT — it has no single ratio, and guessing one would be inventing the ground');

const pad = n => n.toFixed(2).padStart(5);
// Every pair, both themes, each with the floor it is held to. The floors:
// 4.5:1 for text under WCAG 1.4.3 — and it is 4.5 for ALL of it, because
// every `--text-dim` label in this app is 0.62–0.9rem, so nothing here
// qualifies for the 3:1 large-text allowance, and claiming it would be the
// flattering reading. 3:1 for the focus ring under 1.4.11, which is a UI
// component and not text at all.
const TEXT_FLOOR = 4.5, UI_FLOOR = 3;

for (const [themeName, theme] of THEMES) {
  const grounds = LADDER.map(t => {
    const g = resolve('var(' + t + ')', theme);
    return { token: t, hex: g.hex, unknown: g.unknown };
  });

  console.log(`— ${themeName}: text on the surface ladder (floor ${TEXT_FLOOR}:1) —`);
  for (const token of ladderNames) {
    const f = resolve('var(' + token + ')', theme);
    if (!f.hex) { unknown.push({ pair: token + ' (itself)', reason: f.unknown, where: 'vocabulary' }); continue; }
    for (const g of grounds) {
      if (!g.hex) { unknown.push({ pair: token + ' on ' + g.token, reason: g.unknown, where: 'ladder' }); continue; }
      const r = ratio(f.hex, g.hex);
      ok(r >= TEXT_FLOOR, `${token} on ${g.token}  ${pad(r)}  (needs ${TEXT_FLOOR})`);
    }
  }

  console.log(`— ${themeName}: the focus ring (floor ${UI_FLOOR}:1, WCAG 1.4.11) —`);
  const accent = resolve('var(--accent)', theme);
  for (const g of grounds) {
    if (!accent.hex || !g.hex) { unknown.push({ pair: 'focus ring on ' + g.token, reason: accent.unknown || g.unknown, where: 'ladder' }); continue; }
    const r = ratio(accent.hex, g.hex);
    ok(r >= UI_FLOOR, `--accent focus ring on ${g.token}  ${pad(r)}  (needs ${UI_FLOOR})`);
  }

  console.log(`— ${themeName}: text on a fill it declares itself (floor ${TEXT_FLOOR}:1) —`);
  for (const p of fillPairs.values()) {
    const f = resolve(asValue(p.fg), theme);
    let groundHex = null, why = null;
    if (p.wash) {
      const base = resolve(asValue(p.rung), theme);
      if (base.hex) groundHex = over(p.wash.rgb, p.wash.a, base.hex);
      else why = base.unknown;
    } else {
      const g = resolve(p.ground, theme);
      groundHex = g.hex;
      why = g.unknown;
    }
    if (!f.hex || !groundHex) {
      const k = p.fg + ' on ' + p.name;
      if (!unknown.some(u => u.pair === k)) unknown.push({ pair: k, reason: f.unknown || why, where: p.where });
      continue;
    }
    // `opacity: .82` is real: it blends the ink toward the ground, so the
    // ratio the golfer sees is lower than the declared pair computes. The
    // declared colour is what the sheet says; the composited one is what
    // renders, and the rendered one is the measurement.
    const ink = p.alpha === null || p.alpha === undefined ? f.hex : over(channels(f.hex), p.alpha, groundHex);
    const r = ratio(ink, groundHex);
    const at = p.alpha ? ' @ opacity ' + p.alpha : '';
    ok(r >= TEXT_FLOOR, `${p.fg} on ${p.name}${at}  ${pad(r)}  (needs ${TEXT_FLOOR})  [${p.where}]`);
  }
}

// ── The holes, named ─────────────────────────────────────────────────────
console.log('— and nothing was quietly dropped —');
console.log(`          ${droppedToPrint} declaration(s) inside @media print, exempt — ink on paper is deliberately not themed`);
console.log(`          ${exempt.length} literal(s) exempt as not-the-DOM: ${exempt.map(e => 'app.js:' + e.at).join(', ') || 'none'}`);
// Every translucent background the two files paint, split by whether anything
// is written on it. The washed ones are composited above and therefore ARE
// measured; the rest carry no text colour beside them, so there is no pair to
// form — which is a different statement from "they were skipped", and the
// difference is the whole point of this block.
const washPairs = [...fillPairs.values()].filter(p => p.wash).map(p => p.name.split(' over ')[0]);
const washed = [...new Set(washPairs)];
const lonely = [...usedAsBackground].filter(t => {
  if (washed.includes(t)) return false;
  const light = translucent('var(' + t + ')', lightTokens);
  const dark = translucent('var(' + t + ')', darkTokens);
  return !!(light || dark) && !fillPairs.has(t);
});
console.log(`          ${washed.join(' ') || '(none)'} composite over each ladder rung — text is written on them, so they are measured, not skipped`);
console.log(`          ${lonely.join(' ') || '(none)'} are translucent grounds with no text colour declared beside them in either file:`);
console.log('          there is no pair to form there, which is not the same as a pair being dropped');

ok(unknown.length === 0,
   unknown.length
     ? `${unknown.length} pair(s) UNKNOWN — an unresolved pair is not a pass:` +
       unknown.map(u => `\n          ${u.pair}  ←  ${u.reason}  [${u.where}]`).join('')
     : 'every pair resolved to an opaque sRGB colour — nothing was skipped as unknown');

const measured = ladderNames.length * LADDER.length * 2 + LADDER.length * 2 + fillPairs.size * 2;
console.log(`\n${measured} pairs measured across both themes.`);
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
