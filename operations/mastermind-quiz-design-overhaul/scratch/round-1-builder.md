# Round 1 -- Builder Analysis: Quiz Design Overhaul

## Existing System Anatomy

Before proposing anything, here is what actually exists in code and how it constrains what we can do.

### Data Model (src/lib/quiz-data.ts)

- **20 questions** exported as `Question[]`. Each has: `id`, `number`, `text`, `answers[]`, `scored: boolean`.
- **15 scored questions** (Q1, Q4-Q10, Q12-Q18) contribute to 4 dimensions (A/B/C/D).
- **5 non-scored questions** (Q2, Q3, Q11, Q19, Q20) collect segmentation data (experience level, pain point, flow state, card back preference, product interest).
- Every scored answer awards a flat `+4` to exactly one dimension -- except Q7-E and Q8-E which dual-score `+4 A` and `+4 D` (Grounded Mystic detectors).
- Answer IDs follow `Q{number}-{letter}` format. This is referenced in the API validation, tests, and client-side state machine.

### Classifier (src/lib/classifier.ts)

- **Priority cascade** -- first matching condition wins:
  1. `grounded_mystic`: A > B AND A > C AND D > B AND D > C (strict)
  2. `flow_artist`: B > A AND B > D AND C > A AND C > D (strict)
  3. `air_weaver`: A >= B AND A >= C AND A >= D
  4. `embodied_intuitive`: B >= A AND B >= C AND B >= D
  5. `shadow_dancer`: D >= A AND D >= B AND D >= C
  6. `ascending_seeker`: fallback
- `computeScores()` sums weights from answer map, ignoring non-scored questions.
- The all-tie (0,0,0,0 or N,N,N,N) always resolves to `air_weaver` due to priority 3's `>=` checks.

### Quiz UI (src/pages/quiz.astro)

- Server-rendered Astro page. Questions rendered at build time via `{questions.map()}`.
- Client-side `<script>` block (~380 lines) manages: intro screen, question stepping, answer selection with `.selected` class, progress bar, results reveal with staggered animations, share links, analytics (GA4 + Meta Pixel).
- **Auto-advance**: 500ms `setTimeout` after answer click. Back button exists (except Q1). Cancels pending timers.
- **No email gate**: results display immediately. Quiz-submit API exists but is not called from quiz.astro -- it's a separate endpoint.
- State: `{ currentStep: number, answers: Record<string, string>, startTime: number }`.

### Server API (src/pages/api/quiz-submit.ts)

- Accepts `{ email, firstName, answers, website }`. Website is honeypot.
- Server-side validates answers (all scored questions answered, IDs match quiz-data).
- Server-side re-runs `computeScores()` + `classify()` -- does not trust client.
- Pushes to Loops.so with archetype, scores, segmentation data.
- Rate limiting: 10 global, 3 per-email.
- This endpoint is **not called** from quiz.astro today. It expects email to be submitted alongside quiz answers.

### Test Suite

- **27 test files** (Vitest + Playwright). Key ones:
  - `classifier.test.ts`: 35+ tests covering all priority levels, ties, boundaries. Frozen-test-file protocol.
  - `quiz-data.test.ts`: 40+ structural tests (question count, scored/non-scored split, answer counts, scoring patterns, corrections). Frozen-test-file.
  - `quiz-submit.test.ts` + `quiz-submit-medium.test.ts`: API validation, rate limiting, Loops.so integration.
  - `quiz-flow.spec.ts`: Playwright E2E (intro screen, start button, result pages, canonical URLs, clipboard copy).
- Total: 562 passing tests at last handoff. Tests assert against current 20-question, 15-scored structure extensively.

### Key Constraints from Existing Code

1. **quiz-submit.ts hardcodes scored question validation**: `scoredQuestionIds` is built from `questions.filter(q => q.scored)` at module load. Changing question count/IDs requires updating this validation and its tests.
2. **quiz-data.test.ts asserts exact counts**: `toHaveLength(20)`, `toHaveLength(15)` scored, `toHaveLength(5)` non-scored, exact question numbers. These must change.
3. **classifier.test.ts asserts all dimensions use +4**: "every scoring weight is exactly +4 points". Variable weighting requires updating this contract.
4. **quiz.astro renders all 20 questions at build time**: The `{questions.map()}` loop renders all questions. Removing questions = fewer rendered sections.
5. **Progress bar** uses `TOTAL_QUESTIONS = questions.length` (currently 20).
6. **E2E tests** assert on `[data-step="1"]` becoming active after clicking start. Step numbering tied to array index.

