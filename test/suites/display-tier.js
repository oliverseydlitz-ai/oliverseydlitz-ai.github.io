// The display tier is for a figure the app will stand behind (D3).
//
// `.stat-hero` sat in style.css for the whole life of the "Range" redesign with
// nothing referencing it: a display tier with no referent. That is the same
// defect class as a gate nothing calls, one level up — except that here the
// rule itself was the thing missing, so no check could have caught it.
//
// Making it referenced is only half the job. The app's entire proposition is
// that a number either cleared its floor or it did not, and a 2.4rem numeral is
// the strongest claim of confidence the system can make. A club under
// Metrics.MIN_SHOTS_REPORT, a withheld dispersion figure, a modelled number
// with no label — none of them may be set at that size.
//
// So: every `stat-hero` call site in app.js must sit inside a branch that has
// already tested the sample floor. This is a SOURCE check because that is what
// the rule is about — which branch the markup is in, not what it renders. A
// below-floor session still renders its score; it renders it smaller, with what
// it needs beside it (renderScoreBanner).
//
// THREE THINGS THIS DOES NOT DO, each deliberate:
//
//   * It does not regex for `if (... MIN_SHOTS_REPORT ...)`. A non-greedy
//     `[^;]*?` stops at the first closing paren and silently matches the wrong
//     thing — the way `detectFaults((x || {}).shots, y)` was read as a
//     one-argument call. Conditions come out of a balanced-paren scan, the same
//     mechanism rules-are-wired.js uses.
//   * It does not accept "a floor appears somewhere in the file". The guard has
//     to dominate the site — enclose it, precede it as a bail-out, or be the
//     condition of the ternary the markup is in.
//   * It does not accept a floor test on the wrong side. `if (!b.enough)
//     return '<thin row>'` IS a sample-floor test, and its true branch is
//     precisely the below-floor case: a `stat-hero` inside that row is
//     ungated, and this suite has to fail on it. Polarity is checked, not just
//     the presence of the word.
//
// A guard that has never caught anything has not been tested. The self-check at
// the bottom runs this same checker against six synthetic snippets — including
// the real defect — so the checker cannot quietly rot into a pass.
const fs = require('fs');
const path = require('path');

let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };

const root = path.join(__dirname, '..', '..');
const rawApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

