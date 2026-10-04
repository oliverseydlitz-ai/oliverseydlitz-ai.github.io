# Plan — first-load payload, 4 October 2026

## Why this plan exists, and what it deliberately is not

R36 (25 Sep) measured `defer` on the five blocking script tags and **did not ship
it**: the throttled connection is bandwidth-bound, not latency-bound, so
reordering the fetches changed nothing (16 ms on an 8.4 s load, inside noise).
That commit named the only fix that can work:

> A real fix for the long load has to cut total payload (minify, or load
> Chart.js/Supabase on demand instead of up front), which is a different task.

This is that task. It cuts payload and it cuts contention. It does **not**
re-litigate `defer`, and it does not touch a single measurement rule, gate,
caveat or piece of copy. No golfer-visible behaviour changes anywhere in it.

## What was measured before writing this (all verified, 4 Oct)

Compressed transfer sizes, which is what actually crosses the wire (GitHub
Pages serves gzip/brotli — note the R36 run was against an uncompressed
`python3 -m http.server` mirror, so its ~1.2 MB figure overstates the real
payload roughly 2x):

| asset | raw | gzip | brotli |
|---|---|---|---|
| `app.js` | 787,653 | 244,876 | 194,035 |
| `vendor/chart.umd.js` | 208,522 | 70,398 | 61,035 |
| `vendor/supabase.js` | 218,318 | 55,280 | 47,210 |
| `style.css` | 181,807 | 47,945 | 39,429 |
| `vendor/papaparse.min.js` | 18,874 | 6,858 | 6,168 |
| `index.html` | 55,394 | 13,951 | 11,414 |
| `fonts/*.woff2` | 176,344 | (already compressed) | |

Three further facts, each checked rather than assumed:

1. **Every vendor file is already minified** (`chart.umd.js` longest line
   199,933 chars). "Minify the vendor bundles" is not available.
2. **`sw.js` precaches 1,732,222 bytes raw across 25 assets**, and
   `registerServiceWorker()` is called from inside `init()` (app.js:12505) on
   `DOMContentLoaded`. So `install` then `cache.addAll(...)` pulls 1.69 MB down
   the same pipe the app is still booting on. This is contention nobody
   measured, and on the R36 profile it is plausibly a large share of the 8.4 s.
3. **`archivo-latin-ext.woff2` (86,240 bytes) is never needed by the app's own
   text.** A grep for every codepoint in its `unicode-range` across `app.js`
   and `index.html` returns nothing. `unicode-range` means a browser would
   never request it — but the service worker forces the download on install
   anyway, and the precache comment justifies it as "render-blocking", which
   is true of `archivo-latin.woff2` and false of this one.

## Out of scope — do not do these

- **Do not minify `app.js`.** Measure it and write the number down (Task 4);
  do not ship it. The comments in `app.js` are load-bearing documentation and
  several suites scan its source — serving a minified copy while the suites
  scan the unminified one is a second copy of the truth, which is the drift
  this repo exists to prevent. It is Oliver's call and it stays open.
- **Do not lazy-load `vendor/supabase.js`.** Worth 55 KB gzip, and it touches
  the auth path — the most expensive place in this codebase to be wrong.
- **Do not add `defer`.** Already measured, no benefit (R36).
- **Do not remove `ViewPrefs.setPref`.** It is a deliberate negative control
  for `rules-are-wired.js`. Removing it invalidates every other pass in that file.
- **Do not purge "unused" CSS.** Measured: of 645 classes, 32 are never named
  in source, and 21 of those are built dynamically (`sev-${}`, `conf-${}`,
  `tone-${}`, `outcome-${}`, `sg-tier-${}`, `drill-group-${}`, `trend-${}`).
  The 11 genuinely dead ones are worth ~1-2 KB. Not worth the risk.
- **Do not change any threshold, gate, caveat, verdict wording or claim.**

---

## Task 1 — service-worker registration leaves the boot critical path