---

## Flaw-by-Flaw Implementation Analysis

### Flaw 1: Question Homogeneity -- Same "pick your flavor" pattern

**What the code shows:** All 15 scored questions follow identical structure: one question text string, 4 answer buttons, each answer maps to exactly one dimension (A/B/C/D) with +4 points. Every question is literally "which dimension resonates?" phrased differently.

**Implementation approach:** Introduce a `questionType` field to the `Question` interface. Types:
- `'preference'` (existing pattern -- keep 5-6 of the best)
- `'scenario'` (situational: "You're in X situation, you do Y")
- `'ranking'` (rank 2-3 options from a set, generating multi-dimensional signal)
- `'spectrum'` (slider between two poles, e.g., "structure vs. mystery")
- `'forced_choice'` (choose between two, each loading different dimensions)

**Files to modify:**
- `src/lib/quiz-data.ts`: Add `questionType: QuestionType` to `Question` interface. New questions with diverse types.
- `src/pages/quiz.astro`: Conditional rendering per `questionType` in the `{questions.map()}` block. Different UI components per type.
- `tests/quiz-data.test.ts`: Update to validate `questionType` field exists.

**Complexity risk:** HIGH. This is the hardest flaw. Each new question type needs its own UI component, its own scoring logic, and its own answer data shape. The `Answer` interface currently assumes text + scoring weights. A spectrum type needs different data (two poles, continuous score mapping). A ranking type needs ordered selection UI. This is where most of the engineering time goes.

**MVP cut:** For v1, keep `preference` and `scenario` only (both use same answer-button UI). Defer `ranking`, `spectrum`, and `forced_choice` to v2. Rewrite question text to feel more varied even within the button-select format.

### Flaw 2: Ascending Seeker Fallback Junk Drawer

**What the code shows:** `ascending_seeker` is literally `return 'ascending_seeker'` at the bottom of `classify()` -- the fallback for everything that doesn't match the 5 named conditions. C-dominant profiles end up here, but so does any ambiguous score pattern. The classifier has no positive definition for Ascending Seeker.

**Implementation approach:** Give Ascending Seeker a positive condition (C-dominant check) before the fallback. Add a seventh "true fallback" handler.

```typescript
// Before the final return:
// Priority 5.5: Ascending Seeker -- C is at least as high as every other dimension
if (C >= A && C >= B && C >= D) {
  return 'ascending_seeker';
}

// True fallback: classify based on highest individual score
// or return a balanced/mixed result
```

**Files to modify:**
- `src/lib/classifier.ts`: Add positive condition for Ascending Seeker. Handle true-ambiguity fallback.
- `tests/classifier.test.ts`: New tests for positive Ascending Seeker condition. Tests for the new true-fallback behavior. Existing tests should mostly still pass since C-dominant cases already fell to `ascending_seeker`.

**Complexity risk:** MEDIUM. The existing cascade is well-tested. Adding a positive condition for C doesn't break existing behavior (C-dominant was already AS). The real question is: what happens to genuinely ambiguous profiles that aren't C-dominant? Options: (a) default to Air Weaver (current tie behavior), (b) show a "blended" result page, (c) pick the archetype with lowest representation in the database (growth hacking). Option (a) is simplest, (c) is interesting but requires analytics infrastructure.

### Flaw 3: Flow Artist + Grounded Mystic Unreachable

**What the code shows:** Both require strict dominance of two paired dimensions over the other two:
- Grounded Mystic: A > B AND A > C AND D > B AND D > C (4 strict inequalities)
- Flow Artist: B > A AND B > D AND C > A AND C > D (4 strict inequalities)

With flat +4 scoring and 15 questions, you need both paired dimensions to strictly exceed both opposing ones. This is hard to achieve when questions split evenly. The dual-scored Q7-E and Q8-E help Grounded Mystic (+4A, +4D each), but Flow Artist has no equivalent dual-scorer.

**Implementation approach -- three mechanisms working together:**

