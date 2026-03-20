# Round 1 -- Designer Analysis: Quiz Design Overhaul

## Status Quo: What Exists

### Data Layer
- **`src/lib/quiz-data.ts`** -- 20 questions as a flat `Question[]`. Each has `id`, `number`, `text`, `answers[]`, `scored: boolean`. Answers carry `ScoringWeight[]` (dimension + points). Every scored weight is flat +4 points. Two "detector" answers (Q7-E, Q8-E) dual-score A+D for Grounded Mystic.
- **`src/lib/classifier.ts`** -- `computeScores(answers, questions)` sums weights into `DimensionScores {A,B,C,D}`. `classify(scores)` runs a priority cascade: GM > FA > AW > EI > SD > AS(fallback).
- **`src/lib/archetype-content.ts`** -- 6 archetype definitions with slug, name, description, element, color.

### UI Layer
- **`src/pages/quiz.astro`** -- Single-page app. Intro screen -> 20 question steps -> results reveal. No email gate. Auto-advance on click (500ms delay). Progress bar shows "N of 20". Back button available. Results compute client-side, populate DOM, fire GA4 + Meta Pixel events.

### API Layer
- **`src/pages/api/quiz-submit.ts`** -- Accepts `{email, firstName, answers, website}`. Server-side: validates answers, recomputes scores, classifies, extracts non-scored answer text for Loops.so segmentation fields, pushes `quiz_completed` event. Rate limited. Honeypot.
- **`src/pages/api/journey-subscribe.ts`** -- Separate endpoint for archetype journey page subscription. Accepts `{email, firstName, archetype}`.

### Integration Surface
- The client never calls `quiz-submit.ts`. There is no email form in `quiz.astro`. The quiz runs entirely client-side: score, classify, reveal results. The API exists but is **currently disconnected** from the quiz flow.
- Result permalink pages (`/quiz/result/[archetype]`) are statically generated. They show archetype content and share buttons. They link to journey pages.
- `archetype-journeys.json` provides extended content per archetype (affiliated cards, spreads, journaling prompts).

### Test Coverage
- `tests/classifier.test.ts` -- 40+ cases covering every cascade branch, ties, edge cases. Frozen-test-file protocol.
- `tests/quiz-data.test.ts` -- Structural integrity, scoring correctness, correction verification. Frozen.
- `tests/quiz-submit.test.ts` -- Server-side validation, rate limiting, Loops.so integration.
- `tests/quiz-flow.spec.ts` -- Playwright E2E for homepage, result pages, share buttons.

---

## Structural Analysis of the 10 Flaws

The flaws are not independent. They form three coupled clusters plus one standalone concern:

### Cluster 1: Question Architecture (Flaws 1, 5, 7, 10)
These all concern the _scored question pool_ -- what is asked, how many, how they score, how they present.

| Flaw | Problem | Structural Root Cause |
|------|---------|----------------------|
| 1. Homogeneity | All 15 scored questions are "pick your flavor of A/B/C/D" | No question-type differentiation. Every scored question has identical structure: 4 options mapping 1:1 to 4 dimensions. |
| 5. Too long | 20 questions (industry: 7-12) | 15 scored + 5 non-scored, all interleaved as equals. |
| 7. Flat +4 scoring | No variable weighting, so every question contributes equally | The `w()` helper hardcodes `points: 4`. No question has differential impact. |
| 10. Static A-B-C-D order | Pattern recognition: first option is always Air Weaver | Answer order in `quiz-data.ts` is deterministic. No shuffle mechanism. |

**Key coupling:** Cutting questions (flaw 5) reduces the scoring range, which makes the classifier's discrimination thinner. Variable weighting (flaw 7) _compensates_ -- fewer questions can produce the same or better separation if some questions carry more signal. Shuffling (flaw 10) is orthogonal to the others -- it's a presentation concern, not a data concern.

### Cluster 2: Classifier Fairness (Flaws 2, 3)
These concern whether all 6 archetypes are reachable with realistic answer patterns.

