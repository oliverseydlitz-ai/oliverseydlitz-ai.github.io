# How many shots before a launch-monitor average means anything?

At least {{Metrics.MIN_SHOTS_REPORT}} per club before an average is worth reading. {{Metrics.MIN_SHOTS_DELIVERY}} before you believe a change in club path or attack angle. {{Metrics.MIN_SHOTS_TAIL}} before you say anything about your bad misses. Fewer than that and you're mostly reading luck. Those are the floors ShotLab uses, and they come from studies of how much golfers vary from shot to shot.

[[photo: the MLM2PRO screen or the app's shot list after a ten-ball block with one club]]

## Why one good one proves nothing

You already know this from the range. You hit three flushed 7-irons, decide you've found something, and the next five are all over the place. A launch monitor doesn't fix that. It just puts a precise-looking number on each swing.

How many shots you need depends on the number:

- **Club speed and ball speed settle down fast.** In one study of amateurs, one or two swings were enough for these to be reliable.
- **Carry takes much longer.** In the same study, the smallest carry change you could trust shrank from 31.53 metres off one shot to 17.97 metres off six. Even six shots left you with a wide margin.
- **Some numbers never settle.** Launch direction, spin axis and how far offline the ball finished stayed unreliable however many shots were taken.

The study's own recommendation was at least 7 driver swings and 10 with a 6-iron. ShotLab rounds that into a single floor of {{Metrics.MIN_SHOTS_REPORT}} shots per club before it shows an average.

## What counts as a real change

Here's the question people actually care about: I averaged this last week, I averaged that this week, did anything change? Between two sessions of ten shots each, published estimates put the smallest real change for a driver at about the figures below. Some of them are partly estimated rather than measured, so treat them as a guide, not a law:

| Number | Change needed at 10 shots each |
|---|---|
| Club speed | {{Metrics.MDC_N10.clubSpeed}} mph |
| Ball speed | {{Metrics.MDC_N10.ballSpeed}} mph |
| Smash factor | {{Metrics.MDC_N10.smashFactor|2}} |
| Carry | {{Metrics.MDC_N10.carryDistance}} yards |
| Attack angle | {{Metrics.MDC_N10.attackAngle}}° |
| Club path | {{Metrics.MDC_N10.clubPath}}° |
| Spin (RPT ball) | {{Metrics.MDC_N10.spinRate}} rpm |

Anything smaller than that could just be the normal difference between two buckets. A 6-yard carry gain across two ten-ball sessions isn't a gain yet. Hitting more shots helps, but slowly: at 20 shots a session the carry figure only drops to about {{Metrics.mdc('carryDistance', 20)|0}} yards, because the margin shrinks with the square root of the number of shots.

These are population figures, from other golfers. Your own spread is what really matters, and after about five sessions your own data says more about your noise than any study can. That's why ShotLab judges your changes against your own history once it has enough of it, and says "can't tell yet" until then rather than guessing.

## Why your bad misses need far more shots

The shots that cost you on the course aren't your average ones. They're the occasional big miss: the one out of bounds, the one in the trees. Research on amateur scoring models golf shots as two groups mixed together: mostly normal shots, plus a small share of genuinely bad ones. That small share is where the penalties come from.

The trouble is that a small share is rare by definition. **A 15-shot sample often contains none of the bad ones at all**, so it makes your spread look tidier than it is. That's why ShotLab wants {{Metrics.MIN_SHOTS_TAIL}} shots with a club before it talks about your misses.

## Clean up misreads, but keep the real misses

Two different things get called outliers, and they need opposite treatment.

- **Misreads go.** Consumer units sometimes glitch. One user reported a 147 mph swing and a 0 mph swing almost back to back. One reading like that wrecks a ten-shot average, so it should be thrown out, and you should know how many were.
- **Real bad shots stay when you're measuring your misses.** A genuine slice into the trees is not an error in the data. It's the shot you're trying to measure. Throwing it out to tidy the numbers throws away the most useful part.

## The short version for your next session

1. Hit at least {{Metrics.MIN_SHOTS_REPORT}} with a club before you look at its average.
2. Don't call a change until it's bigger than the table above, or until you have a trend across several sessions.
3. Give a club {{Metrics.MIN_SHOTS_TAIL}} shots before you judge your misses.
4. Keep the ball and the surface the same when you compare.

## Sources

- Villarrasa-Sapiña et al. (2022), [Reliability of launch monitor metrics](https://www.mdpi.com/1424-8220/22/23/9069), *Sensors* — how many shots each number needs.
- Hopkins (2000), [Measures of reliability in sports medicine and science](https://www.sportsci.org/resource/stats/Hopkins_SportsMed_rely_00.pdf), *Sports Medicine* — the method behind the "real change" table. The golf values in it are partly estimated.
- Bliss and Langdown (2024), [Trackman 4 within- and between-session reliability](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2314864), *Journal of Sports Sciences*.
- Broadie and Ko (2009), [A simulation model to analyze the impact of distance and direction on golf scores](https://business.columbia.edu/sites/default/files-efs/pubfiles/4703/wsc_golf_broadie_ko.pdf), Winter Simulation Conference — the two-part model of good and bad shots.