**The defect.** `init()` calls `registerServiceWorker()` at app.js:12505, during
boot. The SW's `install` handler then `addAll`s 1.69 MB of precache while the
app is still fetching and parsing its own 1.2 MB. On a capped pipe these are
the same pipe.

**The change.** Keep `registerServiceWorker()` exactly as it is — including the
`visibilitychange` then `reg.update()` behaviour, which is R37's and must survive.
Move only the *call*: out of `init()`, to after the window `load` event, then
one `requestIdleCallback` (with a `setTimeout` fallback for Safari, which has
no `requestIdleCallback`).

**What this costs, stated honestly.** On the very first visit, offline
capability arrives a few seconds later than it does today. On every subsequent
visit nothing changes — the SW is already installed and serving the shell from
cache. That trade is worth naming in the comment.

**Prove it.** Extend `test/suites/service-worker.js`: assert the registration
call is not reached synchronously from `init()`, and that it is wrapped in a
`load`-or-idle deferral. Write the assertion so it **fails against the current
code** — demonstrate that by running it before the fix.

---

## Task 2 — Chart.js off the critical path

**The defect.** 70 KB gzip / 208 KB raw, plus the main-thread cost of parsing
and compiling 208 KB of JavaScript, paid on every single load — for a library
that is not touched until a chart renders. All 7 `Chart.` occurrences in
`app.js` are inside comments; the only runtime use of the global is
`new Chart(canvas, cfg)` at app.js:7799.

**Constraints that make this tractable, and the three that can break it:**

- `chart()` at app.js:7774 is **synchronous** and already guards
  `typeof Chart !== 'function'` by returning `null`.
- Exactly **3 call sites**, all of the form `_charts[x] = ScrollMotion.chart(...)`
  (app.js:9291, 9344, 10448).
- `destroyChart(id)` calls `_charts[id].destroy()` inside a try/catch.
- `retintCharts()` does `Object.values(_charts).forEach(c => { const sc =
  c.options && c.options.scales; if (!sc) return; ... })` — so a handle with no
  `.options` is already skipped safely. Confirm this rather than trusting it.
- **`test/suites/scroll-motion.js` asserts `new Chart(` appears exactly once and
  that the line is literally `const inst = new Chart(canvas, cfg);`.** The
  design must preserve that statement verbatim. Do not satisfy the suite by
  editing the suite.

**The design.**

1. Remove `<script src="vendor/chart.umd.js"></script>` from `index.html`
   (line 892). Leave the other four script tags alone.
2. Inside the ScrollMotion module, add `ensureChart()`: injects the script once,
   returns a cached promise, resolves on `load`, rejects on `error`. It must be
   **safe where there is no real browser** — in jsdom the injection will not
   execute, so a rejection or a never-settling promise must leave the app
   working and must not produce an unhandled rejection. `test/run.js` does not
   stub `Chart`, so today `chart()` returns `null` under the load gate; nothing
   there may start throwing.
3. `chart(canvas, cfg)` stays synchronous:
   - **`Chart` already present** then build immediately through the existing path,
     return the real instance. Byte-for-byte today's behaviour.
   - **not yet present** then return a small handle, and kick `ensureChart()`. The
     handle exposes `destroy()` (sets a cancelled flag, and forwards to the real
     instance if one has since been built) and reads `options` off the real
     instance when there is one. On resolve, if not cancelled, build through the
     *same* internal function and keep the result on the handle.
4. Warm it without blocking: call `ensureChart()` once on idle after boot, so by
   the time anyone opens Progress the library is almost always already there.
   On-demand remains the correctness path; the warm-up is only latency.

**Known edge, accept and note it.** A theme toggle during the few hundred ms a
chart is pending leaves that chart's pre-built `cfg` holding the previous
theme's token values, because the caller baked them in via `chartTheme()`.
It self-corrects on the next render. Write it in the comment; do not build
machinery for it.

