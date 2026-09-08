# ShotLab TOUR — "Modern Athletic" Redesign

**Status:** approved design, pre-plan
**Date:** 2026-09-08
**Scope:** complete visual redesign — new colour system, typography, structural
language, custom button geometry, an inline-SVG icon set replacing every emoji,
and a deeper `index.html` restructure. No product logic changes.

---

## 1. Goal

Replace the current white + red "sporty dashboard" skin (Barlow Condensed
uppercase, 10px rounded cards, green→red gradient nav, decorative corner marks,
emoji icons) with an intentional **modern-athletic instrument** design:
high-contrast graphite/white, one signal accent, flat hard-edged blocks, zero
gradients, custom-shaped buttons, a drawn icon set, oversized display numerals.

The redesign must not weaken the app's measurement-honesty behaviour or break any
of the 52 test suites, `render-scan.js`, the printed yardage card, or the SEO
layer.

### Non-goals

- No change to `app.js` analysis engines, gates, routing, auth, or storage.
- No new views or features.
- No copy rewrites beyond removing emoji glyphs from strings.
- No favicon/logo redesign (the pine-green `favicon.svg` mismatch stays a known
  open item; `og-image.png` is only re-rendered to pick up the new palette).

---

## 2. Hard constraints (landmines)

Every one of these is pinned by a test or by CLAUDE.md. The redesign preserves
each explicitly.

| # | Constraint | Source | How the redesign keeps it |
|---|---|---|---|
| C1 | Six JS-injected modals set inline `style` reading `--surface`, `--radius-md`, `--text`, `--text-dim`, `--text-muted`, `--green`, `--red`, `--accent`, `--turf`, `--yellow`, `--pine`, `--border`, `--border-hi`, `--surface2`, `--radius-sm` | `app.js` (`grep 'var(--'`), QC audit | **All existing token names kept.** Values change; names do not. Deprecated-but-referenced names (`--pine`, `--turf`, `--green-light`) become aliases to the new palette. |
| C2 | iOS: every focusable text control ≥16px under 640px, keyed on width not `pointer:coarse`, uses `!important` | `style.css:2444+`, CLAUDE.md | Ported verbatim into the new sheet, unchanged. |
| C3 | `.form-row` uses `minmax(0, 1fr)` grid tracks | `style.css`, CLAUDE.md | Ported verbatim. |
| C4 | `@media print` yardage card: everything but the book hidden, ink forced, sparkline/dots dropped, clubs-under-floor keep their row, `#yardagePrintHead` built in JS | `style.css:2361+`, CLAUDE.md | Print block rewritten against new tokens. `#view-yardages`, `#yardageTable`, `#yardagePrintHead`, `.print-only`, `.no-print` hierarchy and class hooks all kept. |
| C5 | `ViewPrefs` toggles work by a class on `<html>`, never `hidden` on a section | CLAUDE.md, `style.css:853+` | Mechanism untouched. New sheet keeps the `html.pref-*` selectors; restructure never moves a pref-controlled section into a container that gets `innerHTML`-replaced. |
| C6 | `render-scan.js` — no `NaN`/`undefined`/`[object Object]` in any view; **zero horizontal overflow at 393px**; no page errors; exits non-zero on any | `test/browser/render-scan.js`, CLAUDE.md | Run after every view is reskinned. Oversized type scales up only at ≥640px. |
| C7 | `dom-ids.js` — every `id` JS reaches for resolves; markup-only ids are listed with a reason | `test/suites/dom-ids.js` | No `id` removed. New ids (icon sprite, layout wrappers) added to the exemption list with reasons. Both directions of the suite kept green. |
| C8 | `seo-and-production.js` — `og-image.png` IHDR is 1200×630; one `<h1>` per view; home `<h1>` is descriptive text not "Home" | `test/suites/seo-and-production.js`, CLAUDE.md | `<h1>` structure and text unchanged. `og-image.png` re-rendered from its Playwright template at the same dimensions. |
| C9 | `paywall-order.js` — `applyPaywall` runs before listeners attach | `test/suites/paywall-order.js` | No JS control-flow touched. |
| C10 | `rules-are-wired.js`, `feedback-placement.js`, `drill-focus.js`, `module-map.js` | `test/suites/` | CSS/markup/icon only; no module boundaries or rule wiring touched. |
| C11 | `test/run.js` load gate — `app.js` must load whole in jsdom against the real `index.html` | `test/run.js` | Restructure keeps every element `app.js` queries at boot present in markup. |
| C12 | Service worker cache version | `sw.js`, CLAUDE.md | Bumped once at the end (v141 → v142). |
| C13 | CSP: styles `self` + `fonts.googleapis.com`; fonts `fonts.gstatic.com`; no external images/scripts beyond the pinned CDN list | `index.html` CSP meta | Archivo is served from `fonts.googleapis.com` (already allowed). Icons are inline SVG (no font, no external file). No CSP change needed. |

