# Short game — the evidence behind `ShortGame` and `QuietEye`

Research note for the putting and chipping modules, written September 2026.
The rest of the app is downstream of a launch monitor; these two modules are
not, and the evidence for them comes from a different literature.

Read this before changing a drill's `tier`, adding a drill, or softening any of
the caveats in `ShortGame.STRUCTURES`.

---

## 1. The spine: a 2024 systematic review

**Motor learning in golf — a systematic review.** *Frontiers in Sports and
Active Living*, February 2024.
<https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1324615/full>

Screened the randomised controlled trials on learning golf-specific motor
skills and **included 52**, grouped into five strategies: cognitive training,
practice scheduling, augmented feedback, implicit and explicit learning, and
focus of attention.

**Superior within their strategy:**

| Method | Strategy | In the code |
|---|---|---|
| Errorless learning | implicit/explicit | `STRUCTURES.errorless`, tier `strong` |
| Increasing contextual interference | practice scheduling | `STRUCTURES.random`, tier `strong` |
| External focus of attention | focus of attention | `STRUCTURES.external`, tier `moderate` |

**No single method favourable** for *cognitive training* or *augmented
feedback*. That is a useful negative result and it is worth keeping in mind,
because those two categories are where most commercial golf content sits.

### The limitation, stated by the reviewers

> the lack of statistical power for more than half of the RCTs, and the fact
> that most studies investigated simple putting tasks in novices only

This is why `ShortGame` grades drills rather than presenting them uniformly,
and why the UI carries the limitation next to the finding. **The direction is
well supported. The magnitude, for a competent golfer on a real green, is
not.** Anyone quoting an effect size for these to a mid-handicapper is
extrapolating past the evidence.

---

## 2. Errorless learning

**Maxwell, J.P., Masters, R.S.W., Kerr, E. & Weedon, E. (2001). The implicit
benefit of learning without errors.** *Quarterly Journal of Experimental
Psychology A*, 54(4).
<https://pubmed.ncbi.nlm.nih.gov/11765732/>

Two studies on golf putting. Learners who made **few errors during
acquisition** were unaffected when a secondary task was loaded on top;
learners who made many errors deteriorated.

**Mechanism as the authors state it:** reducing errors limits the number of
error-correcting hypotheses the learner tests, which reduces the contribution
of explicit processing to acquisition. Skill acquired implicitly is less
susceptible to breakdown under distraction and pressure.

**Why it matters for this app specifically:** the failure mode it protects
against — a technique that works on the range and collapses when it counts — is
exactly the failure mode of a chunked chip. That is why
`c-errorless-lie` is tier `strong` and why the session builder puts errorless
work first.

Related: Masters' broader implicit-learning work found implicit groups more
accurate than explicit-instruction groups in anxiety-based retention tests.

---

## 3. Contextual interference (random vs blocked)

### Putting

**Fazeli, D., Taheri, H. & Saberi Kakhki, A. (2017). Random versus blocked
practice to enhance mental representation in golf putting.** *Perceptual and
Motor Skills*.
<https://pubmed.ncbi.nlm.nih.gov/28449601/>

30 participants, three groups (random / blocked / no practice), six consecutive
days, 10 blocks of 18 trials per day, tested a week after the last session.

- The random group putted **worse during acquisition** and **more accurately at
  retention**.
- The random group also ended with a **mental representation structurally
  closer to that of skilled golfers**.

**The practical consequence, and the reason the UI says it out loud:** random
practice feels worse while you are doing it. That is the single most common
reason golfers abandon it, and telling them in advance is the difference
between a method that works and one that gets dropped on day two.

### Chipping — a separate published trial

**The effects of blocked and random practice on the learning of three
variations of the golf chip shot.** *International Journal of Performance
Analysis in Sport*, 18(2), 2018.
<https://www.tandfonline.com/doi/full/10.1080/24748668.2018.1475199>

54 acquisition trials across three chip variations, blocked or random order.

- **During acquisition:** both groups improved, **no group difference**.
- **At the random retention test:** the random group was **significantly more
  accurate**.
- At the blocked retention test: no group difference.

This one matters because it is chipping specifically, not putting generalised
to chipping. It is the citation behind `c-three-var`, tier `strong`.

---

## 4. External focus of attention

