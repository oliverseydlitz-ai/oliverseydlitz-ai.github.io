# How many shots before a launch-monitor average means anything?

At least {{Metrics.MIN_SHOTS_REPORT}} per club before an average is worth reading. {{Metrics.MIN_SHOTS_DELIVERY}} before you believe a change in club path or attack angle. {{Metrics.MIN_SHOTS_TAIL}} before you say anything about your bad misses. Fewer than that and you're mostly reading luck. Those are the numbers ShotLab uses, and they come from studies of how much golfers vary from shot to shot.

[[photo: the MLM2PRO screen or the app's shot list after a ten-ball block with one club]]

## Why one good one proves nothing

You know this from the range. You flush three 7-irons, think you've found something, and the next five go everywhere. A launch monitor doesn't change that. It just puts an exact-looking number on every swing.

How many shots you need depends on the number:

- **Club speed and ball speed settle down fast.** In one study of amateurs, one or two swings were enough for these to be reliable.
- **Carry takes much longer.** In the same study, you needed a change of 31.53 metres to trust it off one shot, and still 17.97 metres off six. Six shots still isn't much to go on.
- **Some numbers never settle.** Start direction, spin axis and how far offline the ball finished stayed unreliable however many shots they hit.

The study recommended at least 7 driver swings and 10 with a 6-iron. ShotLab keeps it simple: {{Metrics.MIN_SHOTS_REPORT}} shots per club before it shows an average.

## What counts as a real change

This is the question you actually care about: last week I averaged this, this week I averaged that, did anything change? For a driver, over two sessions of ten shots each, the change needs to be about this big before it's likely real. Some of these are estimates, so use them as a guide:

| Number | Change needed at 10 shots each |
|---|---|
| Club speed | {{Metrics.MDC_N10.clubSpeed}} mph |
| Ball speed | {{Metrics.MDC_N10.ballSpeed}} mph |
| Smash factor | {{Metrics.MDC_N10.smashFactor|2}} |
| Carry | {{Metrics.MDC_N10.carryDistance}} yards |
| Attack angle | {{Metrics.MDC_N10.attackAngle}}° |
| Club path | {{Metrics.MDC_N10.clubPath}}° |
| Spin (RPT ball) | {{Metrics.MDC_N10.spinRate}} rpm |

Anything smaller could just be the normal difference between two buckets. Six more yards of carry across two ten-ball sessions isn't a gain yet. More shots help, but slowly: at 20 shots a session the carry number only drops to about {{Metrics.mdc('carryDistance', 20)|0}} yards.

Those numbers come from other golfers. What really matters is how much *you* vary, and after about five sessions your own data tells you that better than any study. That's why ShotLab judges your changes against your own history once it has enough, and says "can't tell yet" until then instead of guessing.

## Why your bad misses need far more shots

The shots that cost you on the course aren't your average ones. They're the occasional big miss: out of bounds, in the trees. Research on amateur scoring treats your shots as two groups: mostly normal ones, plus a few really bad ones. Those few are where the penalty shots come from.

The problem is they're rare. **Fifteen shots often don't include a single bad one**, so your spread looks tidier than it really is. That's why ShotLab wants {{Metrics.MIN_SHOTS_TAIL}} shots with a club before it talks about your misses.

## Clean up misreads, but keep the real misses

Two different kinds of weird shot, and they need opposite treatment.

- **Misreads go.** Home units glitch sometimes. One user reported a 147 mph swing and a 0 mph swing almost back to back. One reading like that wrecks a ten-shot average, so bin it, and keep count of how many you binned.
- **Real bad shots stay when you're looking at your misses.** A real slice into the trees isn't a glitch. It's exactly the shot you're trying to measure. Delete it to make the numbers look nicer and you've deleted the useful part.

## The short version for your next session

1. Hit at least {{Metrics.MIN_SHOTS_REPORT}} with a club before you look at its average.
2. Don't call a change until it's bigger than the table above, or until you have a trend across several sessions.
3. Give a club {{Metrics.MIN_SHOTS_TAIL}} shots before you judge your misses.
4. Keep the ball and the surface the same when you compare.

## Sources

- Villarrasa-Sapiña et al. (2022), [Reliability of launch monitor metrics](https://www.mdpi.com/1424-8220/22/23/9069), *Sensors* — how many shots each number needs.
- Hopkins (2000), [Measures of reliability in sports medicine and science](https://www.sportsci.org/resource/stats/Hopkins_SportsMed_rely_00.pdf), *Sports Medicine* — the method behind the "real change" table. Some of the golf numbers in it are estimates.
- Bliss and Langdown (2024), [Trackman 4 within- and between-session reliability](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2314864), *Journal of Sports Sciences*.
- Broadie and Ko (2009), [A simulation model to analyze the impact of distance and direction on golf scores](https://business.columbia.edu/sites/default/files-efs/pubfiles/4703/wsc_golf_broadie_ko.pdf), Winter Simulation Conference — the two-part model of good and bad shots.
