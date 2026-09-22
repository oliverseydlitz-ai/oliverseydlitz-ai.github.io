# QC agent briefs — to relaunch the Phase 7 audit

These are the three briefs the 22 Sep 2026 QC agents ran on. The ground rules,
which were identical across all three, are written once below; each lens section
is as briefed. **On a rerun, add this to each brief:** "Read Phase 7 of
`docs/superpowers/plans/2026-09-22-killer-plan.md` first. Do NOT re-report its
findings. Audit ONLY the items under NOT YET COVERED for your lens."

Also **fix R17 first**: `test/browser/sync.sh` must copy every asset in `sw.js`'s
ASSETS list (favicon, manifest, icons, 404.html). Otherwise the service worker
fails to install in the mirror and the robustness lens cannot test offline.

## Shared ground rules (paste into every brief)

- **READ-ONLY on the repo.** Do not edit, create or delete anything under the
  repo. Do not run `git` write commands or `test/browser/sync.sh`. Write scripts,
  screenshots and notes only in your own scratch dir: `<session scratchpad>/qc-<lens>/`.
- The app is served at **http://127.0.0.1:8766/index.html**, a synced mirror of
  the repo. The coordinator runs `bash test/browser/sync.sh` and serves
  `test/browser/site/` there before launching you. Don't start another server on
  that port; for a second origin, copy the site into your own dir and serve it
  on 8790.
- Do not touch the live site or the live Supabase project. Block non-local
  requests:
  `await ctx.route('**', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());`
- Playwright: `const { chromium } = require('playwright-core')`, launched with
  `executablePath: '/opt/pw-browsers/chromium', args:['--no-sandbox']`. Run
  scripts with `NODE_PATH=<repo>/node_modules node script.js`. The coordinator
  runs `npm i --no-save playwright-core` first.
- Past the first-run gates:
  ```js
  await p.goto('http://127.0.0.1:8766/index.html',{waitUntil:'load'}); await p.waitForTimeout(700);
  await p.check('#agreementCheckbox'); await p.check('#agreementRiskCheckbox'); await p.click('#agreementAcceptBtn'); await p.waitForTimeout(300);
  await p.click('#cookieAcceptBtn').catch(()=>{});
  await p.click('#authGuestBtn'); await p.waitForTimeout(400);
  await p.click('#firstRunModal [data-fr="close"]').catch(()=>{}); await p.waitForTimeout(300);
  ```
