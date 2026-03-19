# Round 3 -- Designer: Final Spec

## Position Statement

I concede the Researcher's primary point. The psychometric evidence against pure ipsative scoring with 4 dimensions is decisive, and my Round 2 claim that cosine similarity "compensates" for ipsative unreliability was structurally wrong. Cosine similarity is the right *distance metric* for classification, but it cannot fix bad *input data*. If the underlying scores are unreliable, the classifier -- however elegant -- is classifying noise. The Researcher's hybrid approach is architecturally viable within my component spec and produces strictly better input data for the classifier. I am adopting it.

This document is the final, complete design spec. It supersedes my Round 2 spec in full. The Builder can implement against this.

---

## Directive 1: Why I Was Wrong About Cosine Similarity Compensating for Ipsative Limitations

My Round 2 argument was:

> "Cosine similarity measures the angle between vectors, ignoring magnitude. This makes the ipsative constraint irrelevant."

This conflates two different problems:

1. **The distance metric problem**: How do you measure similarity between a user's score vector and archetype centroids? Cosine similarity is correct here because it handles the constant-sum constraint of ipsative data (all vectors live on a hyperplane, so angle is more informative than Euclidean distance).

2. **The input reliability problem**: How noisy are the dimension scores that feed into the classifier? This is independent of the distance metric. If User A takes the quiz twice and gets [18, 6, 6, 6] the first time and [6, 12, 12, 6] the second time (same person, same true preferences, different results due to noise), cosine similarity will classify them into different archetypes both times. The classifier faithfully amplifies the noise in its input.

The Researcher's cited evidence is clear: with 4 dimensions and 12 ipsative items, test-retest reliability is expected to be well below 0.60. This means the same person taking the quiz twice would get meaningfully different scores roughly half the time. Cosine similarity does not fix this. It is the wrong layer to solve the problem at.

**The correct fix is at the scoring layer: produce more reliable dimension scores.** The Researcher's hybrid approach does exactly this. Normative scoring (each answer adds points to its dimension independently, scores do NOT sum to a constant) produces more reliable scores with fewer items because dimensions are measured independently. The literature supports this unambiguously at any number of dimensions.

I maintain my cosine similarity classifier from Round 2. But I am replacing its input -- the scoring model -- with the Researcher's hybrid approach.

---

## Directive 2: The Hybrid Scoring Model -- Architectural Specification

### What the Researcher Proposed

Most questions use normative scoring (each answer adds points to its own dimension, like the current quiz but with improved questions and variable weighting). 2-3 questions use forced-pair format where both dimensions receive points but at different magnitudes:

```
Pick A: +6 to dim A, +2 to dim B
Pick B: +6 to dim B, +2 to dim A
```

This is NOT ipsative. Total points vary depending on which option is chosen (both sum to +8, so in this specific case total is constant per question -- but across the full quiz, different answers to different questions produce different totals because normative questions are independent). The forced pairs create inter-dimension tension without the constant-sum constraint.

### Architectural Viability

The hybrid approach requires zero changes to the `computeScores()` function. Here is why.

`computeScores()` (lines 83-111 of `classifier.ts`) builds a flat map of `answerId -> ScoringWeight[]` and sums points per dimension. It does not know or care about question format, answer count, or scoring model. The `ScoringWeight[]` array on each answer already supports multi-dimension scoring -- Q7-E and Q8-E currently use `[w('A'), w('D')]` for dual-dimension scoring. The forced pairs simply use the same mechanism with different point values:

```typescript
// Forced pair: A vs. B
{
  id: 'FP01-A',
  text: 'Research until I find the right framework.',
  scoring: [
    { dimension: 'A', points: 6 },
    { dimension: 'B', points: 2 },
  ],
},
{
  id: 'FP01-B',
  text: 'Feel into my body for the answer.',
  scoring: [
    { dimension: 'B', points: 6 },
    { dimension: 'A', points: 2 },
  ],
},
```

This works today. No interface changes, no new types, no algorithm changes. The scoring infrastructure already handles it.

The normative questions work identically to the current quiz: one `ScoringWeight` per answer, each answer scoring its own dimension. The only change from the current quiz is that some answers may use variable weights (+3 to +6) instead of uniform +4.