**Prove it.** New suite `test/suites/chart-lazy.js`:
- `index.html` contains no `chart.umd.js` script tag;
- the loader exists and is referenced from `chart()`;
- `new Chart(` still appears exactly once (belt and braces with scroll-motion.js);
- a pending handle survives `destroy()` without throwing;
- `retintCharts()` tolerates a handle that has no `.options`.

**This is the item most likely to break something, and the render scan is the
only check that can see it.** Charts must still appear on Progress and on the
session detail. If the scan cannot be made to pass, revert Task 2 and ship the
rest — say so plainly rather than loosening a check.

---

## Task 3 — stop precaching the font the app never uses

Remove `'/fonts/archivo-latin-ext.woff2'` from `ASSETS` in `sw.js`. **Keep both
`@font-face` blocks in `style.css` untouched** — a golfer's note may contain an
extended-latin glyph, and that should still fetch on demand (or fall back,
which `font-display: swap` already handles).

Correct the precache comment: `archivo-latin.woff2` is render-blocking and
precached for that reason; the ext file is not, is never requested by the app's
own text, and was costing 86 KB on every first install.

`test/browser/sync.sh` copies `fonts/*.woff2` explicitly as well as walking
`ASSETS`, so the mirror is unaffected — verify that rather than assuming it.

**Prove it.** Extend `test/suites/service-worker.js`: `ASSETS` contains
`archivo-latin.woff2` and does **not** contain `archivo-latin-ext.woff2`, and
both `@font-face` blocks are still present in `style.css`. The second half is
the one that matters — it stops a later cleanup deleting the font itself.

---

## Task 4 — write down the app.js minification number, ship nothing

Measure what minification would actually buy (`npm i --no-save terser`, or
equivalent, then throw the artefact away). Record raw/gzip/brotli before and
after in `CLAUDE.md`'s Performance Notes beside the R36 entry, with the reason
it is not shipped: the comments are documentation, suites scan the source, and a
served-minified / scanned-unminified split is a second copy of the truth.

Leave no build step, no generated file, no new dependency in `package.json`.

---

## Task 5 — CLAUDE.md is stale and actively misleading

It describes a tree that no longer exists. Correct at least these, by reading
the current source rather than this list:

- "**64 suites — 63 green and `contrast.js` red by design**" becomes **87 suites, all
  green**. `contrast.js` passes now; the palette contrast defect was fixed.
  The whole "one open defect" framing in *Where things stand* is wrong.
- Service worker **v155** becomes the current value (v232 before this plan's bump).
- "`.drill-card` is defined twice and the later rule wins ... unreachable across
  four components" — resolved; the inset component is now `.drill-card--inset`.
- The module count, checked against `module-map.js` rather than restated.
- Add this plan's three findings to Performance Notes next to R36.
- Update *Where things stand* and the **Last updated** line.

Do not rewrite the rules, the research-base sections, or any of the "never make
this claim" material. This is a factual refresh of state, nothing else.

---

## Verification — every step, in this order, no skipping

1. `node --check app.js`
2. `npm test` — **all suites green**. New/extended suites must have been shown
   to fail against the old code first.
3. `bash test/browser/sync.sh`
4. Serve `test/browser/site/` on port 8766.
5. `PW_CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe" node test/browser/render-scan.js`
   — must **exit 0**. (`playwright-core` is not installed here:
   `npm i --no-save playwright-core`. Chrome is at that path on this machine;
   the script's `/opt/pw-browsers/...` default is the cloud box's.)
6. The same again with `SM_NO_IO=1` — must also exit 0. Both runs take ~2 min.
7. **Confirm charts actually render** on Progress and on a session detail, not
   merely that the scan exits 0. Screenshot at 393 px if there is any doubt.
8. CSS changed? Then `node tools/build-design-md.js` (`design-md.js` fails otherwise).
9. Bump `sw.js` to the next `shotlab-vNNN` and make every version and suite
   count in `CLAUDE.md` agree with the tree.
10. `npm test` once more after the doc edits.

Report what was wrong, what changed, what was verified with which command, and
anything deliberately left undone.
