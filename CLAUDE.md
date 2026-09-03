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
- **app.js** (~11,400 lines) — All logic: DB, auth, CSV parsing, routing, UI rendering, 58 feature modules
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
   `RetentionProbe` (the app's only efficacy metric), `PracticeLog` (the only
   record of what the golfer actually did — see below), `MeasurementReference`,
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
   `PersonalCoach`, `PracticeEfficiency`, `RangeCard` (the plan at the mat),
   `SmartRecommendations`
   (`getNextStep`, the one ranked recommendation), `LearningPath`,
   `ContentLibrary`

6. **Dashboard / UX layer** — `QuickStats`, `Features` (see its own section
   below), `SessionTags` (a finder, never a variable), `FirstRun` (the method,
   stated before there is data), `ViewPrefs`, `EnhancedMetricsWidget`,
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

### `FeedbackEngine` — a range instruction, NOT a display setting

The guidance hypothesis is the strongest evidence in the base and it is not in
doubt. Winstein & Schmidt (n=240): constant vs faded feedback was
**indistinguishable during acquisition and at 5–10 minutes**, but at 24 hours
the faded group had **35% less error**.

**What was wrong was where it was applied.** The app owned a setting called
"when to show your numbers" that hid the figures in its own shot table until you
tapped each row. That does not implement the guidance hypothesis: the mechanism
is knowledge of results **during acquisition**, while the reps are happening. By
the time a shot reaches this app it was hit at a range, in front of a monitor
that displayed every number on the spot, and the session is over. Hiding it
afterwards reduced nothing except the golfer's ability to read their own data —
the only thing this app does.

A real finding wired to the wrong moment is **harder to catch than a made-up
number**, because everything about it is true except the place it was put.

So: the app shows everything (`FeedbackEngine.WHY_SHOWN` says why, and is
rendered in Settings and in `FirstRun` rather than restated). The schedule lives
where it can operate — the section-I wrappers (`i95` faded, `i96` bandwidth,
`i97` prediction, `i98` self-selected), which instruct a golfer how to use the
monitor **in front of them**, and `RetentionProbe`, which is the only thing here
that can measure whether any of it worked. `PracticePlan.wrapperFor()` defaults
to `FeedbackEngine.DEFAULT_WRAPPER` (`i95`) instead of keying off a display
setting, which was the wrong variable entirely: how a golfer reads their data
afterwards says nothing about how they ran the session.

`volumeAdvice` stays — it is about the session you had, which is this app's
business. `test/suites/feedback-placement.js` pins that nothing hides a number
again.

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
- **Chipping is scored on a rate, not on eyeballed feet.** It used to ask for
  the leave in feet per chip, typed into a phone. Nobody standing on a green
  reliably tells 5 ft from 7 ft, and the median-vs-mean machinery built on it —
  a "blow-up" at three times the median — needed a precision the input never
  had. Estimating a thing and reporting it to one decimal place is the error
  this app polices everywhere else. Now: set the distance once, then one tap per
  chip, inside `ShortGame.INSIDE_FT` (3 ft) or not. It is a proportion, so it
  gets `QuietEye.wilson` — the same implementation, not a second copy, because
  at ten-from-ten the normal approximation claims certainty.
- **Distances are never pooled.** Chipping from 5 yards and 40 yards are
  different skills; pooling them measures which distances you chose to practise.
  Each bucket carries its own rate and its own floor.
- **It says putting is the cheapest fix, not the biggest hole** — a 90-shooter
  loses ~6 strokes to approach + short game and only ~2 to putting.

### Drill library (`DrillLibrary`)

