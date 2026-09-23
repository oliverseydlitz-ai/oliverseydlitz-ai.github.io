// ── A rule redeclared below itself, with a different value ──────────────
//
// THE DEFECT: `.drill-card` was declared twice, ~1,500 lines apart, and the
// later rule won every property both of them set. What a fault card actually
// rendered was the OTHER component — a pointer cursor on something that is
// not tappable, an accent left rule it never asked for, and a margin stacked
// on top of a flex gap. Nothing errored. Every suite was green. The inset
// styling had been unreachable for the whole life of the redesign.
//
// It is not the first: `.session-card` was redeclared 1,900 lines below its
// own definition with a different shadow and a retired red, and DESIGN.md's
// generator carries a note that `.view-title` is declared twice 1,400 lines
// apart — documenting the first would describe a rule the browser never
// applies. This is a defect CLASS in this stylesheet, not three accidents.
//
// WHY IT SURVIVES REVIEW. A later override is legitimate CSS and often
// intentional: a `@media` block, a `:hover`, a theme. What is NOT legitimate
// is a second copy of a rule in the same base cascade setting the same
// property to a DIFFERENT value, because then the first copy is dead text
// that reads like live styling. Whoever edits it changes nothing and cannot
// tell why.
//
// WHAT THIS SUITE IS. Not a ban — there are still 13, and ripping them out
// blind is how a redesign regresses. It is a RATCHET, the same shape as
// dom-ids.js's markup-only list: every survivor is named with the properties
// it clashes on, so a NEW one fails, and a FIXED one also fails until it is
// struck off. The list cannot rot in either direction.
//
// Scope: the base cascade only. `@media`, `@supports`, `@keyframes` and
// `@font-face` are lifted out before the scan, because an override inside one
// is the mechanism rather than a defect — `from`/`to` in two keyframes are
// not a redeclaration, and a `min-width` step-up is the whole point of
// mobile-first. Comments are stripped with LINE COUNTS KEPT, because this
// suite reports line numbers and a report that names the wrong line is worse
// than one that names none.
const fs = require('fs');
const path = require('path');
let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');

