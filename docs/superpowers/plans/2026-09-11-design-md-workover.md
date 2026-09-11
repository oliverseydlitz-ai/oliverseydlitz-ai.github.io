# DESIGN.md Workover — Implementation Plan

**Goal:** Give ShotLab a machine-readable design contract (`DESIGN.md` at the
repo root, generated from `style.css` so it cannot drift), and close the four
structural gaps that a side-by-side against a professionally-authored design
system exposes — a display tier with no referent, a retired typeface still
shipping, all-caps tracking under the legibility floor, and a home view with
seven surfaces and no hierarchy between them.

**Not a reskin.** The "Range" palette, the Archivo type, the chamfered button
and the zero-radius geometry all survive this plan unchanged. Tasks 1-14 of
`2026-09-08-athletic-redesign.md` shipped a coherent system; what it lacks is a
written contract and a protagonist. This plan supplies both.

**Source:** `docs/reference/bmw-m-DESIGN.md` — BMW M's design system as analysed
by [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
(MIT, commit `8147538`), the largest collection of DESIGN.md analyses on GitHub.
Read `docs/reference/README.md` first: it states which principles are borrowed,
which are not, and the one substitution that has to be made every time the file
is read. Two further analyses from the same collection are cited by name where
a single principle is taken from them (Nike, Linear) and are not vendored.

**Ordering:** Task 15 of the athletic redesign (scroll motion) comes first. It
is a small, scoped, already-specified piece of work and this plan assumes the
CSS it touches is settled.

---

## Why a DESIGN.md at all

The design system currently exists as 2,470 lines of CSS and a 60-line spec
written three days before the code diverged from it. Anything that wants to add
a surface — a future session, another tool, Oliver in a hurry — has to
reconstruct the rules by reading the stylesheet and inferring intent from it.
That reconstruction has already gone wrong twice in this repository's history:
`.session-card` was redeclared 1,900 lines below its own definition with a
different shadow and a retired red, and `.stat-hero` was written as the display
tier and then never referenced by anything.

A DESIGN.md is the artefact that fixes that class of problem: one file, in the
format the tooling reads best, that states what the system is. The format is
Google Stitch's; the collection cited above exists because it turns out to work.

**The trap, and it is this repository's oldest one.** A design document that
restates hex values, sizes and spacing that also live in `style.css` is a second
copy of the truth, and second copies rot silently — `Benchmarks.TARGET` had
twelve disagreeing copies, the privacy policy was wrong on every fact that
mattered, and this file's own predecessor claimed an og-image generator that did
not exist. So the front matter is **generated from `style.css`** by a tool, and
a suite fails if the committed file and a fresh generation disagree. That is the
same arrangement `tools/build-legal-pages.js` + `legal-pages.js` already use,
and it is the only reason a design document is worth having.

---

## Global Constraints

Every task's requirements implicitly include these. C1-C13 from
`2026-09-08-athletic-redesign.md` still apply in full and are not repeated.

- **D1 — no token renamed, no token value changed** except where a task says so
  explicitly and names it. Spec constraint C1 (frozen token names) is unchanged:
  `app.js` reads these inline in six runtime-injected modals.
- **D2 — `DESIGN.md` is generated, never hand-edited in its generated regions.**
  Prose sections are hand-written and preserved between markers; everything
  numeric comes from `style.css`. If the two disagree, `style.css` wins and the
  suite fails.
- **D3 — nothing in this plan may make an ungated number more prominent.** The
  display tier is reserved for figures the app is willing to stand behind. A
  club under `Metrics.MIN_SHOTS_REPORT`, a withheld dispersion figure, a
  modelled carry — none of these enter the display tier. This is a design rule
  enforcing a measurement rule, and it is tested, not just written down.
- **D4 — `render-scan.js` exits 0**, including zero horizontal overflow at
  393px. Larger type is the single most likely way to break this; every task
  that raises a font size runs the scan.
- **D5 — no new colour literal in `app.js`** outside `CLUB_COLORS`, and after
  Task 0, no font-family literal either.
- **D6 — no emoji**, in any file `no-emoji.js` covers. The vendored reference
  document is outside that list and is copied verbatim; do not edit it.
- **D7 — bump `sw.js` `CACHE` once, in the final task** (`shotlab-v151` to
  `shotlab-v152`).

**Per-task cycle.** Unless a task says otherwise:

```
npm test                    # 57 suites (rising as this plan adds them), load gate first
bash test/browser/scan.sh   # sync mirror + serve + render-scan; exit 0
```

Then a visual check of the affected view at 393px and 1440px, light and dark.

---

## Task 0: The retired typeface that is still shipping — DONE (11 Sep)

**This is a bug, not a design change, and it is why the exercise was worth
doing.** It was found by asking the question the DESIGN.md format forces — where
does this font come from? — against a file that every suite already passes.

`app.js:7469` and `app.js:8146` both set `font-family="Outfit,sans-serif"` on
the `<text>` element inside an inline SVG. **Outfit is the retired typeface.**
It was replaced by Archivo in Task 1 of the athletic redesign and it is not
loaded anywhere: `style.css` self-hosts Archivo and Archivo Expanded and
nothing else, and the CSP `font-src 'self'` would refuse it even if a tag
remained. Both references therefore fall through to `sans-serif`.

The two glyphs affected are the **grade letter** in the performance-grade badge
and its smaller twin — the single largest and most prominent character on the
session detail. It has been rendering in the browser's default sans, beside
headings set in Archivo Expanded, since the redesign shipped.

It survived because it is invisible to every check the repository has:
`colours-are-tokens.js` scans for colour literals and this is a font;
`no-emoji.js` scans characters; `render-scan.js` greps for `NaN` and measures
width, and a fallback font is neither; the load gate loads the file and a
`font-family` attribute on an SVG text node throws nothing. Nobody looking at
the badge would necessarily know what it was *supposed* to look like.

- [x] **Step 1: The suite first.** `test/suites/fonts-are-tokens.js`:
  1. No `font-family` literal in `app.js` names a family that is not defined by
     an `@font-face` in `style.css` or is not a generic keyword. Strip comments
     before scanning — this repository has been bitten five times by a
     source-scanning check reading its own explanatory comment.
  2. A **named exemption with its reason**, never a weakened regex:
     `app.js:11335` (`showFatalError`) sets `font-family:system-ui,sans-serif`
     deliberately — it runs when the stylesheet may not have loaded, so it must
     not depend on a webfont. Exempt by line content, not by line number.
  3. A **negative control**: assert the string `Outfit` appears nowhere in
     `app.js`, `index.html` or `style.css`. If that ever passes while a
     reference exists, the check above is worthless.
  Run it. It must fail on both lines before anything is fixed.

- [x] **Step 2: Fix.** An inline SVG cannot read `var(--font-display)` from an
  attribute, but it can from CSS. Give the two `<text>` nodes a class and set
  `font-family: var(--font-display)` in `style.css`, rather than substituting
  the literal string `'Archivo Expanded'` — a literal is how this happened.

- [x] **Step 3: Gates.** Per-task cycle. Visual check of the grade badge at
  393px specifically: Archivo Expanded is *wider* than the fallback at the same
  point size, so a letter that fitted may not.

- [x] **Step 4: Commit.**

```bash
git add app.js style.css test/suites/fonts-are-tokens.js
git commit -m "Fix: grade badge was rendering in the retired typeface"
```

---

## Task 1: `DESIGN.md`, generated from `style.css` — DONE (11 Sep)

- [x] **Step 1: `tools/build-design-md.js`.** Playwright is not needed; this is
  a text transform. It reads `style.css` and emits the DESIGN.md front matter:

  - `colors:` — every custom property in `:root` whose value is a colour, plus
    its `html.dark` override, emitted as `name-light` / `name-dark` pairs. The
    ladder (`--bg`, `--surface`, `--surface2`, `--surface3`) and the verdict
    semantics (`--green`, `--withheld`, `--yellow`, `--red`, `--blue`) carry
    their role from a comment map in the tool, because a hex value cannot say
    what it is for.
  - `typography:` — the `h1`/`h2`/`h3` rules, `.section-title`, `.kicker`,
    `.stat-hero`, `body`, and the button type, each with the `min-width: 640px`
    step-up where one exists.
  - `spacing:` — `--s1` through `--s7`.
  - `rounded:` — `--radius`, `--radius-md`, `--radius-sm`, and `--cut`, which is
    not a radius at all and needs the one-line explanation that it is a chamfer.
  - `components:` — button variants, `.card`, `.section-block`, nav.

  Emit `CLUB_COLORS` **by reference, not by value**. It is an OKLCH sweep
  generated in `app.js` and copying 14 hex values into a second file is exactly
  the drift D2 exists to prevent; the front matter names the generator and the
  sweep parameters instead.

- [x] **Step 2: The prose.** Nine sections, hand-written, between
  `<!-- prose:start -->` / `<!-- prose:end -->` markers the generator preserves.
  Follow the format's own section list (overview, colours, typography, layout,
  elevation, shapes, components, do's and don'ts, responsive) and write the
  ShotLab answers, not the BMW M ones:

  - **Overview.** State the substitution plainly in the first paragraph: this is
    an instrument, the protagonist is the measured figure, and the chrome is
    quiet because the number is loud. A reader who takes only the restraint and
    not the protagonist builds an empty page.
  - **Do's and Don'ts.** This is the section agents actually obey, so it carries
    the rules that are specific to this app and would never be guessed:
    no drop shadow outside an overlay; the accent is never a surface fill; no
    number enters the display tier without clearing its sample floor (D3); a
    caveat renders beside the figure it qualifies and never in a tooltip; every
    modelled output is labelled; no colour literal in `app.js`.
  - **Responsive.** 393px is the design viewport, not a breakpoint to degrade
    to. Say that oversized type steps up at 640px and why.