All 104 entries from §8, each carrying its section's gate. `admissible(drill,
ctx)` returns `{ok, reasons}` — **a locked drill is shown with its reason, never
filtered out.** Section I are wrappers applied *over* a drill, never instead.

**Not all 104 are drills, and the list used to pretend they were.** A quarter
of it was something else: eight entries told the golfer to read a screen this
app already renders ("trend across five sessions with a band" *is* the Progress
tab), six were gym sessions, two were equipment checks, nine were measurement
sessions where nothing is trained. Listed together with "hit ten shots through
a gate", the real drills were buried in the noise.

Every entry now declares a `kind` — `drill` (79), `measure` (9), `fitness` (6),
`equipment` (2), `review` (8) — and `DrillLibrary.KINDS` carries the sentence
explaining each. The render groups them, **range work first**, with no heading
on the drills themselves (they are what the section is) and a heading on
everything else (because it is not what it looks like). Nothing was deleted: a
trend review and a med-ball throw are both worth doing, they are just not range
work, and a list that says they are is lying about what it offers.

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

### First run (`FirstRun`) — the method, stated before there is data

A new account landed on a home screen with seven empty insight surfaces and an
import button. The thing that distinguishes this app — that it withholds most
of what a launch monitor appears to offer, and says why — was **invisible until
there was data**, and by then the impression is formed. The empty state
meanwhile promised "swing metrics, faults, and improvement trends", two thirds
of which are gated behind floors and conditions nobody had been told about, so
the first session read as the app being broken rather than careful.

**Every number and claim in it is read from the module that owns it** —
`Metrics.TIER` (all three tiers, enumerated from the table), the sample floors,
`FeedbackEngine.MODES[getMode()]` (the mode actually set, in its own words),
`Conditions.BALLS`, `RetentionProbe.MAX_GAP_DAYS`, `ShortGame.ALL.length`. Not
one is typed into the module. An orientation screen is the **easiest place in a
codebase to ship a fabricated constant**: nothing downstream consumes the text,
so a wrong figure would never surface anywhere else. The suite asserts every
metric in `TIER` is placed, so a metric that changes tier moves this screen with
it.

- **Deferred, never marked seen, when something blocking is already up.** The
  agreement gate and the sign-in modal open at boot on the same tick as the
  first home render; an orientation stacked on either swallows the button
  underneath and a new user cannot get past sign-in. Found by the browser scan —
  every module involved was correct on its own.
- **Re-openable from Settings.** A one-shot screen closed on day one and never
  findable again is a worse place to keep the method than the docs.
- It ends on the day-one answer (the off-device short game), the same branch
  `getNextStep` takes with nothing imported.

### The printed yardage card (`@media print`, `#yardagePrintHead`)

A yardage card lives in a golf bag and **outlives the screen it came from**, so
the caveats have to travel with it. On screen a caveat is a paragraph you can
scroll back to; on paper it either printed or it is gone. A card reading
"230 · 7i" with nothing about the ball it was measured on is exactly the
artefact the rest of this codebase spends its time refusing to produce.

`#yardagePrintHead` is built at render time — never hand-written markup — so
its conditions line cannot drift from the table beneath it. It carries the ball
and surface, the session and shot count, the date range, the print date, the
modelled-carry note, the sample floor, and off range balls the "order real,
distances indicative" line.

- **Everything but the book is hidden**, including every other view — printing
  a single-page app otherwise prints all of it.
- **It forces ink on paper.** A dark theme sent to a printer is a solid black
  page.
- **The sparkline and the club colour dots are dropped**: neither means anything
  in one ink colour, and the trend verdict is already there as text.
- **Clubs under the floor keep their row.** On paper a missing row reads as a
  club you do not own; the row saying what it needs is the more useful artefact.

### Correcting the alignment flag (`Store.setAlignment`)

The alignment checkbox only exists during import, so a golfer who levelled the
unit and forgot to tick it had no route back — and `Dispersion` went on
withholding the absolute miss from data that could support it, forever. The
caveat named what was withheld and offered no way to answer it.

- **Both directions.** Someone who ticked it out of habit must be able to take
  it back: a falsely-confirmed alignment is the most expensive wrong flag in the
  file, because bias is the error more shots cannot remove.
- **It re-stamps before it saves.** Every gate downstream reads `_aligned` off
  the *shot*, not the session, so changing the session alone would leave the
  flag right in storage and wrong in every calculation. That ordering is why
  this is one function rather than two lines at a call site.
- **Not a silent toggle.** It goes through `showConfirm` and states the cost of
  getting it wrong — a confirmed-but-unaligned unit makes the app more confident
  in a wrong answer — alongside what confirming unlocks (start-line work at 10
  shots instead of 30).
- The suite pins the asymmetry: confirming releases the absolute miss and does
  **not** move sigma by a hair, because a constant offset cancels out of a
  spread. That is the point, not a coincidence.

### Session tags (`SessionTags`) — a finder, never a variable

The session search filters notes as free text, which answers "the one where I
wrote about the shaft" only if you remember the words you used. A `#tag` is the
same note with a handle on it.

