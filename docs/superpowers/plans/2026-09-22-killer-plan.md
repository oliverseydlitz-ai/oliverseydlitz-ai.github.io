# The Killer Plan — from correct to good

Written 22 September 2026 after walking the real app on a 393px phone and a
1440px desktop with two imported sessions, every view, every modal. Everything
below is measured unless it says otherwise.

## STATUS (read this first)

| Phase | What | State |
|---|---|---|
| 0 | Defects visible on the home screen and yardage book | **DONE (22 Sep)** — 0.1–0.8 fixed, each with a guard |
| 1 | The first 60 seconds | **guest button done**; the rest not started |
| 2 | Session detail is 15 phone screens | not started |
| 3 | Finish the queued design work | not started |
| 4 | Speed | not started |
| 5 | Growth | **deliberately deferred** — see the decisions |
| 6 | Supabase dashboard | Oliver only |
| **7** | **QC audit findings (three agents, 22 Sep)** | **in progress** — 30+ items shipped 23 Sep (Done log under Suggested order); C25/C27/C29/C31/C32 held for Phase 9 |
| 8 | External launch checklist, triaged against this codebase | **approved**; 8B.1 (keep-alive) **live** — function applied and verified 22 Sep |
| **9** | **Measurement model v2 — Oliver's direction change (22 Sep)** | **specified, not built — supersedes parts of CLAUDE.md's measurement rules** |
| **10** | **Discoverability — Google, Bing and AI assistants (23 Sep)** | **approved; step 10.1 can start any time, 10.4 waits for Phase 9 + the home screen** |

---

## Decisions (Oliver, 22 Sep 2026) — these set the order of everything below

1. **Remove the 5-second guest delay?** Yes, right away. **Done** — see Phase 1.
2. **Is this meant to make money?** Not now. It is a personal project; if it
   scales and there is a market, a paid tier is a possibility *way* in the
   future. Consequence: nothing is built for payments, and the sign-in "paywall"
   is treated as what it actually is — a sign-in wall on free features — and
   opened up in Phase 1. The `applyPaywall` mechanism is kept dormant, not
   deleted, because a future Pro tier would reuse it.
3. **Users?** None yet. The app is not ready and does not look great, and that
   is the work in progress. Consequence: **product quality comes before growth.**
   Phases 0–3 are the priority; Phase 5 (landing page, analytics, distribution,
   other launch monitors) waits until the app is something worth sending people
   to. Measuring a funnel with no one in it measures nothing.

