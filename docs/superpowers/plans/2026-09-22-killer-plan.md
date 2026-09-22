# The Killer Plan — from correct to good

Written 22 September 2026 after walking the real app on a 393px phone and a
1440px desktop with two imported sessions, every view, every modal. Everything
below is measured unless it says otherwise.

## STATUS (read this first)

| Phase | What | State |
|---|---|---|
| 0 | Defects visible on the home screen and yardage book | in progress — see the table |
| 1 | The first 60 seconds | **guest button done**; the rest not started |
| 2 | Session detail is 15 phone screens | not started |
| 3 | Finish the queued design work | not started |
| 4 | Speed | not started |
| 5 | Growth | **deliberately deferred** — see the decisions |
| 6 | Supabase dashboard | Oliver only |

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
| 0.1 | **Two "Consistency" figures on one screen that disagree.** `EnhancedMetricsWidget` and `QuickStats` both render one, and "Form grade B" sits beside "Form 83". Two roads to one label is the drift this repo refuses everywhere else. | 87% vs 89% on the same data | open |
| 0.2 | **Tip-of-the-day is eight hand-typed lines.** One sends the golfer to a Learning Library this repo established has no lessons; "consistency matters more than distance" is unsourced, and the strokes-gained literature the app is built on does not say it off the tee. Fails "before adding any number to a screen, ask where it comes from". | 8 literals in `renderHome` | open |
| 0.3 | **Every view title has no gutter on a phone.** | `left: 0px` on all views, cards sit at 16px | open |
| 0.4 | **The yardage book table scrolls sideways** — on the one screen you stand over a shot with — and the trend column is off-screen. | 723px of table in a 359px box | open |
| 0.5 | **The same fault shows twice on home** — once as the ranked card, again as an alert directly under it. | | open |
| 0.6 | Desktop: the "Consistency" label spills out of its stat card; "Tap to go" is shown to a mouse. | | open |
| 0.7 | **`render-scan.js` cannot see 0.3, 0.4 or 0.6** — it measures page-level overflow only. Extend it: clipped inner overflow, view-title gutter, label outside its box. Prove each against the real defect first, the same way every other guard here was proved. | | open |

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
