# Round 3 -- Builder: Final Implementation Assessment

## Position Update from Round 2

In Round 2, I advocated pure ipsative forced-choice (+3/+0, 12 paired-comparison questions). The Researcher has since BLOCKED that approach with psychometric evidence: 4 dimensions with ipsative scoring produces unreliable classification (Bartram 1996, Schulte et al. 2021, Hee 2018). I concede this point. The evidence is clear and I do not have counter-evidence.

The Researcher's hybrid proposal -- mostly normative questions with 2-3 forced-pair questions scored non-zero-sum (+6/+2) -- preserves the forced-choice UX variety I wanted while avoiding the ipsative reliability trap.

This round delivers the exact implementation comparison the Moderator requested.

---

## 1. Implementation Diff: Option A vs. Option B

### What both options share (identical work regardless of choice)

Both options require:
- Rewriting `classify()` to use cosine-similarity centroids (same algorithm, same code)
- Rewriting the `questions` array in `quiz-data.ts` (new content either way)
- Updating `quiz-data.test.ts` structural assertions
- Rewriting `classifier.test.ts` integration tests for `computeScores`
- Adding centroid-based classification tests
- UI work: email gate, calculating interstitial, answer shuffle, auto-advance delay
- E2E test updates

The shared work is roughly 80% of the total. The diff between options is in the remaining 20%.

### Option A: Pure ipsative (12 paired-comparison, all +4/+0)

**`quiz-data.ts` changes:**

```typescript
// Type additions
export type QuestionFormat = 'paired_comparison' | 'segmentation';

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];     // always exactly 2 for scored questions
  scored: boolean;
  format: QuestionFormat; // NEW
}

// 12 questions, each with 2 answers, each answer scores +4 to one dimension
// All questions identical structure
```

Lines of code for question data: ~12 questions * 12 lines/question = ~144 lines of scored questions. Plus 2-4 segmentation questions (~40 lines). Total ~184 lines. Down from current 723 lines.

**`quiz.astro` UI rendering:**

One rendering path for all scored questions: two large buttons, pick one. No conditional branching on question format.

```astro
{q.format === 'paired_comparison' ? (
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    {q.answers.map((a) => (
      <button class="pair-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
) : (
  <div class="space-y-3">
    {/* existing multi-option for segmentation */}
    {q.answers.map((a) => (
      <button class="answer-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
)}
```

That is ~20 lines of rendering logic in the template. The segmentation branch reuses the existing answer-btn CSS.

**`classifier.ts` changes:**

`computeScores()` -- zero changes. It sums whatever weights are in `answer.scoring`.

`classify()` -- rewritten for cosine similarity. Same for both options. ~30-40 lines.

### Option B: Researcher's hybrid (~8 normative + 2-3 forced-pair)

**`quiz-data.ts` changes:**

```typescript
// Same type additions as Option A
export type QuestionFormat = 'single_select' | 'forced_pair' | 'segmentation';

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];     // 4 for single_select, 2 for forced_pair
  scored: boolean;
  format: QuestionFormat; // NEW
}

// ~8 questions with 4 answers each (single_select)
// ~2-3 questions with 2 answers each (forced_pair)
// 2-4 segmentation questions
```

Lines of code for question data: ~8 normative * 18 lines/question = ~144 lines, plus ~3 forced-pair * 12 lines = ~36 lines, plus ~40 lines segmentation. Total ~220 lines. Still well under the current 723.

Scoring weights differ by format:
- `single_select`: each answer scores +4 to one dimension (like current quiz, but better questions and potentially variable weights +2/+4/+6)
- `forced_pair`: winner gets +6, loser gets +2 (non-zero-sum, both dimensions get points)

The +6/+2 scoring is where the data model gets slightly more complex. Each answer in a forced-pair question needs to express that choosing it gives +6 to the winner dimension AND +2 to the loser dimension. But this is already supported by the existing `ScoringWeight[]` array:

```typescript
// Forced pair: A vs. B. If user picks A:
{
  id: 'FP1-A',
  text: 'Research until I find the right framework.',
  scoring: [
    { dimension: 'A', points: 6 },
    { dimension: 'B', points: 2 },
  ],
},
// If user picks B:
{
  id: 'FP1-B',
  text: 'Feel into my body for the answer.',
  scoring: [
    { dimension: 'B', points: 6 },
    { dimension: 'A', points: 2 },
  ],
},
```

