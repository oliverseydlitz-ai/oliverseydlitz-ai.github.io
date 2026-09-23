# How to build a gapping chart from launch monitor data

Hit at least {{Metrics.MIN_SHOTS_REPORT}} shots with every club, on the ball you play and the same surface, and write down each club's average carry *with* its range, not just the average. Then look at the gaps between neighbouring clubs. A gap is only real if it's bigger than the wobble on the two clubs either side of it. That's the whole method. The rest of this guide is the reasons, because every shortcut people take here produces a chart that looks tidy and is wrong on the course.

[[photo: a printed yardage card from the app, folded in a golf bag pocket]]

## Step 1: one ball, one surface

This matters more than anything else on the page. Range balls don't shorten your bag evenly. In robot testing, the driver lost 12 yards with range balls, the 5-iron lost 8, and the pitching wedge went 4 yards *further*. So a chart built on range balls has the wrong gaps as well as the wrong distances.

Mats cause trouble too. They add launch, cut spin and can make carry read around 10 yards long, and they hide fat strikes that would have come up short on grass.

So pick the ball you play, hit it off the surface you'll be using, and don't mix sessions from different balls or surfaces into one chart. If you have a mix, build the chart from the biggest group of sessions that match. ShotLab's yardage book does exactly that and names the group it used.

## Step 2: enough shots per club

One good 7-iron is not your 7-iron distance. A study of amateurs found that the smallest carry difference you could trust was 31.53 metres off a single shot and still 17.97 metres off six. Even good players on a TrackMan saw their average carry wobble by 7.80 to 14.21 yards between two sessions.

So give each club at least {{Metrics.MIN_SHOTS_REPORT}} shots. If a club doesn't have that many yet, leave its row on the chart and write "not enough shots" rather than a number. A number off three swings reads exactly like a real one when you're standing over the ball.

## Step 3: average, with a range

For each club, work out the average carry and how much it could be off by. ShotLab prints it as something like "152 ± 4 yards (12 shots)". That's the same average everyone quotes, plus the honesty about how solid it is. A club with a wide range needs more shots, or more work, before you rely on it.

Two things to clean up first:

- **Throw out misreads.** Launch monitors occasionally log nonsense — one user reported a 147 mph swing next to a 0 mph one. Drop readings that are physically impossible, and note how many you dropped.
- **Don't throw out real mishits.** A thin one that genuinely came up short is part of your distance with that club. Deleting it makes the chart look better than the club is.

## Step 4: remember carry is calculated

Your launch monitor measures how the ball leaves the club. It doesn't watch the ball land. Carry is worked out from the launch numbers by a ball-flight model, so it inherits every error in them. On good balls it's a fair guide. It isn't a measurement, and it's worth checking the key clubs on the course or on a grass range when you can.

Total distance is even more of a guess, because it adds a roll assumption on top. Build the chart on carry.

## Step 5: judge the gaps

Now look at the gap between each pair of neighbouring clubs.

- **A gap smaller than the ranges either side isn't a gap.** Say your 8-iron is 140 ± 6 and your 7-iron is 146 ± 6: those two clubs overlap. You don't know yet which one goes further.
- **Overlap is a gapping problem, not a swing problem.** If two clubs land in mostly the same place, you're carrying a club you don't need, or leaving a hole somewhere else. That's a question for your bag, or a fitter.
- **Judge spread relative to the club.** Plus or minus 6 yards is tight for a driver and loose for a wedge. Compare each club's spread with its own carry, not with a fixed number of yards.
- **Don't hunt for a magic gap size.** There's no published standard for the "right" yardage gap between clubs. It depends on your lofts, your speed and your bag. What matters is that the gaps are real and even enough for the shots you face.

## Step 6: keep it current

A chart from one day in spring goes stale. Add sessions as you play them, on the same ball and surface, and watch whether each club's carry is actually moving. Only believe a trend when the change is bigger than your own normal session-to-session wobble. A couple of yards between two buckets is almost always noise.

If you print the chart, print the conditions with it: which ball, which surface, how many shots, and when. A yardage card lives in your bag long after you've forgotten it was built off range balls in a heated bay. ShotLab's printed card carries that line for exactly this reason.

## Sources

- Golf.com, [Range ball vs premium ball robot test](https://golf.com/gear/golf-balls/range-ball-premium-ball-robotest/) — industry testing on a swing robot.
- Villarrasa-Sapiña et al. (2022), [Reliability of launch monitor metrics](https://www.mdpi.com/1424-8220/22/23/9069), *Sensors*.
- Bliss and Langdown (2024), [Trackman 4 within- and between-session reliability](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2314864), *Journal of Sports Sciences*.
- Rapsodo, [MLM2PRO product page](https://rapsodo.com/products/mlm2pro-mobile-launch-monitor-golf-simulator) — carry and total listed as calculated, not measured.