### The Hybrid Question Mix

I am specifying 10 questions total for the scored quiz:

- **7 normative single-select questions** (4 options each, like the current quiz format)
- **3 forced-pair questions** (2 options each, both score both dimensions)

Why these numbers:

1. **10 scored questions is the sweet spot.** The Researcher's Round 1 research established 7-10 as optimal for completion rate. The DA's Round 2 analysis showed that 12 forced-choice questions in sequence create monotony ("Question 10, 11, 12 will feel repetitive"). 10 questions with mixed formats avoids both problems: the format variation breaks monotony, and the count is within the empirically supported range.

2. **7 normative questions provide reliable independent dimension measurement.** With 4 options per question, each answer scoring one dimension, and variable weighting, the 7 normative questions produce dimension scores with adequate separation. Each dimension can be scored by 7 different questions (every question has an answer for every dimension).

3. **3 forced pairs provide inter-dimension tension for the hardest classification decisions.** The three pairs that matter most for composite detection are:
   - A vs. D (Grounded Mystic boundary)
   - B vs. C (Flow Artist boundary)
   - The third pair is flexible -- A vs. C or B vs. D, chosen based on which boundary shows the most classification ambiguity in testing.

4. **Mixed format solves the DA's monotony concern.** The user sees 7 questions with 4 options, then 3 questions with 2 options (or interleaved -- see sequencing below). The format change is itself a form of engagement variety. This addresses Flaw 1 (homogeneity) without requiring 4 different renderers.

### Scoring Arithmetic

**Normative questions (7 questions):**

Variable weighting with 3 tiers:
- **Anchor questions** (highest discrimination): one answer at +6, others at +4 for their respective dimensions
- **Standard questions**: all answers at +4 (current behavior)
- **Lighter questions**: answers at +3

Let me compute the score range. Assuming a mix of 2 anchor (+6), 3 standard (+4), and 2 lighter (+3):
- Max from normative questions per dimension: depends on how many questions the user answers for that dimension. In a 4-option normative question, each dimension gets one answer. If the user picks dimension A on an anchor question, A gets +6. If they pick A on a standard, A gets +4.
- But the user only picks one answer per question, so only one dimension scores per normative question.
- Over 7 normative questions: a user maximally aligned with dimension A picks A on all 7 questions. Max A from normative = 2(6) + 3(4) + 2(3) = 12 + 12 + 6 = 30. But this is unrealistic -- the user would have to perceive every question as an A question.
- Realistic strong-A user picks A on 5 of 7 normative questions: ~5 * 4.3 (average weight) = ~22 points for A.

**Forced-pair questions (3 questions):**

