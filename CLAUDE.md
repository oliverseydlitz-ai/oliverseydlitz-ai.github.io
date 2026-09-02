# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Workflow Policy (READ FIRST)

1. **Push directly to `main`.** All updates go straight to `main` — do **not**
   create new feature branches for changes in this repo. (`main` auto-deploys to
   the live site via GitHub Pages.)
2. **Always test in a sandbox first, then push.** Validate changes before every
   push — at minimum: `node --check app.js` (syntax), confirm `index.html` IDs
   referenced by JS exist, verify JSON files parse, and exercise the change
   locally (`python3 -m http.server 8000`). Only push once it works.
3. When app files change, **bump the service-worker cache** version in `sw.js`
   so clients get the update.

## Project Overview

**ShotLab TOUR** is a golf swing analysis web app that imports Rapsodo launch monitor CSV exports and provides visualization & insights into swing metrics, club gapping, consistency, and performance trends.

- **Live at:** `oliverseydlitz-ai.github.io`
- **PWA:** Installable on mobile; works offline via service worker
- **Storage:** IndexedDB (local) + Supabase (cloud for authenticated users)

## Architecture

### Single-Page App (SPA)
- **index.html** — Main structure; nav, views, modals, toast system (~700 lines)
- **app.js** (~6000 lines) — All logic: DB, auth, CSV parsing, routing, UI rendering, ~55 feature modules
- **style.css** (~2100 lines) — Design system; mobile-first, dark theme

### Core Modules (in app.js)

The file is built from self-contained IIFE modules (`const X = (() => {...})()`),
stacked in file order as features were added. Grouped by role:

1. **Utilities & Club Data**
   - `CLUB_ORDER`, `CLUB_COLORS`, `CLUB_LABELS` — Golf equipment reference tables
   - Club type checkers: `isWood()`, `isIron()`, `isHybrid()`, etc.
   - Stats: `avg()`, `stdDev()`, `fmt()` for formatting numbers
   - Geometry: `facePath(shot)` calculates face-to-path angle (D-Plane concept)

2. **Core infra** — `Sanitize`, `CookieConsent`, `Agreement`, `DB`, `MemDB`,
   `_oauthTokens`, `Auth`, `CloudDB`, `Store`, `CSVParser`, `Router`,
   `ImportFlow`, `UI`
   - `DB` — IndexedDB via idb-keyval; `getSessions()`, `getSession(id)`,
     `saveSession()`, `deleteSession()`. Guests use ephemeral `MemDB`
     (cleared on page close).
   - `Auth` — Supabase OAuth + password auth; `getUser()` is the
     server-validated source of truth (see Auth & Cloud Sync below).
   - `CSVParser` — Rapsodo format → normalized shot objects (club type,
     ball speed, smash factor, launch angle, spin rate, carry, total, etc.)
   - `Router` — views `sessions` (home), `yardages`, `progress`, `settings`;
     `Router.showView()` toggles visibility; URL hash routing (`#sessions`).

3. **Scoring / analysis engines** — `FaultEngine`, `ShotScorer`, `SwingDNA`,
   `Benchmarks`, `Insights`, `Analytics`, `SwingAnalytics`, `InsightEngine`,
   `Trajectory`, `ClubAnalyzer`, `GapAnalysis`, `FormQualityTimeline`,
   `Dispersion` (tail engine + the only strokes valuation — see below)

4. **Coaching / practice** — `PracticePlan`, `PracticePlans`, `CoachingMode`,
   `PersonalCoach`, `DrillTracker`, `PracticeEfficiency`,
   `SmartRecommendations`

5. **Session tooling** — `SessionFeedback`, `SessionCategories`,
   `SessionSnapshot`, `SessionSharing`, `SessionNotes`, `SessionComparison`,
   `ClubComparison`

6. **Dashboard / UX layer** — `QuickStats`, `Features` (see dedicated
   section below), `ViewPrefs`, `UICustomizer`, `EnhancedMetricsWidget`,
   `QuickActions`, `AdvancedFilters`, `ResponsiveEnhancements`,
   `AccessibilityEnhancements`, `PerformanceOptimizations`

7. **Insights / social / reporting** — `PerformanceGrade`,
   `PerformanceAlerts`, `PerformanceTimeline`, `AnalyticsHub`,
   `CommunityInsights`, `ContentLibrary`, `LearningPath`, `WeeklySummary`,
   `NotificationCenter`, `Goals`, `DocumentationCenter`

8. **UI Rendering** (`UI` module)
   - Dashboard cards (each session → card with summary stats)
   - Charts: distance distributions, consistency metrics, club heatmaps (Chart.js)
   - Modals: import dialog, session detail, settings, and the ~6 dynamically
     injected modals (`analyticsModal`, `benchmarkModal`, `clubModal`,
     `efficiencyModal`, `learningModal`, `shortcutsModal`) built via
     `innerHTML` at runtime rather than living in `index.html`

