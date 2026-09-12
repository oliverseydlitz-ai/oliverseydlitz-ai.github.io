---
version: 1
name: ShotLab-TOUR
source: generated from style.css by tools/build-design-md.js — do not hand-edit
description: |
  A measurement instrument, not a dashboard. Near-monochrome graphite chrome,
  one signal-orange accent, zero border radius, 1px hairlines instead of
  shadows, and a flat canvas with no decoration on it at all. Saturated colour
  is reserved for data: the club scale, the verdict semantics, the activity
  ramp. The protagonist of every screen is the measured figure.

colors:
  bg:
    light: "#FBFBFC"
    dark: "#0B0D10"
    role: page ground. The canvas is flat — there is no decorative background
  surface:
    light: "#FFFFFF"
    dark: "#14171C"
    role: a card or panel, one step up from the ground
  surface2:
    light: "#F3F4F6"
    dark: "#1C2026"
    role: a block inside a card; the second rung of the ladder
  surface3:
    light: "#ECEEF1"
    dark: "#232830"
    role: the third rung — an inset, a hover ground, an idle heatmap cell
  line:
    light: "#E4E6EA"
    dark: "#2A2F37"
    role: the card-defining element. A 1px hairline, NEVER a shadow
  line-strong:
    light: "#CDD0D6"
    dark: "#3A404A"
    role: a hairline that has to win against a busy surface
  text:
    light: "#0E1116"
    dark: "#F4F6F8"
    role: primary text
  text-muted:
    light: "#565E6B"
    dark: "#A2AAB5"
    role: secondary text, captions, units
  text-dim:
    light: "#8A929E"
    dark: "#6B7480"
    role: the lowest-emphasis text the palette allows
  accent:
    light: "#E24E12"
    dark: "#FF6A2B"
    role: signal orange. The ONE accent. Never a surface fill, never decorative
  accent-ink:
    light: "#0B0D10"
    dark: "#0B0D10   # inherited — no dark override"
    role: text and icons on an accent fill (~2x the contrast of white)
  accent-weak:
    light: "rgba(226,78,18,.10)"
    dark: "rgba(255,106,43,.12)"
    role: focus ring and the faintest accent wash
  hm1:
    light: "rgba(226,78,18,.22)"
    dark: "rgba(255,106,43,.26)"
    role: activity heatmap, step 1 of 3 (level 0 is --surface3: no shots that day)
  hm2:
    light: "rgba(226,78,18,.45)"
    dark: "rgba(255,106,43,.50)"
    role: activity heatmap, step 2 of 3
  hm3:
    light: "rgba(226,78,18,.70)"
    dark: "rgba(255,106,43,.74)"
    role: activity heatmap, step 3 of 3 (level 4 is --accent at full strength)
  forest:
    light: "#C23F0C"
    dark: "#FF7F49"
    role: accent hover / pressed
  green:
    light: "#0E9463"
    dark: "#35C08A"
    role: a real gain. A verdict, not a mood
  green-light:
    light: "#0B7A52"
    dark: "#2AA679"
    role: a lower grade band
  green-glow:
    light: "rgba(14,148,99,.45)"
    dark: "rgba(53,192,138,.45)"
    role: the status dot's expanding ring
  withheld:
    light: "#6B7480"
    dark: "#8B93A0"
    role: gated / no answer. Intentionally dull — the app withholds often
  yellow:
    light: "#B57A12"
    dark: "#E0A93A"
    role: caution, a tentative fault
  red:
    light: "#C43C36"
    dark: "#E5544E"
    role: a real loss, a regression, a destructive control
  blue:
    light: "#1F73C4"
    dark: "#4FA8E8"
    role: information, a "modelled" tag, a secondary link
  overlay:
    light: "rgba(0,0,0,.6)"
    dark: "rgba(0,0,0,.72)"
    role: modal scrim
  aliases:
    border: "var(--line)"   # frozen name, read inline by app.js
    border-hi: "var(--line-strong)"   # frozen name, read inline by app.js
    pine: "var(--accent)"   # frozen name, read inline by app.js
    turf: "var(--red)"   # frozen name, read inline by app.js
    accent-glow: "var(--accent-weak)"   # frozen name, read inline by app.js
  club-scale:
    source: CLUB_COLORS in app.js
    construction: even OKLCH sweep, fixed L and C, hue 45deg to 345deg
    rule: do not hand-pick these. Fixed lightness and chroma is the point —
      it is the one categorical scale in the app and no club may read as louder
      than another.