**They live inside the notes field on purpose.** A separate tags array would be
a schema change, a migration, a second thing to sync and another field the
backup format has to carry — for something the golfer is already typing.
Sessions imported before this existed simply have no tags, which is correct.

**`NOT_A_VARIABLE` is the rule.** "Your #newshaft sessions carry 8 yards
further" is exactly the uncontrolled comparison the app refuses everywhere else:
the golfer chose which sessions to tag, nothing was randomised, and nothing
holds ball, surface, club mix or form constant across it. So tags filter the
list and feed the search box, and **no module computes a statistic per tag**.
The suite counts the call sites so a per-tag number would show up as a pile of
them.

Smaller decisions, each with a reason: two-character minimum (`#1` is a shot
number); an over-long token is **not a tag at all** rather than truncated into
one nobody typed; a card tag calls `stopPropagation` so the tap filters instead
of opening the session underneath it; chips set the search box rather than
filtering directly, so there is one filter state instead of two that can
disagree.

### The trend column in the yardage book (`Analytics.clubSeries`)

The book says what you carry; the question straight after it is whether that is
moving, and it could not answer it.

- **The verdict comes from `ClubAnalyzer.calculateClubTrend`**, which already
  existed and already tests against the golfer's own spread. It is now
  exported. A second trend calculator here is how `Benchmarks.TARGET` ended up
  with twelve disagreeing copies — `rules-are-wired.js` fails if the render
  grows its own `changeIsReal`.
- **The sparkline is drawn only when the verdict is real.** A flat line and a
  rising one are read the same way by the eye whatever the caption says, so a
  change the app has just decided is inside the golfer's own noise does not get
  drawn as a direction.
- **`clubSeries` drops sessions below the per-club floor** rather than plotting
  them thin: a three-shot point looks identical to a twenty-shot point on a
  sparkline, and it would move a trend the app refuses to report anywhere else.
- **Three points minimum.** Two is a difference, not a shape — and the two-point
  verdict is still available, as a number with a threshold attached.

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

### The probe window (`RetentionProbe.windowState` / `deadline` / `expired`)

A probe is answerable between `MIN_GAP_HOURS` (20) and `MAX_GAP_DAYS` (10).
That window was written down correctly in `due()` and **never applied to
`openProbes()`** — so a probe nothing could settle sat permanently at the top of
`getNextStep`, the app's one ranked card, asking for a re-test in a window that
had already closed. The usual defect here: a rule with working code that the
surface a golfer reads never reaches.

`windowState()` is three-valued and **`early` is not a failure** — the gap *is*
the method, and 24 hours is the whole point of the retention literature. So
`getNextStep` ranks a probe only when it is `open`, soonest deadline first
(they expire independently), and prints the countdown in the title and on the
card. `daysLeft()` rounds **up**: with 30 hours to go the golfer has today and
tomorrow, and "1 day left" would send them home.

**An expired probe is kept and shown, never deleted.** An efficacy metric that
silently drops its own misses reports a better hit rate than it earned — the
exact failure this module exists to prevent, one level up. `expireStale()` marks
them, `expired()` returns them, and the session detail names them without
scolding.

### What moved since last time (`Features.lastComparable`)

The question a golfer actually has on the way home, answered by `renderSince`
at the top of the session detail rather than left to be assembled by hand on the Progress tab.
Two things stop it being a highlight reel:

1. **The session it reads against is picked by conditions, not by date.**
   `lastComparable()` takes the most recent EARLIER session that passes
   `Conditions.comparable` **and** shares a club. "The previous session" is the
   obvious answer and the wrong one — a premium-ball round read against last
   week's range bucket reports the ball as progress. Nothing comparable returns
   `null`, and the block says so rather than reaching one further back.
2. **The arrows come from `Metrics.changeIsReal`, not from the sign of the
   delta.** `Features.compare(a, b, history)` takes an optional history; with
   it, each row carries `real` (three-valued) and `good` is withheld when
   `real === false`. The number is still shown — a golfer is entitled to see
   what they hit — but a yard of movement gets no colour.

The empty branch distinguishes "you have no earlier sessions" (a fact about the
account) from "you have some, but none on this ball and surface" (a fact about
today, which tells the golfer what would make the next one comparable).

### The range card (`RangeCard`)

The same plan, in the form it is actually used in: one block filling the
screen, readable at arm's length with a club in the other hand. Launched from
the session-detail plan and the Practice view.