Wait. This is wrong. If the user picks A, the LOSER (B) also gets points. But `computeScores()` only processes the CHOSEN answer's scoring array. So we need the chosen answer's scoring to include both the winner and loser points. The answer above does this correctly: picking FP1-A gives A=+6 and B=+2. Picking FP1-B gives B=+6 and A=+2.

This already works. The existing `ScoringWeight[]` array already supports multi-dimension scoring -- Q7-E and Q8-E already score two dimensions (A+4 and D+4). The +6/+2 scheme is the same pattern with different point values.

**`quiz.astro` UI rendering:**

Two rendering paths for scored questions, plus segmentation:

```astro
{q.format === 'forced_pair' ? (
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    {shuffledAnswers.map((a) => (
      <button class="pair-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
) : q.format === 'single_select' ? (
  <div class="space-y-3">
    {shuffledAnswers.map((a) => (
      <button class="answer-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
) : (
  <div class="space-y-3">
    {/* segmentation -- same as single_select visually */}
    {q.answers.map((a) => (
      <button class="answer-btn ..." data-question={q.id} data-answer={a.id}>
        {a.text}
      </button>
    ))}
  </div>
)}
```

That is ~30 lines of rendering logic. The segmentation branch could share the single_select branch, reducing to ~22 lines. Effectively one extra `else if` branch compared to Option A.

### The actual diff between the two options

| Concern | Option A | Option B | Delta |
|---------|----------|----------|-------|
| `QuestionFormat` type | 2 values | 3 values | +1 enum value |
| Question data authoring | 12 questions, all 2-answer | ~8 questions with 4 answers + ~3 with 2 answers | Mixed, but slightly more total data |
| `quiz-data.ts` lines | ~184 | ~220 | +36 lines |
| `quiz.astro` renderer branches | 2 (paired + segmentation) | 3 (single_select + forced_pair + segmentation) | +1 branch (~10 lines) |
| `computeScores()` | Zero changes | Zero changes | None |
| `classify()` | Cosine centroids (same) | Cosine centroids (same) | None |
| `quiz-submit.ts` | Zero changes | Zero changes | None |
| Scoring weight complexity | All +4/+0 (uniform) | +4/+0 normative, +6/+2 forced-pair (mixed) | Slightly more complex test assertions |
| Shuffle implementation | Coin-flip (2 items) | Fisher-Yates 4 items (normative) + coin-flip 2 items (forced-pair) | Same Fisher-Yates works for both; no extra code |
| Auto-advance timing | Uniform 800ms | Uniform 800ms (same format for user: click one button) | None |

**Total delta: ~46 additional lines of code and 1 extra conditional branch.** This is trivial. The diff between the two options is approximately 2 hours of implementation time.

---

## 2. Does computeScores() Handle Both Scoring Schemes Naturally?

**Yes.** I re-read `computeScores()` (lines 83-111 of `/Users/tuesday-agent/Projects/quigley-multimedia/thehermeticflight/src/lib/classifier.ts`) one more time to be sure.

The function:
1. Builds a flat map: `answerId -> ScoringWeight[]`
2. For each user answer, looks up the scoring weights
3. Sums `weight.points` into `totals[weight.dimension]`

It does not care:
- How many answers a question has (2, 4, or 5)
- What the point values are (2, 3, 4, 6, or any number)
- How many dimensions a single answer scores (1, 2, or more)
- Whether the question is normative, ipsative, forced-pair, or anything else

**Option A confirmation:** All answers have `scoring: [{ dimension: X, points: 4 }]`. The function sums +4 to one dimension per answer. Works.

**Option B confirmation:**
- Normative answers have `scoring: [{ dimension: X, points: 4 }]`. Same as current quiz. Works.
- Forced-pair answers have `scoring: [{ dimension: X, points: 6 }, { dimension: Y, points: 2 }]`. The function iterates the scoring array and sums both. X gets +6, Y gets +2. Works. This is the same pattern as Q7-E and Q8-E today, which score `[{ dimension: 'A', points: 4 }, { dimension: 'D', points: 4 }]`.