typography:
  families:
    display: 'Archivo Expanded', 'Archivo', system-ui, sans-serif
    body: 'Archivo', system-ui, sans-serif
    mono: ui-monospace, 'SF Mono', 'Roboto Mono', monospace
    note: self-hosted in fonts/. The site makes ZERO third-party requests on
      load — a deliberate EU-law position, not a performance tweak. Do not add a
      CDN tag; test/browser/sync.sh fails if one appears.
  scale:
    display:
      selector: ".stat-hero, .score-number"
      font-size: "2.4rem"
      font-weight: "800"
      line-height: "1"
      letter-spacing: "-.02em"
      font-family: "var(--font-display)"
      at "(min-width: 640px)":
        font-size: "3.4rem"
      use: the measured figure — the billboard
    h1:
      selector: "h1"
      font-size: "1.5rem"
      font-weight: "700"
      letter-spacing: ".01em"
      text-transform: "uppercase"
      font-family: "var(--font-display)"
      at "(min-width: 640px)":
        font-size: "2rem"
      use: view name
    view-title:
      selector: ".view-title"
      font-size: "1.7rem"
      font-weight: "700"
      letter-spacing: ".015em"
      text-transform: "uppercase"
      font-family: "var(--font-display)"
      at "(min-width: 768px)":
        font-size: "2rem"
      use: view name as rendered (condenses on scroll, phone)
    h2:
      selector: "h2"
      font-size: ".8rem"
      font-weight: "600"
      letter-spacing: ".04em"
      text-transform: "uppercase"
      font-family: "var(--font-display)"
      use: section heading
    h3:
      selector: "h3"
      font-size: ".8rem"
      font-weight: "600"
      letter-spacing: ".06em"
      text-transform: "uppercase"
      font-family: "var(--font-display)"
      use: sub-heading
    section-title:
      selector: ".section-title"
      font-size: ".8rem"
      font-weight: "600"
      letter-spacing: ".04em"
      text-transform: "uppercase"
      font-family: "var(--font-display)"
      use: the heading on a section block
    kicker:
      selector: ".kicker"
      font-size: ".7rem"
      font-weight: "600"
      letter-spacing: ".08em"
      text-transform: "uppercase"
      font-family: "var(--font-body)"
      use: a small upper-case label above a heading or a number
    body:
      selector: "body"
      font-size: "15px"
      line-height: "1.55"
      font-family: "var(--font-body)"
      use: everything else

spacing:
  s1: 4px
  s2: 8px
  s3: 12px
  s4: 16px
  s5: 24px
  s6: 40px
  s7: 64px
  note: the base unit is 4px. Section rhythm is --s6.

geometry:
  radius: "0"
  radius-md: "0"
  radius-sm: "2px"
  cut: "10px"   # NOT a radius. The chamfer on .btn-*, cut by clip-path
  rule: zero radius is the dominant geometry. A rounded button reads as consumer
    software; the cut corner is the one shape this app owns.
  nav-h: 60px
  bottom-nav-h: 68px
  tap: 44px   # minimum touch target

elevation:
  sm: "none"   # literally none. Chrome is FLAT
  md: "0 8px 30px rgba(0,0,0,.12)"
  lg: "0 20px 60px rgba(0,0,0,.18)"
  rule: shadows exist for overlays only. Hierarchy on screen is carried by the
    four-step surface ladder and a 1px hairline, never by a lift.

