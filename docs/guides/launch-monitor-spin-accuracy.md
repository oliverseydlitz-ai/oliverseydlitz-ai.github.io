# Is launch-monitor spin accurate?

Not accurate enough to practise on — not on a consumer unit, and it's shakier than you'd think even on a TrackMan. Spin is the number everyone wants to fix, because it's right there on the screen and it explains so much. It's also the least trustworthy number a home launch monitor gives you.

[[photo: a Rapsodo RPT ball next to a normal ball, close enough to see the markings]]

## The number that settles it

The best independent data on consumer-radar spin comes from a peer-reviewed study that put a FlightScope Mevo+ next to a TrackMan 4 and had 29 young golfers hit ten drivers and ten 6-irons each. Speeds lined up well. Spin didn't:

- On average the Mevo+ read up to 1,238 rpm away from TrackMan.
- For any single shot, the gap could run anywhere from **−2,628 to +5,103 rpm** (the 95% limits of agreement).

Now compare that with the thing you're trying to fix. The USGA and R&A measured the average male amateur's driver at 3,275 rpm and the PGA Tour average at 2,686 rpm. That's a gap of 589 rpm. **The measurement error is several times bigger than the entire gap between you and a tour player.** A spin reading that says you've "lost 400 rpm" can't tell that apart from nothing happening.

That study used a Mevo+, not an MLM2PRO. Nobody has published MLM2PRO spin accuracy, so there's no better number to give you. The MLM2PRO measures spin with a camera, and only with its marked RPT ball — without one, the spin you see isn't a measurement of the ball you hit.

## Even a TrackMan struggles with it

This is the part that surprises people. A separate study had good golfers hit ten drivers in each of two sessions on a TrackMan 4. Club speed and ball speed were rock steady between sessions. Spin wasn't: its session-to-session reliability (ICC) ranged from 0.60 down to **0.02**, with a typical wobble of 241 to 455 rpm.

An ICC of 0.02 means a golfer's spin in one session told you close to nothing about their spin in the next. That's on the best device on the market, so it isn't a hardware problem. **Your spin number moves a lot on its own**, because it depends on things that change from swing to swing and bay to bay.

## What moves spin that isn't your swing

Spin reacts to almost everything, which is why it's so noisy:

| What changed | What it does to spin |
|---|---|
| Hitting off a mat instead of grass (8-iron) | About 1,000 to 1,300 rpm less |
| Worn wedge grooves (new vs about 500 bunker shots, 50 yards) | 7,021 down to 3,737 rpm |
| Urethane cover vs Surlyn (a premium ball vs a cheap one) | Roughly 12–15% different on shots where friction is the limit |
| Range balls, pitching wedge | About half the spin |
| Striking it low on the heel vs the centre (driver, robot) | 3,310 rpm vs 2,710 rpm |

That last row is the useful one. A swing robot hitting the same driver at the same speed got about 600 rpm more spin just by missing low on the heel. **A lot of what shows up as "too much spin" is where you hit it on the face.**

## What to do instead

The amateur spin problem is mostly a strike problem, and strike shows up in a number the device measures well: smash factor. The same USGA and R&A data puts the average male amateur at 93 mph of club speed — about the same as an LPGA player's 94 — but with 7 mph less ball speed and 664 rpm more spin than the LPGA average. Same engine, worse contact.

So:

- **Work on strike and watch smash factor.** It's ball speed over club speed, both measured, and it moves with where you hit the face.
- **If you look at spin, use the RPT ball and average it.** Between two sessions of ten shots, spin needs to move by roughly {{Metrics.MDC_N10.spinRate}} rpm before the change is likely real — and that figure is on the optimistic side.
- **Treat the "optimal" charts as a region.** Published launch-and-spin windows cover 350 to 500 rpm inside a single swing-speed group. Two players with the same speed can have different best numbers.
- **Never compare spin across balls or surfaces.** A mat session against a grass session, or a range ball against your gamer, measures the conditions.

## Sources

- Brennan et al. (2024), [Validity and reliability of the FlightScope Mevo+ launch monitor](https://pubmed.ncbi.nlm.nih.gov/38090982/), *Journal of Strength and Conditioning Research*.
- Bliss and Langdown (2024), [Trackman 4 within- and between-session reliability](https://www.tandfonline.com/doi/full/10.1080/02640414.2024.2314864), *Journal of Sports Sciences*.
- USGA and R&A (2022), [Equipment Specifications Research, June 2022](https://assets.randa.org/c42c7bf4-dca7-00ea-4f2e-373223f80f76/5032b690-e906-4965-8c92-ec038d56d6d3/Equipment%20Specifications%20Research%20-%20June%202022.pdf) — the tour and amateur driver averages.
- MyGolfSpy, [Worn wedge grooves spin testing](https://mygolfspy.com/labs/the-truth-about-your-old-wedge-grooves-youre-losing-thousands-of-rpms-of-spin/) — industry testing.
- Golf.com, [Range ball vs premium ball robot test](https://golf.com/gear/golf-balls/range-ball-premium-ball-robotest/) — industry testing.
- Golf Digest and Golf Laboratories, [Robot mishit-location testing](https://www.golfdigest.com/story/driver-analysis-robot-testing-mishit-locations) — industry testing.
