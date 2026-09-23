# How accurate is the Rapsodo MLM2PRO?

Short answer: the speeds are good, the angles are rough, and some of the numbers on your screen aren't measured at all. Ball speed and club speed are the ones to trust. Launch angle, attack angle and club path are fine over a bucket but jump around shot to shot. Spin only counts with the RPT ball, and even then it's the weakest number you get. Carry, total, apex and side carry are calculated, not measured. And face angle isn't in there at all.

Worth knowing first: **nobody has done a proper independent accuracy test of any Rapsodo unit.** Everything below comes from Rapsodo's own testing, studies of similar home launch monitors, and studies of how much golfers vary on their own. Anyone who sounds more certain than that is guessing.

[[photo: the MLM2PRO set up behind a hitting mat, side view, with the distance to the ball visible]]

## What it measures and what it works out

Rapsodo lists 15 numbers. Some are measured and some are calculated, and that matters more than any accuracy figure.

| Number | How you get it | Worth knowing |
|---|---|---|
| Ball speed | Measured (radar and camera) | The most reliable number on the unit |
| Club speed | Measured (radar) | |
| Launch angle | Measured (camera) | |
| Launch direction | Measured (camera) | Only as good as your alignment |
| Spin rate | Measured with the RPT ball | Needs the RPT ball |
| Spin axis | Measured with the RPT ball | Needs the RPT ball |
| Club path | Measured | Needs the ball placed precisely |
| Attack angle | Measured | Same placement rule |
| Smash factor | Calculated | Ball speed divided by club speed |
| Carry | Calculated | Worked out from the launch numbers |
| Total distance | Calculated | Carry plus a guess at the roll |
| Side carry, apex, descent | Calculated | Worked out, not seen |
| Shot type | Calculated | A label, not a measurement |
| Face angle | **Not provided** | See below |

The big one: **carry is calculated.** The unit sees how the ball leaves the club and works out where it would have landed. On good balls it's a fair guide, but any error in the launch numbers ends up in the carry too. If your carry moves a few yards between sessions, that doesn't mean anything has changed.

## The only accuracy numbers that exist

Rapsodo tested club path and attack angle against a Foresight GCQuad over 1,021 shots and published the results:

| Number | Average error | Typical error |
|---|---|---|
| Attack angle | 1.05° | 1.42° |
| Club path | 1.19° | 1.46° |

Fair enough as company tests go: lots of shots, real golfers, a proper device to compare against. But it's their own test, nobody checked it, and it doesn't say how many shots the unit missed. Treat it as the best case.

For ball speed, club speed, launch angle, spin, spin axis, launch direction and smash factor, **there is no published error data for the MLM2PRO from anyone.** The closest thing is a study that tested the FlightScope Mevo+, another home unit, against a TrackMan 4:

- Club speed and ball speed matched TrackMan well.
- Smash factor was close too.
- Spin wasn't. On a single shot it could be 2,628 rpm too low or 5,103 rpm too high. There's a separate guide on that.
- In a second study, the Mevo+'s attack angle with a 7-iron had basically nothing to do with what TrackMan read.

That's a different unit, so it isn't the MLM2PRO's result. But the pattern is worth knowing: on home launch monitors, **the ball numbers hold up and the club numbers mostly don't, especially with irons.**

## Your swing is noisier than the unit

People skip this bit. Even on a TrackMan, good players' numbers moved a lot between two sessions of ten drivers each. Their average carry typically moved 7.80 to 14.21 yards, and ball speed 2.46 to 4.42 mph. That's not the device. That's just golf.

So if your carry moves eight yards between Tuesday and Saturday, that's normal. You'd see the same thing on a perfect launch monitor.

## Face angle isn't in there

Lots of people think the MLM2PRO tells you where the face was pointing. It doesn't, and it's not on Rapsodo's list. Anything showing you a face angle from MLM2PRO data has worked it out backwards from start direction and club path, because the face sets most of the start line. How much "most" is depends on the club: about 84% with a driver, 78% with a 7-iron and 71% with a pitching wedge, per PING's research. The "85% face, 15% path" rule you've heard is a driver number.

Working it out backwards makes the error bigger. Club path alone is typically off by 1.46° in Rapsodo's own test, and the face number is shakier than the path it came from. So one shot saying "face 2° open" could easily be noise.

## What to actually do with this

- **Trust the speeds first.** Ball speed, club speed and smash factor are the device's best numbers, and where most of us have the most to gain.
- **Average before you read anything.** Give each club at least {{Metrics.MIN_SHOTS_REPORT}} shots before you look at its average, and {{Metrics.MIN_SHOTS_DELIVERY}} before you decide your path or attack angle has changed.
- **Look at the range, not one number.** "Club path 2°, give or take 3°" tells you the truth. "Club path 2°" doesn't.
- **Keep your setup the same.** Launch direction depends on alignment, and path and attack angle depend on where you put the ball. Mats and range balls change the numbers too, so only compare sessions hit on the same ball and the same surface.
- **Throw out obvious misreads.** One user reported a 147 mph swing and a 0 mph swing almost back to back under fluorescent lights. One reading like that wrecks a ten-shot average.
- **Don't practise off spin.** See the spin guide for why.

## Sources

- Rapsodo, [MLM2PRO product page](https://rapsodo.com/products/mlm2pro-mobile-launch-monitor-golf-simulator) — the metric list, measured versus calculated.
- Rapsodo, [MLM2PRO vs Foresight GCQuad: club path and attack angle](https://rapsodo.co.uk/blogs/golf/mlm2pro-vs-foresight-gcquad-a-data-driven-comparison-of-club-path-and-attack-angle) — manufacturer testing, not independently reviewed.
- Brennan et al. (2024), [Validity and reliability of the FlightScope Mevo+ launch monitor](https://pubmed.ncbi.nlm.nih.gov/38090982/), *Journal of Strength and Conditioning Research*.
- Bliss and Langdown (2025), [Mevo+ vs Trackman 4 indoor tracking](https://oro.open.ac.uk/107777), *JSAMS Plus*.
- Bliss and Langdown (2024), [Trackman 4 within- and between-session reliability](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2314864), *Journal of Sports Sciences*.
- Henrikson, Wood, Broadie and Nuttall (2020), [Role of friction and tangential compliance on resultant launch angle](https://www.mdpi.com/2504-3900/49/1/27), *Proceedings* — the face-share figures.
