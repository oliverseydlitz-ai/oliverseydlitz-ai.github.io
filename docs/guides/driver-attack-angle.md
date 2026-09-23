# Driver attack angle: why the tour average isn't your target

The PGA Tour's average driver attack angle is {{Benchmarks.get('d').pga.aa}}°. That's slightly *down* on the ball. It gets quoted as if it's what you should copy, and for most amateurs it isn't. The target worth aiming at with a driver is hitting up, somewhere around {{Benchmarks.TARGET.driverAttackAngle.lo}}° to {{Benchmarks.TARGET.driverAttackAngle.hi}}°. A tour average tells you what tour players do on average. It doesn't tell you what's best.

[[photo: a teed-up driver from face-on, ball forward in the stance, with the low point of the swing behind the ball]]

## Average and optimal are different questions

Tour players are some of the fastest, most consistent strikers alive, and their swings differ a lot. An average across all of them blends very different ways of getting the ball out there. It describes the tour. It isn't a recipe for you.

What matters for distance is the launch and spin you end up with, and attack angle is one of the levers on both. Hitting up lets you launch the ball higher with less spin for the same loft. Hitting down does the opposite: less launch, more spin, a ball that climbs and falls short. For most amateurs, whose driver problem is already too much spin, hitting down makes it worse.

## How much is it worth? Careful here

You'll see charts claiming a fixed number of extra yards for every degree you hit up. They come from TrackMan's driver optimisation tables, and those tables have a condition that almost nobody repeats: **at every attack angle, the loft and spin were re-optimised too.** Going from 5° down to 5° up in those tables also needed about 5.3° more dynamic loft and roughly 1,184 rpm less spin.

So the gain is real, but it's the gain for a driver set up to match the new attack angle. If you change your attack angle and keep your current driver exactly as it is, you won't get the chart number. You'll get something smaller, and nobody has published how much smaller. That's why this guide won't give you a yards-per-degree figure: there isn't an honest one for an unchanged club.

What you can say is that hitting up, with a driver fitted for it, carries further for the same ball speed. The direction is clear. The size of the gain for your driver, as it is today, isn't known.

## Can your launch monitor tell you your attack angle?

Roughly, over a bucket, and not shot by shot.

- The MLM2PRO measures attack angle, but only with the ball placed where it expects it. Rapsodo's own test against a GCQuad put its average error at 1.05°.
- On other consumer units it can be much worse. In one peer-reviewed study, the Mevo+'s attack angle with a 7-iron agreed with TrackMan's at an ICC of 0.02, which means almost no relationship at all.
- Your own swing moves too. Between two ten-shot sessions, attack angle needs to shift by about {{Metrics.MDC_N10.attackAngle}}° before it's likely a real change.

So average it. ShotLab waits for {{Metrics.MIN_SHOTS_DELIVERY}} shots with a club before it reads anything into your attack angle, and it shows a range rather than a single number. A single drive reading +4° is one number from a noisy measurement.

## Irons are the other way round

None of this carries over to irons. With an iron you want to hit down, somewhere around {{Benchmarks.TARGET.ironAttackAngle.hi}}° to {{Benchmarks.TARGET.ironAttackAngle.lo}}°, so the club reaches the bottom of its arc after the ball. The tour averages agree: every iron in the table is hitting down, from {{Benchmarks.get('3i').pga.aa}}° with a 3-iron to {{Benchmarks.get('pw').pga.aa}}° with a pitching wedge. An upward attack angle with a 7-iron usually means a thin strike.

One warning if you practise off mats: a mat is hard, so the club bounces off it instead of digging. A strike well behind the ball can still come off looking fine. Mats hide fat shots, which is exactly the fault low-point work is meant to catch.

## What to do with it

- **Driver:** tee it high enough and far enough forward to catch it on the way up. Watch whether your average moves toward hitting up across a session, not whether one drive did.
- **Check the rest of the picture.** A better attack angle should show up as higher launch and, on good balls, a longer carry. If the attack angle changes and nothing else does, question the reading.
- **Consider the driver, not just the swing.** Because the big gains assume loft is re-optimised, a fitting can be part of the answer.
- **Irons:** hit down, and be suspicious of good-looking numbers off a mat.

## Sources

- TrackMan, [Tour averages](https://www.trackman.com/blog/introducing-updated-tour-averages) — PGA Tour attack angles by club.
- TrackMan, [Driver optimization tables (2010)](https://wishongolf.com/wp-content/uploads/2012/07/TrackMan-Driver-Optimization_2010.pdf) — the attack-angle, loft and spin trade-off.
- Rapsodo, [MLM2PRO vs Foresight GCQuad: club path and attack angle](https://rapsodo.co.uk/blogs/golf/mlm2pro-vs-foresight-gcquad-a-data-driven-comparison-of-club-path-and-attack-angle) — manufacturer testing.
- Bliss and Langdown (2025), [Mevo+ vs Trackman 4 indoor tracking](https://oro.open.ac.uk/107777), *JSAMS Plus*.
