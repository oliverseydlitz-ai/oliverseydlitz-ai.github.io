# Work log — 31 Aug to 2 Sep 2026

What changed, why, and what was wrong before. Written for whoever picks this up
next, including future me. Commits run `2503479` → `9a19ad6`; `app.js` 5,964 → 9,993 lines
(+4,690 of new measurement and coaching logic, −660 of dead modules).

The short version: the app's coaching content was well-built on top of a
measurement layer that was quietly wrong. Most of this work is correcting the
layer underneath rather than adding features on top of it.

## Where it stands right now

- **`main` is green.** `npm test` runs a load gate (executes `app.js` whole in
  jsdom) then 18 suites, 703 assertions.
- **Every ± the app shows is the golfer's own shots.** No population constant
  reaches a displayed number; the published rates live in
  Settings → Measurement reference.
- **Every prescription is gated** by metric trust tier, sample floor, and
  recurrence rate — see `Metrics.TIER` and `FaultEngine`'s reporting gates.
- **Spin never drives a drill**, on any ball. With an RPT ball it describes a
  session; without one it is suppressed entirely.
- **Face angle and face-to-path are derived**, never presented as measurements,
  and a suspected off-centre strike invalidates them for that shot.
- **Feedback defaults to tap-to-reveal**, and the retention probe — not
  within-session change — is what says whether anything worked.
- **There is exactly one strokes figure in the app**, it comes from measured
  directional spread through Broadie & Ko's published curves, and it refuses
  outside the band those curves were calibrated on.
- **The home view makes one recommendation, and it ranks.** A due retention
  probe first, then off-device work, then an out-of-line on-course category,
  then a gated drill for the top recurring fault. Every branch says why it sits
  where it does.

If you change any sourced constant, read the section that cites it first. They
are not guesses and the reasoning is why they hold.

---

## 1. Three user-facing defects `2503479`

Found in an end-to-end read of the codebase.

**Share and Export did nothing, on every session card.** Both handlers looked
sessions up with `DB.getSession()` — the IndexedDB store, which nothing has
written to since `Store` moved to MemDB + Supabase. The lookup always returned
`undefined`, so the click silently no-oped. Routed through `Store.getSession()`.

**Form scores were inflated, and could come out `NaN`.** `CSVParser` coerced
every numeric cell with `parseFloat(x) || 0`, so a blank cell and a measured
zero were indistinguishable. Rapsodo leaves club path, attack angle and spin
axis empty when club data isn't picked up, and `ShotScorer`'s
`typeof x === 'number'` guards then read those zeros as a perfectly neutral
path and zero dispersion — full marks for data that was never measured. A shot
with all three blank scored **82, the same as a genuinely good strike**. It now
scores 65.

Worse: `if (shot.attackAngle !== 0)` let `undefined` through when the column was
absent entirely, so `Math.abs(undefined - ideal)` produced `NaN` and poisoned
the whole score. Those sessions rendered a NaN ring and **graded F**.

**`--radius-md` was used 8 times and defined nowhere**, so five JS-built modals
rendered square-cornered against a rounded UI.

---

## 2. Swing-mechanics audit `5439a59` `0892767`

Checked every mechanical claim in the app against Trackman tour data, published
D-plane physics, Rapsodo's accuracy testing and the motor-learning literature.
Working committed at `coaching-calibration-audit.html`.

The drill library and fault→cause mappings held up. The numbers under them did
not.

**The app told golfers PGA pros hit *up* on the driver.** `Benchmarks.DATA` had
`d.pga.aa: 3.0`; the Trackman tour average is **−1.3°**, descending. Off by
4.3° and in the wrong direction, on the most-checked number in golf. The origin
was almost certainly that **+3.0° is the LPGA average** and +2..+5° is what the
tour's longest hitters use — two true facts on the wrong row.

The drills built on it were *correct* and were kept: a positive attack angle
genuinely does add carry. `Benchmarks.TARGET` now holds aim-at figures
separately from tour averages, because conflating those is what caused this.

**Attack angles and smash factors ran soft across the whole table**, and eight
clubs (`1i 2i 3i 2h 3h 4w 5w 7w`) had no benchmark row at all. Rows are now
tagged `[TM]` where Trackman publishes them and `[est]` where interpolated.

**Practice plans were reweighted.** Time had been allocated by a hardcoded
per-fault `severity`, identical for every golfer. Strokes-gained work puts
approach play — not putting — at the centre of scoring differences, so time now
scales by severity × scoring weight × session share × confidence. Every block
prescribes **balls as well as minutes**, with 20s spacing and a ~70% success
target, and a transfer block (one ball, new target, full routine) is appended
to every plan.

**Coaching cues were rewritten to an external focus.** Cues naming the golfer's
own body parts measurably degrade accuracy. "Keep your head still" became
"press the lead heel into the ground". A test now fails if an internal cue
creeps back in.

---

## 3. Rebuild against Research Base v2 `332d15b`

A second research document (`research-base-v2.md`) corrected two foundations of
the audit above. Both corrections changed what the app is allowed to say.

**The MLM2PRO does not measure face angle.** It is not in Rapsodo's metric set.
Face-to-path is therefore *derived*, and error-amplified by the D-plane
inversion. Single-shot readings are not diagnostic.

**`R` falls with loft.** The "85% face" rule taught everywhere is a driver-only
figure. Path's contribution roughly doubles from driver to wedge.

**Metric trust tiers now gate every prescription** (`Metrics.TIER`):

| Tier | Metrics | Rule |
|---|---|---|
| 1 | club speed, ball speed, smash, carry | prescribe freely |
| 2 | launch angle, attack angle, club path | display only |
| 3 | spin rate, spin axis, launch direction, all modelled outputs | never prescribe |

The consequences were not cosmetic:

- **`ShotScorer` awarded 35 of 100 points on side carry and spin axis** — both
  tier 3. Side carry is a ball-flight model output; spin axis scored ICC < 0.26
  in the only study measuring it. The app was scoring golfers on noise. Weight
  moved to smash factor (45) and spin loft (15). Verified: side carry 2 vs 40
  and spin axis 3 vs 35 now produce an identical score.