**One block at a time is the rule, not the styling.** Rule 9 of the research
base is one cue and never a checklist — the same reason `getNextStep` renders a
single card. A range card showing five blocks at once is exactly the checklist
the app refuses everywhere else, printed larger.

- **It invents nothing.** Every number, drill and caveat comes from the plan
  `PracticePlan` already generated. A feel drill keeps `FEEL_CAVEAT`'s point and
  a locked section keeps its reason — a small screen is not a licence to drop
  the part that says what the data cannot support.
- Ticking a block writes to `PracticeLog` with the join keys, which is what
  lets a later retention check credit the drill.
- The end screen counts what was **logged**, not what was shown, and prints
  `EMPTY_NOTE` only when something was left un-ticked. A caveat with no referent
  reads as a reproach.
- The scroll lock is a class on `<html>` (`range-open`), for the same reason
  `ViewPrefs` is: a class survives a re-render, `hidden` does not.
- `wakeLock` is best-effort and silent on failure — absent on most desktop
  browsers, and it rejects outright when the page is not visible.

### The practice log (`PracticeLog`) — and the asymmetry that defines it

`RetentionProbe.settle` takes a `practised` argument, and its only source was a
question asked days later: *"did you work on X since that session?"* That is a
recall task, and this app refuses to trust recall everywhere else — it will not
let a golfer eyeball a carry number, but it was happy to let them eyeball a
week. `PracticeLog` is the record made **at the time**, by the person doing it.

**`workedOn()` returns `true` or `null` and NEVER `false`.** A log entry proves
practice happened. An empty log proves nothing: phones die, bays have no signal,
and most practice in the world goes unlogged. Reading an empty log as "did not
practise" would manufacture the exact false attribution the probe exists to
prevent, just with the sign flipped — silently, on the app's only efficacy
metric. `EMPTY_NOTE` says the same thing to the golfer.

- `RetentionProbe.evidenceFor(probe, session)` answers what the log can answer
  **before** the golfer is asked. Its window is the probe's own — baseline to
  follow-up. Practice before the baseline is not what the probe is about.
- `settle()` records `practisedSource`: `'logged'` (ticked off at the mat) or
  `'recalled'` (answered days later). `describe()` reads differently for each,
  because a memory is not a reading.
- The write path is the **Done ✓** button on each practice-plan block, which is
  why plan blocks now carry `faultId` and `clubType` — without the join keys a
  ticked-off block is a note to nobody.
- `summary()` counts distinct **days**, not blocks. Three blocks in one
  afternoon is one practice day.

### `applyPaywall` goes FIRST (`test/suites/paywall-order.js`)

It reassigns the block's `innerHTML`, which **destroys every listener already
attached to it** — no error, no log line, just controls that quietly stop
working for signed-out users only. Two renders had it the wrong way round:
fault cards would not expand for a guest, and the plan's tick-off buttons
recorded nothing. Same class of defect as setting `hidden` on a section that
gets re-rendered.

Call it first and attach listeners only when it returns `false`. The return
value is the point of the return value. The suite checks every call site.

### Remembering the venue (`Conditions.remember` / `recall`)

Ball type and surface are the two inputs every condition gate hangs off, and
the import form asked for both from a blank slate every time. **"Not recorded"
is not a neutral default** — it fails `dispersionValid` and `gappingValid`, so
the cheapest answer to give is the one that silently switches off the gapping
sizes, the tail engine and the fault condition gates. A golfer who plays the
same mat bay every week and leaves the menus alone is the most likely way this
app produces a wrong answer.

`remember()` stores ball + surface on save; `prefillConditions()` applies them
on every entry to the meta step (not once at boot — a second import in the same
page life would otherwise show what the menus held at load).

- **Alignment is deliberately NOT remembered, and the box is actively cleared.**
  Ball and surface are properties of the venue; alignment is an *action taken on
  the day* ("I levelled and aligned the unit **this session**"). Carrying it
  forward would assert something the golfer did not do and unlock the tighter
  start-line floor on the strength of it — and bias is exactly the error more
  shots cannot remove.
- **An all-unknown session is not stored**, because the prefill note would then
  claim a choice was carried forward when the form is sitting on its default.
- **The prefill is announced** (`recallNote`, `#conditionsRecall`). A prefill
  nobody can see is the same failure as a blank form: both end with a session
  stamped with conditions nobody chose.