1. **Add Flow Artist dual-scored answers** (B+C) on 1-2 questions, parallel to Q7-E/Q8-E for Grounded Mystic.
2. **Variable weighting** (Flaw 7) makes some questions weight higher, creating more separation.
3. **Relaxed thresholds** -- consider changing strict `>` to ratio-based: `(A + D) / (B + C) > threshold` instead of 4 separate strict inequalities.

**Files to modify:**
- `src/lib/quiz-data.ts`: Add dual-scored B+C answers to 1-2 questions.
- `src/lib/classifier.ts`: Potentially adjust combination archetype conditions.
- `tests/classifier.test.ts`: Add reachability tests. Construct answer sets that produce each archetype.
- `tests/quiz-data.test.ts`: Update dual-scoring assertions (currently only Q7-E and Q8-E).

**Complexity risk:** HIGH. Changing classifier conditions affects every archetype's probability. Need simulation: generate all possible answer combinations for the reduced question set, compute distribution across 6 archetypes, verify no archetype is unreachable or dominates > 40%.

### Flaw 4: Non-Scored Questions Mixed with Scored

**What the code shows:** Non-scored questions appear at positions 2, 3, 11, 19, 20. They're interleaved with scored questions, making the quiz feel longer and the progress bar misleading. Q19 ("Card Back Preference?") and Q20 ("If we created something...") are product research questions that feel jarring mid-personality-quiz.

**Implementation approach:** Move non-scored questions to dedicated sections:
- Q2 (experience level) and Q3 (pain point): Move to **pre-quiz intake** -- shown before Q1, labeled as "Tell us about yourself" with different visual treatment.
- Q11 (flow state): Either **convert to scored** (it already mirrors dimension language) or remove.
- Q19, Q20 (product research): Move to **post-results** section on the result page or a separate survey. These should not be in the archetype quiz.

**Files to modify:**
- `src/lib/quiz-data.ts`: Restructure. Add a `phase` field: `'intake' | 'scored' | 'post'`, or separate into different exported arrays.
- `src/pages/quiz.astro`: Render intake questions in a distinct section before the scored quiz. Remove post-quiz research questions from main flow.
- `src/pages/quiz/result/[archetype].astro`: Optionally add product research questions here.
- `tests/quiz-data.test.ts`: Update structural assertions.

**Complexity risk:** LOW-MEDIUM. The rendering and state machine logic in quiz.astro already uses `step` counting. Separating phases just means different step ranges. The tricky part is the API: `quiz-submit.ts` validates that all scored questions are answered. Non-scored questions being optional is already handled (the validator only checks `scoredQuestionIds`).

### Flaw 5: Too Long (20 Questions, Standard is 7-12)

**What the code shows:** 20 questions. 15 scored, 5 non-scored. Industry standard for personality quizzes is 7-12 questions. The intro text says "Twenty questions. Five minutes."

**Implementation approach:** Cut to 10-12 total questions:
- Keep 8-9 highest-signal scored questions.
- Keep 1-2 segmentation questions (experience level, pain point) as pre-quiz intake.
- Drop product research (Q19, Q20) entirely from the quiz flow.
- Drop Q11 (flow state) or convert to scored.

**Which scored questions to keep?** Evaluate by:
1. **Dimension coverage**: Each dimension needs 8-9 appearances across all answers (for adequate scoring range).
2. **Question distinctiveness**: Drop questions that are near-duplicates (Q4 and Q15 both ask "when do you feel most alive/free").
3. **Combination archetype signal**: Must keep at least one dual-scorer for Grounded Mystic (Q7-E or Q8-E). Need a new B+C dual-scorer for Flow Artist.

**Proposed cut** (subject to content review):
- KEEP: Q1 (2am scenario), Q5 (receiving guidance), Q6 (core belief), Q7 (learning style -- has GM dual-scorer), Q9 (watching performance), Q12 (derailment pattern), Q14 (tarot desire), Q16 (defying gravity), Q17 (illogical response)
- CUT: Q4 (similar to Q15), Q8 (similar to Q7 -- but keep its E option as variant on Q7), Q10 (similar to Q14), Q13 (similar to Q12 but tarot-specific), Q15 (similar to Q4), Q18 (meta-question about the quiz itself)
- RESTRUCTURE: Q2 + Q3 to intake. Q11 convert to scored or drop. Q19 + Q20 to post-results.

