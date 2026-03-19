# Round 2 -- Designer Response

## Position Statement

After reading all Round 1 contributions and studying the codebase in detail, I am revising my architecture in three specific ways. The Daydreamer's forced-choice paired comparisons (Direction 2) and the Researcher's distance-based centroids both simplify the system in ways my Round 1 proposal did not. I am adopting parts of each and rejecting parts of each. This response explains every structural decision and produces a unified spec the Builder can implement against.

---

## Directive 1: Architectural Evaluation of Forced-Choice Paired Comparisons

### The Structural Argument

My Round 1 proposed 4 question formats (single-select, forced-rank, scenario-react, spectrum) to solve homogeneity (Flaw 1). The Builder flagged forced-rank and spectrum as HIGH complexity. The Devil's Advocate warned about scope creep. They were both right. Four formats means four renderers, four scoring paths, four sets of interaction logic, and four accessibility implementations. This was over-designed.

The Daydreamer's paired comparisons collapse all of that into a single format that solves the same problem. Here is why it works structurally:

**One format, natural variety.** Every question presents two statements from different dimensions. The variety comes from which dimensions are paired and how the scenario is framed, not from different UI mechanics. This is composition through content, not through code. The renderer is identical for every question: two buttons, pick one.

**Ipsative scoring eliminates the transparency problem.** In the current quiz, every question maps 1:1 to dimensions. Users see through this after 3-4 questions. In paired comparisons, each choice is a tradeoff. You cannot pick "the logical one" 12 times in a row because you are always choosing between two different dimensions. This solves Flaw 1 and Flaw 10 simultaneously -- answer order becomes trivial (two options, not four), and the dimension mapping is hidden by the tradeoff structure.

**The scoring math is sound but needs one correction.** The Daydreamer proposed: winner gets +3, loser gets +0, 12 questions, 6 unique pairs, 2 questions per pair. Each dimension appears in 6 questions, max 18 per dimension, 36 total points distributed. I verified this:

- 6 unique pairs from 4 dimensions: C(4,2) = 6. Confirmed: A-B, A-C, A-D, B-C, B-D, C-D.
- 2 questions per pair = 12 questions total. Confirmed.
- Each dimension appears in 3 pairs (paired with each of the other 3), 2 questions per pair = 6 appearances. Confirmed.
- Max per dimension: 6 wins x 3 = 18. Confirmed.
- Total distributed: 12 questions x 3 points = 36. Confirmed.

**The correction:** The Daydreamer used +3/+0 scoring. I propose +4/+0 instead, for two reasons:
1. Backward compatibility: the existing `ScoringWeight` infrastructure uses integer points, and `+4` is the current standard. Keeping the same magnitude simplifies test migration -- `computeScores()` continues to work identically, just summing different weights.
2. Score range: +4 per question gives max 24 per dimension (6 appearances x 4 points), total 48 distributed. This gives the classifier better separation than max 18/36. With only 12 questions, every point of separation matters.

Wait -- that arithmetic needs checking. 12 questions, each awarding +4 to exactly one dimension. 12 x 4 = 48 total points. Each dimension appears in 6 questions. If a user wins all 6 appearances for dimension A, they get 24 for A and 0 from those 6 questions for the paired dimensions. But the remaining 6 questions do not involve A, so A stays at 24. The other 24 points are distributed among B, C, D via the remaining 6 questions. Max per dimension = 24. Total = 48. The math holds.

### How This Changes the Component Design

#### quiz-data.ts -- Simplified, Not More Complex

My Round 1 proposed adding `QuestionFormat` (4 types) and `phase` fields. With paired comparisons, the format field collapses to a single type. The `phase` field remains useful for separating scored vs. segmentation questions.

```typescript
// Revised type model for paired-comparison quiz

export type Dimension = 'A' | 'B' | 'C' | 'D';

export interface ScoringWeight {
  dimension: Dimension;
  points: number;   // +4 for the winner of a pair
}

export interface PairedAnswer {
  id: string;
  text: string;
  scoring: ScoringWeight[];  // exactly one entry: [{dimension, points: 4}]
}

export interface Question {
  id: string;
  number: number;
  text: string;           // scenario framing: "When facing uncertainty, I tend to..."
  pair: [Dimension, Dimension];  // which two dimensions this question tests
  answers: [PairedAnswer, PairedAnswer];  // exactly 2 answers, one per dimension
  phase: 'scored' | 'segmentation';
}
```

