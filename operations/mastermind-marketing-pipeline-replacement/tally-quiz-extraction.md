# Tally Quiz Extraction — 6 Aerial Tarot Archetypes. Which Are You?

**Date:** 2026-02-28
**Form ID:** aQ5Gg9 (production — 14 submissions)
**Form Title:** "6 Aerial Tarot Archetypes. Which Are You?"
**Source:** Tally API extraction + Python classifier (`archetypes.py`)
**Status:** Extracted — flagged anomalies require operator verification before build

---

## Table of Contents

1. [Form Overview](#1-form-overview)
2. [Scoring Dimensions](#2-scoring-dimensions)
3. [Calculated Fields (Tally UUIDs)](#3-calculated-fields-tally-uuids)
4. [Classification Logic](#4-classification-logic)
5. [Complete Question & Scoring Map](#5-complete-question--scoring-map)
   - [Scored Questions](#scored-questions-q1-q4-q5-q6-q7-q8-q9-q10-q12-q13-q14-q15-q16-q17-q18)
   - [Non-Scored Questions](#non-scored-questions-segmentation--product-research)
6. [Scoring Summary Table](#6-scoring-summary-table)
7. [Anomalies & Bugs Requiring Operator Verification](#7-anomalies--bugs-requiring-operator-verification)
8. [Architecture Notes](#8-architecture-notes)

---

## 1. Form Overview

| Property | Value |
|----------|-------|
| Production form ID | `aQ5Gg9` |
| Submissions (production) | 14 |
| Legacy rebuild form ID | `QK7v5Y` (~10 questions, 2 submissions — deprecated) |
| Total questions | 20 |
| Scored questions | 14 (contribute to archetype dimension totals) |
| Non-scored questions | 6 (segmentation and product research) |
| Base scoring dimensions | 4 (Air Weaver, Embodied Intuitive, Ascending Seeker, Shadow Dancer) |
| Combination archetypes | 2 (Flow Artist = B+C dominant; Grounded Mystic = A+D dominant) |
| Total archetypes | 6 |
| Points per scored answer | +4 to the designated dimension |
| Max possible score per dimension | 56 (14 questions × +4, if all answers went to one dimension) |

**Non-scored questions:** Q2, Q3, Q11, Q19, Q20 (confirmed segmentation/product research). Q8 option A is also effectively non-scored due to a bug (see Section 7).

---

## 2. Scoring Dimensions

| Symbol | Archetype | Description |
|--------|-----------|-------------|
| A | Air Weaver | Head-dominant. Logic, frameworks, analysis, mastery through understanding. |
| B | Embodied Intuitive | Body-dominant. Physical knowing, sensation, hands-on learning, somatic truth. |
| C | Ascending Seeker | Spirit-dominant. Open exploration, flow, surrender, curiosity without needing answers. |
| D | Shadow Dancer | Depth-dominant. Shadow work, transformation, discomfort as growth, deep pattern recognition. |
| B+C | Flow Artist | Combination archetype — body and spirit both dominant over head and shadow. |
| A+D | Grounded Mystic | Combination archetype — head and shadow both dominant over body and spirit. |

---

## 3. Calculated Fields (Tally UUIDs)

These are the six calculated fields as they exist in the Tally form. They track cumulative dimension scores and are included in Tally webhook payloads.

| Archetype | Tally UUID |
|-----------|-----------|
| The Air Weaver | `ae57b127-35be-4c6a-bc0d-a4eca51fc203` |
| The Embodied Intuitive | `af1f3008-6f6c-4900-a704-e2df42a42e84` |
| The Ascending Seeker | `dc312038-9ee9-4883-82e5-d86b7195c14d` |
| The Shadow Dancer | `1492be89-5c22-4fbb-883e-9fa1c52e0e1c` |
| The Flow Artist | `d7338d14-299f-42ac-af0b-e61f010ecf28` |
| The Grounded Mystic | `e5274b03-f44b-48ea-9309-30ba6a6b6d8b` |

**Important:** The Flow Artist and Grounded Mystic calculated fields appear to be unused. No conditional logic rules in the Tally form add points directly to these fields. They are combination archetypes derived via classification logic (see Section 4), not independently scored. The Python classifier (`archetypes.py`) reflects this — it derives combination archetypes from the 4 base dimension scores only.

---

## 4. Classification Logic

Sourced from `archetypes.py`. Priority-based cascade — first matching condition wins.

| Priority | Archetype | Condition | Notes |
|----------|-----------|-----------|-------|
| 1 | The Grounded Mystic | A > B AND A > C AND D > B AND D > C | Head + shadow both dominate body + spirit |
| 2 | The Flow Artist | B > A AND B > D AND C > A AND C > D | Body + spirit both dominate head + shadow |
| 3 | The Air Weaver | A >= B AND A >= C AND A >= D | A is the single highest (or tied for highest) |
| 4 | The Embodied Intuitive | B >= A AND B >= C AND B >= D | B is the single highest (or tied for highest) |
| 5 | The Shadow Dancer | D >= A AND D >= B AND D >= C | D is the single highest (or tied for highest) |
| 6 | The Ascending Seeker | Fallback (all other cases) | C never wins a direct comparison — always fallback |

**Design notes:**
- Combination archetypes (Grounded Mystic, Flow Artist) are evaluated first and require dual dominance.
- The Ascending Seeker is the pure fallback and cannot win any head-to-head dimension comparison by design. This is likely intentional — C represents surrender and non-striving, so it "wins" only when no other dimension dominates.
- The four base archetypes (priority 3–5) use `>=` comparisons, meaning ties go to the higher-priority archetype.

---

## 5. Complete Question & Scoring Map

### Scored Questions

---

#### Q1: "1. You're awake at 2am with something weighing on you. What actually helps?"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Making a list, researching options, or thinking it through logically." | Air Weaver (A) | +4 |
| B | "Getting out of bed—walking, stretching, doing something physical." | Embodied Intuitive (B) | +4 |
| C | "Letting it go for now, trusting morning will bring clarity." | Ascending Seeker (C) | +4 |
| D | "Sitting with the discomfort, asking what this situation is really trying to show you." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. A=A, B=B, C=C, D=D. No anomalies.

---

#### Q4: "4. You have an unexpected afternoon to yourself. You'd most enjoy:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Learning a new skill or taking a workshop." | Air Weaver (A) | +4 |
| B | "Moving your body; dancing, yoga, hiking, or aerial practice." | Embodied Intuitive (B) | +4 |
| C | "Quiet reflection; journaling, meditation, or daydreaming." | Ascending Seeker (C) | +4 |
| D | "Going deep—journaling, meaningful conversation, or exploring something you've been avoiding." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q5: "5. When someone offers guidance, your first instinct is to:" ⚠️ ANOMALY

| Option | Answer Text | Scored Dimension | Expected Dimension | Flag |
|--------|-------------|-----------------|-------------------|------|
| A | "Evaluate whether it's logical and applicable to your situation." | Embodied Intuitive (B) | Air Weaver (A) | ⚠️ Shifted |
| B | "Check your gut—does this land in your body as true?" | Ascending Seeker (C) | Embodied Intuitive (B) | ⚠️ Shifted |
| C | "Stay open—maybe there's something here worth exploring." | Shadow Dancer (D) | Ascending Seeker (C) | ⚠️ Shifted |
| D | "Look underneath—what's the real wisdom here, beyond the surface?" | Shadow Dancer (D) | Shadow Dancer (D) | ✓ |

See Section 7, Anomaly 1 for analysis.

---

#### Q6: "6. Which feels most true for you?" ⚠️ ANOMALY

| Option | Answer Text | Scored Dimension | Expected Dimension | Flag |
|--------|-------------|-----------------|-------------------|------|
| A | "'I need to understand how something works before I can trust it.'" | Air Weaver (A) | Air Weaver (A) | ✓ |
| B | "'My body knows things my mind hasn't figured out yet.'" | Ascending Seeker (C) | Embodied Intuitive (B) | ⚠️ Shifted |
| C | "'The best insights come when I stop trying to force them.'" | Embodied Intuitive (B) | Ascending Seeker (C) | ⚠️ Shifted |
| D | "'Growth happens in the uncomfortable places most people avoid.'" | Shadow Dancer (D) | Shadow Dancer (D) | ✓ |

See Section 7, Anomaly 1 for analysis.

---

#### Q7: "7. You learn best when you have:"

| Option | Answer Text | Dimension | Points | Notes |
|--------|-------------|-----------|--------|-------|
| A | "Clear frameworks, logical progressions, and reliable information." | Air Weaver (A) | +4 | |
| B | "Hands-on practice—learning by doing, not just reading." | Embodied Intuitive (B) | +4 | |
| C | "Freedom to explore at your own pace without rigid rules." | Ascending Seeker (C) | +4 | |
| D | "Permission to go deep, even into difficult or complex territory." | Shadow Dancer (D) | +4 | |
| E | "Both structure AND room for mystery—I need the framework AND the freedom." | Air Weaver (A) + Shadow Dancer (D) | +4 each | Dual scoring |

Option E is the only multi-dimension answer in Q7. It awards +4 to Air Weaver and +4 to Shadow Dancer simultaneously (total +8 points added to the quiz, split across two dimensions).

---

#### Q8: "8. When making an important decision you want:" ⚠️ SCORING BUG

| Option | Answer Text | Dimension | Points | Flag |
|--------|-------------|-----------|--------|------|
| A | "Data, logic, and clear analysis." | None | +0 | ⚠️ BUG — no conditional logic rule found; should be Air Weaver +4 |
| B | "To check what my body is telling me." | Embodied Intuitive (B) | +4 | |
| C | "Time to sit with it and let the answer emerge." | Ascending Seeker (C) | +4 | |
| D | "To understand the deeper pattern or lesson underneath." | Shadow Dancer (D) | +4 | |
| E | "I need both the practical AND the mystical—one without the other feels incomplete." | Air Weaver (A) + Shadow Dancer (D) | +4 each | Dual scoring |

See Section 7, Anomaly 2 for analysis. Q8 option A is effectively a dead option — respondents who select it receive no archetype points.

---

#### Q9: "9. Imagine watching someone perform something remarkable. What captivates you most?" ⚠️ BUGS

| Option | Answer Text | Dimension | Points | Flag |
|--------|-------------|-----------|--------|------|
| A | "The precision—every movement intentional, nothing wasted." | Air Weaver (A) | +8 (duplicate) | ⚠️ BUG — conditional logic fires twice; adds +4 twice |
| B | "The physicality—you can almost feel what they're feeling in your own body." | Embodied Intuitive (B) | +4 | |
| C | "The flow—that effortless quality where everything just... works." | Ascending Seeker (C) | +4 | |
| D | "The transformation—watching them become something different than when they started." | All dimensions | A+4, B+4, C+4, D+8 | ⚠️ BUG — adds +4 to A, B, C; adds +8 to D (Shadow Dancer fires twice) |

See Section 7, Anomalies 3 and 4 for analysis.

---

#### Q10: "10. The idea that excites you most about tarot is:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Having a structured system for gaining clarity and making decisions." | Air Weaver (A) | +4 |
| B | "A tangible way to connect with intuition I can actually feel." | Embodied Intuitive (B) | +4 |
| C | "Exploring symbols and meanings without needing all the answers." | Ascending Seeker (C) | +4 |
| D | "Accessing deeper truths about patterns, cycles, and what's really going on." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q12: "12. What tends to derail you when you're trying to grow or learn?"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Too much conflicting information—hard to know what's actually reliable." | Air Weaver (A) | +4 |
| B | "Losing momentum when life gets busy or practice feels abstract." | Embodied Intuitive (B) | +4 |
| C | "Worrying I'm 'doing it wrong' or not making progress fast enough." | Ascending Seeker (C) | +4 |
| D | "Either going too deep too fast, or avoiding the shadow stuff entirely." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q13: "13. What would make learning a symbolic system (like tarot) frustrating for you?"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "No logical framework—just memorize 78 random things." | Air Weaver (A) | +4 |
| B | "Too abstract—I need to feel it or do something with it." | Embodied Intuitive (B) | +4 |
| C | "Too many rigid rules about the 'right way' to do it." | Ascending Seeker (C) | +4 |
| D | "Too shallow—surface keywords instead of real depth." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q14: "14. Right now, you'd most want tarot to help you:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Make clearer decisions with confidence." | Air Weaver (A) | +4 |
| B | "Reconnect with intuition in a way that feels real and grounded." | Embodied Intuitive (B) | +4 |
| C | "Understand yourself without needing definitive answers." | Ascending Seeker (C) | +4 |
| D | "Navigate something you've been avoiding or transform a stuck pattern." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q15: "15. You feel most alive when:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Mastering something complex or solving a problem others couldn't." | Air Weaver (A) | +4 |
| B | "Fully in your body—present, physical, sensation-aware." | Embodied Intuitive (B) | +4 |
| C | "In creative flow, following curiosity wherever it leads." | Ascending Seeker (C) | +4 |
| D | "Going through meaningful change, even when it's uncomfortable." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q16: "16. 'Defying gravity' makes you think of:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Achieving something that seemed impossible through skill and effort." | Air Weaver (A) | +4 |
| B | "The physical thrill of movement, lift, suspension." | Embodied Intuitive (B) | +4 |
| C | "Letting go of what's weighing you down." | Ascending Seeker (C) | +4 |
| D | "Transcending old patterns—becoming who you're meant to be." | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q17: "17. When someone says something that doesn't make logical sense, you:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Try to understand their reasoning—there must be a framework I'm missing." | Air Weaver (A) | +4 |
| B | "Notice how it lands in your body—does it feel true or off?" | Embodied Intuitive (B) | +4 |
| C | "Stay curious—maybe there's something here I don't understand yet." | Ascending Seeker (C) | +4 |
| D | "Look for what's underneath—what are they really trying to express?" | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

#### Q18: "18. If this quiz reveals something true about you, you'll want to:"

| Option | Answer Text | Dimension | Points |
|--------|-------------|-----------|--------|
| A | "Understand the practical implications—how do I use this?" | Air Weaver (A) | +4 |
| B | "Feel it resonate in my body before I do anything with it." | Embodied Intuitive (B) | +4 |
| C | "Let it unfold over time, see where it leads." | Ascending Seeker (C) | +4 |
| D | "Go deeper—what does this mean about my path and growth?" | Shadow Dancer (D) | +4 |

Scoring pattern: Clean 1-to-1 mapping. No anomalies.

---

### Non-Scored Questions (Segmentation & Product Research)

These questions collect data for market research and Kickstarter strategy. They do not affect archetype scoring.

---

#### Q2: "2. When it comes to Tarot, I'd describe myself as:" *(Non-scored — experience segmentation)*

| Option | Answer Text |
|--------|-------------|
| A | "Curious, but just beginning." |
| B | "Practicing, but still building confidence." |
| C | "Experienced, but looking to deepen." |

---

#### Q3: "3. What's been your biggest frustration with tarot so far?" *(Non-scored — pain point segmentation)*

| Option | Answer Text |
|--------|-------------|
| A | "Too many cards to memorize." |
| B | "Court cards all seem the same." |
| C | "Decks I've tried feel cheap or hard to use." |
| D | "I can't read objectively for myself." |
| E | "I haven't found a deck that reflects who I am." |
| F | "No frustrations yet!" |

---

#### Q11: "11. When everything clicks and you're fully engaged, it feels like:" *(Non-scored — flow state segmentation)*

| Option | Answer Text |
|--------|-------------|
| A | "Building something—each piece fitting into place, logic flowing." |
| B | "My body knows what to do without me having to think about it." |
| C | "Time disappears and I'm just... present, open, receiving." |
| D | "Something is being revealed—layers peeling back, truth emerging." |

Note: Q11 reads like a scored question (its answer options clearly map to the four dimensions) but is confirmed non-scored in the Tally form. The answers here mirror dimension language and may be useful as a validation cross-check in post-processing.

---

#### Q19: "19. Card Back Preference?" *(Non-scored — product research)*

| Option | Answer Text |
|--------|-------------|
| A | "Fully Reversible" |
| B | "Distinct Top and Bottom" |

This informs the physical deck design decision for the Kickstarter campaign.

---

#### Q20: "20. If we created something to deepen your practice, what would actually serve you?" *(Non-scored — product research)*

| Option | Answer Text |
|--------|-------------|
| A | "An Online Course (video lessons on reading with the deck)" |
| B | "A Live Virtual Workshop (interactive sessions with the deck creator)" |
| C | "An Expanded Guide Book (in depth card meanings, spreads and quality)" |
| D | "A Live Aerial Tarot Reading Show" |
| E | "Honestly, none of the above" |

This directly informs the Kickstarter stretch goal and post-launch offer strategy.

---

## 6. Scoring Summary Table

Summary of all 14 scored questions and their dimension assignments. Anomalous entries flagged.

| Question | A (Air Weaver) | B (Embodied Intuitive) | C (Ascending Seeker) | D (Shadow Dancer) | Notes |
|----------|---------------|----------------------|--------------------|--------------------|-------|
| Q1 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q4 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q5 | — | Opt A +4 ⚠️ | Opt B +4 ⚠️ | Opt C +4, Opt D +4 ⚠️ | Shifted pattern |
| Q6 | Opt A +4 | Opt C +4 ⚠️ | Opt B +4 ⚠️ | Opt D +4 | Shifted pattern |
| Q7 | Opt A +4, Opt E +4 | Opt B +4 | Opt C +4 | Opt D +4, Opt E +4 | Opt E dual-scores |
| Q8 | Opt E +4 | Opt B +4 | Opt C +4 | Opt D +4, Opt E +4 | Opt A unscored ⚠️ BUG |
| Q9 | Opt A +8 ⚠️ | Opt B +4 | Opt C +4 | Opt D +8 ⚠️ | Two bugs on Q9 |
| Q10 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q12 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q13 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q14 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q15 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q16 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q17 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |
| Q18 | Opt A +4 | Opt B +4 | Opt C +4 | Opt D +4 | Clean |

**Clean questions (no anomalies):** Q1, Q4, Q10, Q12, Q13, Q14, Q15, Q16, Q17, Q18 — 10 of 14 scored questions behave as expected.

**Anomalous questions:** Q5, Q6, Q7, Q8, Q9 — 5 questions with scoring that deviates from the expected pattern, some intentional (Q7 opt E dual scoring) and some likely bugs (Q8 opt A, Q9 opt A, Q9 opt D).

---

## 7. Anomalies & Bugs Requiring Operator Verification

### Anomaly 1 — Q5 and Q6: Shifted Scoring Pattern

**Affected questions:** Q5, Q6
**Severity:** Unknown — possibly intentional design, possibly data extraction artifact

**What was found:**
In Q5 and Q6, the dimension assigned to each answer does not match the answer's surface meaning. Specifically:

- Q5-A: "Evaluate whether it's logical" reads clearly as Air Weaver behavior, but scores Embodied Intuitive.
- Q5-B: "Check your gut—does this land in your body" reads clearly as Embodied Intuitive behavior, but scores Ascending Seeker.
- Q5-C: "Stay open—maybe there's something worth exploring" reads clearly as Ascending Seeker behavior, but scores Shadow Dancer.
- Q6-B: "My body knows things my mind hasn't figured out yet" reads clearly as Embodied Intuitive, but scores Ascending Seeker.
- Q6-C: "The best insights come when I stop trying to force them" reads clearly as Ascending Seeker, but scores Embodied Intuitive.

**Possible explanations:**
1. **Intentional design.** The quiz creator may have deliberately broken the obvious answer pattern so that respondents who self-identify strongly with a dimension don't always pick the "obvious" answer for that dimension. This is a known technique in psychological instruments to reduce social desirability bias.
2. **Extraction error.** The conditional logic rules in Tally may have been set up incorrectly during form build, and these represent actual mistakes in the live form.
3. **Scoring philosophy shift.** The creator may have decided certain behaviors belong to different archetypes than their surface wording suggests (e.g., "checking body resonance" could be framed as spiritual receptivity rather than somatic awareness).

**Action required:** Operator to confirm whether the shifted scoring on Q5 and Q6 is intentional. If intentional, document the rationale. If a bug, the corrected scoring should be: Q5-A=A, Q5-B=B, Q5-C=C; Q6-B=B, Q6-C=C.

---

### Anomaly 2 — Q8 Option A: Missing Conditional Logic Rule

**Affected question:** Q8, option A ("Data, logic, and clear analysis.")
**Severity:** Bug — confirmed missing scoring

**What was found:**
Q8 has five answer options. Options B, C, D, and E all have corresponding conditional logic rules that award dimension points. Option A has no conditional logic rule and therefore awards zero points to any dimension.

This means any respondent who selects "Data, logic, and clear analysis" — the most obvious Air Weaver answer — receives no archetype points for that question. This systematically under-scores Air Weaver and skews classification away from it.

**Expected fix:** Add a conditional logic rule to Q8 option A awarding Air Weaver +4.

**Action required:** Operator to confirm this is a bug and decide whether to fix the Tally form, fix the native quiz implementation, or leave as-is and document the intentional skew.

---

### Anomaly 3 — Q9 Option A: Duplicate Conditional Logic (Air Weaver +8)

**Affected question:** Q9, option A ("The precision—every movement intentional, nothing wasted.")
**Severity:** Bug — Air Weaver is over-awarded

**What was found:**
The conditional logic for Q9 option A fires twice, awarding Air Weaver +4 on each trigger for a total of +8 when this option is selected. This appears to be a duplicate rule created accidentally during form editing.

The effective impact: any respondent who selects Q9-A has their Air Weaver score inflated by 4 extra points, making Air Weaver classification more likely for this subset of respondents.

**Expected fix:** Remove the duplicate conditional logic rule in Tally so Q9-A awards Air Weaver +4 exactly once.

**Action required:** Operator to confirm this is unintentional and fix the Tally form, or document as-is if the production data is being used for comparison and consistency is needed.

---

### Anomaly 4 — Q9 Option D: All-Dimension Scoring with Shadow Dancer +8

**Affected question:** Q9, option D ("The transformation—watching them become something different than when they started.")
**Severity:** Bug — classification-distorting

**What was found:**
Q9 option D awards points to all four dimensions simultaneously: Air Weaver +4, Embodied Intuitive +4, Ascending Seeker +4, Shadow Dancer +8 (Shadow Dancer fires twice due to a duplicate rule).

This means any respondent selecting Q9-D effectively adds 4 points equally to A, B, and C — and 8 points to D. The net effect on classification is approximately a +4 Shadow Dancer advantage relative to the other dimensions, since the equal additions to A, B, C cancel each other out in comparison logic.

**Possible interpretations:**
1. The intent was to award +4 to all dimensions equally (making it a "neutral" answer), but a duplicate Shadow Dancer rule crept in.
2. The intent was to award +4 to Shadow Dancer only (transformation is a core Shadow Dancer concept), but the rules were incorrectly applied to all dimensions.
3. The intent was to score "transformation" as genuinely multi-dimensional and the double Shadow Dancer is a build error.

**Action required:** Operator to clarify the intended scoring for Q9-D and fix the Tally form accordingly. For the native quiz rebuild, implement the corrected intent rather than replicating the bug.

---

## 8. Architecture Notes

### Two Forms, One Production Form

| Form | ID | Submissions | Status |
|------|----|-------------|--------|
| Production | `aQ5Gg9` | 14 | Active — the canonical source of truth |
| Legacy rebuild | `QK7v5Y` | 2 | Deprecated — approximately 10 questions, significantly shorter |

All data in this document is sourced from form `aQ5Gg9`. The legacy form should not be used as a reference.

### Tally Calculated Fields vs. Classification Logic

The Tally form tracks six calculated fields (one per archetype), but only four of them — the base dimension fields — are actively populated by conditional logic rules. The Flow Artist and Grounded Mystic calculated fields exist in the form schema but receive no direct point additions. They are vestigial from a design iteration or were placeholder fields.

The production classification logic (in `archetypes.py`) correctly handles this by computing combination archetypes from the four base scores, not from independent tracking fields.

### Native Quiz Rebuild Considerations

When rebuilding this quiz in native Astro (replacing the Tally embed), the following decisions need to be made before implementation:

1. **Bug resolution decisions** (see Section 7): Decide whether to replicate the live Tally scoring bugs for consistency with existing 14 submissions, or to implement corrected scoring from the start and accept the discontinuity.
2. **Q5 and Q6 intent**: Confirm shifted scoring is intentional or a build error before encoding it in the new scoring engine.
3. **Q8 option A**: Implement Air Weaver +4 (corrected) or +0 (replicating bug).
4. **Q9 option A**: Implement Air Weaver +4 (corrected) or +8 (replicating bug).
5. **Q9 option D**: Implement operator-decided scoring (see Anomaly 4) rather than replicating the all-dimensions bug.

### Non-Scored Question Handling

All six non-scored questions (Q2, Q3, Q11, Q19, Q20, and effectively Q8-A) should be preserved in the native quiz. Their responses feed:

- **Segmentation tagging** (Q2 experience level, Q3 pain points, Q11 flow state type)
- **Product research** (Q19 card back preference, Q20 desired learning format)
- **Kickstarter strategy** (Q20 especially informs stretch goals and post-launch offers)

These should be captured and stored alongside archetype results, not discarded.

### Existing Codebase References

| File | Status | Purpose |
|------|--------|---------|
| `archetypes.py` | Verified, complete | Classification logic — ready to port to TypeScript |
| `field_map.py` | Placeholder stubs only | Tally field UUIDs were never populated — not needed for native rebuild |
| `app.py` | Complete | Flask webhook receiver — architecture reference only, will not be used in Astro implementation |