**Verdict: `computeScores()` handles both options identically. Zero changes needed for either.**

---

## 3. Test Suite Impact Comparison

### Tests that change identically for both options

| Test file | Change type | Effort |
|-----------|------------|--------|
| `classifier.test.ts` -- `classify()` pure-function tests (lines 39-449) | Rewrite: assertions change from `ArchetypeSlug` to `ClassificationResult.primary`. Centroid boundary tests replace cascade priority tests. | HIGH (but same for both) |
| `classifier.test.ts` -- `computeScores()` single-answer tests | Rewrite: new question IDs, new expected point values | MEDIUM (same for both) |
| `classifier.test.ts` -- integration tests | Rewrite: new answer payloads | MEDIUM (same for both) |
| `quiz-submit.test.ts` -- `buildValidAnswers()` and `buildValidBody()` | Auto-adapts (iterates `questions` at runtime) | ZERO (same for both) |
| `quiz-submit-medium.test.ts` | Auto-adapts | ZERO (same for both) |
| `quiz-flow.spec.ts` (E2E) | Rewrite: new question count, new UI interactions | HIGH (same for both) |

### Tests that differ between options

**`quiz-data.test.ts` -- structural assertions:**

**Option A:**
```typescript
// All scored questions have exactly 2 answers
it('every scored question has exactly 2 answers', () => {
  for (const q of scoredQuestions) {
    expect(q.answers).toHaveLength(2);
  }
});

// All scoring weights are exactly +4
it('every scoring weight is exactly +4', () => {
  for (const q of scoredQuestions) {
    for (const a of q.answers) {
      for (const w of a.scoring) {
        expect(w.points).toBe(4);
      }
    }
  }
});
```

Simple. Uniform. One assertion pattern for all scored questions.

**Option B:**
```typescript
// Single-select questions have 4 answers
it('every single_select scored question has exactly 4 answers', () => {
  for (const q of singleSelectQuestions) {
    expect(q.answers).toHaveLength(4);
  }
});

// Forced-pair questions have 2 answers
it('every forced_pair question has exactly 2 answers', () => {
  for (const q of forcedPairQuestions) {
    expect(q.answers).toHaveLength(2);
  }
});

// Single-select weights are +4 (one dimension)
it('single_select answers have exactly 1 scoring weight of +4', () => {
  for (const q of singleSelectQuestions) {
    for (const a of q.answers) {
      expect(a.scoring).toHaveLength(1);
      expect(a.scoring[0].points).toBe(4);
    }
  }
});

// Forced-pair weights are +6/+2 (two dimensions)
it('forced_pair answers have exactly 2 scoring weights (+6 and +2)', () => {
  for (const q of forcedPairQuestions) {
    for (const a of q.answers) {
      expect(a.scoring).toHaveLength(2);
      const points = a.scoring.map(w => w.points).sort((a, b) => a - b);
      expect(points).toEqual([2, 6]);
    }
  }
});
```

More test assertions but not fundamentally harder. It is roughly 15-20 additional test lines. The test logic is still simple structural validation.

**`computeScores()` integration tests:**

**Option A:**
```typescript
it('all-A wins produce A = 24, others = 0', () => {
  // 6 questions where A is an option, user picks A every time
  // Each win gives +4 to A, total = 6 * 4 = 24
  // ...
});
```

**Option B:**
```typescript
it('all-A single-select answers produce A = 32', () => {
  // 8 normative questions, pick A option each time = 8 * 4 = 32
  // ...
});

it('forced-pair A-vs-B, pick A: A gets +6, B gets +2', () => {
  const answers = { FP1: 'FP1-A' };
  const result = computeScores(answers, questions);
  expect(result.A).toBe(6);
  expect(result.B).toBe(2);
});
```

Option B adds ~3-5 extra `computeScores` test cases to validate the +6/+2 dual-scoring. This is directly analogous to the existing Q7-E and Q8-E dual-scoring tests (lines 523-551 of `classifier.test.ts`), which already test multi-dimension scoring. We are not breaking new ground here.

### Test complexity verdict

