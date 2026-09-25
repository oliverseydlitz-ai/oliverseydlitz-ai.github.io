// ── V41, V46, V47, V48, V49 — a source-level sweep, the same technique
// class-is-wired.js and cascade-overrides.js use: read the real files and
// assert what they say, rather than a rendered snapshot that a later edit
// can silently drift from.
//
// V41: Settings sections were built two ways (a .settings-section wrapper for
// most, a bare h2 + unstyled .settings-group for two of them), and there were
// two toggle idioms (the dark-mode knob switch vs a bare "✓" character in
// .pref-toggle). Data & Export mixed data actions with five report launchers
// — 13 rows with nothing in common but living in the same list.
// V46: the printed yardage card's "Personal Bests" heading printed with its
// grid hidden underneath it (an orphan heading), and the same "Sessions: …"
// caveat printed up to three times (the print-only card's own copy, plus two
// screen-only notes the print stylesheet never hid).
// V47: a section title with a subtitle (.section-title's `display:flex`
// makes the title and its .section-sub two flex items) split into two
// cramped columns at phone width instead of wrapping as one line of text.
// V48: the range card's close button and progress dots were circles in a
// stylesheet with zero border-radius everywhere else, and the app had three
// different close-button visual styles (.btn-icon, the range card's own
// .rc-x, and FirstRun's totally unstyled .modal-close).
// V49: the Data & Rights modal used the sessions-list icon (three
// horizontal lines — reads as a hamburger menu) for "data", and double-padded
// its body inside the modal's own padding. Every achievement definition
// hardcoded icon:'star', so all ten looked identical once unlocked. The
// achievements modal's "3 of 10 unlocked" line sat inline after the heading
// and could break onto its own line as an orphan "unlocked".
const fs = require('fs'), path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const flatCss = css.replace(/\s+/g, '');

const settingsStart = html.indexOf('id="view-settings"');
const settingsEnd = html.indexOf('</section>', settingsStart);
const settings = html.slice(settingsStart, settingsEnd);

console.log('— V41: one section shape, one switch, launchers split out —');
ok(!/settings-group/.test(settings), 'no .settings-group wrapper left — every section uses the same .settings-section shell');
{
  const titles = (settings.match(/settings-section-title/g) || []).length;
  const sections = (settings.match(/class="settings-section"/g) || []).length;
  ok(titles > 0 && titles === sections, `every settings-section-title (${titles}) sits inside its own settings-section (${sections})`);
}
ok(!/pref-toggle/.test(html) && !/\.pref-toggle\s*\{/.test(css), 'the checkmark toggle (.pref-toggle) is gone — nothing on/off screen renders it any more');
ok(/class="switch" id="prefHeatmapToggle"/.test(settings) && /class="switch" id="keepLocalToggle"/.test(settings)
   && /class="switch" id="themeSwitch"/.test(settings),
   'View Preferences, "keep on this device" and Dark mode all use the same .switch component');
{
  const dataExport = settings.slice(settings.indexOf('Data & Export'), settings.indexOf('>Reports<'));
  ok(!/showAnalyticsBtn|showBenchmarksBtn|showLearningBtn|showClubAnalysisBtn|showEfficiencyBtn/.test(dataExport),
     'the five report launchers are no longer mixed into Data & Export');
}
ok(/id="showAnalyticsBtn"/.test(settings) && />Reports</.test(settings), 'and now live in their own Reports section');

console.log('— V46: the printed card doesn\'t orphan a heading or repeat its caveats —');
ok(/class="section-block mt-6 no-print"[\s\S]{0,120}Personal Bests/.test(html),
   'the Personal Bests section-block itself is hidden on print, not just its (already-hidden) grid');
ok(/#yardageConditions,\s*#yardageLegend/.test(css),
   '#yardageConditions and #yardageLegend — which duplicate or shadow the print-only caveat — are hidden on print too');

console.log('— V47: a title with a subtitle stacks at phone width —');
ok(/max-width:\s*480px[\s\S]{0,200}\.section-title:has\(\.section-sub\)\s*\{[^}]*flex-direction:\s*column/.test(css),
   'a .section-title that has a .section-sub stacks under 480px instead of laying the two out as flex columns');

console.log('— V48: no circle survives in the zero-radius system, and one close-button style —');
ok(!/\.rc-x\{[^}]*border-radius/.test(flatCss), '.rc-x itself carries no radius any more (it is styled by .btn-icon in the markup)');
ok((js.match(/class="btn-icon rc-x"/g) || []).length === 2, 'both range-card close buttons (mid-session and the end screen) use the system .btn-icon');
{
  const dotRule = (css.match(/\.rc-dot\{[^}]*\}/) || [''])[0];
  ok(!/border-radius:\s*50%/.test(dotRule), 'the progress-dot BUTTON carries no circle radius of its own');
}
ok(/\.rc-dot\{[^}]*width:\s*24px[^}]*height:\s*24px/.test(flatCss), 'and it is a 24px tap target (the visible mark is drawn smaller, on ::after)');
ok(!/class="modal-close"/.test(js), 'the third, unstyled close-button class is gone — FirstRun uses .btn-icon like every other dialog');

console.log('— V49: Data & Rights modal and Achievements polish —');
ok(/icon\('lock'\)\}\s*Your Data &amp; Rights/.test(js),
   'the Data & Rights modal icon is a lock, not the sessions-list icon (which reads as a hamburger menu)');
ok(!/padding:1\.2rem;color:var\(--text\)/.test(js), 'its body no longer re-pads inside the modal\'s own padding (the "double inset")');
{
  const iconMatches = [...js.matchAll(/id:'(first|dozen|century|grand|bag|streak3|streak7|smash|bomb|speed)',\s*icon:'(\w+)'/g)];
  ok(iconMatches.length === 10, `all ten achievement definitions found (${iconMatches.length})`);
  const icons = new Set(iconMatches.map(m => m[2]));
  ok(icons.size === 10, `each achievement carries its own icon — not icon:'star' on all ten (${icons.size} distinct: ${[...icons].join(', ')})`);
}
ok(/\.ach-head-count\s*\{[^}]*display:\s*block/.test(css),
   '"X of Y unlocked" renders on its own line under the heading, so it cannot break off as an orphan word');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exitCode = fail ? 1 : 0;