- Importing (fixtures in `<repo>/test/browser/fixtures/`: session.csv,
  realistic.csv, bank.csv; you may craft more CSVs in your own dir using
  realistic.csv's header row):
  ```js
  await p.click('.bottom-nav-item[data-view="import"]'); await p.waitForTimeout(300);  // desktop: location.hash='#import'
  await p.setInputFiles('#fileInput', '<path>.csv'); await p.waitForTimeout(800);
  await p.click('#previewNext'); await p.waitForTimeout(300);
  await p.selectOption('#metaBall', 'premium');   // or 'range', 'rpt' — read the options
  await p.click('#saveSession'); await p.waitForTimeout(1500);
  ```
  Views: `sessions`, `yardages`, `progress`, `practice`, `drills`, `settings`, reached
  via `.bottom-nav-item[data-view="…"]`. Dark mode:
  `document.documentElement.classList.add('dark')`. App modules (`Store`, `Router`,
  `Metrics`, `FaultEngine`, …) are reachable in page context, and in Node through
  `<repo>/test/load.js`.
- **Read `CLAUDE.md` and the killer plan before auditing.** Do not re-report
  what the plan lists; tag new evidence for a listed item "EXTENDS <item>".
- **Evidence standard:** every finding is reproduced — a screenshot path, a
  measurement, quoted rendered text plus the input that produced it, and
  file:line where possible. No speculation; mark confidence.
- **Deliverable:** your top 20–25 findings, ranked, each with ID, severity,
  where, what's wrong, evidence, proposed fix, effort (S/M/L), and plan tag.
  End with a section headed NOT YET COVERED. No preamble.

## Lens V — visual design and UX (IDs V1…)

Walk every view at **393×852 and 1440×900**, in **light and dark**, with data:
session.csv and realistic.csv as premium, then session.csv again as range. Also
cover the empty state, every modal (the import steps, settings sub-screens,
first-run, the range card from Practice, the drill library tabs, the session
detail tabs), and interaction states (hover, focus, active, disabled).

Look for:
- Visual hierarchy: what the eye hits first versus what matters.
- Inconsistent spacing, alignment or type size between similar components.
- Awkward wrapping, orphaned words, truncation, cramped or wasted space.
- Components that look broken or unfinished; inconsistent buttons; icons that
  don't match their meaning.
- Charts unreadable at phone width; desktop layouts that are just a stretched
  phone layout; problems that appear in only one theme.
- Empty states that look like errors.

Respect the design system's deliberate choices: no emoji, no decorative
background, zero third-party requests, chamfered buttons, zero radius, Archivo,
the "Range" palette, and one ranked signal card. Recommending we break one of
those is not a finding.

**Also deliver:** the 3 changes that would most improve how the app looks.

## Lens C — correctness, data honesty and content (IDs C1…)

The measurement rules in CLAUDE.md are the spec: "Measurement honesty", "Claims
the app must never make (§9)", the tiers, the floors, `Conditions`, "Never pool
across the bag", and "Where numbers come from".

1. **Numbers that disagree.** The same quantity on two surfaces with different
   values or definitions: carry, consistency, form/grade, counts, streaks,
   dates. Cross-check home, detail, yardages, progress and practice.
2. **Rule violations in rendered text:**
   - a face angle stated;
   - spin prescribed, or shown without an RPT ball;
   - carry presented as measured;
   - a club mean under 10 shots;
   - a dispersion or gapping conclusion off range balls;
   - pooling across clubs or conditions;
   - a strokes figure anywhere outside Dispersion;
   - a trend claimed without `changeIsReal`;
   - any number or claim with no source (grep string literals).
3. **Edge cases** — craft CSVs: 3 shots; exactly 9, 10, 15 and 30 shots of one
   club; junk, blank or zero rows; extreme values; a non-Rapsodo file; an empty
   file; a header-only file; about 500 shots. Check for no NaN, undefined,
   Infinity, null or negative counts, that floors hold exactly at the boundary,
   and that refusals are explained.
4. **Copy.** Typos, grammar, contradictions, unexplained jargon, caveats long
   enough to bury the answer (quote them with word counts), placeholders, and
   references to features that no longer exist.
5. **Dates.** Same-day sessions, out-of-order imports, timezone display.

**Also deliver:** one paragraph on the single biggest trust risk.

## Lens R — accessibility, performance, PWA/offline, robustness (IDs R1…)

Static token contrast is already guarded by `test/suites/contrast.js`. Report
only contrast problems it cannot see.

1. **Keyboard and screen reader.**
   - Focus is visible and the tab order is sane.
   - Modals trap focus, return it on close, and close on Escape.
   - Every control has an accessible name: icon buttons, the nav, charts, the
     file input, toggles.
   - Heading levels, landmarks, and live regions for toasts; form errors are
     announced.
   - Targets are at least 24px at 393px.
2. **Motion and preferences.** Reduced motion is honoured in both the CSS and
   Chart.js; colour scheme follows the preference; 200% zoom at 393px works.
3. **Performance.** Run with 4× CPU throttling and Slow 4G:
   - first render and time to interactive;
   - long tasks on load, on import, on Progress and on the session detail;
   - JS coverage of app.js;
   - memory after 30 view switches (leaked listeners, Chart instances);
   - layout shift.
4. **PWA and offline.**
   - The manifest and installability.
   - The SW's cached asset list against what the page actually requests.
   - Offline reload and offline import.
   - The update flow when the cache version changes.
   - An offline navigation to a bad URL.

   Use CDP network emulation on the SW target; Playwright's `setOffline` does
   not stop requests the service worker makes itself.
5. **Robustness.**
   - Console errors across the whole walk.
   - `localStorage` and IndexedDB throwing (override them in an init script).
   - Double-clicking save or import.
   - Rapid view switching.
   - Back/forward and deep links, including a garbage hash.
   - Reload mid-import.
   - Very long notes.
   - HTML or script injection in notes and in CSV club names.
6. **Client-visible security.**
   - The CSP is present and effective.
   - `innerHTML` never receives unescaped user data.
   - Storage contents after sign-out.
   - The auth return handling: read the code only, never hit auth.

**Also deliver:** a table of the performance numbers measured.
