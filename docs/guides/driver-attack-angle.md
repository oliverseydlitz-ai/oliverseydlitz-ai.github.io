# Driver attack angle: why the tour average isn't your target

The PGA Tour's average driver attack angle is {{Benchmarks.get('d').pga.aa}}°, which is slightly *down* on the ball. People quote it like it's what you should copy. For most amateurs it isn't. With a driver you want to be hitting up, somewhere around {{Benchmarks.TARGET.driverAttackAngle.lo}}° to {{Benchmarks.TARGET.driverAttackAngle.hi}}°. The tour average tells you what tour players do. It doesn't tell you what's best.

[[photo: a teed-up driver from face-on, ball forward in the stance, with the low point of the swing behind the ball]]

## Average isn't the same as best

Tour players are fast, great strikers, and their swings are all different. Average them all together and you get a number that describes the tour, not a recipe for you.

What gets you distance is launch and spin, and attack angle changes both. Hitting up gets the ball higher with less spin for the same loft. Hitting down does the opposite: lower launch, more spin, a ball that balloons and falls short. Most amateurs already spin the driver too much, so hitting down makes it worse.

## How many yards is it worth? Careful

You'll see charts saying you gain so many yards for every degree you hit up. They come from TrackMan's driver tables, and there's a catch almost nobody mentions: **at every attack angle, the loft and spin were changed to suit it.** Going from 5° down to 5° up in those tables also meant about 5.3° more loft at impact and roughly 1,184 rpm less spin.

So the gain is real, but only with a driver set up for the new attack angle. Change your attack angle with the same driver and you'll get less than the chart says. Nobody has published how much less. That's why this guide won't give you a yards-per-degree number: there isn't an honest one for your current club.

What we do know: hitting up, with a driver fitted for it, carries further at the same ball speed. How much further with your driver as it is today, nobody knows.

## Can your launch monitor tell you your attack angle?

Roughly, over a bucket, and not shot by shot.

- The MLM2PRO measures attack angle, but only if the ball is exactly where it expects. Rapsodo's own test against a GCQuad had it off by 1.05° on average.
- On other home units it can be much worse. In one study, the Mevo+'s attack angle with a 7-iron had almost nothing to do with what TrackMan read.
- Your own swing moves too. Between two ten-shot sessions, attack angle needs to shift by about {{Metrics.MDC_N10.attackAngle}}° before it's likely a real change.

So average it. ShotLab waits for {{Metrics.MIN_SHOTS_DELIVERY}} shots with a club before it reads anything into your attack angle, and shows a range, not one number. One drive reading +4° doesn't mean much on its own.

## Irons are the other way round

None of this applies to irons. With an iron you want to hit down, somewhere around {{Benchmarks.TARGET.ironAttackAngle.hi}}° to {{Benchmarks.TARGET.ironAttackAngle.lo}}°, so the club bottoms out after the ball. The tour averages agree: every iron in the table is hitting down, from {{Benchmarks.get('3i').pga.aa}}° with a 3-iron to {{Benchmarks.get('pw').pga.aa}}° with a pitching wedge. An upward attack angle with a 7-iron usually means a thin strike.

One warning if you practise off mats: a mat is hard, so the club bounces off it instead of digging. A strike well behind the ball can still come off looking fine. Mats hide fat shots, which is exactly the fault low-point work is meant to catch.

## What to do with it

- **Driver:** tee it high enough and far enough forward to catch it on the way up. Watch whether your average moves toward hitting up across a session, not whether one drive did.
- **Check the other numbers.** A better attack angle should show up as higher launch and, on good balls, more carry. If attack angle changes and nothing else does, don't trust the reading.
- **Think about the driver, not just the swing.** The big gains assume the loft is set up for it, so a fitting might be part of the answer.
- **Irons:** hit down, and be suspicious of good-looking numbers off a mat.

## Sources

- TrackMan, [Tour averages](https://www.trackman.com/blog/introducing-updated-tour-averages) — PGA Tour attack angles by club.
- TrackMan, [Driver optimization tables (2010)](https://wishongolf.com/wp-content/uploads/2012/07/TrackMan-Driver-Optimization_2010.pdf) — the attack-angle, loft and spin trade-off.
- Rapsodo, [MLM2PRO vs Foresight GCQuad: club path and attack angle](https://rapsodo.co.uk/blogs/golf/mlm2pro-vs-foresight-gcquad-a-data-driven-comparison-of-club-path-and-attack-angle) — manufacturer testing.
- Bliss and Langdown (2025), [Mevo+ vs Trackman 4 indoor tracking](https://oro.open.ac.uk/107777), *JSAMS Plus*.