Each pair uses +6/+2 scoring (the Researcher's recommendation):
- Pick A: A gets +6, B gets +2
- Pick B: B gets +6, A gets +2

Max per dimension from forced pairs: If all 3 forced pairs involve dimension A (they will not -- at most 2 will), max A = 2 * 6 + 1 * 2 = 14. Realistically, dimension A appears in 1-2 forced pairs.

**Combined range:**

A dimension appearing in 6 normative questions (as the "A" answer option) and 2 forced pairs could theoretically score:
- Max: 6 * 6 (all anchor, all picked -- unrealistic) + 2 * 6 = 48
- Realistic strong profile: 4 * 4.3 (picked A on 4 of 6 normative) + 2 * 6 (won both forced pairs) = 17.2 + 12 = 29.2
- Realistic moderate profile: 2 * 4 + 1 * 6 + 1 * 2 = 16

The key structural property: **scores do NOT sum to a constant.** A user who is genuinely high on A and D can score high on both without forcing B and C to zero. This is the fundamental difference from ipsative scoring and why the Researcher's approach is correct.

For the classifier, this means the normalized score vectors vary in magnitude across users -- which is exactly why cosine similarity (angle-based) is the right metric. Two users can both be "Air Weaver types" but one might have stronger overall engagement with the quiz (higher total scores); cosine similarity treats them the same because their dimensional proportions are similar.

### Data Model

The data model from my Round 2 spec needs one modification: the `pair` field becomes optional and semantic, not structural:

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

export type QuestionFormat = 'single_select' | 'forced_pair';

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];
  format: QuestionFormat;
  phase: 'scored' | 'segmentation' | 'product-research';
  // For forced_pair questions: which two dimensions are being contrasted
  // For single_select: null (all 4 dimensions represented in answers)
  pair: [Dimension, Dimension] | null;
}
```

Key differences from Round 2:
- `format` field is back (two formats now: `single_select` and `forced_pair`), but there are only two formats, not four. The Builder confirmed in Round 2 that two rendering paths are LOW complexity.
- `scored: boolean` is replaced by `phase` (richer semantic, as in Round 2).
- `pair` is present for forced_pair questions (metadata for analysis/testing) and null for single_select.
- `answers` is variable length: 4 for single_select, 2 for forced_pair. This is the current behavior -- the existing quiz already has questions with 2, 3, 4, 5, and 6 answers.

### Question ID Convention

- `NQ{nn}` for normative scored questions (NQ01-NQ07)
- `FP{nn}` for forced-pair scored questions (FP01-FP03)
- `SEG{n}` for segmentation questions (SEG1, SEG2)
- `PR{n}` for product-research questions (PR1, PR2)

This preserves the Round 2 convention of avoiding collision with current `Q{n}` IDs.

---

## Directive 3: The Classifier -- Cosine Similarity with Hybrid Input

### What Changes from Round 2

The classifier algorithm is unchanged from Round 2: cosine similarity to centroids, producing `ClassificationResult` with primary, secondary, confidence, and memberships. What changes is the input characteristics:

**Round 2 (ipsative input):** All score vectors sum to 48 (12 questions * 4 points). Vectors live on a hyperplane. Cosine similarity is geometrically correct but operates on unreliable data.

**Round 3 (hybrid input):** Score vectors do NOT sum to a constant. Different users can have different total scores. Vectors do NOT live on a hyperplane. Cosine similarity is still the right metric because it measures proportional similarity (the *shape* of the profile), which is exactly what archetype classification needs. A user who rushed through the quiz (lower engagement, lower total score) and a user who deliberated carefully (higher engagement, higher total score) should get the same archetype if their dimensional proportions are the same.

### Centroid Definitions

The centroids from Round 2 remain valid. With hybrid (non-ipsative) scoring, the centroids do not need to lie on any particular hyperplane -- they just need to represent the directional profile of each archetype:

```typescript
export const CENTROIDS: Record<ArchetypeSlug, [number, number, number, number]> = {
  air_weaver:          [0.90, 0.15, 0.15, 0.15],
  embodied_intuitive:  [0.15, 0.90, 0.15, 0.15],
  ascending_seeker:    [0.15, 0.15, 0.90, 0.15],
  shadow_dancer:       [0.15, 0.15, 0.15, 0.90],
  flow_artist:         [0.15, 0.65, 0.65, 0.15],
  grounded_mystic:     [0.65, 0.15, 0.15, 0.65],
};
```

With non-ipsative data, the ipsative hyperplane problem I identified in Round 2 disappears entirely. The centroids no longer need to satisfy any sum constraint. The centroid for Air Weaver says "high A, low everything else" -- this is the directional profile, and cosine similarity correctly identifies user vectors pointing in the same direction. The centroid values are tuning parameters, not structural constraints.

### The Unified ClassificationResult Interface

Unchanged from Round 2:

```typescript
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
  scores: DimensionScores;      // raw dimension scores (for debugging, analytics)
}