- **The spin fault was deleted.** Consumer-radar spin limits of agreement run
  −2,628 to +5,103 rpm — wider than the entire 589 rpm amateur-to-tour gap.
- **The "+15–25 yards from hitting up" claim was removed** — it assumes a
  simultaneous re-fit.
- **Sample floors raised**: 10 shots before any club mean (was 4), 15 for
  club-delivery claims, 30 for dispersion tails.

**`FeedbackEngine`** was added, and it is the piece with the most evidence
behind it. Winstein & Schmidt (n=240): constant and faded feedback were
indistinguishable *during* acquisition and at 5–10 minutes — then at 24 hours
the faded group had **35% less error**. An app measuring itself on
within-session improvement cannot see the harm it does. Default is now
tap-to-reveal, against an industry that shows a number after every shot.

**`Conditions`** records ball type and surface per session. A swing robot with
zero variability shows 2–4× the dispersion on range balls, and a wedge flies
*further* on half the spin. Mats hide fat strikes because the sole bounces
instead of the edge digging. Caveats render above any prescription.

---

## 4. Setup guide `e982a45`

Every angular prescription is downstream of how the unit was set up, and
misalignment is the failure mode that hides best: **it doesn't add noise, it
adds a constant bias to every shot**, which averaging cannot remove and more
shots make look *more* confident.

A unit aimed 2° right makes a straight swing read **2.4° open** once
face-to-path amplifies it by 1/R. Every safeguard in the app would agree with
each other and all be wrong together.

Six steps: level within 0.2° front-to-back; ball at 250 cm; Impact Vision to
aim; alignment stick along the on-screen line; **slide it sideways without
rotating** and put the ball where it was; ball on the line in the measurement
box with the stick parallel beside it. Each step states what it protects.

---

## 5. Face angle, and the uncertainty model `f425e9e` → `b30bc93`

A sequence of corrections, several to my own earlier work.

**Single-shot face-to-path was presented as fact** in the shot modal — a bare
number with the authority of ball speed, from a quantity the device doesn't
measure. It now shows the shot with its uncertainty inline *and* the club mean
beside it, which is where the derivation becomes trustworthy.

**Spin was half-handled.** The prescription had been correctly removed but
display was left ungated, so range-ball sessions still showed spin figures as
readings. Two facts point different ways: with an RPT ball the device genuinely
measures spin (MDC 500 rpm over 10 shots); but spin is **not a stable
characteristic between sessions** — on a TrackMan, ICC 0.02–0.60. The ball
fixes the first and cannot fix the second. So spin now describes a session and
never drives a drill. Writing the tests surfaced a `high-spin-axis` fault I had
missed, prescribing from a tier-3 metric.

**Device error is now treated as zero**, and every ± comes from the golfer's own
shots. Two reasons: half the published 1.8° figure (the launch-direction sigma)
was never measured by anyone; and an observed spread *already contains* device
error, so adding a constant on top double-counts it. The practical difference —
two golfers with the same average:

```
consistent   single shot ± 0.1    7i avg 0.5° ± 0.1  (12 shots, spread ±0.1°)
scattered    single shot ± 1.8    7i avg 0.4° ± 1.0  (12 shots, spread ±2.08°)
```

Both previously read `± 1.8` and `± 0.5` — identical, because neither number
looked at the swing. Published rates moved to **Settings → Measurement
reference**, marked with which ones nobody has ever measured.

**Confirmed alignment now unlocks something.** Since it removes bias rather than
noise, a session that records a proper Impact Vision setup drops the start-line
prescriptions from a 30-shot aggregate to the normal 10-shot floor. It
deliberately does *not* unlock spin, modelled outputs, or the reporting floor —
aiming has nothing to do with any of those, and there are tests asserting it
doesn't leak.

**Face angle is now exposed.** A supplied D-plane note turned out to describe
the model the app already used — rearranging its face-angle formula and
subtracting path collapses to exactly `facePath()`. What was missing was the
face angle itself:

```
faceAngle = (LaunchDirection − (1 − R) · ClubPath) / R
```

`R` interpolates piecewise through the anchors anyone actually measured (PING
2020 reconciled with TrackMan), each at its own tour spin loft — driver 14.7°
→ 0.84, 7-iron 27.5° → 0.78, PW 35.2° → 0.71 — and holds at the end anchors
rather than extrapolating. Every club resolves to its own value: `d 0.840,
5w 0.837, 3i 0.825, 5i 0.810, 7i 0.780, 9i 0.726, pw 0.710`.

**Gear effect is detected rather than disclaimed.** The inversion assumes
centre-face contact, and Rapsodo reports no impact location — but when spin axis
is measured, the geometry *predicts* an axis and the device *reports* one. A
large residual opposite the face-to-path is the signature. Affected shots say
"toe strike suspected — face angle unreliable on this shot" instead of showing a
number that looks like the others.

---

## 6. Retention probe and cleanup `1d95df3` `fff2ccf`

**§10 step 3, the spec's primary efficacy metric.** Everything else in the app
measures a session; this measures whether a session *changed anything*.

Winstein & Schmidt is why it has to exist: constant and faded feedback were
indistinguishable during acquisition *and* at 5–10 minutes, separating only at
24 hours where the faded group had 35% less error. Every within-session signal
was blind to a real 35% difference in what was learned — so grading a drill on
whether the numbers improved during the session measures the one window the
evidence says is uninformative.

A probe opens when a session prescribes work, recording the baseline for that
club and metric. A session 20 hours to 10 days later with 8+ shots of the same
club settles it, above the prescriptions. The verdict is three-valued on
purpose: a change smaller than the golfer's own variation reads as **"no
detectable change", never "no improvement"** — the app cannot tell those apart.
With too little history it returns unknown rather than borrowing a population
figure.

**Three faults fired on absent data** — same root cause as the score inflation:
a missing metric coerces to 0, and 0 satisfied `attackAngle > -0.5`,
`launchAngle < 9` and `smashFactor < 1.20`.

**The consistency score was unbounded.** `100 - stdDev(carries)` treats a yard
figure as a percentage and goes negative for any real dispersion. Replaced with
a coefficient-of-variation score, so a driver and a wedge with the same
relative spread score alike.