// Comments out before anything is scanned. This repository has had a source
// check read its own explanation four times — a scan for the words "lessons"
// and "videos" that failed on the paragraph warning against them, a module
// count that counted the prose, a `+3° ideal` check that matched the comment
// explaining why it was removed. Block comments become blanks, not deletions,
// so every index and line number below still refers to the real file.
const src = rawApp
  .replace(/\/\*[^]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
const lineOf = i => src.slice(0, i).split('\n').length;

// ── What counts as a sample floor ────────────────────────────────
// The three floors Metrics owns. Which one is right is the module's business,
// not this suite's: MIN_SHOTS_REPORT for a mean, MIN_SHOTS_DELIVERY for a
// club-delivery claim, MIN_SHOTS_TAIL for a dispersion tail.
const FLOOR = /(?:Metrics\.)?MIN_SHOTS_(?:REPORT|DELIVERY|TAIL)/;

// A floor often arrives as a variable — QuickStats, Analytics.yardageBook and
// the bench table all compute the test once and branch on it. Those are
// accepted, but only after proving the NAME is floor-derived somewhere in this
// file, so an alias cannot be invented at a call site to launder a below-floor
// number past this check.
// The floor has to be COMPARED in that assignment, not merely mentioned:
// `const short = Metrics.MIN_SHOTS_REPORT - n` is a shortfall, not a gate, and
// accepting it would accept `if (short)`.
const FLOOR_TEST = new RegExp(
  `(?:>=|>|<=|<)\\s*(?:Metrics\\.)?MIN_SHOTS_|(?:Metrics\\.)?MIN_SHOTS_\\w+\\s*(?:>=|>|<=|<)`);
const ALIASES = new Set();
for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]*);/g)) {
  if (FLOOR_TEST.test(m[2])) ALIASES.add(m[1]);
}
const aliasAlt = [...ALIASES].map(a => a.replace(/\$/g, '\\$')).join('|');
const aliasRe = aliasAlt ? new RegExp(`\\b(?:${aliasAlt})\\b`, 'g') : null;
// `!x`, `!(x)`, `!b.enough` — a negation applied to the alias itself, with only
// identifiers and dots between. `!club || n < FLOOR` is caught by the floor
// comparison below, not here.
const NEGATED = /!\s*\(*\s*[A-Za-z_$0-9.]*$/;

// true  — this condition, taken as written, says the floor IS met.
// false — it says the floor is NOT met (so the site is below it).
// null  — it says nothing about a floor, so it is not a gate at all.
function condVerdict(cond) {
  const c = String(cond).replace(/\s+/g, ' ');
  let verdict = null;
  // The comparison the floor constant sits in, in both orders: `n >= MIN` and
  // `MIN <= n` say the same thing. Any `<` against it says the opposite.
  const re = new RegExp(FLOOR.source, 'g');
  let m;
  while ((m = re.exec(c))) {
    const before = c.slice(Math.max(0, m.index - 6), m.index);
    const after = c.slice(m.index + m[0].length, m.index + m[0].length + 6);
    const ge = /(?:>=|>)\s*$/.test(before) || /^\s*(?:<=|<)/.test(after);
    const lt = /(?:<=|<)\s*$/.test(before) || /^\s*(?:>=|>)/.test(after);
    if (ge && !lt) verdict = true;
    else if (lt) verdict = false;
    // `===` against a floor is not a gate in either direction.
  }
  if (verdict !== null) return verdict;
  if (aliasRe) {
    const flat = c.replace(/\s+/g, '');
    for (const a of flat.matchAll(aliasRe)) {
      const pre = flat.slice(0, a.index);
      return NEGATED.test(pre) ? false : true;
    }
  }
  return null;
}

// ── Structural scans (balanced, never a [^;]*? ) ─────────────────
// The matching closer for the opener at `open`, counting nesting. -1 if there
// is none. Strings are not parsed: app.js's template literals keep their
// `${}` balanced, so a counter holds. The failure mode if that ever stops being
// true is a guard reported as missing — loud, and on the safe side.
function closeAt(s, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const closer = pairs[s[open]];
  if (!closer) return -1;
  const opener = s[open];
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === opener) depth++;
    else if (ch === closer) { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function openAt(s, close) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const opener = pairs[s[close]];
  if (!opener) return -1;
  const closer = s[close];
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    const ch = s[i];
    if (ch === closer) depth++;
    else if (ch === opener) { depth--; if (depth === 0) return i; }
  }
  return -1;
}
// Is this `{` the body of a NAMED function or a method? That is a scope
// boundary and the walk stops there: nothing outside a function can dominate a
// position inside it. Without this the walk runs back through the whole file
// and picks up a bail-out in some earlier, unrelated function —
// `renderBenchTable` has `if (!enough) return` at line 8654, which ends long
// before the yardage book's rows and dominates none of them. Found the hard
// way: the deliberate below-floor defect PASSED until this existed.
//
// An inline ARROW body is deliberately NOT a boundary. A callback runs while
// the statement that passes it is executing, so a `if (!enough) return;` above
// `rows.map(r => \`<div class="stat-hero">\`)` in the same function does
// dominate it, and treating that as separate scope would reject a correctly
// gated call site.
function isNamedFunctionBody(s, j) {
  let k = j - 1;
  while (k >= 0 && /\s/.test(s[k])) k--;
  if (k < 0) return false;
  if (s.slice(Math.max(0, k - 1), k + 1) === '=>') return false;   // arrow callback
  if (s[k] !== ')') return false;
  const open = openAt(s, k);
  if (open < 0) return false;
  const head = s.slice(Math.max(0, open - 40), open);
  return !/(\bif|\bwhile|\bfor|\bswitch|\bcatch|\bdo)\s*$/.test(head);
}
// The `{` that opens each block containing index i, innermost first, stopping
// at the enclosing named-function body.
function enclosingBlocks(s, i) {
  const out = [];
  let depth = 0;
  for (let j = i - 1; j >= 0; j--) {
    const ch = s[j];
    if (ch === '}') depth++;
    else if (ch === '{') {
      depth--;
      if (depth < 0) { out.push(j); depth = 0; if (isNamedFunctionBody(s, j)) break; }
    }
  }
  return out;
}
// The guard a block opener carries, if it is an `if`, an `else`, or nothing.
function guardOfBlock(s, braceIdx) {
  let k = braceIdx - 1;
  while (k >= 0 && /\s/.test(s[k])) k--;
  if (k < 0) return null;
  if (s[k] === ')') {
    const open = openAt(s, k);
    if (open < 0) return null;
    const head = s.slice(Math.max(0, open - 24), open);
    const kw = (head.match(/(\bif|\bwhile|\bfor|\bswitch|\bcatch)\s*$/) || [])[1];
    if (kw !== 'if') return null;   // a loop or a function body is not a floor gate
    return { form: 'if', cond: s.slice(open + 1, k) };
  }
  // `else {` — the condition is the `if` it pairs with, and the branch is the
  // one where that condition FAILED.
  const head = s.slice(Math.max(0, k - 12), k + 1);
  if (!/else\s*$/.test(head)) return null;
  let p = k - 4;
  while (p >= 0 && /\s/.test(s[p])) p--;
  if (p >= 0 && s[p] === '}') { const b = openAt(s, p); p = b < 0 ? -1 : b - 1; }
  while (p >= 0 && /\s/.test(s[p])) p--;
  if (p < 0 || s[p] !== ')') return null;
  const open = openAt(s, p);
  if (open < 0) return null;
  const head2 = s.slice(Math.max(0, open - 24), open);
  const kw2 = (head2.match(/(\bif|\bwhile|\bfor|\bswitch|\bcatch)\s*$/) || [])[1];
  if (kw2 !== 'if') return null;
  return { form: 'else', cond: s.slice(open + 1, p) };
}
// Statements of the form `if (cond) return ...;` in [from, to) that END before
// the site. The site is then on the side where cond is FALSE — which is what
// makes `if (!enough) return ...` a gate rather than the opposite of one.
function bailoutsBefore(s, from, to) {
  const out = [];
  const re = /\bif\s*\(/g;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(s)) && m.index < to) {
    const open = m.index + m[0].length - 1;
    const close = closeAt(s, open);
    if (close < 0 || close > to) break;
    let p = close + 1;
    while (p < s.length && /\s/.test(s[p])) p++;
    let end = -1;
    if (s[p] === '{') {
      const blk = closeAt(s, p);
      if (blk >= 0 && /\b(?:return|throw|continue|break)\b/.test(s.slice(p + 1, blk))) end = blk;
    } else if (/^\s*(?:return|throw|continue|break)\b/.test(s.slice(p, p + 10))) {
      let depth = 0;
      for (let q = p; q < s.length; q++) {
        const ch = s[q];
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        else if (ch === ';' && depth === 0) { end = q; break; }
      }
    }
    if (end >= 0 && end < to) out.push(s.slice(open + 1, close));
    re.lastIndex = close + 1;
  }
  return out;
}
// The condition of the ternary the site is inside, if it is inside one. The
// branch decides the polarity: `cond ? <site> : other` is the true branch.
function ternaryBefore(s, i) {
  let depth = 0;
  for (let j = i - 1; j >= 0; j--) {
    const ch = s[j];
    if (ch === ')' || ch === ']' || ch === '}') depth++;
    else if (ch === '(' || ch === '[' || ch === '{') { if (depth === 0) return null; depth--; }
    else if (depth === 0) {
      if (ch === ':' || ch === ';' || ch === ',') return null;   // in the false branch, or another statement
      if (ch === '?') {
        let k = j - 1, d2 = 0;
        for (; k >= 0; k--) {
          const c2 = s[k];
          if (c2 === ')' || c2 === ']' || c2 === '}') d2++;
          else if (c2 === '(' || c2 === '[' || c2 === '{') { if (d2 === 0) break; d2--; }
          else if (d2 === 0 && ',;=?&|'.includes(c2)) break;
        }
        return { cond: s.slice(k + 1, j), inTrue: true };
      }
    }
  }
  return null;
}