---

## 3. Colour system — "Range"

Near-monochrome. Chrome (nav, buttons, borders, backgrounds, headings, body
text) is graphite/white + the single accent. Saturated colour is reserved for
**data**: the 22-club categorical scale, the A–F grade stripes, and the
real/withheld/caution/loss verdict states.

### 3.1 Neutrals

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `#0B0D10` | `#FBFBFC` | app canvas |
| `--surface` | `#14171C` | `#FFFFFF` | cards, nav, modals |
| `--surface2` | `#1C2026` | `#F3F4F6` | insets, table stripes, inputs |
| `--surface3` | `#232830` | `#ECEEF1` | pressed / hover inset |
| `--line` | `#2A2F37` | `#E4E6EA` | hairline borders (the card-defining element) |
| `--border` | `#2A2F37` | `#E4E6EA` | alias of `--line` (C1) |
| `--line-strong` / `--border-hi` | `#3A404A` | `#CDD0D6` | emphasised divider, input border |
| `--text` | `#F4F6F8` | `#0E1116` | primary text, headings |
| `--text-muted` | `#A2AAB5` | `#565E6B` | secondary text, labels |
| `--text-dim` | `#6B7480` | `#8A929E` | tertiary, captions, disabled |

### 3.2 Accent

| Token | Dark | Light | Role |
|---|---|---|---|
| `--accent` | `#FF6A2B` | `#E24E12` | primary buttons, focus ring, active nav, one hero number/screen, links in chrome |
| `--accent-ink` | `#0B0D10` | `#0B0D10` | text/icon on an accent fill |
| `--accent-weak` | `rgba(255,106,43,.12)` | `rgba(226,78,18,.10)` | accent tint background |
| `--pine` | = `--accent` | = `--accent` | alias (C1) |

### 3.3 Semantic / verdict (data layer)

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--green` / gain | `#35C08A` | `#0E9463` | "change is real", improvement |
| `--green-light` | `#2AA679` | `#0B7A52` | alias/darker step (C1) |
| `--withheld` | `#8B93A0` | `#6B7480` | gated / not enough data / "no answer" — intentionally dull |
| `--yellow` / caution | `#E0A93A` | `#B57A12` | tentative fault, low sample |
| `--red` / loss | `#E5544E` | `#C43C36` | regression, blow-up, danger buttons |
| `--turf` | `#E5544E` | `#C43C36` | alias of loss (C1) |
| `--blue` / info | `#4FA8E8` | `#1F73C4` | secondary links, "modelled" tags |

Accent (hue ~18°) and caution (hue ~42°) are distinct; caution also carries a
non-colour cue (dotted underline / hatch) wherever it sits near an accent fill.

### 3.4 Club categorical scale

`CLUB_COLORS` (`app.js:113`) regenerated as an even OKLCH hue sweep — fixed
chroma ≈ 0.13, lightness ≈ 0.62 (dark) / 0.52 (light), hue rotating
0°→330° across the 22 clubs in `CLUB_ORDER`, preserving the current
warm(woods)→cool(wedges) direction. `clubColor` fallback `#8891aa` → `--withheld`.
Values are computed once and written as static hex literals (no runtime OKLCH
dependency).

### 3.5 Elevation

Shadows only on things that float above the page:

| Token | Value | Used by |
|---|---|---|
| `--shadow-sm` | none (flat) | — |
| `--shadow-md` | `0 8px 30px rgba(0,0,0,.35)` dark / `0 8px 30px rgba(0,0,0,.12)` light | modals, popovers |
| `--shadow-lg` | `0 20px 60px rgba(0,0,0,.5)` / `…,.18` | agreement gate |

Cards, nav, section blocks: **no shadow**, defined by `--line` + `--surface`.

### 3.6 Radius

| Token | Value | Note |
|---|---|---|
| `--radius` | `0` | structural surfaces — cards, inputs, nav |
| `--radius-md` | `0` | kept for C1; modals are square |
| `--radius-sm` | `2px` | chips, tags, tiny inset badges only |

Button corners are cut, not rounded (§5).

---

## 4. Typography

### 4.1 Family

```
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Expanded:wght@600;700;800&display=swap');
--font-display: 'Archivo Expanded', 'Archivo', system-ui, sans-serif;
--font-body:    'Archivo', system-ui, sans-serif;
--font-mono:    ui-monospace, 'SF Mono', 'Roboto Mono', monospace;  /* unchanged role: raw data dumps, dates */
```

Barlow Condensed and DM Sans are removed.

### 4.2 Scale (mobile base; `rem` on a 16px root, `body` 15px)

| Element | Mobile | ≥640px | Family / weight | Case |
|---|---|---|---|---|
| Hero numeral (`.stat-hero`) | 2.4rem | 3.4rem | Expanded 800, `tabular-nums`, `letter-spacing:-.02em` | — |
| `h1` / `.view-title` | 1.5rem | 2rem | Expanded 700 | UPPER, `ls:.01em` |
| `h2` / `.section-title` | 1rem | 1.05rem | Expanded 600 | UPPER, `ls:.04em` |
| `h3` | .8rem | .85rem | Expanded 600 | UPPER, `ls:.06em` |
| Kicker / label (`.kicker`) | .7rem | .72rem | Body 600 | UPPER, `ls:.08em`, `--text-dim` |
| Body | .95rem | .95rem | Body 400 | — |
| Data value | .95rem | .95rem | Body 600, `tabular-nums` | — |
| Caption / caveat | .8rem | .8rem | Body 400, `--text-muted` | — |

All numeric output gets `font-variant-numeric: tabular-nums`.

---

## 5. Buttons — custom geometry

**Chamfered cut-corner** silhouette. One shape, three weights.

### 5.1 Shape

- Base: `clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut))` — top-left and bottom-right corners sliced.
- `--cut: 10px` on standard buttons, `7px` on `.btn-sm`.
- `.btn-icon` (36px square): single cut, top-right corner only.

### 5.2 Weights