**17 unreachable modules removed** — ~660 lines with zero call sites, found in
the first review. `app.js` 7,155 → 6,605 lines. Verified by visiting every view
in a browser with zero console errors.

## 7. Test infrastructure `642fa46` `d588e94`

The harness validating all of the above **never executed `app.js`**. It
regex-extracted individual modules, so a broken top-level binding was invisible.

That is exactly how a load-time crash shipped and survived four commits:
`Store.stamp` was exported from **MemDB** by mistake — both modules end with an
identical return line and the edit matched the first — so `app.js` threw at
load, every later `const` sat in the temporal dead zone, and the app did not
start. `node --check` passed. Every suite reported green. Two browser runs
failed and I attributed both to sandbox flakiness; they were the crash.

`npm test` now runs a **load gate** first — whole file in jsdom against the real
`index.html`, then a reachability probe for late declarations. Suites run
against modules from that same load. Proof it works:

```
node --check        passes   syntax is valid
old regex harness   passes   bug invisible
new load gate       FAILS    "stamp is not defined" + dead-zone probe
```

**129 assertions across 7 suites**, in the repo for the first time — they had
existed only in an ephemeral container.

---

## 8. Dispersion-tail engine `ce3a3cd`

Step 5 of the research base's build order, and the last thing that had to exist
before any strokes figure could honestly appear in the app.

### Why a tail engine and not a dispersion statistic

Fairways hit is flat across handicaps — 50% for a scratch, 46% for a 20 —
while penalty rates vary roughly eightfold over the same range. Broadie & Ko's
own account of the mechanism is explicit: a 2° improvement takes a 100-golfer
from ~43% to ~53% fairways but takes OB from 4.4% to 2.0%, and *"the reduction
of shots which end up in trouble has a greater impact on average score."* So
the statistic worth showing is the tail, not the centre and not the SD alone.

### Why it skips the obvious chain

Face angle → start line is known. Face-to-path → curvature is known.
Directional spread → strokes is known. The link nobody has published is
face-angle SD → directional spread, and curvature amplifies start-line error
non-linearly, so it cannot be assumed. The engine therefore measures the spread
directly off the device's own offline outputs and feeds Broadie & Ko's curves
with that. Face-to-path stays as the explanation served next to a drill and
never enters the arithmetic. A "your 4° open face is costing you 1.2 strokes"
figure is fabricated, and this is the structural reason the app cannot produce
one even by accident.

### Four things in it that look wrong until you know why

**Outliers are not trimmed.** Everywhere else in this app a wild value is a
misread to remove. Here the wild value is the measurement. Broadie & Ko model
every non-putt shot as a two-component mixture — good shot with probability
*p*, bad shot otherwise — because real patterns are skewed and heavy-tailed.
Trim, and you delete the bad-shot component and are left with exactly the
Gaussian that under-predicts penalties. Only impossible geometry is screened:
under 20 yards of carry, or past 45° offline.

**Spread survives a misaligned unit; absolute miss does not.** Aiming error is
a constant offset, and a constant offset cancels out of any spread measured
around the golfer's own centre. So sigma is admissible without confirmed
alignment — which is a genuine and slightly surprising exception to the rest of
`Conditions`. How far that centre sits from the target is *not* admissible, and
is withheld until alignment is confirmed.

**The valuation is driver-only.** Broadie & Ko published driver curves. There
is no equivalent table for an 8-iron, so every other club gets the full tail
audit and no strokes figure. That is the honest split, not a gap to fill later.

**Outside 5.5°–7.9° it refuses.** Within 1.5° of the band it clamps to the
nearest calibrated golfer and says so; beyond that there is no number at all.
This means a genuinely wild driver — the golfer who would most like a number —
gets a refusal. That is correct, and widening the band to make the number
appear more often is the easiest available way to put a fabricated figure in
front of a user.

### The core scale, which took two attempts

The engine needs a scale for the good-shot component to measure the bad ones
against. A plain MAD is the obvious choice and is not good enough: a bad-shot
rate around one in eight drags the median deviation up far enough that the cut
lands past the blow-ups. So the scale is refined — re-measure it from the shots
currently inside the cut, un-shrink for the truncation, repeat.

That iteration has two fixed points. The lower one is the core, which is what
is wanted. The upper one is the whole contaminated spread divided by the
truncation factor, and it is self-sustaining: once the cut sits past every
shot, nothing is truncated, so the correction inflates a scale that was never
shrunk, which widens the cut further. The unguarded version walked a 40-shot
driver set from a 7.5° MAD to 9.3° and then reported **zero** bad shots in a
pattern that plainly had five. Only downward steps are taken now. On clean data
the true sigma is already a fixed point, so nothing is given up.

The same investigation corrected my own fixture. The blow-ups I had written
were 15° misses on a 6.5° spread — 2.3 sigma, which a normal curve produces
often enough on its own. The engine calling that an ordinary tail was right and
I was wrong; a real bad shot is 25°+ against that core. Both directions are
pinned by tests now, because the failure mode of a tail detector is symmetric:
missing a real tail and inventing one are equally bad.

### Also removed

Three numbers in the dispersion strip that were ungated and wrong in three
different ways, shown on any session at all:

- a **max-minus-min "spread"**, which grows with sample size and so measured
  how long you practised rather than how straight you hit it;
- an **average miss** and a **bias in yards**, both quoted from range-ball
  sessions (2–4× the dispersion) and from unaligned units (every shot offset by
  the aiming error).

What survives that is the *shape* — the left/on-line/right split — which the
`Conditions` caveat already says is the part that stays real on range balls.
That is all the strip shows now; everything quantitative moved behind the gates.

---

## 9. The ten-item pass `6fe2141` → `551671f`

A second pass over the whole app, ranked by user harm rather than by the build
order. Two of the ten turned out to rest on a false premise and are recorded
here as corrections rather than as work.

### 9.1 Guest sessions were being destroyed silently `6fe2141`