| Metric | Option A | Option B | Delta |
|--------|----------|----------|-------|
| quiz-data.test.ts lines | ~200 | ~240 | +40 lines |
| classifier.test.ts lines | ~300 | ~320 | +20 lines |
| New test patterns needed | 0 | 0 (forced-pair dual-scoring mirrors existing Q7-E/Q8-E tests) | None |
| Test maintenance burden | Low (uniform structure) | Low (2 question types, but format-based grouping is clear) | Negligible |

**Option B adds roughly 60 lines of tests. This is not meaningful complexity. Both options are approximately the same test effort.**

---

## 4. My Recommendation

**I recommend Option B (hybrid).**

Here is my reasoning, ordered by decision weight:

### 4a. Psychometric validity (decisive factor)

The Researcher demonstrated that pure ipsative scoring with 4 dimensions is unreliable. This is not a soft opinion -- it is a structural constraint backed by three independent papers. Option A violates this constraint. Option B does not.

I am a pragmatist, not a psychometrician. When the evidence specialist says "this approach produces unreliable results with your parameter set," I defer. Building an unreliable quiz faster is not a win.

### 4b. Content creation bottleneck (favors Option B)

This is the factor the Moderator correctly flagged.

- **Option A** requires 24 new desirability-matched paired statements. Every pair must present two equally appealing options. If one option is obviously "cooler," the question provides no signal. All 24 statements are new -- the current 15 scored questions cannot be repurposed because they have 4 options, not 2, and the framing is different.

- **Option B** requires ~16 normative answers (8 questions x 4 answers, some of which can be adapted from existing questions since the format is the same) plus 4-6 paired statements (2-3 forced-pair questions x 2 options). The normative questions can start from existing Q1, Q4-Q10, Q12-Q18 as a base and be improved/reduced. The forced-pair questions require fresh writing, but only 4-6 statements, not 24.

Content creation effort: Option A is approximately 4x harder. The operator must write 24 matched pairs from scratch versus adapting ~8 existing questions and writing ~5 new paired statements.

### 4c. Implementation speed (negligibly favors Option A)

Option A is about 2 hours less code. That is a rounding error on a multi-day implementation. Not a deciding factor.

### 4d. Maintenance burden (neutral)

Both options have one data file (`quiz-data.ts`), one classifier (`classifier.ts`), and one UI page (`quiz.astro`). Option B has one extra rendering branch. Neither option creates ongoing maintenance complexity.

### 4e. Backward compatibility with existing infrastructure

Both options produce `DimensionScores { A, B, C, D }` and feed into the same classifier. Both options auto-adapt through `quiz-submit.ts` (validation is built from the `questions` array at import time). The downstream pipeline (Loops.so, result pages, archetype content) does not know or care which question format produced the scores.

### Final position

**Build Option B.** The ~2 hours of extra implementation time buys psychometric validity and dramatically less content creation work. The engineering diff is trivial. The test diff is trivial. The content diff is decisive.

---

## 5. Build Plan for Option B (Hybrid)

### Phase 0: Content Design (operator-driven, non-engineering)

**Deliverable:** A JSON/markdown spec containing:
- ~8 normative scored questions (4 answers each), adapted from existing Q1, Q4-Q10, Q12-Q18
- 2-3 forced-pair questions (2 answers each), new, with dimension pair assignments and +6/+2 scoring
- 2 segmentation questions (existing Q2 and Q3, optionally rewritten)
- Decision on Q11, Q19, Q20 (cut, move to post-results, or convert)

**Content creation shortcuts:**
- Start from the 10 "clean" questions (Q1, Q4, Q10, Q12-Q18) that have standard A/B/C/D scoring
- Cut to the best 8 (the Researcher says 7-10 is the sweet spot)
- Each existing question already has 4 answers mapped to 4 dimensions -- these can be improved in place
- Write 2-3 forced-pair questions fresh (4-6 paired statements total)
- Recommended forced-pair dimension pairings: A-D (Grounded Mystic detector), B-C (Flow Artist detector), and optionally A-B or C-D for additional discrimination

**Gate:** Operator approves all question content before Phase 1 begins.

**Effort estimate:** 2-4 hours of operator content work, potentially with AI-assisted drafting.