// ── The checker ─────────────────────────────────────────────────
// Every guard that dominates one position in the source, with the verdict
// already applied: `met: true` means "by the time execution reaches the site,
// the floor has been tested and met".
function guardsFor(s, i) {
  const out = [];
  const consider = (cond, form, wantTrue) => {
    const v = condVerdict(cond);
    if (v === null) return;
    out.push({ cond: String(cond).replace(/\s+/g, ' ').trim(), form, met: wantTrue ? v : !v });
  };
  const blocks = enclosingBlocks(s, i);
  for (const b of blocks) {
    const g = guardOfBlock(s, b);
    if (g) consider(g.cond, g.form, g.form === 'if');
    // Bail-outs are scanned from the START OF THE ENCLOSING BLOCK, never from
    // the top of the file. A bail-out in an earlier function ends before this
    // site and would dominate nothing — accepting it would let one correctly
    // gated render satisfy the check for every ungated one below it.
    bailoutsBefore(s, b, i).forEach(c => consider(c, 'bail-out', false));
  }
  if (!blocks.length) bailoutsBefore(s, 0, i).forEach(c => consider(c, 'bail-out', false));
  const t = ternaryBefore(s, i);
  if (t) consider(t.cond, 'ternary', t.inTrue);
  return out;
}
function sitesIn(s) {
  const out = [];
  for (const m of s.matchAll(/stat-hero/g)) {
    const guards = guardsFor(s, m.index);
    out.push({ index: m.index, guards, gated: guards.some(g => g.met) });
  }
  return out;
}

