# HANDOVER

For a Claude Code session starting cold on this repo. Read this first, then
`CLAUDE.md`. Everything here is verified against the code as of `main`.

---

## 0. Sixty-second orientation

**ShotLab TOUR** is a static PWA that imports Rapsodo MLM2PRO launch-monitor
CSVs and turns them into swing analysis and practice prescriptions. It is
served by GitHub Pages straight off `main` at `oliverseydlitz-ai.github.io`.
No build step. Vanilla ES6+, four shipped files: `index.html`, `app.js`,
`style.css`, `sw.js`.

**The one thing to understand before changing anything:** most of this app is
*refusals*. A shot passes nine gates before it can become a drill or a strokes
figure, and at each one the honest output is often silence. If you add a feature that states a
number without checking those gates, you are undoing the main body of work in
this codebase. `docs/architecture.html` explains the pipeline; read it.

---

## 1. First commands in a new session

```bash
cd /home/user/oliverseydlitz-ai.github.io   # or wherever it cloned
npm install          # jsdom only, dev-only; the SITE has no build step
npm test             # load gate + 21 suites, 791 assertions. Must be green.
git log --oneline -5
```

If `npm test` is not green on a fresh checkout, **stop and find out why before
writing anything**. It was green at handover.

To run the app locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

---

## 2. Workflow rules (from `CLAUDE.md`, non-negotiable)

1. **Push directly to `main`.** Do not create feature branches. `main`
   auto-deploys to the live site.
2. **Test before every push.** `npm test` at minimum. For anything touching
   rendering, also drive it in a browser (§6).
3. **Bump the service-worker cache** in `sw.js` when any of `app.js`,
   `style.css`, `index.html` changes, or clients keep the stale version.
   Currently `shotlab-v89` — increment it.

Commit messages in this repo explain *why*, not just what, and name the
mechanism when a number changes. Match that.

---

## 3. Repo layout

| Path | What it is |
|---|---|
| `app.js` | Everything. ~9,990 lines, 56 IIFE modules + ~24 top-level functions |
| `index.html` | 7 views, 7 static modals, CSP meta, CDN script tags |
| `style.css` | Design tokens + components. Two stacked `:root` blocks from successive redesigns |
| `sw.js` | Service worker. Network-first same-origin, cache-first CDN |
| `test/` | `run.js` (runner), `load.js` (whole-file loader), `harness.js` (shim), `suites/` |
| `docs/` | Research, audit, architecture, work log — see `docs/README.md` |
| `supabase-setup.sql` | Table + RLS. Idempotent, self-healing on the PK |
| `supabase/functions/delete-account/` | Edge function; service-role account deletion |
| `_headers` | Real security headers. **Inert on GitHub Pages** — only applies behind Netlify/Cloudflare |
| `PRIVACY.md`, `TERMS.md` | Fetched at runtime by the app. Do not move or rename |
| `SECURITY.md` | Referenced by `.well-known/security.txt`. Do not move |

**Files you cannot move:** `PRIVACY.md` and `TERMS.md` are `fetch()`ed by
`app.js` and linked from the consent gate. `SECURITY.md` is the URL in
`.well-known/security.txt`.

---

## 4. Architecture: the nine gates

Full version in `docs/architecture.html`. Short version:

| # | Gate | Module | Blocks |
|---|---|---|---|
| 1 | Parse | `CSVParser` | Blank cells become `null`, never `0` |
| 2 | Stamp | `Store.stamp()` | Ball, surface, alignment onto every shot |
| 3 | Tier | `Metrics.TIER` | Tier 3 from every prescription path |
| 4 | Sample | `Metrics.MIN_SHOTS_*` | Under 10 shots/club; 15 for club delivery; 30 for tails |
| 5 | Recur | `FaultEngine` | Under 2 affected, under 30% rate |
| 6 | Weight | `PracticePlan` | — outputs the drill |
| 7 | Retain | `RetentionProbe` | — settles a day+ later |
| 8 | Value | `Dispersion` | Non-drivers, and spreads outside Broadie & Ko's 5.5–7.9° band, from any strokes figure |
| 9 | Admit | `DrillLibrary` | Drills whose measurement precondition is not met — **shown locked with the reason, never hidden** |

