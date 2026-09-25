# Next session — start here

Written 25 Sep 2026, at the end of the 24 Sep session (overnight run plus a day of
interactive work). Replaces the 23 Sep version.

## Read first, in this order
1. `CLAUDE.md` — the authority on every rule. Where anything else disagrees, it wins.
2. `docs/superpowers/plans/2026-09-24-next-plan.md` — **the working list.** Section A is
   done; section B is the queue; section C is the list of Oliver's decisions; section D covers what changed.
3. `docs/superpowers/plans/2026-09-22-killer-plan.md` — the findings table (every item
   ID like R37, C45, V41 is defined there) and the **Done log** (one row per shipped item).
4. `docs/superpowers/plans/OVERNIGHT.md` — only for its **hard limits**, which still apply.

## State at handover
- `main` at `f17bab8` (V38/V39). **82 suites green.** The render scan exits 0 both plain
  and with `SM_NO_IO=1`. Service worker `shotlab-v222`. 58 modules.
- Branch `claude/guide-pages-phase-10-2-1mfcfo` mirrors `main`. **Push to `main`**
  (Oliver's rule). If the session is on a feature branch, push with `git push origin HEAD:main`,
  not `git push origin main`. The latter pushes the stale local `main` and gets rejected.

## Shipped 24 Sep (each has a Done-log row with its commit)
A1–A8 (clean badge, plurals, zero-delta colour, unsourced superlatives, sample SD app-wide,
premium label, left edges, chart ticks) · C30 (measured causes are opt-in, exactly 7) ·
C45 part (round validation, date field, visible without imports) · C46 part (repeatability
verdict, sign test on one-way misses) · R25 (storage flag read back) · R30 (Back/Forward,
`#session/<id>`) · R31 part (stale renders dropped) · R33 part (icon-only nav < 380px, reflow
at 320px) · R27 part (`theme.js`, no white flash) · R29 (observer leak) · V37 (confirm verbs)
· V40 (plan cards open the range card) · V38/V39 (Settings dialogs on the `.modal` shell,
one group, same numbers everywhere).

## What is next, in order
1. ~~**R37**~~ — done 25 Sep, see the killer plan's Done log.
2. **C45 leftovers** — one significance threshold in `Rounds`; `rangeLink` vs its caveat;
   the putts plateau.
3. **C46 leftover** — the dispersion tail trend still uses a 1-SD rule; put it on the same test.
4. **R31 leftover** — render local sessions first, then merge the cloud copy behind them.
5. **V41, V46–V49** — Settings built two ways; print dedupe; heading wrap at 393px;
   circles in a zero-radius system; Data & Rights polish (V49 touches the 48 h / 30 day
   promises. Those are Oliver's call, see below. Do the styling only).
6. **C39 / C40** — re-read under measurement v2 first. Only the *pooling across clubs*
   half survives (Club Benchmarks, personal bests).
7. **C33 follow-up** — the Progress trend should weight range sessions ×0.8 (`Metrics.conditionWeight`).
8. **R33 / R27 leftovers** — ~197px (200% zoom) overflow in heatmap, benchmark table,
   short-game fields, drill tabs; the ungated shell and dead "+" before `app.js` runs.
9. **R36** — performance (`defer` vendor scripts, measure first).

## Oliver's calls — propose, never ship
- **Decided but not done: drop "TOUR" → "ShotLab".** Scope checklist is in the killer
  plan under "Decided, queued". It touches `index.html` (9 hits), `manifest.json` and the
  legal documents, so it needs a legal version bump. **Confirm with Oliver before
  touching `TERMS.md` / `PRIVACY.md` / `Agreement.VERSION`.**
- Data & Rights "within 48 hours" / "within 30 days" promises: keep, change or remove?
- V14 heading style · R16 default theme / manifest colours · R35 "system" theme (after R16)
  · the logo colour · collapsing the Practice view · home screen "one fault / one form /
  one priority" · the affiliate link · the tuning numbers (0.30/0.35/0.40, ×0.8, +0.05).
- Guide photos and the Rapsodo CSV-export screenshots (the guide suite lists the open slots).
- Supabase dashboard: redirect allowlist check; leaked-password protection.

## The loop for every item (do not skip steps)
1. Read the item's row in the killer plan; read the code it names.
2. Fix it. Write or extend a suite that **fails on the old code**. Prove that by swapping the
   old `app.js` back in (`git show HEAD:app.js > app.js`), running the suite, then restoring.
3. `node --check app.js` → `npm test` (all green).
4. `bash test/browser/sync.sh`. Serve `test/browser/site` on port 8766 (check with curl first; restart
   with `nohup python3 -m http.server 8766` from that directory). Then
   `node test/browser/render-scan.js` and `SM_NO_IO=1 node test/browser/render-scan.js`,
   both must exit 0 (each takes ~2 min, so use a 300 s timeout).
5. Anything visual: screenshot at 393px and 1440px (and dark) with Playwright
   (`executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`). To get past
   the gates: tick `#agreementCheckbox` + `#agreementRiskCheckbox`, click
   `#agreementAcceptBtn`, `#cookieAcceptBtn`, then `#authGuestWrap button`.
6. Bump `sw.js` (`shotlab-vNNN`) and every version and suite count in `CLAUDE.md`. If CSS
   changed, run `node tools/build-design-md.js` (design-md.js fails otherwise).
7. Done-log row in the killer plan + strike the item in the next-plan. Re-run `npm test`.
8. Commit ending in the session's attribution trailer, then push to `main` and the branch mirror.
9. Report to Oliver: what was wrong, what changed, what was verified, what is next.

## Traps that cost time on 24 Sep
- `dom-ids.js` and `focus-trap.js` scan app.js source for ids. Anything built through a
  helper (`runtimeModal('xModal', …)`) is recognised by pattern; keep that call shape.
- Test fixtures with fractional round stats (4.6 penalties) are now refused by
  `Rounds.validate`. Build rounds from whole numbers and assert they were logged.
- A suite asserting one number off shots near the trim boundary moves when `stdDev` or
  the trim changes. Use seeded or hand-written jitter, never `Math.random()`.
- CLAUDE.md: no backticked names in `###` headings (`module-map.js`).
- Source scans match their own comments. Strip comments, or anchor on the claim.