### Phase 1: Data Model + Scoring Pipeline (1 day)

**Files changed:**

| File | Changes |
|------|---------|
| `src/lib/quiz-data.ts` | Add `QuestionFormat` type. Add `format` field to `Question` interface. Replace `questions` array with new content (~10-13 questions). Update `w()` helper or add a second helper for forced-pair weights. |
| `tests/quiz-data.test.ts` | Rewrite structural assertions: question count, answer counts by format, scoring weight validation by format, dimension coverage, format field validation. |
| `tests/classifier.test.ts` | Rewrite `computeScores()` integration tests with new question IDs. Add forced-pair dual-scoring tests. `classify()` pure-function tests: temporarily retain as-is (they use raw `DimensionScores` and will be rewritten in Phase 2). |

**Specific quiz-data.ts changes:**

```typescript
export type QuestionFormat = 'single_select' | 'forced_pair' | 'segmentation';

export interface Question {
  id: string;
  number: number;
  text: string;
  answers: Answer[];
  scored: boolean;
  format: QuestionFormat;
}

// Helper for normative single-select answers (+4 to one dimension)
function w(dimension: Dimension): ScoringWeight {
  return { dimension, points: 4 };
}

// Helper for forced-pair answers (+6 to winner, +2 to loser)
function pair(winner: Dimension, loser: Dimension): ScoringWeight[] {
  return [
    { dimension: winner, points: 6 },
    { dimension: loser, points: 2 },
  ];
}
```

**What auto-adapts without changes:**

- `quiz-submit.ts`: The `validQuestionIds`, `questionAnswerMap`, and `scoredQuestionIds` sets are built at import time by iterating the `questions` array (lines 78-86). When the array changes, these sets auto-update. The validation logic does not reference specific question IDs.
- `quiz-submit.test.ts`: The `buildValidAnswers()` helper (line 44-49) iterates `questions` and picks the first answer for each. It auto-adapts.
- `quiz-submit-medium.test.ts`: Same auto-adaptation.

**Run gate:** `vitest run tests/quiz-data.test.ts tests/classifier.test.ts tests/quiz-submit.test.ts tests/quiz-submit-medium.test.ts` -- all pass.

### Phase 2: Classifier Redesign (1 day)

**Files changed:**

| File | Changes |
|------|---------|
| `src/lib/classifier.ts` | Add `ClassificationResult` interface. Add `CENTROIDS` constant. Rewrite `classify()` to use cosine similarity. Add `classifyLegacy()` shim. Keep `computeScores()` unchanged. |
| `tests/classifier.test.ts` | Rewrite `classify()` tests for centroid behavior. Add centroid boundary tests. Add Monte Carlo distribution test. |

**Specific classifier.ts changes:**

```typescript
export interface ClassificationResult {
  primary: ArchetypeSlug;
  secondary: ArchetypeSlug;
  confidence: number;
  scores: DimensionScores;
}

export const CENTROIDS: Record<ArchetypeSlug, [number, number, number, number]> = {
  air_weaver:          [0.90, 0.15, 0.15, 0.15],
  embodied_intuitive:  [0.15, 0.90, 0.15, 0.15],
  ascending_seeker:    [0.15, 0.15, 0.90, 0.15],
  shadow_dancer:       [0.15, 0.15, 0.15, 0.90],
  flow_artist:         [0.15, 0.65, 0.65, 0.15],
  grounded_mystic:     [0.65, 0.15, 0.15, 0.65],
};

function normalize(scores: DimensionScores): [number, number, number, number] {
  const { A, B, C, D } = scores;
  const sum = A + B + C + D;
  if (sum === 0) return [0.25, 0.25, 0.25, 0.25];
  return [A / sum, B / sum, C / sum, D / sum];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function classify(scores: DimensionScores): ClassificationResult {
  const normalized = normalize(scores);
  let bestSlug: ArchetypeSlug = 'ascending_seeker';
  let bestSim = -Infinity;
  let secondSlug: ArchetypeSlug = 'ascending_seeker';
  let secondSim = -Infinity;

  for (const [slug, centroid] of Object.entries(CENTROIDS) as [ArchetypeSlug, number[]][]) {
    const sim = cosineSimilarity(normalized, centroid);
    if (sim > bestSim) {
      secondSlug = bestSlug;
      secondSim = bestSim;
      bestSlug = slug;
      bestSim = sim;
    } else if (sim > secondSim) {
      secondSlug = slug;
      secondSim = sim;
    }
  }

  const confidence = bestSim > 0 ? 1 - (secondSim / bestSim) : 0;

  return {
    primary: bestSlug,
    secondary: secondSlug,
    confidence: Math.max(0, Math.min(1, confidence)),
    scores,
  };
}

// Backward-compatible shim for callers expecting ArchetypeSlug
export function classifyLegacy(scores: DimensionScores): ArchetypeSlug {
  return classify(scores).primary;
}
```