motion:
  dur: .14s
  rule: animate FROM a visible resting state, never TO one. Nothing may rest at
    opacity 0, visibility hidden, or translated off its own box before JS runs.
    See ScrollMotion in app.js and test/suites/scroll-motion.js.

components:
  button:
    selector: ":where(.btn-primary, .btn-secondary, .btn-danger, .btn-ghost)"
    padding: ".7rem 1.5rem"
    min-height: "var(--tap)"
    text-transform: "uppercase"
    letter-spacing: ".04em"
    clip-path: "polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut))"
  card:
    selector: ".card"
    background: "var(--surface)"
    border: "1px solid var(--line)"
    border-radius: "var(--radius)"
    padding: "var(--s4)"
    box-shadow: "none"
  section-block:
    selector: ".section-block"
  top-nav:
    selector: ".top-nav"
    background: "var(--surface)"
    padding: "0 var(--s5)"
    height: "var(--nav-h)"
    box-shadow: "none"

claims:
  note: three counts this document states, measured from the tree rather than
    typed. Each was wrong here once; each is re-derived on every run so it cannot
    be wrong again. The prose is hand-written and may still disagree — if it does,
    it is the prose that is out of date.
    Every anchor below is a NAME — a function, a selector, a class — and never a
    line number. A point in a file names nothing once anything above it is edited,
    and this file is regenerated on a tree that keeps moving.
  display-tier:
    selector: ".stat-hero, .score-number"
    applied-by-app-js: 2
    applied-in: "renderScoreBanner(), renderYardages()"
    rule: a display tier with no referent is a rule that does nothing. 0 is a defect.
  tabular-numerals:
    carried-by: "td, th"   # element selectors: app-wide
    also-declared-on: 26 class rules
    declared-but-applied-nowhere: ".tnum"
    rule: "td, th" is what holds the declaration on every table in the
      app; `.tnum` is an available utility that nothing applies. Listing it first
      as the mechanism describes something that never runs.
  colour-literals:
    count: 3
    on: ".btn-danger  ·  .session-badge.fault  ·  .session-badge.improvement"
    rule: "#fff on a --red or --green fill, declared on the same line.
      test/suites/colours-are-tokens.js exempts exactly this pattern, so the
      enforcement is right and only the count was wrong."
---

<!-- prose:start -->

# ShotLab TOUR — design system

Everything above this line is **generated from `style.css`** by
`tools/build-design-md.js`. Everything below is hand-written and the generator
preserves it verbatim. If the two ever disagree, `style.css` wins and
`test/suites/design-md.js` fails the build.

## 1. Visual theme and atmosphere

This is a **measurement instrument**, not a dashboard. It reads a consumer
launch monitor and spends most of its effort telling a golfer which of those
numbers it will not stand behind. The design has to carry that: a screen that
looks confident about an uncertain figure is lying in a way the copy then has
to talk the reader out of.

So the chrome is quiet — graphite, one accent, flat surfaces, hairlines — and
**the protagonist is the measured figure**. Not a photograph, not an
illustration, not a gradient. Where a brand system would put a hero image, this
puts a number that cleared its sample floor.

That substitution has to be made deliberately every time this document is read
alongside a marketing design system. The restraint in those systems is paid for
by a photograph doing the work. Import the restraint without supplying a
protagonist and you get an empty page.

Density is high and deliberately so. A golfer standing over a shot wants the
club, the carry, the interval and the caveat in one glance, not a scroll.

## 2. Colour

Near-monochrome, and the accent is a **signal**, not a brand wash.

- **One accent.** Signal orange, used for the primary action, the active nav
  item, a link, a focus ring and the top step of the activity ramp. It is never
  a surface fill, never a section background, never a gradient.
- **Saturated colour is reserved for DATA.** Three places earn it: the club
  scale (an even OKLCH sweep, fixed lightness and chroma, so no club reads as
  louder than another), the verdict semantics (`--green` a real gain, `--red` a
  real loss, `--yellow` tentative, `--withheld` deliberately dull), and the
  activity ramp.
