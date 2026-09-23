# Smash factor by club: what good looks like

Smash factor is ball speed divided by club speed. It's the best single number you've got for how well you're hitting it. With a driver the tour average is {{Benchmarks.get('d').pga.sf|2}}. With a 7-iron it's {{Benchmarks.get('7i').pga.sf|2}}, and with a pitching wedge {{Benchmarks.get('pw').pga.sf|2}}. So there's no one "good smash factor". It depends on the club, and comparing your 7-iron to someone's driver number tells you nothing.

[[photo: a driver face with strike tape or foot spray showing a centred strike next to a heel strike]]

## Why it's worth watching

It's made from the two numbers a launch monitor measures best, ball speed and club speed. On home units both match a TrackMan well, and so does smash factor. Most of the other numbers on your screen are shakier.

It's also where most amateurs have the easiest yards to find. The USGA and R&A measured the average male amateur's driver at 93 mph of club speed, basically the same as the LPGA Tour average of 94. But the amateur gets 133 mph of ball speed out of it and the LPGA player gets 140. That's a smash factor of about 1.430 against 1.489. **Same speed, worse contact.** Most of us don't need more speed as much as we need to hit the middle of the face.

## Tour averages, club by club

These are TrackMan's PGA Tour averages. The "good strike" column is where ShotLab calls a strike good: a bit under the tour number. That line is ShotLab's own choice, not an official standard.

| Club | Tour | Good strike |
|---|---|---|
| Driver | {{Benchmarks.get('d').pga.sf|2}} | {{Benchmarks.smashRef('d').good|2}} |
| 3-wood | {{Benchmarks.get('3w').pga.sf|2}} | {{Benchmarks.smashRef('3w').good|2}} |
| 5-wood | {{Benchmarks.get('5w').pga.sf|2}} | {{Benchmarks.smashRef('5w').good|2}} |
| 4-hybrid | {{Benchmarks.get('4h').pga.sf|2}} | {{Benchmarks.smashRef('4h').good|2}} |
| 3-iron | {{Benchmarks.get('3i').pga.sf|2}} | {{Benchmarks.smashRef('3i').good|2}} |
| 5-iron | {{Benchmarks.get('5i').pga.sf|2}} | {{Benchmarks.smashRef('5i').good|2}} |
| 6-iron | {{Benchmarks.get('6i').pga.sf|2}} | {{Benchmarks.smashRef('6i').good|2}} |
| 7-iron | {{Benchmarks.get('7i').pga.sf|2}} | {{Benchmarks.smashRef('7i').good|2}} |
| 8-iron | {{Benchmarks.get('8i').pga.sf|2}} | {{Benchmarks.smashRef('8i').good|2}} |
| PW | {{Benchmarks.get('pw').pga.sf|2}} | {{Benchmarks.smashRef('pw').good|2}} |

The number drops as loft goes up because a lofted club hits the ball more of a glancing blow. More of the energy goes into spin and height and less into ball speed. That's just physics, and it's why you can only compare a club with itself.

## What moves it

Where you hit the face is the big one. In robot testing of 25 drivers at 95 mph, the centre of the face carried 224.5 yards on average. Low on the face averaged 210.5, and the low heel was the worst spot at 204.3. That's over 20 yards lost at the same swing speed, mostly because the launch and spin changed.

Two more things from the same kind of testing are worth knowing:

- **Low strikes cost more than high ones.** High on the face averaged 217.6 yards, low 210.5. A slightly high strike on a driver is the good miss.
- **Speed without strike doesn't pay.** Going from 95 to 100 mph of club speed gained 11 yards on centre strikes. Going from 100 to 105 gained only 2, because spin rose. If swinging harder costs you the middle of the face, you've gained nothing.

## Reading your own number

- **Give it {{Metrics.MIN_SHOTS_REPORT}} shots per club** before trusting an average. One flushed drive is not your smash factor.
- **Make sure a change is real.** Between two ten-shot sessions, smash has to move by about {{Metrics.MDC_N10.smashFactor|2}} before it's likely more than luck. Watch it over a few sessions, not one good day.
- **Ignore impossible readings.** The rules limit how springy a driver face can be, so smash factor has a ceiling. ShotLab treats anything above {{Metrics.CEILING.smashFactor|2}} as a misread, not a record.
- **Compare like with like.** Same club, same ball, same surface. Range balls and mats change the numbers.

To put a distance on it: if the average amateur went from 1.430 to the tour's 1.478 at 93 mph, that's about 4.5 mph more ball speed, or roughly 7–8 yards of carry. That's an estimate, not a measurement, but it gives you an idea.

## Sources

- USGA and R&A (2022), [Equipment Specifications Research, June 2022](https://assets.randa.org/c42c7bf4-dca7-00ea-4f2e-373223f80f76/5032b690-e906-4965-8c92-ec038d56d6d3/Equipment%20Specifications%20Research%20-%20June%202022.pdf) — tour and amateur driver averages.
- TrackMan, [Tour averages](https://www.trackman.com/blog/introducing-updated-tour-averages) — the per-club PGA Tour smash factors.
- Golf Digest and Golf Laboratories, [Robot mishit-location testing](https://www.golfdigest.com/story/driver-analysis-robot-testing-mishit-locations) — industry testing, 2,538 shots, 25 drivers.
- Brennan et al. (2024), [Validity and reliability of the FlightScope Mevo+ launch monitor](https://pubmed.ncbi.nlm.nih.gov/38090982/), *Journal of Strength and Conditioning Research* — how well speed and smash hold up on a consumer unit.
