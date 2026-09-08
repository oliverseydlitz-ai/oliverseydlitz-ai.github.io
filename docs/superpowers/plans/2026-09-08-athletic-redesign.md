# Modern-Athletic Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ShotLab's white+red sporty-dashboard skin with an intentional modern-athletic instrument design — "Range" graphite/orange palette, Archivo type, flat hard-edged blocks, chamfered custom buttons, an inline-SVG icon set with zero emoji — without breaking any test, the render scan, the printed yardage card, or the SEO layer.

**Architecture:** Pure presentation change. `style.css` is rewritten against a new token set (token *names* frozen so the six runtime-injected modals keep resolving). `index.html` is restructured: an SVG icon sprite is added, all 35 static inline `style=""` blocks move to utility classes, the nav is unified, the Settings markup is de-inlined. `app.js` changes are limited to an `icon()` helper, an emoji purge, a regenerated `CLUB_COLORS`, and a `chartTheme()` for Chart.js. No engine, gate, router, auth, or storage code is touched.

**Tech Stack:** Vanilla ES6+, no build step. CSS custom properties. Inline SVG. Chart.js 4 (CDN). Node 26 + jsdom for `npm test`. Playwright-core for `test/browser/render-scan.js`.

**Spec:** `docs/superpowers/specs/2026-09-08-athletic-redesign-design.md` — the plan argues from the spec; executors read both. Token values, the full type scale, the button geometry, and the 13 constraint table live there and are not repeated in full here.

## Global Constraints

Copied verbatim from spec §2. Every task's requirements implicitly include these.

- **C1 — token names are frozen.** These names must remain defined in `:root` after the rewrite (values may change; aliases allowed): `--bg --surface --surface2 --surface3 --border --border-hi --line --text --text-muted --text-dim --accent --accent-glow --pine --turf --green --green-light --yellow --red --blue --radius --radius-md --radius-sm --shadow-sm --shadow-md --shadow-lg --nav-h --bottom-nav-h --font-display --font-body`. `grep -oE 'var\(--[a-z0-9-]+\)' app.js | sort -u` before and after — every name in the before-list still resolves.
- **C2 — iOS ≥16px.** Every focusable text control stays ≥16px under 640px, rule keyed on width (not `pointer:coarse`), using `!important`. Port `style.css` "iOS: never let a focusable text control fall under 16px" block verbatim.
- **C3 — `.form-row` keeps `grid-template-columns: minmax(0,1fr) minmax(0,1fr)`.**
- **C4 — `@media print`:** everything but `#view-yardages` hidden, ink forced on paper, sparkline + club dots dropped, clubs-under-floor keep their row. `#yardagePrintHead`, `.print-only`, `.no-print`, `#yardageTable` hooks preserved.
- **C5 — `ViewPrefs`** works by a class on `<html>` (`html.pref-*`), never `hidden` on a section. Do not move a pref-controlled node (`#dashboard`, `#faultList` area, gapping section, `#compareHost`, heatmap) into a parent that gets `innerHTML =`.
- **C6 — `render-scan.js` must exit 0:** no `NaN`/`undefined`/`[object Object]` text in any view, **zero horizontal overflow at 393px**, no page errors. Display/oversized type steps up only at `min-width: 640px`.
- **C7 — `dom-ids.js`:** no `id` removed from `index.html`. Any new markup-only `id` added to that suite's exemption list with a one-line reason.
- **C8 — `seo-and-production.js`:** exactly one `<h1>` per view; home `<h1>` stays descriptive text ("Your sessions"), not "Home". `og-image.png` stays 1200×630 (IHDR-checked).
- **C9–C11** — no change to `applyPaywall` ordering, rule wiring, module boundaries, or anything that stops `app.js` loading whole in jsdom.
- **C12** — bump `sw.js` `CACHE` `shotlab-v141` → `shotlab-v142` once, in the final task.
- **C13 — CSP unchanged.** Fonts from `fonts.googleapis.com` / `fonts.gstatic.com` only (already allowed). Icons inline SVG — no font, no external file.

**Per-task test cycle.** This is a visual redesign; the regression gates are the test cycle. Unless a task says otherwise, every task ends with:
```
npm test                              # 52 suites (53 after Task 6), load gate first — all green
bash test/browser/sync.sh             # refresh the mirror — NEVER skip
node test/browser/render-scan.js      # exit 0
```
and a visual check of the affected view(s) at 393px and 1440px, dark and light.