4. **Everything proposed is approved to implement (Oliver, 22 Sep: "all the
   ideas… write down to implement, I love them").** That covers Phases 1–4, all
   of Phase 7, and 8B/8C, in the suggested orders. It does **not** settle the
   calls that were explicitly left to him — those are listed below and stay
   open until he answers them one by one. First item built: 8B.1, the Supabase
   keep-alive.

## Decided, queued — do in its own commit

- **Drop "TOUR" from the name: "ShotLab TOUR" becomes "ShotLab" (Oliver, 23 Sep:
  "it sounds goofy").** It also argues against the app's own message: the guides and
  `Benchmarks.TARGET` exist because the tour average is *not* your target. Scope, all in
  one commit (82 occurrences across ~35 files on 23 Sep; `grep -rI "ShotLab TOUR"` and
  the `brand-tag` spans):
  - `index.html` (title, meta, og/twitter tags, JSON-LD `name`, header `.brand-tag`
    spans), `manifest.json` (`name` / `short_name`: this is the installed app's name on
    a phone), `404.html`, `llms.txt`, `robots.txt`, `.well-known/security.txt`,
    `contact/index.html`.
  - `app.js` strings and the header brand mark; `style.css` `.brand-tag`. Decide whether
    the mono tag goes entirely or carries something else. Do not leave an empty chip.
  - Both generators (`tools/build-legal-pages.js`, `tools/build-guide-pages.js`: page
    titles, nav brand, JSON-LD publisher, CTA), then regenerate the legal and guide pages.
  - `TERMS.md` / `PRIVACY.md` name the service: edit, **bump the version**, update
    `Agreement.VERSION`, regenerate `/terms/` and `/privacy/` (`legal-docs.js` pins it).
  - `tools/build-og-image.js`: re-render `og-image.png` if the card shows the name.
  - `DESIGN.md` (regenerate) and `CLAUDE.md` / `SECURITY.md` / `LICENSE` wording.
  - Leave historical plans/specs alone; they are records.
  - Before committing: check that "ShotLab" alone doesn't clash with an existing golf
    product or trademark. Unverified as of 23 Sep.
  - Bump the service worker; run `npm test` + the render scan both ways (the header
    brand is on every view, and the nav width is tight at 393px).

## Still open — Oliver's calls, not taken

- **Default theme.** Recommendation: follow the phone's system setting rather
  than force dark. This is used outdoors at a range, and light reads better in
  sunlight. Currently undecided in CLAUDE.md.
- **The logo.** The pine-green favicon contradicts the graphite + orange app.
  Recommendation: move the icons to the orange flag mark the header already
  uses. CLAUDE.md says do not unify it unprompted — so it waits for a yes.
- **The cookie banner.** It may not be legally required at all if every key in
  PRIVACY.md's storage table is strictly necessary. That is a legal check, not
  an assumption to build on.
- **A deploy-time minify step** (Phase 4). It bends the "no build step"
  principle, so it is a yes/no, not a default.
- **C9 — may the app prescribe from attack angle?** See Phase 7.
- **A custom domain** (8B.11) — it costs money and changes the canonical URL.

---

## What is already strong — do not dilute it

The measurement-honesty engine is the moat: trust tiers, sample floors,
condition gates, the one ranked recommendation, the refusals. 65 suites,
render scan clean both ways. Everything below is about **presenting** that
work, not replacing it. A redesign that restores a bare number the gates
withheld is a regression, however good it looks.

---

## Phase 0 — defects, small, do first

| # | Defect | Measured | State |
|---|---|---|---|
| 0.1 | **Two "Consistency" figures on one screen that disagree.** `EnhancedMetricsWidget` and `QuickStats` both render one, and "Form grade B" sits beside "Form 83". Two roads to one label is the drift this repo refuses everywhere else. | 87% vs 89% on the same data | **done** — the widget pooled every shot across all balls and surfaces and every cell duplicated something else on the screen; module removed (58 modules) |
| 0.2 | **Tip-of-the-day is eight hand-typed lines.** One sends the golfer to a Learning Library this repo established has no lessons; "consistency matters more than distance" is unsourced, and the strokes-gained literature the app is built on does not say it off the tee. Fails "before adding any number to a screen, ask where it comes from". | 8 literals in `renderHome` | **done** — removed |
| 0.3 | **Every view title has no gutter on a phone.** | `left: 0px` on all views, cards sit at 16px | **done** — a later `padding` shorthand killed the phone rule's `padding-inline`. `cascade-overrides.js` now fails on any @media declaration a later base rule kills (it also found a desktop score-ring size that had never applied) |
| 0.4 | **The yardage book table scrolls sideways** — on the one screen you stand over a shot with — and the trend column is off-screen. | 723px of table in a 359px box | **done** — under 640px each club is a block: club + carry, trend, then a labelled row. Screen only; print keeps the table |
| 0.5 | **The same fault shows twice on home** — once as the ranked card, again as an alert directly under it. | | **done** — the alert for the fault the ranked card carries is dropped; pinned in `bands.js` |
| 0.6 | Desktop: the "Consistency" label spills out of its stat card; "Tap to go" is shown to a mouse. | | **done** — the spill was in the removed widget; the CTA reads "Open →" |
| 0.7 | **`render-scan.js` cannot see 0.3, 0.4 or 0.6** — it measures page-level overflow only. Extend it: clipped inner overflow, view-title gutter, label outside its box. Prove each against the real defect first, the same way every other guard here was proved. | | **done** — CLIPPED / GUTTER / SPILL checks, proved by restoring both real defects (exit 1). Three detail tables that still clip are a named ratchet pointing at 2.6; the shot log is marked `data-hscroll` as a deliberate data grid |
| 0.8 | **A greeting told golfers "you're getting better!"** — picked by a hash of the session id, shown with two sessions and "not enough history" on every trend. | found during Phase 0 | **done** — no greeting makes a claim; `personal-coach.js` checks every reachable greeting |

## Phase 1 — the first 60 seconds (the biggest lever)

A new visitor hit **four modals in a row** before seeing the app: terms (two
checkboxes) → storage notice → sign-in → orientation.

- **1.1 — Guest option visible immediately. DONE (22 Sep).** It was hidden for
  five seconds on a first visit as a sign-up nudge. In the sandbox it appeared
  after 3.8s; now 10ms. A returning guest (`slGuestChosen`) is no longer shown
  the sign-in modal on every load at all, which keeps that storage key doing
  exactly what PRIVACY.md says it does.
- **1.2 — Collapse the gates to one screen.** Terms + storage consent together;
  no sign-in question on first load (offer it in context, see 1.5); `FirstRun`
  becomes the empty home state rather than a modal stacked on top of it.
  Keep the liability acknowledgement — it exists for a reason (beta software,
  physical activity) — just not as one gate among four.
- **1.3 — "Try it with a sample session."** Most visitors will not have a
  Rapsodo CSV on the phone in their hand. Load a realistic fixture as a demo,
  clearly labelled as sample data, so the product is visible before anything is
  asked of them. It must be removable in one tap and must never mix into the
  golfer's own stats.
- **1.4 — Guests lose their first import.** The guest copy says sessions are
  "lost when you close the tab", because `LocalDB` is opt-in and off. Losing
  someone's first upload is the worst first experience there is. Default device
  storage **on** for guests, keep the notice, make it opt-*out*. Check the
  PRIVACY.md wording and `legal-docs.js` before shipping — this changes a
  statement of fact about the system.
- **1.5 — Open the sign-in wall.** Fault detection, the practice plan, the
  session quality score and coaching notes are blurred for guests — the core
  product, gated on a free account. It is also inconsistent: the home view
  shows a guest their top fault and the session detail blurs it. Show guests
  everything. Ask for sign-in when it has a value to the golfer: "keep this
  across devices", straight after the first import. `applyPaywall` stays in the
  code, unused, for a possible future Pro tier (decision 2).

## Phase 2 — the session detail is 12,600px tall

About **15 phone screens**, 10 sections. The first screen is "since your last
session", where most rows read "not enough history to call it", followed by a
long caveat block and then a blurred panel. The answer is buried under the
reasons it might be wrong.

- **2.1 — Answer first.** Screen one: carry per club with its ±, the one thing
  to work on for *this* session, strike quality's headline. Caveats become a
  single "what this session can't tell you" line that expands. Every caveat
  survives; it just stops being the opening act.
- **2.2 — Collapse the "not enough history" rows** into one line saying what
  history would unlock them.
- **2.3 — Make the tab bar real.** Overview / Flight / Dispersion / Gapping /
  Faults already exists. Each tab should swap its content in and fit in ~2
  screens, rather than index into one 12k page.
- **2.4 — Same treatment for Practice (6,400px) and Progress (4,000px, seven
  charts).**
- **2.5 — The home view grades you three ways.** "Form 83" in the top strip,
  "Overall grade C, 64/100" in the coach panel, and the session quality score
  on the detail. They are different calculations with different names, so it is
  not the outright contradiction 0.1 was — but three verdicts on one account is
  two too many for a screen whose rule is one cue. Pick one headline grade and
  say what it is computed on.
- **2.6 — Three detail tables still side-scroll on a phone:** gapping (~14px
  over), benchmarking and launch windows. `render-scan.js` lists them in
  `KNOWN_CLIPPED` pointing here; strike each off as its tab is rebuilt.

## Phase 3 — finish the design work already queued

- **3.1** — The 13 remaining silent overrides in `cascade-overrides.js`, done
  per component with screenshots. They are layout and motion, not type.
- **3.2** — The two open calls above (theme default, logo).
- **3.3** — A 1440px pass. Nothing had been looked at above 393px before this
  audit; the desktop home is a phone layout in a 940px column.

## Phase 4 — speed

- **4.1** — First load is ~375KB gzipped of JS + CSS, all fetched up front.
  Supabase (53KB gz) is only needed at sign-in; Chart.js (68KB gz) only on the
  detail and Progress views. Load both on demand — compatible with no-build.
- **4.2** — 29% of `app.js` is comments. A GitHub Action that strips comments
  and minifies into the Pages artifact would ship ~30% less while keeping the
  source readable. **Needs Oliver's yes** — see "Still open".

## Phase 5 — growth (DEFERRED until Phases 0–2 land)

Recorded so it is not lost, not scheduled.

- **5.1 — A landing section.** A visitor from search or a shared link lands on a
  legal modal. A static, crawlable section first: what it does, one screenshot,
  the demo button. The og-image line — "Your launch monitor says less than you
  think" — is a genuinely differentiated pitch; use it.
- **5.2 — First-party, anonymous funnel counts.** No analytics is deliberate and
  right on the EU-law grounds. The version that fits: a tiny Supabase table of
  anonymous funnel steps, no PII, no third-party request. Needs a PRIVACY.md
  update. Only worth building once there is traffic to count.
- **5.3 — Distribution.** MLM2PRO owner communities: Facebook groups,
  r/Golfsimulator, Rapsodo's forums.
- **5.4 — Other launch monitors.** Garmin R10, Mevo+, Trackman range. The
  biggest market multiplier, and the most expensive: every device has different
  accuracy, so each needs its own trust tiers. Research first, parser second.
  `CSVParser` currently refuses non-Rapsodo files at the door, correctly.
- **5.5 — Money.** Way in the future, per decision 2. If it happens, the natural
  seam is `applyPaywall` and a Pro tier — not before there are users who would
  pay for something.

## Phase 6 — Supabase dashboard (only Oliver can do these)

1. **Redirect allowlist** (Auth → URL Configuration) — still the highest-value
   unchecked security item. Implicit OAuth puts the token in the URL fragment;
   a loose wildcard can hand it to another domain.
2. **Leaked-password protection** — still off.
3. **Auto-pause** — the free tier suspends after ~7 days idle, and signed-in
   cloud reads fail every time it does.

A read-only SQL call from this session was refused with a password
authentication failure, so live user and session counts were not re-read.
CLAUDE.md's last figure is 10 users, 9 sessions.


---

## Phase 7 — the QC audit (22 Sep 2026)

Three background agents audited the served app, each through one lens: **visual/UX**, **correctness and data honesty**, and **accessibility/performance/robustness**. Every finding was reproduced in a real browser or read from the code. They were **stopped early** at Oliver's request, because usage was running low, and asked to report what they had. Each one's uncovered ground is listed at the end of this phase, and their briefs are in `qc-agent-briefs.md` next to this file, so a rerun picks up exactly where they stopped.

**Verified by hand before recording.** These were checked against the code and are confirmed, not just reported: R1 (service-worker cache), R3 (email in console, `app.js:10290`), V3 (heatmap window), C3 (score buckets), C5 (probe metric), C7 (wedge smash threshold). Treat the rest as agent-reported: reproduced by the agent, with evidence in its report, but not re-checked by the main session.

**The headline, in the correctness agent's words:** the honesty machinery (floors, tiers, per-club rules, alignment gates) lives in the new modules. The legacy engine the golfer reads *first* bypasses it: FaultEngine's session rules, the metrics strip, `Features.focus`, the coach's notes and the score banner. So one page contradicts itself:
- Strike says there is no fade, while the fault list says "fatigue on 73/73 shots".
- The tail audit says the tail is ordinary, while the fault list says "wide dispersion".
- The bench says attack angle is never prescribed from, while the #1 recommendation is an attack-angle drill that asks for a divot off a teed driver.

**The fix is mostly deletion and routing onto `Strike`, `Dispersion`, `bagConsistency` and `FaultEngine.rate`**, not new code.

### 7A — trust: wrong numbers, broken rules, security (do these first)

| ID | Sev | Finding | Where | Fix | Effort |
|---|---|---|---|---|---|
| R1 | HIGH | **The service worker serves every cross-origin GET cache-first until the next version bump.** That includes Supabase `GET /auth/v1/user` and `GET /rest/v1/sessions`, keyed without the Authorization header. Effects: a stale identity after switching accounts; other devices' sessions never appear; a paused project "succeeds" from cache, so the `cloudStatus` banner never fires; logout clears nothing. It is a likely root cause of the old "wrong email after switching accounts" bug. **Verified in code.** | `sw.js` fetch handler, `else` branch | Do not intercept cross-origin requests at all (`if (!sameOrigin) return;`), since everything is self-hosted now. Bump the cache version. On logout, delete non-app cache entries. | S |
| C3 | HIGH | **The session quality buckets are mislabelled.** `['Elite',…].reverse()` indexed with `4-i` counts shots scored 75–100 as "Poor" and paints them green. A score of exactly 100 is never counted. **Verified.** | `app.js` ~8379 | Build the buckets from one `[{label,lo,hi}]` array, with the top bucket including 100, and add a unit test. | S |
| C5 | HIGH | **Every retention probe measures smash factor, whatever fault opened it.** No rule defines `probeMetric`, so the fallback is `smashFactor`. The card promises it "settles whether Negative Attack Angle on Driver held" and then measures smash. This is the app's *only* efficacy metric. **Verified.** | `app.js:5058` | Give each rule a tier-1 `probeMetric` that is relevant to it, or no probe at all. Name the measured metric on the card. | M |
| C6 | HIGH | **Probes are opened by *viewing* a session.** Re-viewing an older session re-baselines the live probe, and a backdated import creates an already-expired probe that counts against the hit rate. Partly inferred from code; the expired case was reproduced. | `renderDetail` → `RetentionProbe.open` ~7743; `open()` ~3987 | Open a probe once, at import, for the newest session only. Never open one whose window has already closed. Expire relative to the sessions that exist, not only `Date.now()`. | M |
| C1 | HIGH | **"Fatigue Pattern Detected — 73 of 73 shots"** fires whenever a golfer hits driver and then an iron: the rule compares first-half and second-half ball speed across the pooled bag. On the same page, Strike says "No measurable fade", and the plan gives the fault a 10-minute block. | `app.js` 4952–4973, 5062–5072 | Delete the rule and route to `Strike.fatigue`, which is per club with a 15-shot floor. | S |
| C2 | HIGH | **"Wide Shot Dispersion — 73 of 73"** is `stdDev(sideCarry) > 20` pooled across clubs. That is a tier-3 modelled output with no ball gate and no 30-shot floor, and it is plan block #1. On the same page, the tail audit says "an ordinary tail". | `app.js` 4976–5000 | Delete the rule; `Dispersion` raises it per club, gated. | S |
| C7 | HIGH | **The poor-contact threshold is `smashMin` = 1.33 for every non-wood.** `Benchmarks.DATA` puts the PGA *average* at 1.32 for 9i, 1.28 PW, 1.24 SW and 1.20 LW, so tour-level wedge strikes trip a high-severity fault. `ShotScorer` has the same flaw, with 1.41 as "elite" for every iron. **Verified.** | `app.js:4528`, ShotScorer ~5095 | Derive both thresholds from `Benchmarks.DATA[club]`, the single copy. | S |
| C8 | HIGH | **An absolute left/right split is shown without alignment.** "26 (36%) LEFT · 21 (29%) ON LINE · 26 (36%) RIGHT" is pooled across clubs and sums to 101%, on a session marked "Alignment not confirmed". CLAUDE.md says absolute bias is withheld until alignment is confirmed. | Shot dispersion, Swing DNA | Gate both on `_aligned`, and split per club. | S |
| C9 | HIGH | **The copy says attack angle is never prescribed from; the engine prescribes from it.** The Bench caveat reads "nothing is prescribed from them", but the #1 recommendation, the coach's "#1 priority" and a 15-minute plan block are all attack-angle work. `Metrics.canPrescribe` is never consulted by FaultEngine or PracticePlan. | `app.js:8783`, 4650, 588 | Decide the rule, then make the copy and the code agree: either tier-2 faults are display-only, or the caveat says "prescribed only as a recurring pattern above 15 shots". **Oliver's call** — see open questions below. | S/M |
| C10 | HIGH | **The drill picker ignores the club and the entry kind.** A driver attack-angle fault gets the "Divot-line drill", but a teed driver takes no divot, and "Tee-height ladder (driver)" sits in the same section. Fatigue gets a measurement session; wide dispersion gets "compute p90 by hand", which the app already renders. | `PracticePlan.libraryDrill` ~5573 | Filter to `kind === 'drill'`, prefer a club match, and keep checkable-first ordering. | S |
| C4 | HIGH | **The session metrics strip defaults to "All", which pools the bag.** It shows "CARRY 201yds" for a driver-plus-7-iron session, which is nobody's club. "Carry Total" is `totalDistance`, which is tier 3. There is no sample floor: a 3-shot file gets headline numbers. | `app.js` 8398–8425 | Default to the most-hit club, as `QuickStats.pick` does. Drop total. Gate each value at `MIN_SHOTS_REPORT`. | M |
| C12 | HIGH | **Junk rows become shots.** A blank row is counted as a shot; an empty Club Type creates a phantom club ("7i/", and an unlabelled yardage row). A smash of 1.714 is excluded from records, yet the same shot's ball speed is the personal best. | `CSVParser.parse` ~4420; `CEILING` applied to records only | Drop rows with no club or no ball speed at parse time and report the count in the preview. Apply `CEILING` to the whole shot before any mean. | M |
| R3 | HIGH | **The signed-in email is logged to the console** on every load and on every cloud save. `showDebug` is not gated on `slDebug` (only `authLog` is), which contradicts CLAUDE.md's "No PII in the console". **Verified** at `app.js:10290`. | `app.js` 1163–1167, 10290 | Remove the email interpolation, gate `showDebug` on `slDebug`, and add a source-scan test. | S |
| C16 | MED | **A second strokes figure.** Drill library section A says "roughly 0.8–1.3 strokes a round available", and section B restates the Dispersion valuation. The app keeps exactly one strokes figure. | `app.js:2676` | Remove A's strokes clause, and point B at the Dispersion tail. | S |
| C17 | MED | **Section D quotes the retracted "±1.8° of single-shot noise"**, which CLAUDE.md says no one ever measured (`DEVICE_ERROR = 0`). | DrillLibrary section D | Replace with "quoted from your own shot-to-shot spread". | S |
| C13 | MED | **Grades and praise from 3 shots.** A 3-shot file gets "80 FORM", "Overall grade C", "Very tight distance grouping" and "Excellent, consistent session!", while Swing DNA and Benchmarks correctly refuse. | Home, coach panel | Put the grades and praise behind `MIN_SHOTS_REPORT` per club. | S |
| C14 | MED | **The coach's consistency sentence is computed on carry pooled across the bag.** It says "Widely varied" on every two-club account, and "Very tight" for any single-club session. | `generateAssessment` ~12118 | Use `bagConsistency()` or delete the line. | S |
| C15 | MED | **Three smash figures for one club on one page:** 1.42 (coach), 1.42 (DNA) and 1.440 (Strike). The copy says "past the amateur average" when the values are equal, and section A quotes the amateur average as 1.430 against `Benchmarks.DATA`'s 1.42. | Detail | Use one trimmed per-club smash everywhere, say "at" when equal, and read the benchmark from `Benchmarks.DATA`. | S |
| C18 | MED | **"237 ± 1 yds" is the interval of the mean, printed beside a number used for club selection.** A golfer reads it as "carries 236–238"; the real shot spread is ±7. | Yardage book, home strip | Label it, or lead with the spread/range. | S |
| C19 | MED | **The same club's carry differs across surfaces:** driver 236 vs 237, and 7i 157 vs 160. The gapping table's "Big gap 81 yds" is just the clubs that were not hit. | Progress, yardages, gapping | Use one per-club carry function behind all three; "big gap" should name the missing clubs. | S–M |
| C20 | MED | **Progress shows "−5.6° CHANGE"** while the text says it takes five sessions to judge a change. The delta's arithmetic is also unverified (medium confidence). | Progress, directional spread | Withhold the change below the floor, and check the calculation. | S |
| C21 | MED | **Three surfaces name three different #1 priorities:** the coach, the plan and the home card. | | One ranking (`getNextStep`) that the others cite. EXTENDS 2.5. | S |
| C22 | LOW | **Settings contradicts itself about storage:** "held in memory only" vs "Data stored — Locally on device". The version reads "2.0.0". | Settings → About | Render the storage line from `LocalDB.describe()`. EXTENDS 1.4. | S |
| C23 | LOW | **Records show tier-3 values without a label:** "HIGHEST APEX", "LONGEST TOTAL", and "LONGEST CARRY" not labelled modelled. A 31 ft apex on a 237 yd drive is implausible, so the unit needs checking against a real export. | Personal bests | Label records "modelled"; consider dropping apex and total. | S |
| C24 | LOW | **Copy errors:** "1 clubs"; "a 11-yard"; a superlative across 1 club; "within 0.0 mph"; "Smart routines personalized…" (US spelling, marketing language); Settings still lists "Compare to Community" and "Learning Library"; "Poor Contact / Thin Strike" names a strike type the monitor cannot see. | various | Copy pass. | S |

### 7B — broken or unusable UI

| ID | Sev | Finding | Fix | Effort |
|---|---|---|---|---|
| V3 | HIGH | **The practice heatmap never shows the current week.** The grid steps back 125 days, then shifts back again to Monday, so it ends up to 6 days *before* today. **Verified.** | Anchor the grid on the week containing today, and render future days empty. | S |
| V1 | HIGH | **Home on a phone: two sticky bars stack while scrolling.** The 138px quick-stats strip and the 52px header are both `top:0`. The header covers the strip's top row and leaves an orphan "FORM" label, and the conditions line that qualifies the numbers scrolls away. | Make the quick-stats strip non-sticky on phones. | S |
| V2 | HIGH | **On phones, the session card's score block drops below Share/Export**, misaligned over the card's left rule. | Keep a 2-column header row on phones, with the ring on the right. | S |
| V4 | HIGH | **Two "Form" numbers on home: "83 FORM" and "Current form B 84/100".** Same label, different number. EXTENDS 2.5. | One Form, from one function. | S |
| V5 / C11 | HIGH | **The same fault appears 4 times on home**, with two drills, two percentages (53% vs 14%) and opposite confidence verdicts. `Features.focus` divides by all shots of all clubs and has its own confidence scale. EXTENDS 0.5. | Drop the coach "Focus" line and the "Work on this" tile, or route them through `fault.rate` and `fault.confidence`. Turn the red per-card badges into a neutral count. | S–M |
| R2 | HIGH | **Keyboard focus breaks for the whole page life after closing FirstRun with ✕.** Modals closed by `.remove()` never leave the focus-trap stack, so Tab keeps focusing a detached node. | Prune disconnected entries in `AccessibilityEnhancements.top()`, or observe removals. | S |
| R5 | MED | **Ctrl/Cmd+P is hijacked to open Progress**, which blocks the browser print shortcut the printable yardage card depends on. Ctrl+H is taken too. The shortcuts overlay has no role and leaks its Escape listener. | Drop the P and H bindings; give the overlay the `modal-overlay` class. | S |
| R4 | HIGH | **Pointer-only controls:** the ranked card, the last-session tile, the yardage drill card and every shot-log row are click-only `div`s and `tr`s with no keyboard access. | Render them as `<button>` or `<a>`; give table rows a button in the first cell. | S–M |
| V6 | HIGH | **The session detail tab bar clips "FAU…" at 393px** with no scroll cue. EXTENDS 2.3. | Add an edge fade, or shorter labels. | S |
| V11 | MED | **The yardage book's first club row starts at y≈640**, below a drill card, the print button and a 6-line caveat. EXTENDS 2.1. | Put the book first and collapse the caveat. | S |
| R6 | MED | **The SW caches 404 responses and every `?query` variant**, so the cache grows without bound. | Only `put` when `res.ok`, and ignore the search string. | S |
| R7 | MED | **The SW is network-first with no timeout,** so on a hanging connection ("lie-fi" at a range) the page never loads. | Race the fetch against a ~3s timeout, then serve from cache. | S |

### 7C — polish, accessibility, consistency (all small)

- **V7** — The detail title wraps to 2 lines; give the back link its own row.
- **V8** — Same-day sessions can't be told apart on cards, the compare picker or chart axes; add the time and a ball/surface chip.
- **V9** — Progress charts use auto-scaled spline curves with area fill, which exaggerates noise; use `tension:0`, no fill, and a minimum y-span.
- **V10** — The progress sparklines read as divider rules; add endpoint dots and hide them below 3 points.
- **V12** — The Share/Export buttons are off-system: 4px radius, green and blue text.
- **V13** — Odd item counts in 2- and 3-column grids leave orphan cells.
- **V14** — There are three different section-heading patterns.
- **V15** — The "Log a round" form has inconsistent inputs and an unstyled Save button.
- **V16** — "Club benchmarks" runs into the next section.
- **V17** — Empty states set in monospace with bad hyphenation and no CTA; the practice empty state is 6,195px tall.
- **V18** — One view has three names: "BAG", "YARDAGES" and "YARDAGE BOOK".
- **V19** — Unexplained 01–06 indices and orange rules on the detail stat tiles.
- **V20** — Shot-log colour is painted on vertical cell borders and looks like a glitch.
- **V21** — The apex label is clipped ("31 π").
- **V22** — The dispersion legend's centre-line swatch is an empty box.
- **V23** — An unlabelled club dot on the Drill Focus card.
- **V24** — The coach panel heading is a varying pick; use one fixed line.
- **R8** — Canvases have no `role="img"` or `aria-label`; set them at the single `new Chart(` site.
- **R9** — No `aria-current` on the bottom nav or the subnav.
- **R10** — The toast has no `role="status"` or `aria-live`.
- **R11** — Undersized targets: `#fixAlignment` is 19px tall, the short-game selects 19px, `#qeProtocol` 13px.
- **R12** — `#goalMetric` has no accessible name.
- **R13** — Yardages goes h1 → h3 → h2.
- **R14** — No skip link.
- **R15** — The CSP has `img-src … https:`; tighten it to `'self' data:`.
- **R16** — The manifest theme colours are light-only. EXTENDS the default-theme question.
- **R17** — `test/browser/sync.sh` omits favicon, manifest, icons and 404.html, so the SW `addAll` fails in the mirror and no browser check can test the service worker.
- **R18** — `purgeAuthStorage()` has no try/catch, so Google sign-in throws in a storage-blocked browser; `authLog` references an undefined `msg` when `slDebug=1`.

### 7D — correctness rerun (C25–C49, 22 Sep, completed)

The correctness agent ran its uncovered ground to the end. The main session verified **C25** (`app.js:8932`, a `'Face Angle'` row) and **C27** (`RetentionProbe.due` contains no `Conditions.comparable` check). The rest are agent-reproduced; the evidence and scripts were in the session scratchpad.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| **C25** | HIGH | **The shot modal states a face angle on every shot, plus a club mean** ("Face Angle −2.1° ± 2.2"). This breaks measurement rule #1. **Verified.** | Delete the row. Keep face-to-path only, with its club mean at 10+ shots. |
| **C26** | HIGH | **A follow-up session where the fault PERSISTS silently replaces the open probe before it can be asked,** so only faults that went away ever get a verdict: survivorship bias in the only efficacy metric. | Settle or ask before opening, never replace a due probe, and open probes once, at import. EXTENDS C6. |
| **C27** | HIGH | **A range-ball baseline settles against a premium follow-up, and the ball change is credited as "a real change… the strongest evidence this app can produce".** **Verified in code.** | `due()` requires `Conditions.comparable`. Open no probes on range or unknown balls. |
| **C28** | HIGH | **The FaultEngine floor is pooled across clubs:** 4 × 7i + 3 × 9i + 3 × PW produces "Poor Contact… #1 priority, 10 of 10" and a 34-minute block. | Apply the rate and floor per club. |
| **C29** | HIGH | **Spin axis (tier 3) is prescribed:** "High Spin Axis" is plan block #1 with a drill, contradicting the app's own "never prescribes from spin". | Make both spin-axis rules display-only. |
| **C30** | HIGH | **`BODY_CONSTRUCT` misses about 30 body or unmeasurable causes,** which render under "What the numbers show": forearms, hands, over-the-top, trail foot, lower body, shoulder, dynamic loft, face-angle variability, muscle fatigue, dehydration. | Tag each cause explicitly (unlabelled = body), and add the strings to the bulk test. |
| **C31** | HIGH | **Slice and hook fire at 10 shots on an unaligned unit and on range balls,** under the caveat that says they are held to a larger sample. Only push and pull use `startLineFloor`. | Add `minShotsFor: Conditions.startLineFloor`, and gate off range balls. |
| **C32** | HIGH | **Gap sizes are printed on range balls directly under "Gap sizes are withheld".** | Render "—" when `!gappingOK`. |
| **C33** | HIGH | **The seven Progress charts under "All clubs" pool the bag and the conditions, apply no floor, and run newest → oldest,** while the strike trend on the same page runs oldest → newest. | Default to the most-hit club and its conditions, drop sessions below the floor, and sort oldest first. |
| **C34** | HIGH | **Two more bag-pooled session rules:** "Inconsistent Contact Quality" and "Variable Launch Angle". Identical drivers plus identical wedges trip both. | Delete `SESSION_RULES` wholesale. EXTENDS C1/C2. |
| **C35** | HIGH | **Tour-average clubs fail the app's own bands:** AW/SW/LW trip "Adding Loft", PGA long-iron and 8i/9i launch fall outside the windows, and a tour-level PW fixture gets three faults. | Derive every band from `Benchmarks.DATA` per club, plus a test that no PGA row trips a rule. EXTENDS C7. |
| **C36** | MED | **`low-ball-speed` scores smash a second time,** with a third threshold copy, and infers "casting". | Delete the rule. |
| **C37** | MED | **`Strike.fatigue` reports "fade" on trend-free data ~10% of the time per club** (z 1.96 on SDs from 5–6 shots). This is the module C1's fix routes to. | Use a one-sided t / Welch test, corrected across clubs; consider a 30-shot floor. |
| **C38** | HIGH | **Dates are wrong across timezones, DST and future dates.** Date-only strings are parsed as UTC; New York shows the previous day; the default import date is off by one; the DST week breaks the streak; a future date is accepted silently; the filename's 6 digits are read as MMDDYY. | Treat dates as local calendar dates, compare days as strings, and set `max`=today. |
| **C39** | MED | **Range-ball sessions still get strike yards, poor-contact faults, compare verdicts and a "widest spread" Drill Focus.** On a tie, the yardage book picked the range group. | Gate on `dispersionValid`, and break ties toward `gappingValid`. |
| **C40** | MED | **These pool across balls and the bag:** Club Benchmarks, the club modal, Analytics (whose trend is always "improvement" on any positive delta), personal bests (the longest carry came from range balls), and the strike trend. | Route them through `conditionGroups` and a per-club floor. EXTENDS C19. |
| **C41** | MED | **The drill gate is judged on the affected shots only:** "needs 15 Driver, you have 13" on a session with 20 drivers. | Pass all of the club's shots. |
| **C42** | MED | **The first probe is always burnt as "unknown"** (fewer than 3 sessions of history), and the home card keeps asking for a re-test that has already been imported. CLAUDE.md's "falls back to the MDC table" is not what the code does. | Keep the probe pending until the history exists, and fix the doc and the copy. EXTENDS C5. |
| **C43** | MED | **The shot modal's "vs avg" is one shot against the whole bag,** and "No faults flagged on this shot" appears on every shot, because `MIN_AFFECTED` = 2. | Compare against the club mean, and drop or rework the per-shot fault list. |
| **C44** | MED | **Club means and tier-2 values sit below the floors** on the session card (9 shots), ball flight, launch windows (attack angle at 9) and benchmarking. | Gate at 10, and at 15 for tier 2. EXTENDS C4. |
| **C45** | MED | **Rounds has no validation (133% GIR accepted and made the diagnosis) and no date field, and is hidden until 2 imports,** so a golfer with no device data cannot log a round. Its trend uses 1 SD; `rangeLink` contradicts its own caveat; the putts table has a plateau. | Validate, add a date, move it out of the gated block, and use one threshold. |
| **C46** | MED | **The SwingDNA "below what the device resolves" verdict compares σ with the MDC of a mean,** so it flips with n. The tail trend uses 1 SD. "3 of 3 go right" is called a pattern. | Use per-shot device figures, one significance rule, and a floor on one-way verdicts. |
| **C47** | LOW–MED | **NEXT GATE counts shots on any ball, then says "every gate is open".** The Learning modal gates on the latest session only. | Count premium/RPT only, and gate on the conditions group. |
| **C48** | LOW–MED | **`Benchmarks.DATA` amateur (`am`) columns have no source.** Only `pga` is [TM]. The amateur 7i implies a ~61 mph 7-iron beside a 93 mph driver. | Cite a source, or drop the non-driver `am` values. |
| **C49** | LOW | **Copy problems:** unsourced superlatives ("single most common reason…", "#1 cause of scooping", "Narrow target = narrow mind"…), factual errors (descent/roll inverted, "'75% face' rule" vs 85%, attack angle called path), and typos ("1 more shots", "Only 0 shots", "rapsodo rpt"). | Copy pass. EXTENDS C24. |

**Confirmed end to end:** C1 (the same 40 shots reordered: 7i-first gives no fatigue, driver-first fires it), C3, C5, C6 (a re-view even duplicates a settled probe), C7 (tour PW at 1.28 → #1 priority), C8, C13, C18, C20 (the arithmetic is right; the floor is what's missing).
**What held:** the floors hold exactly at 9/10/15/30 in the gated modules; 500 shots render with no NaN or errors; `bank.csv` is refused clearly; achievement counts are right; compare withholds carry and ball speed across ball types.

**The agent's verdict:** the retention probe, the one number the app says proves a drill worked, is biased toward "it worked" on every path. C5 measures the wrong metric, C26 deletes persisting faults, C27 credits a ball change, and C42 burns the first probe. Nothing looks wrong on screen. **Fix C5/C6/C26/C27/C42 together, as one piece of work: "make the retention probe honest".**

**Still not covered (correctness):** 1440px; the exported/shared output and the printed card; the range card, backup/restore, confirm modals, settings sub-screens and the import steps; filename-date parsing run live (C38 comes from reading the code); Practice below the plan on a range-ball session.

### 7E — visual rerun (V25–V49, 22 Sep, completed)

The main session verified **V25** (`.settings-row{display:flex}` at `style.css:1059` beats the UA `[hidden]` rule on three `hidden` account rows) and **V36** (`@keyframes slideUp` declared twice, at 2551 and 2665). The rest are agent-reproduced.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| **V25** | **HIGH — data loss** | **A guest sees "Sync to cloud", "Delete my account & data" and "Sign out"** (the rows are `hidden`, but `display:flex` wins). **Sign out as a guest hard-reloads with no confirm and wipes their in-memory sessions.** A signed-in user also sees "Sign in". **Verified.** | Add `.settings-row[hidden]{display:none}` (or a global `[hidden]{display:none!important}`), plus a guard or confirm on logout with no user. **Do this first.** |
| **V26** | HIGH | **Keyboard focus rings are invisible on every chamfered button:** the `clip-path` clips the outline. The drill tabs lose the ring's top edge. | Draw the ring inside the clip (negative `outline-offset`, or an inset shadow). |
| **V29** | HIGH | **The shot-modal table overflows at every width** (403px of table in a 295px body), cutting off the comparison column. Log row "1" opens "Shot #2", because the number is the CSV line. | Stack the comparison under the value; number shots from the log index. |
| **V30** | MED-HIGH | **Settings → Storage preferences does nothing after the first answer** (`showBanner` returns early), yet toasts "Cookie preferences shown". | Add a force flag or a prefs sheet. |
| **V31** | MED | **The Progress charts' tick labels print 5 decimals, and the attack-angle fill is painted above the line.** (The range-session inclusion becomes *weighted* under Phase 9 rather than excluded.) | Set precision per metric, `fill:false`. EXTENDS V9. |
| **V32** | MED | **The measurement-reference modal clips the numbers:** MAE/RMSE/Bias sit entirely off-screen (590px in 260px). | Stack the rows under 640px. |
| **V33** | MED | **The import preview shows raw data:** club code "d", unrounded values, 8 clipped columns, "Premium (own l…" truncated, native blue checkboxes. | `clubLabel()`/`fmt()`, fewer columns, global `accent-color`. |
| **V34** | MED | **The selected drill tab scrolls off-screen on every click;** at 1440, G–I are hidden with no cue. | `scrollIntoView` the active tab; wrap at ≥768px. EXTENDS V6. |
| **V35** | MED | **A focused control lands under the fixed bottom nav** (focus at y=806, nav starts at 784); there is no `scroll-padding`. | `html{scroll-padding-bottom/top}`. |
| **V36** | MED | **`@keyframes slideUp` is declared twice;** the cookie banner's `translateY(100%)` + opacity 0 wins, so plan cards and the stats strip slide in from invisible, breaking the scroll-motion rule. **Verified.** | Rename the cookie keyframe, and add a duplicate-`@keyframes` check to `cascade-overrides.js`. |
| **V37** | MED | **Information is shown in the red destructive confirm dialog** (`\n\n` collapsed; "Confirm" goes somewhere other than the text says); every confirm button says "Confirm". | Add `showInfo()`; give confirm buttons verbs. |
| **V38** | MED | **The six runtime modals are an off-system second style:** inline styles, blue values, 4px radius, a different backdrop. | Render them into the `.modal` shell. |
| **V39** | MED | **Analytics / Club Analysis pool across balls and disagree with the benchmark modal** (236 vs 237; 87% vs 89%). | Use `conditionGroups` + `bagConsistency`, or delete the tiles. EXTENDS 0.1/C19/C40. |
| **V40** | MED | **Practice plan cards look tappable and do nothing;** the grid shows 3 blocks while the range card says "Block 1 of 4". | Open the range card at that block; show the transfer block in the grid. |
| **V41** | MED | **Settings sections are built two ways;** there are two toggle styles; Data & Export is 13 mixed rows. | One section and one switch component; split the launchers out. |
| **V42** | MED | **The first three session-detail blocks don't share a left edge** (x=32 vs 16). | Drop the horizontal margin. |
| **V43** | MED | **Disabled `.btn-primary` is dimmed twice; disabled `.btn-icon` looks enabled; `.probe-btn:hover` turns disabled buttons orange.** | One disabled treatment; hover under `:not(:disabled)`. |
| **V44** | LOW-MED | **At 1440 the "indicative" ball-flight arc is the biggest object on the page (890px),** and the dispersion scatter is squashed flat. | Cap it at ~480px; give the scatter a real aspect ratio. EXTENDS 3.3. |
| **V45** | LOW-MED | **The desktop active-nav marker is a left border that reads as a divider;** the practice grid leaves dead track; Settings is one 2,852px column. | Underline marker; `auto-fill` tracks; 2-column Settings ≥1024px. |
| **V46** | LOW | **The printed card has an orphan "PERSONAL BESTS" heading,** and its caveats print 2–3 times. | Hide the section in print; dedupe. |
| **V47** | LOW | **Title/subtitle headings wrap into two cramped columns at 393.** | Stack below 480px. EXTENDS V14. |
| **V48** | LOW | **Circles in a zero-radius system** (range-card close button and dots); three different close-button styles. | Square/chamfered; 24px targets. |
| **V49** | LOW | **Data-rights modal double inset; hamburger-looking data icon; "UNLOCKED" orphan; one star for all ten achievements.** | Polish pass. |
| ~~V27, V28~~ | — | Gap sizes on range balls; a single-shot face angle in the shot modal. **Intended under Phase 9**, so dropped. | — |

**Dark mode at 393 is clean** on what can be measured: no light surface leaking, no text below 3:1, with a positive control proving the scan works. **Loading states (8B.8):** no blank interval on an unthrottled connection.

**Still not covered (visual):** dark mode at 1440 for Progress/Practice/Drills; the signed-in rendering (needs an `Auth.getUser` stub; do it with Phase 1.5); throttled loading states; the legal PDF print view; the range card's end screen and tick-off flow.

### 7F — robustness rerun (R19–R40, 22 Sep, completed)

The main session verified **R19** (`clubLabel` at `app.js:252` returns an unknown club code uppercased and unescaped) and **R23** (`logout()` removes only the auth token; it touches no user data). The rest are agent-reproduced. **R20 duplicates V26** (invisible focus rings on the chamfered buttons), found independently by two lenses, and is kept as one item.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| **R19** | **HIGH — security** | **A CSV's Club Type, or any field of a restored backup, is HTML-injected into about 15 `innerHTML` sinks:** the preview, session cards, gap/bench/shot tables, the shot modal, the yardage table, records, progress, and the analytics and club modals. A backup `id` breaks out of `data-id` attributes. A proof-of-concept file fired beacon requests to a third-party image host (breaking the zero-third-party position via the loose `img-src https:`), injected 21 `<style>` nodes and restyled the UI. Notes, wind, temp, date, ball and surface **are** escaped. **Verified at the source.** | Normalise `clubType` in `CSVParser` and `readBackup` (a known code, or a short `[a-z0-9]` token); have `clubLabel` escape; validate backup ids against `^[\w-]{1,64}$` and coerce numerics; add a **taint suite** that renders every view from a marker fixture and asserts zero hits; tighten R15's CSP. |
| **R23** | **HIGH — privacy** | **Sign-out leaves the account holder's data on the device and shows it to the next person:** IndexedDB sessions (notes included), the practice log, probes, rounds, putts, goals and remembered conditions. With `slGuestChosen` set, the reload lands in guest mode on the previous user's data, and a *new* sign-in is then offered "Back up 1 session?" into their own account. **Verified in code.** | On logout, clear the user-scoped keys and DB rows, or ask "keep this device's copy?"; clear `slGuestChosen`. |
| **R21** | HIGH | **The five Settings runtime modals are not dialogs:** no role, focus stays behind, Tab walks the page underneath, Escape does nothing, and closing drops focus on `<body>`. | One runtime-modal helper: `.modal-overlay`, close by toggling `hidden`, restore focus to the opener. EXTENDS R2/R5. |
| **R22** | HIGH | **Space on the range card's "Done ✓" is swallowed by the Space-means-next handler,** so the block advances and **nothing is logged to PracticeLog.** There are no dialog semantics, and focus drops to `<body>` after every repaint. | Ignore Space and arrows on buttons and fields; focus the card heading on open and after each paint; register it as a dialog. |
| **R24** | MED-HIGH | **The auth return accepts tokens from any link.** A crafted `#access_token=…` purges the stored session before any validation (logout CSRF, verified), and by code reading a valid attacker pair would be installed (login CSRF), after which imports sync to the attacker's account. **No open redirect.** | A one-time nonce in `sessionStorage`, set in `oauth()`; accept hash tokens only with the nonce, and validate before purging. PKCE long term. |
| **R25** | MED | **"Kept on this device" is claimed when the storage write silently failed;** the session is orphaned in IndexedDB with no UI to reach it. | Verify the flag after writing, or roll back with a reason. |
| **R26** | MED | **Offline, any unknown URL serves the app** (a bad nested path gets an unstyled, script-less page) instead of 404.html. | Fall back to the shell only for app paths, otherwise `/404.html`; use root-absolute asset paths. EXTENDS R6/R7, same `sw.js` pass. |
| **R27** | MED | **Dark-scheme users get a ~1.8 s white flash, and an ungated app shell with a dead "+" button is visible before the JS runs** (Slow 4G + 4× CPU). | A tiny render-blocking `/theme.js` in `<head>`; `defer` the vendor scripts. |
| **R28** | MED | **Reduced motion is ignored by the metric count-up and by the subnav's smooth scroll.** | Gate both on `ScrollMotion.reduced()`. |
| **R29** | MED | **Memory leak:** a chart that is never scrolled into view keeps its IntersectionObserver and the destroyed chart alive, about 190 KB per detail open, linear. | Disconnect the observer on destroy. |
| **R30** | MED | **Back leaves the app from any view** (in-app navigation writes no history); a stale deep-link hash wins on reload. | Write the hash in `Router.go`, handle `popstate`, route detail as `#session/<id>`. |
| **R31** | MED | **Signed in, every tab tap awaits a full cloud read, and out-of-order responses show the wrong view** (3 of 8 rapid sequences). Currently masked by R1. | Drop stale renders; render local first and merge cloud in the background. Pairs with 8C pagination. |
| **R32** | MED | **Import and auth errors are silent to screen readers.** | `role="alert"`, `aria-invalid`/`aria-describedby`, focus the error. EXTENDS R10. |
| **R33** | MED | **At 320 px the nav labels overflow and overlap** (they break below ~366 px, so 360 dp Android is borderline); **at 200% zoom, 5 of 7 views scroll sideways.** CLAUDE.md's nav note measured 393 px only. | Icon-only or two-row nav below 380 px; single-column grids; `min-width:0`. |
| **R34** | LOW-MED | **Notes can be written but only ~30 characters are ever readable** (one ellipsised line); there is no length cap (60,000 characters accepted). | 3-line clamp with "more"; move wind/temp; a maxlength with a counter. |
| **R35** | LOW | **The theme has no "system" option and no live follow; the legal and contact pages are always light.** | A system/light/dark setting plus a `matchMedia` listener. Ties to the open default-theme call. |
| **R36** | LOW | **Save → detail is a 591 ms long task; Progress 911 ms across 8 tasks;** Chart.js and Supabase load render-blocking but run only ~11% at first screen. | Render detail sections on tab open, cache the date formatter, `defer` the vendor scripts. Phase 4. |
| **R37** | LOW | **Repeat visits pay the full network even though everything is cached** (FCP 1.54 s on Slow 4G vs 0.11 s from cache); an open tab never checks for updates. | Stale-while-revalidate for the shell; `reg.update()` on visibility change. EXTENDS R7. |
| **R38** | LOW | **The "Your Data & Rights" modal appends a new overlay on every open,** and its ✕ has no label. | Give it an id, remove the old copy, add the label. |
| **R39** | LOW | **The URL's `error_description` is shown verbatim in a toast** (as text), so a link can put any message in the app's voice; a failed token install toasts "Email verified". | Map known error codes to fixed copy. |
| **R40** | LOW | **Chrome logs the `apple-mobile-web-app-capable` deprecation on every load.** | Add `mobile-web-app-capable`. |

**Checked and robust:** a double-click on save makes 1 session; rapid guest view switching; reload mid-import (0–600 ms) keeps the session; deep links, including garbage and `<script>` hashes; offline reload and offline import (all 22 SW assets cached); installability; throwing storage APIs (honest, except R25); Chart instances bounded at 9; stable DOM and listeners over 30 switches; focus return on the static modals; CLS ~0.001.

**Performance, measured** (Slow 4G + 4× CPU): FCP 2.24 s; the agreement gate is interactive at 4.1–4.7 s; 490 KB over the wire in 9 requests; long tasks on load 66–79 + 114–145 ms; app.js is 39.7% used at first screen. Repeat visit offline: FCP 0.11 s.

**Still not covered:** login CSRF with a valid token (it would contact Supabase); the signed-in per-tap cloud cost measured live (R1 masks it); real iOS Safari / WebKit.

**All three lenses have now run to completion or to a recorded stop.** The remaining gaps are the NOT YET COVERED lines in 7D, 7E and 7F, plus iOS Safari.

### Open question raised by the audit (Oliver's call)

- **C9 — may the app prescribe from attack angle?** The measurement rules say tier 2 is "display only"; the fault engine has prescribed attack-angle drills since before those rules existed. Either the rule bends ("tier 2 may be prescribed as a *recurring pattern* above 15 shots, never from one reading"), or those faults become display-only and the drill leaves the ranked card. The code and the copy must agree either way.

### NOT YET COVERED — where a rerun picks up

**Visual:**
- 1440px beyond home: the captures exist but were never reviewed.
- Dark mode at 393 beyond the detail and the empty home.
- Drills with data and each library tab; Settings; Practice below its second screen; Progress below the launch-angle chart; detail screens 4, 6, 8, 10, 12, 14 and 15.
- Modals never opened: the import preview and meta steps, range card, achievements, shot modal, confirm modals, settings sub-screens, backup/restore, the six runtime modals, and the print view.
- No hover, focus, active or disabled states anywhere.
- The range-ball session's own detail view.

**Correctness:**
- CSVs generated but not run: the 9- and 10-shot floor boundaries (outputs exist but were not read), 15i7, 30d, pw (the wedge proof for C7), 500 shots, 7-iron-first (the fatigue control), p-a/p-b (the end-to-end proof for C5/C6), range/premium/RPT pooling, and the non-Rapsodo `bank.csv`.
- Streak and achievement counts; Progress charts under "All clubs"; compare across mismatched conditions; the Rounds module.
- Spin with an RPT ball; every rule against a range-ball session; a grep for unsourced percentages in string literals.
- Fault-card copy, which is blurred for guests.
- The modals.
- Dates: same day, out of order, future-dated, timezones near midnight.
- 1440px; the exported/shared output; the printed card.

**Robustness:**
- Focus-visible styling, the six runtime modals and the range card by keyboard, focus return on close, and form-error announcements.
- Reduced motion, colour scheme and 200% zoom: none of it started.
- **All performance work:** a throttled load, long tasks, JS coverage, memory over 30 view switches, and layout shift.
- Offline retests using CDP network emulation on the SW target (Playwright's `setOffline` did not stop SW-made requests, so offline reload and the navigate fallback remain untested); the SW update flow; installability.
- Storage APIs that throw; a double-click on save; rapid view switching; back/forward and deep links; reload mid-import; very long notes; HTML injection in notes and CSV club names.
- A systematic `innerHTML` escaping audit; storage contents after sign-out; open-redirect tracing of the auth return.

**Fix R17 before any rerun of the robustness lens.** Until the mirror carries the SW's full asset list, no browser check can exercise the service worker.

### Suggested order when work resumes

Finished items move to the **Done log** below this list, one line each with the commit.

2. **C25, C29, C31, C32 — HELD for Phase 9.** Each tightens a rule Oliver's 22 Sep direction loosens (face angle, spin axis, range-ball gating). Resolve them inside Phase 9, not before it.
3. **C27** — the rest of the probe work; it changes under Phase 9 (range → premium allowed, weighted), so do it there.
4. **V5/C11 + V4 + C13 + C14 + C21** — home shows one fault, one form and one priority (this merges with plan 2.5).
5. **C8** (changes under Phase 9: absolute bias becomes tier 3) — route the remaining legacy surfaces through the gated modules.
7. Everything in 7C; then rerun the agents on the NOT YET COVERED list.

### Done log

| Item | What | Commit |
|---|---|---|
| V25 | `[hidden]` means hidden (global rule); guest cannot reach sign-out; render-scan HIDDEN check | `2c4649d` |
| R23 | Sign-out asks: clear this device or keep; every `sl*` key classified account/device; `signout-clears.js` | `9967816` |
| R19 | Club types cleaned at the door (CSV, backup, every read); `clubLabel` escapes; backup ids/dates/numbers validated; `taint.js` | `78061db` |
| R1+R6+R7+R26 | SW: no cross-origin interception, only `res.ok` cached by path, 3 s timeout, offline 404; `service-worker.js`; run.js fails a suite with no result | `dc41852` |
| R3 | No email in any diagnostic call; `showDebug` gated on `slDebug`; paren-scan guard | `c0359a9` |
| C3 | Quality breakdown from one `BUCKETS` table (100 counted, colours match pips); invisible grade-ring tracks fixed (new, found beside it); `score-buckets.js` | `570b531` |
| V3 | Heatmap anchored on this week; local-day keys (a timezone shift found beside it); `heatmap.js` under 3 TZs | `10f9647` |
| V36 | One `@keyframes` per name; content slides in visible; banner on `cookieIn`; duplicate-keyframe check in `cascade-overrides.js` | `80f849e` |
| R22 | Range card leaves Space/arrows to focused controls; dialog role; heading focus per repaint; focus returns on close | `9c3d0f1` |
| R20/V26 | Inset `currentColor` focus rings on chamfered buttons and inside clipping boxes (Settings rows, drill tabs, chips — wider than reported); render-scan RING check | `4f90d52` |
| C1+C2+C34 | Deleted the four bag-pooled session fault rules; driver+wedge fixture raises nothing bag-wide; name banned in `rules-are-wired.js` | `f2a2260` |
| C16+C17 | Drill-library section text: no strokes figures (A, B), no retracted 1.8° (D); guarded | `fdc28fc` |
| C7+C35 | Smash floor/good/elite and wedge spin-loft bands per club off `Benchmarks.DATA`; every PGA row silent (one named exemption); no amateur-average row flagged | `d3a343b` |
| C5+C6+C26+C42 | Probe measures its own fault's metric and direction; opens once at import from the newest session; never replaces a live probe; short history held (`awaiting-history` + `rejudge`), not burnt; home card routes to an imported follow-up | `d753d82` |
| R2+R5 | Removed dialogs leave the focus trap (observer + prune backstop, focus restored); Ctrl/Cmd+P and Ctrl+H freed; shortcuts overlay trapped; `focus-trap.js` | `2d1f711` |
| V1+V2 | Quick-stats strip not sticky on phones; session score kept top-right in the card on phones; `bands.js` section slice fixed (it ran to EOF) | `2d73032` |
| V6 | Tab-row edge fade at phone width; section tabs are buttons with `aria-current` (part of R4) | `db519e1` |
| R4 | Keyboard paths for every clickable surface; `role=button` Enter/Space handler; paywall `inert`; ranked card's dead route fixed; shot-log cell rules; render-scan POINTER | `176fe2b` |
| C28 | Fault floor, count and rate per club, never pooled across the clubs it appeared on | `e5edb41` |
| C12 | Junk rows and impossible readings dropped at import with a counted preview note; `Metrics.impossible` screens whole shots from records | `50cf190` |
| C10 | Drill pick is `kind: 'drill'` and fits the club (`DrillLibrary.fitsClub`, `for` tags), named fits first | `d9d873a` |
| R8 R9 R10 R12 R13 R14 R18 | Named chart canvases; `aria-current` nav; live toast; goal picker name; heading order; skip link; two auth-path crashes | `8131e3c` |
| R17 | `sync.sh` copies every SW asset (done before the overnight run) | earlier |
| R15 | CSP `img-src 'self' data:` (no arbitrary hosts); guarded in `taint.js` | `55b9d6c` |
| C4 | Metrics strip anchors on the most-hit club (named in a caption), no pooled 'vs all' delta, per-club floor; total kept per Phase 9 | `d987ceb` |
| V20 | Shot-log score rule on the first cell only (done inside R4) | see R4 |
| Phase 9 | Measurement model v2: every tier prescribes, range balls weighted, caveats to Settings, Terms 2026-09-23 | `04a2623` |
| V7 V8 V9 V10 V16 V18 V19 V21 V22 V23 V24 R11 | Back link on its own row; same-day sessions labelled by ball; straight unfilled progress charts with an MDC-based minimum span; sparklines need 3 points and get end dots; benchmarks spacing; one name "Yardages"; no 01–06 tile index; apex label unclipped; no empty centre-line legend key; club dot beside its name; one fixed coach heading; 44px targets for the alignment link, short-game selects and checkboxes. Also: retention block no longer repeats a club or deadline; since-last empty text plain | `25050c6` |
| V12 V13 V15 V17 | Share/Export on the button system; odd last grid cell spans the row; round form Save is a primary button; empty states in the body face with a real CTA and honest copy (no "AI-generated"). Open: V14 (heading patterns) and R16 (manifest theme) are Oliver's design calls; the Practice view stays long because the short game renders in full | this commit |
| R28 R38 R40 V35 V43 | Count-up and subnav scroll obey reduced motion; data-rights modal is one copy with a labelled close and an escaped email; `mobile-web-app-capable`; scroll padding clears the bottom nav (top nav on desktop); one disabled treatment, hover gated on `:not(:disabled)` | overnight 22:00 |
| R39 V34 | Sign-in errors read the code only, mapped to fixed copy (no URL text in the app's voice), and a failed token install no longer says "Email verified"; pinned in `taint.js`. Drill tabs keep the chosen tab in view and focused, fade at the edge on phones, wrap at 768px+ | overnight 22:20 |
| R32 | Sign-in and import errors are `role=alert`; a sign-in error marks its field `aria-invalid` + `aria-describedby` and focuses it; new suite `form-errors.js` | overnight 22:40 |
| R21 | The five Settings runtime modals (analytics, benchmarks, learning, club, efficiency) carry `.modal-overlay`, so the trap gives them role, name, focus in/out, Tab containment and Escape; the shortcuts overlay got a name; guard in `focus-trap.js` (mutation-checked). Also removed a code name (`R_ANCHORS`) from section C's user-facing text | overnight 23:10 |
| C41 C33 | Drill gate judged on every shot of the fault's club, not only the affected ones (`drill-library.js`). Progress: no pooled "All clubs" line — defaults to the most-hit club, charts run oldest to newest, sessions below the per-club floor are left off, and the trend summary reads the chosen club instead of the whole bag (`progress-trend.js`). Both mutation-checked. Conditions are NOT filtered on the charts: v2 treats range balls as near-normal data | overnight 23:40 |
| C36 | Deleted `low-ball-speed`: it read ball/club speed (smash) a second time against a third threshold copy and inferred "casting" from launch data. Its section mapping went with it; `drill-focus.js` now pins 44 fault drills and the rule's absence, with its fixture reworked onto a steep 9-iron | overnight 00:10 |
| C43 | Shot pop-up compares each shot with its own club's session mean (only above the floor), labelled with the club; the per-shot fault list now names the session faults the shot is part of instead of re-running the engine on one shot (which could never report, so it said "No faults flagged" every time). New suite `shot-modal.js` (76 suites), checked against the old code | overnight 00:20 |
| C37 | `Strike.fatigue` uses a t-test (pooled df 2n−2, sample variance) with the alpha split across every testable club, instead of z = 1.96 on population SDs. Simulated false-alarm rate on trend-free 15-shot blocks: old 12.0%, new 4.8% (claimed 5%); pinned in `strike-quality.js` with a seeded mulberry32 run. **Found beside it, not fixed:** the global `stdDev()` divides by n (population form), which understates spread at small n everywhere it feeds an interval or threshold — queued for the new plan, since changing it moves numbers app-wide | overnight 00:50 |
| C44 | No club mean below its floor on four surfaces: session-card tiles show "9 of 10" (launch "of 15"), launch windows show "n/15 shots" for launch/attack (spin needs 10 RPT shots), the averaged ball flight waits for 10, Progress club benchmarks show — below 10. New suite `floors-on-screen.js` (77 suites), checked against the old code; card checked at 393px. **Found, not fixed:** the card's "✓ Clean" badge shows on sessions too small for any fault to report | overnight 01:15 |
| V29 | Shot pop-up rows are two-column grids with the comparison on its own line, so nothing clips (295/295px at 393, 330/330 at 1440); the shot-log # is the shot's place in the session (stable under sorting) and the pop-up title uses the same number; pinned in `shot-modal.js`. **Found, not fixed:** "+0.0 vs Driver avg" is coloured green | overnight 01:40 |
| V32 | Reference tables wrap and drop their 420px min-width: 260/260px at 393, 295/295 at 1440. `render-scan.js` now opens "How the numbers work" and fails on any table wider than its box (verified: old CSS reports 590px and 420px in 260px and exits 1) | overnight 02:10 |
| V33 | Import preview: five columns (club name, ball mph, smash, carry, launch) rounded like every other screen, no 500px min-width (359/359px at 393); `accent-color` on `<html>` so native checkboxes take the accent. `render-scan.js` now measures the preview step (old code: 560px in 359px, exit 1). The truncated "Premium (own l…" option label is left for the new plan | overnight 02:40 |
| V37 | `showInfo()` for information (no red, dismiss says Close, the onward action names where it goes — the range-wrapper note now opens the drill library, where section I lives, instead of Practice); every `showConfirm` passes a verb ("Delete session", "Upload them", "Yes, it was aligned"…); red only for destructive actions; `#confirmBody` keeps paragraph breaks. `confirm-verbs.js` pins it | overnight 03:10 |
| R29 | ScrollMotion tracks every pending IntersectionObserver; `prune()` (run by the same MutationObserver that finds new blocks) disconnects any whose element left the page, and `chart().destroy()` ends its chart's watch. `observer-leak.js` counts live observers through a fake IntersectionObserver (`load({before})` hook added); old code fails it | overnight 03:40 |
| C30 | Measured is opt-in: a cause is observable only if it names path / attack angle / face-to-path and no body or setup word. 40 of 62 causes were rendering as findings (grip, alignment, weight, dynamic loft, toe strikes, hyphenated "Over-the-top"); now 7, pinned by name in `core-geometry-and-faults.js` (old code fails 9 checks) | 24 Sep |
| C45 (part) | `Rounds.validate`: hard-logic checks only (whole non-negative counts; per-hole counts ≤ holes; hit ≤ possible; 3×three-putts ≤ putts; score ≥ holes and ≥ putts; no future date), each problem names its field and the form toasts it. A date-played field (defaults to today). The log moved out of the two-session gate and renders with zero sessions. Still open: one significance threshold, `rangeLink` vs its caveat, the putts plateau | 24 Sep |
| R30 | Every view change writes its address (`#progress`, `#session/<id>`, read off the rendered detail so the import flow is covered too); Back/Forward come in through the existing hashchange → applyHash; the first write replaces a bare URL; writing starts only after boot reads the deep link. Verified with the real browser Back/Forward/reload buttons; `hash-routes.js` pins it | 24 Sep |
| V40 | The Practice grid lists exactly the blocks the range card walks (transfer block included — it said "Block 1 of 4" under three cards); each card is a keyboard-reachable `role=button` that opens the card on its own block (`RangeCard.open(blocks, session, at)`, clamped). `range-card.js` pins it | 24 Sep |
| R25 | `LocalDB.setEnabled(true)` reads the flag back after writing it; if localStorage refused it, the switch rolls back with the reason and writes nothing to IndexedDB — previously the switch read "on", sessions were stored, and the next boot never looked for them. `device-storage.js` pins it (old code fails 3) | 24 Sep |
| C46 (part) | SwingDNA strike repeatability is read against `Metrics.perShotSD` (the per-shot spread behind the MDC table, constant in n) instead of the MDC of a mean — the same swing read "below what the device resolves" at 10 shots and "Repeating well" at 40 — and the device claim is gone (no MLM2PRO smash error is published). The tail census calls a miss one-way only when an exact sign test rules out 50/50 (p ≤ .05); "3 of 3 go right" now reads as a lean. Still open: the tail trend's 1-SD rule | 24 Sep |
| R31 (part) | Every Router loader takes a navigation ticket before its cloud read and drops its render if a later navigation has started; synchronous views (Import, Settings) take one too. A slow Progress reply can no longer paint over Yardages. `hash-routes.js` reproduces the race (old code fails both checks). Still open: render local first and merge cloud behind it | 24 Sep |
| R33 (part) | Measured in Chromium: at 320px five nav labels (52px) overlapped their 46px slots; below 380px the nav is now icon-only with the label clipped (still the accessible name). All views reflow at 320px and 393px. The chart grid's 280px minimum can shrink; two-column grids stack under 300px. Still open past WCAG's 320px bar (~197px, 200% zoom on a phone): heatmap, benchmark table, short-game fields, drill tabs | 24 Sep |
| R27 (part) | `theme.js` in `<head>` (external, so `script-src 'self'` holds; precached by the SW) sets `html.dark` before first paint. Verified in Chromium with dark scheme emulated and app.js blocked: body paints rgb(11,13,16) — it painted rgb(251,251,252) before. Still open: the ungated shell and dead + before app.js runs | 24 Sep |
| V38 | The six Settings dialogs render through one `runtimeModal()` shell: `.modal` + `.modal-head` + `.modal-title`, token-only `rt-*` classes, no inline style, the system backdrop and z-index. Settings rows renamed to the dialog they open ("Compare to Community" promised a community the app does not have). `runtime-modals.js` opens each from its real row | 24 Sep |
| V39 | "Your numbers" and "Club by club" read `QuickStats.pick`'s group (latest ball + surface), one club above the floor, trimmed `Metrics.interval` — the same figure "Where you sit" prints (verified in Chromium: 237 / 151 on all three; were 236 / 150.1). Bag-pooled ball speed and launch, the launch min–max, and the "any positive delta is an improvement" trend are gone; the trend is `ClubAnalyzer.calculateClubTrend` | 24 Sep |
| Logo | Oliver chose "1a, the green" (25 Sep). `tools/build-icons.js` draws it from the dark tokens in a detailed cut (app icons, maskable in the safe zone, Apple touch) and a simple cut (`favicon.svg`, `favicon-48.png` for Google's result favicon). Pine green retired. Guard: `icons.js` | 25 Sep |
| C46 | The tail trend's bar was one between-session SD of σ; the difference of two noisy sessions has √2 × that SD, so the old bar false-alarmed about half the time with no change (fixture: a 5.6° spread the golfer had already hit read "Tighter … a real move"). Now `Metrics.mdcOf` — Hopkins' MDC95, 2.77 × the golfer's own wobble with n = 1 — the one copy `changeIsReal` also calls. A zero wobble returns `real: null` with a reason. `dispersion-tails.js` | 25 Sep |
| C45 | The rest of it. **Trend:** 1 SD → `Metrics.mdcOf` (a fifth-round count the golfer had already had read "Worse … a real move"). **Profile:** a 5+ point gap is named only when it clears Tukey's Q95[k]/√2 × the SE of the gap (per-category round-to-round SD at the table's local slope; 2.77 at k = 2, so it is the same rule corrected for picking worst-vs-best of k); under it the profile is `unresolved` and `getNextStep` skips it (three rounds with putts swinging 30→36 were named "where your strokes are"). **Plateau:** tied rows merge at their mean handicap — 33.1 putts placed at 15 and 33.12 at 20. **rangeLink:** no causal copy under a no-link caveat; no premium-ball ask (v2); floor read from `Metrics.MIN_SHOTS_TAIL`. `rounds.js` | 25 Sep |
| C33 (follow-up) | The Progress trend box kept only sessions on the latest ball and surface and withheld the rest ("those do not trend against each other"), a pre-v2 ban: six 7-iron sessions, the newest premium and five range, read "Not enough comparable sessions yet". It now reads `Analytics.progressWindows`: the last 3 sessions with the club above the floor vs the 3 before, every ball, each shot at `Metrics.conditionWeight` (range ×0.8) like the yardage book, the verdict from `changeIsReal` on the Kish effective n. Sessions without enough of the club no longer take a window slot; the stale "display-only" note is gone. Stated in the code and CLAUDE.md: the weight is a precision weight and cancels inside a one-ball window, so it does not correct a ball offset. `progress-trend.js` (renders the real box) | 25 Sep |
| R31 | The rest of it. Every loader goes through `Router.loadView`: paint `Store.snapshot()` at once, merge the cloud read behind it, repaint only when `Store.signature` (sessions + sync state) changed, drop it on a stale ticket, defer it while a text field in the view has focus. An empty device before the first read waits (no "no sessions" flash); the first device-only paint says so in `#syncBanner`. `Store` merge: a local write wins unless the cloud confirmed it before the read began (the cloud row used to win outright, so a note saved mid-read reverted), deletes are tombstoned for the page life, only the newest read updates the cache, the cache is keyed to the user, and a failed read clears it so the next paint is the device set the banner describes. "Try again" skips the first paint so "Checking…" stays up. `local-first.js` (old code fails 8 checks: slow paint, snapshot paint, two lost edits, resurrected delete, out-of-order cache, focus wipe, unnamed partial view) | 25 Sep |
| C39 | **Dropped under measurement v2, not built.** Every fix it asked for was a range-ball gate (`dispersionValid` on strike yards, poor-contact faults, compare verdicts, the "widest spread" Drill Focus; a `gappingValid` tie-break in the book). Phase 9 removed both flags and made range balls near-normal data at ×0.8, and the book no longer picks a group, so there is no tie. Building it would reinstate bans Oliver lifted | 25 Sep |
| C40 | The pooling-across-clubs half (the ball half dropped with C39; the club modal and AnalyticsHub were fixed by V39). **Records:** Best Smash and Highest Apex are read for the most-hit club — a golfer's 1.39 7-iron lost to an ordinary 1.45 driver; distance and speed maxima stay bag-wide, naming their club. **Club Benchmarks** read `Analytics.yardageBook` (it printed an unweighted, untrimmed 151 beside the book's 156 ± 2). **Coach assessment** reads `bagConsistency` (a tight driver and wedge read "Widely varied distances"). **Form arrows:** the Progress alert (fixed ±10, and averaged over unscoreable shots as zeros) and the dashboard's "▲ pts vs prior" (any positive delta) go through `Metrics.realMove` — `mdcOf` on the golfer's own session-to-session SD. `bag-pooling.js` (old code fails 13) | 25 Sep |


---

## Phase 8 — the external launch checklist, triaged (22 Sep 2026)

Oliver brought a generic "before you launch" list: security, reliability, UI, SEO and growth, about 130 lines. Most of it is written for a server-rendered or React app with a backend of its own. This is a **static PWA on GitHub Pages with Supabase as the only backend**, so every line was checked against the actual code before it was sorted. **Nothing here is built yet.** Payments stay out, per decision 2.

### 8A — already done here (with the evidence, so nobody redoes it)

| Checklist item | State in ShotLab |
|---|---|
| Hide API keys · keys in git · env variables | **Clean.** Only the Supabase *publishable* key ships (`app.js:920`, `sb_publishable_…`). That key is public by design, because row-level security (RLS) protects the data. `service_role` exists only as `Deno.env.get(...)` inside the `delete-account` edge function. Checked on 22 Sep: no secret or JWT anywhere in the tree, and `git log -S service_role` finds only a CLAUDE.md prose commit. |
| Add auth · check user perms · check DB rules | Supabase Auth plus RLS. Seven adversarial isolation checks pass against the live database (see CLAUDE.md). Re-run them after any policy change. |
| DB indexes · optimise queries | The index serves the only query (`user_id, date desc`). |
| Limit upload size · secure file uploads | The CSV is parsed **in the browser** and never uploaded as a file. `MAX_BYTES` caps it, and non-Rapsodo, empty and header-only files are refused at the door. Row-level junk is still open: C12. |
| Payload limits | 5,000 shots / 4 MB per row and 2,000 rows per user, enforced in the database. |
| Enable HTTPS | `*.github.io` is HTTPS-only. **If a custom domain is ever added, tick "Enforce HTTPS" in the Pages settings.** |
| Error handling | There is a global error boundary (`showFatalError`), toasts, and `Store.cloudStatus` with a banner for failed cloud reads. R1 currently defeats the banner. |
| Dark mode · mobile version · mobile menu · sticky headers · print stylesheet · confirmation modals · session search | All present. Remaining polish on these is in Phase 7 (V1, V17…). |
| Cookie banner · privacy policy · terms · last-updated | Present. Both legal docs are versioned and pinned to `Agreement.VERSION`. |
| robots.txt (AI crawlers **allowed**) · sitemap.xml · custom 404 (real 404 status, no redirect) · meta description · og:image (rendered, 1200×630) · favicon · canonical · structured data (WebApplication, no fake ratings) · llms.txt · `lang="en"` · one H1 per view · no `<img>` without alt | All present and guarded by `seo-and-production.js`. |
| "remove vite + react" · "view-source empty" · "vercel.app url" | **Not applicable.** The app is vanilla JS with full HTML in view-source, hosted on github.io. |

### 8B — real gaps worth doing (noted, not built; small unless marked)

1. **LIVE (22 Sep).** Oliver ran section 7 in the SQL editor; verified from the database the same evening: `keepalive()` exists, `SECURITY INVOKER`, `search_path=""`, EXECUTE for anon only (authenticated: no), returns `now()`; the security advisor shows no new lint. The first scheduled run is 01:17 UTC 23 Sep — a green run there is the last check. `.github/workflows/keepalive.yml`
   and `supabase-setup.sql` section 7, pinned by `test/suites/keepalive.js`.
   **Cadence corrected on the way:** Oliver asked for twice a week, reasoning
   that one a week was the minimum. Supabase's docs say otherwise: a project is
   judged on "sufficient user database activity over the past week", and "a few
   user requests to the database each day" is what typically keeps it awake. So
   the job runs **three times a day, two round trips each**. It is free on a
   public repo, and the suite fails if anyone relaxes it to weekdays. **Oliver's
   step:** paste section 7 of `supabase-setup.sql` into the SQL editor, then run
   the workflow once from the Actions tab. Until then every run fails with that
   instruction, deliberately. Also verified here: the key and URL are read out
   of `app.js`, and anything but an `sb_publishable_` key stops the run. Two
   limits: GitHub disables scheduled workflows in a public repo after 60 days
   with no commits (it emails first; any commit re-arms it), and whether a
   `now()` round trip counts as "user activity" is Supabase's definition to
   make — the proof is no pause-warning email over the next weeks.
   *Original note:* A scheduled GitHub Action (weekly cron) makes one cheap authenticated-as-anon request to the project. That is "regular use", so the free tier stops suspending, and it removes the weekly outage that `cloudStatus` exists to announce. It runs server-side from GitHub, not on page load, so the zero-third-party-requests rule is untouched. **Oliver's call:** it is a workaround for the free tier, and the clean alternative is the paid plan.
2. **The site can be framed (clickjacking).** GitHub Pages sends no `X-Frame-Options` or `frame-ancestors`, and neither can be set from a `<meta>` tag. There are two options:
   - (a) A tiny self-hosted frame-buster in `app.js`: if `top !== self`, refuse to render. Small, and no hosting change.
   - (b) The real fix: a custom domain behind a header-capable proxy (see item 11), which also brings HSTS, `X-Content-Type-Options` and `Permissions-Policy`. `SECURITY-HEADERS.md` already documents that path.

   Do (a) now; (b) comes with a custom domain.
3. **Strip the dangling `sourceMappingURL` from `vendor/chart.umd.js`.** It points at a `.map` that is not shipped, so devtools logs a 404 on every load. This is the "remove prod source maps / console errors" line. Remove the comment line.
4. **"Disable debug mode" means R3 + R18.** `showDebug` is ungated and logs the email; `authLog` has an undefined `msg`. Both are already in 7A. List them here too so the checklist line is traceable.
5. **Password visibility toggle** on the sign-in and sign-up forms. None exists (checked). Implement it as a `<button type="button" aria-pressed>` that flips the input's `type`, with an accessible name.
6. **Copy / share a text summary.** A "copy" button on the yardage book and on a session summary that puts plain text on the clipboard, for sending to a coach or a mate. It must carry the conditions line and "modelled", the same rule as the printed card: no bare "230 · 7i".
7. **A broken-link check as a suite.** Every `href` and `src` in `index.html`, the three standalone pages and `404.html` must resolve to a file in the repo. External links are listed by name. This is cheap, and it is the "check broken links" line made permanent.
8. **Loading states:** verify, then fill the gaps. Import parsing, the cloud fetch after sign-in and the Progress charts may render nothing while working. The visual agent's hover/focus/disabled pass should say which. Build only where something is actually blank.
9. **Rate limiting (Oliver, in the dashboard).** Supabase Auth rate limits are "documented default, unverified" (CLAUDE.md). Look at Auth → Rate Limits once and record the numbers. Do not test them by hammering the live endpoint.
10. **Backups (Oliver, in the dashboard).** Confirm what the current Supabase plan actually backs up, and record it. The app-level JSON backup/restore already exists and is tested (`SessionSharing`); this item is the database side.
11. **Custom domain (future, Oliver's call, roughly the price of a domain a year).** A real brand URL, and the only route to proper security headers (item 2b). If it happens:
    - enforce HTTPS;
    - update the canonical tag, `sitemap.xml`, the `robots.txt` Sitemap line, the og:url, the Supabase Site URL **and the redirect allowlist** (Phase 6.1);
    - check every hard-coded `oliverseydlitz-ai.github.io`. `seo-and-production.js` will catch several of these.

### 8C — later, once there are users (ties to Phase 5)

- **Pagination.** `CloudDB.getSessions` loads every session *with all its shots* on every boot. That is fine at 9 rows and slow at a few hundred. Fetch a session list (id, date, club counts, conditions) and load the shots on demand.
- **Error logging, first-party.** Uncaught errors and render failures go to a Supabase table: message, file:line, app version, **no PII and no shot data**. It is the same shape as 5.2's funnel counts, and it needs the same PRIVACY.md update. Without it, the first real user's crash is invisible.
- **Uptime monitoring.** An external check of the site and the Supabase health endpoint. Combine it with 8B.1's scheduled Action if that exists.
- **Google Search Console.** Verify the site once the landing section (5.1) exists. It reports crawl and indexing errors for free.
- **FAQ, expandable.** The natural home is the landing section: "Why won't it show my spin?", "Why no number for my 7-iron?", "Why do range balls change things?". These are the refusals a new golfer will hit first, and each answer can be read from the module that owns the rule, the way `FirstRun` does it.
- **Content / "information gain" SEO.** `docs/research-base-v2.md` is genuinely original synthesis: what an MLM2PRO can and cannot measure, and how big its error bands are. Published as a few static pages, it is exactly the information-gain content the growth list asks for, and it is on-brand. Only once the app is worth landing on.
- **UTM tagging** of links posted in golf communities, read by the first-party counter in 5.2. No third-party analytics.
- **Per-view `document.title`.** It helps tabs, history and bookmarks. It does not help SEO (hash routes are one URL). Small, whenever convenient.

### 8D — not applicable, and why (so it is not re-raised)

| Item | Why it does not apply |
|---|---|
| Protect admin routes | There are none: a static site with no server. |
| SQL injection | No SQL is built client-side. PostgREST parameterises, and RLS bounds every query. |
| CSRF · secure cookies | Auth is a bearer token, not a cookie, so CSRF has nothing to ride on. XSS is the real risk for a token in `localStorage`, which is why the `innerHTML` escaping audit (robustness agent) and a tight CSP matter. PKCE is the long-term fix (CLAUDE.md, "Known and deliberately not done"). |
| CORS settings | This origin exposes no API. Supabase's CORS is Supabase's. |
| Dupe payments · spending caps | No payments (decision 2). **If the Supabase plan is ever upgraded, keep its spend cap ON.** That is the one line to remember. |
| Test simultaneous users | Static files from a CDN; Supabase absorbs concurrency. Nothing to load-test at this scale. |
| Local business schema · breadcrumbs | CLAUDE.md rejects LocalBusiness explicitly: there is no premises. One indexable URL means no breadcrumb trail. |
| Floating contact · scroll progress bar · back-to-top button | They clutter a phone app that already has a bottom nav. The real fix for "long page" is Phase 2 (answer-first, tabs that swap content), not a button to escape it. |
| Site-wide search | There is one page. Session search already exists. |
| Programmatic SEO · backlinks · citation outreach · buying-intent keywords | Growth, deferred by decision 3. Revisit with 5.x once there is something to send people to. |


---

## Phase 9 — measurement model v2 (Oliver's decision, 22 Sep 2026)

> **STATUS: BUILT 23 Sep 2026.** Steps 1–7 below are done: tier rates, range weight and
> bump in `Metrics`; FaultEngine, DrillLibrary, Dispersion, gapping and the yardage book on
> v2; caveats moved to Settings → How the numbers work; FirstRun copy rewritten; Terms
> 2026-09-23. `test/suites/measurement-v2.js` pins it; ~15 suites were rewritten to pin the
> new rules, none deleted. **Decisions taken while building, for Oliver to overrule:**
> an unrecorded ball is treated like a range ball (×0.8, +0.05); the mat note and the
> "modelled" tags came off the screens too; `Conditions.comparable()` still picks
> like-for-like references (since-last, QuickStats) but no longer withholds a verdict;
> the strokes-figure caveats (Broadie & Ko) moved to Settings with the rest.

**The decision, in Oliver's words:**

> "leave the tiers just make them nicer — stuff all the way at the bottom judge it harder, not too different … range balls obviously no spin measurements and slightly lower level of data impact than rpt balls in net or simulator but treat like pretty normal balls … the minimum shot limit is nice, leave that"

**On screen:** "Clean — no caveats". The golfer is told once, in Settings, the explanation screens and the Terms, that the device has measurement error. After that, the main screens treat the numbers as the numbers.

**The concern that was raised and answered** (recorded so it is not re-litigated): some values are not measured by the radar at all. Spin without an RPT ball is the device's estimate. Face angle is not in the Rapsodo export; the app derives it. Prescribing from these means drills built on values the device did not read, and an off-screen disclaimer does not change which drill the golfer gets. Oliver chose to proceed. The implementation must honour that choice, not reintroduce the ban through the back door.

### What changes

| Area | Today | v2 |
|---|---|---|
| **Trust tiers** (`Metrics.TIER`) | Tier 1 prescribes; tier 2 display only; tier 3 never prescribes (`canPrescribe` is tier 1 only). | **Every tier prescribes.** A tier sets how hard a fault is judged, never whether it may be. |
| **How "harder" works** (FaultEngine) | `MIN_RATE` 0.30, `FIRM_RATE` 0.50 for every rule. | Rates per tier. **Proposed defaults**, tunable, "not too different": **tier 1 0.30 / 0.50 · tier 2 0.35 / 0.55 · tier 3 0.40 / 0.60.** A rule takes its tier from the metric it tests; a rule on two metrics takes the lower tier. |
| **Spin** (`Spin`) | Suppressed without an RPT ball; never prescribed. | **Prescribed as tier 3 when it exists, meaning an RPT ball.** Still absent on range and premium balls, because the device does not measure it there ("range balls obviously no spin measurements"). |
| **Face angle, face-to-path** (derived) | Never stated; face angle banned outright. | Shown and prescribed as **tier 3**. The shot modal's face-angle row (C25) becomes intended. |
| **Modelled outputs** (side carry, total, apex, descent) | Tier 3, never prescribed. | Tier 3, prescribed with the tier-3 rates. |
| **Range balls** (`Conditions`) | Gapping sizes, dispersion tails, probes and several faults switch off; "never compare across conditions". | **Treated as near-normal data.** Gapping, the yardage book, dispersion and faults all run. They carry slightly lower weight: **proposed ×0.8 in any cross-session pool**, and rate thresholds **+0.05** on range-ball sessions. They are never used for spin. Premium balls in a net or simulator count as normal. |
| **Minimum-shot floors** (10 / 15 / 30) | Enforced. | **Unchanged.** Oliver: "the minimum shot limit is nice, leave that". |
| **"Never claim" wording rules** (one strokes figure; no "+N yd per degree"; no "grooves / rewires") | Enforced. | **Unchanged.** They were not part of the decision. Ask before touching them. |
| **Inline caveats** (`BODY_CAVEAT`, `FEEL_CAVEAT`, condition caveats, `Dispersion.CAVEATS`, "modelled" labels, the tier explanations in FirstRun, "not measured here" splits) | Rendered next to the numbers. | **Removed from the main screens.** The text moves into one "How the numbers work" section in Settings and the explanation screens (MeasurementReference, SetupGuide, FirstRun). The Terms keep the error disclaimer. |
| **Retention probe** | See 7D. | The C5/C6/C26/C42 honesty fixes still apply: they are logic bugs, not measurement rules. C27 changes: a range → premium switch is allowed, with the range side weighted per the row above. |

### Phase 7 items this re-scopes

- **Become intended, so drop them:** C9 (attack-angle prescription), C25 (face angle row), C29 (spin-axis prescription), C32 (gap sizes on range balls), and C39's "range balls still get verdicts".
- **Change, don't delete:**
  - C31: slice/hook become tier 3 rates, not a range-ball ban.
  - C30: the body-cause split still matters for *wording*, but its caveat moves off-screen.
  - C8: absolute bias becomes tier 3.
  - C16/C17: C16 stays, because it is a "never claim" rule. C17 moves to Settings copy.
- **Unaffected:** every logic, pooling, date, UI, accessibility and security finding (C1–C7, C10–C15, C18–C24, C26, C28, C33–C38, C40–C49; all V and R items). **Pooling across clubs is still wrong in v2.** "Treat the numbers as accurate" does not make a driver and a wedge the same club.

### How to build it (one PR-sized piece, in this order)

1. **`Metrics`:** replace `canPrescribe` with `tierRates(tier)`, and add `CONDITION_WEIGHT` / `CONDITION_RATE_BUMP`, read by everything that judges or pools. One copy of each number, exactly as `Benchmarks.TARGET` has one copy.
2. **FaultEngine / PracticePlan / getNextStep / RetentionProbe:** drop every tier-2/3 and condition ban; apply the tier rates and the range-ball adjustment.
3. **Gapping / yardage book / Dispersion:** run on range balls, weighted.
4. **Caveats:** move to Settings under "How the numbers work". `FirstRun` keeps reading its figures from the modules, so it cannot drift.
   - **FirstRun tier copy (Oliver, 23 Sep, from his phone):** the orientation screen still says
     "Shown, never prescribed from" (tier 2) and "Never used for advice ... the app will not build a
     drill on them" (tier 3). Under v2 every tier prescribes, so both are false the day Phase 9
     ships. Rewrite them as "prescribed, judged on more shots" (tier 2) and "prescribed, judged
     hardest" (tier 3), keeping "spin only with an RPT ball". Same pass: the intro line ("the
     difference is the whole product"), "Numbers arrive late, on purpose", and the conditions
     paragraph ("break gapping", "never compared"), which says range balls are switched off.
     `first-run.js` must pin the new wording, not just delete the old. Also plain-English it: Oliver
     wants the app copy to sound like a golfer, not a textbook.
   - **FirstRun no longer opens by itself** (done 23 Sep, ahead of Phase 9): it is reachable only
     from Settings → the intro row. Do not reintroduce an auto-open.
5. **Tests:** roughly 20 suites encode the old rules. **Rewrite them to pin the NEW rules**, never delete them: the tier rates, the range weight, "spin only with RPT", "floors unchanged", "no caveat text on the main screens". A rule written down with no test pinning it is this repo's oldest defect.
6. **CLAUDE.md:** rewrite "Measurement honesty", "Claims the app must never make" (keeping the wording rules), the Dispersion and Conditions sections, and the Phase 7 rescope, in the same commit.
7. **TERMS.md:** make sure it states plainly that prescriptions treat device readings as accurate and that the device has measurement error. That is a statement of fact about the system: bump the version, regenerate the legal pages, and update `Agreement.VERSION`.

**Proposed numbers are defaults, not decisions:** the tier rates (0.30/0.35/0.40), the range weight (×0.8) and the +0.05 bump. Oliver can tune them; they live in one place.

---

## Phase 10 — Discoverability: Google, Bing and AI assistants (approved 23 Sep 2026)

**The problem in one line:** the technical SEO layer is done (sitemap,
robots.txt, JSON-LD, `llms.txt`, og-image — guarded by `seo-and-production.js`),
but the site is **one indexable URL**. The views are hash routes and crawlers drop
everything after `#`, so the only thing Google can rank is the homepage, for a
brand name nobody searches. `robots.txt` already allows every crawler, including
GPTBot, ClaudeBot and PerplexityBot (`User-agent: * / Allow: /`) — verified 23 Sep.

### 10.1 Get indexed (Oliver + one small commit; do any time)
- **Google Search Console**: Oliver adds the property; Claude adds the
  `google-site-verification` meta tag (or HTML file) and pins it in
  `seo-and-production.js`; Oliver submits `sitemap.xml`.
- **Bing Webmaster Tools**: import from Search Console. Matters beyond Bing —
  ChatGPT search and Copilot draw on Bing's index (true as of mid-2026; re-check,
  this moves fast).

### 10.2 Guide pages — the actual SEO work
Standalone, pre-rendered pages, built exactly like `/terms/` and `/privacy/`
(`tools/build-legal-pages.js`): markdown source in the repo, a generator renders
static HTML with the same CSP, a guard suite fails if HTML and markdown drift,
each page listed in `sitemap.xml`, each linking into the app.

Each page answers ONE question people actually search, from the research base —
cited, specific, honest (that is the edge over generic golf blogs). Candidates:
1. How to export your Rapsodo MLM2PRO session as a CSV (and what the columns mean)
2. How accurate is the MLM2PRO? What it measures, what it models, what it cannot see
3. Is launch-monitor spin accurate? (the limits-of-agreement numbers)
4. How to build a gapping chart / yardage book from launch monitor data
5. Smash factor by club: what good looks like (Benchmarks.DATA, tour vs amateur)
6. Driver attack angle: why the tour average is not the target
7. Range balls vs premium balls: what changes in your numbers
8. How many shots before a launch-monitor average means anything (the floors)

**Rules:** every number on a guide page comes from a module or a cited source —
the "where numbers come from" rule applies doubly to public pages. The §9 "never
claim" wording rules apply. No fabricated reviews, ratings or testimonials.

### 10.3 Custom domain — DECIDED 23 Sep: `shotlab.oliverseydlitz.com`

Oliver owns `oliverseydlitz.com` on Cloudflare. **Subdomain, not a path**
(`/shotlab`): a subdomain is its own origin, so the Supabase token in
localStorage is walled off from anything else ever put on the root; and every
path in the app is root-absolute (`/sw.js`, SW scope `/`, manifest, `/terms/`),
which a path would force us to rewrite. SEO is a wash with an empty root.

**Hosting does not move.** GitHub Pages keeps serving; Cloudflare is DNS only.
- Oliver: Cloudflare CNAME `shotlab` → `oliverseydlitz-ai.github.io`, **DNS only
  (grey cloud)** so GitHub can issue the TLS cert. Later: GitHub verified-domain
  TXT record; Supabase Site URL + redirect list; Search Console as a Domain
  property (Cloudflare adds the TXT itself — no tag in the code).
- Claude (one commit): `CNAME` file; move every absolute URL together — canonical,
  `sitemap.xml`, `robots.txt` Sitemap line, og/twitter tags, JSON-LD, `llms.txt`,
  404 page, legal generator + pages, keepalive workflow's site check — and update
  the guards that pin them. Then Oliver ticks "Enforce HTTPS" in Settings → Pages.
- The old `github.io` URL 301-redirects to the custom domain (GitHub does this).
- Browser storage is per-origin: device-only data on the old address does not
  follow. No users yet, so now is the cheapest moment.

#### (original note)
~$12/yr; better trust and click-through than `github.io`. If taken: CNAME,
canonical URLs, sitemap, og tags, Supabase redirect allowlist, and the CSP
`connect-src` all move together — one commit, with the guards updated.

### 10.4 Get talked about — WAITS for Phase 9 and the home-screen work
AI assistants recommend what the web discusses. `llms.txt` is a minor signal at
best. What moves them:
- Genuine posts where the audience already is: r/golf, r/Rapsodo, GolfWRX,
  MLM2PRO owner groups ("I built a free tool that tells you which of your
  MLM2PRO numbers to trust"). One honest post, not a campaign.
- One-off launches that create backlinks: Product Hunt, Hacker News "Show HN".
- A README on the GitHub repo that explains the app (GitHub pages rank well).

**Timing (Oliver, 23 Sep):** quality before growth still holds — no posting until
Phase 9 and the home screen land; first impressions happen once. But indexing and
the guide pages start now, because SEO takes 3–6 months to compound.