- **`--withheld` is a real colour with a real job.** This app says "not enough
  shots" more often than it says anything else, and that answer needs to look
  like an answer rather than like a failure.
- **Four-step surface ladder**, and do not skip a rung. Hierarchy is carried by
  the ladder and a 1px hairline — never by a shadow.
- **Colour literals are counted, not described.** The only legal ones are a
  `#fff` on a `--red` or `--green` fill declared on the same line. There is no
  separate on-red token and inventing one for a handful of rules would be a
  token nobody reads. Everything else reads a token, in `style.css` and `app.js`
  alike, enforced by `test/suites/colours-are-tokens.js`. The generated
  `claims:` block above carries the current count and their lines, because a
  number typed into a paragraph is a number that goes stale — this one said
  "two" for as long as there have been three. The entire retired palette once
  survived a full redesign inside the stylesheet because that check only read
  `app.js`.

## 3. Typography

Archivo, self-hosted, in two cuts: Expanded for display and headings, regular
for body. Mono is a system stack and is used only where a value should read as
machine output.

The one thing to know: **the type scale is two tiers, not a gradient.** The
label tier is one step — a section heading is a signpost, not a display moment —
and above it sits the figure. The display tier (`.stat-hero`) is not decoration
and not a size: it is reserved for the measured figure that has cleared its own
sample floor, one per screen, and a second one beside it is two billboards,
which is a checklist. Whether the tier is *used* is a fact about the tree, so
the generated `claims:` block above counts its referents rather than a
paragraph asserting it — this paragraph asserted the opposite while the class
had zero. The gap between the two tiers is the work
`docs/superpowers/plans/2026-09-11-design-md-workover.md` tracks.

Rules that do hold:

- **Uppercase everywhere it appears is display-cut and letter-spaced.** Caps at
  body tracking read as cramped.
- **Tabular numerals on every figure.** The table elements carry
  `font-variant-numeric: tabular-nums` app-wide and each figure that has to line
  up in a column restates it; the generated `claims:` block above names what
  actually holds the declaration, and which declared utility nothing applies. A
  column of carries that jitters as it updates is unreadable.
- **Oversized type steps up only at `min-width: 640px`.** 393px is the design
  viewport, not a width to degrade to, and `render-scan.js` measures horizontal
  overflow there on every push.

## 4. Components

- **Buttons are chamfered, never rounded.** Top-left and bottom-right corners
  cut by `--cut` via `clip-path`. The cut corner is the one shape this app
  owns; a pill reads as consumer software. `clip-path` also clips a real
  border, which is why `.btn-secondary` draws its outline as a `::before`
  sharing the clip, and why focus is an `outline` (outlines ignore `clip-path`,
  so they stay visible).
- **A card is a surface plus a hairline.** No shadow, no radius, no lift on
  hover.
- **A section block is a heading under a 1px rule.** The rule is a
  pseudo-element rather than a border so it can draw in on first sight.
- **Every icon is a `<symbol>` in the sprite**, referenced through `icon(name)`.
  There are no emoji anywhere, in any file that ships text to a user, and
  `test/suites/no-emoji.js` covers eleven of them.
- **Minimum touch target is `--tap` (44px)**, and every focusable text control
  is at least 16px under 640px — Safari zooms a focused field smaller than that
  and does not zoom back out.

## 5. Layout

Mobile-first, single column, 4px base unit. `--s6` is the section rhythm.
`--s4` is the page gutter.

- **Nothing may overflow horizontally at 393px.** This is a hard gate, not a
  preference, and it has been broken for real: three block elements dropped
  into a `flex-wrap: nowrap` header became flex items beside the title and took
  a view to 605px in a 393px viewport.
- **Grid items need `minmax(0, 1fr)`.** The default `min-width: auto` means a
  `<select>` with a long option refuses to shrink and pushes the whole form
  wide.
- Below 768px there is a bottom nav and no top bar. At 768px and up the bottom
  nav is replaced by a sticky top nav.