**Trust tiers** (`Metrics.TIER`, `app.js` ~line 363):

- **Tier 1** prescribe freely — club speed, ball speed, smash factor, carry
- **Tier 2** display only — launch angle, attack angle, club path
- **Tier 3** never prescribe — spin rate, spin axis, launch direction, and all
  modelled outputs (side carry, total, apex, descent)

### Key module line numbers

`Metrics` 416 · `LocalDB` 611 · `Store` 1167 · `FeedbackEngine` 1249 · `Conditions` 1340 · `Spin` 1432 · `Dispersion` 1521 · `Strike` 1880 · `QuietEye` 2136 · `DrillLibrary` 2358 · `RetentionProbe` 2712 · `FaultEngine` 3080 · `Benchmarks` 3780 · `PracticePlan` 3932 · `UI` 4571.
These drift — grep, don't trust them.

---

## 5. Constants that are sourced, not guessed

**Do not change any of these without reading the citation first.**
`CLAUDE.md` lists which document covers which.

| Constant | Value | Source |
|---|---|---|
| `faceRatio()` R | driver 0.84, 7i 0.78, PW 0.71 | PING 2020 + TrackMan, interpolated piecewise on spin loft |
| `LOFT_RATIO_*` kv | 0.83 woods / 0.75 irons | Reproduces TrackMan's published tour spin lofts exactly — that is the regression check |
| `Metrics.DEVICE_ERROR` | **0** | Deliberate. Observed spread already contains device error; adding a constant double-counts |
| `Benchmarks.DATA` | rows tagged `[TM]` / `[est]` | TrackMan-published vs interpolated |
| `Benchmarks.TARGET` | separate from DATA | **On purpose.** PGA driver AoA is −1.3° (average); +2..+5° is the target; +3.0° is the *LPGA* average. Conflating these was the original bug |
| `MIN_RATE` 0.30, `FIRM_RATE` 0.50 | fault gates | Recurrence beyond what noise produces |

---

## 6. How to verify a change in a real browser

This took many attempts to get working. Use this recipe rather than
rediscovering it.

Chromium is pre-installed. Do **not** run `playwright install`.

```bash
SP=/tmp/<scratch>                      # your scratch dir
npm install playwright-core --prefix $SP

# 1. Vendor the CDN libs — the sandboxed browser cannot reach jsdelivr
npm install papaparse chart.js idb-keyval @supabase/supabase-js --prefix $SP
mkdir -p $SP/site/vendor
cp $SP/node_modules/papaparse/papaparse.min.js $SP/site/vendor/
cp $SP/node_modules/chart.js/dist/chart.umd.js $SP/site/vendor/
cp $SP/node_modules/idb-keyval/dist/umd.js $SP/site/vendor/idb-keyval.js
cp $SP/node_modules/@supabase/supabase-js/dist/umd/supabase.js $SP/site/vendor/

# 2. Copy the site and rewrite the CDN srcs to vendor/, strip the meta CSP
#    and the Google Fonts @import (both unreachable in the sandbox)
cp app.js style.css index.html $SP/site/
#    ...then sed/python the four <script src> URLs and remove the CSP meta

# 3. Serve and drive
(cd $SP/site && python3 -m http.server 8766 &)
```

Playwright launch that actually works:

```js
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-background-networking','--disable-sync','--no-first-run'],
});
const ctx = await b.newContext();
// Block all external requests or Chromium's own calls time the run out
await ctx.route('**', r =>
  r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());
```

**Traps, all of which cost me time:**

- The binary is at `chromium-1194/chrome-linux/chrome`, **not**
  `chromium/chrome-linux/chrome`.
- Without the route block, Chromium's background calls to `accounts.google.com`
  and `content-autofill.googleapis.com` hang the run past timeout.
