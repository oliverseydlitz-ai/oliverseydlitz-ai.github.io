# Reference material

Third-party documents kept for reference. **Nothing in this directory
describes ShotLab.** It is not a spec, it is not a source of truth, and no
code reads it.

## `bmw-m-DESIGN.md`

- **Source:** [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md),
  `design-md/bmw-m/DESIGN.md`, at commit `8147538`.
- **Licence:** MIT — see `LICENSE-awesome-design-md`. Copied verbatim; do not
  edit it, or the provenance stops meaning anything.
- **Format:** [DESIGN.md](https://stitch.withgoogle.com/docs/design-md/specification/),
  a plain-markdown design-system document intended to be read by coding agents.

### Why this one

Of the 74 analyses in that collection, BMW M is the closest structural match to
what ShotLab already ships — near-black canvas, uppercase display in a single
family, zero border radius as the dominant geometry, 1px hairlines instead of
shadows, one signal accent used sparingly and never as a surface fill, and a
uniform section rhythm. It is a useful control: a system arrived at
independently, by people who do this for a living, that agrees with the "Range"
skin on most of its structural choices and disagrees on a few. The
disagreements are where the value is.

### The substitution that has to be made every time it is read

BMW M's protagonist is **full-bleed automotive photography**. Its chrome is
deliberately quiet because the photography carries the page. ShotLab has no
photography and will not have any — its protagonist is **the measured number**.

Every principle in that file that reads "let the photograph do the work" has to
be translated to "let the figure do the work" before it means anything here.
A plan that imports the restraint without supplying a protagonist produces a
page that is merely empty.

### What is not borrowed

Trade dress. The M tricolour, BMW Type Next Latin, the wordmark, the model
badges and the specific hexadecimal values of BMW's palette are BMW's identity
and are not used. What is borrowed is structural reasoning that is not
anybody's property: typographic contrast, radius discipline, hairline
elevation, accent scarcity, band rhythm.

Two further analyses from the same collection are cited in the workover plan
but not vendored, because one principle each is all that was taken from them:
**Nike** (the deliberate gap between a display tier and a body tier, with
nothing in between) and **Linear** (a four-step surface ladder carrying
hierarchy in place of shadow, and never skipping a level).