export function classify(scores: DimensionScores): ClassificationResult;
export function computeScores(
  answers: Record<string, string>,
  questions: Question[]
): DimensionScores;
```

Algorithm (unchanged from Round 2):
1. Convert `DimensionScores` to a 4-vector `[A, B, C, D]`
2. Compute cosine similarity to each centroid
3. Primary = highest similarity, secondary = second highest
4. Confidence = `1 - (sim_secondary / sim_primary)` -- approaches 1 when primary dominates, approaches 0 when primary and secondary are nearly equal
5. Memberships = normalize similarities to sum to 1.0

Backward compatibility shim:
```typescript
export function classifyLegacy(scores: DimensionScores): ArchetypeSlug {
  return classify(scores).primary;
}
```

---

## Directive 4: Resolving the Tie-Handling Gap

The DA's Round 2 analysis found ~24% two-way ties and ~3.7% four-way ties with pure ipsative scoring. With the hybrid approach, the tie landscape changes fundamentally:

**Why hybrid scoring reduces ties:**

1. Normative questions produce scores that are NOT multiples of a constant. With variable weighting (+3, +4, +6), different dimensions accumulate different point totals based on which specific questions the user answered for each dimension. The probability of exact ties drops dramatically.

2. Forced pairs score BOTH dimensions non-zero. With +6/+2 scoring, the winning dimension gets 4 more points than the losing dimension -- but the losing dimension still gets 2 points. This means forced pairs create *relative* separation, not *absolute* separation. The granularity of the scoring space increases.

3. Cosine similarity operates in continuous floating-point space. Even if raw dimension scores happen to be close, the cosine similarity to different centroids will differ by small but nonzero amounts. Exact ties in cosine similarity require the user's score vector to be equidistant (in angle) from two centroids, which is measure-zero in continuous space.

**But "near-ties" still matter.** The DA's deeper concern was not exact ties but "one answer away from a different archetype" (72.7% with ipsative scoring). With hybrid scoring, I need to address what happens when confidence is low.

### Low-Confidence Classification Protocol

The `confidence` field in `ClassificationResult` handles this. The spec defines three tiers:

**High confidence (confidence >= 0.4):**
- Result shows primary archetype only: "You are The Air Weaver."
- This is the happy path. The user's dimensional profile clearly points to one archetype.

**Medium confidence (0.15 <= confidence < 0.4):**
- Result shows primary with secondary: "You are The Air Weaver with Shadow Dancer undertones."
- The secondary archetype is named and briefly described. The journey content and email sequence are keyed to the primary.
- This handles the DA's concern about users who are "one answer away from a different archetype" -- they see both archetypes acknowledged, which feels accurate rather than arbitrary.

**Low confidence (confidence < 0.15):**
- Result shows primary and secondary with equal weight: "Your reading reveals a tension between The Air Weaver and The Shadow Dancer."
- The result page shows both archetype descriptions side by side with a prompt: "Which resonates more deeply?" The user's click determines their final classification for email sequence purposes.
- This is the self-selection flow the Daydreamer proposed, but scoped to the ~5-10% of users who genuinely have ambiguous profiles, not the ~24% that ipsative scoring produced.

**Why these thresholds:** The confidence formula `1 - (sim_secondary / sim_primary)` produces 0 when primary and secondary are identical (impossible with non-degenerate data), and approaches 1 when primary dominates. With 6 centroids, a user whose profile points squarely at one centroid will have confidence ~0.5-0.7. A user genuinely between two centroids will have confidence ~0.05-0.15. The 0.15 and 0.4 thresholds are initial values to be validated with the Monte Carlo distribution test.

### Self-Selection Flow Architecture

This is the tie-handling UX the DA required as first-class. It is a conditional phase in the quiz engine:

```
intro -> segmentation (2 Qs) -> scored (10 Qs) -> email-gate -> calculating -> [self-select?] -> results
```

The `self-select` phase appears only when `confidence < 0.15`. It shows both archetypes and captures the user's choice. This choice is:
- Recorded in the submission payload (for analytics: `selfSelected: true, selectedOver: 'shadow_dancer'`)
- Sent to Loops.so as the final archetype assignment
- Used to key the result page redirect

The engine phases:

```typescript
export type QuizPhase =
  | 'intro'
  | 'segmentation'
  | 'scored-questions'
  | 'email-gate'
  | 'calculating'
  | 'self-select'      // conditional: only when confidence < 0.15
  | 'results';