- Re-copy **`index.html` too**, not just `app.js`. A stale test copy will fail
  on selectors that exist in the real file.
- The shot modal opens from `#shotTable tbody tr` — there are six tables in the
  detail view and the others have no click handler.
- Import is reached by clicking `.bottom-nav-item[data-view="import"]`, and a
  session is opened with `Router.showDetail(id)`. There is no `Router.showView`
  and no `Router.openSession` — the exports are `show`, `showDetail`,
  `showProgress`, `showYardages`, `showSessions`, `showPractice`, `showImport`.
- The import flow is `#fileInput` (setInputFiles) → `#previewNext` →
  `#metaBall` / `#metaSurface` / `#metaAligned` → `#saveSession`. Ball type
  defaults to `unknown`, which disqualifies every dispersion gate — set it
  explicitly or you will be testing the refusal path by accident.
- The consent gate must be accepted (`#agreementCheckbox` then
  `#agreementAcceptBtn`), then guest chosen from `#authGuestWrap button`,
  before any view is reachable.
- `UI`, `Metrics` etc. are top-level `const` — reachable from `page.evaluate`,
  but **not** properties of `window`.

---

## 7. Traps in the code itself

**`app.js` has repeated structures that break naive find-and-replace.** Two
bugs shipped this way:

- `MemDB` and `Store` end with an **identical** return line. An edit meant for
  `Store` matched `MemDB` first, exported a function that did not exist there,
  and `app.js` threw at load — dead app, `node --check` still passing. Always
  check `count == 1` before a textual replace.
- A `.gitignore` entry of `node_modules/` does **not** match a symlink named
  `node_modules`.

**Module order matters.** `Benchmarks` is declared ~1,700 lines *after* the
geometry functions that use it. Anything referencing a later `const` at
module-init time is a temporal-dead-zone crash. Build such things lazily —
see `rByClub()`.

**`node --check` cannot see any of this.** It validates syntax only. The load
gate in `npm test` is what catches it.

---

## 8. Auth and cloud

- Supabase project `jdmahrrxtxqrcpcwmwvx`. The key in `app.js` is the
  **publishable** key — safe to expose, RLS does the work.
- OAuth is **implicit flow** with `detectSessionInUrl: false`. The redirect
  hash is captured synchronously into `_oauthTokens` at load, then installed
  explicitly via `setSession()`. This is deliberate — it fixed a "wrong email
  after switching accounts" bug. Do not re-enable auto-detection.
- `getUser()` is the source of truth, never the cached session.
- Guests use `MemDB` — **in-memory, lost on refresh**. `DB` (IndexedDB, ~line
  500) still defines `saveSession`, but nothing calls it — verified: the only
  hit is the definition itself. If you want guest persistence, that is the
  module to revive, and `Store` is where to wire it in.
- Run `supabase-setup.sql` in the SQL editor if the table is ever rebuilt. It
  is idempotent and self-heals a composite PK into a single-column one.

---

## 9. Current state and what to do next

### Repo state

`main` is green. 56 modules, ~10,398 lines in `app.js`, 791 assertions.

**Seven `claude/*` branches remain on the remote.** They should be deleted; a
Claude session's token can create and update refs but **not delete them**
(GitHub returns 403). This needs the repo owner's credentials:

```bash
git push origin --delete \
  claude/codebase-overview-6r9bso claude/codebase-review-bh6njj \
  claude/review-git-branches-hkaqlk claude/supabase-connectors-access-q8xb7i \
  claude/repo-cleanup-golf-audit-npmnmk claude/golf-site-context-handover-lKBr0 \
  claude/hello-qiJhv
```

Six are fully contained in `main`. `golf-site-context-handover` is
byte-identical to `archive/v6-ball-flight`, which preserves 12 commits of
physics ball-flight work worth keeping. `claude/hello-qiJhv` is the only one
whose commit dies with it — a superseded 176-line CLAUDE.md.

### Next substantial piece — the build order is finished

**All eight steps of `docs/research-base-v2.md` §10 are now done.** There is no
next item on that list. What follows is judgement, not a queue.