This gives: 2 intake + 9 scored + 0 in-quiz non-scored = 11 total questions in main flow.

**Files to modify:**
- `src/lib/quiz-data.ts`: Remove cut questions. Renumber. Add new question(s).
- `src/lib/classifier.ts`: No changes to classifier logic (it works on dimension scores regardless of question count).
- `src/pages/quiz.astro`: Update intro text. Progress bar adapts automatically via `questions.length`.
- `src/pages/api/quiz-submit.ts`: Validation auto-adapts (built from `questions` at module load).
- `tests/quiz-data.test.ts`: Major rewrite -- all count assertions, question number assertions, specific ID checks.
- `tests/classifier.test.ts`: `computeScores` tests that use specific answer IDs need updating. `classify()` pure-function tests are unaffected.
- `tests/quiz-submit.test.ts`: Tests that construct full answer payloads need updating.

**Complexity risk:** HIGH. This is the highest-blast-radius change. Every test that references specific question IDs breaks. Every test that asserts question counts breaks. The quiz-submit API tests construct complete answer payloads. This should be done first (or at least planned first) because every other flaw's implementation depends on knowing the final question set.

### Flaw 6: No Email Gate Before Results

**What the code shows:** quiz.astro reveals results immediately after the last question. `quiz-submit.ts` exists as an API endpoint but is **never called** from the quiz page. The API expects `{ email, firstName, answers }` but the quiz UI has no email form.

**Implementation approach:** Insert an email capture screen between the last scored question and the results reveal.

**New UI state:** After step `TOTAL_QUESTIONS`, show an email gate screen:
- First name field (optional)
- Email field (required)
- Honeypot field (hidden `website` field)
- Submit button
- "Skip" link (controversial -- reduces capture rate but increases goodwill)
- Loading state during API call
- Error state for validation failures / rate limits

**Flow:** Last question -> email gate -> API call to `/api/quiz-submit` -> on success -> results reveal. On skip -> results reveal without API call (or with a flag that skips Loops.so push).

**Files to modify:**
- `src/pages/quiz.astro`:
  - Add new `<section id="email-gate" class="quiz-step">` with form fields.
  - Modify `showStep()`: after last question step, show email gate instead of results.
  - Add `submitQuiz()` async function: validate form client-side, POST to `/api/quiz-submit`, handle response, then `showStep(TOTAL_QUESTIONS + 2)` for results.
  - Progress bar behavior: hide during email gate (same as results).
- `src/pages/api/quiz-submit.ts`: Already handles everything needed. May want to add a `skipEmail` mode that classifies without Loops.so push (for the "skip" path).

**Complexity risk:** MEDIUM. The email form UI is straightforward. The complexity is in error handling (network failures, rate limits, Loops.so errors), form validation UX (inline errors vs. toast), and the decision about whether "skip" is allowed. If skip is allowed, we need two paths: one that calls the API and one that doesn't. The results reveal function already works -- it just needs to be triggered from the email handler instead of directly from the step counter.