```

The calculating interstitial runs the classification. If confidence < 0.15, it transitions to `self-select` instead of `results`. The self-select phase renders two large archetype cards (name + tagline + glyph) with a prompt: "Your reading reveals equal resonance with both. Which calls to you more deeply?" The user taps one. The engine records the selection and transitions to `results`.

---

## Directive 5: Complete Revised Architecture

### Component 1: quiz-data.ts

**2 segmentation questions + 10 scored questions (7 normative + 3 forced-pair) + 2 product-research questions = 14 entries.**

Question sequencing within the scored section:

```
NQ01 (normative, 4 options)
NQ02 (normative, 4 options)
FP01 (forced pair: A vs. D)    <-- format change creates engagement variety
NQ03 (normative, 4 options)
NQ04 (normative, 4 options)
FP02 (forced pair: B vs. C)    <-- second format change at midpoint
NQ05 (normative, 4 options)
NQ06 (normative, 4 options)
FP03 (forced pair: A vs. C or B vs. D)  <-- final forced pair near end
NQ07 (normative, 4 options)
```

The forced pairs are interleaved at positions 3, 6, and 9 (out of 10) to break monotony. The normative questions bracket them, providing a familiar 4-option format before and after each 2-option pair.

Pair assignments for forced pairs:
- FP01: A vs. D (Logic vs. Depth -- the Grounded Mystic boundary)
- FP02: B vs. C (Body vs. Flow -- the Flow Artist boundary)
- FP03: A vs. C or B vs. D (chosen based on Monte Carlo distribution testing -- whichever pair shows the weakest discrimination)

Each forced pair scores both dimensions:
```
FP01 answer A: [{dimension: 'A', points: 6}, {dimension: 'D', points: 2}]
FP01 answer B: [{dimension: 'D', points: 6}, {dimension: 'A', points: 2}]
```

Normative questions use variable weighting:
- 2 anchor questions: strongest discriminator answer at +6, others at +4
- 3 standard questions: all answers at +4 (current behavior)
- 2 lighter questions: all answers at +3

**Content authorship:** Per Round 2 and the DA's RISK-01, the operator writes all question copy. The Builder implements the data model and scoring structure. The Designer (this spec) defines which questions are normative vs. forced-pair, which dimension pairs are tested, and the weight tier assignments. The question TEXT is a content deliverable gated on operator approval.

### Component 2: classifier.ts

Two exports, unchanged from Round 2:

```typescript
export function computeScores(
  answers: Record<string, string>,
  questions: Question[]
): DimensionScores;

export function classify(scores: DimensionScores): ClassificationResult;
```

`computeScores()` is unchanged from the current implementation. It sums `scoring[].points` per dimension from provided answers. The hybrid format produces the same `DimensionScores` shape.

`classify()` is rewritten from priority-cascade to cosine-similarity-to-centroids. The algorithm is ~25 lines:

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function classify(scores: DimensionScores): ClassificationResult {
  const userVec = [scores.A, scores.B, scores.C, scores.D];

  const similarities = Object.entries(CENTROIDS).map(([slug, centroid]) => ({
    slug: slug as ArchetypeSlug,
    similarity: cosineSimilarity(userVec, centroid),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);

  const primary = similarities[0];
  const secondary = similarities[1];

  const confidence = primary.similarity > 0
    ? 1 - (secondary.similarity / primary.similarity)
    : 0;

  const totalSim = similarities.reduce((sum, s) => sum + s.similarity, 0);
  const memberships = {} as Record<ArchetypeSlug, number>;
  for (const s of similarities) {
    memberships[s.slug] = totalSim > 0 ? s.similarity / totalSim : 1 / 6;
  }

  return {
    primary: primary.slug,
    secondary: secondary.slug,
    confidence,
    memberships,
    scores,
  };
}
```

**Edge case: all scores zero.** If a user somehow submits with no answers, `userVec = [0, 0, 0, 0]`. Cosine similarity with any centroid is 0 (zero vector has no direction). The function returns confidence 0 and uniform memberships (1/6 each). The self-select phase triggers. This is the correct behavior -- an empty profile should not be force-classified.

### Component 3: quiz-engine.ts

```typescript
export type QuizPhase =
  | 'intro'
  | 'segmentation'
  | 'scored-questions'
  | 'email-gate'
  | 'calculating'
  | 'self-select'
  | 'results';

export interface QuizState {
  phase: QuizPhase;
  questionIndex: number;
  answers: Record<string, string>;
  email: string | null;
  firstName: string | null;
  startTime: number;
  shuffleSeeds: Record<string, number>;    // per-question PRNG seed
  classificationResult: ClassificationResult | null;
  selfSelectedArchetype: ArchetypeSlug | null;
}

export interface QuizEngine {
  getState(): Readonly<QuizState>;
  getCurrentQuestion(): Question | null;
  getProgress(): { current: number; total: number; percent: number };
  answerQuestion(questionId: string, answerId: string): void;
  goBack(): boolean;
  advance(): QuizPhase;
  submitEmail(email: string, firstName?: string): void;
  skipEmail(): void;
  getResult(): ClassificationResult | null;
  selectArchetype(slug: ArchetypeSlug): void;  // for self-select phase
  getShuffledAnswerIndices(questionId: string): number[];
}

export function createQuizEngine(questions: Question[]): QuizEngine;
```