### Key Data Shape

```javascript
// Session object
{
  id: string,           // UUID
  date: ISO8601,        // session timestamp
  shots: [{             // array of shot objects
    clubType: string,   // 'd','3w','6i','pw', etc.
    ballSpeed: number,  // mph
    smashFactor: number,
    launchAngle: number,// degrees
    spinRate: number,   // RPM
    carry: number,      // yards
    total: number,      // total distance
    // ... more fields
  }],
  // ... metadata
}
```

### External Dependencies

- **idb-keyval** — Lightweight IndexedDB wrapper
- **supabase-js** — Auth & database client
- **Chart.js** — Graphing (loaded CDN)
- Google Fonts (Poppins)

## Development

### Setup

This is a static site with no build step. Just serve the root directory:

```bash
# Python
python3 -m http.server 8000

# Node
npx http-server

# Or use any static server pointing to /
```

Then open `http://localhost:8000` in browser.

### Dev Workflow

1. **Local Changes** → Edit `app.js`, `style.css`, `index.html` directly
2. **Test in Browser** → Reload page; IndexedDB persists test data
3. **Clear Test Data** → Open DevTools Console and run:
   ```javascript
   await DB.clearAll();  // clears IndexedDB
   location.reload();
   ```
4. **View Error Logs** → DevTools Console (auth, parse errors, etc.)

### Common Tasks

**Add a new metric/stat to a session:**
- CSV parser is around line 300-400 in app.js; add field mapping there
- Update the session schema in Dashboard rendering (search `dashboardCard`)

**Add a new view:**
- Add `<section class="view" id="view-{name}">` in index.html
- Create render function `const render{Name} = () => { ... }` in app.js
- Add nav link: `<a data-view="{name">`
- Router calls render function on tab click

**Test CSV import:**
- Upload a real or mock Rapsodo CSV in the UI
- Check DevTools Network/Console for parse errors
- Data persists in IndexedDB immediately on import

**Debug auth flow:**
- Guest mode (MemDB): sessions lost on page close
- Logged-in (Supabase): sessions sync to cloud
- Magic link / OAuth redirects trapped in URL hash → parsed by Auth module

### Supabase Integration

**DB credentials** in app.js (lines ~127–129):
```javascript
const SUPABASE_URL = '...';
const SUPABASE_KEY = '...';  // publishable key (safe to expose)
```

**Tables** (in Supabase console):
- `sessions` — stores full session records for authenticated users
- User auth managed by Supabase Auth (no custom table)

**When user signs in:**
- Sessions from MemDB *can* be migrated to Supabase (not automatic; depends on UI flow)
- Future imports go to both IndexedDB + Supabase if authenticated

### Browser DevTools Tips

- **IndexedDB Inspector** → DevTools > Application > IndexedDB > shotlab-db
- **Auth State** → Console: `Auth.getUser()` returns current user object
- **Session Data** → Console: `await DB.getSessions()` lists all stored sessions
- **Supabase Logs** → Supabase Dashboard > Logs for real-time events

## ⚠️ Measurement honesty (read `docs/research-base-v2.md` §1 and §9 first)

The research base supersedes earlier guidance and **corrected two foundations**:

1. **The MLM2PRO does not measure face angle.** It is not in Rapsodo's metric
   set. `facePath()` *derives* it by inverting the D-plane relation, which
   makes it error-amplified. Never state a face angle. Uncertainty on it is
   quoted from the golfer's own shot-to-shot spread, not a population constant.
2. **Metric trust tiers gate every prescription** — see `Metrics.TIER`:
   - **Tier 1** (prescribe freely): club speed, ball speed, smash factor, carry.
   - **Tier 2** (display only): launch angle, attack angle, club path.
   - **Tier 3** (never prescribe): spin rate, spin axis, launch direction, and
     all modelled outputs (side carry, total, apex, descent). Consumer-radar
     spin limits of agreement (−2,628 to +5,103 rpm) exceed the entire
     amateur-to-tour spin gap.

**Sample floors** (`Metrics`): 10 shots before any club mean, 15 before a
club-path/attack-angle claim, 30 for dispersion tails. Rules may raise their
own floor via `minShots`.

**`Metrics.typicalError()` is the moat.** After ~5 sessions the golfer's own
noise floor beats any published default; it falls back to the MDC table until
then. Always `trimOutliers()` and report `interval()`, never a bare point.

**`Conditions`** — ball type and surface are recorded per session because they
change what the numbers *mean*: range balls give 2–4× the dispersion off a
zero-variance robot, and mats hide fat strikes. Never compare across them.

