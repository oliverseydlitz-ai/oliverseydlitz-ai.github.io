# How to build a gapping chart from launch monitor data

Hit at least {{Metrics.MIN_SHOTS_REPORT}} shots with every club, with the ball you play, off the same surface. Write down each club's average carry *and* how much it varies. Then look at the gaps between clubs. A gap only counts if it's bigger than how much the clubs either side of it vary. That's it. The rest of this guide explains why, because every shortcut gives you a chart that looks neat and is wrong on the course.

[[photo: a printed yardage card from the app, folded in a golf bag pocket]]

## Step 1: one ball, one surface

This matters more than anything else here. Range balls don't knock the same distance off every club. In robot testing, the driver lost 12 yards with range balls, the 5-iron lost 8, and the pitching wedge went 4 yards *further*. So a chart made with range balls gets the gaps wrong as well as the distances.

Mats mess with it too. They add launch, cut spin, can make carry read around 10 yards long, and hide fat shots that would have come up short on grass.

So use the ball you play, off the surface you'll use, and don't mix balls or surfaces in one chart. If you've got a mix, use the biggest group of sessions that match. ShotLab's yardage book does exactly that and tells you which group it used.

## Step 2: enough shots per club

One good 7-iron isn't your 7-iron distance. A study of amateurs found you needed a 31.53 metre difference in carry to trust it off one shot, and still 17.97 metres off six. Even good players on a TrackMan saw their average carry move 7.80 to 14.21 yards between two sessions.

So give each club at least {{Metrics.MIN_SHOTS_REPORT}} shots. If a club hasn't got that many yet, keep its row and write "not enough shots" instead of a number. A number from three swings looks just as real as a proper one when you're standing over the ball.

## Step 3: the average, and how much it varies

For each club, work out the average carry and how far off it could be. ShotLab shows it like "152 ± 4 yards (12 shots)". Same average everyone uses, plus how solid it is. A club with a big ± needs more shots, or more work, before you rely on it.

Two things to clean up first:

- **Bin the misreads.** Launch monitors sometimes log nonsense. One user got a 147 mph swing next to a 0 mph one. Drop readings that are impossible, and keep count of how many.
- **Keep the real mishits.** A thin one that really came up short is part of your distance with that club. Delete it and the chart looks better than you actually hit it.

## Step 4: carry is calculated, not measured

Your launch monitor sees how the ball leaves the club. It doesn't see it land. Carry is worked out from the launch numbers, so any error in those ends up in the carry. On good balls it's a fair guide, but it's worth checking your main clubs on the course or a grass range when you can.

Total distance is even more of a guess, because it adds roll on top. Build the chart on carry.

## Step 5: judge the gaps

Now look at the gap between each club and the next.

- **A gap smaller than the ± either side isn't a gap.** Say your 8-iron is 140 ± 6 and your 7-iron is 146 ± 6: they overlap. You don't know yet which one goes further.
- **Overlap is a bag problem, not a swing problem.** If two clubs land in about the same place, you're carrying a club you don't need, or you've got a hole somewhere else. That's one for your bag setup, or a fitter.
- **Judge spread against the club.** Plus or minus 6 yards is tight for a driver and loose for a wedge. Compare each club's spread with its own carry, not a fixed number of yards.
- **There's no magic gap size.** Nobody has published a "right" gap between clubs. It depends on your lofts, your speed and your bag. What matters is that the gaps are real and fairly even for the shots you actually face.

## Step 6: keep it current

A chart from one day in spring goes out of date. Keep adding sessions on the same ball and surface, and watch whether each club's carry is actually moving. Only believe it when the change is bigger than your normal session-to-session difference. A couple of yards between two buckets is almost always nothing.

If you print it, print the conditions too: which ball, which surface, how many shots, and when. A yardage card stays in your bag long after you've forgotten it came from range balls in an indoor bay. ShotLab's printed card includes that line for this reason.

## Sources

- Golf.com, [Range ball vs premium ball robot test](https://golf.com/gear/golf-balls/range-ball-premium-ball-robotest/) — industry testing on a swing robot.
- Villarrasa-Sapiña et al. (2022), [Reliability of launch monitor metrics](https://www.mdpi.com/1424-8220/22/23/9069), *Sensors*.
- Bliss and Langdown (2024), [Trackman 4 within- and between-session reliability](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2314864), *Journal of Sports Sciences*.
- Rapsodo, [MLM2PRO product page](https://rapsodo.com/products/mlm2pro-mobile-launch-monitor-golf-simulator) — carry and total listed as calculated, not measured.