All three items the previous handover listed are done: the drill library is
joined to `PracticePlan`, the feedback schedule is enforced on the shot table,
and `Strike.trend()` renders in Progress.

**That audit is now a test.** `test/suites/rules-are-wired.js` runs it on every
commit for the gates and caveats that matter, with the consequence written on
each line and a negative control (`ViewPrefs.setPref`) proving the check can
still discriminate. **If you add a gate, add it there** — a gate nothing calls
is the same as no gate.

To sweep the whole file rather than the named list:

```bash
# every module export nothing calls from outside it
grep -o "Module\.[a-zA-Z]*" app.js | sort -u
```

**Three false-positive modes, all learned the hard way.** A full sweep of 57
modules returns ~70 candidates and about 33 survive the first two filters, of
which two were real — so triage matters more than the grep:

1. **Called unqualified inside its own module.** `Trajectory.arc` and
   `UI.renderSessionList` both looked dead and both are live.
2. **Re-exported under a different key.** `Dispersion.CAVEATS` ships as
   `caveats:` and renders as `r.value.caveats`; `Rounds.FIR_NOTE` as
   `firNote:`. The constant's own name appears nowhere outside its module.
3. **Exported for the test suite.** Grep `test/` before calling anything dead.

Check all three before deleting or "fixing" anything.