### Claims the app must never make (§9)

Never state a face angle from one shot · never convert a club-delivery metric
to strokes gained (the sole strokes figure comes from measured directional
spread via `Dispersion`, never from a delivery metric) · never infer kinematic
sequence, ground forces or wrist position from launch data · never prescribe
from spin · never draw dispersion or gapping conclusions from range-ball
sessions · never quote "+N yards per degree of attack angle" · never present
carry as a measurement (it is a model output) · never claim a rep/week count to
"groove" a change · never claim the app builds automaticity or rewires motor
patterns.

### `FeedbackEngine` — why numbers are hidden by default

The guidance hypothesis is the strongest evidence in the base and it indicts
this product category. Winstein & Schmidt (n=240): constant vs faded feedback
was **indistinguishable during acquisition and at 5–10 minutes**, but at 24
hours the faded group had **35% less error**. An app that measures itself on
within-session improvement cannot see the damage it does. Default mode is
`onRequest` (tap to reveal). **Never evaluate a drill by within-session
improvement** — the retention probe is the efficacy metric.

## Swing-mechanics constants (do not change casually)

Several numbers in `app.js` are sourced, not guessed. `docs/coaching-calibration-audit.html`
is the working — read the relevant section before touching any of these.

- **`facePath(shot)`** — `(launchDirection - clubPath) / R`. `R` falls with
  loft and is interpolated on spin loft (`0.89 - 0.0045·spinLoft`), anchored to
  PING 2020 / TrackMan: driver **0.84**, 7-iron **0.78**, PW **0.71**. The
  "85% face" rule taught everywhere is a driver-only figure. Returns `null`
  when either input is missing — it is derived, so a missing input means no
  answer.
- **`spinLoft(shot)`** — estimated `(launchAngle - attackAngle) / kv`,
  `kv = 0.83` woods / `0.75` irons. These reproduce TrackMan's published tour
  spin lofts exactly (driver 14.7°, 6-iron 24.3°) — that is the regression
  check. Rapsodo does not export dynamic loft, so this is an estimate.
- **`Metrics.DEVICE_ERROR = 0`** — device error is deliberately NOT carried as
  a separate term. Half the published 1.8° figure (the launch-direction sigma)
  was never measured by anyone, and an observed shot-to-shot spread already
  *contains* the device error, so adding a constant on top double-counts it.
  Uncertainty is quoted from `Metrics.shotSpread()` — the golfer's own data.
  Sample floors are unaffected: they rest on swing variability, not device error.
- **`ANGLE_NOISE` (legacy)** — Rapsodo MLM2PRO measurement error (MAE 1.05°
  attack angle, 1.19° club path vs a Foresight GCQuad). Fault thresholds sit
  inside this band, which is why `FaultEngine` gates on *recurrence* rather
  than padding thresholds.
- **`Benchmarks.DATA`** — rows tagged `[TM]` are TrackMan-published; `[est]`
  are interpolated. **`Benchmarks.TARGET` is separate on purpose**: what to aim
  at is not what the tour averages. The PGA driver attack angle is **-1.3°**
  (descending); **+2..+5°** is the optimal target and **+3.0°** is the *LPGA*
  average. Conflating those was the original bug.
- **`CoachingMode.TIPS`** — deliberately written to an *external* focus of
  attention (club, ball, turf, target), never the golfer's own body parts.
  This is the best-evidenced item in the audit; don't rewrite cues inward.

### Dispersion tails and the one strokes number (`Dispersion`)

The only strokes-gained valuation in the app, and the only place a strokes
figure may appear. It measures directional spread **directly** off the device's
offline outputs and feeds Broadie & Ko (2009) — it does **not** chain through
face angle, because the face-angle-SD → spread link is unpublished and
curvature amplifies start-line error non-linearly.

- **Outliers are not trimmed here.** The blow-up *is* the measurement. Broadie &
  Ko's two-component mixture is what generates the penalties; trimming leaves
  the Gaussian that under-predicts them. Only impossible geometry is screened
  (`MIN_CARRY` 20 yd, `MAX_ANGLE` 45°).
- **`coreScale()` only ever iterates downward.** The refinement has a second,
  self-sustaining fixed point at the contaminated spread — see the comment.
- **Gates:** premium or RPT ball only, `Metrics.MIN_SHOTS_TAIL` (30) usable
  shots, per club.
- **Sigma survives a misaligned unit** (a constant offset cancels out of a
  spread); **absolute bias does not** and is withheld until alignment is confirmed.
- **Valuation is driver-only** — the published curves are driver curves — and
  refuses outside 5.5°–7.9° ±1.5°, clamping with a note inside that margin.
  Every valuation carries `Dispersion.CAVEATS`; do not render one without them.