- [x] **Step 3: The guard.** `test/suites/design-md.js` runs the generator into
  memory and diffs it against the committed `DESIGN.md`, failing with the first
  differing line. Same shape as `legal-pages.js`. Add both the tool and the
  suite to `rules-are-wired.js`'s expectations so a generator nobody runs is
  caught the way a gate nobody calls is.

- [x] **Step 4: Gates and commit.** No app file changes, so `render-scan` cannot
  regress — run it anyway, because "cannot regress" is what was said about the
  mirror the week it went stale.

```bash
git add DESIGN.md tools/build-design-md.js test/suites/design-md.js test/suites/rules-are-wired.js
git commit -m "DESIGN.md: generated design contract with a drift guard"
```

---

## Task 2: The display tier, and the fact that it has no referent

`.stat-hero` is defined at `style.css:649` — Archivo Expanded, weight 800,
2.4rem rising to 3.4rem, tabular numerals, negative tracking. It is the system's
display tier and **it is referenced by nothing.** Zero occurrences in `app.js`,
zero in `index.html`. The only class that actually uses that rule is
`.score-number`, which shares the declaration and renders one figure: the
session quality score.

So the type scale that ships is 2rem, 1.05rem, 1rem, 0.8rem, 0.7rem over a 15px
body — five steps inside a factor of two. That is a gradient, not a hierarchy,
and it is the specific thing both cited systems avoid: Nike jumps from a 96px
display tier straight to 16px body with **nothing in between**, and calls the
gap intentional ("billboard above, catalog below"). BMW M does the same at
80px/16px and pairs heavy display with light body so the two tiers cannot be
confused.