The guest button said "Your data stays on this device only". It stayed nowhere:
everything local went to `MemDB`, a plain array, while `DB` — a complete
IndexedDB store — had sat unused since it was written. Import ninety shots, hit
refresh, lose all of it with no warning. That sentence was the only outright
false statement in an app whose entire argument is that it does not say things
it cannot support.

Fixed as a choice, off by default, because writing a golfer's history to a
device without asking is its own broken promise. `LocalDB` keeps the change to
two lines in `Store`: hydrate IndexedDB into `MemDB` at boot, fan writes out.

Two bugs the tests found that a green suite would have hidden. The switch had
no way to know the store was broken — a first-time guest has nothing to write,
so "write everything in memory" wrote nothing and the switch flipped on cleanly
in a browser about to refuse the first real import; it now round-trips a probe.
And the enabled flag lost a race with boot: `hydrate()` re-reads it, both yield
at every await, so a boot in flight reset the state to a flag not yet written —
a switch reading "on" that stored nothing and gave no reason.

Two pre-existing bugs surfaced alongside it, both in `PersonalCoach`.
`generateAssessment` called `avg(shots.map(ShotScorer.score), undefined)`, and
`ShotScorer` returns null for an unscorable shot — so it read a property off
null and threw on every home render with sessions. `safeRender` caught it,
which is exactly why nobody noticed: the coaching block just never appeared.
The value was assigned to a variable never used. Next to it, a consistency
figure of `100 - stdDev(carry)` — the unbounded-score bug fixed once already
elsewhere, in a second copy that was missed.

### 9.2 Strike quality `b41abe7`

Step 4 of the build order, and on the evidence the most valuable thing in it.
The average male amateur has LPGA club speed — 93 mph against 94 — and makes
7 mph less ball speed. The driver problem is strike, not engine, and smash
factor is tier 1.

It stops at yards. Distance-to-strokes is published and legitimate, so a
strokes figure here would not be the broken face chain — but the app has one
strokes number, in `Dispersion`, and a second down a different road leaves a
golfer holding two figures with no way to know which answers what.

### 9.3 The retention probe was crediting practice that never happened `0baaee3`

The worst finding of the pass, because it sat inside the feature the app puts
forward as its efficacy metric. A probe settled against whatever session came
next, with no way of knowing whether the drill was done — so a golfer who
ignored it entirely was told "the strongest evidence this app can produce that
something worked". The measurement was fine; the attribution was invented.
Same failure as reading strokes off a face angle, one layer up.

The app now asks. All three answers give different, useful readings, and a
change measured without practice becomes the more valuable fact: this is what
your week-to-week movement looks like with nothing behind it.

### 9.4 The gear-effect screen `91fff71`

The last hand-picked number deciding something a golfer sees, and wrong in both
directions at once: too tight for a golfer whose derivation runs noisy, too
loose for a consistent striker whose real toe strike passed as clean. Now the
golfer's own residual spread, centred on their median rather than on zero,
because a systematic offset is a property of the model and not of any strike.

### 9.5 The wrong CSV imported as nothing `82dba9e`

The docs said parsing should move to a web worker. It should not — a Rapsodo
export is a hundred rows. The real defect was that any CSV imported
successfully: a bank statement parses, no columns match, every shot holds only
its row number, and the preview offers to save "48 shots · 1 club" of dashes.
Nothing fails; the mistake surfaces later as a session that analyses to
nothing. Now refused at the door, with the wrong-file and nearly-right cases
distinguished.

### 9.6 Two items that were not what the handover said

**The `:root` blocks do not collide.** The first defines 29 tokens, the second
adds two font variables and redefines none. The two "undefined" tokens a scan
finds are set at runtime and both have declaration fallbacks. Corrected in the
handover rather than repeated.

The dead rules were real — 125 lines orphaned by the 17-module removal. Finding
them needed care: class names here are routinely built in template literals, so
a name that never appears as a literal is usually alive. A naive scan called 36
classes dead and 18 of those were template-built; deleting them would have
silently unstyled the fault cards and the retention verdicts.

**The accessibility module did nothing.** It copied every button's text into an
aria-label (which is already the accessible name, and an aria-label overrides
content, so at best a no-op), and set two tokens plus a body class that no rule
reads. What was missing was every part that makes a dialog usable without a
mouse. Now done with a MutationObserver rather than twenty edits — and the
browser caught what reasoning did not: both first-load gates are open at once,
and an open-order stack put focus in the modal *underneath* the consent gate,
because the gate is earlier in the document but paints on top.

### 9.7 Quiet eye `18fb2f2`, and a tab that never rendered

Step 7. The largest effect in the base, and the only module needing no launch
monitor. The app cannot see gaze, so there is no gaze field anywhere in it.

The statistical core is the honest part: seeing the study's +5% takes about
1,400 putts a side, which is where self-tracking normally dies — so it also
answers the question inverted. Twenty putts resolves 43 points; 500 a side
resolves 9. Your log cannot confirm the effect, but it can bound it.

Found while wiring it: the **Practice tab never rendered**. The nav delegator
handled four views and let the rest fall through to `Router.show()`, which only
toggles visibility. `Router.showPractice` existed, was exported, and was called
from nowhere.

### 9.8 The drill library `551671f`

Step 8, and the last of the build order. 104 drills, each carrying its
section's measurement gate as data. A failing gate returns its reason instead
of hiding the drill, because "hit 30 of these on your own ball and this
unlocks" is actionable and a silently shorter list is not.

---

## 10. Enforcing what the app already claimed `67c53dd` → `d7c932e`

The theme of this pass is a single question asked repeatedly: **is this rule
actually applied anywhere?** Almost every finding is a rule the app states, has
code for, and does not run.

### 10.1 The feedback schedule did nothing `67c53dd` `da87dd2`

The setting existed, the engine existed, and nothing consulted either.
`shouldReveal`, `shouldAskPrediction`, `insideBand` and `fadedFrequency` were
dead; the only calls into `FeedbackEngine` were `getMode` and `setMode` from
the Settings picker. The app's headline differentiator — the one architectural
decision it makes against every other launch monitor — was a radio button.

