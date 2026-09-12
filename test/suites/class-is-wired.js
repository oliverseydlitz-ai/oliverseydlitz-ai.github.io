const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// A class is a rule that has to be REACHED, exactly like a gate.
//
// `rules-are-wired.js` asks whether a function is ever called. This asks the
// same question of the stylesheet, and its failure is quieter: `.stat-hero` was
// written as the display tier, was applied by NOTHING, and survived a complete
// redesign - a whole type scale with no referent. Nothing reports it. An
// unused class is not an error: the browser applies nothing, no console line is
// written, and the surface it was meant to style renders with whatever the base
// rule happens to say. Same shape as `Router.showPractice` rendering nothing.
//
// BOTH DIRECTIONS, because they are different bugs:
//   1. style.css styles a class that nothing applies -> a rule that does nothing.
//   2. the markup applies a class that has no rule  -> a hook, or a typo that
//      silently styles nothing.
//
// MARKUP IS BUILT IN TEMPLATE LITERALS. A bare grep for `conf-high` finds
// nothing: the class is assembled as `conf-${fc.confidence.toLowerCase()}` and
// the value lives in a function three thousand lines away. So this file does
// what the drift audit did - it TRACES each dynamic producer to the emitting
// code, in TRACED below - and anything the trace cannot resolve is reported as
// such rather than being counted as wired or failed as dead.

// Sources that apply a class. index.html and app.js are the app; the
// legal-page generator is the third file that consumes this stylesheet
// (`<link rel="stylesheet" href="/style.css">`), and without it `.legal-page`
// and `.doc-standalone` read as dead - the instrument lying, not the code.
//
// `404.html` is deliberately NOT here, and the reason is in its own markup:
// it carries an inline <style> with its own tokens so that it still renders
// when style.css is the thing that 404'd. Its class names (`brand`, `btn`,
// `mark`, `note`) belong to that block, not to this stylesheet, and scanning
// it would grow fourteen hooks that are not hooks.
const SOURCES = ['index.html', 'app.js', 'tools/build-legal-pages.js'];
const CSS = read('style.css');
const src = SOURCES.map(f => ({ file: f, text: read(f) }));

// Comments become their own newlines rather than disappearing: `.woff2` inside
// url('fonts/x.woff2') is not a class, and a comment deleted outright shifts
// every line number this file prints.
const stripComments = s => s.replace(/\/\*[^]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

function styledClasses(css) {
  const bare = stripComments(css);
  const out = new Map();                       // name -> the line it is declared on
  const KEYFRAME = /^(from|to|[\d.]+%)\s*$/;
  let start = 0, line = 1;
  // Walk every block, INCLUDING the ones inside an at-rule. The first version
  // skipped an `@media` body whole, which read as "responsive overrides do not
  // count" and quietly lost every class that only exists there - `.no-print`
  // and `html.legal-print` live nowhere else, and both are load-bearing: the
  // first hides the print button on paper, the second is the entire legal-PDF
  // path. A class the stylesheet styles in a media query is styled.
  //
  // `@font-face` and `@keyframes` bodies need no special case: they contain no
  // selectors, only `from`/`to`/`NN%`, which the guard below drops.
  for (let i = 0; i < bare.length; i++) {
    if (bare[i] === '\n') line++;
    if (bare[i] === '{') {
      const raw = bare.slice(start, i);
      const pre = raw.trim();
      const nl = t => (t.match(/\n/g) || []).length;
      // The line the SELECTOR starts on, not the line the previous rule ended
      // on: `raw` carries whatever blank lines and comments sit between them,
      // and a message that points at a blank line is a message nobody follows.
      const at = line - nl(raw) + nl(raw.slice(0, raw.length - raw.trimStart().length));
      if (!pre.startsWith('@') && !KEYFRAME.test(pre)) {
        for (const m of pre.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
          if (!out.has(m[1])) out.set(m[1], at + nl(pre.slice(0, m.index)));
        }
      }
      start = i + 1;
    } else if (bare[i] === '}') {
      start = i + 1;
    }
  }
  return out;
}

// Read a `class=` value, hopping over `${ ... }` with a brace counter so an
// object literal inside an interpolation cannot end the value early.
function readValue(text, i) {
  const q = text[i];
  let j = i + 1, out = '';
  while (j < text.length) {
    const c = text[j];
    if (c === '\\') { out += c + (text[j + 1] || ''); j += 2; continue; }
    if (c === q) break;
    if (c === '$' && text[j + 1] === '{') {
      let d = 1, k = j + 2;
      while (k < text.length && d > 0) {
        if (text[k] === '{') d++; else if (text[k] === '}') d--;
        k++;
      }
      out += text.slice(j, k); j = k; continue;
    }
    out += c; j++;
  }
  return { value: out, end: j };
}
const TOKEN = /^-?[A-Za-z_][\w-]*$/;

// String literals used as a VALUE - after `?` or `:`. Not every literal in an
// interpolation is a class: `a.severity === 'high' ? 'decline' : ''` names one
// class (`decline`) and one comparison value (`high`) in the same expression,
// and a harvest that takes both grows `.high` into a phantom hook.
function branchLiterals(expr) {
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(expr))) {
    const before = expr.slice(0, m.index).replace(/\s+$/, '');
    if (before.endsWith('?') || before.endsWith(':')) out.push(m[2]);
  }
  return out;
}

