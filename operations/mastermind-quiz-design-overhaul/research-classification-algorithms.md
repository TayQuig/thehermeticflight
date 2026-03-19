# Research: Classification Algorithms for Personality Quizzes

## Current Implementation: Priority Cascade

The Hermetic Flight currently uses a priority-cascade classifier (see `/src/lib/classifier.ts`):

```
1. grounded_mystic:    A > B AND A > C AND D > B AND D > C
2. flow_artist:        B > A AND B > D AND C > A AND C > D
3. air_weaver:         A >= B AND A >= C AND A >= D
4. embodied_intuitive: B >= A AND B >= C AND B >= D
5. shadow_dancer:      D >= A AND D >= B AND D >= C
6. ascending_seeker:   fallback (everything else)
```

### Problems with Priority Cascade

1. **Ascending Seeker is the catch-all junk drawer** -- it gets ALL unclassifiable score patterns. Dimension C (openness/receptivity) never gets a clean match path because every C-dominant score falls through to the fallback.

2. **Flow Artist requires BOTH B AND C to strictly dominate A AND D** -- this is an extremely narrow gate. With 15 questions at +4 each (max 60 points), B and C each need to independently exceed both A and D. This is nearly impossible unless the user answers almost exclusively B and C.

3. **Grounded Mystic has the same problem** -- requires both A AND D to strictly dominate both B AND C. Another dual-dimension gate that's nearly unreachable.

4. **Flat scoring** -- every answer is worth exactly +4 points, with no variable weighting. This means every question contributes equally to classification, even though some questions may be more discriminating than others.

5. **No tie-breaking logic** -- ties fall through the cascade, typically landing in ascending_seeker.

## Alternative Approaches

### 1. Distance-Based Classification (Nearest Archetype)

**How it works**: Define each archetype as a "centroid" vector in 4D space. Compute the distance between the user's score vector and each centroid. Assign the nearest archetype.

**Archetype centroid example** (conceptual, would need tuning):
```
air_weaver:          [1.0, 0.2, 0.2, 0.2]  -- A dominant
embodied_intuitive:  [0.2, 1.0, 0.2, 0.2]  -- B dominant
ascending_seeker:    [0.2, 0.2, 1.0, 0.2]  -- C dominant
shadow_dancer:       [0.2, 0.2, 0.2, 1.0]  -- D dominant
flow_artist:         [0.2, 0.7, 0.7, 0.2]  -- B+C blend
grounded_mystic:     [0.7, 0.2, 0.2, 0.7]  -- A+D blend
```

**Distance metrics**:
- **Euclidean distance**: sqrt(sum((user_i - centroid_i)^2)) -- straightforward, treats all dimensions equally
- **Cosine similarity**: measures angle between vectors -- better when absolute scores vary but relative proportions matter
  - Source: https://builtin.com/machine-learning/cosine-similarity
  - "Cosine similarity is beneficial because even if two similar data objects are far apart by Euclidean distance, they could still have a smaller angle between them."

**The SWCPQ (Statistical "Which Character" Quiz)** uses cosine similarity:
- Score conversion: correlation (-1 to 1) -> (0 to 100) via `(r + 1) * 50`
- 400-dimensional character vectors from crowdsourced trait ratings
- Source: https://openpsychometrics.org/tests/characters/documentation/

**Advantages**: Every archetype has an equal chance of being assigned. No fallback needed. Composite types emerge naturally from proximity to multiple centroids.

**Implementation complexity**: Low. Normalize user scores to [0,1] range, compute Euclidean distance to 6 centroids, pick minimum.

### 2. Fuzzy Membership (Soft Classification)

**How it works**: Instead of assigning ONE archetype, compute a membership degree (0.0-1.0) for each archetype. The primary archetype is the highest membership, but secondary/tertiary archetypes are also surfaced.

**Fuzzy C-Means (FCM)** applied to personality:
- "Each data point can belong to more than one cluster"
- "Membership values range from 0 to 1 indicating the degree to which a data point belongs to a cluster"
- Source: https://en.wikipedia.org/wiki/Fuzzy_clustering

**Research application**: "ANALYSIS OF FUZZY C-MEANS IN PERSONALITY CLUSTERING BASED ON THE OCEAN MODEL" -- FCM used to classify students' personalities across Big Five traits with adequate accuracy.
- Source: https://www.researchgate.net/publication/387477075_ANALYSIS_OF_FUZZY_C-MEANS_IN_PERSONALITY_CLUSTERING_BASED_ON_THE_OCEAN_MODEL

