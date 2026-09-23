# Overnight run — 23→24 Sep 2026 (Oliver asleep, check-ins every 30 min until 05:30 CEST)

Every check-in reads this file first. Oliver's words: keep working; if everything is done,
make new plans; if a run gets cut off, finish what was started before anything new.

## Each check-in, in this order

1. **Recover first.** `git status` and `git log origin/main..HEAD`. Uncommitted or unpushed work
   is the previous run's, cut off: finish it, validate it, push it. Nothing new until that is clean.
2. **Pull** `origin main`.
3. **Take the next item** from the queue below. One item, or a tight batch of small ones.
4. **Validate before every push:** `npm test` all green; `bash test/browser/sync.sh`, serve
   `test/browser/site` on 8766, `render-scan.js` exit 0 both with and without `SM_NO_IO=1`;
   bump `sw.js` if app files changed. A fix that turns something red is reverted, not pushed.
5. **Push to `main`** (and mirror to `claude/guide-pages-phase-10-2-1mfcfo`).
6. **Log one line** in the log at the bottom: time, what shipped, commit.

## Hard limits (all night)

- No Supabase or database writes, no dashboard changes, no deleting anyone's data.
- No changes to `TERMS.md` / `PRIVACY.md` / `Agreement.VERSION`.
- **Oliver's calls stay his** — do not decide: section-heading style (V14), default theme / manifest
  colours (R16), the logo, the "TOUR" chip and the rename, collapsing the Practice view, the home
  screen "one fault / one form / one priority" layout, the affiliate link, the tuning numbers
  (tier rates, ×0.8, +0.05). Write proposals for these instead; never ship them.
- Do not spawn agents. No posting anywhere outside this repo.
- CLAUDE.md rules all hold (never-claim wording, sources for numbers, no emoji, no colour literals…).

## Queue

1. ~~DONE 21:40~~ Regression test: the retention block must not repeat a club or a deadline when two probes
   share a club (fixed in `25050c6`, unpinned).
2. The 7D / 7E / 7F items in `2026-09-22-killer-plan.md` that are not in its Done log and are not
   Oliver's calls, and are not made moot by Phase 9 (C25, C27, C29, C31, C32, C9 are v2-intended).
3. The "NOT YET COVERED" lists in the killer plan: walk those areas yourself at 393px and 1440px
   (screenshots via playwright-core), fix defects that are clearly defects.
4. When 1–3 are done: **make a new plan.** Walk every view at 393px with the test fixtures, list what
   is weak, write it to `docs/superpowers/plans/2026-09-24-next-plan.md` with severity and a
   proposed fix, then implement the small, unambiguous ones. Anything that is a design or product
   choice goes in the plan as a question for Oliver.
5. **05:30 CEST (last check-in):** stop starting new work. Make sure everything is pushed, then write
   a short "Morning summary" at the top of this file: what shipped (commits), what is half-done,
   and the questions waiting for Oliver.

## Log
- 21:35 CEST — overnight rules written; 16 check-ins scheduled 22:00–05:30.
- 21:40 CEST — queue 1 done: retention repeat pinned (probe-window.js, mutation-tested), UI.renderRetention exported; 16 check-ins scheduled (trig ids in session). SW v193.
- 22:15 CEST — queue 2 batch: R28, R38, R40, V35, V43 (reduced motion, data-rights modal, meta tag, scroll padding, disabled buttons). SW v194.
- 22:25 CEST — queue 2 batch: R39 (auth error copy, pinned), V34 (drill tabs). SW v195.
- 22:40 CEST — queue 2: R32 (form errors announced, fields marked; `form-errors.js`, 75 suites). SW v196.
