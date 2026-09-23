# Next session — start here (written 23 Sep 2026, end of the overnight run)

Read `CLAUDE.md` (the authority), then the killer plan's STATUS table, Decisions
block, Suggested order and Done log (`docs/superpowers/plans/2026-09-22-killer-plan.md`).

## State
- `main` at the commit that added this file. 72 suites green, render scan exit 0
  (both with and without `SM_NO_IO=1`), service worker `shotlab-v183`.
- Branch `claude/project-tasks-dowlrx` mirrors `main`. Oliver's rule: push to `main`.
- 26 Phase 7 items shipped overnight; each is one row in the plan's Done log with its commit.

## Oliver has to do (only he can)
1. ~~Keep-alive~~ **DONE** — Oliver ran it manually 23 Sep 04:21 UTC, run #1 green
   (21 s). The schedule takes over from here; just confirm scheduled runs appear.
2. Supabase dashboard: redirect allowlist check, leaked-password protection.
3. Google Search Console + Bing Webmaster Tools accounts (Phase 10.1) — Claude adds the verification tag once Oliver has the code.
   (CLAUDE.md "Open, and NOT fixable from this repo").

## What is next, in order
1. **Phase 9 — measurement model v2** (plan section "Phase 9"). Oliver's direction:
   every tier prescribes (lower tiers judged harder), range balls near-normal (x0.8,
   never spin), floors unchanged, "never claim" wording unchanged, caveats off the
   main screens into Settings. ~20 suites encode the old rules: rewrite them to pin
   the new rules, never delete. Resolve C8, C25, C27, C29, C31, C32 inside it.
2. **Home screen: one fault, one form, one priority** (queue item 4: V5/C11, V4,
   C13, C14, C21) — a design decision; show Oliver options first.
3. Remaining 7C polish (V7–V24, R11, R16) and the rest of 7D/7E/7F not in the Done log.
4. Rerun the QC agents (`qc-agent-briefs.md`) on the NOT YET COVERED lists.
5. **Phase 10 — discoverability** (plan section "Phase 10"). 10.1 (Search Console
   tag) and 10.2 (guide pages) can run alongside anything; 10.4 (posting) waits.

## Habits that paid off overnight (keep them)
- Prove every guard fails on the old code before trusting it (restore the bug).
- A check that cannot fail is not a check: async suites set `process.exitCode = 1`
  up front; `test/run.js` fails a suite with no result line.
- Plan edits by script: anchor on a line unique to the Done log — `| R3 |` also
  matches the findings table, which is how 21 rows landed in the wrong table once.
- CLAUDE.md headings: no backticked names in `###` headings (module-map.js).
- Re-run `npm test` AFTER editing CLAUDE.md, before pushing.