Key structural differences from Round 1:
- `answers` is a fixed-length tuple of 2, not a variable-length array of 4-5. This is a stronger type contract.
- `pair` explicitly declares which dimensions are being tested. This is metadata for the classifier and for distribution analysis tooling.
- No `format` field. Every scored question has the same format. The segmentation questions (experience level, pain point) use a separate rendering path but they are not scored, so format polymorphism in the scoring layer is unnecessary.
- No `scored: boolean`. Replaced by `phase: 'scored' | 'segmentation'`, which is more informative.

The 5 non-scored questions (Q2, Q3, Q11, Q19, Q20) are handled as follows, resolving Flaw 4:
- Q2 (experience level): Retained as segmentation, moved to a distinct pre-quiz phase.
- Q3 (pain point): Retained as segmentation, moved to the same pre-quiz phase.
- Q11 (flow state): Cut. Its dimension-language overlap with scored questions adds noise, not signal.
- Q19 (card back preference): Moved to post-results. This is product research, not quiz content.
- Q20 (desired learning format): Moved to post-results alongside Q19.

This gives: 2 segmentation (pre-quiz) + 12 scored (paired comparisons) + 2 product research (post-results) = 16 data entries in `quiz-data.ts`, but only 12 in the scored quiz flow. The user perceives 14 questions (2 warmup + 12 quiz). The progress bar shows "N of 12" during the scored section.

#### classifier.ts -- This Is Where Centroids Enter

More on this in Directive 2 below. The key point: paired-comparison scoring feeds directly into the same `DimensionScores` object. `computeScores()` does not need to know whether the questions were paired comparisons or single-select -- it sums the `scoring` weights from whatever answers were given. The classification algorithm operates on the resulting `{A, B, C, D}` totals, completely decoupled from question format.

#### quiz-engine.ts -- State Machine Simplifies

My Round 1 proposed a 6-phase state machine. The paired-comparison format simplifies this because there is only one question type to sequence. The phases remain:

```
intro -> segmentation (2 Qs) -> scored-questions (12 paired Qs) -> email-gate -> calculating -> results
```