- Corrupt or foreign storage reads as **no recall**, never as a made-up ball type.
- Erasing device storage calls `forget()` — the recall is derived from imported
  sessions, so it goes with them.

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

## Cloud, auth and the database (audited September 2026)

The live project is `jdmahrrxtxqrcpcwmwvx` (eu-west-1). `supabase-setup.sql`
mirrors the applied migrations — **if you change one, change the other.** A
setup script that has drifted from the database it claims to describe is worse
than none, because it is trusted.

### Isolation is verified, not assumed

Seven adversarial checks were run against the live database as a second real
user: A cannot read, update, delete or forge B's rows, and an anonymous caller
sees nothing and can insert nothing. All pass. **This was never broken.** Re-run
them after any policy change — a policy that reads correctly and does not hold
is the same defect class as a gate nothing calls.

### What was actually wrong

1. **The project pauses itself.** Free-tier Supabase suspends after ~7 days
   idle, and it was suspended when this audit started. Every cloud read then
   fails and a signed-in user silently falls back to whatever is cached on the
   device. **That silence was the real bug** — see below. The pause itself needs
   a paid plan or regular use; no code fixes it.
2. **`anon` held full CRUD grants** on `public.sessions`. RLS refused it, so
   nothing was ever exposed — but the grant existed only to be refused, one
   policy edit away from being a hole. Revoked; policies are now scoped `TO
   authenticated` rather than `public`.
3. **No payload ceiling.** `shots` was unbounded user JSON on a shared database.
   RLS stops one user reading another's data; nothing stopped one user filling
   the disk for everyone. Now capped at 5000 shots / 4 MB per row, 2000 rows per
   user — roughly 40x the largest real session, so only a bug or an attack can
   reach it.
4. **The index did not serve the sort.** The only query is
   `.eq('user_id').order('date', desc)`; the index was on `user_id` alone.
5. `FORCE ROW LEVEL SECURITY` is now on, so a future `SECURITY DEFINER`
   function owned by `postgres` cannot silently read every user's rows.
   `service_role` has `BYPASSRLS` and is unaffected, so `delete-account` still
   works.

### The silent partial view (`Store.cloudStatus`, `renderSyncBanner`)

Degrading to local when the cloud is unreachable is right — an outage must never
break the app. Doing it **silently** was not. A signed-in user on a device
holding three of their twenty sessions saw a normal home screen with three
sessions on it, and nothing said the view was partial. That is the one thing
this codebase refuses everywhere else: **an incomplete answer presented as a
complete one.** With a project that pauses itself weekly, it is the normal case.

`getSessions` now records the outcome; the banner renders **above everything**
on the home view, because it changes what every count, trend and yardage below
it *means*. `cloudStatus()` returns `null` for a guest — not `ok`, since a guest
is not a healthy sync. The warning against deleting is the point, not manners:
the realistic harm is a golfer seeing three sessions where there should be
twenty, assuming the app lost the rest, and clearing them out.

### Two dashboard settings this repo cannot set

- **Leaked-password protection is OFF** (Auth → Providers → Email). Supabase
  checks new passwords against HaveIBeenPwned. It is the only outstanding
  security advisor.
- **Auto-pause**, as above.

### `delete-account` edge function

Reviewed and sound: `verify_jwt` on, validates the caller's JWT server-side,
deletes only that caller's rows and auth record, service_role never leaves the
server. `ON DELETE CASCADE` on `user_id` means removing the auth user takes the
data with it, so the explicit row delete is defence in depth.

## Phone layout — the bug that made it "look shit on iPhone"

Three block elements (`#sinceHost`, `#retentionHost`, `#conditionCaveats`) sat
**inside** `.view-header`, which is `display: flex; flex-wrap: nowrap`. Blocks
dropped into a nowrap flex row do not stack under it — they become flex items
*beside* the title and the delete button, and with nothing able to wrap the
session view rendered **605px wide in a 393px viewport**. The whole page then
scrolled sideways with body text crushed into ~90px columns.

They are now siblings below the header, above the content they qualify.

Two other iOS-specific fixes, both in `style.css`:

- **Every focusable text control is ≥16px under 640px wide.** Safari on iOS
  zooms the page when a focused field is smaller than that and **does not zoom
  back out**, so one tap on a dropdown left the app scaled up and scrolling
  sideways for the rest of the visit. The rule is keyed on **width, not
  `pointer: coarse`** — the pointer media feature is not reliably emulated by
  headless Chromium, so a rule written against it cannot be verified by the
  browser checks. It uses `!important` deliberately: there are two separate
  `.form-group select` rules, the first attempt silently lost to the later one,
  and a bare element selector can never outrank a class.
- **`.form-row` uses `minmax(0, 1fr)`.** A grid item's default `min-width: auto`
  means it refuses to shrink below its content, so a `<select>` with a long
  option pushed the import form to 496px.

### `render-scan.js` now fails, and measures width

It previously **only printed** — its exit status was 0 whatever it found, so
every "render scan clean" was really "the scan ran". It now exits non-zero on
text findings, page errors *or* horizontal overflow.

The width check runs at the point a golfer actually lands on the session detail
(straight after an import), not only via `Router.showDetail()` — the latter does
not reproduce the same DOM and missed the bug entirely. **Verified against the
real defect**: with all three hosts put back in the header it reports 605px and
686px and exits 1; with one host it does not reproduce, because a single flex
item shrinks enough to fit. That is why the control has to restore all three.

## SEO, crawlability and production metadata

Guarded by `test/suites/seo-and-production.js`, because this is the category
that rots invisibly: nothing renders it, no user reports it, and the only thing
that reads it has already moved on.

- **One indexable URL.** `sitemap.xml` lists `/` and nothing else. The views are
  hash routes and crawlers discard everything after the `#`, so listing them
  would be listing the same page repeatedly. `robots.txt` allows the site,
  disallows `/test/`, `/node_modules/` and `/supabase/`, and names the sitemap.
- **`og-image.png` is RENDERED, not hand-cropped** (Playwright, from a template),
  so it cannot drift from the 1200×630 the meta tags promise. The suite reads
  the PNG's IHDR and compares it to the tags rather than trusting them.
- **The JSON-LD has no `aggregateRating` and no `review`.** There are no ratings.
  Inventing them for a rich snippet is the same fabrication as
  `CommunityInsights`' fake benchmarks, and it is the single easiest SEO lie to
  tell. It is a `WebApplication`, not a `LocalBusiness` — there is no premises.
- **Multiple `<h1>` is correct here.** `.view { display: none }` means only the
  active view's heading is ever in the accessibility tree, so a heading-navigating
  screen-reader user gets exactly one per view. What was wrong was the home
  heading reading "Home", which describes nothing to the crawler that weights it.
- **`404.html` returns a real 404** (GitHub Pages serves it with that status) and
  deliberately does **not** redirect. Bouncing every bad URL to the homepage
  tells a crawler the wrong URL was fine and tells a person nothing.
- `.nojekyll` makes serving deterministic — Jekyll would otherwise decide which
  files to process.

### The service worker's offline fallback

It handed `index.html` to **every** failed same-origin GET. An image, a JSON file
or a CSV that was merely offline came back as a page of HTML, which does not fail
loudly — it fails as a parse error somewhere unrelated. Only a request whose
`mode === 'navigate'` falls back to the app shell now; everything else gets
`Response.error()`.

### No PII in the console

The auth path logged the signed-in **email address** on every `getUser()` and
every auth event. That is PII on a surface the privacy policy does not mention,
which persists in devtools history and rides along in any screen-share or bug
report. The `authLog()` helper is gated on the same `slDebug` flag as `showDebug`, and it
never takes an email or a token: a log line that must be redacted before it can
be pasted anywhere should not exist.

### The auth forms are real `<form>` elements

They were `<div>`s. Without a form ancestor a browser will not reliably offer to
save or autofill a credential, and Chrome logged "Password field is not contained
in a form" every time the modal opened. The `autocomplete` tokens
(`username` / `current-password` / `new-password`) are what actually tell a
password manager which field is which. Handlers bind to the form's `submit`
rather than the button's `click`, so the keyboard path and the pointer path run
identical code instead of Enter quietly doing nothing.

The 8-character check is **a courtesy, not a control** — the server is the
authority on what it accepts, and anything client-side is bypassed by not using
this page. It exists to fail fast with a clear message.

## Features module (`Features` in app.js)

`Features` is one module among the 58 listed in Core Modules above — not the
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
58 modules across measurement/scoring/coaching/dashboard/reporting, dark mode).
Repo audited end-to-end: no stray files, no non-golf content, only `main` +
active branches exist.
