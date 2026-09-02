# Work log — 31 Aug to 2 Sep 2026

What changed, why, and what was wrong before. Written for whoever picks this up
next, including future me. Commits run `2503479` → `8a787f8`; `app.js` 5,964 → 6,605 lines
(+1,300 of new measurement and coaching logic, −660 of dead modules).

The short version: the app's coaching content was well-built on top of a
measurement layer that was quietly wrong. Most of this work is correcting the
layer underneath rather than adding features on top of it.

## Where it stands right now

- **`main` is green.** `npm test` runs a load gate (executes `app.js` whole in
  jsdom) then 8 suites, 143 assertions.
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

## Still open

**From the research base's §10 build order:** steps 1, 2 and 6 are done
(measurement gates and per-user error, feedback engine, physics layer).

- **Step 3 — next-day retention probe.** The spec's primary efficacy metric and
  the natural partner to the feedback engine. Nothing currently measures whether
  a prescribed drill actually worked, and the guidance-hypothesis evidence says
  within-session improvement is the wrong signal to look at.
- **Step 5 — dispersion-tail engine** feeding Broadie & Ko's curves; the only
  defensible strokes-gained valuation this device supports.
- **Step 8 — drill library rebuild**, ~104 drills restructured around feedback
  scheduling rather than drill content.

**Known and unfixed:**

- The gear-effect residual threshold (5°) is a hand-picked screen, not fitted.
  It should come from the golfer's own residual distribution like everything
  else.
- `PracticePlan` still has no way to know a drill was actually *done* — the
  retention probe settles against whatever the next session happens to contain,
  not against confirmed practice.

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

Sections 1–7 above are in narrative order, which is roughly chronological. The
run from `f425e9e` to `b30bc93` is one continuous correction of the uncertainty
model and is written up as a single arc in §5 rather than commit by commit —
several of those commits correct the one before it, and reading them
individually is more confusing than reading the conclusion.