But the engine internals simplify:
- No format-dispatching logic. Every scored question renders the same way.
- `getShuffledAnswers()` becomes trivial: 2 options, coin-flip shuffle (swap or don't). Seeded PRNG still used for reproducibility.
- Auto-advance timing is uniform: 800ms for all scored questions (they are all the same format, so the same timing works).
- No forced-rank interaction state, no spectrum slider position, no ranking drag-and-drop state. The state machine tracks only `{questionIndex, answers, email, phase}`.

#### quiz.astro -- The Builder's Concern Is Resolved

The Builder flagged forced-rank and spectrum as HIGH complexity UI work. Paired comparisons require exactly one renderer:

```html
<!-- Paired comparison question renderer -->
<section class="quiz-step" data-step={i}>
  <div class="glass-panel p-6 md:p-8 rounded-lg">
    <p class="question-label">{q.text}</p>
    <div class="flex flex-col gap-4 mt-6">
      <button class="pair-btn" data-question={q.id} data-answer={q.answers[0].id}>
        {q.answers[0].text}
      </button>
      <button class="pair-btn" data-question={q.id} data-answer={q.answers[1].id}>
        {q.answers[1].text}
      </button>
    </div>
  </div>
</section>
```

This is simpler than the current 4-option renderer. Two large buttons, pick one. No scroll needed. No 5th "both/and" option to style differently. Touch targets are naturally larger. Mobile-friendly by default.

The visual separation between options can use a centered "or" divider for dramatic effect:

```html
<button class="pair-btn">...</button>
<div class="text-center text-hermetic-gold/30 text-xs tracking-widest uppercase">or</div>
<button class="pair-btn">...</button>
```

#### quiz-submit.ts -- Minor Changes

The API continues to receive `{ email, firstName, answers, website }`. The `answers` record now contains 12 scored entries + 2 segmentation entries instead of 20 mixed entries. The validation logic (built from `questions` at module load) auto-adapts because it reads the question array dynamically. The `scoredQuestionIds` set shrinks from 15 to 12. The `validQuestionIds` set shrinks from 20 to 16 (including segmentation and product research questions if they are submitted).

The segmentation data extraction needs updating:
```typescript
// Before: resolveAnswerText('Q2', ...) resolveAnswerText('Q3', ...)
// After: same pattern, different question IDs (e.g., 'SEG1', 'SEG2')
```

The `quizVersion: 'v2'` field from my Round 1 proposal remains necessary for distinguishing v1 and v2 submissions in Loops.so, per the Devil's Advocate's RISK-03.

### What Paired Comparisons Do NOT Solve

Two things paired comparisons leave unresolved:

1. **Composite detection mechanics.** The Daydreamer claimed composites "emerge naturally from pair patterns." This is partially true: if someone consistently picks A over B and A over C, but also picks D over B and D over C, the score will be A-heavy and D-heavy, which looks like Grounded Mystic. But "emergence" is not the same as "reliable classification." The classifier still needs explicit rules for when to assign a composite vs. a primary. This is Directive 2's territory.

2. **The "both/and" loss.** The current quiz has Q7-E ("Both structure AND room for mystery -- I need the framework AND the freedom") and Q8-E ("I need both the practical AND the mystical -- one without the other feels incomplete"). These are the dual-scoring Grounded Mystic detectors. In a forced-choice format, "both" is not an option. The Daydreamer acknowledged this: "there is no 'I'm both' in a forced choice -- by design." The pair A-D handles this: two questions pit A against D directly. A user who alternates (picks A in one, D in the other) signals composite identity. But this is weaker signal than the explicit dual-scorer. The classifier must compensate (see Directive 2).

### Verdict on Paired Comparisons

**Adopted.** The format change simplifies every component: fewer types in the data model, one renderer instead of four, uniform auto-advance timing, trivial shuffling. It solves Flaws 1 (homogeneity), 5 (length -- 12 is in the sweet spot), 7 (variable weighting -- ipsative scoring IS variable weighting, since choosing A means not-choosing B), and 10 (answer order -- 2 options, coin-flip shuffle).

The tradeoff is losing explicit dual-scoring detectors (Q7-E, Q8-E). I accept this tradeoff because the classifier redesign (Directive 2) compensates.

---

## Directive 2: Reconciling Percentage Thresholds with Distance-Based Centroids

### My Round 1 Position

I proposed percentage-based thresholds:
```
grounded_mystic:    A >= 30% AND D >= 25% AND (A+D) >= 60%
flow_artist:        B >= 30% AND C >= 25% AND (B+C) >= 60%
air_weaver:         A is strictly highest
...
ascending_seeker:   C is strictly highest  <-- positive condition
```

### The Researcher's Position

Distance-based classification with centroids:
```
air_weaver:          [0.9, 0.15, 0.15, 0.15]
flow_artist:         [0.15, 0.65, 0.65, 0.15]
grounded_mystic:     [0.65, 0.15, 0.15, 0.65]
...
```
Classify by minimum Euclidean distance to nearest centroid. Compute fuzzy membership via inverse-distance.

### Architectural Comparison

| Criterion | Percentage Thresholds | Distance-Based Centroids |
|-----------|----------------------|--------------------------|
| Lines of code | ~40 (conditional chain) | ~30 (normalize + 6 distances + min) |
| Tunable parameters | 6-8 threshold values | 24 centroid coordinates (6 archetypes x 4 dimensions) |
| Testability | Test each threshold boundary (combinatorial explosion) | Test centroid geometry (6 centroids + edge cases between them) |
| Composite handling | Explicit composite rules (special cases) | Composites are just centroids in 4D space (uniform) |
| Ascending Seeker fix | Add a positive condition (C-dominant) | Ascending Seeker has its own centroid [0.15, 0.15, 0.9, 0.15] |
| Tie handling | Explicit tie-breaking rules (A=D -> GM, B=C -> FA, etc.) | Geometric -- ties are rare in Euclidean space, and when they occur the centroid positions determine the winner |
| Extensibility | Adding an archetype requires new threshold rules and rebalancing all existing ones | Adding an archetype requires adding one centroid vector |
| Debuggability | "You got Air Weaver because A=35% which exceeds the 30% threshold" | "You got Air Weaver because your distance to Air Weaver centroid was 0.23, vs. 0.41 to Grounded Mystic" |
| Backward compat risk | Different algorithm, different thresholds = different results for same inputs | Different algorithm = different results for same inputs |

### Decision: Distance-Based Centroids

I am dropping my percentage-based proposal in favor of distance-based classification. The reasons are structural, not cosmetic:

1. **Uniform treatment of all 6 archetypes.** In my threshold approach, composites (GM, FA) are special-cased with different rule structures than primaries (AW, EI, SD, AS). In the centroid approach, every archetype is a point in 4D space. The classifier does not know or care which are "primary" and which are "composite." This is architecturally cleaner.

2. **The tuning surface is more intuitive.** Percentage thresholds require understanding conditional logic interactions. Centroid positions can be visualized: "move the Grounded Mystic centroid closer to the Air Weaver centroid if too many A-dominant profiles are getting GM." The operator can reason about the 4D space with a simple radar chart.

3. **It eliminates the fallback problem completely.** There is no fallback in distance-based classification. Every point in 4D space is nearest to exactly one centroid (barring the measure-zero case of exact equidistance). Ascending Seeker stops being a junk drawer because it has its own centroid that attracts C-dominant profiles explicitly.

4. **It naturally produces the `confidence` and `secondary` fields I proposed in Round 1.** The `ClassificationResult` interface from my Round 1 proposal included `confidence: number` and `secondary: ArchetypeSlug`. With centroids, these are trivial to compute:
   - `confidence` = 1 - (distance_to_primary / distance_to_secondary). When primary and secondary are far apart, confidence approaches 1. When they are nearly equidistant, confidence approaches 0.
   - `secondary` = the archetype with the second-smallest distance.

### Unified Classification Interface

The Moderator asked whether I can propose an interface that works for either approach so the choice can be deferred or A/B tested. Yes. Here is the interface that decouples the classification algorithm from its consumers:

```typescript
// --- src/lib/classifier.ts ---

export type ArchetypeSlug =
  | 'air_weaver'
  | 'embodied_intuitive'
  | 'ascending_seeker'
  | 'shadow_dancer'
  | 'flow_artist'
  | 'grounded_mystic';

export interface DimensionScores {
  A: number;
  B: number;
  C: number;
  D: number;
}

export interface ClassificationResult {
  primary: ArchetypeSlug;
  secondary: ArchetypeSlug;
  confidence: number;           // 0-1, how clearly primary separates from secondary
  memberships: Record<ArchetypeSlug, number>;  // fuzzy membership per archetype, sums to 1.0
  scores: DimensionScores;      // raw dimension scores (for display, debugging)
}

// The public interface. Consumers call this. Implementation can be swapped.
export function classify(scores: DimensionScores): ClassificationResult;

// Score computation. Unchanged from current code.
export function computeScores(
  answers: Record<string, string>,
  questions: Question[]
): DimensionScores;
```

The key design decision: `classify()` returns `ClassificationResult`, not `ArchetypeSlug`. All consumers extract what they need:

- `quiz.astro`: uses `result.primary` for the reveal, `result.secondary` for "with X tendencies" copy, `result.confidence` to decide whether to show composite messaging.
- `quiz-submit.ts`: sends `result.primary` as `archetype` to Loops.so. Sends `result.memberships` as event properties for analytics.
- `archetype-content.ts`: keyed by `ArchetypeSlug`, unchanged.
- `result/[archetype].astro`: keyed by URL slug, unchanged.

**Backward compatibility:** The current `classify()` returns `ArchetypeSlug`. Consumers that call `classify(scores)` and expect a string will break. Migration path: add a `classifyLegacy()` wrapper during transition.

```typescript
export function classifyLegacy(scores: DimensionScores): ArchetypeSlug {
  return classify(scores).primary;
}
```

But this is a migration shim, not a permanent API. The Builder should update all callers to use the full `ClassificationResult` in the same PR that changes the classifier.

### A/B Testing the Algorithm

The interface above supports A/B testing because the implementation behind `classify()` can be swapped at import time. Two implementation files:

```
src/lib/classifiers/cascade.ts   -- current priority-cascade (v1)
src/lib/classifiers/centroid.ts  -- distance-based centroids (v2)
```

Both export the same `classify(scores: DimensionScores): ClassificationResult` signature. The main `classifier.ts` re-exports one or the other based on a feature flag or environment variable. In practice, I do not recommend actually A/B testing -- the centroid approach is strictly superior for this use case. But the interface permits it without structural changes.

### Centroid Definitions

The Researcher proposed these centroids:

```
air_weaver:          [0.9,  0.15, 0.15, 0.15]
embodied_intuitive:  [0.15, 0.9,  0.15, 0.15]
ascending_seeker:    [0.15, 0.15, 0.9,  0.15]
shadow_dancer:       [0.15, 0.15, 0.15, 0.9 ]
flow_artist:         [0.15, 0.65, 0.65, 0.15]
grounded_mystic:     [0.65, 0.15, 0.15, 0.65]
```

I accept these as the starting point with one structural note: the centroid values are tunable constants, not code. They should be defined as a typed constant object at the top of the classifier module, clearly separated from the algorithm:

```typescript
// Archetype centroids in normalized 4D space [A, B, C, D].
// These define the "ideal" score profile for each archetype.
// Tunable: adjust positions to shift classification boundaries.
export const CENTROIDS: Record<ArchetypeSlug, [number, number, number, number]> = {
  air_weaver:          [0.90, 0.15, 0.15, 0.15],
  embodied_intuitive:  [0.15, 0.90, 0.15, 0.15],
  ascending_seeker:    [0.15, 0.15, 0.90, 0.15],
  shadow_dancer:       [0.15, 0.15, 0.15, 0.90],
  flow_artist:         [0.15, 0.65, 0.65, 0.15],
  grounded_mystic:     [0.65, 0.15, 0.15, 0.65],
};
```

The algorithm normalizes the user's raw `DimensionScores` to [0,1] (by dividing each by the max possible for that dimension, which in paired-comparison scoring is 24), then computes Euclidean distance to each centroid. This is ~15 lines of implementation code.

### Normalization

With paired comparisons: each dimension appears in 6 questions, max +4 per question, so max per dimension = 24. Normalize by dividing by 24.

But there is a subtlety. In ipsative scoring, the total is always 48 (12 questions x 4 points). If A = 24, then B + C + D = 24. The scores are not independent -- they are constrained. This means the normalized vector is always on a hyperplane where A + B + C + D = 48/24 = 2.0 (in normalized space). The centroids should lie on or near this hyperplane for distance calculations to be meaningful.

Check the primary centroids: 0.9 + 0.15 + 0.15 + 0.15 = 1.35. The composite centroids: 0.65 + 0.15 + 0.15 + 0.65 = 1.60. These do not sum to 2.0, which means the centroids are not on the ipsative constraint hyperplane.

**This is a design problem that needs solving.** Two options:

**Option A: Adjust centroids to respect the ipsative constraint.** For primary archetypes, if A is high, the other three must be low. If total = 2.0:
```
air_weaver:   [0.80, 0.40, 0.40, 0.40]  -- sums to 2.0
```
But 0.40 is too high for the non-dominant dimensions. A user scoring [0.80, 0.40, 0.40, 0.40] would be equidistant from Air Weaver, Embodied Intuitive, and Ascending Seeker centroids.

**Option B: Use cosine similarity instead of Euclidean distance.** Cosine similarity measures the angle between vectors, ignoring magnitude. This makes the ipsative constraint irrelevant because cosine similarity cares about the direction of the vector (the relative proportions), not its length. The Researcher's own research artifact notes: "Cosine similarity is beneficial because even if two similar data objects are far apart by Euclidean distance, they could still have a smaller angle between them."

**Decision: Cosine similarity.** It is the right metric for ipsative data. The SWCPQ (the Researcher's cited precedent) also uses cosine similarity. The implementation difference from Euclidean distance is negligible:

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

Higher cosine similarity = more similar. So `primary = argmax(cosineSimilarity(user, centroid))` rather than `argmin(euclideanDistance(user, centroid))`.

The centroids' absolute magnitudes no longer matter -- only their relative proportions. So the Researcher's original centroids work correctly with cosine similarity without adjustment.

### How This Solves the Paired-Comparison Composite Gap

I noted above that paired comparisons lose the explicit "both/and" dual-scoring answers (Q7-E, Q8-E). With cosine-distance centroids, this does not matter. A user who wins 3 of their 6 A-questions and 3 of their 6 D-questions ends up with a score profile like [12, 6, 6, 12] or similar. This profile's cosine similarity to Grounded Mystic [0.65, 0.15, 0.15, 0.65] is high because the angle between [12, 6, 6, 12] and [0.65, 0.15, 0.15, 0.65] is small. The centroid does the composite detection work that the dual-scoring answers used to do.

The key insight: **dual-scoring detectors were a workaround for a priority-cascade classifier that could not detect composites natively. Distance-based classification detects composites natively. The workaround is no longer needed.**

---

## Directive 3: Format Complexity and the Builder's Concern

The Builder flagged forced-rank and spectrum as HIGH complexity and proposed deferring to v2. I agree. Here is the definitive complexity comparison:

### My Round 1 Proposal: 4 Formats

| Format | Renderer | Interaction | Scoring | A11y | Total Effort |
|--------|----------|-------------|---------|------|--------------|
| single-select | Button list (existing) | Click/tap | Map answer to dimension | Good | LOW |
| forced-rank | Drag-and-drop + numbered slots | Drag, reorder, or click-to-rank | Rank 1 = +6, Rank 2 = +3 | Poor (drag-and-drop) | HIGH |
| scenario-react | Button list (same as single-select) | Click/tap | Map answer to dimension | Good | LOW |
| spectrum | Horizontal slider + endpoint labels | Drag slider | Interpolate between two values | Fair (slider a11y) | HIGH |

Two LOW, two HIGH. The Builder was right: forced-rank and spectrum each add ~2 days of implementation and accessibility testing. For two questions each, that is a poor effort-to-value ratio.

### Paired Comparisons: 1 Format

| Format | Renderer | Interaction | Scoring | A11y | Total Effort |
|--------|----------|-------------|---------|------|--------------|
| paired-choice | Two large buttons with "or" divider | Click/tap | Winner gets +4 | Excellent (two buttons) | LOW |

One format, LOW complexity, excellent accessibility. Every scored question uses the same renderer. The variety comes from which dimensions are paired and how the scenario is framed (content), not from different interaction models (code).

### Verdict

Paired comparisons do not just simplify the UI layer compared to my 4-format proposal -- they simplify it compared to the CURRENT implementation. The current quiz has 4-5 answer buttons per question, with dual-scoring "both/and" options on Q7 and Q8 that have different styling. The paired-comparison renderer has exactly 2 buttons. Fewer DOM nodes, fewer event listeners, simpler layout, better touch targets on mobile.

The Builder's concern about format complexity is fully resolved. There is nothing to defer to v2.

---

## Revised Complete Architecture

### Component 1: quiz-data.ts (Revised)

**12 paired-comparison scored questions + 2 segmentation questions + 2 product-research questions = 16 entries.**

Data model:
```typescript
export type Dimension = 'A' | 'B' | 'C' | 'D';

export interface ScoringWeight {
  dimension: Dimension;
  points: number;
}

export interface Answer {
  id: string;
  text: string;
  scoring: ScoringWeight[];
}

export interface Question {
  id: string;
  number: number;
  text: string;
  pair: [Dimension, Dimension] | null;  // null for segmentation/product-research
  answers: Answer[];                     // length 2 for scored, variable for segmentation
  phase: 'scored' | 'segmentation' | 'product-research';
}
```

Pair distribution (12 scored questions):
```
A-B: PC01, PC02  (Logic vs. Body)
A-C: PC03, PC04  (Logic vs. Flow)
A-D: PC05, PC06  (Logic vs. Depth)
B-C: PC07, PC08  (Body vs. Flow)
B-D: PC09, PC10  (Body vs. Depth)
C-D: PC11, PC12  (Flow vs. Depth)
```

Question ID convention: `PC{nn}` for paired-comparison scored questions, `SEG{n}` for segmentation, `PR{n}` for product-research. This avoids collision with the current `Q{n}` IDs and makes the quiz version immediately visible in payloads.

**Content authorship:** Per the Devil's Advocate's RISK-01, the question text must be written by the operator with the correct voice. The data model defines structure and scoring; the text strings are content artifacts. The Builder writes the structural code; the operator writes the question copy. These are separate work streams.

### Component 2: classifier.ts (Revised)

```typescript
export const CENTROIDS: Record<ArchetypeSlug, [number, number, number, number]> = {
  air_weaver:          [0.90, 0.15, 0.15, 0.15],
  embodied_intuitive:  [0.15, 0.90, 0.15, 0.15],
  ascending_seeker:    [0.15, 0.15, 0.90, 0.15],
  shadow_dancer:       [0.15, 0.15, 0.15, 0.90],
  flow_artist:         [0.15, 0.65, 0.65, 0.15],
  grounded_mystic:     [0.65, 0.15, 0.15, 0.65],
};

// Algorithm:
// 1. Convert DimensionScores to a 4-vector [A, B, C, D]
// 2. Compute cosine similarity to each centroid
// 3. Primary = highest similarity, secondary = second highest
// 4. Confidence = 1 - (sim_secondary / sim_primary)
//    When primary >> secondary, confidence approaches 1.
//    When primary ~ secondary, confidence approaches 0.
// 5. Memberships = normalize similarities to sum to 1.0

export function classify(scores: DimensionScores): ClassificationResult;
export function computeScores(answers: Record<string, string>, questions: Question[]): DimensionScores;
```

`computeScores()` is unchanged. It sums `scoring[].points` per dimension from the provided answers. The paired-comparison format produces the same `DimensionScores` shape as the current format.

`classify()` returns `ClassificationResult` (defined above in Directive 2). The algorithm is ~25 lines: iterate over centroids, compute cosine similarity, sort, extract primary/secondary/confidence/memberships.

**Backward compatibility shim:**
```typescript
export function classifyLegacy(scores: DimensionScores): ArchetypeSlug {
  return classify(scores).primary;
}
```

### Component 3: quiz-engine.ts (New -- Simplified from Round 1)

```typescript
export type QuizPhase =
  | 'intro'
  | 'segmentation'        // 2 warmup questions
  | 'scored-questions'     // 12 paired-comparison questions
  | 'email-gate'
  | 'calculating'
  | 'results';

export interface QuizState {
  phase: QuizPhase;
  questionIndex: number;
  answers: Record<string, string>;
  email: string | null;
  firstName: string | null;
  startTime: number;
  shuffleOrders: Record<string, [0, 1] | [1, 0]>;  // cached per-question answer order
}

export interface QuizEngine {
  getState(): Readonly<QuizState>;
  getCurrentQuestion(): Question | null;
  getProgress(): { current: number; total: number; percent: number };
  answerQuestion(questionId: string, answerId: string): void;
  goBack(): boolean;
  advance(): QuizPhase;
  submitEmail(email: string, firstName?: string): void;
  getResult(): ClassificationResult | null;
  getShuffledAnswerOrder(questionId: string): [0, 1] | [1, 0];
}

export function createQuizEngine(questions: Question[]): QuizEngine;
```

Changes from Round 1:
- `getShuffledAnswers()` replaced by `getShuffledAnswerOrder()` which returns an index tuple. The UI applies the order when rendering. This avoids copying answer objects.
- `shuffleOrders` in state is typed as `Record<string, [0, 1] | [1, 0]>` -- the only two possible orderings for 2 answers. Generated once per question using seeded PRNG, cached for back-navigation consistency.
- Phase flow: segmentation comes BEFORE scored questions. This puts the easy, non-threatening questions first (warmup), then transitions to the paired comparisons. The Daydreamer suggested this implicitly; the Builder's analysis supports it for completion rate.

### Component 4: quiz.astro (Revised)

Phase rendering:
- **Intro:** Unchanged structure, updated copy ("Twelve questions. Two minutes. One revelation.")
- **Segmentation (2 Qs):** Rendered as a distinct section with different visual treatment. "Tell us about your tarot experience." Standard button-list UI. No progress bar.
- **Scored questions (12 Qs):** Paired-comparison renderer. Two large buttons with "or" divider. Progress bar shows "N of 12." Auto-advance at 800ms.
- **Email gate:** Form with email (required), first name (optional), honeypot. "Your archetype is ready. Enter your email to receive your full reading." Skip link available.
- **Calculating interstitial:** 3-4 second themed animation. Text rotates: "Reading the pattern of your choices..." / "Consulting the four elements..." / "Your archetype emerges..." During this phase, the UI fires POST to `/api/quiz-submit` if email was provided.
- **Results:** Existing staggered reveal animation, updated to show primary archetype, element, description. If confidence < 0.5, show secondary: "with [Secondary] undertones."

### Component 5: quiz-submit.ts (Minor Updates)

- Validation auto-adapts (already reads from `questions` array).
- Request body adds `quizVersion: 'v2'`.
- Segmentation data extraction uses new question IDs: `resolveAnswerText('SEG1', ...)` and `resolveAnswerText('SEG2', ...)`.
- Product-research answers (PR1, PR2) may or may not be submitted (they are post-results, user might leave). Handle gracefully.
- Now receives and forwards `memberships` or `scores` from `ClassificationResult` to Loops.so event properties, enabling archetype-proportion analytics.

---

## Interface Map

```
quiz-data.ts
    |
    | exports: Question[], Dimension, Answer, ScoringWeight
    |
    +---> classifier.ts
    |       |
    |       | imports: Question (for computeScores)
    |       | exports: classify(), computeScores(), ClassificationResult,
    |       |          DimensionScores, ArchetypeSlug, CENTROIDS
    |       |
    |       +---> quiz-engine.ts
    |       |       |
    |       |       | imports: classify, computeScores from classifier
    |       |       | imports: Question from quiz-data
    |       |       | exports: createQuizEngine(), QuizEngine, QuizState, QuizPhase
    |       |       |
    |       |       +---> quiz.astro
    |       |               |
    |       |               | imports: createQuizEngine from quiz-engine
    |       |               | imports: archetypes, toUrlSlug from archetype-content
    |       |               | calls: POST /api/quiz-submit
    |       |               |
    |       +---> quiz-submit.ts
    |               |
    |               | imports: classify, computeScores from classifier
    |               | imports: questions from quiz-data
    |               | calls: Loops.so API
    |
    +---> archetype-content.ts (unchanged)
            |
            | imports: ArchetypeSlug from classifier
            | exports: archetypes, toUrlSlug, archetypeByUrlSlug
```

No circular dependencies. Data flows downward. The engine depends on the classifier; the UI depends on the engine. The API depends on classifier and quiz-data directly (server-side revalidation).

---

## Build Order (Revised)

1. **quiz-data.ts** -- New question data model with pair field, phase field, new IDs. Operator writes question copy in parallel.
2. **classifier.ts** -- Centroid-based classification with cosine similarity. ClassificationResult interface. `classifyLegacy()` shim for transitional callers.
3. **quiz-engine.ts** -- New state machine. Consumes quiz-data and classifier.
4. **quiz.astro** -- Paired-comparison renderer, segmentation phase, email gate, calculating interstitial. Consumes quiz-engine.
5. **quiz-submit.ts** -- Updated validation, new question IDs, quizVersion field.

Test contracts must be written BEFORE implementation for each step (frozen-test-file protocol). The new test contracts:
- `quiz-data.test.ts`: 12 scored questions, all paired (answers.length === 2), pair coverage (each of 6 pairs appears exactly twice), phase field present, no question has more than 2 answers in scored phase.
- `classifier.test.ts`: Cosine similarity produces correct primary for each centroid's ideal vector. All 6 archetypes reachable. Confidence calculation correct. Memberships sum to 1.0. Edge cases: all-equal scores, single-dimension-dominant, exact composite split.
- `quiz-engine.test.ts`: Phase transitions, answer recording, shuffle determinism, progress calculation, back navigation preserves shuffle order.
- `archetype-distribution.test.ts`: Monte Carlo simulation -- 10,000 random answer sets, all 6 archetypes appear at > 5%.

---

## Risks Acknowledged from Devil's Advocate

| DA Risk | How This Design Addresses It |
|---------|------------------------------|
| RISK-01 (voice fidelity) | Data model is structure; question text is operator-authored content. Explicitly separated in build order. |
| RISK-02 (email gate cliff) | Skip link retained. Gate shows archetype name + element freely; gates deep description + journey link. Not a hard block. |
| RISK-03 (backward incompat) | `quizVersion: 'v2'` field. Existing Loops.so contacts not re-classified. |
| RISK-04 (segmentation data loss) | Q2 and Q3 retained as SEG1, SEG2. Q19 and Q20 retained as PR1, PR2 (post-results). No data lost. |
| RISK-05 (variable weight burden) | Paired comparisons use uniform +4. No variable-weight optimization problem. Ipsative scoring provides differentiation structurally. |
| RISK-06 (test cascade) | New test contracts written first per FTF protocol. Build order is sequential. |

---

## Open Questions Remaining

1. **Centroid values.** The Researcher's draft centroids are a reasonable starting point. They need validation via the Monte Carlo distribution test before deployment. The Builder should implement the distribution test first, then the operator and Builder can tune centroids together.

2. **Confidence threshold for composite messaging.** When should the result say "You are The Air Weaver" vs. "You are primarily The Air Weaver with Grounded Mystic undertones"? I propose: show secondary when confidence < 0.5 AND secondary membership > 0.20. This is a content decision (how much complexity in the result) that should be tested with real users.

3. **Post-results product research.** Where exactly do PR1 and PR2 appear? Options: (a) on the results screen below the CTA, (b) on the archetype journey page, (c) in the first drip email. This is a UX decision that does not affect the data model.

4. **The Daydreamer's "Balanced Seeker" self-selection.** The Daydreamer proposed that when all dimensions are within a tight band, let the user self-select between their top two. Architecturally, this would be a seventh phase in the engine: `'self-select'`, triggered when `confidence < 0.2`. I am not including it in the v2 spec because it adds a conditional branch in the phase flow that complicates every test. If distribution testing shows that too many users hit the low-confidence zone, add it in v3.

---

## Summary: What Changed from Round 1

| Component | Round 1 | Round 2 | Why |
|-----------|---------|---------|-----|
| Question format | 4 formats (single-select, forced-rank, scenario-react, spectrum) | 1 format (paired comparison) | Builder's complexity concern + Daydreamer's structural argument |
| Question count | 12 total (9 scored + 3 segmentation) | 16 total (12 scored + 2 segmentation + 2 product-research) | 12 paired comparisons cover all 6 dimension pairs x 2 |
| Classifier algorithm | Percentage-based thresholds | Cosine-similarity to centroids | Researcher's argument for uniform archetype treatment |
| Classifier return type | `ClassificationResult` (unchanged) | `ClassificationResult` with added `memberships` field | Centroid approach naturally produces fuzzy membership |
| Scoring | Variable weights (2/4/6) | Uniform +4, ipsative (winner takes all per question) | Ipsative scoring provides differentiation structurally; eliminates RISK-05 |
| Dual-scoring detectors | Retained as part of the question pool | Eliminated | Centroid-based classification handles composites natively |
| UI complexity | 4 renderers | 1 renderer (2 buttons) | Strictly simpler than even the current implementation |
| Distance metric | N/A | Cosine similarity (not Euclidean) | Ipsative constraint means scores are not independent; cosine handles this correctly |