| Class | Fill | Label | Border |
|---|---|---|---|
| `.btn-primary` | `--accent` | `--accent-ink`, Expanded 600, UPPER, `ls:.03em` | none |
| `.btn-secondary` | transparent | `--text` | 1.5px `--line-strong`, drawn as a clipped layered background (a `::before` at `inset:0` filled `--line-strong`, the button's own `--surface` fill inset by the border width, both sharing the clip) because `clip-path` also clips a normal `border` |
| `.btn-danger` | `--red` | `#fff` | none |
| `.btn-ghost` | transparent | `--text-muted` | none — used for `.btn-back` |

### 5.3 States

- `:hover` — primary: accent lightens ~6%; secondary: border → `--accent`, label → `--text`.
- `:focus-visible` — `outline: 2px solid var(--accent); outline-offset: 2px;` (outline ignores `clip-path`, so it always shows). No `box-shadow` focus.
- `:active` — `transform: translateY(1px)`, no shadow. (Replaces the current `translateY(-1px)` hover bounce, which is removed.)
- `:disabled` — `--surface2` fill, `--text-dim` label, no clip change.

### 5.4 Where

Every `<button>` and `[role=button]`: nav CTAs, import flow, modal actions,
settings rows keep their full-width row treatment but pick up the cut on the
outer corners, FAB gets a single large cut.

---

## 6. Iconography — no emoji anywhere

### 6.1 Mechanism

An inline SVG sprite at the top of `<body>` in `index.html`:

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-sessions" viewBox="0 0 24 24">…</symbol>
  …
</svg>
```

Referenced as `<svg class="icon"><use href="#i-sessions"/></svg>`.
CSP-safe (no icon font, no external file). `.icon` = `1em`², `stroke:currentColor`,
`fill:none`, `stroke-width:1.6`, `stroke-linecap:square`, `stroke-linejoin:miter`
(squared to match the chamfer).

### 6.2 Inventory (draw on a 24px grid)

`i-sessions, i-bag, i-import, i-target, i-book, i-progress, i-settings, i-trash,
i-print, i-back, i-chevron, i-close, i-plus, i-check, i-warn, i-lock, i-flag
(brand mark), i-drop, i-external, i-sync, i-search, i-star`

### 6.3 `app.js` emoji purge

`grep -nP '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]' app.js`
— every hit (empty-state icons, modal titles `🏆 Achievements`, CTAs
`📤 Import First Session`, settings rows `📊 View Analytics` … ~40 sites)
replaced with either:
- `icon('name')` helper → returns `'<svg class="icon"><use href="#i-name"/></svg>'`, or
- nothing, where the glyph was purely decorative.

`index.html` static emoji (`brand-icon ⛳`, `empty-icon`, `bnav-icon`, drop-zone,
button glyphs) → `<svg class="icon">` refs. `.empty-icon` / `.bnav-icon` CSS
resized for SVG.

---

## 7. Structure — the deeper restructure

### 7.1 Tokens & primitives

- New `:root` block (§3, §4) + `:root` spacing/motion scale:
  `--s1:4px … --s7:64px`, `--tap:44px`, `--dur:.14s`.
- Layout utility classes in `style.css` replace inline `style=""`:
  - `.stack > * + *` (vertical rhythm, `--gap` var), `.cluster` (wrap+gap flex),
    `.grid-auto` (`repeat(auto-fill,minmax(var(--col,160px),1fr))`),
    `.pad-x` / `.pad` (page gutter), `.row-between`.
  - All **35** `style=""` occurrences in `index.html` and the inline grids/styles
    in `app.js` view scaffolding migrate to these. Inline `style` on
    JS-*generated* content can stay where it reads a token (C1) but static
    scaffold inline styles go.

### 7.2 Shell & nav

- One nav data source. `#topNav` (desktop) and `#bottomNav` (mobile) rebuilt
  from the same `<a>`/`<button>` list; the redundant hand-maintained copies in
  markup are consolidated where possible (icons via sprite).
- Remove: `.top-nav` gradient background, `.measurement-grid` diagonal-stripe
  overlay layers, `.top-nav … ::after` badge pseudo, the "TOUR badge high
  visibility" override stack. Brand becomes `i-flag` + `ShotLab` wordmark +
  a small `TOUR` in `--text-dim`.
- Active state: accent left-border (desktop) / accent top-border + accent label
  (mobile), no fill.

### 7.3 Cards & sections

- `.card`: `--surface` + 1px `--line`, `--radius` (0), `--s4` padding, no shadow.
- `.section-block`: top 1px `--line`, `--s5` top padding, `.kicker` label above
  the `h2`. Remove `.section-block` divider ornament, corner marks, pulse dots.
- `.score-banner` / `.stat-hero`: the one place the hero numeral + accent is used
  per screen. Flat, hairline frame, big Expanded numeral, label in `.kicker`.

### 7.4 Tables

- `.table-wrap` keeps `overflow-x:auto` (C6). Header row: `.kicker` styling,
  bottom 1.5px `--line-strong`. Body rows: 1px `--line` separators, `--surface2`
  zebra optional via `ViewPrefs`. Sticky first column (bench table) mechanism
  kept.

### 7.5 Forms

- Inputs: `--surface2` fill, 1px `--line-strong`, `--radius` (0), 16px text (C2),
  `--tap` min height. Custom select caret = `i-chevron` via background data-URI
  SVG (kept ≥16px, C2). `.form-row` grid unchanged (C3).

### 7.6 Modals & overlays

- `.modal`: `--surface`, square, `--shadow-md`, 1px `--line`. `.modal-overlay`:
  `rgba(0,0,0,.6)` + `backdrop-filter: blur(2px)`. `.modal-head` hairline.
  Close button = `.btn-icon` + `i-close`.
- Agreement gate, cookie banner, auth modal reskinned to match; no structural or
  `data-no-escape` behaviour change.
- The ~6 runtime-injected modals (`analyticsModal` … `shortcutsModal`): their
  `app.js` inline styles already use tokens (C1) — verified list, values now
  resolve to the new palette. Spot-check each after the token swap.

### 7.7 Charts (Chart.js)

- A single `chartTheme()` helper in `app.js` feeding grid/tick/font colours from
  the new tokens (read via `getComputedStyle` on `:root`), `--font-body`,
  `tabular-nums` ticks. Dataset colours: club scale from regenerated
  `CLUB_COLORS`; single-series charts use `--accent`; good/bad deltas use
  `--green`/`--red`. Re-themed on dark/light toggle.

---

## 8. Per-view checklist

Order of work. `render-scan.js` (synced mirror) after each.

1. **Sessions (home)** — quick-stats strip, next-step card, insight hosts, recent
   list. Kill inline `padding` styles. Empty state: `i-flag`, no emoji.
2. **Session Detail** — subnav, caveat hosts (keep sibling-of-header position,
   CLAUDE.md phone-layout fix), score banner → `.stat-hero`, all `.section-block`
   rhythm, metrics strip, filter chips, tables. **Highest render-scan risk** —
   this is the 393px measure point.
3. **Yardage Book** — table, print head, legend, records grid. **Do not touch**
   `@media print` semantics (C4); reskin only.
4. **Practice** — plan grid (`.grid-auto`), short game, quiet eye.
5. **Drills** — grouped library, locked-drill rows, `KINDS` headings.
6. **Progress** — filter, alert/goal/bench/compare hosts, rounds, `charts-grid`.
7. **Import** — drop zone, preview table, meta form (C2/C3), steps.
8. **Settings** — the biggest inline-style / emoji cleanup: every `.settings-row`,
   the goal inputs block, view-pref toggles, theme switch. Rebuild the goal
   `<select>`/`<input>` inline-styled block as classed markup.

---

## 9. Verification

Before push, all green:

```
npm test                       # 52 suites, load gate first
bash test/browser/sync.sh      # MUST run — stale mirror = testing the old build
# serve test/browser/site/ , then:
node test/browser/render-scan.js   # 393px: no NaN/undefined, no overflow, no page errors, exit 0
```

Plus:
- Manual browser pass at 393px and 1440px, dark and light, every view + every
  modal + print preview of the yardage book.
- `og-image.png` re-rendered, `seo-and-production.js` green (IHDR 1200×630).
- `dom-ids.js` green (exemption list updated with reasons for any new id).
- QC subagent (Haiku) review of the diff before push.
- `sw.js` cache `v141` → `v142`.
- Push straight to `main` (CLAUDE.md workflow policy).

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Oversized display type overflows at 393px (C6) | Mobile scale is conservative; display sizes step up only at `min-width:640px`. Scan after every view. |
| `clip-path` border on `.btn-secondary` renders wrong in a browser engine | Layered-background technique is the fallback-safe approach; verify in the browser pass. If it fights, drop to a 1px inset box-shadow following a `2px` radius — still not a plain rounded rect. |
| Renamed/removed token breaks a runtime modal silently (C1) | Token **names frozen**; only values change. Grep `app.js` for `var(--` before and after; every name in the before-list still defined. |
| Restructure moves a `ViewPrefs`-controlled node into an `innerHTML`-replaced parent (C5) | Pref-controlled sections (`#dashboard`, fault list, gapping, compare, heatmap) stay top-level in their view; class-on-`<html>` selectors unchanged. |
| Emoji purge misses a glyph in a rarely-rendered branch | Regex grep is exhaustive over `app.js` + `index.html`; add a cheap `test/suites` check that neither file contains an emoji codepoint. |
| `og-image` re-render drifts dimensions | Re-run its existing Playwright template only; `seo-and-production.js` reads IHDR and fails on drift. |

---

## 11. New test added

`test/suites/no-emoji.js` — asserts `index.html` and `app.js` contain no
codepoint in the emoji ranges. Cheap, and it keeps the purge from regressing.
(Added to `test/run.js` suite list → 53 suites.)
