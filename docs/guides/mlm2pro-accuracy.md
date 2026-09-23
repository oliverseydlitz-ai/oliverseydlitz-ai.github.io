# How accurate is the Rapsodo MLM2PRO?

Short version: the speeds are good, the angles are rough, and a few of the numbers on your screen aren't measured at all. Ball speed and club speed are the ones to trust. Launch angle, attack angle and club path give you a fair picture over a bucket but wobble a lot shot to shot. Spin only counts with the RPT ball, and even then it's the weakest number you get. Carry, total, apex and side carry are worked out by a ball-flight model, not measured. And face angle isn't in there at all.

One thing to know before any of the detail: **nobody has published an independent, peer-reviewed accuracy test of any Rapsodo unit.** Everything below is built from Rapsodo's own testing, peer-reviewed studies of similar consumer launch monitors, and studies of how much golfers vary on their own. That's the honest state of the evidence, and anyone telling you more precisely than that is guessing.

[[photo: the MLM2PRO set up behind a hitting mat, side view, with the distance to the ball visible]]

## What it measures and what it works out

Rapsodo's own product page lists 15 metrics. They aren't all the same kind of number, and that difference matters more than any accuracy figure.

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
| Carry | Calculated | A ball-flight model's output |
| Total distance | Calculated | The model plus a roll assumption |
| Side carry, apex, descent | Calculated | Model outputs |
| Shot type | Calculated | A label, not a measurement |
| Face angle | **Not provided** | See below |

The big one: **carry is a model output.** The unit measures how the ball leaves the club and then calculates where it would have landed. It's a useful number, and on good balls it's a fair guide, but it inherits every error in the launch numbers plus the model's own. When your carry moves a few yards between sessions, that's not a measurement of anything moving.

## The only accuracy numbers that exist

Rapsodo tested club path and attack angle against a Foresight GCQuad over 1,021 shots and published the results:

| Metric | Average error | Typical error (RMSE) |
|---|---|---|
| Attack angle | 1.05° | 1.42° |
| Club path | 1.19° | 1.46° |

That's a decent test as manufacturer testing goes: lots of shots, real golfers, a serious reference device. But it's their own test, it wasn't independently reviewed, and it doesn't say how many shots the unit failed to pick up. Read it as the best case.

For ball speed, club speed, launch angle, spin, spin axis, launch direction and smash factor, **there is no published error data for the MLM2PRO from anyone.** The nearest thing is peer-reviewed testing of the FlightScope Mevo+, another consumer unit, against a TrackMan 4:

- Club speed and ball speed tracked TrackMan well (correlations of 0.92 and above).
- Smash factor was close too.
- Spin was not: the gap to TrackMan could run anywhere from −2,628 to +5,103 rpm. There's a separate guide on that.
- In a second study, the Mevo+'s attack angle with a 7-iron agreed with TrackMan's at an ICC of 0.02 — which is statistics for "no relationship".

That's a different unit, so don't read it as the MLM2PRO's result. The pattern is the useful part: on consumer launch monitors, **ball numbers hold up and club-delivery numbers mostly don't, especially with irons.**

## Your swing is noisier than the unit

This is the part people skip. Even on a TrackMan, the thing in front of the net that costs as much as a car, good players moved a lot between two sessions of ten drivers each. The typical wobble in their average carry was 7.80 to 14.21 yards, and in ball speed 2.46 to 4.42 mph. That's not the device. That's golf.

So a carry number that moves eight yards between Tuesday and Saturday hasn't told you anything yet. You'd see that from the same swing on a perfect launch monitor.

## Face angle isn't in there

Plenty of people assume the MLM2PRO tells you where the face was pointing. It doesn't, and it's not on Rapsodo's metric list. Anything that shows you a face angle from MLM2PRO data has worked it backwards from launch direction and club path, using the rule that the face sets most of the start line. How much "most" is depends on the club: about 84% with a driver, 78% with a 7-iron and 71% with a pitching wedge, per PING's research. The "85% face, 15% path" rule you've heard is a driver number.

Working it backwards makes the error bigger, not smaller. Club path alone carries a typical error of 1.46° in Rapsodo's own test, and the maths divides that by the face share, so the derived face number is shakier than the path it came from. One shot's "face 2° open" is inside that noise.

## What to actually do with this

- **Trust the speeds first.** Ball speed, club speed and smash factor are where the device is strongest and where most amateurs have the most to gain.
- **Average before you read anything.** Give each club at least {{Metrics.MIN_SHOTS_REPORT}} shots before you look at its average, and {{Metrics.MIN_SHOTS_DELIVERY}} before you decide your path or attack angle has changed.
- **Read ranges, not single numbers.** "Club path 2° give or take 3°" is honest. "Club path 2°" isn't.
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
