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
- **index.html** — Main structure; nav, views, modals, toast system
- **app.js** (~2400 lines) — All logic: DB, auth, CSV parsing, routing, UI rendering
- **style.css** (~1500 lines) — Design system; mobile-first, dark theme

### Core Modules (in app.js)

1. **Utilities & Club Data**
   - `CLUB_ORDER`, `CLUB_COLORS`, `CLUB_LABELS` — Golf equipment reference tables
   - Club type checkers: `isWood()`, `isIron()`, `isHybrid()`, etc.
   - Stats: `avg()`, `stdDev()`, `fmt()` for formatting numbers
   - Geometry: `facePath(shot)` calculates face-to-path angle (D-Plane concept)

2. **DB Module** — IndexedDB via idb-keyval library
   - Stores sessions (shots data) locally with timestamp sort
   - Methods: `getSessions()`, `getSession(id)`, `saveSession()`, `deleteSession()`
   - Guest sessions use ephemeral `MemDB` (cleared on page close)

3. **Auth Module** — Supabase OAuth + password auth
   - Handles sign-up, login, OAuth (Google/GitHub), logout
   - Bridges guest→authenticated (sessions migrate on sign-in)
   - `getUser()` returns current user or null
   - URL hash/query parsing for auth redirects & error handling

4. **CSV Parser** — Rapsodo format
   - Parses launch monitor data: club type, ball speed, smash factor, launch angle, spin rate, carry, total distance, offline distance, etc.
   - Returns array of shot objects with normalized field names

5. **Router** — Single-page navigation
   - Views: `sessions` (home), `yardages` (club stats), `progress` (trends), `settings` (account)
   - `Router.showView()` renders active view; toggles visibility
   - URL hash routing (e.g., `#sessions`, `#yardages`)

6. **UI Rendering**
   - Dashboard cards (each session → card with summary stats)
   - Charts: distance distributions, consistency metrics, club heatmaps (Chart.js)
   - Modals: import dialog, session detail, settings

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

Five self-contained, defensively-wrapped enhancements:
1. **streak** — consecutive practice-day counter (habit loop)
2. **achievements** — milestone badges (gamification), shown in `#achModal`
3. **focus** — "what to work on" priority from aggregated recent faults
4. **compare** — side-by-side session metric deltas (Progress view `#compareHost`)
5. **searchSessions** — live filter of the session list by date/club/notes

Plus **dark mode** (`html.dark` token overrides; toggle in Settings, persisted
to `localStorage.slTheme`) and a **global error boundary** (`showFatalError`)
that shows a friendly recovery screen instead of a blank page.

Debugging: `showDebug()` logs to console only; set `localStorage.slDebug='1'`
to re-enable the on-screen banner.

---

**Last updated:** May 2026 — ShotLab v3 (deterministic auth, cloud sync, 5 features, dark mode)