| Flaw | Problem | Structural Root Cause |
|------|---------|----------------------|
| 2. AS is junk drawer | Ascending Seeker has no `>=` condition -- it catches everything that falls through | C (Ascending Seeker's dimension) has no direct comparison in the cascade. It can only win by default. |
| 3. FA + GM nearly impossible | Strict dual-domination conditions are too narrow | GM requires A > B AND A > C AND D > B AND D > C (all strict). With flat +4 scoring and a typical answer mix, this demands extraordinary consistency. Only 2 detector questions (Q7-E, Q8-E) explicitly help. FA has the same structural problem for B+C. |

**Key coupling:** Fixing the classifier (flaw 2) changes what Ascending Seeker means. Relaxing GM/FA conditions (flaw 3) could steal from other archetypes. Both must be tuned simultaneously with the question pool changes from Cluster 1.

### Cluster 3: UX Flow (Flaws 4, 6, 8, 9)
These concern the user experience between question 1 and seeing results.

| Flaw | Problem | Structural Root Cause |
|------|---------|----------------------|
| 4. Non-scored questions invisible | Users can't tell Q2/Q3/Q11/Q19/Q20 don't affect their result. Mixed placement creates false expectations. | `quiz.astro` renders all 20 questions identically. The `scored: boolean` field exists in data but is invisible in UI. |
| 6. No email gate | Results are free -- no conversion capture before the reveal | There is no email form in `quiz.astro`. The `quiz-submit.ts` API exists but nothing calls it. |
| 8. Auto-advance punishing | 500ms delay with paragraph-length answers means accidental taps can't be undone | The auto-advance timer in `quiz.astro` is hardcoded at 500ms. There is a back button, but the transition is jarring. |
| 9. No interstitial | Results appear instantly after the last question -- no transition, no anticipation | `showStep()` goes from step 20 directly to the results section. No intermediate state. |

**Key coupling:** The interstitial (flaw 9) is the natural home for the email gate (flaw 6). Non-scored questions (flaw 4) could be moved to a different phase (pre-quiz or post-quiz), changing perceived length and UX flow. Auto-advance timing (flaw 8) interacts with question count -- fewer questions make each one more consequential, so accidental taps hurt more.

### Standalone: Flaw 10 (Answer Order)
This is purely a presentation-layer concern with no data or classifier coupling. It can be solved independently.

---

## Proposed Architecture

### Component Map

```
BEFORE (current):
  quiz-data.ts -----> quiz.astro (renders all 20 as identical steps)
  classifier.ts ----> quiz.astro (client-side classify on step 21)
  archetype-content.ts -> quiz.astro (populates result DOM)

AFTER (proposed):
  quiz-data.ts -----> [NEW] quiz-engine.ts -----> quiz.astro
  classifier.ts ----> [NEW] quiz-engine.ts         |
  archetype-content.ts -----------------------> quiz.astro
                                                    |
                                          [NEW] interstitial + email gate
                                                    |
                                          quiz-submit.ts (already exists)
```

### Component 1: Revised Question Pool (`src/lib/quiz-data.ts`)

**Responsibility:** Define the reduced, weighted, typed question set.

**Changes to data model:**

```typescript
// Existing types retained, new fields added:

export type QuestionFormat =
  | 'single-select'    // current: pick one from N options
  | 'forced-rank'      // NEW: rank 2 from 4, first gets more points
  | 'scenario-react'   // NEW: "what do you do?" with less transparent mapping
  | 'spectrum';        // NEW: slider between two poles (A vs D, B vs C)

export interface Question {
  id: string;
  number: number;        // display order (1-based, sequential)
  text: string;
  format: QuestionFormat; // NEW: determines rendering and interaction model
  answers: Answer[];
  scored: boolean;
  phase: 'scored' | 'segmentation' | 'product-research'; // NEW: replaces boolean `scored`
}

export interface ScoringWeight {
  dimension: Dimension;
  points: number;         // CHANGED: no longer always 4. Range: 2-6.
}
```

**Question count target: 12 total.**
- 9 scored questions (down from 15)
- 3 segmentation/product-research questions (down from 5), moved to dedicated phases

**Question format distribution (9 scored):**
- 4 single-select (refined from current pool -- least transparent wording)
- 2 forced-rank (new format: rank 2 of 4 options, top pick gets 6 points, second pick gets 3)
- 2 scenario-react (new format: situational prompt with 4 responses that aren't obviously dimension-aligned)
- 1 spectrum (new format: slider between two dimensional poles, e.g., "structure vs mystery")

**Variable weighting scheme:**
- Single-select: 4 points (unchanged)
- Forced-rank: 6 points (rank 1) + 3 points (rank 2) -- two dimensions scored per question
- Scenario-react: 4 points (same as single-select, but the wording hides the dimension)
- Spectrum: 2-6 points depending on slider position, split between the two poles

**Maximum possible score per dimension with 9 questions:**
- With careful question design, each dimension should be reachable in range [0, ~36-42]
- This gives the classifier sufficient spread to discriminate

**Contracts:**
- `questions` export remains a `Question[]` -- no breaking structural change
- `computeScores()` continues to work because it reads `answer.scoring[]` -- weights are already per-answer
- The `ScoringWeight.points` field already supports variable values; only the `w()` helper enforced +4

**Answer order:** Each question's `answers[]` array defines the _canonical_ order. Shuffling is a presentation concern handled by the UI layer (Component 4).

### Component 2: Revised Classifier (`src/lib/classifier.ts`)

**Responsibility:** Map `DimensionScores` to one of 6 `ArchetypeSlug` values with fair distribution.

**Changes to classification logic:**

The current cascade has two structural problems:
1. Ascending Seeker has no positive condition -- it's the catch-all.
2. Grounded Mystic and Flow Artist require strict dual-domination that's nearly impossible to achieve.

**New algorithm: Threshold + Affinity, replacing priority cascade.**

```typescript
export interface ClassificationResult {
  primary: ArchetypeSlug;
  scores: DimensionScores;
  confidence: number;         // 0-1, how clearly the primary stands out
  secondary: ArchetypeSlug;   // runner-up archetype (useful for content personalization)
}

export function classify(scores: DimensionScores): ClassificationResult {
  // Step 1: Normalize scores to percentages of total
  // Step 2: Check composite archetypes first (GM, FA) using RELAXED thresholds
  // Step 3: Check primary archetypes (AW, EI, SD, AS) using dimension dominance
  // Step 4: Ascending Seeker gets a POSITIVE condition (C is dominant or co-dominant)
  // Step 5: True fallback only if no condition matches (should be rare/impossible)
}
```

**Specific classifier rules (order still matters for tie-breaking):**

```
grounded_mystic:    A >= 30% AND D >= 25% AND (A+D) >= 60% of total
flow_artist:        B >= 30% AND C >= 25% AND (B+C) >= 60% of total
air_weaver:         A is strictly highest dimension
embodied_intuitive: B is strictly highest dimension
ascending_seeker:   C is strictly highest dimension  <-- NEW: positive condition
shadow_dancer:      D is strictly highest dimension
```

**Tie-breaking when two dimensions are equal and highest:**
- A=D highest: grounded_mystic (natural composite)
- B=C highest: flow_artist (natural composite)
- A=B highest: air_weaver (operator preference: analytical users skew Air Weaver)
- A=C highest: ascending_seeker
- B=D highest: embodied_intuitive
- C=D highest: shadow_dancer
- 3+ way tie: air_weaver (current behavior preserved)

**Backward compatibility contract:**
- `classify()` signature changes: it now returns `ClassificationResult` instead of just `ArchetypeSlug`.
- **Migration path:** Add a `classifyLegacy()` that returns just the slug, wrapping the new function. Update callers incrementally. The API endpoint uses `classify()` result directly; the quiz UI uses it for display.
- `computeScores()` is unchanged.
- `DimensionScores` is unchanged.
- `ArchetypeSlug` is unchanged.

**Percentage-based thresholds vs. absolute thresholds:**
Percentage-based is necessary because variable weighting means the total score varies per quiz session. A user who answers 9 questions with a mix of 4-point and 6-point questions will have a different total than one who hits all spectrum questions. Percentages normalize this.

### Component 3: Quiz Phase Sequencer (`src/lib/quiz-engine.ts`) -- NEW

**Responsibility:** Orchestrate the quiz flow as a state machine with distinct phases. This module owns the _sequence_ but not the _rendering_.

```typescript
export type QuizPhase =
  | 'intro'
  | 'scored-questions'    // the 9 scored questions
  | 'segmentation'        // 2-3 non-scored questions (experience level, pain point)
  | 'email-gate'          // email capture before results
  | 'calculating'         // interstitial animation
  | 'results';            // archetype reveal

export interface QuizState {
  phase: QuizPhase;
  questionIndex: number;        // within current phase's question set
  answers: Record<string, string>;
  email: string | null;
  firstName: string | null;
  startTime: number;
  phaseStartTime: number;
}

export interface QuizEngine {
  getState(): Readonly<QuizState>;
  getCurrentQuestion(): Question | null;
  getProgress(): { current: number; total: number; percent: number };
  answerQuestion(questionId: string, answerId: string): void;
  goBack(): boolean;
  advance(): QuizPhase;          // returns the new phase after advancement
  submitEmail(email: string, firstName?: string): void;
  getResult(): ClassificationResult | null;
  getShuffledAnswers(question: Question): Answer[]; // deterministic per-session shuffle
}
```

**Phase flow:**

```
intro --> scored-questions (9 Qs, progress: 1/9 to 9/9)
      --> segmentation (2 Qs, labeled "Two more questions about you", no progress bar numbers)
      --> email-gate (single screen: "See your archetype" + email form)
      --> calculating (3-5 second animated interstitial)
      --> results (archetype reveal with full content)
```

**Design decisions:**
- Segmentation questions come AFTER scored questions. This makes the "quiz" feel shorter (9 questions), and the segmentation feels like a post-quiz bonus. The transition between phases uses a visual separator ("Almost done -- two quick questions about your tarot experience").
- The email gate sits between answering and results. The user has invested effort; the reveal is the incentive. Skip is possible but with reduced content (archetype name only, no description, no journey link).
- The calculating interstitial provides dramatic tension. It also serves as the async window for the `quiz-submit.ts` API call -- the email + answers are submitted during this animation, so the user doesn't see a loading spinner.

**Answer shuffling:**
- `getShuffledAnswers()` uses a seeded PRNG (seed = session start timestamp) to produce a consistent shuffle per question per session. This means going back and forth shows the same order, but different sessions see different orders.
- The seed is stored in `QuizState.startTime`.

**Contracts with existing systems:**
- Consumes `questions` from `quiz-data.ts`
- Consumes `classify()` and `computeScores()` from `classifier.ts`
- Does NOT import anything from the UI layer
- Does NOT make network calls -- the UI layer calls the API

### Component 4: Revised Quiz UI (`src/pages/quiz.astro`)

**Responsibility:** Render the quiz experience. Delegates all state management to `quiz-engine.ts`.

**Structural changes:**

1. **Phase-aware rendering:** Instead of rendering all 20 questions at build time and showing/hiding, render phase containers. The scored-questions phase renders only the current question (or pre-renders all 9 and shows/hides). The segmentation phase renders its 2-3 questions. The email-gate and calculating phases are distinct sections.

2. **Auto-advance timing:** Changed from 500ms to **800ms** for single-select, **no auto-advance** for forced-rank and spectrum formats (these require deliberate interaction to complete).

3. **Progress bar:** Shows "N of 9" during scored questions. Hidden during segmentation, email gate, and calculating phases.

4. **Answer shuffling:** Before rendering answers for a question, call `engine.getShuffledAnswers(question)` to get the shuffled order. Apply it to the DOM.

5. **Email gate screen:**

```html
<section id="email-gate" class="quiz-step">
  <div class="glass-panel ...">
    <h2>Your archetype is ready.</h2>
    <p>Enter your email to see your full result and receive your personalized reading guide.</p>
    <form id="email-form">
      <input type="text" name="firstName" placeholder="First name (optional)" />
      <input type="email" name="email" placeholder="Your email" required />
      <input type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" /> <!-- honeypot -->
      <button type="submit">Reveal My Archetype</button>
    </form>
    <button id="skip-email" class="text-sm ...">Skip for now</button>
  </div>
</section>
```

6. **Calculating interstitial:**

```html
<section id="calculating" class="quiz-step">
  <div class="glass-panel ...">
    <div class="calculating-animation"><!-- CSS-animated sigil/symbol --></div>
    <p class="calculating-text"></p>  <!-- Rotating text: "Reading the patterns...", "Consulting the elements...", "Your archetype is emerging..." -->
  </div>
</section>
```

During this phase, the UI fires the `quiz-submit.ts` API call. The interstitial runs for a minimum of 3 seconds regardless of API response time. If the API fails, results still display (client-side classification is canonical; the API is for email capture, not for results).

7. **New question format renderers:**

```
single-select:  same as current (list of buttons)
forced-rank:    drag-and-drop or click-to-rank (numbered slots)
scenario-react: identical to single-select visually, different question framing
spectrum:       horizontal slider with two endpoint labels
```

Each format gets its own rendering function in the `<script>` block, dispatched by `question.format`.

**Contracts:**
- Consumes `QuizEngine` from `quiz-engine.ts`
- Consumes archetype content from `archetype-content.ts`
- Calls `quiz-submit.ts` API during the calculating phase
- Fires GA4 + Meta Pixel events at: quiz_started (intro -> Q1), quiz_completed (results reveal), email_captured (email submit), quiz_skipped_email (skip click)
- Result permalink pages (`/quiz/result/[archetype]`) are unaffected -- they're static and don't depend on quiz state

### Component 5: Revised API Endpoint (`src/pages/api/quiz-submit.ts`)

**Responsibility:** Server-side validation, classification, and Loops.so push. Mostly unchanged.

**Changes:**
- Answer validation must accept the new question pool (9 scored + 2-3 segmentation). The current validation checks `scoredQuestionIds` -- this set shrinks from 15 to 9. The segmentation question IDs change.
- The `computeScores()` call continues to work because it reads scoring weights from the question data.
- New field in request body: `quizVersion: string` (e.g., `"v2"`). This allows the API to distinguish between v1 (20-question) and v2 (12-question) submissions during migration. Default: `"v2"`.

**Contracts:**
- Request body: `{ email, firstName?, answers, website?, quizVersion? }`
- Response body: unchanged: `{ success: true, archetype }` or `{ error: string }`
- Loops.so event name: unchanged: `quiz_completed`
- Loops.so contact properties: unchanged fields, but `experienceLevel`, `painPoint` etc. may come from different question IDs

---

## Interface Specifications

### Interface 1: QuizEngine <-> quiz.astro

```typescript
// quiz.astro creates the engine on mount:
const engine = createQuizEngine(questions);

// UI calls these in response to user actions:
engine.answerQuestion(questionId, answerId);
engine.goBack();
engine.advance();
engine.submitEmail(email, firstName);

// UI reads state for rendering:
engine.getState();
engine.getCurrentQuestion();
engine.getProgress();
engine.getShuffledAnswers(question);
engine.getResult();
```

The engine is a pure state machine. It never touches the DOM. The UI subscribes to state changes by calling `getState()` after each mutation.

### Interface 2: quiz.astro <-> quiz-submit.ts API

```typescript
// Request (fired during calculating interstitial):
POST /api/quiz-submit
{
  email: string;
  firstName?: string;
  answers: Record<string, string>;  // all answered questions (scored + segmentation)
  website?: string;                 // honeypot
  quizVersion: "v2";
}

// Response:
{ success: true, archetype: string }
// or
{ error: string }
```

The API response archetype is used as a server-side integrity check. The client has already computed the result via `engine.getResult()`. If they disagree, log the discrepancy but show the server result.

### Interface 3: quiz-data.ts <-> classifier.ts

```typescript
// Unchanged: computeScores reads question.answers[].scoring[]
// The variable weights (2-6 instead of flat 4) are transparent to computeScores --
// it already sums whatever `points` value it finds.

// Changed: classify() returns ClassificationResult instead of ArchetypeSlug
// A classifySlug() wrapper is provided for backward compat.
```

### Interface 4: quiz-engine.ts <-> classifier.ts

```typescript
// quiz-engine calls computeScores + classify during the 'calculating' phase
// It stores the ClassificationResult in its state
// The UI reads it via engine.getResult()
```

---

## Data Flow: Complete Quiz Session

```
1. User clicks "Begin the Reading"
   UI: engine.advance() -> phase: 'scored-questions', questionIndex: 0
   UI: renders Q1 with shuffled answers
   Analytics: quiz_started event

2. User answers Q1-Q9 (scored questions)
   For each: engine.answerQuestion(qId, aId) -> questionIndex++
   UI: engine.getProgress() -> "3 of 9", etc.
   Auto-advance: 800ms for single-select, manual for forced-rank/spectrum
   Back button: engine.goBack() -> questionIndex--

3. After Q9, engine.advance() -> phase: 'segmentation'
   UI: shows "Almost done" transition text
   UI: renders 2 segmentation questions (experience level, pain point)
   Progress bar hidden

4. After segmentation, engine.advance() -> phase: 'email-gate'
   UI: renders email form
   User enters email -> engine.submitEmail(email, firstName)
   OR user clicks "Skip" -> engine.advance() with email=null

5. engine.advance() -> phase: 'calculating'
   UI: shows animated interstitial (3-5 seconds)
   Background: engine internally calls computeScores + classify, stores result
   Background: UI fires POST /api/quiz-submit (if email was provided)
   Analytics: email_captured or quiz_skipped_email

6. After min 3 seconds, engine.advance() -> phase: 'results'
   UI: reads engine.getResult() -> ClassificationResult
   UI: reveals archetype with staggered animations (existing logic)
   Analytics: quiz_completed with archetype + confidence
```

---

## Migration Strategy

The redesign touches 4 existing files and adds 1 new file. The changes are coupled, so they must ship together, but they can be built incrementally.

**Build order (dependency-respecting):**

1. **quiz-data.ts** -- Revise question pool. New questions, variable weights, format field, phase field. This is the foundation everything else reads.

2. **classifier.ts** -- Implement percentage-based thresholds and ClassificationResult. Add classifySlug() wrapper. This depends on the new scoring ranges from step 1.

3. **quiz-engine.ts** -- New file. Implement state machine, phase sequencing, answer shuffling. Depends on quiz-data.ts and classifier.ts.

4. **quiz.astro** -- Rewire UI to use quiz-engine. Add email gate, interstitial, new question format renderers. Depends on quiz-engine.ts.

5. **quiz-submit.ts** -- Update validation for new question IDs and count. Add quizVersion field. Depends on quiz-data.ts.

**Test strategy:**
- quiz-data.test.ts must be rewritten (new question count, new formats, variable weights)
- classifier.test.ts must be rewritten (new algorithm, new return type, distribution fairness tests)
- NEW: quiz-engine.test.ts (state machine transitions, phase sequencing, shuffle determinism)
- quiz-submit.test.ts needs updates for new question IDs
- quiz-flow.spec.ts (Playwright) needs updates for new flow (email gate, interstitial, fewer questions)

**Rollback:** The v1 quiz can be preserved by keeping the current question pool and classifier as `quiz-data-v1.ts` and `classifier-v1.ts`. The API's `quizVersion` field enables dual-version support if needed.

---

## Risks and Open Questions

### Risks

1. **Archetype distribution shift.** Changing the classifier from priority cascade to percentage thresholds will change which archetypes people get. Existing email sequences assume certain distribution patterns. Need baseline data (what % of the 14 Tally submissions went to each archetype?) to set thresholds.

2. **Forced-rank and spectrum UX complexity.** These new question formats are harder to implement accessibly (keyboard navigation, screen readers, touch targets). If they add too much implementation cost, fall back to more scenario-react questions (same rendering as single-select, different question design).

3. **Email gate friction.** Any gate before results will reduce completion-to-result conversion. The skip option mitigates this, but the skip path shows reduced content. This tradeoff is intentional (email capture is the funnel's purpose), but the skip experience must be good enough that skippers still share.

4. **Calculating interstitial + API race.** If the API takes >5 seconds (Loops.so timeout), the interstitial must still end gracefully. The client-side result is always available; the API is best-effort for email capture. The current timeout logic in quiz-submit.ts (5s AbortController) already handles this.

### Open Questions for the Roundtable

1. **Which 6 questions from the current 15 should be cut?** This is a content decision, not an architecture decision. The structure supports any 9 from the pool. The Daydreamer or Operator should identify which questions are most distinctive and least transparent.

2. **Should the skip-email path show partial results or just the archetype name?** Partial results (name + element + one sentence) vs. full results (current reveal). This is a conversion optimization decision.

3. **Should segmentation questions move to BEFORE scored questions (as a warmup) or AFTER?** Architecturally either works. Before: user feels they're "already in the quiz" after 2 easy questions. After: scored questions come first while attention is highest. The engine supports both orderings.

4. **Confidence threshold for "mixed archetype" messaging.** The new ClassificationResult includes confidence. Should low-confidence results (e.g., 0.3) show "You're a blend of X and Y" messaging, or always show the primary? This affects archetype-content.ts and the results UI.

---

## Summary of Deliverables

| Component | File | Action | Depends On |
|-----------|------|--------|------------|
| Question Pool | `src/lib/quiz-data.ts` | Major revision | -- |
| Classifier | `src/lib/classifier.ts` | Rewrite algorithm | quiz-data.ts |
| Quiz Engine | `src/lib/quiz-engine.ts` | **New file** | quiz-data.ts, classifier.ts |
| Quiz UI | `src/pages/quiz.astro` | Major revision | quiz-engine.ts, archetype-content.ts |
| Quiz API | `src/pages/api/quiz-submit.ts` | Moderate update | quiz-data.ts |
| Tests | `tests/classifier.test.ts` | Rewrite | classifier.ts |
| Tests | `tests/quiz-data.test.ts` | Rewrite | quiz-data.ts |
| Tests | `tests/quiz-engine.test.ts` | **New file** | quiz-engine.ts |
| Tests | `tests/quiz-submit.test.ts` | Update | quiz-submit.ts |
| Tests | `tests/quiz-flow.spec.ts` | Update | quiz.astro |