Neither of those pages has anything to say except a headline. This one does, so
the answer is not a 96px "YOUR SESSIONS" — a billboard reading the name of a tab
is decoration, and decoration is what this codebase spends its time refusing.
**The figure is the billboard.** The app's entire proposition is that a number
either cleared its floor or it did not; the one that did is the most important
thing on the screen and is currently set in the same weight as a section label.

- [ ] **Step 1: Put the tier to work.** `.stat-hero` on the session-detail
  headline figure, the yardage book's club carry, and the `QuickStats` anchored
  row. One per screen — a second display figure is two billboards, which is a
  checklist, which is rule 9 again.

- [ ] **Step 2: Open the gap.** Drop `h2`, `h3` and `.section-title` to a single
  label tier (0.8rem, weight 600, uppercase) so the distance from the figure to
  everything else is real rather than gradual. `h1` stays where it is — it is
  the view name and a navigational landmark, not a display moment.

- [ ] **Step 3: D3, tested.** `test/suites/display-tier.js` asserts every
  `stat-hero` call site in `app.js` sits inside a branch already gated on a
  sample floor, by the same balanced-paren scan `rules-are-wired.js` uses on
  `detectFaults`. A withheld figure, a modelled carry and a below-floor club
  must not be able to reach the tier. **Verify the guard against the real
  defect**: put a `stat-hero` on a below-floor branch, confirm the suite fails,
  take it back out. A guard that has never caught anything has not been tested.

- [ ] **Step 4: Gates.** `render-scan.js` matters most here. A 3.4rem tabular
  numeral at 393px is the likeliest overflow this plan can cause; check the
  widest real case (a four-digit total with a unit suffix), not a two-digit one.

```bash
git add style.css app.js test/suites/display-tier.js
git commit -m "Display tier: the measured figure is the billboard, gated on its floor"
```

