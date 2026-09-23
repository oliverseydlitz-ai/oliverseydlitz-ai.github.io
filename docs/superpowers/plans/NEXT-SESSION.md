# Next session — start here

> **SCOPE OF THE NEXT SESSION (Oliver, 23 Sep): the guide pages ONLY (Phase 10.2).**
> Do not start Phase 9 or anything else. Phase 9 is the session after.
> Oliver calls them "redirect sites" — they are content pages ON the site, never
> redirects or doorway pages (Google penalises those). See "Guide pages" below
> and plan Phase 10.2 for the list of eight.


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
3. ~~Search Console + Bing~~ DONE 23 Sep (Domain property, verified via DNS — no tag needed in the code).
   (CLAUDE.md "Open, and NOT fixable from this repo").

## What is next, in order
0. **Rename: drop "TOUR" ("ShotLab TOUR" → "ShotLab").** Decided by Oliver 23 Sep; the scope
   checklist is in the killer plan under "Decided, queued". Small, own commit, legal version bump.
1. **Phase 9 — measurement model v2** (plan section "Phase 9"). Oliver's direction:
   every tier prescribes (lower tiers judged harder), range balls near-normal (x0.8,
   never spin), floors unchanged, "never claim" wording unchanged, caveats off the
   main screens into Settings. ~20 suites encode the old rules: rewrite them to pin
   the new rules, never delete. Resolve C8, C25, C27, C29, C31, C32 inside it.
2. **Home screen: one fault, one form, one priority** (queue item 4: V5/C11, V4,
   C13, C14, C21) — a design decision; show Oliver options first.
3. Remaining 7C polish (V7–V24, R11, R16) and the rest of 7D/7E/7F not in the Done log.
4. Rerun the QC agents (`qc-agent-briefs.md`) on the NOT YET COVERED lists.
5. **Phase 10 — discoverability.** Domain decided: `shotlab.oliverseydlitz.com` Oliver added the Cloudflare CNAME `shotlab` → `oliverseydlitz-ai.github.io` (grey cloud) on 23 Sep — the repo side of 10.3 is DONE (CNAME file + every URL moved, SW v184); what is left is Oliver's side:, then walk him through Enforce HTTPS, the verified-domain TXT, Supabase URLs and Search Console. (The sandbox cannot resolve DNS, so confirm the record via GitHub Settings → Pages, which checks it.) (plan section "Phase 10"). 10.1 (Search Console
   tag) and 10.2 (guide pages) can run alongside anything; 10.4 (posting) waits.

## Habits that paid off overnight (keep them)
- Prove every guard fails on the old code before trusting it (restore the bug).
- A check that cannot fail is not a check: async suites set `process.exitCode = 1`
  up front; `test/run.js` fails a suite with no result line.
- Plan edits by script: anchor on a line unique to the Done log — `| R3 |` also
  matches the findings table, which is how 21 rows landed in the wrong table once.
- CLAUDE.md headings: no backticked names in `###` headings (module-map.js).
- Re-run `npm test` AFTER editing CLAUDE.md, before pushing.

## Guide pages (Phase 10.2) — 7 of 8 SHIPPED, 23 Sep
- Live under `/guides/`: mlm2pro-accuracy, launch-monitor-spin-accuracy,
  smash-factor-by-club, driver-attack-angle, range-balls-vs-premium-balls,
  how-many-shots, gapping-chart-from-launch-monitor. Sources in `docs/guides/`,
  generator `tools/build-guide-pages.js`, guard `test/suites/guide-pages.js`
  (CLAUDE.md "Guide pages" section has the rules). SW v188, 73 suites.
- **Still open:** guide 1 (Rapsodo CSV export) waits for Oliver's screenshots;
  one `[[photo: ...]]` slot per guide waits for his photos (the suite lists them).
  The generator has no image syntax yet — add it when the first photo arrives
  (self-hosted under `/guides/img/`, `img-src 'self'` already allows it).
- **Phase 9 check:** after Phase 9 lands, re-read the guides' app-behaviour lines
  (floors, "ShotLab asks for the ball", range-ball wording) against the new rules.

### Original brief (Oliver's go-ahead, 23 Sep)
- **Build all 8 from the plan's 10.2 list, two per batch.** Push each pair, then
  give Oliver a short "read these two" note before starting the next pair.
- First batch also builds the generator (same pattern as `tools/build-legal-pages.js`)
  under `/guides/<slug>/`, adds each page to `sitemap.xml`, and adds a guard suite.
- **Guide 1 (Rapsodo CSV export) waits for Oliver's screenshots** — the Rapsodo app's
  menus can't be verified from the sandbox. Do the research guides first.
- Oliver will send range/app photos when he can; leave a clearly marked spot for them.
- Quality over count: stop at the 8 unless a real new search question appears.
- Scope: guides only this session; Phase 9 is the NEXT one.

## Domain + indexing — DONE by Oliver, 23 Sep (~09:15 local)
- GitHub Pages custom domain `shotlab.oliverseydlitz.com`, **Enforce HTTPS on**.
- Supabase Site URL = `https://shotlab.oliverseydlitz.com`; redirect list = the new
  domain with and without `/`, plus `https://oliverseydlitz-ai.github.io` kept
  temporarily. **Remove the github.io entry** once Oliver confirms the old address
  redirects with the padlock and Google sign-in works on the new one.
- `oliverseydlitz.com` verified on Oliver's GitHub account (takeover protection;
  covers future project subdomains). The root domain is his multi-project hub —
  never redirect it to ShotLab.
- Google Search Console: Domain property `oliverseydlitz.com`, sitemap
  `https://shotlab.oliverseydlitz.com/sitemap.xml` submitted. Bing Webmaster Tools
  imported from GSC (processing, up to 48 h).
- Still open on Supabase: leaked-password protection (Auth → Providers → Email).