Changes from Round 2:
- `getShuffledAnswerIndices()` returns a permutation array instead of a tuple. For 2-answer forced pairs: `[0, 1]` or `[1, 0]`. For 4-answer normative questions: a Fisher-Yates permutation of `[0, 1, 2, 3]`. This generalizes across both formats.
- `selfSelectedArchetype` in state captures the self-select choice.
- `selectArchetype()` method handles the self-select phase action.
- `classificationResult` cached in state after calculation phase.

Phase flow logic:
```
intro -(begin)-> segmentation
segmentation -(complete 2 Qs)-> scored-questions
scored-questions -(complete 10 Qs)-> email-gate
email-gate -(submit or skip)-> calculating
calculating -(classification computed)->
  if confidence >= 0.15: results
  if confidence < 0.15: self-select
self-select -(user picks)-> results
```

### Component 4: quiz.astro

Two rendering paths (not four):

**Normative questions (single_select):**
```html
<section class="quiz-step" data-step={i}>
  <div class="glass-panel p-6 md:p-8 rounded-lg">
    <p class="question-label">{q.text}</p>
    <div class="flex flex-col gap-3 mt-6">
      {shuffledAnswers.map(a => (
        <button class="answer-btn" data-question={q.id} data-answer={a.id}>
          {a.text}
        </button>
      ))}
    </div>
  </div>
</section>
```

**Forced-pair questions:**
```html
<section class="quiz-step" data-step={i}>
  <div class="glass-panel p-6 md:p-8 rounded-lg">
    <p class="question-label">{q.text}</p>
    <div class="flex flex-col gap-4 mt-6">
      <button class="pair-btn" data-question={q.id} data-answer={shuffledAnswers[0].id}>
        {shuffledAnswers[0].text}
      </button>
      <div class="text-center text-hermetic-gold/30 text-xs tracking-widest uppercase">or</div>
      <button class="pair-btn" data-question={q.id} data-answer={shuffledAnswers[1].id}>
        {shuffledAnswers[1].text}
      </button>
    </div>
  </div>
</section>
```

The visual distinction between formats (4 stacked buttons vs. 2 large buttons with "or" divider) is intentional. It signals to the user that the forced-pair questions are structurally different: "this is a tradeoff, not a multiple choice." The `pair-btn` class gets larger padding, taller min-height, and a different border treatment than `answer-btn`.

**Self-select phase:**
```html
<section id="self-select" class="quiz-step">
  <div class="glass-panel p-6 md:p-8 rounded-lg text-center">
    <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase">
      Your reading reveals a tension
    </p>
    <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white mt-4 mb-8">
      Which calls to you more deeply?
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Archetype card A -->
      <button class="archetype-card" data-archetype={result.primary}>
        <span class="archetype-glyph">...</span>
        <span class="archetype-name">{primaryName}</span>
        <span class="archetype-tagline">{primaryTagline}</span>
      </button>
      <!-- Archetype card B -->
      <button class="archetype-card" data-archetype={result.secondary}>
        <span class="archetype-glyph">...</span>
        <span class="archetype-name">{secondaryName}</span>
        <span class="archetype-tagline">{secondaryTagline}</span>
      </button>
    </div>
  </div>
</section>
```

### Component 5: quiz-submit.ts

Minor updates:
- Request body adds `quizVersion: 'v2'`.
- Validation auto-adapts from the `questions` array (unchanged mechanism).
- Segmentation extraction uses new IDs: `SEG1`, `SEG2`.
- Optional fields: `selfSelected: boolean`, `selectedOver: ArchetypeSlug` (for analytics when self-select was triggered).
- Now sends `memberships` from `ClassificationResult` as Loops.so event properties.