const raw = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const css = raw.replace(/\/\*[^]*?\*\//g, m => m.split('\n').map((_, i) => (i ? '\n' : ' ')).join(''));

// Blank out every at-rule body, preserving newlines so line numbers hold.
let flat = '', i = 0;
while (i < css.length) {
  const m = css.slice(i).match(/@(media|supports|keyframes|font-face)[^{]*\{/);
  if (!m) { flat += css.slice(i); break; }
  flat += css.slice(i, i + m.index);
  let j = i + m.index + m[0].length, depth = 1;
  while (j < css.length && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
  flat += css.slice(i + m.index, j).replace(/[^\n]/g, ' ');
  i = j;
}

const declarations = body => {
  const out = {};
  for (const chunk of body.split(';')) {
    const k = chunk.indexOf(':');
    if (k < 0) continue;
    const prop = chunk.slice(0, k).trim();
    // A custom property may legitimately be redeclared per theme — that IS
    // the theming mechanism, and :root / html.dark are supposed to disagree.
    if (!/^[a-z-]+$/.test(prop) || prop.startsWith('--')) continue;
    out[prop] = chunk.slice(k + 1).trim().replace(/\s+/g, ' ');
  }
  return out;
};

const bySelector = new Map();
for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const line = flat.slice(0, m.index).split('\n').length;
  for (const sel of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
    if (!bySelector.has(sel)) bySelector.set(sel, []);
    bySelector.get(sel).push({ decls: declarations(m[2]), line });
  }
}

const clashes = new Map();
for (const [sel, rules] of bySelector) {
  if (rules.length < 2) continue;
  const props = new Set(), lines = rules.map(r => r.line);
  for (let a = 0; a < rules.length; a++)
    for (let b = a + 1; b < rules.length; b++)
      for (const p in rules[a].decls)
        if (p in rules[b].decls && rules[a].decls[p] !== rules[b].decls[p]) props.add(p);
  if (props.size) clashes.set(sel, { props: [...props].sort(), lines });
}

console.log('— every silent override is one of the known ones —');

// The survivors, each named with what it clashes on and why it is still here.
// Struck off as they are fixed; the assertions below fail if this list and
// the stylesheet stop agreeing, in EITHER direction.
const KNOWN = {
  '.btn-secondary':       'min-height',
  '.btn-danger':          'min-height',
  '.session-card':        'display, gap, transition',
  '.form-group select':   'font-size, transition',
  '.select':              'font-size, transition',
  '.score-banner-content': 'background, padding',
  '.metric-card':         'padding, transition',
  '.metric-label':        'font-size, font-weight, letter-spacing',
  '.chip':                'font-size, font-weight',
  '.record-label':        'color, font-size, margin-top',
  '.ach-strip':           'transition',
  '.search-bar':          'transition',
  '.goal-item':           'transition',
};
// They are all one thing: a late "editorial enhancement layer" that was
// appended to the sheet rather than merged into it, and reaches back over the
// base rules with !important. The type-only half of it (font-size,
// font-family, font-weight, letter-spacing) was folded into the base rules by
// the tracking work — 36 selectors down to these 13. What is left clashes on
// LAYOUT and MOTION (padding, display, gap, transition, min-height), where
// merging is a visual decision per component and not a mechanical one. That
// is the remainder of the drift sweep, and it is a task, not a cleanup.

const novel = [...clashes].filter(([sel]) => !(sel in KNOWN));
ok(novel.length === 0,
   `no selector is newly overridden by a later copy of itself${
     novel.length ? ` — these are: ${novel.map(([s, c]) => `${s} [${c.props.join(', ')}] at lines ${c.lines.join(', ')}`).join('; ')}` : ''}`);

const stale = Object.keys(KNOWN).filter(sel => !clashes.has(sel));
ok(stale.length === 0,
   `and the known list names no selector that is already fixed${
     stale.length ? ` — strike these off: ${stale.join(', ')}` : ` (${Object.keys(KNOWN).length} left)`}`);

// A selector still on the list but clashing on DIFFERENT properties is a new
// defect wearing an old name, which a bare "is it in the list" check reads as
// fine. So the properties are pinned too.
const shifted = [...clashes]
  .filter(([sel, c]) => sel in KNOWN && c.props.join(', ') !== KNOWN[sel])
  .map(([sel, c]) => `${sel}: list says "${KNOWN[sel]}", sheet says "${c.props.join(', ')}"`);
ok(shifted.length === 0,
   `and each one still clashes on exactly the properties recorded${shifted.length ? ` — ${shifted.join('; ')}` : ''}`);

console.log('— and the scan can still see one —');
// THE POSITIVE CONTROL. "0 novel clashes" and "the parser stopped matching"
// print identically, and this repository has shipped the second as the first:
// render-scan.js reported clean for most of a session because its exit code
// was 0 by construction. The control is the real defect — `.drill-card`
// declared twice with a different background — run through the same reader.
const CONTROL = '.ctl { background: var(--surface2); padding: 4px; }\n.ctl { background: var(--surface); }';
const ctlRules = [];
for (const m of CONTROL.matchAll(/([^{}]+)\{([^{}]*)\}/g))
  ctlRules.push(declarations(m[2]));
const ctlClash = Object.keys(ctlRules[0]).filter(p => p in ctlRules[1] && ctlRules[0][p] !== ctlRules[1][p]);
ok(ctlClash.length === 1 && ctlClash[0] === 'background',
   `a selector declared twice with a different background reads as one clash (found ${ctlClash.length})`);

// And the at-rule lift must not eat the base cascade with it — if it did,
// every assertion above would pass on an empty sheet.
ok(/\.session-card/.test(flat) && bySelector.size > 300,
   `and lifting the at-rules out left the base cascade intact (${bySelector.size} selectors)`);


console.log('— and no @media declaration is killed by a base rule below it —');
// THE OTHER DIRECTION, and the scan above cannot see it because it lifts every
// @media block out first. A media query does not raise specificity: a rule
// inside `@media (max-width: 767px)` and a base rule for the same selector tie,
// and the LATER one wins. So a phone override written above the base rule it
// means to override is dead at every width.
//
// Found on 22 Sep 2026 on a phone, not by any suite: the sticky header's
// mobile `padding-inline: 1rem` sat above `.view-header { padding: .25rem 0 }`,
// the shorthand reset it, the header's -1rem margin survived, and every view
// title on every phone sat flush against the screen edge at x=0 while the cards
// below it sat at 16px. The same scan found a desktop `.score-ring svg` size
// that had never applied, beaten twice over by later !important rules.
//
// Shorthands count — `padding` kills `padding-inline` — because that is the
// exact shape of the defect that shipped. An !important inside the media block
// survives a plain later declaration, so it is not reported.
const SHORTHANDS = ['padding', 'margin', 'border', 'background', 'font', 'inset', 'grid',
  'flex', 'overflow', 'transition', 'animation', 'gap', 'outline', 'list-style', 'text-decoration'];
const covers = (bp, mp) => bp === mp || (mp.startsWith(bp + '-') && SHORTHANDS.includes(bp));
function deadMedia(text) {
  const all = [];
  (function walk(from, to, ctx) {
    let k = from;
    while (k < to) {
      const open = text.indexOf('{', k); if (open < 0 || open >= to) break;
      const head = text.slice(k, open).trim();
      let j = open + 1, depth = 1;
      while (j < to && depth > 0) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      if (head.startsWith('@media')) { if (!/print/.test(head)) walk(open + 1, j - 1, head); }
      else if (!head.startsWith('@')) all.push({ sels: head.split(',').map(x => x.trim()).filter(Boolean), body: text.slice(open + 1, j - 1), at: open, ctx });
      k = j;
    }
  })(0, text.length, null);
  const out = [];
  const lineAt = at => text.slice(0, at).split('\n').length;
  for (const m of all.filter(r => r.ctx)) {
    const md = declarations(m.body);
    for (const sel of m.sels)
      for (const b of all.filter(r => !r.ctx && r.at > m.at && r.sels.includes(sel))) {
        const bd = declarations(b.body);
        for (const mp in md) {
          if (/!important/.test(md[mp])) continue;
          const hit = Object.keys(bd).find(bp => covers(bp, mp));
          if (hit) out.push(`${sel} ${mp} (@media, line ${lineAt(m.at)}) killed by \`${hit}\` at line ${lineAt(b.at)}`);
        }
      }
  }
  return out;
}
const dead = deadMedia(css);
ok(dead.length === 0,
   `no media-query declaration is overridden by a later base rule${dead.length ? ` — ${dead.join('; ')}` : ''}`);
// Positive control: the real defect, verbatim in shape.
const DEAD_CTL = '@media (max-width: 767px) { .h { margin-inline: -1rem; padding-inline: 1rem; } }\n.h { display: flex; padding: .25rem 0; }';
const ctl = deadMedia(DEAD_CTL);
ok(ctl.length === 1 && /padding-inline/.test(ctl[0]),
   `the shipped defect's shape — a phone padding-inline under a later padding shorthand — is found (${ctl.length})`);

console.log('— and no @keyframes name is declared twice —');
// V36. `@keyframes slideUp` was declared twice, 110 lines apart, and the later
// one (the cookie banner's: translateY(100%), opacity 0) won the name for
// every element using it — plan cards and the stats strip entered from below
// their own box and invisible. The scan above lifts @keyframes out, so it
// could never see this. Unlike a selector, a keyframe name is not merged:
// the last one wins whole.
const dupKeyframes = text => {
  const seen = new Map(), dups = [];
  for (const m of text.matchAll(/@keyframes\s+([\w-]+)/g)) {
    const line = text.slice(0, m.index).split('\n').length;
    if (seen.has(m[1])) dups.push(`${m[1]} at lines ${seen.get(m[1])} and ${line}`); else seen.set(m[1], line);
  }
  return dups;
};
const kd = dupKeyframes(css);
ok(kd.length === 0, `every @keyframes name is declared once${kd.length ? ' — ' + kd.join('; ') : ''}`);
ok(dupKeyframes('@keyframes a { from{} }\n@keyframes b {}\n@keyframes a { to{} }').length === 1,
   'and the shipped shape — one name declared twice — is found');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
module.exports = { fail };
