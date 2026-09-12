// Bands — three surface modes, assigned by ROLE.
//
// The home view rendered seven insight surfaces as the same .card on the same
// --surface with the same hairline, so nothing on it was more important than
// anything else. That flattens the one design decision the screen actually
// has: `getNextStep` returns exactly ONE ranked card, because rule 9 of the
// research base is one cue and never a checklist — and it was drawn in the
// same treatment as the day-streak counter.
//
// Two things here are traps this repository has hit before, and this suite is
// written against them rather than around them:
//
//   1. `:nth-child` alternation. It is the obvious implementation and it is
//      broken here: ViewPrefs hides sections with a class on <html>, and CSS
//      cannot count VISIBLE siblings. So the suite re-renders the view under
//      every ViewPrefs combination and asserts the modes do not move — a
//      positional implementation passes the first render and fails this.
//   2. D3 — the display tier on a figure that has not cleared its floor. The
//      gate is asserted from both ends: a qualifying club must show the hero,
//      a below-floor club must not be able to reach the tier at all.
//
// Contrast is measured here, not assumed. The audited numbers are recomputed
// from the tokens in style.css so the finding cannot quietly stop being true:
// the accent passes on the light-mode inversion (4.80:1) and FAILS on the
// dark-mode one (2.64:1), which is why nothing on the inverted band is
// coloured by a hue.
const R = require('../load.js').load({});
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
if (!R.ok) { console.log('  FAIL  app.js did not load: ' + R.errors.join('; ')); process.exit(1); }
const { Store, UI, Metrics } = R.app;
const doc = R.window.document;
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// Comments first — for the seventh time in this repository, a source scan has
// read its own explanation, and this file's subject matter is one long one.
const strip = t => t.replace(/\/\*[^]*?\*\//g, '')
  .split('\n').map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
const cssCode = strip(css), code = strip(src);

const shot = (o = {}) => ({ clubType: '7i', ballSpeed: 118, clubSpeed: 85, smashFactor: 1.38,
  launchAngle: 17, attackAngle: -3, clubPath: -1, carryDistance: 160, totalDistance: 172, ...o });
const many = (n, o) => Array.from({ length: n }, (_, i) => ({ _row: i + 2, ...shot(o) }));
const sess = (id, date, conditions, shots) => Store.stamp({ id, date, conditions, shots });
const prem = { ball: 'premium', surface: 'grass' };

// A driver at 250 over 30 shots, then a second comparable session, so the row
// is anchored and above the floor of 10.
const FULL = [
  sess('a', '2026-07-08', prem, many(30, { clubType: 'd', carryDistance: 250, ballSpeed: 150, clubSpeed: 105, smashFactor: 1.43 })),
  sess('b', '2026-07-01', prem, many(20, { clubType: 'd', carryDistance: 262, ballSpeed: 152, clubSpeed: 106, smashFactor: 1.43 })),
  sess('c', '2026-06-24', prem, many(20, { clubType: '7i' })),
];

const view = () => doc.getElementById('view-sessions');
const render = list => { UI.renderHome(list); return view(); };
// What a golfer can actually see: in document order, the hosts that carry a
// mode AND have something in them. An empty host paints nothing.
const sequence = () => [...view().querySelectorAll('.band')]
  .filter(el => el.textContent.trim() !== '')
  .map(el => ({ id: el.id, mode: (el.className.match(/band--(\w+)/) || [])[1] }));
// The hosts this view is expected to mode. A new surface has to be added here
// with its reason, which is the point: nothing lands unmoded.
const EXPECTED = ['tipHost', 'metricsWidgetHost', 'syncBanner', 'nextStepHost',
                  'insightsHost', 'alertsHost', 'coachHost', 'dashboard', 'recentWrap'];

console.log('— the ranked card is the signal band, and there is exactly one —');
render(FULL);
const signals = view().querySelectorAll('.band--signal');
ok(signals.length === 1, `exactly one signal band — not "at most one" (${signals.length})`);
ok(signals[0] && signals[0].id === 'nextStepHost', 'and it is the host getNextStep renders into');
ok(!!view().querySelector('.band--signal .next-step'),
   'holding the ranked card itself, not just its host');
// Zero is a bug worth failing on: every branch of getNextStep returns a card,
// including the day-one "nothing imported" branch — that is the whole reason
// the short-game answer is the empty state's answer.
render([]);
ok(view().querySelectorAll('.band--signal').length === 1,
   'still exactly one with no sessions at all — the ranked card never stops rendering');

console.log('— every band declares a mode, and neighbours never share one —');
render(FULL);
const seq = sequence();
ok(seq.length >= 6, `${seq.length} bands on the home view carry content`);
ok(seq.every(b => ['canvas', 'surface', 'signal'].includes(b.mode)),
   'each declares one of the three modes: ' + seq.map(b => b.id + '=' + b.mode).join(', '));
const clashes = [];
for (let i = 1; i < seq.length; i++) if (seq[i].mode === seq[i - 1].mode) clashes.push(seq[i - 1].id + ' / ' + seq[i].id + ' (' + seq[i].mode + ')');
ok(clashes.length === 0, `no two adjacent bands share a mode${clashes.length ? ' — ' + clashes.join(', ') : ''}`);
ok(seq.filter(b => b.mode === 'signal').length === 1, 'and the signal mode appears once in the sequence');
// The tip is the first band and it is the one that has to not be canvas: the
// metrics widget below it is a row of cards and therefore canvas, and two
// canvas bands in a row is the corporate-site rhythm this exists to prevent.
ok(seq[0].id === 'tipHost' && seq[0].mode === 'surface', 'the tip leads as a surface band');

console.log('— the mode does not move with position —');
// The whole reason this is not `:nth-child`. Every combination of the prefs
// that can hide a section, applied the way ViewPrefs applies them: a class on
// <html>. The list is read out of the STYLESHEET — the file where the hiding
// actually happens — rather than typed in here, because a copied list would
// keep passing after a sixth toggle was added.
const prefKeys = [...new Set([...cssCode.matchAll(/html\.(pref-[a-z-]+)/g)].map(m => m[1]))];
ok(prefKeys.length >= 4, `${prefKeys.length} hiding prefs found in style.css: ${prefKeys.join(', ')}`);
const baseline = JSON.stringify(sequence().map(b => b.id + '=' + b.mode));
let combos = 0, moved = 0;
const applyPrefs = mask => prefKeys.forEach((k, i) => doc.documentElement.classList.toggle(k, !!(mask & (1 << i))));
for (let mask = 0; mask < (1 << prefKeys.length); mask++) {
  applyPrefs(mask);
  const now = sequence();
  combos++;
  if (JSON.stringify(now.map(b => b.id + '=' + b.mode)) !== baseline) {
    moved++;
    if (moved === 1) console.log('        ' + JSON.stringify(now.map(b => b.id + '=' + b.mode)));
  }
}
applyPrefs(0);
ok(combos === (1 << prefKeys.length) && moved === 0,
   `${combos} ViewPrefs combinations, no band changed its mode`);
render(FULL);
const after = sequence();
ok(JSON.stringify(after.map(b => b.id + '=' + b.mode)) === baseline, 'and the view is back where it started');
ok(!clashes.length && after.length === seq.length, 'no pref combination leaves two neighbours sharing a mode');

console.log('— an empty host paints no ground —');
render([]);
const emptyBanded = [...view().querySelectorAll('.band')].filter(el => el.textContent.trim() === '');
ok(emptyBanded.length === 0,
   `nothing carries a band with nothing in it${emptyBanded.length ? ' — ' + emptyBanded.map(el => el.id).join(', ') : ''}`);
for (const id of ['metricsWidgetHost', 'insightsHost', 'alertsHost', 'coachHost']) {
  const el = doc.getElementById(id);
  ok(el && !/band--/.test(el.className), `${id} drops its band when it renders nothing`);
}
ok(doc.getElementById('dashboard').hidden === true && doc.getElementById('recentWrap').hidden === true,
   'and the two regions that are hidden rather than empty are hidden');
// This is the state a positional scheme cannot survive: four bands have
// dropped out of the middle of the sequence, so anything counted by position
// has shifted. The remaining bands still have to alternate.
const thin = sequence();
const thinClash = [];
for (let i = 1; i < thin.length; i++) if (thin[i].mode === thin[i - 1].mode) thinClash.push(thin[i].id);
ok(thinClash.length === 0,
   `and with four bands missing the survivors still alternate: ${thin.map(b => b.id + '=' + b.mode).join(', ')}`);

console.log('— the surfaces that carry a mode are the surfaces that were assigned one —');
render(FULL);
const banded = [...view().querySelectorAll('[class*="band--"]')].map(el => el.id);
ok(banded.every(id => EXPECTED.includes(id)),
   'no unexpected host took a mode: ' + banded.filter(id => !EXPECTED.includes(id)).join(', ') || 'none');
const withContent = sequence().map(b => b.id);
ok(withContent.every(id => EXPECTED.includes(id)),
   `every banded surface is one of the ${EXPECTED.length} named: ${withContent.join(', ')}`);
// The anchored quick-stat row is exempt BY NAME, so it is listed here with the
// reason rather than quietly missing from the list above.
const qsHost = doc.getElementById('quickStatsHost');
ok(qsHost && !/band--/.test(qsHost.className),
   'the anchored quick-stat row takes no mode class — it is already a band (below)');

console.log('— :nth-child, and the reason it is not used —');
const bandSection = cssCode.slice(cssCode.indexOf('.band {'), cssCode.indexOf('iOS: never let a focusable'));
ok(bandSection.length > 500, 'the band CSS section is present and locatable');
ok(!/nth-(child|of-type)\s*\(/.test(bandSection),
   'no positional selector in the band block — CSS cannot count visible siblings');
// The hidden trap: #dashboard and #syncBanner are toggled with the `hidden`
// attribute, and an author `display` on the band would beat the UA sheet's
// [hidden] rule, leaving both permanently visible with no error anywhere.
ok(!/display\s*:/.test(bandSection),
   'the band block sets no display — [hidden] has to keep working on #syncBanner');
const banner = doc.getElementById('syncBanner');
ok(banner && banner.hidden === true && !/band--/.test(banner.className),
   'a guest with nothing wrong shows no sync banner and no band to go with it');

console.log('— D3: the display tier is only on a figure that cleared its floor —');
render(FULL);
const heroCount = view().querySelectorAll('.stat-hero').length;
ok(heroCount === 1, `one hero numeral on the home view (${heroCount})`);
const hero = view().querySelector('.stat-hero');
ok(!!hero && !!hero.closest('#quickStatsHost'), 'and it is the anchored row');
const cells = [...view().querySelectorAll('#quickStatsHost .quick-stat')].map(el =>
  (el.querySelector('.quick-stat-label') || {}).textContent);
const heroCell = hero && cells.indexOf((hero.closest('.quick-stat').querySelector('.quick-stat-label') || {}).textContent);
ok(heroCell === 0, `on Form, the app's own measured composite — not on ${cells.filter((c, i) => i && i !== heroCell).join('/')}`);
// The two cells that must never take it, pinned by name so a later edit that
// moves the tier onto one of them fails here rather than in a design review.
ok(!/stat-hero/.test(
     [...view().querySelectorAll('#quickStatsHost .quick-stat')][2].innerHTML),
   'the Carry cell is at label weight — a modelled carry is banned from the tier outright');
ok(!/stat-hero/.test(
     [...view().querySelectorAll('#quickStatsHost .quick-stat')][1].innerHTML),
   'and so is Best — an extreme value is the reading most likely to be a misread');
const row = doc.getElementById('quickStatsLabel').textContent;
ok(/Driver/.test(row), 'and the row still names the club it is about: ' + row);
// The real defect this gate exists for: a club under the floor must not be
// able to reach the tier, even when it has a perfectly good interval to print
// — so the six shots below VARY, and `Metrics.interval` would happily return a
// mean and a CI for them if a weakened gate ever let them through.
render([sess('d', '2026-07-08', prem,
  many(6, { clubType: 'd' }).map((s, i) => ({ ...s, carryDistance: 240 + i * 8 })))]);
ok(view().querySelectorAll('.stat-hero').length === 0,
   `a club under the floor of ${Metrics.MIN_SHOTS_REPORT} puts no figure in the display tier`);
ok(/No club has/.test(doc.getElementById('quickStatsHost').textContent),
   'and the row says what it is waiting for instead of showing a number');
// And the source end of the same gate. `display-tier.js` (the sibling task's
// suite, which scans this file at merge) accepts a site dominated by a
// floor-met guard in four shapes; this one is covered twice over — a preceding
// `if (…) return;` bail-out AND a ternary guarded on the floor itself.
const heroSite = code.slice(code.indexOf('const heroForm ='), code.indexOf('const heroForm =') + 500);
ok(/stat-hero/.test(heroSite) && /Metrics\.MIN_SHOTS_REPORT/.test(heroSite),
   'the call site states the floor in the expression that emits the class');
ok(/scores\.length/.test(heroSite),
   'and refuses the 0 that is not a measurement when nothing in the window scored');
// The bail-out branch itself, from its condition to the return that ends it.
const bail = code.indexOf('if (!club || n < Metrics.MIN_SHOTS_REPORT) {');
const noClubBranch = code.slice(bail, code.indexOf('return;', bail));
ok(bail > 0 && noClubBranch.length > 200 && !/stat-hero/.test(noClubBranch),
   'and the below-floor branch cannot reach the tier at all');

console.log('— the inverted band carries no hue, because it cannot —');
// WCAG relative luminance, from the tokens actually declared in style.css.
const block = (sel) => {
  const at = cssCode.indexOf(sel);
  const open = cssCode.indexOf('{', at), close = cssCode.indexOf('}', open);
  return cssCode.slice(open, close);
};
const lum = hex => {
  const c = hex.replace('#', '');
  const v = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const token = (sel, name) => {
  const m = block(sel).match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
  return m ? m[1] : null;
};
const ratio = (a, b) => { const l = [lum(a), lum(b)].sort((x, y) => y - x); return (l[0] + 0.05) / (l[1] + 0.05); };
const r2 = n => Math.round(n * 100) / 100;
const themes = { light: ':root {', dark: 'html.dark {' };
for (const [name, sel] of Object.entries(themes)) {
  const bg = token(sel, 'bg'), text = token(sel, 'text'), accent = token(sel, 'accent');
  const inv = ratio(bg, text);           // --bg type on --text ground
  ok(inv >= 4.5, `${name}: --bg type on --text ground is ${r2(inv)}:1 (AA body needs 4.5)`);
  const acc = ratio(accent, text);       // --accent pushed as type onto that ground
  if (name === 'light') {
    ok(acc >= 4.5, `${name}: --accent on the inverted ground is ${r2(acc)}:1 — it would have passed alone`);
  } else {
    // The finding, pinned. If this ever stops failing the comment in style.css
    // is out of date, not the code — the dark accent is tuned for a dark
    // ground and the dark inversion is a light one.
    ok(acc < 4.5, `${name}: --accent on the inverted ground is ${r2(acc)}:1 — below AA, and below the`);
    ok(acc < 3, `  3:1 a 4px rule would need, which is why the band carries no accent at all`);
  }
}
// Enforced from the other end too: every rule the band owns declares --bg and
// nothing else. A rule added later that reaches for a hue fails here.
const signalRules = [...bandSection.matchAll(/\.band--signal[^{]*\{[^}]*\}/g)].map(m => m[0]).join('\n');
const colourLines = signalRules.split('\n').filter(l => /color\s*:/.test(l));
const offHue = colourLines.filter(l => !/var\(--bg\)/.test(l));
ok(colourLines.length >= 4 && offHue.length === 0,
   `all ${colourLines.length} colour declarations under .band--signal resolve to --bg` +
   (offHue.length ? ' — these do not: ' + offHue.join(' | ') : ''));
ok(/\.band--signal \.next-why[^{]*\{[^}]*color:\s*var\(--bg\)/.test(signalRules),
   'including the "why" line — at --text-muted it is 2.17:1 in dark mode, the worst pair in the card');

console.log('— the exemption is earned, not asserted into existence —');
// The quick-stat row is a band by construction. If any of the three things
// that make it one is stripped, the exemption above is stale and this fails.
const qsRule = cssCode.slice(cssCode.indexOf('.quick-stats {'));
ok(/background:\s*var\(--surface\)/.test(qsRule.slice(0, 400)), 'it still owns an opaque --surface ground');
ok(/border-top:\s*1px solid var\(--line\)/.test(qsRule.slice(0, 400)) &&
   /border-bottom:\s*1px solid var\(--line\)/.test(qsRule.slice(0, 400)), 'and a hairline top and bottom');
ok(/position:\s*sticky/.test(qsRule.slice(0, 400)), 'and it is still the sticky strip');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