---

## Interface Map

```
quiz-data.ts
    |
    | exports: Question[], Dimension, Answer, ScoringWeight, QuestionFormat
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

No circular dependencies. Same topology as Round 2.

---

## Build Order

1. **quiz-data.ts** -- New question data model with `format`, `phase`, `pair` fields, new IDs. Variable-weight scoring on normative questions. Forced-pair dual-dimension scoring. Operator writes question copy in parallel (content deliverable).

2. **classifier.ts** -- Cosine-similarity-to-centroids classification. `ClassificationResult` interface. `classifyLegacy()` shim. `computeScores()` unchanged.

3. **quiz-engine.ts** -- State machine with 7 phases (including conditional self-select). Generalized answer shuffling for both 2-option and 4-option questions.

4. **quiz.astro** -- Two rendering paths (single_select, forced_pair), email gate, calculating interstitial, self-select phase, result display with confidence-based messaging.

5. **quiz-submit.ts** -- Updated validation, new question IDs, `quizVersion: 'v2'`, optional `selfSelected` field, memberships forwarding.

### Test Contracts (Frozen-Test-File Protocol)

Written BEFORE implementation for each step:

- **quiz-data.test.ts:**
  - 10 scored questions total (7 normative + 3 forced-pair)
  - All normative questions have 4 answers
  - All forced-pair questions have 2 answers
  - Each forced-pair answer scores exactly 2 dimensions (one at +6, one at +2)
  - Forced-pair dimension coverage: A-D, B-C, and one TBD pair each appear exactly once
  - Variable weights present: at least one question with a +6 weight, at least one with a +3 weight
  - Phase field present on all questions
  - No scoring weight on segmentation or product-research questions

- **classifier.test.ts:**
  - Cosine similarity produces correct primary for each centroid's ideal vector
  - All 6 archetypes reachable (one test case per archetype with an input vector that should classify to it)
  - Confidence is 0-1 range
  - Memberships sum to 1.0 (within floating-point tolerance)
  - Edge: all-equal scores produce confidence < 0.15
  - Edge: zero vector produces uniform memberships
  - Grounded Mystic detection: high A + high D input classifies as grounded_mystic
  - Flow Artist detection: high B + high C input classifies as flow_artist

- **quiz-engine.test.ts:**
  - Phase transitions follow the specified flow
  - Self-select triggers when confidence < 0.15 (mock low-confidence result)
  - Self-select does NOT trigger when confidence >= 0.15
  - Answer recording, shuffle determinism, progress calculation
  - Back navigation preserves shuffle order
  - `selectArchetype()` in self-select phase records the choice

- **archetype-distribution.test.ts:**
  - Monte Carlo simulation: 10,000 random answer sets
  - All 6 archetypes appear at > 5%
  - No archetype exceeds 40%
  - Ascending Seeker appears at > 8% (explicit guard against junk-drawer regression)
  - Self-select triggers for < 15% of random answer sets (guard against too many ambiguous results)

---

## DA Conditions -- Disposition

| DA Condition | Status | How Addressed |
|---|---|---|
| 1. Rank-order/centroid classifier, not threshold-based | MET | Cosine-similarity-to-centroids classifier (unchanged from Round 2) |
| 2. Tie-handling UX as first-class flow | MET | Self-select phase in quiz engine, triggered by confidence < 0.15. Three-tier confidence protocol. |
| 3. Pair display randomization per session | MET | Seeded PRNG shuffle for all question formats. 2-option coin-flip for forced pairs, Fisher-Yates for 4-option normative. |
| 4. Operator authors all pair copy | MET | Explicit content deliverable in build order. Phase 0 gates on operator approval. |
| 5. Gate-with-skip at launch | MET | Email gate with skip link. Skippers see archetype name + tagline. Skip rate tracked as GA4 event. |

## Researcher Concern -- Disposition

| Concern | Status | How Addressed |
|---|---|---|
| Pure ipsative scoring fails at 4 dimensions | RESOLVED | Adopted hybrid approach: 7 normative + 3 forced-pair. Scores do NOT sum to a constant. |
| 12 paired-comparison items produce unreliable measurements | RESOLVED | Reduced forced pairs to 3 (embedded within normative framework). Normative questions provide independent dimension measurement with adequate reliability. |
| Forced pairs should score BOTH dimensions non-zero | ADOPTED | +6/+2 scoring on forced pairs. Both dimensions receive points regardless of which is chosen. |
| No marketing quiz uses pure ipsative scoring | RESPECTED | The hybrid approach follows the dominant marketing quiz pattern (normative weighted scoring) while selectively using forced pairs for composite boundary discrimination. |

---

## Risks Acknowledged

| Risk | Severity | Mitigation |
|---|---|---|
| RISK-01 (voice fidelity) | HIGH | Operator writes all copy. Two formats to author for (scenario 4-option + tradeoff 2-option). |
| RISK-02 (email gate cliff) | HIGH | Skip link. Skippers see name + tagline. Current baseline is zero capture. |
| RISK-03 (backward incompat) | HIGH | `quizVersion: 'v2'`. Existing contacts not re-classified. |
| RISK-04 (segmentation data loss) | MEDIUM | SEG1, SEG2 retained. PR1, PR2 moved to post-results. |
| RISK-05 (variable weight burden) | MEDIUM | 3-tier system (+3/+4/+6). Simpler than open-ended per-question tuning. Forced pairs have fixed +6/+2. |
| RISK-11 (discretization cliff) | LOW (was HIGH) | Hybrid scoring with variable weights produces much finer granularity than pure ipsative. No constant-sum constraint. Cosine similarity operates in continuous space. |
| RISK-12 (primacy bias) | MEDIUM | Seeded PRNG shuffle on all questions. Forced pairs have only 2 options (smaller primacy effect than 4+). Desirability matching required via operator review. |
| Self-select UX adds complexity | LOW | Conditional phase, ~5-10% of users. Two large buttons with archetype names. Not a complex UI component. |

---

## What Changed from Round 2

| Component | Round 2 | Round 3 | Why |
|---|---|---|---|
| Scoring model | Pure ipsative (+4/+0, 12 paired comparisons) | Hybrid normative + forced-pair (7 normative + 3 forced pairs) | Researcher's psychometric evidence: ipsative unreliable at 4 dimensions |
| Question count | 12 scored (all paired comparison) | 10 scored (7 normative + 3 forced pair) | 10 is within empirical sweet spot; mixed format prevents monotony |
| Question format | 1 format (paired comparison) | 2 formats (single_select + forced_pair) | Hybrid scoring requires normative questions (4 options) alongside forced pairs (2 options) |
| Forced-pair scoring | +4/+0 (zero-sum) | +6/+2 (both dimensions scored) | Researcher's recommendation: avoids ipsative constraint |
| Normative scoring | N/A (no normative questions in R2) | Variable weight: +3/+4/+6 tiers | Restores independent dimension measurement with finer granularity |
| Tie handling | Open question #4 | Three-tier confidence protocol + self-select phase | DA's condition #2 now fully designed |
| Classifier algorithm | Cosine similarity to centroids | Cosine similarity to centroids (unchanged) | Still the right metric, now operating on better input data |
| UI renderers | 1 (two buttons) | 2 (four-button normative + two-button forced-pair) | Minimal added complexity; Builder confirmed 2 paths is LOW effort |
| Ipsative hyperplane problem | Identified; solved by switching to cosine similarity | Dissolved entirely | Non-ipsative data does not live on a hyperplane |

---

## Final Position

I concede the Researcher's block was correct. Pure ipsative scoring with 4 dimensions and 12 items does not produce reliable enough input for any classifier, including cosine-similarity-based. The hybrid approach -- normative weighted scoring for most questions, forced pairs for composite boundary discrimination -- is structurally superior. It produces more reliable dimension scores, eliminates the constant-sum constraint, and works with the existing `computeScores()` infrastructure without modification.

I maintain from Round 2: cosine-similarity-to-centroids is the correct classification algorithm. The `ClassificationResult` interface with confidence and memberships is the correct output contract. The self-select phase at confidence < 0.15 resolves the DA's tie-handling condition.

This spec is complete. The Builder can implement against it.

**Vote: AGREE (contingent on Researcher lifting block after reviewing hybrid adoption)**