Wiring it up exposed three things. **Faded was random**, and the table
re-sorts, so the same shot would hide and reveal itself as the golfer clicked
column headers; it is fixed quarters now. **The verdict leaked**: rows keep a
green/amber/red edge from `ShotScorer`, which is a judgement of the shot and
therefore feedback exactly as much as the numbers are — hiding the figures
while colour-coding every row defeats the point. **Bandwidth pooled the bag**,
so on a two-club session it measured the driver-to-wedge gap and reported 53%
of shots; per club, and at 1.5 SD rather than 1, it reports about one in eight.
One SD leaves a third of a normal distribution outside it by construction —
that is ordinary variation with an alarm on it, and it trains someone to ignore
the alarm.

Error estimation followed: call the number before it appears, on scheduled
shots, then score the gap against the golfer's own spread. Inside their spread
reads as "you can feel this shot before you see it"; outside it is the thing
the drill trains.

### 10.2 Device storage never received an import `59aa340`

The worst finding, because it broke a feature shipped in this same session.
`ImportFlow.save()` writes straight to `MemDB`; persistence was wired into
`Store.saveSession`, which the import path never calls. A session imported
*after* device storage was switched on reached memory and nothing else.

It passed its own browser test because that test imported first and toggled the
setting second, and turning the setting on flushes whatever is already in
memory. The real sequence — switch it on once, then import over the following
weeks — loses every session. `Store.saveLocal()` is now the single local write
path.

### 10.3 The fault map joined nothing `a7b30bf`

`DrillLibrary.FAULT_SECTION` was written from the research base's section
headings rather than from `FaultEngine`, so it mapped inventions — `open-face`,
`two-way-miss`, `gapping`, `steep-aoa` — and returned null for almost every
fault the app can raise. Three of its twenty-odd keys were real. The original
test only asserted those three.

All 22 real ids are mapped now, and the suite checks **both directions against
FaultEngine's source**: no fault unmapped, no mapping pointing at a fault that
does not exist.

### 10.4 Sessions were compared across measurement conditions `67882ba`

`Conditions.comparable()` existed for exactly this and nothing called it. Any
two sessions went side by side with green and red arrows, so a range-ball
session against a premium-ball one reported a 22-yard carry "improvement" that
was entirely the ball. The numbers still show; the *verdict* is withheld on the
rows conditions change. Same function was also showing a spin row on sessions
with no RPT ball — a figure the device never measured.

### 10.5 `Benchmarks.TARGET` was never read `67882ba`

The launch-window table hardcoded its "optimal" columns as inline strings: a
second copy of numbers that table already held. That is the precise shape of
the bug the calibration audit fixed once — the +3.0 driver attack angle that is
the *LPGA* average sitting in a table labelled PGA — regrown in a different
place. Correcting the authoritative copy would not have changed one thing a
golfer saw.

### 10.6 Body positions asserted as findings `d7c932e`

Fault cards listed causes under "Root causes", and sixteen of eighty named a
body position: hip rotation, spine tilt, a cupped lead wrist, casting, early
extension. §3.6 is explicit that none are recoverable from ball and club-head
data — dynamic loft is a many-to-one outcome of shaft lean, wrist angle,
forearm rotation, shaft droop, attack angle and ball position simultaneously,
and no published regression from wrist angle to dynamic loft exists anywhere.

The content stays, because those genuinely are the things that produce the
pattern and a phone can check them. The assertion goes: split into "What the
numbers show" and "Often behind it — but not measured here", with a caveat
saying the monitor sees the ball and the club head, not you. Tested in bulk
against the shipped strings rather than by example.

---

## 11. The short game `50bb1fd` `676236a`

Two things here: an export that was corrupting its own file, and a short-game
module built from a fresh literature search.

### 11.1 The export corrupted every row it wrote `50bb1fd`

Settings offered "Export all data (JSON/CSV)" and asked which with
`confirm('JSON (OK) or CSV (Cancel)?')` — a native dialog using OK and Cancel to
mean two different formats, which nobody reads right first time and which some
browsers suppress entirely.

Behind it were **two** CSV writers with different column orders, one inline and
one in `SessionSharing` that nothing called, and **neither escaped anything**.
Session notes are free text: a comma shifted every later column by one, and a
double quote broke the row. The test note — `Windy, gusty — coach said "keep it
low"` — corrupted the whole file. An export is the one artefact that leaves the
app, where none of its caveats travel with it.

One writer now, RFC 4180 quoting, spin gated on `Spin.measured()` so a figure
the device never read does not leave the app, and the conditions exported as
columns so the file can be checked against how it was recorded.

### 11.2 `ShortGame` — 20 drills off a 2024 review `676236a`

Full write-up in **`docs/short-game-evidence.md`**, which is the file to read
before touching any of it.

The spine is a February 2024 systematic review in *Frontiers in Sports and
Active Living* that screened the RCTs on golf motor learning and included 52.
Three methods came out superior within their strategy — **errorless learning**,
**contextual interference**, and **external focus of attention** — and, usefully,
**no single method** came out ahead for cognitive training or augmented
feedback, which is where most commercial golf content lives.

The two with real trials are cited rather than asserted:

- **Maxwell, Masters, Kerr & Weedon (2001).** Putters who learned with few
  errors were unaffected by a loaded secondary task; those who learned by
  missing fell apart. Fewer misses means fewer explicit corrections to test,
  and explicit skill is what breaks under pressure. The failure mode that
  protects against is precisely the chunked chip.
- **Fazeli et al. (2017)**, 30 golfers, six days: random practice putted worse
  during acquisition and better at retention a week later. And a separate
  **chipping** trial — three variations, 54 acquisition trials — found no
  difference during practice and a significant random advantage at retention.

**The limitation is carried everywhere the finding is.** The reviewers state
that over half the 52 trials were underpowered and most used novices on simple
putting tasks. So the direction is well supported and the magnitude, for a
competent golfer on a real green, is not. Drills carry a tier: four say "trial
evidence", five "supported", two say "no trial" and explain they are there
because the failure is real, not because a study backs the format.

Three design decisions worth keeping:

**Errorless before random, in the session builder.** That order is the finding
rather than a preference — random order before anything is repeatable is just
missing in a varied sequence.

