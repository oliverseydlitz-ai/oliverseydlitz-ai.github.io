const fs = require('fs');
const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c?'  PASS  ':'  FAIL  ')+m); if(!c) fail++; };
const root = path.join(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

// CLAUDE.md's workflow says to "confirm index.html IDs referenced by JS exist"
// before every push. That was a manual step, which means it was never run —
// the same shape as every other rule in here that nothing executes.
//
// A missing id is not an error at runtime. `getElementById` returns null, the
// `if (!el) return` guard above it fires, and the feature is simply absent:
// no console error, no failing test, nothing on screen. That is exactly how
// `Router.showPractice` rendered nothing for as long as it did.
const referenced = new Set([
  ...[...app.matchAll(/getElementById\(['"]([\w-]+)['"]\)/g)].map(m => m[1]),
  ...[...app.matchAll(/querySelector\(['"]#([\w-]+)['"]\)/g)].map(m => m[1]),
]);
const inHtml = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
// Created at runtime, two ways: written into an innerHTML template, or
// assigned onto a fresh element (`el.id = 'toast'`). Both are legitimate and
// both were invisible to the first version of this check.
const madeInMarkup = new Set([...app.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
const madeByAssign = new Set([...app.matchAll(/\.id\s*=\s*['"]([\w-]+)['"]/g)].map(m => m[1]));

console.log('— every id the JS reaches for exists somewhere —');
ok(referenced.size > 150, `${referenced.size} ids referenced from app.js`);
const missing = [...referenced].filter(id =>
  !inHtml.has(id) && !madeInMarkup.has(id) && !madeByAssign.has(id)).sort();
ok(missing.length === 0,
   `all of them resolve${missing.length ? ` — these do not: ${missing.join(', ')}` : ''}`);

console.log('— and every id the markup declares is accounted for —');
// The other direction is weaker and has to be, because an id can be reached
// without appearing as a literal: `PREF_BUTTONS` maps them as bare object keys
// and builds `id + 'Toggle'` at the call site. So this asks only whether the
// id appears in app.js at all, and everything that legitimately does not is
// named here with its reason. A NEW name in this list is the signal — either a
// host nothing writes to, or a section nothing renders.
const MARKUP_ONLY = {
  appMain:        'layout wrapper, styled by id in CSS',
  bottomNav:      'layout wrapper, styled by id in CSS',
  detailSubnav:   'layout wrapper for the session-detail sub-navigation',
  fabImport:      'routes via its data-route attribute, not by id',
  conditionsHint: 'static copy under the import form',
  secDrills:      'section wrapper; the content host inside it is what app.js writes',
  secQuietEye:    'the same',
  secRounds:      'the same',
  secShortGame:   'the same',
  prefHeatmapToggle:    'built as `id + "Toggle"` in PREF_BUTTONS',
  prefFaultsToggle:     'the same',
  prefClubBreakToggle:  'the same',
  prefComparisonToggle: 'the same',
  prefDensityToggle:    'the same',
  topNav:         'layout wrapper, styled by id in CSS',
  secStrike:      'section wrapper; the content host inside it is what app.js writes',
  'step-saving':  'import-flow step, shown by `step-` + name',
  'view-sessions':       'routed view, shown by `view-` + name',
  'view-import':         'the same',
  'view-progress':       'the same',
  'view-practice':       'the same',
  'view-drills':         'the same — the drill library split out of Practice into its own view',
  // 'view-yardages' is deliberately NOT here: the print stylesheet targets it
  // by id, so it is explained by CSS rather than by an exemption. If that rule
  // is ever removed, this suite will flag it as unexplained again — which is
  // the behaviour we want, and why the stale-exemption check exists.
  'view-settings':       'the same',
  'view-session-detail': 'the same',
};
const mentioned = new RegExp('\\b(' + [...inHtml].map(i2 =>
  i2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');
const inApp = new Set([...app.matchAll(mentioned)].map(m => m[1]));
const STYLED_ONLY = new Set([...css.matchAll(/#([\w-]+)\s*[{,:]/g)].map(m => m[1]));
const orphans = [...inHtml].filter(id =>
  !referenced.has(id) && !inApp.has(id) && !STYLED_ONLY.has(id) &&
  !html.includes(`for="${id}"`) &&
  !html.includes(`href="#${id}"`) &&
  !html.includes(`aria-labelledby="${id}"`) &&
  !html.includes(`aria-describedby="${id}"`) &&
  !html.includes(`data-target="${id}"`)
).sort();
const unexplained = orphans.filter(id => !MARKUP_ONLY[id]);
ok(unexplained.length === 0,
   `every markup-only id is accounted for${unexplained.length ? ` — these are not: ${unexplained.join(', ')}` : ''}`);
const stale = Object.keys(MARKUP_ONLY).filter(id => !orphans.includes(id));
ok(stale.length === 0,
   `and the exemption list has nothing stale in it${stale.length ? `: ${stale.join(', ')}` : ''}`);

console.log('— the hosts added during this pass are all wired —');
// Each of these was added with a render path in the same commit. If one loses
// its writer, the section silently disappears rather than erroring.
for (const id of ['yardageConditions','yardageLegend','gapNote','benchNote','quickStatsLabel',
                  'nextStepHost','insightsHost','alertsHost','coachHost','practiceGrid','drillHost']) {
  ok(inHtml.has(id) || madeInMarkup.has(id), `${id} exists in the markup`);
  ok(referenced.has(id), `${id} is written to by app.js`);
}

console.log(fail?`\n${fail} FAILED`:'\nall passed');
process.exit(fail?1:0);