**Caller migration (same PR):**

| File | Current call | Updated call |
|------|-------------|--------------|
| `src/pages/quiz.astro` (client script) | `classify(scores)` returns string | `classify(scores).primary` |
| `src/pages/api/quiz-submit.ts` | `const archetype = classify(scores)` | `const { primary: archetype } = classify(scores)` |

Two files, two single-line changes. Both are in the same module graph.

**Monte Carlo distribution test:**

```typescript
it('all 6 archetypes appear in random input distribution', () => {
  const counts: Record<ArchetypeSlug, number> = {
    air_weaver: 0, embodied_intuitive: 0, ascending_seeker: 0,
    shadow_dancer: 0, flow_artist: 0, grounded_mystic: 0,
  };
  for (let i = 0; i < 10000; i++) {
    const scores = {
      A: Math.random() * 30,
      B: Math.random() * 30,
      C: Math.random() * 30,
      D: Math.random() * 30,
    };
    counts[classify(scores).primary]++;
  }
  for (const slug of Object.keys(counts) as ArchetypeSlug[]) {
    expect(counts[slug], `${slug} should appear > 5%`).toBeGreaterThan(500);
    expect(counts[slug], `${slug} should appear < 35%`).toBeLessThan(3500);
  }
});
```

**Run gate:** `vitest run tests/classifier.test.ts` -- all pass. Distribution test is the hard gate for Phase 3.

### Phase 3: UI Implementation (1.5 days, parallelizable)

All sub-tasks are independent.

**3a. Format-conditional question rendering** (~3 hours)

Update the `{questions.map()}` block in `quiz.astro` to branch on `q.format`:
- `forced_pair`: 2-column responsive grid (side-by-side on desktop, stacked on mobile)
- `single_select`: existing 4-option stacked layout with improved spacing
- `segmentation`: same as single_select visually, rendered in pre-scored section

Progress bar shows "N of M" where M = total scored questions.

**3b. Email gate wiring** (~4 hours)

Exact code from my Round 2 analysis (Section 4). The HTML template, form submission handler, skip button, step routing changes. No changes from Round 2 -- this is format-independent.

**3c. Calculating interstitial** (~1 hour)

CSS-only pulsing animation. 2.5s auto-advance. Format-independent.

**3d. Answer shuffle** (~1 hour)

Fisher-Yates shuffle on the answer buttons. For forced-pair questions (2 items), this is a coin-flip. For single-select (4 items), it is a 4-element shuffle. Both use the same function. Cache shuffle order in state for back-navigation.

**3e. Auto-advance timing** (~15 min)

Change `500` to `800` in the setTimeout call. One line.

### Phase 4: Integration Testing (1 day)

1. Full flow smoke test: intro -> segmentation -> scored questions (mixed formats) -> email gate -> calculating -> results
2. Update E2E tests (`quiz-flow.spec.ts`) for new question count and mixed layout
3. Verify quiz-submit API accepts hybrid payloads
4. Run full test suite: `vitest run` + `playwright test`
5. Distribution test from Phase 2 must pass
6. Verify Loops.so payload includes correct archetype and scores

### Complete File Manifest