**Chipping is scored on proximity, median and mean together.** Strokes gained
around the green is a function of lie and proximity, not of holing out. The gap
between median and mean *is* the chunk rate in feet: on the test set the median
was 5.5 ft and the mean 9.3 ft, one bad contact in ten, and the app says the
thing to work on is the bad one rather than the standard one.

**It refuses to flatter the practice green.** About 65% of shots happen inside
100 yards and amateurs lose most of their short-game strokes to three-putts
outside 25 ft and chunked chips — but a 90-shooter loses ~6 strokes to approach
and short game against ~2 to putting. Putting is the cheapest thing to fix, not
the biggest hole, and the UI says so.

Like `QuietEye`, none of it touches the launch monitor, so both render on a
brand-new account. They are the only part of the app a first-time user can use
on day one.

---

## 12. On-course data, at last `e763446` `e157ce4` `9a19ad6`

### 12.1 Two more from the export audit, and its limitation

**`Spin.summary` was thoroughly tested and called by nothing.** The app told
RPT users "spin is measured here because you used an RPT ball, so this
describes today accurately" — and then showed no session figure anywhere. The
caveat without the number it qualifies. A well-tested function that no code
path reaches still does nothing for a user, and the test coverage is exactly
what let it sit there looking finished.

**`CloudDB.migrateLocalSessions` mattered more than when it was written.** With
device storage on, a guest accumulates months of sessions in IndexedDB, and
signing in merged them into the VIEW without uploading them — they looked safe
and were one browser-data wipe from gone, on an account that would have kept
them. It asks rather than uploading automatically: signing in is not consent to
send a history to a server.

**And the audit's limitation, worth knowing before the next person runs it.**
Functions called *unqualified from inside their own module* are invisible to a
`Module.method` grep. `Trajectory.arc` and `UI.renderSessionList` both came up
dead and both are live — two false positives in ten candidates. Deleting on
that evidence would have broken the ball-flight drawing and the session list.

### 12.2 `MIN_CLUB_SHOTS = 4` never existed `e763446`

CLAUDE.md described the fault gate as "`MIN_CLUB_SHOTS = 4` of that club".
There is no such constant, and the real per-club floor is
`Metrics.MIN_SHOTS_REPORT` — **ten, not four**. The documented gate was under
half the real one.

Not hypothetical damage: earlier in this same session I exported that constant
from `FaultEngine` on the strength of the docs, and the load gate caught it
because the identifier does not resolve. **A wrong constant in documentation is
worse than no constant, because it reads as checked.** The suite now pins all
four real values plus the absence of the invented one.

### 12.3 `Rounds` — where the strokes actually go `9a19ad6`

The app kept saying it could not answer this, and it was right: it had no
on-course data. Now it takes the six numbers a golfer knows at the end of a
round.

It needs no strokes model, because Shot Scope's normative table exists — 90M+
shots, independently replicated across 20,000 golfers and 400,000 rounds. Each
stat is placed on that table **independently**, and the **spread between the
implied handicaps is the diagnosis**. Greens like a 15 and penalties like a 25
is not a 20 across the board; it is a specific, findable set of strokes going
to one thing.

Under five points of spread it says the categories are level and calls that a
real answer rather than hunting for a weakness.

**Fairways hit is logged and never graded**, and the test round shows exactly
why. That golfer hits **50% of fairways — scratch level on that stat** — while
taking five penalties a round, which is off the bottom of the table. Grading
fairways would have called them an elite driver. Fairways move 50% → 46% across
a 28-stroke scoring range; penalties vary eightfold. Placing anyone on fairway
percentage manufactures a weakness out of a rounding error.

It also puts penalties per round beside the measured dispersion tail — the
app's own open question about whether range performance predicts on-course
performance, asked with one golfer's data. **Side by side, explicitly not
correlated:** a few rounds cannot establish that and an r printed on it would
be invented.

One bug caught in test: the clamp flag read "worse than the table" for an 80%
GIR, because it was derived from the value's position on an ascending axis
rather than from the handicap. Higher is better for greens and worse for
penalties; it keys off the scratch row either way now.

---

## 13. Closing the loops `15f42ff` `ac7b249`

Two features that were each correct on their own and joined to nothing.

### 13.1 A diagnosis that led nowhere `15f42ff`

`Rounds` could tell a golfer their penalties play like a 25-handicap and their
greens like a 15, and then stopped. The most specific thing the app knew about
where a golfer's strokes go had no route to the thing the app does about it.

`prescribe()` turns the worst category into the practice work for it, and
`trend()` tracks that one category across rounds so the prescription can be
judged. Both stay inside the module's existing rule: no strokes-gained figure
is invented, because the spread-between-implied-handicaps method needs none.

**A zero-variance baseline broke the significance test.** `trend()` asked
whether a change was larger than the noise, which divides by the baseline
spread — so a golfer with an identical run of rounds (four rounds of 31 putts,
say) had a spread of exactly zero and was told "no detectable change" after
moving to 26. The bug is not the arithmetic, it is that a flat run looks like
perfect precision and is usually a small sample. It now sets a `flat` flag: any
non-zero delta off a flat baseline is reported as real, **with the warning that
a short identical run flatters itself.**

### 13.2 The one card that ranks `ac7b249`

The home view renders seven insight surfaces. The obvious move was an eighth;
the right move was to fix the one that already claims to prioritise.

`SmartRecommendations.getNextStep` was wired and was the weakest logic in the
app. It ranked by **session count** — under five sessions it said "build your
baseline" whatever the data showed. It set `desc` to the same fault name it had
already used as the title, so the card said one thing twice. And it knew
nothing about three things the app had since built: the retention probe, which
is its own stated efficacy metric; the on-course profile, which is outcome
data; and whether the drill it named could be run at all on the balls that
session used.

The order is now an argument, and every branch carries the reason it sits where
it does, rendered under the card:

1. **A due retention probe.** It expires. Whether the last change held is the
   only efficacy evidence this app can produce.
2. **Nothing imported → the short game.** The three off-device modules work on
   a brand-new account; "go get range time" is not a day-one answer.
