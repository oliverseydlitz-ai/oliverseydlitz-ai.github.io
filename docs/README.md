# ShotLab reference documents

Research and audit documents backing the app's coaching content. These are
plain static files in the repo so they survive independently of any external
service — GitHub Pages serves them, but they read fine from the filesystem too.

## Contents

| File | What it is |
| --- | --- |
| [`coaching-calibration-audit.html`](coaching-calibration-audit.html) | Every swing-mechanics claim in ShotLab checked against Trackman tour data, published D-plane physics, Rapsodo's own accuracy testing, and the motor-learning literature. Includes the derivation for the face-to-path correction and the spin-loft estimator, plus evidence grades for each practice-science claim. |

Live at `https://oliverseydlitz-ai.github.io/docs/coaching-calibration-audit.html`
once deployed.

## Why these matter to the code

The audit is the source for several values now hardcoded in `app.js`. If you
change any of the following, re-read the corresponding section first:

- `Benchmarks.DATA` — tour averages. Rows are marked `[TM]` (TrackMan-published)
  or `[est]` (interpolated across the TrackMan-anchored curve).
- `Benchmarks.TARGET` — what to *aim* at, deliberately separate from what the
  tour *averages*. Conflating the two is what produced the original driver
  attack-angle error (+3.0 listed as the PGA average; it is actually −1.3, and
  +3.0 is the LPGA average).
- `FACE_RATIO_WOOD` / `FACE_RATIO_IRON` — the D-plane weights in `facePath()`.
- `LOFT_RATIO_WOOD` / `LOFT_RATIO_IRON` — the weights in `spinLoft()`. These
  reproduce TrackMan's published tour spin lofts exactly (driver 14.7°,
  6-iron 24.3°), which is the check to re-run if you touch them.
- `ANGLE_NOISE` — Rapsodo MLM2PRO measurement error (MAE 1.05° attack angle,
  1.19° club path vs a Foresight GCQuad). The fault engine's reporting gates
  exist because of this number.
- `CoachingMode.TIPS` — written to an external focus of attention on purpose.
  Cues naming the golfer's own body parts are the thing the evidence says to
  avoid; see the practice-science section before rewriting any of them.