| File | Phase | Change type | Effort |
|------|-------|------------|--------|
| `src/lib/quiz-data.ts` | 1 | Rewrite: new questions, `QuestionFormat` type, `format` field, `pair()` helper | 2h |
| `src/lib/classifier.ts` | 2 | Rewrite `classify()`: cosine centroids, `ClassificationResult`, `CENTROIDS` constant, `classifyLegacy()` shim. `computeScores()` unchanged. | 3h |
| `src/pages/quiz.astro` | 3 | Format-conditional rendering, email gate, calculating interstitial, shuffle, auto-advance, progress bar, intro copy | 6h |
| `src/pages/api/quiz-submit.ts` | 2 | One-line change: destructure `classify()` result | 15min |
| `tests/quiz-data.test.ts` | 1 | Rewrite structural assertions for hybrid format | 2h |
| `tests/classifier.test.ts` | 1-2 | Rewrite: centroid-based classify tests, computeScores integration, distribution test | 3h |
| `tests/quiz-submit.test.ts` | 1 | Mostly auto-adapts. Minor: update structural assertions if any hard-code question counts. | 30min |
| `tests/quiz-submit-medium.test.ts` | 1 | Auto-adapts. | 15min |
| `tests/quiz-flow.spec.ts` | 4 | Rewrite E2E for new flow | 2h |

**Total engineering effort: ~3.5-4 days** (excluding Phase 0 content work)

### Phase Dependencies

```
Phase 0 (Content) ----GATE----> Phase 1 (Data Model)
                                     |
                                     v
                                Phase 2 (Classifier)
                                     |
                                     v
                          Phase 3 (UI, parallelizable sub-tasks)
                                     |
                                     v
                                Phase 4 (Integration)
```

Phase 0 is the critical path. Engineering cannot begin until content is approved. If the operator can turn around content in 1 day, total calendar time is ~5 days. If content takes a week, engineering still takes ~4 days after content is delivered.

---

## 6. What I Concede, What I Maintain

### Concessions

1. **Pure ipsative is out.** The Researcher's evidence is convincing. I concede without reservation. 4 dimensions with ipsative scoring produces unreliable classification. Building it faster does not make it reliable.

2. **Cosine-similarity centroids over priority cascade.** The Designer's adoption of centroids is the right call. The current priority cascade has known issues (Ascending Seeker as junk drawer, priority-dependent tie resolution). Centroids give every archetype explicit coordinates in 4D space. The code is about the same length and the tuning surface is more intuitive.

3. **`ClassificationResult` over bare `ArchetypeSlug`.** The Designer's `ClassificationResult` interface adds useful data (confidence, secondary) at no meaningful implementation cost. The migration is 2 one-line caller updates.

### What I maintain

1. **`computeScores()` does not need to change.** Both options confirmed. It is truly format-agnostic.

2. **`quiz-submit.ts` auto-adapts.** Confirmed by re-reading lines 78-86 and 119-175. Validation is built dynamically from the `questions` array. No question IDs or counts are hard-coded in the API route.

3. **The content bottleneck is the real risk.** Not the engineering. Not the tests. Not the classifier redesign. The operator's ability to produce high-quality, desirability-matched question content on timeline is what determines whether this ships by the Kickstarter launch date.

4. **Phase 0 must be a hard gate.** Do not begin engineering work with placeholder content. The content shapes the scoring distribution, which shapes the centroid tuning, which shapes the classifier tests. Placeholder content means rework.

---

## 7. Open Questions for the Moderator

1. **Variable weighting within normative questions.** The Researcher mentioned +2/+4/+6 variable weighting for normative questions (some questions count more). I scoped the plan for uniform +4 because it is simpler and the forced-pair questions (+6/+2) already provide variable weighting. Does the panel want normative questions to also use variable weights? This adds content design complexity (the operator must decide which questions are +2 "soft signals" vs. +6 "strong indicators") but no engineering complexity (computeScores handles any point values).

2. **`memberships` field.** The Designer's `ClassificationResult` included `memberships: Record<ArchetypeSlug, number>` (fuzzy membership per archetype, sums to 1.0). I omitted this from my classifier sketch because no current consumer uses it. Should it be included for future use (analytics, result page copy), or deferred?

3. **Non-scored question disposition.** My plan keeps Q2 and Q3 as segmentation and drops Q11, Q19, Q20 from the quiz flow. The Designer proposed moving Q19/Q20 to post-results. Does the operator want post-results survey questions, or are they cut entirely?