3. **An out-of-line on-course category.** A range fault is a hypothesis about
   your scoring; a category gap is your scoring. A *level* profile falls
   through rather than manufacturing a weakness.
4. **The top recurring fault** — after `PracticePlan.libraryDrill()` confirms
   the drill is admissible on what that session measured.
5. **Otherwise the transfer block.** Nothing recurring is a result, not an
   empty state.

**Still one card, deliberately.** Rule 9 of the research base is one cue and
never a checklist, and a home screen with seven ranked priorities is a
checklist with better manners.

**A harness bug worth recording.** The browser check reported the *old* card
text after the rewrite and there was nothing wrong with the code: the local
server serves a mirrored copy of the site (the CDN script tags are rewritten to
vendored files, because the route-blocker aborts every non-localhost request),
and the mirror had gone stale. An unvendored tag is a silently missing library
rather than an error, which is why the copy is now a script — `browser/sync.sh`
— that refuses to finish if a CDN tag survives the rewrite. A verification step
that can quietly test the wrong build is worse than no verification step.


---

## Still open

**The §10 build order is finished — all eight steps.** What is left is
judgement rather than a queue.

All three of those are done (§10). What is left:

- **The uncalled-export audit is done** (§12.1). Six confirmed-dead helpers are
  left in place with no user-facing gap — listed in HANDOVER so nobody
  re-audits them — and its false-positive mode is written up.
- **`Rounds` has no trend view.** It profiles the average across rounds but
  does not show a category moving over time, which is the obvious next step now
  that there is on-course data to trend.
- **`FaultEngine`'s drill cues use internal focus** ("hold your wrist angle"),
  which `CoachingMode.TIPS` deliberately avoids. Consistency rather than
  efficacy — external cueing is Tier C, g = 0.15 after bias correction.

**Known and unfixed:**

- `PracticePlan` still has no way to know a drill was actually *done* as a
  plan. The retention probe now asks (§9.3), but the answer is not fed back
  into how the next plan is weighted.

*(Closed `1d95df3` / `fff2ccf`: the three faults that fired on missing data, the
unbounded consistency score, and the 17 unreachable modules.)*

**Repo housekeeping:** 7 `claude/*` branches remain on the remote. This session's
credentials can create and update refs but not delete them (GitHub returns 403),
so removing them needs to be done with your own credentials:

```bash
git push origin --delete \
  claude/codebase-overview-6r9bso claude/codebase-review-bh6njj \
  claude/review-git-branches-hkaqlk claude/supabase-connectors-access-q8xb7i \
  claude/repo-cleanup-golf-audit-npmnmk claude/golf-site-context-handover-lKBr0 \
  claude/hello-qiJhv
```

All are safe: six are fully contained in `main`, and
`golf-site-context-handover` is byte-identical to `archive/v6-ball-flight`,
which preserves 12 commits of physics ball-flight work worth keeping.
`claude/hello-qiJhv` is the one whose single commit dies with it — a superseded
176-line CLAUDE.md.

---

## Mistakes worth remembering

Recorded because the pattern matters more than the individual slips.

**Both bad bugs I introduced were pattern-matching on repeated structures.**
`stamp` matched MemDB's return line instead of Store's identical one;
`node_modules` was committed because a `.gitignore` trailing slash didn't match
a symlink of that name. Textual `replace` on a 7,000-line file with repeated
idioms needs a uniqueness check every time, not just when it feels risky.

**I misread real failures as harness noise, twice.** The browser runs that
failed right after the `stamp` bug were the app crashing, and I said they were
sandbox flakiness. The evidence was there — "element is not visible" on the
consent gate means the app never initialised.

**I published a violation of a rule I had just written.** The per-shot
face-to-path display broke §9.1 two commits after adding the module that
forbids it, because the display layer never asked the module. Rules enforced in
one layer don't enforce themselves in another.

**Two of my own ranked priorities rested on a false premise.** The colliding
`:root` blocks and the "just needs a web worker" CSV parser were both inherited
from an earlier handover and both were wrong on inspection. Ranking work from a
document rather than from the code puts confident items near the top of a list
where they do not belong. Checking first cost minutes; the fix I would have
written for either would have been pure churn.

**A green suite hid two crashes for an unknown number of commits.** The
`PersonalCoach` null dereference threw on every home render with sessions, and
`safeRender` swallowed it — so the symptom was an absent block, not an error.
Defensive rendering makes an app resilient and makes its bugs invisible; the
only reason it surfaced was a browser run printing console errors.

**A feature can pass its own test and still be broken, if the test uses the
convenient order.** The device-storage browser test imported a session and then
turned the setting on. That order works. The order a person uses — turn it on
once, import for weeks — loses everything, and the test never tried it. Write
the test for the sequence a user actually follows, not the one that is easiest
to script.

**"Is this rule applied anywhere?" is a better question than "is this rule
written down?"** Six findings in §10 are rules the app states clearly, has
working code for, and never runs. The codebase reads as careful because the
reasoning is all present in comments; the reasoning being present is not the
same as it executing. An export nothing calls is the cheapest tell.

**Test coverage can be what hides a dead feature.** `Spin.summary` had a
thorough suite and no caller. The tests all passed, the function was correct,
and no user ever saw its output. Coverage answers "does this work", never "is
this reached".

**A wrong constant in documentation is worse than none.** CLAUDE.md's
`MIN_CLUB_SHOTS = 4` does not exist and the real floor is ten. It read as
checked, so I exported it, and only the load gate stopped it. Documented numbers
now get pinned by tests.

**I trusted my own test fixture over the engine, briefly.** A tail detector
was reporting "ordinary" on a set I had built to be heavy-tailed, and my first
move was to change the estimator. The estimator did have a real bug — it ran
away upward — but the fixture was also wrong: 15° misses on a 6.5° spread are
2.3 sigma and genuinely ordinary. Fixing only the code would have produced a
detector that invents tails. When a measurement disagrees with the fixture,
the fixture is a hypothesis too.