console.log('— the tier has a referent —');
const sites = sitesIn(src);
ok(sites.length >= 2,
   `${sites.length} stat-hero call sites in app.js${sites.length < 2 ? ' — the display tier is defined and reached by nothing, which is how it spent the whole redesign' : ''}`);
const lineList = sites.map(s => lineOf(s.index)).join(', ');
ok(sites.length > 0, `at: app.js line ${lineList}`);

console.log('— and every one of them is behind a sample floor —');
for (const site of sites) {
  const ln = lineOf(site.index);
  const hit = site.guards.find(g => g.met);
  ok(site.gated,
     site.gated
       ? `app.js:${ln} — gated by ${hit.form} \`${hit.cond}\``
       : `app.js:${ln} — NOT gated on a sample floor. A display figure must sit inside a ` +
         `branch that has tested Metrics.MIN_SHOTS_REPORT (or _DELIVERY/_TAIL), on the side ` +
         `where the floor is MET.${site.guards.length ? ` Found: ${site.guards.map(g => `\`${g.cond}\` (${g.form}, floor not met here)`).join(', ')}` : ' Found no guard at all.'}`);
}

console.log('— the aliases it accepts are floor-derived, not invented —');
// A call site may branch on `enough` or `cleared` instead of the constant. The
// name is only accepted because it was ASSIGNED from a floor above.
ok(ALIASES.size > 0,
   `${ALIASES.size} floor-derived name(s) in app.js: ${[...ALIASES].join(', ') || '—'} — ` +
   `if this drops to zero the alias acceptance above is doing nothing`);