**Important consideration:** The current `quiz-submit.ts` does server-side classification. If we add skip, we need client-side classification for the skip path (which already exists in quiz.astro's `revealResults()`). This means the "skip" path uses client-side classification and the "submit" path uses server-side classification. Both should produce the same result (they use the same `classify()` and `computeScores()` functions). But we should verify on the result display: use server response archetype when available, fall back to client-side.

### Flaw 7: Flat +4 Scoring

**What the code shows:** `function w(dimension: Dimension): ScoringWeight { return { dimension, points: 4 }; }` -- every single answer is worth exactly +4. No question weighs more than any other.

**Implementation approach:** Introduce variable weights. Some questions are more diagnostic than others.

- **High-signal questions** (core identity, abstract/deep): `+6` points
- **Standard questions** (preference): `+4` points (unchanged)
- **Low-signal questions** (surface-level, easy): `+2` points

This creates more score separation, making combination archetypes (Grounded Mystic, Flow Artist) more reachable when a user has strong signal on the key questions.

**Implementation:**
```typescript
// Replace single w() helper with weighted variants
function w(dimension: Dimension, points: number = 4): ScoringWeight {
  return { dimension, points };
}
```

Then update answer scoring arrays: `scoring: [w('A', 6)]` for high-signal, `scoring: [w('A', 2)]` for low-signal.

**Files to modify:**
- `src/lib/quiz-data.ts`: Add points parameter to `w()`. Update scoring on select questions.
- `tests/quiz-data.test.ts`: Remove assertion "every scoring weight is exactly +4 points". Add assertion "all weights are 2, 4, or 6" (or whatever the allowed set is).
- `tests/classifier.test.ts`: `computeScores` integration tests with specific answer IDs need score total updates.

**Complexity risk:** MEDIUM. The `computeScores()` function already handles arbitrary point values -- it just sums `weight.points`. The classifier doesn't care about point values, only totals. The risk is in rebalancing: changing weights shifts archetype probability distributions. Needs simulation testing.

### Flaw 8: Auto-Advance 500ms Too Fast

**What the code shows:** Line 362-366 in quiz.astro: `autoAdvanceTimer = setTimeout(() => { ... showStep(nextStep); }, 500);`

**Implementation approach:** Increase to 800-1000ms. Trivial change.

```typescript
autoAdvanceTimer = setTimeout(() => {
  autoAdvanceTimer = null;
  const nextStep = state.currentStep + 1;
  showStep(nextStep <= TOTAL_QUESTIONS ? nextStep : TOTAL_QUESTIONS + 1);
}, 800); // was 500
```

**Files to modify:**
- `src/pages/quiz.astro`: Change `500` to `800` (or make it a named constant `const AUTO_ADVANCE_DELAY = 800;`).

**Complexity risk:** NONE. This is a one-line change. Consider making it a named constant for readability and future tuning.

### Flaw 9: No Calculating Interstitial

**What the code shows:** After the last question, `showStep(TOTAL_QUESTIONS + 1)` goes directly to results. The results screen has staggered opacity/transform animations (`delay-300`, `delay-500`, `delay-700`, `delay-[900ms]`, `delay-[1200ms]`) but there's no "calculating" screen.

**Implementation approach:** Add a new quiz step between email gate (or last question, if no gate) and results. This step shows a thematic "reading your cards" animation for 2-3 seconds.

**New section:**
```html
<section id="quiz-calculating" class="quiz-step">
  <div class="glass-panel p-8 md:p-12 rounded-lg text-center">
    <!-- Animated card/crystal/pendulum SVG -->
    <div id="calc-animation" class="mb-6">...</div>
    <p class="text-hermetic-gold text-sm tracking-widest uppercase font-sans">
      Reading your cards...
    </p>
  </div>
</section>
```

**Flow update:**
- Last question -> email gate -> calculating interstitial (2.5s auto-advance) -> results reveal.
- Or if no email gate: last question -> calculating -> results.

**Files to modify:**
- `src/pages/quiz.astro`: Add new section HTML. Modify `showStep()` to route through calculating step. Add timer for auto-advance from calculating to results.

**Complexity risk:** LOW. The step-based state machine already supports arbitrary sections. Just add another step index. The animation itself can be CSS-only (no JS) -- spinning glyph, pulsing aura, etc. Keep it under 3 seconds to avoid user impatience.

### Flaw 10: Static Answer Order

**What the code shows:** Answers are rendered in array order at **build time** via `{q.answers.map((a) => ...)}`. Since Astro pre-renders, the HTML is baked. Every visitor sees answers in the same order (A, B, C, D). This creates positional bias (first option gets more clicks).

**Implementation approach:** Client-side shuffle at runtime.

```typescript
// In the <script> block, on step show:
function shuffleAnswers(stepEl: HTMLElement) {
  const container = stepEl.querySelector('.space-y-3');
  if (!container) return;
  const buttons = Array.from(container.querySelectorAll('.answer-btn'));
  // Fisher-Yates shuffle
  for (let i = buttons.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    container.appendChild(buttons[j]); // moves the DOM node
  }
}
```

Call `shuffleAnswers()` in `showStep()` when entering a question step, before the step becomes visible.

**Files to modify:**
- `src/pages/quiz.astro`: Add shuffle function. Call it in `showStep()` for question steps.

**Complexity risk:** LOW. DOM reordering is lightweight. The `data-answer` attribute on buttons carries the answer ID, so scoring is unaffected by visual order. One subtlety: if the user goes back to a previous question, should the order re-shuffle or stay the same as when they first saw it? For consistency, shuffle once per question and cache the order. Store shuffled order in state: `shuffledOrders: Record<string, string[]>`.

**Back-navigation consideration:** When going back, restore the same shuffle order they saw before, not re-shuffle. This prevents confusion.

---

## Dependency Graph and Build Order

```
                    +-----------+
                    | Flaw 5:   |
                    | Cut to    |
                    | 10-12 Qs  |
                    +-----+-----+
                          |
                    (defines final question set)
                          |
          +---------------+--+---------------+
          |               |                  |
    +-----v-----+  +-----v------+  +--------v--------+
    | Flaw 1:   |  | Flaw 4:    |  | Flaw 7:         |
    | Question  |  | Separate   |  | Variable        |
    | variety   |  | non-scored |  | weighting       |
    +-----+-----+  +-----+------+  +--------+--------+
          |               |                  |
          +-------+-------+-------+----------+
                  |               |
            +-----v-----+  +-----v------+
            | Flaw 3:   |  | Flaw 2:    |
            | Reachable |  | Positive   |
            | combos    |  | AS def     |
            +-----------+  +------------+
                  |               |
                  +-------+-------+
                          |
                    (classifier finalized)
                          |
    +-----------+---------+---------+-----------+
    |           |                   |           |
+---v---+ +----v----+       +------v---+ +-----v-----+
|Flaw 6:| |Flaw 9:  |       |Flaw 8:   | |Flaw 10:   |
|Email  | |Calc     |       |Auto-adv  | |Shuffle    |
|gate   | |screen   |       |800ms     | |answers    |
+-------+ +---------+       +----------+ +-----------+
```

### Phased Build Order

**Phase 1: Question Redesign (Flaws 5 + 4 + 1 + 7)**
This is the core work. Everything else depends on knowing the final question set.

1. **Design the final question set** (content + scoring). Select 8-9 scored questions from existing 15, write 1-2 new questions for variety, assign variable weights, add B+C dual-scorer for Flow Artist.
2. **Update `src/lib/quiz-data.ts`** with new question set.
3. **Update all tests** that assert question counts, IDs, scoring patterns.
4. **Verify build + test suite passes**.

**Phase 2: Classifier Fix (Flaws 2 + 3)**
With the final question set and variable weights, tune the classifier.

5. **Add positive Ascending Seeker condition** to `classify()`.
6. **Run archetype distribution simulation**: generate all/many possible answer combinations, verify all 6 archetypes are reachable with reasonable probability.
7. **Adjust weights/conditions** until distribution is healthy (no archetype < 5% or > 30%).
8. **Update classifier tests**.

**Phase 3: UI Enhancements (Flaws 6 + 8 + 9 + 10)**
These are independent of each other and can be parallelized.

9. **Email gate** (Flaw 6) -- new section in quiz.astro, wire to quiz-submit API.
10. **Auto-advance delay** (Flaw 8) -- one-line constant change.
11. **Calculating interstitial** (Flaw 9) -- new section in quiz.astro.
12. **Answer shuffle** (Flaw 10) -- client-side Fisher-Yates in script block.

**Phase 4: Integration + Polish**

13. **Full flow E2E test**: intro -> intake -> scored questions (shuffled) -> email gate -> calculating -> results.
14. **Update quiz-flow.spec.ts** Playwright tests for new flow.
15. **Update intro screen copy** (no longer "twenty questions, five minutes").
16. **Archetype distribution acceptance test**: automated test that runs N random answer sets through `computeScores` + `classify` and asserts all 6 archetypes appear with > 5% frequency.

---

## File Manifest

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `src/lib/quiz-data.ts` | 1 | New question set (10-12 Qs), variable weights, question types, B+C dual-scorer |
| `src/lib/classifier.ts` | 2 | Positive Ascending Seeker condition, potentially relaxed combo thresholds |
| `src/pages/quiz.astro` | 1,3 | Reduced question render, email gate section, calculating section, shuffle logic, auto-advance constant, updated intro copy |
| `src/pages/api/quiz-submit.ts` | 1 | Auto-adapts (validation built from quiz-data at import time) |
| `src/lib/archetype-content.ts` | -- | No changes needed |
| `src/pages/quiz/result/[archetype].astro` | 3 | Possibly add product research questions post-result |
| `tests/quiz-data.test.ts` | 1 | Major rewrite: new counts, new IDs, variable weight assertions |
| `tests/classifier.test.ts` | 2 | New Ascending Seeker positive tests, reachability tests, updated computeScores integration |
| `tests/quiz-submit.test.ts` | 1 | Updated answer payloads for new question IDs |
| `tests/quiz-submit-medium.test.ts` | 1 | Updated answer payloads |
| `tests/quiz-flow.spec.ts` | 3,4 | New E2E flow: intake -> scored -> email gate -> calculating -> results |

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `tests/archetype-distribution.test.ts` | 4 | Monte Carlo distribution test -- verify all 6 archetypes reachable at > 5% |
| `src/lib/quiz-shuffle.ts` | 3 | Optional: extract shuffle logic if it grows beyond a few lines |

### No New Dependencies

All 10 flaws are solvable with existing tech stack (Astro, TypeScript, Tailwind, Vitest, Playwright). No new npm packages needed.

---

## Complexity Risk Register

| Risk | Severity | Flaw | Mitigation |
|------|----------|------|------------|
| Test blast radius from question set change | HIGH | 5 | Do this first. Accept that ~30 tests will need rewriting. Use find-and-replace for ID patterns. |
| Archetype distribution skew after rebalancing | HIGH | 3,7 | Build Monte Carlo simulation test before implementing changes. Run it after every scoring adjustment. |
| Email gate kills completion rate | MEDIUM | 6 | Include "skip" option. Track skip rate via GA4 event. A/B test gated vs. ungated if traffic allows. |
| Variable weighting breaks Grounded Mystic / Flow Artist | MEDIUM | 7 | Simulate before deploying. The dual-scorers' value scales with their point multiplier. |
| Question type UI complexity (ranking, spectrum) | HIGH | 1 | Defer to v2. MVP uses only button-select format with better-written questions. |
| Shuffle + back-navigation state inconsistency | LOW | 10 | Cache shuffle order per question in state object. Restore on back. |
| Calculating interstitial feels fake | LOW | 9 | Keep under 3 seconds. Use thematic animation (not spinner). |

---

## What I Would Actually Type First

If I sat down to implement this right now, here is the literal sequence:

1. Create `tests/archetype-distribution.test.ts` with the Monte Carlo harness (frozen-test-file: write test first, then make it pass by adjusting scoring). This test generates 10,000 random answer sets, runs each through `computeScores` + `classify`, and asserts each archetype appears > 5% of the time. **This test will fail against the current code** -- which proves Flaws 2 and 3.

2. Open `src/lib/quiz-data.ts`, comment-annotate each question with "KEEP", "CUT", or "RESTRUCTURE" based on the analysis in Flaw 5. This is a content decision that needs operator review before code changes.

3. Once the question set is approved: rewrite `quiz-data.ts` with the final set (8-9 scored + 2 intake). Update `w()` to accept optional points parameter. Assign variable weights.

4. Update `classifier.ts` with positive Ascending Seeker condition. Run distribution test. Adjust weights until it passes.

5. Update all test files in a single sweep (they'll all be broken at this point anyway).

6. Then tackle the UI flaws (6, 8, 9, 10) -- these are independent and can be done in any order. Flaw 8 is literally 30 seconds. Flaw 10 is an hour. Flaw 9 is an hour. Flaw 6 is a half-day.

---

## Open Questions for the Operator

1. **Which questions to cut?** The analysis above proposes keeping 9 scored questions. The operator knows which questions produce the most meaningful archetype distinctions from the 14 real submissions in Tally.

2. **Allow "skip" on email gate?** Higher completion rate but lower email capture. Recommendation: allow skip, track the rate, decide later.

3. **Convert Q11 (flow state) to scored?** Its answer options already mirror dimension language perfectly. Converting it adds a 10th scored question with zero content work.

4. **Should the calculating interstitial show actual score information?** E.g., "Your strongest dimensions: Air and Shadow" -- or keep it mysterious?

5. **Variable weight values**: The analysis proposes 2/4/6. An alternative is 3/4/5 (less separation). Need to simulate both.
