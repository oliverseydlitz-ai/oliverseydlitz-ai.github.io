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
   `Trajectory`, `ClubAnalyzer`, `GapAnalysis`, `FormQualityTimeline`

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

## Swing-mechanics constants (do not change casually)

Several numbers in `app.js` are sourced, not guessed. `docs/coaching-calibration-audit.html`
is the working — read the relevant section before touching any of these.

- **`facePath(shot)`** — face-to-path is `(launchDirection - clubPath) / k`,
  with `k = 0.85` woods / `0.75` irons. Start direction is a *weighted blend*
  of face and path, so the naive subtraction under-reports by 15%/25% and
  misses real slices. Returns `null` when either input is missing.
- **`spinLoft(shot)`** — estimated `(launchAngle - attackAngle) / kv`,
  `kv = 0.83` woods / `0.75` irons. These reproduce TrackMan's published tour
  spin lofts exactly (driver 14.7°, 6-iron 24.3°) — that is the regression
  check. Rapsodo does not export dynamic loft, so this is an estimate.
- **`ANGLE_NOISE = 1.2`** — Rapsodo MLM2PRO measurement error (MAE 1.05°
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