console.log('— and the tier is one definition, phone-first —');
ok(/\.stat-hero\b/.test(css), '.stat-hero is defined in style.css');
// Mobile base stays small and the oversized step-up happens at min-width 640
// only: the design viewport is 393px, not a width to degrade to, and a 3.4rem
// tabular numeral at phone width is the likeliest overflow this scale can
// cause (D4).
const media = [];
{
  const re = /@media([^{]*)\{/g; let m;
  while ((m = re.exec(css))) {
    let i = m.index + m[0].length, depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++; else if (css[i] === '}') depth--;
      i++;
    }
    media.push({ q: m[1].trim(), body: css.slice(m.index + m[0].length, i - 1) });
    re.lastIndex = i;
  }
}
const touch = media.filter(b => /\.stat-hero\b/.test(b.body) && !/print/.test(b.q));
ok(touch.length === 1 && /min-width:\s*640px/.test(touch[0] ? touch[0].q : ''),
   `the display tier is resized in exactly one media block, at min-width 640px` +
   `${touch.length === 1 && !/min-width:\s*640px/.test(touch[0].q) ? ` — found "${touch[0].q}"` : ''}` +
   `${touch.length !== 1 ? ` — found ${touch.length}: ${touch.map(b => `"${b.q}"`).join(', ')}` : ''}`);

console.log('— the checker itself, against a fixture it must fail —');
// The negative control. `ViewPrefs.setPref` plays this role in
// rules-are-wired.js: a thing confirmed dead and asserted to still read as
// dead. Here the equivalent is a call site that is real, plausible, and
// WRONG — the below-floor row of the yardage book, which is the figure this
// whole rule exists to keep out of the display tier.
const FIXTURES = [
  ['below the floor: the `if` branch that runs when nothing has cleared it',
   `book.map(b => {
      if (!b.enough) return \`<tr class="yard-thin"><td><span class="stat-hero">\${b.count}</span></td></tr>\`;
      return \`<tr><td>ok</td></tr>\`;
    })`, false],
  ['no guard at all',
   `el.innerHTML = \`<div class="stat-hero">\${value}</div>\`;`, false],
  ['a floor test on the wrong side (the true branch of "not enough")',
   `if (n < Metrics.MIN_SHOTS_REPORT) { el.innerHTML = \`<div class="stat-hero">\${n}</div>\`; }`, false],
  ['a floor-met `if`',
   `if (n >= Metrics.MIN_SHOTS_REPORT) { el.innerHTML = \`<div class="stat-hero">\${mean}</div>\`; }`, true],
  ['a bail-out: below the floor returns before the figure is rendered',
   `if (n < Metrics.MIN_SHOTS_REPORT) return;
    el.innerHTML = \`<div class="stat-hero">\${mean}</div>\`;`, true],
  ['a ternary guarded on the floor-derived alias',
   `const cleared = n >= Metrics.MIN_SHOTS_REPORT;
    el.innerHTML = \`<div class="score-number\${cleared ? ' stat-hero' : ''}">\${n}</div>\`;`, true],
  // Not a fixture anybody wrote to be tidy: this one is a bug the checker had.
  // The walk for an enclosing block ran back through the whole file and picked
  // up `renderBenchTable`'s `if (!enough) return`, which ends thousands of
  // lines before the yardage book's rows and dominates none of them. Every
  // fixture passed while the real defect went through, because the fixtures had
  // no sibling functions. A function body is a scope boundary now, and this is
  // the case that says so.
  ['a bail-out in a SIBLING function, which dominates nothing',
   `function renderBench() { if (n < Metrics.MIN_SHOTS_REPORT) return; }
    function renderBook() { el.innerHTML = \`<div class="stat-hero">\${n}</div>\`; }`, false],
];
for (const [what, code, want] of FIXTURES) {
  const got = sitesIn(code);
  const gated = got.length > 0 && got.every(s => s.gated);
  ok(gated === want,
     `${want ? 'accepts' : 'rejects'} ${what}` +
     `${gated === want ? '' : ` — expected ${want ? 'gated' : 'ungated'}, got ${gated ? 'gated' : 'ungated'}`}` +
     `${got.length === 0 ? ' (no site found at all)' : ''}`);
}

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