---

## Task 1: New token set + font swap

**Files:**
- Modify: `style.css:1-60` (the `@import` line and the entire `:root` block)
- Modify: `style.css:61-79` (base `body`/`h1`/`h2`/`h3` — point at new vars only; keep selectors)

**Interfaces:**
- Produces: the `:root` custom properties consumed by every later task and by `app.js` (C1). Names per spec §3 tables + C1 list. New names also added: `--accent-ink`, `--accent-weak`, `--line-strong`, `--withheld`, `--s1`…`--s7`, `--tap`, `--dur`, `--cut`, `--font-mono`.

- [ ] **Step 1: Snapshot the token contract**

```bash
grep -oE 'var\(--[a-z0-9-]+\)' app.js | sort -u > /tmp/tokens-before.txt
cat /tmp/tokens-before.txt
```
Expected: ~16 distinct names. This file is the C1 checklist.

- [ ] **Step 2: Replace the `@import` and `:root`**

Replace the Google Fonts `@import` (spec §4.1):
```css
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Expanded:wght@600;700;800&display=swap');
```
Replace the whole `:root { … }` with the dark-first token block from spec §3 + §4 + the spacing/motion scale. Include **every** C1 name — set the deprecated ones as aliases:
```css
  --pine: var(--accent);
  --turf: var(--red);
  --green-light: #2AA679;
  --accent-glow: var(--accent-weak);
  --border: var(--line);
  --radius: 0; --radius-md: 0; --radius-sm: 2px;
  --shadow-sm: none;
```
Add the light override block:
```css
:root:not([data-theme="dark"]):not(.dark) { /* see note */ }
```
**Note on theme mechanism:** the app currently toggles `html.dark`. Keep that. Structure the sheet as: bare `:root` = **dark** values; `html:not(.dark)` (or the existing light selector this file already uses — check `style.css` around line 1924 `dark-mode toggle` and the existing dark rules) = **light** overrides. Match whatever the current file already does for `.dark`; do not invent `data-theme`.

- [ ] **Step 3: Repoint base typography**

`body` → `font-family: var(--font-body); font-size: 15px;`. `h1/h2/h3` → `var(--font-display)`, sizes/case/tracking per spec §4.2 **mobile column only** in the base rule. Add the `@media (min-width:640px)` step-up for `h1`, `h2`, `.stat-hero` at the end of this block.

- [ ] **Step 4: Verify the token contract holds**

```bash
grep -oE '^\s*--[a-z0-9-]+' style.css | tr -d ' ' | sort -u > /tmp/tokens-after.txt
comm -23 /tmp/tokens-before.txt <(sed 's/var(\(--[a-z0-9-]*\))/\1/' /tmp/tokens-before.txt >/dev/null; grep -oE '\-\-[a-z0-9-]+' style.css | sort -u)
```
Simpler: for each name in `/tmp/tokens-before.txt`, confirm `grep -q "  <name>:" style.css`. Every one must be present.

- [ ] **Step 5: Run the gates**

```bash
npm test
bash test/browser/sync.sh
node test/browser/render-scan.js
```
Expected: all green, exit 0. The app will look half-changed (old rules, new tokens) — that is fine; no test asserts appearance yet. If render-scan flags overflow, a token value (font size) is too large for mobile — fix in this task.

- [ ] **Step 6: Commit**

```bash
git add style.css
git commit -m "Redesign: new Range token set and Archivo font, names frozen for app.js"
```

---

## Task 2: Styleguide page + visual checkpoint

**Files:**
- Create: `docs/styleguide.html` (throwaway, not linked from the app, harmless on Pages)

**Interfaces:**
- Consumes: `style.css` tokens from Task 1.
- Produces: nothing code depends on. A screenshot target.

- [ ] **Step 1: Build the page**

A single self-contained HTML that `<link>`s `../style.css` and renders: every neutral + accent + semantic swatch with its hex and the token name; the full type scale (hero numeral → caption) with live text; a row of every button weight (`.btn-primary .btn-secondary .btn-danger .btn-ghost .btn-sm .btn-icon`) — these will be unstyled-ish until Task 3, that is expected; a placeholder grid where the icon set will go (Task 5). Include a `html.dark` toggle button (`onclick="document.documentElement.classList.toggle('dark')"`).

- [ ] **Step 2: Screenshot both viewports, both themes**

