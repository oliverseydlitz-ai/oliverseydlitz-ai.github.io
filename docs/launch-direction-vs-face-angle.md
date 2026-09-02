# Golf Ball Launch Physics: Launch Direction vs. Face Angle

Understanding the distinction between **Launch Direction** and **Face Angle** is critical when building software or analytics engines for launch monitors like the **Rapsodo MLM2PRO**. 

While many golfers assume Launch Direction and Face Angle are 1:1 identical, they are **not**. The interaction between the clubface, swing path, and ball at impact causes the ball to launch on a composite direction dictated by the **D-Plane physics model**.

---

## 1. The Core Relationship: The D-Plane Model

When a club strikes a golf ball, friction and loft cause the ball to compressed and slide/deflect slightly along the swing path vector before leaving the clubface. As a result:

> **Launch Direction** is a weighted average determined roughly **75%–85% by Face Angle** and **15%–25% by Club Path**.

$$\text{Launch Direction} \approx (\text{Face Angle} \times w) + (\text{Club Path} \times (1 - w))$$

Where $w$ is the weight factor contributed by the clubface.

---

## 2. Weight Variations by Club Type

The exact ratio shifts based on the dynamic loft, friction, and ball compression characteristics of the club:

| Club Category | Face Angle Weight ($w$) | Club Path Weight ($1-w$) | Why It Happens |
| :--- | :--- | :--- | :--- |
| **Driver / Low Loft** | ~85% | ~15% | Lower loft reduces friction-induced deflection; the ball launches almost purely in the face direction. |
| **Mid-Irons** | ~75% – 80% | ~20% – 25% | Moderate loft and groove contact cause noticeable deflection along the swing path line. |
| **Wedges / High Loft** | ~60% – 70% | ~30% – 40% | High loft and heavy friction pull the initial launch direction significantly toward the path direction. |

---

## 3. Reverse-Engineering Face Angle in Software

If your application receives **Launch Direction** and **Club Path** (or estimated path), you can approximate the **Face Angle** using the rearranged formula:

$$\text{Estimated Face Angle} = \frac{\text{Launch Direction} - (\text{Club Path} \times (1 - w))}{w}$$

### Practical Example (7-Iron Impact):
* **Club:** 7-Iron ($w = 0.75$)
* **Club Path:** $+4.0^\circ$ (In-to-Out)
* **Measured Launch Direction:** $+2.0^\circ$ (Right of Target)

$$\text{Estimated Face Angle} = \frac{2.0 - (4.0 \times 0.25)}{0.75} = \frac{2.0 - 1.0}{0.75} = +1.33^\circ \text{ (Open)}$$

---

## 4. Crucial Edge Case: Gear Effect & Strike Location

When implementing this logic into an app, be aware of **Off-Center Strikes**:

* **Toe Strikes:** The clubhead twists open on impact, pushing launch direction further right. Simultaneously, gear effect imparts counter-clockwise (draw) spin axis.
* **Heel Strikes:** The clubhead twists closed, pushing launch direction left while imparting clockwise (fade) spin axis.

Without impact location data (center vs. off-center strike), any derived face angle will carry inherent variance on mis-hits due to gear effect dynamics.