Named superior within its strategy by the 2024 review. **The effect is small** —
the app's own research base puts it at about **g = 0.15 after correction for
publication bias** (§5.9, Tier C: "permissible, build no claims on").

So `STRUCTURES.external` is tier `moderate` and its `why` states the number.
It is worth doing because it costs nothing, not because it will transform
anything. Do not upgrade this without new evidence.

---

## 5. Quiet eye — see `QuietEye`, documented separately

Covered in `CLAUDE.md` and the module's own header. Summary: d ≈ 0.84 falling
to **0.69 after trim-and-fill** (Lebeau et al., 2016, 36 studies), −1.92
putts/round in competition from a **single 20-putt session** (Vine, Moore &
Wilson, 2011, n=22, mean handicap 2.78), replicated by He et al. (2024).

The largest surviving effect in the whole research base. The app tracks the
**outcome only** — there is no gaze field anywhere, deliberately, because the
app cannot see gaze and would otherwise end up claiming a quiet eye changed.

---

## 6. Where the strokes actually are

This is the context that stops the module flattering the practice green, and it
comes from Broadie's strokes-gained work and the derived literature.

- **~65% of shots in a round happen from inside 100 yards.** So the short game
  is a large share of the strokes by volume.
- **Amateurs lose most of their short-game strokes to three-putts from outside
  25 ft and to chunked chips.** Both are cheap to fix relative to swing
  changes.
- **But:** a typical 90-shooter loses roughly **six strokes** to a scratch
  golfer across approach play and the short game, and only about **two** to
  putting.

> Putting is the cheapest thing to fix, not the biggest hole.

That last line is in the UI. It is the honest framing and it contradicts the
"drive for show, putt for dough" folklore the practice green runs on.

### Tour reference points (`ShortGame.TOUR`)

Scale, not targets:

| From | Tour make rate | Tour three-putt rate |
|---|---|---|
| 30 ft | ~7% | ~5% |
| 40–50 ft | — | 10–20% |

**From long range the target is two putts, not one.** Club golfers three-putt
considerably more often than the 40–50 ft figures above.

Sources for this section:
<https://columbia.edu/~mnb2/broadie/Assets/strokes_gained_pga_broadie_20110408.pdf>,
<https://www.pga.info/discover/latest/news/why-setting-realistic-expectations-lag-putting-key-shooting-lower-scores/>

---

## 7. Why chipping is scored on proximity

Strokes gained around the green is a function of **lie and proximity** — how
far the ball finished from the hole. It is not a function of whether the chip
went in. Holing a chip is close to noise; finishing eight feet away instead of
eighteen is not.

So `ShortGame.proximity()` reports **median and mean together**, and the gap
between them is the signal:

- The **median** is the chip you actually hit — your standard.
- The **mean** is dragged by blow-ups.
- A large gap **is** the chunk rate, expressed in feet.

On the ten-chip test set `[3,4,4,5,5,6,7,8,9,42]` the median is 5.5 ft and the
mean is 9.3 ft. One bad contact in ten moved the average by nearly four feet
and the median barely at all. The app says outright that the thing to work on
is the bad one, not the standard one.

`disasters` uses `> max(15 ft, 3 × median)` — scale-free, so it means "a putt
you were never going to hole" for a good chipper and a bad one alike.

---

## 8. What is deliberately NOT in here

- **No strokes-gained figure for chipping.** The app keeps exactly one strokes
  number, in `Dispersion`, from measured directional spread. A second one
  arrived at down a different road would leave a golfer holding two figures
  with no way to know which answers what. Proximity in feet is the honest end
  of this chain.
- **No claim that a drill takes N sessions to work.** No study supports a rep,
  day or week count.
- **No gaze measurement.** See §5.
- **No technique prescriptions** — nothing here tells a golfer where to put
  their hands. Every drill specifies a *task constraint* (a landing spot, a
  distance, an order, a consequence) and lets the movement solve it. That is
  the external-focus finding applied structurally rather than as a form of
  words.

---

## 9. If you add a drill

1. Give it a `tier`. `strong` needs a trial you can cite in the `why`.
   `moderate` means the structure is supported but this format is not tested.
   `weak` means no trial — say so in the `why`, as `p-firstputt` and
   `c-pressure-updown` do.
2. Attach the `structures` it uses. The test suite fails if a drill names a
   structure that does not exist.
3. Prefer a task constraint over an instruction.
4. If it produces a number, say what would make that number mean something.