### Fault reporting gates (`FaultEngine`)

A fault reports only when it recurs at a rate measurement noise would not
produce: `MIN_CLUB_SHOTS = 4` of that club, `MIN_AFFECTED = 2` shots,
`MIN_RATE = 0.30`. Below `FIRM_RATE = 0.50` it reports as `tentative` with
severity downgraded one level. The denominator is the *clubs the fault appeared
on*, not the whole session, so a driver fault is judged against drivers.

### Practice plans (`PracticePlan`)

Time is weighted by severity × scoring weight × session share × confidence,
not severity alone — approach clubs outrank fairway woods because that is
where strokes-gained says scoring differences live. Every block prescribes
**balls as well as minutes** (volume past attention is exercise, not practice),
and `transferBlock()` is appended to every plan.

## Tests — run these before every push

```bash
npm install     # once; jsdom only, dev-only. The SITE still has no build step.
npm test
```

`test/run.js` does two things, in this order, and the order is the point:

1. **Load gate.** Loads `app.js` as a whole file in jsdom against the real
   `index.html`, then checks that late declarations are reachable. A top-level
   throw leaves every later `const` in the temporal dead zone, so the app is
   dead while `node --check` still passes.
2. **Unit suites** (`test/suites/`), which run against the modules from that
   same real load — not regex-extracted copies.

**Why it is built this way.** An earlier harness pulled modules out of
`app.js` with regexes. `Store.stamp` was then exported from `MemDB` by
mistake — both modules end with an identical return line — and `app.js` threw
at load for four commits while `node --check` passed and every suite reported
green. The gate exists specifically to catch that class of bug; there is a
test proving it does.

If the gate fails, the suites are not run. They would be meaningless.

## Code Style & Patterns

- **No build/transpile** — vanilla JS ES6+ (arrow functions, destructuring, async/await supported)
- **Closure patterns** — modules like `DB`, `Auth`, `Router` use IIFE for encapsulation
- **Naming** — camelCase for functions, `UPPER_CASE` for constants
- **Comments** — Descriptive headers (e.g., `// ── Sessions ────`) separate major sections
- **Error handling** — Toast notifications for user-facing errors; console.error for debugging

## Deployment

Pushes to `main` automatically deploy via GitHub Pages. No build step needed.

## Performance Notes

- **IndexedDB queries** are async; use `await`
- **CSV parsing** can be slow for large files (100+ shots) — run in web worker if needed
- **Charts** render on-demand in a view; don't render all charts at page load
- **Service Worker** (sw.js) caches assets for offline; update cache version if changing files

## Auth & Cloud Sync (current implementation)

- **OAuth (Google):** implicit flow. The redirect token in the URL `#hash` is
  captured synchronously at load into `_oauthTokens`, then installed explicitly
  via `sb.auth.setSession()` in `Auth.init`. This deterministically overrides any
  stale stored session — the fix for the "wrong email after switching accounts"
  bug. `detectSessionInUrl` is **off** so there's one code path, no race.
- **Source of truth:** `getUser()` (server-validated), never the cached session.
- **Cloud sync:** `CloudDB.saveSession` upserts on `id`; if the table lacks the
  PK constraint it falls back to delete-then-insert (failsafe). Run
  `supabase-setup.sql` in the Supabase SQL editor to create the table/RLS
  properly.
- **Store is local-first:** always returns local sessions and merges cloud on
  top; cloud errors degrade gracefully and never break tab navigation.

## Features module (`Features` in app.js)

`Features` is one module among the ~55 listed in Core Modules above — not the
whole app's feature set, just its original five defensively-wrapped
enhancements:
1. **streak** — consecutive practice-day counter (habit loop)
2. **achievements** — milestone badges (gamification), shown in `#achModal`
3. **focus** — "what to work on" priority from aggregated recent faults
4. **compare** — side-by-side session metric deltas (Progress view `#compareHost`)
5. **searchSessions** — live filter of the session list by date/club/notes

Everything added since (coaching engine, community insights, learning paths,
weekly summaries, notification center, etc.) lives in its own top-level
module — see the module map under Core Modules.

Plus **dark mode** (`html.dark` token overrides; toggle in Settings, persisted
to `localStorage.slTheme`) and a **global error boundary** (`showFatalError`)
that shows a friendly recovery screen instead of a blank page.

Debugging: `showDebug()` logs to console only; set `localStorage.slDebug='1'`
to re-enable the on-screen banner.

---

**Last updated:** September 2026 — ShotLab v3 (deterministic auth, cloud sync,
~55 modules across scoring/coaching/session/dashboard/reporting, dark mode).
Repo audited end-to-end: no stray files, no non-golf content, only `main` +
active branches exist.