**Confirmed genuinely dead and left in place** (no user-facing gap, so removal
is the owner's call): `ClubAnalyzer.analyzeClub`, `CoachingMode.generateSession`,
`Features.recommendDrill`, `ContentLibrary.getByLevel`, `ViewPrefs.setPref`,
`SessionSharing.createShareLink`. Do not re-audit these.

An export with no caller is usually a feature that was built and never wired.
That heuristic found: `Store.saveSession` (imports bypassed device storage),
`Router.showPractice` (the Practice tab never rendered), four dead
`FeedbackEngine` functions (the whole feedback setting did nothing),
`Conditions.comparable` (sessions compared across ball types), and
`Benchmarks.TARGET` (targets hardcoded in a second copy). Several remain
unchecked — `Spin.summary`, `SessionSharing.exportAsCSV`, `ClubAnalyzer.analyzeClub`,
`CoachingMode.generateSession`, `Features.recommendDrill`, `ContentLibrary.getByLevel`.

### The three off-device modules

`QuietEye`, `ShortGame` and `Rounds` touch **no launch-monitor data at all**,
so they render on a brand-new account with nothing imported. That makes them
the only part of the app a first-time user can use on day one — worth
remembering when weighing where to add next, and the reason `getNextStep`
sends a golfer with zero sessions to the short game rather than to the import
screen.

`Rounds` is the newest and the most consequential: it is the only place the
app can say where a golfer's strokes actually go, rather than reasoning about
it from range shots. It places each stat on Shot Scope's table separately and
reads the **spread between the implied handicaps**. **Do not add a
strokes-gained figure to it** — the app keeps one strokes number, in
`Dispersion`, and the spread-between-categories method deliberately needs none.

`Rounds` closes its own loop: `prescribe()` turns the worst category into the
practice work for it, and `trend()` tracks that category across rounds. Note
`trend()`'s `flat` flag — a golfer whose baseline has zero variance would
otherwise be told "no detectable change" after a large real move, because the
significance test divides by a spread of zero. Any non-zero delta off a flat
baseline is reported as real, with the warning that a short identical run
flatters itself.

The `ShortGame` / `QuietEye` evidence is a different literature from the rest
of the app, and it is written up in `docs/short-game-evidence.md`. The short
version: a 2024 systematic review of 52 RCTs named errorless learning,
contextual interference and external focus superior within their strategies —
**and stated that over half those trials were underpowered and most used
novices on simple putting tasks.** That limitation travels with the finding
everywhere it is shown. Drill tiers (`strong` / `moderate` / `weak`) encode it
per drill. Do not level them up without a citation.

**This one is now done, and it was bigger than the previous handover thought.**
`FaultEngine`'s drill cues used internal focus ("hold your wrist angle") while
`CoachingMode.TIPS` avoided it — filed here as a consistency issue, Tier C
evidence, not worth prioritising. That framing missed the real problem. The app
splits a fault's *causes* at the inference boundary and puts a caveat under the
half it cannot see, and then prescribed straight across that split three lines
lower. Worse, `PracticePlan` picked `drills[0]` blind, so for Low Ball Speed it
led with "hold your wrist angle" while a purely external drill sat second in
the same array.

Every drill now declares `external` / `setup` / `feel`, feels render under
`FEEL_CAVEAT` exactly as body causes do, and anything picking a drill orders
checkable-first. See CLAUDE.md → "Prescribing across the boundary". The rule is
guarded across all three prescription surfaces by
`test/suites/drill-focus.js` — **if you add a drill or a tip, that suite is
what tells you which side of the line it landed on.**

### Superseded

Steps 1, 2, 3, 5 and 6 of `docs/research-base-v2.md` §10 are done. **Step 4 —
the smash-factor and strike-quality track (§8A)** is the one to take next: it
is the highest-value amateur lever in the whole document, it is measured
entirely with tier-1 metrics, and it is the shortest path to a result. The
average male amateur has essentially LPGA club speed (93 vs 94 mph) and
produces 7 mph less ball speed — the driver problem is strike and spin, not
engine speed, and both are visible in smash factor.

Then step 7 (quiet-eye putting, §8H — best-evidenced intervention in the
document, needs no launch monitor) and step 8 (the ~104-drill library rebuild,
restructured around feedback scheduling rather than drill content).

**On `Dispersion`, if you touch it:** its refusals are the feature. A golfer
with a 10° spread gets no strokes number at all, and that is correct — Broadie &
Ko calibrated between 5.5° and 7.9°. Widening the band to make the number appear
more often would be the single easiest way to put a fabricated figure in front
of a user.

### Known and unfixed

- **`style.css`'s two `:root` blocks are not a problem** — this was wrong in an
  earlier handover. The second adds two font tokens and redefines nothing. The
  dead rules were real and are gone.
- The app still has no on-course data, so it cannot compute true strokes
  gained. `Dispersion` values a *spread* against published curves; that is the
  closest honest thing and it is not the same claim.
- Anything claiming true on-course strokes gained would be fabricated.

---

## 10. Things the app must never do

From `docs/research-base-v2.md` §9. These are not style preferences — each has
a measurement reason behind it.

Never state a face angle from one shot · never convert a club-delivery metric
to strokes gained — the app's one strokes figure comes from directional spread
measured directly, via `Dispersion`, and never from a delivery metric · never
infer kinematic sequence, ground forces or wrist position from launch data ·
never prescribe from spin · never draw dispersion or gapping conclusions from
range-ball sessions · never quote "+N yards per
degree of attack angle" · never present carry as a measurement (it is a model
output) · never claim a rep or week count to "groove" a change · never claim
the app builds automaticity or rewires motor patterns.

**And the one that is easiest to break by accident:** never let a population
constant reach a number shown to a golfer. Every ± in this app is computed from
that golfer's own shots. `Metrics.mdc()` exists only to populate the Settings
reference document — if you find yourself calling it anywhere else, that is
the bug.

---

## 11. Where to read next

| Document | For |
|---|---|
| `docs/architecture.html` | How the app works. **Read before changing code** |
| `docs/research-base-v2.md` | The engineering spec. Measurement tiers, transfer functions, §9 claim ban, §10 build order |
| `docs/coaching-calibration-audit.html` | Why the benchmarks are what they are |
| `docs/launch-direction-vs-face-angle.md` | The D-plane model behind `facePath()` and `faceAngle()` |
| `docs/short-game-evidence.md` | The trials behind `ShortGame` and `QuietEye`, with designs and limitations. **Read before changing a drill's evidence tier** |
| `docs/worklog-2026-09.md` | What changed and why, with a commit index |
| `CLAUDE.md` | Workflow policy, constants, module map |