**A verification harness can quietly test the wrong build.** After rewriting
the home card, the browser check printed the *old* text and there was nothing
wrong with the code — the local server serves a mirrored copy of the site with
the CDN tags rewritten to vendored files, and the mirror had gone stale. Same
class as the stale test harness below: a check that cannot tell you it is
checking the wrong thing reports green for the wrong reason. It is a script now
(`browser/sync.sh`) that fails if any tag survives the rewrite.

**The obvious feature was the wrong feature.** The home view renders seven
insight surfaces, so an eighth was the easy add. The one that already claimed
to prioritise was ranking by session count and repeating its own title into its
description. Fixing the surface that overpromises beats adding one that
does not exist yet — and the research base's own rule is one cue, never a
checklist.

**A zero-variance baseline is not precision.** `Rounds.trend()` divided by the
baseline spread to ask whether a change beat the noise, so a golfer with four
identical rounds had a spread of zero and was told nothing had changed after a
large real move. A flat short run looks like a perfect measurement and is
usually just a small sample. Any test of the form "is this bigger than the
spread" needs an answer for a spread of zero.

**I let a stale harness report green four times** — `Conditions` missing, `Spin`
missing, a renamed constant, a removed field — and treated each as a one-off
patch rather than a signal the harness was structurally wrong. It was, and
fixing it properly should have happened three failures earlier.

---

## Commit index

Every commit in the session, and the section that explains it.

| Commit | § | Subject |
|---|---|---|
| `2503479` | 1 | Fix dead Share/Export buttons, inflated form scores, and undefined --radius-md |
| `5439a59` | 2 | Correct the swing-mechanics layer and rebuild practice plans on the evidence |
| `0892767` | 2 | docs: mark audit findings as shipped in main @ 5439a59 |
| `332d15b` | 3 | Rebuild the measurement layer against Research Base v2 |
| `e982a45` | 4 | Add a launch-monitor setup and alignment guide |
| `f425e9e` | 5 | Stop presenting single-shot face-to-path as a fact |
| `0670ee7` | 5 | Gate spin on the RPT ball instead of suppressing it everywhere |
| `08d82c1` | 5 | Derive intervals from the golfer's own shots, and let confirmed alignment unlock start-line drills |
| `45fd574` | 5 | Treat device error as zero and quote uncertainty from the golfer's own shots |
| `fbaa3c6` | 5 | Make every shown interval the golfer's own, and move error rates to Settings |
| `f739341` | 5 | Remove the last population constant from an interval |
| `64d44a9` | 5 | Expose estimated face angle, and detect the gear-effect case that invalidates it |
| `b30bc93` | 5 | Fix load-time crash from a misplaced export, and anchor R to the measured clubs |
| `642fa46` | 7 | Add a test runner that loads app.js as a whole file, and commit the suites |
| `d588e94` | 7 | Untrack node_modules |
| `85036fa` | — | docs: add a work log for 31 Aug – 2 Sep |
| `1d95df3` | 6 | Add the retention probe, and fix three faults that fired on missing data |
| `8a787f8` | 6 | Remove 17 unreachable modules |
| `1b63575` | — | docs: correct work-log header stats after the cleanup |
| `998ed92` | — | docs: add an architecture reference |
| `ff1fdd8` | — | Add HANDOVER.md for a session starting cold |
| `ce3a3cd` | 8 | Add the dispersion-tail engine and the app's only strokes valuation |
| `86f526f` | 8 | docs: record the tail engine, and correct the pipeline to eight gates |
| `6fe2141` | 9.1 | Make guest sessions survive a refresh, and stop the button saying they already do |
| `dbadf12` | 9 | Show the dispersion tail across sessions in Progress |
| `b41abe7` | 9.2 | Add the strike-quality engine |
| `0baaee3` | 9.3 | Stop the retention probe crediting practice that never happened |
| `91fff71` | 9.4 | Judge a suspected off-centre strike against the golfer's own residuals |
| `82dba9e` | 9.5 | Refuse the wrong CSV at the door instead of importing it as nothing |
| `45d441d` | 9.6 | Remove CSS left behind by the module cleanup, and correct a note about :root |
| `c9ce37b` | 9.6 | Make the modals usable without a mouse |
| `18fb2f2` | 9.7 | Add the quiet-eye putting module, and fix a Practice tab that never rendered |
| `551671f` | 9.8 | Rebuild the drill library as 104 gated drills |
| `59c963c` | 9 | docs: record the ten-item pass, and correct two claims that were wrong |
| `67c53dd` | 10.1 | Make the feedback schedule actually hide numbers |
| `da87dd2` | 10.1 | Ask the golfer to call the number before revealing it |
| `a7b30bf` | 10.3 | Prescribe from the gated drill library, and fix a fault map that mapped nothing |
| `be83648` | 10 | Show the smash trend in Progress |
| `59aa340` | 10.2 | Fix device storage never receiving an imported session |
| `67882ba` | 10.4/10.5 | Stop comparing sessions across conditions; read targets from one table |
| `d7c932e` | 10.6 | Stop asserting body positions the launch monitor cannot see |
| `7206172` | 10 | docs: record the enforcement pass |
| `50bb1fd` | 11.1 | Fix an export that corrupted its own file, and split it into two buttons |
| `676236a` | 11.2 | Add a short-game module: 20 putting and chipping drills, built on the trials |
| `6d1c6aa` | 11 | docs: write up the short-game research, and index it |
| `e763446` | 12.1/12.2 | Show the spin reading when it is one, and correct a fault gate the docs invented |
| `e157ce4` | 12.1 | Offer to back up device-only sessions when a guest signs in |
| `9a19ad6` | 12.3 | Add round logging — the on-course data the app kept saying it did not have |
| `dfbf36d` | — | docs: record the on-course work and two lessons about verification |
| `15f42ff` | 13.1 | Close the loop from round diagnosis to practice, and trend a category over time |
| `ac7b249` | 13.2 | Make the home screen's one recommendation actually rank things |

Sections 1–7 above are in narrative order, which is roughly chronological. The
run from `f425e9e` to `b30bc93` is one continuous correction of the uncertainty
model and is written up as a single arc in §5 rather than commit by commit —
several of those commits correct the one before it, and reading them
individually is more confusing than reading the conclusion.