---

## Task 3: All-caps tracking is under the floor

BMW M sets 1.5px of tracking on every all-caps label and calls it
non-negotiable — it is what makes uppercase read as machined rather than
cramped. ShotLab's uppercase runs at `.04em` on buttons and `h2`, `.06em` on
`h3`, `.08em` on `.kicker`. At the sizes those rules actually render, `.04em` on
a 0.8rem label is **0.51px** — a third of the figure, and the reason the button
labels and section titles look tight next to the kickers, which are the one
tier that got it right.

This is the cheapest visible improvement in the plan and the one least likely to
break anything.

- [ ] **Step 1: Two tokens, because a magic number in 30 places is how the last
  one drifted.** `--track-caps: .09em` for uppercase at or below 0.9rem;
  `--track-display: -.02em` for the display tier, where tracking goes *negative*
  (Linear pulls to -3px at 80px; large type needs tightening, small caps need
  opening, and using one value for both is the error). Both go in `:root`, both
  are picked up by the Task 1 generator, so `DESIGN.md` gains them for free.

- [ ] **Step 2: Apply** to every uppercase rule in `style.css`. Grep
  `text-transform: uppercase` and give each a `letter-spacing` from a token;
  none keeps a literal.

- [ ] **Step 3: Gates.** Buttons get wider — uppercase plus tracking on a
  fixed-width chamfered button is a real overflow risk at 393px, and the import
  form is where it will show. Run the scan; check the Settings and Import views
  specifically.

```bash
git add style.css
git commit -m "Tracking: caps open to a token, display tightens to one"
```

---

## Task 4: Bands, assigned by role — the home view's missing hierarchy

BMW M's sharpest structural rule: *don't repeat the same surface mode in two
consecutive bands* — photo band, spec table, photo band, magazine grid. Two
text-only bands in a row read as a corporate site.

ShotLab's home view renders seven insight surfaces (CLAUDE.md says so, in the
`getNextStep` section), every one of them a `.card` on `--surface` with a 1px
hairline, stacked. Nothing on that screen is more important than anything else,
which directly undercuts the one design decision the home view actually has:
`getNextStep` returns **one** ranked card, deliberately, because rule 9 of the
research base is one cue and never a checklist. It is currently rendered in the
same treatment as the streak counter.

- [ ] **Step 1: Three modes, and the reason positional alternation is wrong.**
  `.band--canvas` (no card, sits on `--bg` — caveats, sync banner, empty
  states), `.band--surface` (today's card — data blocks), `.band--signal` (the
  inverted band on `--text` ground with `--bg` type, the only high-contrast
  moment on the screen).

  **Assign by role, never by position.** `:nth-child` alternation is the obvious
  implementation and it is broken here: `ViewPrefs` hides sections with a class
  on `<html>` and CSS cannot count *visible* siblings, so a golfer who turns off
  the club breakdown would get two identical bands adjacent and the system would
  silently stop working — the same failure mode as setting `hidden` on a section
  that gets re-rendered. Role assignment is stable under every pref combination.

- [ ] **Step 2: One signal band per view, and it is the ranked card.**
  `getNextStep` gets `.band--signal`. Nothing else on the home view may take it.
  Assert the count in the suite — one, not "at most one": zero means the ranked
  card stopped rendering, which is a bug worth failing on.

- [ ] **Step 3: Contrast.** The inverted band puts `--bg` type on `--text`
  ground in light mode and the reverse in dark. Check both directions against
  WCAG AA at body size, and check the accent on the inverted ground — signal
  orange on graphite passes, signal orange on off-white in the dark-mode
  inversion is the pair to actually measure rather than assume.

- [ ] **Step 4: Gates,** plus a pass through every `ViewPrefs` combination that
  can hide a home-view section, confirming no two adjacent bands share a mode.

```bash
git add style.css app.js test/suites/bands.js
git commit -m "Bands: three surface modes assigned by role, signal reserved for the ranked card"
```

---

## Task 5: Ship

- [ ] **Step 1: Regenerate `DESIGN.md`.** Tasks 2-4 changed tokens and type
  rules; the suite from Task 1 will fail until the generator is re-run. That it
  fails is the point — confirm it does before re-running, or the guard is
  decorative.

- [ ] **Step 2: Dead-CSS sweep.** Same as Task 14 of the previous plan, which
  missed `.stat-hero`. Scan for every class defined in `style.css` and matched
  by nothing in `index.html` or `app.js`, including template literals. Report
  the list; delete what is dead, wire what should not be.