```bash
bash test/browser/sync.sh
# serve, then with playwright-core capture docs/styleguide.html at 393 and 1440, light and dark
```
Save 4 PNGs to the scratchpad.

- [ ] **Step 3: CHECKPOINT — send screenshots to the user**

Post the 4 screenshots. Wait for explicit "continue" or change requests. Apply any palette/type tweaks to `style.css` Task 1 block and re-shoot before proceeding.

- [ ] **Step 4: Commit**

```bash
git add docs/styleguide.html
git commit -m "Add throwaway styleguide page for redesign visual checks"
```

---

## Task 3: Chamfered button system

**Files:**
- Modify: `style.css:80-131` (the `button` / `.btn-*` block) and `style.css:1415-1430` (the "Buttons — display uppercase" override layer — fold it in, then delete it)

**Interfaces:**
- Consumes: `--accent --accent-ink --line-strong --surface --red --cut --dur` from Task 1.
- Produces: `.btn-primary .btn-secondary .btn-danger .btn-ghost .btn-sm .btn-icon` final geometry + states, per spec §5.

- [ ] **Step 1: Write the button block**

Per spec §5: shared `clip-path: polygon(var(--cut) 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%,0 var(--cut))`; `--cut:10px` base, `7px` on `.btn-sm`; `.btn-icon` single top-right cut. `.btn-secondary` border via the layered-`::before` technique (spec §5.2). `:focus-visible` → `outline:2px solid var(--accent); outline-offset:2px`. `:active` → `transform:translateY(1px)`. Remove the old `translateY(-1px)` hover and the `box-shadow` glows. Labels: `var(--font-display)`, uppercase, `letter-spacing:.03em`.

- [ ] **Step 2: Delete the override layer**

Remove `style.css:1415-1430` "Buttons — display uppercase" now that the base block owns it. `grep -n "btn-primary\|btn-secondary" style.css` — confirm no later rule re-rounds the corners or re-adds a shadow; if one does, fold it in and delete it.

- [ ] **Step 3: Gates + visual**