**For THF**: Instead of "You are an Air Weaver," show "You are 72% Air Weaver, 18% Grounded Mystic, 10% Shadow Dancer." This:
- Eliminates the fallback problem (everyone gets percentages)
- Makes near-ties feel accurate instead of arbitrary
- Enables richer result pages and email content
- Aligns with how Big Five instruments present results (continuous spectrums)

**Implementation**: Compute inverse-distance membership: `membership_i = (1/distance_i) / sum(1/distance_j for all j)`. This gives a probability distribution over archetypes that always sums to 1.0.

### 3. Variable Weighting (Enhancement to Any Approach)

**Current state**: Every answer is worth +4 points. No differentiation.

**Psychometric perspective**: "Unit weights for selected items and dichotomous scoring serve almost as effectively as more complicated scoring."
- Source: https://journals.sagepub.com/doi/10.1177/001316447003000102

However, this applies to validated instruments with many items. For a SHORT quiz (7-10 questions), variable weighting becomes more important because each question carries more relative weight.

**Platform recommendation** (Riddle): "Points range from 100 to -100 for each response option. If certain answers strongly represent one category, giving them more points can differentiate close results."
- Source: https://www.riddle.com/help/content-creation/personality-quiz/scoring

**Recommended approach for THF**:
- **High-discrimination questions** (scenario-based, forced tradeoffs): +6 or +8 points
- **Standard preference questions**: +4 points (current default)
- **Dual-scoring hybrid answers** (Q7-E, Q8-E type): +4 to each dimension (current)
- This creates natural hierarchy: scenario questions matter more, preference questions provide supporting signal

### 4. Tie-Breaking Strategies

When two or more archetypes have equal scores:

**Platform defaults**:
- Typeform: "Route to the ending closest to the top of the list" (arbitrary hierarchy)
- Interact: Recommend adjusting point values or adding questions
- Source: https://community.typeform.com/build-your-typeform-7/personality-quiz-how-to-fix-a-tie-in-results-4434
- Source: https://help.tryinteract.com/en/articles/9971974-how-to-set-up-personality-quiz-logic-scoring

**Better approaches**:
1. **Distance-based classification eliminates exact ties** -- floating-point distances will almost never be exactly equal
2. **If using distance, use a confidence threshold**: if the closest two centroids are within X% distance, show a "composite type" result
3. **The SWCPQ approach**: Show ranked results with percentages, making ties visible and meaningful rather than hidden

## Recommendation for The Hermetic Flight

### Primary: Distance-Based with Fuzzy Membership

Replace the priority cascade with:

1. **Normalize** user scores to [0,1] range: `normalized_i = score_i / max_possible_score_i`
2. **Define 6 archetype centroids** in normalized 4D space (tunable constants)
3. **Compute Euclidean distance** from user vector to each centroid
4. **Compute fuzzy membership** via inverse-distance: `m_i = (1/d_i) / sum(1/d_j)`
5. **Primary archetype** = highest membership
6. **Secondary archetype** = second highest (if above threshold, e.g., 15%)
7. **Display**: "You are primarily an Air Weaver (72%) with Grounded Mystic tendencies (18%)"

### Benefits
- Ascending Seeker becomes a real archetype (C-dominant centroid), not a fallback
- Flow Artist and Grounded Mystic become reachable through centroid proximity
- Near-ties produce meaningful composite results
- The algorithm is transparent, debuggable, and tunable
- Variable weighting integrates naturally (just changes the input vector magnitudes)

### Archetype Centroid Definitions (Draft)

These would need operator tuning, but the initial definitions should be:

| Archetype | A (Logic) | B (Body) | C (Flow) | D (Depth) |
|---|---|---|---|---|
| Air Weaver | 0.9 | 0.15 | 0.15 | 0.15 |
| Embodied Intuitive | 0.15 | 0.9 | 0.15 | 0.15 |
| Ascending Seeker | 0.15 | 0.15 | 0.9 | 0.15 |
| Shadow Dancer | 0.15 | 0.15 | 0.15 | 0.9 |
| Flow Artist | 0.15 | 0.65 | 0.65 | 0.15 |
| Grounded Mystic | 0.65 | 0.15 | 0.15 | 0.65 |

Centroids for blended types (Flow Artist, Grounded Mystic) have moderate values on their two dimensions rather than extreme values, making them reachable by users with moderate dual-dimension scores.