## 6. Depth and elevation

Three levels and the first one is nothing:

| Level | Treatment | Use |
|---|---|---|
| Flat | no shadow, no border | the dominant treatment — sections, buttons, nav |
| Hairline | 1px `--line` | cards, section rules, table rows, dividers |
| Overlay | `--shadow-md` / `--shadow-lg` | modals and the scrim only |

`--shadow-sm` is literally `none`. It exists so a rule that wants to name a
shadow token still resolves to flatness.

## 7. Motion

One rule, and it is not style:

> **Animate FROM a visible resting state, never TO one.**

Nothing may rest at `opacity: 0`, `visibility: hidden`, or translated off its
own box before JS has run. If an observer never fires, the page must already be
correct.

This is a scar. `.section-block` once faded in on a staggered delay; someone
found content invisible for real users and killed it with an override titled
"ensure content is always visible", and the delays then sat dead for months —
because a thing that does not appear is indistinguishable from a thing that was
never there. `ScrollMotion` and `test/suites/scroll-motion.js` hold the line,
and `render-scan.js` takes `SM_NO_IO=1` to delete `IntersectionObserver` and
prove the page is fine without it.

## 8. Do's and Don'ts

These are the rules an agent building a new surface here would otherwise never
guess. They matter more than the palette.

### Do

- Put the caveat **beside the figure it qualifies**, always visible. Never in a
  tooltip, never behind a tap, never below the fold.
- Label every modelled output as modelled. Carry, total, apex and descent are
  computed from launch conditions, not measured.
- Show an interval, not a bare point. `Metrics.interval()`.
- Give a withheld answer the same visual weight as a given one. "Not enough
  shots yet, here is what it needs" is a result.
- Read colour, spacing, radius and type from tokens. Every one of them.
- Keep the page correct with JavaScript disabled or broken.
- Put state that must survive a re-render in a class on `<html>`.

### Don't

- **Don't make an ungated number big.** The display tier is for figures the app
  is willing to stand behind. A club under its sample floor, a withheld
  dispersion figure and a modelled carry do not get it.
- **Don't add a second accent.** Not for a section, not for a state, not for
  "variety".
- **Don't use a gradient as a surface.** Two-colour washes and tinted cards
  have been removed from this codebase twice.
- **Don't add a drop shadow outside an overlay.**
- **Don't round a corner.** `--radius` is 0 and that is the system.
- **Don't put a number on a screen without knowing where it came from.** If the
  answer is "a constant somebody typed", it does not go in. Three modules once
  shipped fabricated benchmarks, lessons and video runtimes.
- **Don't pool across the bag.** A figure averaged over a driver, a 7-iron and
  a wedge measures which clubs were hit, not how.
- **Don't render more than one ranked recommendation.** One cue, never a
  checklist.
- **Don't reintroduce a stagger, or any entrance animation on content.**
- **Don't add a third-party request.** No CDN, no webfont host, no analytics.
  The site makes zero on load and that is a legal position, not a performance
  one.

## 9. Responsive behaviour

- **393px is the design viewport.** An iPhone 15 Pro. Everything is authored
  there first and `render-scan.js` measures it on every push.
- **640px** — oversized display type steps up. Nothing else moves.
- **768px** — the bottom nav becomes a sticky top nav, the main column takes a
  max width, and a few hero figures grow.
- **Print** — `@media print` is its own design. Everything but the yardage book
  is hidden, ink is forced onto paper, the sparkline and the club dots are
  dropped because neither means anything in one colour, and every caveat
  travels with the table. A yardage card lives in a golf bag and outlives the
  screen it came from.

## 10. Where to look

| Want | Read |
|---|---|
| the tokens | `style.css`, `:root` and `html.dark` |
| why a rule exists | `CLAUDE.md` |
| what is queued | `docs/superpowers/plans/` |
| the reference systems this was checked against | `docs/reference/` |
| whether you broke something | `npm test`, then `test/browser/render-scan.js` |

<!-- prose:end -->