- [ ] **Step 3: `sw.js`** `shotlab-v151` to `shotlab-v152` (D7).

- [ ] **Step 4: CLAUDE.md.** New suite count, new sw version, a section on the
  display tier and the D3 rule that gates it, and a line in the "things this
  session got wrong" list: a source-scanning check existed for colours and not
  for fonts, so a retired typeface shipped through an entire redesign.
  **Function names in prose, not in headings** — `module-map.js` reads any
  backticked name in a `###` heading as a module, and that has broken twice.

- [ ] **Step 5: Full gates.** `npm test`, `scan.sh`, a visual pass at 393px and
  1440px in both themes, and `@agent-design-review` on the home view and session
  detail before the push.

```bash
git add -A
git commit -m "DESIGN.md workover: contract, display tier, tracking, bands"
git push -u origin main
```

---

## Decisions this plan does not take

Both are Oliver's, and both were left open deliberately rather than forgotten.

1. **Dark as the default surface.** Both cited systems refuse to ship a
   light-mode marketing page at all; BMW M has no light mode. A launch-monitor
   app used in a covered bay or at dusk has a straightforward argument for
   dark-first, and the identity is graphite. ShotLab currently defaults to light
   with `html.dark` as the override. The **non-destructive** version — honour
   `prefers-color-scheme` when `localStorage.slTheme` is unset, rather than
   flipping anyone who already chose — is a small change and is the only version
   worth proposing. It is still a visible change to every existing user's app on
   next open, so it needs a yes.

2. **The logo.** `favicon.svg` and the PNGs rendered from it are pine green
   `#0b4d2e`; the app is graphite with a signal-orange accent. CLAUDE.md records
   that Oliver has not chosen a direction and says not to unify it unprompted,
   so this plan does not. It is named here because a design contract that
   documents the palette while the app icon contradicts it is a contract with a
   hole in it, and the hole should at least be on the page.

---

## Self-Review

**What each source contributed, and where it was refused:**

- **BMW M** — band alternation (Task 4), all-caps tracking floor (Task 3),
  hairline-not-shadow elevation (already shipped; written into `DESIGN.md` in
  Task 1). **Refused:** photography as protagonist, which this app does not have
  and will not get, and the heavy-display/light-body pairing, which is wrong for
  15px body copy that has to be read outdoors.
- **Nike** — the deliberate gap between display and body with nothing in
  between (Task 2). **Refused:** pill geometry, which is the direct opposite of
  the chamfered zero-radius silhouette this app already committed to, and its
  photography dependence for the same reason as above.
- **Linear** — the four-step surface ladder carrying hierarchy without shadow
  and the rule against skipping a level (written into `DESIGN.md` in Task 1);
  negative display tracking (Task 3). **Refused:** product screenshots as the
  page's protagonist, and a 12px card radius.
- **The format itself** — the whole of Task 1, which is the plan's main
  deliverable and the only one that keeps paying after it ships.

**Constraint coverage:** D1 no task renames a token; Tasks 3 and 4 add tokens,
which C1 permits. D2 Task 1 Step 3. D3 Task 2 Step 3, tested against a real
defect. D4 every task's gate, called out specifically in Tasks 0, 2 and 3 where
type gets wider. D5 Task 0. D6 no file this plan writes is in the emoji list
except CLAUDE.md, which is not. D7 Task 5 Step 3.

**Placeholder scan:** no TBD, no "handle edge cases". Every line number cited
(`style.css:649`, `app.js:7469`, `app.js:8146`, `app.js:11335`) was read, not
recalled; every count (seven surfaces, five type steps within a factor of two,
0.51px of tracking, zero `stat-hero` call sites) was measured against the
working tree at commit `050b332`.

**Known soft spot:** Task 4's role assignment is stated as a rule rather than a
mechanism, because the right mechanism depends on how much of the home view's
markup is built in `index.html` versus injected by `renderHome`, and that is
worth reading at the time rather than guessing now. Everything else in the plan
names its file and its change.

**Honest shape of the work:** Task 0 is genuine test-first. Task 1 is a
generator plus a diff guard, which is this repository's established pattern for
a document that must not drift. Tasks 2-4 are visual changes whose regression
gates are the existing suites, the render scan and a visual check, with one new
written-first suite each where a rule became checkable. That is the same
deviation the previous plan declared, for the same reason.