const produced = new Map();     // class name -> "file:line" that emits it
const prefixes = new Map();     // dynamic prefix -> "file:line" that emits it
const note = (map, k, where) => { if (!map.has(k)) map.set(k, where); };

function scanMarkup(text, file) {
  const re = /\bclass\s*=\s*(["'`])/g;
  let m;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length;
    const { value, end } = readValue(text, m.index + m[0].length - 1);
    re.lastIndex = end + 1;

    const parts = [];
    let k = 0;
    while (k < value.length) {
      const s = value.indexOf('${', k);
      if (s < 0) { parts.push({ s: value.slice(k) }); break; }
      if (s > k) parts.push({ s: value.slice(k, s) });
      let d = 1, j = s + 2;
      while (j < value.length && d > 0) {
        if (value[j] === '{') d++; else if (value[j] === '}') d--;
        j++;
      }
      parts.push({ x: value.slice(s + 2, j - 1) });
      k = j;
    }
    for (let p = 0; p < parts.length; p++) {
      if (parts[p].x !== undefined) {
        for (const lit of branchLiterals(parts[p].x))
          for (const t of lit.split(/\s+/).filter(Boolean))
            if (TOKEN.test(t)) note(produced, t, `${file}:${line}`);
        continue;
      }
      const run = parts[p].s;
      const next = parts[p + 1];
      // `' ' + cls` - a literal opening with a space means the caller supplies
      // its own separator, so the fragment glued to `${` is a whole class name
      // (`icon`, `rc-dot`, `next-step`), not a prefix.
      const spaced = next && next.x !== undefined &&
        branchLiterals(next.x).some(v => /^\s/.test(v));
      const pieces = run.split(/\s+/).filter(Boolean);
      const glued = next && next.x !== undefined && !/\s$/.test(run);
      pieces.forEach((piece, n) => {
        const last = n === pieces.length - 1;
        if (glued && last && !spaced) note(prefixes, piece, `${file}:${line}`);
        else note(produced, piece, `${file}:${line}`);
      });
    }
  }
}
// `el.className = '...'`, `classList.add('...')`, `setAttribute('class', '...')`.
//
// The FIRST argument only, except for `replace(old, new)` where both are class
// names. `classList.toggle(cls, key === 'densityMode' ? on : !on)` puts a
// non-class literal in the second slot, and harvesting it grows a hook named
// after a preference key.
function classListArgs(args) {
  const out = [];
  let depth = 0, cur = '';
  for (const c of args + ',') {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  return out;
}
function scanHooks(text, file) {
  const at = i => `${file}:${text.slice(0, i).split('\n').length}`;
  for (const m of text.matchAll(/classList\.(add|remove|toggle|replace|contains)\(([^)]*)\)/g)) {
    const args = classListArgs(m[2]);
    const take = m[1] === 'replace' ? args.slice(0, 2) : args.slice(0, 1);
    for (const a of take)
      for (const lit of a.matchAll(/'([^']*)'|"([^"]*)"/g))
        for (const t of (lit[1] ?? lit[2]).split(/[\s,]+/).filter(Boolean))
          if (TOKEN.test(t)) note(produced, t, at(m.index) + ' classList');
  }
  for (const m of text.matchAll(/\.className\s*=\s*(["'])/g)) {
    const { value } = readValue(text, m.index + m[0].length - 1);
    for (const t of value.split(/\s+/).filter(Boolean))
      if (TOKEN.test(t)) note(produced, t, at(m.index) + ' className');
  }
  for (const m of text.matchAll(/setAttribute\(\s*['"]class['"]\s*,\s*(["'])/g)) {
    const { value } = readValue(text, m.index + m[0].length - 1);
    for (const t of value.split(/\s+/).filter(Boolean))
      if (TOKEN.test(t)) note(produced, t, at(m.index) + ' setAttribute');
  }
}

const STYLED = styledClasses(CSS);
for (const { file, text } of src) { scanMarkup(text, file); scanHooks(text, file); }

// The dynamic producers, traced.
// [key, kind, values, a needle that must still exist in the sources, where the
//  value comes from]
const TRACED = [
  ['conf-', 'prefix', ['high', 'medium', 'low'],
   'conf-${fc.confidence.toLowerCase()}',
   'Features.focus() rates the fault at 40 / 20 percent of the sample'],
  ['sev-', 'prefix', ['high', 'medium', 'low'],
   'sev-${fc.severity}',
   'FaultEngine severity on the Focus card'],
  ['severity-', 'prefix', ['high', 'medium', 'low'],
   'severity-${',
   'FaultEngine severity on fault cards, bench rows, plan blocks and shot rows'],
  ['tone-', 'prefix', ['good', 'ok', 'bad'],
   'tone-${p.tone}',
   'SwingDNA pill tone; NEUTRAL is the string ok'],
  ['outcome-', 'prefix', ['retained', 'regressed', 'no-change', 'unknown'],
   'outcome-${r.outcome}',
   'RetentionProbe.settle() verdict; unknown is too little history to call it'],
  ['hm-l', 'prefix', ['0', '1', '2', '3', '4'],
   'hm-l${lvl}',
   'heatmap cell level from shots-per-day'],
  ['drill-group-', 'prefix', ['drill', 'measure', 'fitness', 'equipment', 'review'],
   'drill-group-${k}',
   'DrillLibrary.KINDS - every kind gets a group class whether or not it has a rule'],
  ['sg-tier-', 'prefix', ['strong', 'moderate', 'weak'],
   'sg-tier-${t}',
   'ShortGame drill evidence tier'],
  ['trend-', 'prefix', ['positive', 'negative', 'neutral'],
   'trend-${cls}',
   'Progress trend row; neutral when a tier-2 angle has no direction'],
  ['status-dot', 'values', ['na', 'green', 'yellow', 'red'],
   'class="status-dot ${laStatus}"',
   'band() in the benchmark table and Benchmarks.status(); both return colour words'],
  ['metric-delta', 'values', ['up', 'down'],
   'metric-delta ${cls}',
   'the sign of the delta against the all-time mean on a metric cell'],
  ['since-row', 'values', ['good', 'bad', 'flat'],
   'since-row ${cls}',
   'Features.compare() row verdict; flat is a withheld or unproven row'],
  ['yard-trend', 'values', ['flat', 'up', 'down'],
   'yard-trend ${cls}',
   'ClubAnalyzer.calculateClubTrend verdict'],
  ['cmp-delta', 'values', ['good', 'bad', 'neutral'],
   'cmp-delta ${cls}',
   'session comparison row; neutral is a row with no defensible direction'],
  ['row', 'values', ['row-good', 'row-ok', 'row-bad'],
   'const rowCls =',
   'ShotScorer letter band on the shot log, built whole in one ternary'],
  ['alert-item', 'values', ['improvement', 'decline', 'fault'],
   'alert-item ${a.type}',
   'Features.performanceAlerts'],
  ['pref-', 'prefix', ['no-heatmap', 'no-faults', 'no-gapping', 'no-comparison', 'dense'],
   'pref-no-heatmap',
   'ViewPrefs.CLASS, applied to <html> with classList.toggle'],
  ['band--', 'prefix', ['canvas', 'surface', 'signal'],
   "band--' + m",
   'the band() helper on the home view; BAND_MODES is the value set and `null` clears it'],
];

const resolved = new Map();     // class name -> why it counts as applied
const emitted = new Map();      // class name -> the traced producer that emits it
console.log('— the dynamic producers, traced to the code that emits them —');
for (const [key, kind, values, needle, why] of TRACED) {
  const names = values.map(v => (kind === 'prefix' ? key + v : v));
  const live = src.some(({ text }) => text.includes(needle));
  const inCss = names.filter(n => STYLED.has(n));
  for (const n of names) {
    note(emitted, n, why);
    if (STYLED.has(n)) note(resolved, n, why);
  }
  // A producer whose classes have all left the stylesheet is a stale row: the
  // markup still builds the name, so the row would go on proving a class that
  // is about to be reported dead. Both halves are checked, so the trace cannot
  // rot into a list of things that used to be true.
  ok(live && inCss.length > 0,
     `${key}${kind === 'prefix' ? '*' : ''} — ${values.length} values, ${inCss.length} of them styled` +
     `${live ? '' : ` — NOTHING in the sources contains \`${needle}\` any more`}` +
     `${inCss.length ? '' : ' — no class it builds has a rule any more'}`);
}

console.log('— and no class is built by concatenation that the trace does not know —');
// The other half of tracing. A prefix found in the markup and absent from
// TRACED is a producer whose values this file cannot enumerate, so a class it
// builds would be reported DEAD with no explanation and the next person would
// delete a live rule. `.conf-high` looked exactly like that before it was
// traced. Failing here says which prefix and where it is emitted.
{
  const known = new Set(TRACED.filter(([, kind]) => kind === 'prefix').map(([key]) => key));
  const untraced = [...prefixes.keys()].filter(p => !known.has(p)).sort();
  ok(untraced.length === 0,
     `every dynamic prefix is one of the ${known.size} traced ones${untraced.length
       ? ` — these are not: ${untraced.map(p => `${p}* emitted at ${prefixes.get(p)}`).join(', ')}`
       : ` (${prefixes.size} found in the markup)`}`);
}

console.log('— and the severity list a fault carries is read, not remembered —');
// The value sets above are enumerated by hand, and a hand-typed enumeration is
// the same shape of claim as a hand-typed count: right until somebody adds a
// fourth thing. This one is checkable, so it is checked — the severities come
// out of FaultEngine's own rule table, and a new one fails here instead of
// silently becoming a class the document never lists as uncovered.
//
// Derived from the MODULE, not the file. A `/severity:\s*'x'/` scan over the
// whole of app.js returns four values, not three: the notification centre
// carries its own unrelated `severity: 'info'`, and it never becomes a class.
// Reading the wrong object's field is how a check starts asserting something
// that was never true.
{
  const app = src.find(s => s.file === 'app.js').text;
  const i = app.indexOf('const FaultEngine = (() => {');
  const j = i < 0 ? -1 : app.indexOf('\n})();', i);
  ok(i >= 0 && j > i, 'FaultEngine is a module this check can find');
  const severities = j > i
    ? [...new Set([...app.slice(i, j).matchAll(/severity\s*:\s*'([a-z-]+)'/g)].map(m => m[1]))].sort()
    : [];
  const traced = TRACED.find(([key]) => key === 'severity-')[2];
  const unlisted = severities.filter(s => !traced.includes(s));
  ok(unlisted.length === 0,
     `FaultEngine raises only severities the trace knows (${severities.join(', ')})${unlisted.length
       ? ` — not ${unlisted.join(', ')}: add ${unlisted.length > 1 ? 'them' : 'it'} to the severity- row and to STYLED` : ''}`);
}

const wired = n => produced.has(n) || resolved.has(n);
const DEAD = [...STYLED.keys()].filter(n => !wired(n)).sort();
const NO_RULE = [...produced.keys()].filter(n => !STYLED.has(n)).sort();
const UNKNOWN = [...emitted.keys()].filter(n => !STYLED.has(n)).sort();
const VIA_TRACE = [...resolved.keys()].filter(n => !produced.has(n)).sort();

console.log('— every class style.css styles is applied by something —');
// Each of these waits for the dead-CSS sweep. The suite fails on a NEW one, and
// on an entry that has gone STALE once the sweep removes it — which is what
// keeps this list from becoming the place dead classes go to be forgotten. It
// is also, deliberately, not a weakened scan: `did you mean this prefix` is how
// `.tnum` would have passed for the life of the redesign.
const DEAD_EXEMPT = {
  'card':        'bare .card; every card names its kind (session-card, fault-card, drill-card) and none of them inherits it',
  'cluster':     'layout utility in the 640px block; the app sets flex per surface instead',
  'kicker':      'the sub-label tier. .record-label restates it verbatim and IS used — see the report; Task 2 left it unwired',
  'mb-2':        'half of the spacing scale — mb-3/4/5/6 are applied and mb-2 is not',
  'mt-4':        'the same one step over — mt-2/3/6 are applied and mt-4 is not',
  'row-between': 'the same shape as .stack/.cluster — superseded by per-surface flex rules',
  'stack':       'layout utility in the 640px block; nothing uses the stacked-children form',
  'tnum':        'tabular numerals; `td, th` carry the identical declaration in the same rule, and every table in the app is a table element',
  'pad-b':       'one half of the .pad / .pad-y pair in the layout primitives; .pad and .pad-y are applied and the bottom-only form is not',
};
{
  ok(STYLED.size > 500 && produced.size > 400,
     `${STYLED.size} classes are styled in style.css, ${produced.size} names are applied by the markup`);
  const missing = DEAD.filter(n => !(n in DEAD_EXEMPT));
  ok(missing.length === 0,
     `nothing new has become a rule that does nothing${missing.length
       ? ` — ${missing.map(n => `.${n} (style.css:${STYLED.get(n)})`).join(', ')}: delete the rule, or apply it`
       : ` (${DEAD.length} known)`}`);
  const stale = Object.keys(DEAD_EXEMPT).filter(n => !DEAD.includes(n));
  ok(stale.length === 0,
     `and the dead list has nothing stale in it${stale.length
       ? `: ${stale.join(', ')} — the sweep deleted them, so remove them here too` : ''}`);
}

console.log('— and every class the markup applies has a rule, or a reason —');
// A class with no rule is not automatically wrong: several are JS handles whose
// styling comes from a sibling rule (`btn-primary btn-sm paywall-btn`), and a
// few wrap content that is styled by what is inside them. What is wrong is one
// appearing with nothing said about it, because the surface it belongs to then
// renders with no styling and no error.
const HOOK_EXEMPT = {
  'dbg-body':        'showDebug() builds it; console output, never styled',
  'drill-group':     'the base of "drill-group drill-group-<kind>"; the variants carry the rules',
  'empty-cta-group': 'the import button inside the empty state — .empty-state does the layout',
  'legal-source':    'the "also available as plain text" line on a generated legal page',
  'modal-close':     'JS handle on the ✕; bound by data attribute, styled by .btn-icon in the injected modals',
  'mval':            'JS handle: the live metric cell the value writer targets',
  'paywall-btn':     'the Sign In button inside .paywall-wrap; .btn-primary btn-sm is its styling',
  'plan-range':      'JS handle: "Take this to the range" on the practice plan, styled btn-secondary',
  'practice-range':  'the same button on the Practice view, styled btn-primary',
  'settings-group':  'a grouping wrapper in Settings; .settings-row children carry the rules',
  'setup-step-body': 'the body column of a setup-guide step; its children are styled',
  'shot-table':      'JS handle: the shot log table, filled row by row',
  'sm-sentinel':     'ScrollMotion measures with it and removes it on the next frame',
  'band--':          'the prefix fragment the classList extractor reads before the `+`, not a name: band() builds band--canvas/surface/signal from BAND_MODES, all three carry rules and all three are traced in TRACED',
};
{
  const missing = NO_RULE.filter(n => !(n in HOOK_EXEMPT));
  ok(missing.length === 0,
     `nothing new applies a class with no rule${missing.length
       ? ` — ${missing.map(n => `${n} (${produced.get(n)})`).join(', ')}: add a rule, or name it here with what it is for`
       : ` (${NO_RULE.length} known)`}`);
  const stale = Object.keys(HOOK_EXEMPT).filter(n => !NO_RULE.includes(n));
  ok(stale.length === 0,
     `and that list has nothing stale in it${stale.length
       ? `: ${stale.join(', ')} — they have a rule now, so they are no longer hooks` : ''}`);
}

console.log('— and the names a traced producer builds that no rule covers —');
// The trap this whole file exists for. `severity-${f.severity}` can build
// `.severity-high`, `.severity-medium` and `.severity-low`; style.css styles two
// of the three. A prefix match calls all three wired, and nothing ever says
// that a medium-severity plan block renders with the base rule's default. Each
// one below is emitted by live code and has NO rule of its own — reported as an
// unanswered name, NOT as dead CSS, which it is not: nothing in style.css
// mentions it, so there is nothing to delete.
const GAP_EXEMPT = {
  'drill-group-drill':   'the drills need no heading, so the group class has nothing to add',
  'drill-group-measure': 'the same — .drill-group carries the layout for every kind',
  'flat':                'a withheld or unproven row takes the base .since-row / .yard-trend treatment',
  'outcome-unknown':     'a probe with too little history to call it; deliberate default, not a colour',
  'sev-medium':          'a medium severity is the base focus card — only high and low are marked',
  'severity-medium':     'the same, on fault cards, plan blocks, bench rows and shot-log rows',
};
{
  console.log('      ' + UNKNOWN.map(n => '.' + n).join('  '));
  const missing = UNKNOWN.filter(n => !(n in GAP_EXEMPT));
  ok(missing.length === 0,
     `no new name is built without a rule and without a reason${missing.length
       ? ` — ${missing.join(', ')}` : ''}`);
  const stale = Object.keys(GAP_EXEMPT).filter(n => !UNKNOWN.includes(n));
  ok(stale.length === 0,
     `and the gap list has nothing stale in it${stale.length ? `: ${stale.join(', ')}` : ''}`);
  ok(VIA_TRACE.length > 15,
     `${VIA_TRACE.length} classes are reached ONLY through a trace — named, never counted as wired by a prefix guess`);
}

// ────────────────────────────────────────────────────────────────────────
// The negative control. A check built out of string matches is exactly the
// shape that quietly stops discriminating, and this one would still print
// "all passed" if it went blind.
//
// `.mt-4` and `.mb-2` are verified dead against the tree: style.css declares
// both, and no class attribute, no classList call, no className assignment and
// no traced producer in any of the three sources applies either. `.stat-hero`
// is the other half — the audit's own example of a tier with no referent, now
// carrying two call sites — so one probe fails if the detector stops finding
// dead classes, and the other fails if it starts reporting live ones.
//
// If the dead-CSS sweep removes `.mt-4`/`.mb-2`, these lines fail and the
// control has to move to another entry in DEAD_EXEMPT. That is the intended
// cost: a control nobody has to maintain is a control that has stopped
// controlling anything.
console.log('— and the check can still tell the difference —');
{
  for (const c of ['mt-4', 'mb-2']) {
    ok(STYLED.has(c), `.${c} is still declared in style.css — the control needs a rule to be about`);
    ok(!wired(c), `.${c} still reads as applied by NOTHING — the control this detector is measured against`);
  }
  ok(STYLED.has('stat-hero') && wired('stat-hero'),
     '.stat-hero reads as applied — it was the display tier with zero call sites, and Task 2 wired it');
  ok(STYLED.has('no-print') && wired('no-print'),
     '.no-print reads as applied — it is styled only inside @media print and would vanish from the scan');
  ok(DEAD.length === Object.keys(DEAD_EXEMPT).length,
     `the dead list is exactly the ${DEAD.length} named classes, no more`);
}

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