Run the per-task cycle. Check buttons in: import flow, session detail (delete/back), settings rows, modals, FAB, agreement gate. `.btn-secondary` border must render on all four corners of the chamfer — if the engine clips it, switch to the box-shadow fallback (spec §10).

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "Redesign: chamfered cut-corner button geometry"
```

---

## Task 4: `no-emoji.js` guard suite (fails on purpose)

**Files:**
- Create: `test/suites/no-emoji.js`

**Interfaces:**
- Produces: a suite auto-discovered by `test/run.js` (`fs.readdirSync(SUITES)` — no runner edit needed). Turns green only after Task 6.

- [ ] **Step 1: Write the suite**

```js
// No emoji in the shipped source. The redesign replaced every emoji glyph
// with an inline-SVG icon; this keeps the purge from regressing.
const fs = require('fs');
const path = require('path');
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/u;
// NOTE: ←-⇿ (arrows) and ⌀-⏿ are borderline — the app uses
// real arrow glyphs (←, →, ↻, ✓, ✕) in markup deliberately. Narrow the class
// to pictographic ranges only; list any surviving intentional symbol here.
const ALLOW = ['→','←','↻','✓','✕','✗','➔']; // arrows, checks, close
let failed = 0;
for (const f of ['index.html', 'app.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
  const lines = src.split('\n');
  lines.forEach((ln, i) => {
    const stripped = [...ln].filter(c => !ALLOW.includes(c)).join('');
    if (EMOJI.test(stripped)) { console.log(`FAIL ${f}:${i+1}  ${ln.trim().slice(0,80)}`); failed++; }
  });
}
console.log(failed ? `${failed} FAILED` : 'no-emoji: passed');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
node test/suites/no-emoji.js
```
Expected: FAIL, listing every current emoji site in `index.html` and `app.js` (~40+). Save that list — it is the Task 6 worklist.

- [ ] **Step 3: Do NOT commit yet**

`npm test` is now red. Commit this suite together with Task 6 so the tree is never pushed red. (Local commits are fine; a red `npm test` between Tasks 4–6 is expected and bounded.)

---

## Task 5: SVG icon sprite + `icon()` helper

**Files:**
- Modify: `index.html` — add the `<svg>` sprite as the first child of `<body>` (before `<noscript>` is fine; must be before any `<use>`)
- Modify: `style.css` — add `.icon`, resize `.brand-icon` / `.empty-icon` / `.bnav-icon` / `.drop-icon` for SVG
- Modify: `app.js` — add `icon(name)` helper near the other top-level UI utils (search a small util region, e.g. near `clubColor` ~line 135)

**Interfaces:**
- Produces:
  - Sprite `<symbol id="i-NAME">` for: `sessions bag import target book progress settings trash print back chevron close plus check warn lock flag drop external sync search star` (spec §6.2).
  - `icon(name, cls='')` → `` `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>` `` (string, for template literals).

- [ ] **Step 1: Draw the sprite**

24×24 viewBox, `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter"` on each `<symbol>`. Keep paths simple/geometric to match the chamfer. Put it in a `<svg width="0" height="0" style="position:absolute" aria-hidden="true">` wrapper.

- [ ] **Step 2: `.icon` CSS**

```css
.icon{width:1em;height:1em;display:inline-block;vertical-align:-.125em;flex:none}
.brand-icon,.empty-icon,.bnav-icon,.drop-icon{font-size:inherit}
.empty-icon{font-size:2.5rem;color:var(--text-dim)}
.bnav-icon{font-size:1.25rem}
.drop-icon{font-size:2rem;color:var(--text-dim)}
```

- [ ] **Step 3: `icon()` helper in app.js**

Add the one-liner. `grep -n "const clubColor" app.js` to find the util region; place it adjacent.

- [ ] **Step 4: Gates**

`npm test` still red (Task 4) — that is expected; confirm the redness is *only* `no-emoji.js` and nothing else regressed. `node --check app.js`. render-scan: sprite is invisible, should be no-op.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css app.js
git commit -m "Redesign: add inline SVG icon sprite and icon() helper"
```
(`npm test` still red here — the next task closes it.)

---

## Task 6: Emoji purge — `index.html` and `app.js`

**Files:**
- Modify: `index.html` — `brand-icon`, all `bnav-icon`, `empty-icon`, `drop-icon`, drop-zone, button glyphs (`+`, `←`, `✕` stay as text where they are typographic; pictographs go)
- Modify: `app.js` — every emoji in a template string (the Task 4 worklist)

**Interfaces:**
- Consumes: `icon()` from Task 5, sprite ids from Task 5.

- [ ] **Step 1: `index.html` static glyphs**

`⛳` → `icon('flag')` markup inline: `<svg class="icon"><use href="#i-flag"/></svg>`. `bnav-icon` spans: `📋→sessions 🎒→bag +→plus 🎯→target 📖→book 📈→progress ⚙️→settings`. `empty-icon` per view: sessions→`flag`, progress→`progress`, practice→`target`, drills→`book`, yardages→`bag`. `drop-icon 📂`→`drop`. Settings-row leading emoji (`🗑️ 📊 🏆 📚 🏌️ ⚡ 📋 🖨`) → `icon(...)` + keep the text label. Keep `←`, `→`, `✕`, `↻`, `✓` (typographic, in ALLOW).

- [ ] **Step 2: `app.js` template strings**

Work the Task 4 list top to bottom. Modal titles (`🏆 Achievements` → `${icon('star')} Achievements`), CTAs (`📤 Import First Session` → `${icon('import')} Import First Session`), alert/insight prefixes, `🔒` → `icon('lock')`, `⚠️` → `icon('warn')`, `✅`/`❌` in verdict text → `icon('check')` / `icon('close')` or a coloured text mark. Where an emoji was pure decoration with no meaning, delete it.

- [ ] **Step 3: Drive `no-emoji.js` green**

```bash
node test/suites/no-emoji.js
```
Iterate until `no-emoji: passed`. If a legitimate arrow/check trips the regex, narrow the range or add to `ALLOW` with a comment — do not weaken it to pass a real pictograph.

- [ ] **Step 4: Full gates**

```bash
npm test            # now 53 suites, all green
node --check app.js
bash test/browser/sync.sh
node test/browser/render-scan.js
```
Visual: bottom nav, top nav, every empty state, settings list, achievements modal.

- [ ] **Step 5: Commit (closes the red window)**

```bash
git add test/suites/no-emoji.js index.html app.js
git commit -m "Redesign: remove every emoji, replace with SVG icon set; add no-emoji suite"
```

---

## Task 7: Layout primitives + de-inline `index.html`

**Files:**
- Modify: `style.css` — new "Layout primitives" section after the base block
- Modify: `index.html` — replace all 35 `style=""` occurrences with classes

**Interfaces:**
- Produces: `.pad` (page gutter `padding-inline`), `.pad-y`, `.stack` (`> * + * { margin-top: var(--gap,var(--s4)) }`), `.cluster` (flex wrap + `gap`), `.grid-auto` (`repeat(auto-fill,minmax(var(--col,160px),1fr))`), `.row-between` (flex, `justify-content:space-between`, `align-items:center`).

- [ ] **Step 1: Write the primitives**

Small, composable, `var()`-driven. No component styling here.

- [ ] **Step 2: Migrate `index.html`**

`grep -n 'style="' index.html` → 35 hits. Each: `padding:0 1rem` → `class="pad"`; `padding:1rem` → `class="pad pad-y"`; the `practiceGrid` / `goalMetric` inline grids → `.grid-auto` / `.form-row`; the inline `<select>`/`<input>`/`<button>` styles in the Goals block → real classes (`.input`, `.select`, reuse `.btn-primary`). `data-view` links with inline `color`/`font-weight` → a `.link-inline` class. **Do not** remove `hidden` attributes or `id`s (C7).

- [ ] **Step 3: Gates + dom-ids**

Per-task cycle. `node test/suites/dom-ids.js` — if it flags a removed id, restore it; nothing here should remove one.

- [ ] **Step 4: Commit**

```bash
git add style.css index.html
git commit -m "Redesign: layout primitives; move all inline styles to classes"
```

---

## Task 8: Unified nav + shell

**Files:**
- Modify: `index.html:87-102` (`#topNav`) and `:723-753` (`#bottomNav`)
- Modify: `style.css:132-208` (top nav + bottom nav) and the override layers at `:1183-1220` (diagonal stripe), `:1439-1446` (bottom nav labels), `:1573-1622` (TOUR badge stack) — fold what survives, delete the rest
- Modify: `index.html:8-9` (`<meta name="theme-color">` values → new `--bg`)

**Interfaces:**
- Consumes: `icon()` sprite, layout primitives.
- Produces: final `.top-nav` / `.bottom-nav` / `.nav-link` / `.bottom-nav-item` styling.

- [ ] **Step 1: Markup**

Brand: `icon('flag')` + `<span class="brand-name">ShotLab</span><span class="brand-tag">TOUR</span>`. Nav links unchanged in count/`data-view`/order. Bottom nav items get `icon()` spans. Remove the `brand-icon` emoji.

- [ ] **Step 2: CSS**

Flat `--surface` bar, bottom 1px `--line`. Remove: the `linear-gradient` background, `.measurement-grid` stripe overlay, the `::after` TOUR badge pseudo and its high-vis override stack. Active link: `--accent` left-border (top-nav) / top-border + `--accent` label (bottom-nav), no fill. `--nav-h` / `--bottom-nav-h` unchanged.

- [ ] **Step 3: theme-color meta**

`#0c0c0d` → dark `--bg` `#0B0D10`; `#dc2626` (light) → light `--bg` `#FBFBFC`.

- [ ] **Step 4: Gates + visual**

Per-task cycle, both breakpoints (desktop shows top-nav, mobile shows bottom-nav — check the `@media` in `style.css:1143`).

- [ ] **Step 5: Commit**

```bash
git add index.html style.css
git commit -m "Redesign: unified flat nav, drop gradient and stripe layers"
```

---

## Task 9: Cards, section blocks, tables, forms

**Files:**
- Modify: `style.css` — `Section block` (`:430`), `Tables` (`:575`), `Form` (`:305`), plus the editorial override layers (`:1290-1414` session cards / metric cards / section-title trail / corner marks / record cards) — fold survivors, delete ornament
- No `index.html` change expected beyond Task 7

**Interfaces:**
- Produces: `.card`, `.section-block`, `.kicker`, `.stat-hero`, `.table-wrap`/`table`, `.input`/`.select` final styling per spec §7.3–§7.5.

- [ ] **Step 1: Cards + sections**

`.card` = `--surface` + 1px `--line`, `--radius` 0, `--s4` padding, **no shadow**. `.section-block` = top 1px `--line`, `--s5` top padding, optional `.kicker` label. Delete: divider ornament (`:1530`), decorative corner marks (`:1331`), trend pulse dot (`:1348`), section-title hairline-trail if it now clashes (`:1317` — keep a plain underline or nothing).

- [ ] **Step 2: `.stat-hero`**

The one hero numeral per screen (spec §4.2, §7.3): `--font-display` 800, `tabular-nums`, mobile 2.4rem / ≥640px 3.4rem, label in `.kicker`. Applied by the score banner (Task 11) — define the class here.

- [ ] **Step 3: Tables**

`.table-wrap` keeps `overflow-x:auto` (C6). `th` → `.kicker` look, bottom 1.5px `--line-strong`. `td` → 1px `--line` row separators. Keep the mobile sticky-first-column rule (`:1135`) and custom scrollbar (`:1129`).

- [ ] **Step 4: Forms**

`.input`/`.select`/`textarea`/`input[type=date]`: `--surface2` fill, 1px `--line-strong`, `--radius` 0, `--tap` min-height, **16px text** (C2 — port the iOS block verbatim, keep `!important`). Select caret = inline `i-chevron` as a `background-image: url("data:image/svg+xml,...")`. `.form-row` grid untouched (C3).

- [ ] **Step 5: Gates + visual**

Per-task cycle. Focus session-detail (the 393px measure point, C6), yardage table, bench table (sticky col), import form.

- [ ] **Step 6: Commit**

```bash
git add style.css
git commit -m "Redesign: flat cards, hairline sections, instrument tables and forms"
```

---

## Task 10: Chart.js theme + club colour scale

**Files:**
- Modify: `app.js:113-119` (`CLUB_COLORS`), `:135` (`clubColor` fallback)
- Modify: `app.js` — add `chartTheme()` near the first Chart.js `new Chart(` call; apply it to every chart config
- Modify: `style.css:475-506` (`Charts`, `Club dot`)

**Interfaces:**
- Consumes: tokens via `getComputedStyle(document.documentElement).getPropertyValue(...)`.
- Produces: `chartTheme()` → `{ grid, tick, font, good, bad, accent }`; regenerated `CLUB_COLORS` (22 static hex).

- [ ] **Step 1: Regenerate `CLUB_COLORS`**

Compute an OKLCH sweep offline (spec §3.4): 22 clubs in `CLUB_ORDER`, hue 0→330, C≈0.13, L≈0.62. Convert each to sRGB hex, write as a static literal object — same keys as now. `clubColor` fallback `#8891aa` → `#8B93A0` (`--withheld`).

- [ ] **Step 2: `chartTheme()`**

```js
const chartTheme = () => {
  const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return { grid: v('--line'), tick: v('--text-dim'), font: v('--font-body'),
           good: v('--green'), bad: v('--red'), accent: v('--accent') };
};
```
Apply to each chart: `scales.x/y.grid.color = t.grid`, `.ticks.color = t.tick`, `.ticks.font.family = t.font`, single-series `borderColor`/`backgroundColor` = `t.accent`. Re-call on the dark/light toggle (find the theme-toggle handler; after it flips the class, loop existing `Chart.instances` and `.update()`, or simplest: re-render the active view).

- [ ] **Step 3: Gates + visual**

Per-task cycle. Open Progress (7 charts), session-detail dispersion + gapping charts, both themes.

- [ ] **Step 4: Commit**

```bash
git add app.js style.css
git commit -m "Redesign: OKLCH club colour scale and token-driven Chart.js theme"
```

---

## Task 11: Per-view reskin — Sessions, Session Detail, Yardages

**Files:**
- Modify: `style.css` — view-specific sections: score banner (`:334`), metrics strip (`:375`), club filter (`:407`), swing DNA (`:455`), fault cards (`:512`), practice plan (`:707`), yardage book (`:987`), personal bests (`:992`), and the LAYOUT v2 block (`:1624-1759`)

**Interfaces:**
- Consumes: everything from Tasks 1–10.

- [ ] **Step 1: Sessions (home)**

Quick-stats strip → flat cells, hairline dividers, `.kicker` labels, values `tabular-nums`. Next-step card, insight/alert/coach hosts → `.card`. Recent list → hairline rows, no shadow. Empty state uses `icon('flag')`.

- [ ] **Step 2: Session Detail**

Subnav → chip row, `--accent` active underline. Caveat hosts (`#sinceHost #retentionHost #conditionCaveats`) stay **siblings below `.view-header`** (CLAUDE.md phone-layout fix — do not move them into the header). Score banner → `.stat-hero`. Every `.section-block` picks up the Task 9 rhythm. Metrics strip → instrument cells. **Run render-scan here specifically** — this is the 393px overflow measure point.

- [ ] **Step 3: Yardages**

Table + records grid reskin only. **`@media print` semantics untouched** (C4) — reskin the print block's *colours* to force ink, keep every `.print-only`/`.no-print`/hidden-view rule. `#yardagePrintHead` is built in `app.js` — check it still reads sane after the token swap. Records grid → flat cards, drop the "editorial serif" record-card override unless it still reads right.

- [ ] **Step 4: Gates**

Per-task cycle **plus** an actual print-preview of the yardage book (browser print dialog / `--print-to-pdf`) — confirm only the book prints, on white, with the conditions line and sample-floor note, no sparkline.

- [ ] **Step 5: Commit**

```bash
git add style.css
git commit -m "Redesign: reskin Sessions, Session Detail, Yardage Book"
```

---

## Task 12: Per-view reskin — Practice, Drills, Progress, Import, Settings

**Files:**
- Modify: `style.css` — progress (`:619`), trend box (`:623`), settings (`:643`), drill library groups (`:2413`), chipping logger (`:2444`), short-game / quiet-eye blocks, import flow (`:262`), preview table (`:1125`)
- Modify: `index.html:536-718` — Settings markup was largely de-inlined in Task 7; here, group `.settings-row`s into `.card` sections and apply the chamfer to row buttons

**Interfaces:**
- Consumes: Tasks 1–10.

- [ ] **Step 1: Practice + Drills**

Plan grid → `.grid-auto`. Short game / quiet eye / drill groups → `.section-block` + `.kicker`. Locked-drill rows: `icon('lock')` + reason text in `--text-muted`, not hidden. `KINDS` headings → `.kicker`.

- [ ] **Step 2: Progress**

Filter select → `.select`. Alert/goal/bench/compare hosts → `.card`. `charts-grid` → `.grid-auto` with `--col:280px`. Trend box → flat, hairline.

- [ ] **Step 3: Import**

Drop zone → dashed 1.5px `--line-strong`, `icon('drop')`, square. Preview table → Task 9 table look. Step headings → `.kicker` + `h2`. Meta form already C2/C3-safe from Task 9.

- [ ] **Step 4: Settings**

Wrap each `settings-section` in `.card`. `.settings-row` buttons → chamfer (single cut, full-width). Theme switch + `.pref-toggle` restyled flat (spec — keep the `html.pref-*` + `html.dark` mechanism, C5). Version/About static rows → hairline key/value.

- [ ] **Step 5: Gates**

Per-task cycle across all five views. `node test/suites/dom-ids.js`. `node test/suites/seo-and-production.js` (h1 count). If any new `id` was added, update `dom-ids.js` exemptions with a reason (C7).

- [ ] **Step 6: Commit**

```bash
git add style.css index.html
git commit -m "Redesign: reskin Practice, Drills, Progress, Import, Settings"
```

---

## Task 13: Modals + overlays

**Files:**
- Modify: `style.css` — modal overlay (`:1033`), shot detail modal (`:1010`), agreement gate (`:1062`), cookie consent (`:2174`), auth modal / tabs / social / forms, paywall blur (`:1760`)
- Modify: `index.html` — modal `.btn-icon` close buttons already use text `✕` (in ALLOW); no markup change unless a shadow/radius is inline

**Interfaces:**
- Consumes: Tasks 1, 3, 9.

- [ ] **Step 1: Static modals**

`.modal` → `--surface`, square, 1px `--line`, `--shadow-md`. `.modal-overlay` → `rgba(0,0,0,.6)` + `backdrop-filter:blur(2px)`. `.modal-head` hairline. Actions row uses chamfer buttons. Agreement gate + cookie banner + auth modal matched. No change to `data-no-escape`, tab logic, or `<form>` structure (CLAUDE.md auth-forms note).

- [ ] **Step 2: Runtime-injected modals**

`grep -n "analyticsModal\|benchmarkModal\|clubModal\|efficiencyModal\|learningModal\|shortcutsModal" app.js`. Their inline styles read tokens (C1) — open each in the running app (Settings → the `show*Btn` rows) and eyeball against the new palette. Fix any that hardcode a colour instead of a token, in `app.js`.

- [ ] **Step 3: Gates + visual**

Per-task cycle. Open: shot detail, achievements, confirm, privacy, terms, agreement gate (clear `localStorage` to retrigger), cookie banner, auth modal (all tabs), and all six injected modals. Both themes.

- [ ] **Step 4: Commit**

```bash
git add style.css app.js
git commit -m "Redesign: reskin all modals and overlays"
```

---

## Task 14: Sweep, og-image, QC, ship

**Files:**
- Modify: `sw.js:1` (`CACHE`)
- Modify: `og-image.png` (re-render — only if a template/generator is found)
- Possibly modify: `style.css` (leftover override layers), `docs/styleguide.html` (delete)

- [ ] **Step 1: Dead-CSS sweep**

`grep -nE "^/\* ── " style.css` — walk the remaining "v2 fixes / v3 fixes / editorial / TOUR badge / animation override" layers (`:1160`–`:1622`). Anything now redundant or fighting the new system: remove. Anything still needed: leave. Re-run gates after.

- [ ] **Step 2: og-image**

`find . -path ./node_modules -prune -o -iname '*og*' -print` and check `test/` for a Playwright generator. If found: re-run it (it renders from a template at 1200×630). If **not** found: leave `og-image.png` as-is — `seo-and-production.js` only checks IHDR dimensions, which are unchanged; note in the commit that the card art still shows old accent and is a follow-up.

- [ ] **Step 3: Delete the styleguide**

```bash
git rm docs/styleguide.html
```

- [ ] **Step 4: Full verification**

```bash
npm test                              # 53 suites — all green
bash test/browser/sync.sh
node test/browser/render-scan.js      # exit 0
node --check app.js
```
Manual browser pass: every view + every modal + yardage print preview, at **393px and 1440px**, in **dark and light**. Confirm: no emoji anywhere, buttons chamfered everywhere, no gradient/shadow on chrome, charts themed, caveat text still present and legible.

- [ ] **Step 5: QC subagent review**

Dispatch a Haiku subagent with the full `git diff main...HEAD --stat` + the diff of `style.css`, `index.html`, `app.js`. Ask it to check against spec §2 (all 13 constraints), hunt for: removed `id`s, hardcoded colours that should be tokens, any `box-shadow`/`border-radius` re-added to chrome, missed emoji, `render-scan`/`dom-ids`/`seo` risks, and CSP violations. Address anything it confirms.

- [ ] **Step 6: sw cache bump + ship**

```bash
# sw.js: shotlab-v141 -> shotlab-v142
git add sw.js
git commit -m "Redesign: bump service worker cache to v142"
git push origin main
```

- [ ] **Step 7: Memory**

Write a `project` memory noting the redesign shipped, the palette name ("Range"), the new font (Archivo), the icon-sprite pattern, and `no-emoji.js` as the new guard. Update `MEMORY.md` index.

---

## Self-Review

**Spec coverage:**
- §3 palette → Task 1 (tokens), Task 10 (club scale). ✓
- §4 typography → Task 1 (font + base), Task 9 (`.stat-hero`), §4.2 step-up in Task 1. ✓
- §5 buttons → Task 3. ✓
- §6 icons / emoji purge → Tasks 4, 5, 6. ✓
- §7.1 primitives → Task 7. §7.2 nav → Task 8. §7.3 cards/sections → Task 9. §7.4 tables → Task 9. §7.5 forms → Task 9. §7.6 modals → Task 13. §7.7 charts → Task 10. ✓
- §8 per-view order → Tasks 11, 12. ✓
- §9 verification → Task 14. ✓
- §10 risks → per-task test cycle + Task 3 fallback + Task 1 C1 check + Task 14 QC. ✓
- §11 `no-emoji.js` → Task 4 (creation), auto-discovered by `run.js` (verified: `fs.readdirSync`). ✓
- 13 constraints → Global Constraints block, verbatim. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases". CSS values reference spec §-numbers (the spec has the exact tables); code steps show real code. The one soft spot — Task 14 Step 2 og-image — has an explicit fallback path, not a placeholder.

**Type consistency:** `icon(name, cls)` signature identical in Tasks 5 and 6. `chartTheme()` return keys (`grid tick font good bad accent`) consistent Task 10 Steps 2–3. `CLUB_COLORS` keeps existing keys (Task 10). Token names: Global Constraints C1 list == Task 1 Step 4 check == spec §3.

**Known deviations from a pure-TDD plan:** this is a visual redesign; Tasks 1–3 and 7–13 use the regression suites + render-scan + visual check as their test cycle rather than a written-first unit test. Task 4/6 (`no-emoji.js`) is genuine test-first. This is called out in the per-task cycle note and is the honest shape of the work.
