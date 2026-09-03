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
- **app.js** (~10,700 lines) — All logic: DB, auth, CSV parsing, routing, UI rendering, 54 feature modules
- **style.css** (~2100 lines) — Design system; mobile-first, dark theme

### Core Modules (in app.js)

The file is built from self-contained IIFE modules (`const X = (() => {...})()`),
stacked in file order as features were added. **This list is checked against the
source by `test/suites/module-map.js`** — an earlier version named 17 modules
that had been deleted and omitted the ten that matter most, which is a bad map
to hand someone starting cold.

1. **Utilities (not modules — top-level functions and tables)**
   - `CLUB_ORDER`, `CLUB_COLORS`, `CLUB_LABELS` — equipment reference tables
   - Club type checkers: `isWood()`, `isIron()`, `isHybrid()`, `isShort()`, `isMid()`
   - Stats: `avg()`, `mean()`, `stdDev()`, `fmt()`, `consistencyScore()`,
     `bagConsistency()` (per club — never pool a bag; see below)
   - Geometry: `facePath()`, `faceAngle()`, `spinLoft()`, `curveYards()`,
     `gearEffectSuspected()`

2. **Measurement foundation** — `Metrics` (trust tiers, sample floors,
   `interval()`, `typicalError()`, `changeIsReal()`, `CEILING`), `Conditions`
   (ball + surface, and what they invalidate), `Spin` (suppressed without an
   RPT ball), `FeedbackEngine` (the guidance-hypothesis schedule),
   `RetentionProbe` (the app's only efficacy metric), `MeasurementReference`,
   `SetupGuide`

3. **Core infra** — `Sanitize`, `CookieConsent`, `Agreement`, `DB`, `MemDB`,
   `LocalDB`, `Auth`, `CloudDB`, `Store`, `CSVParser`, `Router`, `ImportFlow`,
   `UI`
   - `DB` — IndexedDB via idb-keyval, reachable behind `LocalDB`'s explicit
     opt-in. Guests read through `MemDB`, the single synchronous read path.
   - `Auth` — Supabase OAuth + password; `getUser()` is the server-validated
     source of truth (see Auth & Cloud Sync below).
   - `CSVParser` — Rapsodo format → normalised shot objects; refuses a
     non-Rapsodo CSV at the door rather than importing it as nothing.
   - `Router` — views `sessions` (home), `yardages`, `progress`, `practice`,
     `settings`; hash routing.

4. **Scoring / analysis engines** — `FaultEngine` (gates, `splitCauses`,
   `splitDrills`), `ShotScorer`, `SwingDNA`, `Benchmarks` (the only copy of the
   target bands), `Insights`, `InsightEngine`, `Analytics` (yardage book +
   `conditionGroups`), `Trajectory`, `ClubAnalyzer`, `Dispersion` (tail engine
   and the app's only strokes valuation), `Strike` (smash / strike quality),
   `QuietEye` (putting, no device), `DrillLibrary` (104 gated drills),
   `ShortGame` (20 putting and chipping drills), `Rounds` (on-course data)

5. **Coaching / practice** — `PracticePlan`, `CoachingMode`,
   `PersonalCoach`, `PracticeEfficiency`, `SmartRecommendations`
   (`getNextStep`, the one ranked recommendation), `LearningPath`,
   `ContentLibrary`

6. **Dashboard / UX layer** — `QuickStats`, `Features` (see its own section
   below), `ViewPrefs`, `EnhancedMetricsWidget`,
   `AccessibilityEnhancements`, `SessionSnapshot`, `SessionSharing`, `Goals`

7. **Reporting** — `PerformanceGrade`, `PerformanceAlerts`, `AnalyticsHub`,
   `CommunityInsights` (published data only — **there is no community**, see
   below)

8. **UI Rendering** (`UI` module)
   - Session cards, the session detail view, and every chart (Chart.js)
   - Modals: import, session detail, settings, plus the ~6 dynamically
     injected ones (`analyticsModal`, `benchmarkModal`, `clubModal`,
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

### `FeedbackEngine` — enforced, not just offered

The schedule drives the **shot table**, which is the app's only per-shot
knowledge-of-results surface. `plan(shots)` returns a per-shot decision;
`explain(mode, n)` is the sentence shown above the table.

- **Faded is deterministic** (`fadedReveal`), not sampled. The table re-renders
  on every sort, and a schedule that changes when you look at it is not one.
- **The band is per club and 1.5 SD.** Pooled across a bag it measures the
  driver-to-wedge gap; at 1 SD it fires on a third of shots by construction.
- **Hidden rows lose their verdict colour too.** A green/red edge is a
  judgement, so it is feedback exactly as much as the number is.
- **Session aggregates are never faded** — a mean with an interval is the
  summary the retention literature wants a learner to have.
- `calibration(calls, shots)` scores predict-before-reveal against the golfer's
  own spread.

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
- **`CoachingMode.TIPS`** — written to an *external* focus of attention: the
  subject of a cue is the club, ball, turf, tee or target. Don't rewrite cues
  inward. A body word may appear as a **landmark** ("chest height") or in a
  **static setup check** the golfer can verify at address ("count 2 knuckles"),
  but never as an in-swing position to hold — four cues did exactly that and
  were rewritten. `test/suites/drill-focus.js` guards both TIPS and the fault
  drills. (An earlier version of this file claimed TIPS named no body part at
  all, which was never true of the code.)

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

### Strike quality (`Strike`)

The highest-value amateur lever and tier 1 end to end. Gated at
`Metrics.MIN_SHOTS_REPORT`; a gap smaller than the golfer's own ± is reported
as *not* a gap.

- **It stops at yards.** Distance→strokes is published and legitimate, but the
  app keeps exactly one strokes figure (`Dispersion`) so two numbers from two
  roads can never be confused or added. Don't add a second.
- **Carry conversion is driver-only** (`YD_PER_BALL_MPH`, 1.55–1.78, read off
  the research base's own worked example). Other clubs get ball speed, no yards.
- Every gain is labelled a **chained estimate** where it is shown.

### Quiet eye (`QuietEye`)

The largest effect in the research base (d ≈ 0.69 after trim-and-fill) and the
only module that touches no launch-monitor data.

- **There is no gaze field anywhere, deliberately.** The app cannot see gaze,
  so it must never claim a quiet eye changed. It tracks the outcome only.
- Wilson intervals, not the normal approximation — at 20 putts the naive
  interval returns a negative lower bound and claims certainty at 20-for-20.
- `puttsToDetect()` says the study's +5% needs ~1,400 putts a side;
  `detectableDelta()` inverts it into what your log *can* resolve. Keep both.

### On-course rounds (`Rounds`)

The only on-course data the app has, and the only place it can answer "where
are my strokes going" rather than reasoning about it from range shots.

- **Each stat is placed on Shot Scope's normative table independently**, giving
  an implied handicap per category. **The SPREAD between them is the
  diagnosis** — greens like a 15 and penalties like a 25 is not a 20 across the
  board. No strokes model is invented; it is their numbers against a published
  sample (90M+ shots, independently replicated).
- **Fairways hit is logged and NEVER graded.** It moves 50% → 46% across a
  28-stroke range. Grading it manufactures a weakness out of a rounding error.
  `PLACEABLE` deliberately omits it; `FIR_NOTE` says why.
- Under 5 points of spread it says the categories are level and calls that a
  real answer rather than hunting for a weakness.
- `rangeLink()` puts penalties/round beside the measured dispersion tail —
  **side by side, explicitly not correlated.** A few rounds cannot establish
  that, and an r printed on it would be invented.
- Nine-hole rounds are doubled, flagged `scaled`, and the assumption is stated.
- **It closes its own loop.** `prescribe()` turns the worst category into the
  practice work for it; `trend()` tracks that category across rounds. `trend()`
  carries a `flat` flag because the significance test divides by the baseline
  spread — a golfer with an identical run of rounds would otherwise be told "no
  detectable change" after a large real move. Any non-zero delta off a flat
  baseline is real, with the warning that a short identical run flatters itself.

### Short game (`ShortGame`) — see `docs/short-game-evidence.md`

20 drills, 10 putting and 10 chipping, built on a 2024 systematic review of
**52 RCTs** that named three methods superior within their strategy: errorless
learning, contextual interference (random order), and external focus.

- **Every drill carries a `tier`.** `strong` needs a citable trial; `weak` says
  outright that no trial supports the format. Do not level these up.
- **The reviewers' own limitation travels with the finding**: over half those
  52 trials were underpowered and most used novices on simple putting tasks.
- **The session builder puts errorless BEFORE random.** That order is the
  finding — random order before anything is repeatable is just missing in a
  varied sequence.
- **Chipping is scored on proximity, median AND mean.** Strokes gained around
  the green is a function of lie and proximity, not of holing out. The gap
  between median and mean *is* the chunk rate in feet.
- **It says putting is the cheapest fix, not the biggest hole** — a 90-shooter
  loses ~6 strokes to approach + short game and only ~2 to putting.

### Drill library (`DrillLibrary`)

All 104 drills from §8, each carrying its section's gate. `admissible(drill,
ctx)` returns `{ok, reasons}` — **a locked drill is shown with its reason, never
filtered out.** Section I are wrappers applied *over* a drill, never instead.

### The inference boundary (`FaultEngine.splitCauses`)

The launch monitor sees the ball and the club head, **not the body**. Fault
causes are split: `causeIsObservable()` is false for anything naming a hip,
wrist, spine, posture, lag, casting or early extension, and those render under
"Often behind it — but not measured here" with `BODY_CAVEAT`. Dynamic loft is
a many-to-one outcome and cannot be inverted to a wrist angle — there is no
published regression for it. A bulk test asserts no body-position string is
ever classified as measured, so a new cause cannot land on the wrong side.

### Prescribing across the boundary (`FaultEngine.splitDrills`)

`splitCauses` splits what the monitor measured from what it cannot see. The
drills sat below that split and ignored it — "the app cannot see your hips",
then "initiate the downswing by rotating the hips". Every drill now declares
where its instruction lives:

- **`external`** — the club, ball, turf, tee, a gate or the target gives the
  feedback. The drill checks itself.
- **`setup`** — a body position at **address**. Static, self-verifiable in a
  mirror before the swing. Counted as checkable.
- **`feel`** — a body position **during** the swing. Neither the app nor the
  golfer can confirm it happened.

`feel` drills are **kept, not deleted** — several are the only drill their
fault has — and render under their own heading with `FEEL_CAVEAT`, exactly as
body causes render under `BODY_CAVEAT`. An unlabelled drill defaults to `feel`:
the cautious side, never the flattering one.

**Anything that picks a drill must order checkable-first.** `PracticePlan` and
`getNextStep` both used `drills[0]`, which for five faults is a feel — and for
two of those a checkable drill was sitting second in the same list. A block
where *every* drill is a feel sets `drillIsFeel` and says so.

Three surfaces, one rule, all guarded by `test/suites/drill-focus.js`: **53**
fault drills (each labelled), **104** library drills (external by default, the
one exception declares `feel:true`), **24** coaching tips. Two library drills
trip the word list innocently — a junior's "growing spine", a putting "lag
block" — and are exempted **by name with the reason**, never by weakening the
regex.

### Fault reporting gates (`FaultEngine`)

A fault reports only when it recurs at a rate measurement noise would not
produce. Three gates, and the constants are exactly these — there is no
`MIN_CLUB_SHOTS`, which an earlier version of this file invented:

- **`MIN_AFFECTED = 2`** — never off a single shot.
- **A per-club sample floor**, defaulting to `Metrics.MIN_SHOTS_REPORT` (**10**).
  A rule raises it with `minShots: 15` (club-delivery metrics, tier 2) or
  `minShotsFor: Conditions.startLineFloor` (10 aligned, 30 not).
- **`MIN_RATE = 0.30`** of that club's shots.

Below `FIRM_RATE = 0.50` it reports as `tentative` with severity downgraded one
level. The denominator is the *clubs the fault appeared on*, not the whole
session, so a driver fault is judged against drivers. The suite pins all four
numbers, so this paragraph cannot drift from the code again.

### The one recommendation (`SmartRecommendations.getNextStep`)

The home view already renders seven insight surfaces. This is the only one
that *ranks*, and there is deliberately one card: rule 9 of the research base
is one cue and never a checklist. The order is an argument, so every branch
returns a `why` that is rendered under it.

1. **A due retention probe** — it expires (1–10 days), and whether the last
   change held is the only efficacy evidence this app can produce.
2. **Nothing imported** → the short game. The three off-device modules work on
   a brand-new account; "go get range time" is not a day-one answer.
3. **An out-of-line on-course category** (`Rounds.profile()`). Outcome data
   outranks anything inferred from a range. A *level* profile falls through
   rather than manufacturing a weakness.
4. **The top recurring fault** — but only after `PracticePlan.libraryDrill()`
   confirms the drill is admissible on what that session measured. A locked
   drill renders its reason.
5. **Otherwise the transfer block**, framed as the result it is. Nothing
   recurring is an answer, not an empty state.

Do not rank by session count — the version this replaced did, and said "build
your baseline" for five sessions whatever the data showed.

### Practice plans (`PracticePlan`)

Time is weighted by severity × scoring weight × session share × confidence,
not severity alone — approach clubs outrank fairway woods because that is
where strokes-gained says scoring differences live. Every block prescribes
**balls as well as minutes** (volume past attention is exercise, not practice),
and `transferBlock()` is appended to every plan.

### The yardage book and gapping (`Analytics`, `renderGapping`)

The screen a golfer stands over a shot with. It now obeys the same rules as
everything else, and it did not before:

- **One set of conditions.** `Analytics.conditionGroups()` groups sessions by
  ball + surface; the book is built on the largest group by **shot** count and
  names it. Never pool a range-ball session into a stock yardage.
- **`Metrics.MIN_SHOTS_REPORT` per club.** Below it the club keeps its row and
  prints what it needs — no number that could read as a yardage.
- **`Metrics.interval`, never a bare mean.** Carry and total are labelled
  **modelled**, because the monitor computes them from launch conditions.
- **Spread is relative** (SD ÷ the club's own carry). Fixed yardage bands
  judged a wedge and a driver on the same ±6.
- **Gapping is gated on `Conditions.ball(session).gappingValid`.** Off range
  balls the club ORDER survives and the gap SIZE does not, so the sizes are
  withheld and the table says so. Clubs under the floor come off the chart
  entirely — a bar chart is a visual comparison, and a caveat beside a
  two-shot bar does not fix it.

### `test/suites/rules-are-wired.js` — run the audit, don't just remember it

The defect this codebase actually has is a rule that is written down, has
working code, and is never reached — nine instances so far, every one of them
green on the full suite. This suite asserts that each named gate and caveat is
referenced from **outside** the module defining it, with the consequence
spelled out per line.

Two known false-positive modes, both found the hard way, both handled by
naming the alias rather than weakening the check:

1. A function called **unqualified inside its own module** (`Trajectory.arc`,
   `UI.renderSessionList`).
2. A constant **re-exported under a different key** — `Dispersion.CAVEATS`
   ships as `caveats:`, `Rounds.FIR_NOTE` as `firNote:`.

It carries a **negative control**: `ViewPrefs.setPref` is confirmed dead and
left in place, so the suite asserts it still reads as unwired. If that ever
passes as wired, every other pass in the file is worthless. Do not delete it.

**Adding a gate? Add it to this suite.** A gate nothing calls is the same as
no gate.

### Never pool across the bag (`bagConsistency`, `QuickStats`, `yardageBook`)

The single most repeated arithmetic error here. A carry figure averaged over a
driver, a 7-iron and a wedge measures **which clubs you hit**, not how you hit
them, and it moves with the club mix — a wedge-heavy session reads as
regression. CLAUDE.md said this about the feedback band ("Pooled across a bag
it measures the driver-to-wedge gap") and nothing else obeyed it.

- **`bagConsistency(shots)`** is the only correct bag-wide consistency: per
  club above the sample floor, weighted by shot count, `null` when no club
  qualifies. `100 - stdDev(carries)` is banned — a spread in yards is not a
  percentage, and it scored a golfer hitting *perfectly identical* drivers and
  wedges at 30%. `rules-are-wired.js` fails if it reappears.
- **Anchor on one club** for any single headline number. `QuickStats.pick()`
  takes the most-hit club in the recent comparable sessions and the row names
  it.
- **Anchor on conditions too**, and note the two right answers differ:
  the yardage book uses the LARGEST comparable group (it is a reference table
  you club off); the home row and the Progress trend use the MOST RECENT
  session's conditions (they answer "how am I hitting it now"). A test pins
  that they disagree on the same data.

### Records and impossible readings (`Metrics.CEILING`)

A personal best is the reading most likely to be a misread — it is the extreme
value, on a device that has logged a 147 mph swing next to a 0 mph one.
`CEILING` screens **impossible** readings only, the precedent `Dispersion`
sets, and holds exactly **one** entry: smash factor 1.55, because the COR limit
of 0.83 is a hard bound from the rules of golf. Carry, ball speed and apex are
deliberately unscreened — a long drive is unusual, not impossible. **Do not add
a ceiling without a citable physical bound.** A MAD trim does not work here:
with one outlier among tied values it becomes its own scale and passes.

### Where numbers come from (the question that found the most)

Three modules shipped **fabricated content**, each easy to write and
impossible to notice from the inside, because code that renders a made-up
constant is perfectly correct code:

- `CommunityInsights` — "simulated benchmark data (would be real in
  production)", rendered as "Avg" with green "↑ Above average" verdicts, and a
  promise of real community data the app cannot keep. **There is no
  community**: sessions are per user behind row-level security and nothing
  aggregates them.
- `LearningPath` — "⛳ Fundamentals — 6 lessons", with locked badges. There
  are no lessons.
- `ContentLibrary` — twelve **videos** with runtimes and skill levels. There
  is no video content.

All three now read from the data that does exist and is cited:
`Benchmarks.DATA` (TrackMan), `Rounds.NORMS` (Shot Scope, 90M+ shots), and
`DrillLibrary.SECTIONS` — whose `why` field is the evidence for each section
and is the only "lesson" this app has ever had.

**Before adding any number to a screen, ask where it comes from.** If the
answer is a constant somebody typed, it does not go in.

### Passing the session into `FaultEngine` and `PracticePlan`

`FaultEngine.detectFaults(shots, session)` reads ball type, surface and
alignment off the session. **Called with one argument it gets `null` and no
condition gate applies at all** — a range-ball session grades exactly like a
premium one. Eleven call sites did that, including `renderFaultCards` and
`renderPracticePlan`, because the one-argument form is valid JavaScript and
the output looks right: no error, just a gate that never fires.

`PracticePlan.generate(shots, totalMin, session)` — passing the session as
`totalMin` makes every block's minutes and balls **NaN**.

`rules-are-wired.js` asserts both, with a **balanced-paren scan** rather than
a regex: a non-greedy `[^;]*?` stops at the first closing paren, which for
`detectFaults((x || {}).shots, y)` is the one inside the first argument.

### View preferences (`ViewPrefs`)

Five toggles in Settings that did nothing for as long as they existed: they
flipped a checkmark, wrote to localStorage, and **nothing read the value**.

They work by putting a class on `<html>`, and CSS hides the section. **Keep it
that way.** Anything that sets `hidden` on a section is wiped by the next
`innerHTML =` on its parent, and the setting silently stops working — which is
the most likely way these died in the first place. A class on the root element
survives every re-render.

The element-id → pref-key mapping (`PREF_BUTTONS`) is **stated, not derived**.
The old code built `'show' + name` and special-cased Density back out of it,
which is how `showClubBreak` came to be written to storage while the defaults
declared `showClubBreakdown` — a preference that could never match its default.

### `test/suites/dom-ids.js` — the pre-push step, as a test

"Confirm `index.html` IDs referenced by JS exist" was a manual line in the
workflow above, which means it never ran. **A missing id is not an error**:
`getElementById` returns null, the `if (!el) return` guard fires, the feature
is simply absent, and nothing logs — the same way `Router.showPractice`
rendered nothing for as long as it did.

Both directions. Every id `app.js` reaches for must resolve, in the markup or
at runtime. And every id the markup declares must be reachable — that half is
necessarily weaker, since an id can be built as `` `view-${name}` `` or mapped
as a bare object key, so the markup-only ones are **listed by name with the
reason**. The suite fails on a new name, and on a stale exemption, so the list
cannot rot.

### Backup and restore (`SessionSharing`)

`exportAsJSON` writes `shotlab-backup-<date>.json` and, for as long as it
existed, **nothing could read it back**. A backup you cannot restore from is a
download, and the filename was making a promise the app had no way to keep.

`readBackup(text)` refuses at the door, the same discipline `CSVParser` uses
on a non-Rapsodo file: not JSON, not an array, empty, or entries with no id /
no date / no shots array / no shots / no club on any shot. Each refusal names
what was wrong. A partly-broken file keeps the good sessions and reports what
it dropped rather than failing whole.

`restore(parsed, existing)` **merges and never overwrites.** A session already
on the device wins, because the copy here may have notes or conditions added
since the backup was taken — a restore that silently replaced them is a
data-loss bug wearing the word "restore". It is idempotent: restoring the same
file twice adds nothing the second time.

The UI is two steps on purpose, like the CSV import: read the file and show
what is in it (sessions, shots, date range, how many are already here), then
write only on an explicit press.

## Tests — run these before every push

```bash
npm install     # once; jsdom only, dev-only. The SITE still has no build step.
npm test
```

`test/browser/` holds two checks that are **not** in `npm test` — they need
Playwright and a served site. Run `test/browser/render-scan.js` after touching
any render path: it renders every view and greps the DOM for `NaN` /
`undefined` / `[object Object]`. A red home-screen alert read "NaN% of recent
shots" for an unknown length of time and every unit suite passed, because the
function under test returned a well-formed object and the bug lived entirely
in the template literal reading a field off it. `sync.sh` builds the served
mirror and refuses to finish if a CDN tag survives the rewrite — that mirror
went stale once and reported a rewritten feature's old text.

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

`Features` is one module among the 54 listed in Core Modules above — not the
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

## Device storage (`LocalDB`)

Guests were losing everything on refresh while the button said their data
stayed on the device. `DB` (IndexedDB) is now reachable behind an explicit
opt-in, **off by default**, in Settings → Data & Export.

- On boot `hydrate()` reads the device store into `MemDB` once; `MemDB` stays
  the single synchronous read path so no call site changed.
- `setEnabled(true)` **writes the flag first and rolls back on failure** —
  `hydrate()` re-reads it, and both yield at every await, so a boot in flight
  used to clobber the switch.
- It **probes** the store with a round trip before promising anything: a
  first-time guest has nothing to write, so a broken browser would otherwise
  only surface at the first real import.
- The guest note renders `LocalDB.describe()`, the same sentence as the
  setting, so the two cannot drift.

Debugging: `showDebug()` logs to console only; set `localStorage.slDebug='1'`
to re-enable the on-screen banner.

---

### Two things that must stay joined

- **`DrillLibrary.FAULT_SECTION`** must cover every id `FaultEngine` can raise.
  It was first written from the research base's headings and mapped inventions,
  so it joined almost nothing. A test now checks both directions against
  FaultEngine's source.
- **`Benchmarks.TARGET` is the only copy of the target bands.** Read them via
  `targetsFor(club)`. The launch-window table used to hardcode them inline,
  which is how the tour average and the target got conflated the first time.

**Last updated:** September 2026 — ShotLab v3 (deterministic auth, cloud sync,
54 modules across measurement/scoring/coaching/dashboard/reporting, dark mode).
Repo audited end-to-end: no stray files, no non-golf content, only `main` +
active branches exist.
