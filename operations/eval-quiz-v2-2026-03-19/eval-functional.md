# Functional Evaluation Report

**Evaluator:** Functional Correctness
**Target:** Quiz v2 (quiz-design-overhaul)
**Date:** 2026-03-19

## Findings

### FUNC-01: displayOrder Never Captured or Sent by Client

**Severity:** High
**Description:** The quiz-submit API route (`src/pages/api/quiz-submit.ts`, line 184) destructures `displayOrder` from the request body and forwards it to Loops.so as an eventProperty (line 337). However, the client-side code in `src/pages/quiz.astro` never constructs or sends a `displayOrder` field in its `fetch('/api/quiz-submit', ...)` payload (lines 656-665). The shuffled answer indices are computed by `engine.getShuffledAnswerIndices()` and used for DOM reordering, but are never collected into a payload field.

This means `displayOrder` is always `undefined` in production, making it impossible to reconstruct which answer text was shown at which visual position. For any future A/B testing, answer-bias analysis, or audit of whether shuffle order affected outcomes, this data is permanently lost.

No test in any test file verifies that `displayOrder` is actually present in the client-sent payload. The E2E test `quiz-v2-e2e.spec.ts` (Suite 7) checks for `answers`, `email`, and question IDs in the captured payload, but does not assert `displayOrder` exists.

**Affected Files:**
- `src/pages/quiz.astro` (lines 656-665 -- payload construction missing `displayOrder`)
- `src/pages/api/quiz-submit.ts` (lines 184, 337 -- receives and forwards displayOrder, but it's always undefined)
- `tests/quiz-v2-e2e.spec.ts` (Suite 7 -- no assertion on displayOrder)

**Verification Criteria:** After remediation, the E2E test Suite 7 should assert that `capturedPayload['displayOrder']` is a non-null object with keys matching all 12 question IDs and values that are arrays of integers.

---

### FUNC-02: Client Does Not Send quizVersion to Server

**Severity:** High
**Description:** The `src/pages/quiz.astro` client-side `fetch` call to `/api/quiz-submit` (lines 656-665) does not include a `quizVersion` field in the POST body. The server generates `quizVersion: 'v2'` independently in two places: inside the Loops.so eventProperties (line 328) and in the API response (line 402). However, the server has no way to confirm the client is actually running v2 code vs. cached v1 code.

If a user has a cached v1 quiz page that posts to the v2 API endpoint, the server would still stamp `quizVersion: 'v2'` on the submission, producing incorrect analytics. The `quizVersion` field was designed to distinguish v1 from v2 submissions, but since the server always hardcodes `'v2'` and the client never sends a version identifier, the field provides no actual version discrimination.

The `tests/quiz-submit.test.ts` Baseline suite verifies `data.quizVersion === 'v2'` in the response (line 122), but this only confirms the server hardcodes it -- not that the client declared it.

**Affected Files:**
- `src/pages/quiz.astro` (lines 656-665 -- no quizVersion in payload)
- `src/pages/api/quiz-submit.ts` (lines 328, 402 -- hardcodes 'v2' without client validation)
- `tests/quiz-submit.test.ts` (line 122 -- tests hardcoded value, not client-declared)

**Verification Criteria:** The client POST body should include `quizVersion: 'v2'`. The server should compare client-declared version against expected version and log a warning or reject on mismatch. Test: grep for `quizVersion` in quiz.astro's fetch body.

---

### FUNC-03: Server-Side Classification Diverges from Client-Side on Confidence and Self-Select

**Severity:** High
**Description:** The client (quiz-engine.ts, `proceedFromCalculating()`, lines 261-296) applies CV-squared confidence attenuation before deciding whether to show self-select. The server (quiz-submit.ts, lines 245-246) calls `classify(scores)` directly without CV-squared attenuation. This creates two divergences:

1. **Confidence values differ.** The `confidence` value sent to Loops.so (line 333) is the raw classifier confidence, not the engine-attenuated confidence. For profiles with clustered raw scores, the classifier may report high confidence (e.g., 0.5) while the engine reports low confidence (e.g., 0.02) after CV-squared attenuation. Analytics consumers seeing the Loops.so confidence value would get a misleading picture of classification certainty.

2. **Self-select decisions invisible to server.** The server has no knowledge of whether the user was shown the self-select screen. The `selfSelected` field in the payload only conveys which archetype was chosen, not whether self-select was triggered. If a user goes through self-select and picks the same archetype the classifier would have assigned, the `selfSelected` field is set but the archetype matches -- making it indistinguishable from a non-self-select flow in analytics.

The server cannot reproduce the engine's self-select logic because it lacks the CV-squared attenuation step. If the server ever needs to verify whether self-select should have been offered, it would reach a different conclusion.

**Affected Files:**
- `src/lib/quiz-engine.ts` (lines 268-296 -- CV-squared attenuation)
- `src/pages/api/quiz-submit.ts` (lines 245-246, 333 -- raw classify() without attenuation)
- `src/pages/quiz.astro` (line 664 -- only sends selfSelected when archetype was user-chosen)

**Verification Criteria:** Either: (a) the server replicates CV-squared attenuation and logs `engineConfidence` alongside raw `classifierConfidence` in Loops.so eventProperties, or (b) the client sends `engineConfidence` in the POST payload and the server forwards it. Verify with a unit test that produces a CV-attenuated confidence below 0.15 and checks the Loops.so payload contains the attenuated value.

---

### FUNC-04: Self-Select Test Uses Conditional Assertion That Can Silently Pass

**Severity:** High
**Description:** Several self-select tests in `tests/quiz-engine.test.ts` use conditional logic that allows the test to pass without actually verifying the behavior under test:

1. **"triggers self-select when classification confidence < 0.15"** (lines 246-263): The test answers questions, then checks `if (state.classificationResult!.confidence < 0.15)` before asserting `state.phase === 'self-select'`. If the answer pattern happens to produce high confidence, the else-branch just asserts `state.phase === 'results'` -- effectively testing nothing about self-select. This is a non-deterministic test that may or may not exercise the code path it claims to test.

2. **"selectArchetype() records selection and transitions to results"** (lines 278-296): Wraps the actual assertion in `if (state.phase === 'self-select')`. If the engine doesn't reach self-select, no assertion runs at all.

3. **"records selection in state during self-select phase"** (lines 628-655): Same pattern -- wraps assertions in `if (engine.getState().phase === 'self-select')`.

The deterministic self-select test (lines 303-337) is the only one that unconditionally asserts self-select triggers. The non-deterministic tests provide false coverage confidence.

**Affected Files:**
- `tests/quiz-engine.test.ts` (lines 246-263, 278-296, 628-655)

**Verification Criteria:** All self-select tests should unconditionally assert the expected behavior. Replace conditional `if` guards with deterministic answer patterns that guarantee the expected confidence range, then assert unconditionally. Run the test suite and verify all self-select tests execute their assertion paths (add a counter or explicit fail on the else branch).

---

### FUNC-05: Dead Variable in goBack() Function

**Severity:** Medium
**Description:** In `src/lib/quiz-engine.ts`, the `goBack()` function (line 196) declares `const lastScoredIndex = questions.length - 1;` but never uses it. The actual backward search starts on the next line with a `for` loop that independently walks backward. This is dead code that suggests an incomplete refactor or a copy-paste artifact.

While not a runtime bug (the for-loop correctly finds the last scored question), it is a code smell that could mislead future maintainers into thinking `lastScoredIndex` is used somewhere.

**Affected Files:**
- `src/lib/quiz-engine.ts` (line 196)

**Verification Criteria:** `grep -n 'lastScoredIndex' src/lib/quiz-engine.ts` should return zero results after removal.

---

### FUNC-06: Forced-Pair Shuffle Swaps Content But Not ARIA/Accessibility Attributes

**Severity:** Medium
**Description:** In `src/pages/quiz.astro` (lines 431-444), when the shuffle indices for a forced-pair question indicate a swap (`shuffledIndices[0] === 1`), the code swaps `textContent` and `dataset.answer` between the two `.pair-btn` elements. However, this swap does not update any accessibility attributes, `aria-label`, or structural information that screen readers might use.

More critically, the swap uses `textContent` which strips any HTML formatting from the button text. If answer text ever contains HTML entities (e.g., smart quotes, em-dashes), the `textContent` swap would lose those entities and show raw text. Currently the answer texts are plain strings, but this is a latent fragility.

Additionally, the shuffle logic for forced-pair questions only activates the swap when `shuffledIndices[0] === 1` (i.e., when the Fisher-Yates shuffle says to reverse the order). For a 2-element array, the only possible shuffles are `[0,1]` (no swap) and `[1,0]` (swap). This is correct, but the logic only checks `shuffledIndices[0]` rather than doing a general reorder, creating an implicit assumption about the shuffle output.

**Affected Files:**
- `src/pages/quiz.astro` (lines 431-444)

**Verification Criteria:** Verify that forced-pair text is preserved exactly after shuffling by adding an E2E test that reads the button text after shuffle and compares to the expected answer text from quiz-data.ts for each of the two options.

---

### FUNC-07: Segmentation Questions Correctly Excluded From Scoring

**Severity:** Medium (confirmation with nuance)
**Description:** Segmentation questions (SEG1, SEG2) are correctly excluded from scoring in `computeScores()` (classifier.ts, lines 251-252: `if (question.phase !== 'scored') continue;`). Their answers have empty `scoring: []` arrays. This is verified by `tests/classifier.test.ts` lines 378-392 ("segmentation answers contribute zero" and "segmentation + scored answers only count scored").

However, there is an asymmetry in the API route's validation: the server requires all *scored* questions to be answered (quiz-submit.ts, lines 167-173) but treats segmentation questions as optional. The client always sends segmentation answers (quiz.astro records them via `engine.answerQuestion()`), but if a crafted API request omits SEG1/SEG2, the server proceeds without error and simply sends `null` for `experienceLevel`/`painPoint` to Loops.so (since `resolveAnswerText` returns null for missing keys, and the conditional spread `...(experienceLevel && { experienceLevel })` omits null values).

This is acceptable behavior but worth documenting: segmentation answers are not required by the server even though the client always provides them. A malicious or buggy client could submit without segmentation answers and the email drip would lack segmentation data.

**Affected Files:**
- `src/pages/api/quiz-submit.ts` (lines 167-173, 265-266)
- `src/lib/classifier.ts` (lines 251-252)
- `tests/classifier.test.ts` (lines 378-392)

**Verification Criteria:** This is a design confirmation, not a bug. If segmentation should be required, add them to `scoredQuestionIds` or create a separate required set. Existing test at quiz-submit.test.ts line 292-304 already verifies the optional behavior.

---

### FUNC-08: No Back Navigation From Calculating, Self-Select, or Results Phases

**Severity:** Medium
**Description:** The `goBack()` function in quiz-engine.ts (lines 190-214) only handles going back from `email-gate`, `segmentation`, and `scored` phases. It implicitly ignores `calculating`, `self-select`, and `results` phases (they fall through to the end of the function without any action).

In the UI (`quiz.astro`), there is no back button rendered on the calculating, self-select, or results screens. However, if a user uses browser back-button behavior (browser history API), the engine would not respond. This is a latent UX gap where users in the self-select phase who want to reconsider their answers have no way to go back.

The test suite does not test `goBack()` from calculating, self-select, or results phases.

**Affected Files:**
- `src/lib/quiz-engine.ts` (lines 190-214)
- `src/pages/quiz.astro` (no back buttons rendered for post-email-gate phases)
- `tests/quiz-engine.test.ts` (no tests for goBack from calculating/self-select/results)

**Verification Criteria:** Either: (a) add explicit no-op behavior documentation and test that `goBack()` from these phases preserves the current state, or (b) implement back navigation from self-select to email-gate or from calculating to email-gate.

---

### FUNC-09: E2E Self-Select Test Cannot Deterministically Trigger Self-Select

**Severity:** Medium
**Description:** The E2E test `quiz-v2-e2e.spec.ts` Suite 3 ("Self-select path") attempts to trigger self-select by spreading answers across dimensions (lines 185-198). However, the comment on line 92 acknowledges: "Answer shuffling + PRNG seed makes the confidence non-deterministic." The answer indices in `lowConfidenceStrategy` refer to the *visual position* of buttons in the browser, which may be shuffled differently than the data-order indices. This means:

- When the user clicks button at visual position 0, the actual answer ID depends on how `getShuffledAnswerIndices()` reordered the answers. The E2E test uses `.nth(answerIndex)` on the shuffled DOM elements, so the actual dimension scored depends on the PRNG seed (which is `Date.now()` in production since no seed is passed).

- The `waitForResults()` helper (lines 94-114) handles both branches with `.catch(() => {})` and gracefully handles whichever phase appears. This means the test **always passes regardless of whether self-select actually triggered**. It is a resilience test, not a self-select test.

The test description says "low-confidence trigger" but the implementation is effectively "either branch works." The test provides zero signal about whether self-select actually works in the browser.

**Affected Files:**
- `tests/quiz-v2-e2e.spec.ts` (Suite 3, lines 173-231)
- `tests/quiz-v2-e2e.spec.ts` (`waitForResults` helper, lines 94-114)

**Verification Criteria:** A true self-select E2E test should either: (a) pass a deterministic seed to `createQuizEngine` via a query parameter or test hook so the shuffle order is known, or (b) read the `data-answer` attributes from the DOM to determine which actual answer IDs are being selected and verify the expected confidence range. The test should assert `selfSelectActive === true`, not gracefully handle both branches.

---

### FUNC-10: All 6 Archetypes Reachable -- Verified

**Severity:** Medium (confirmation -- one nuance)
**Description:** All 6 archetypes are reachable via the classifier. This is verified by:
- `tests/classifier.test.ts` "classify() centroid ideal vectors" (lines 107-137): extreme scores produce each archetype.
- `tests/classifier.test.ts` "classify() realistic profiles" (lines 143-176): more realistic score distributions produce each archetype.
- `tests/classifier.test.ts` "integration: computeScores -> classify (v2)" (lines 463-578): full answer sets through computeScores produce each archetype.
- `tests/archetype-distribution.test.ts`: Monte Carlo with 10K random sets confirms all 6 appear at >5%.

The one nuance: reachability is tested at the classifier level with synthetic score profiles, not at the full-engine level with CV-squared attenuation. The engine's confidence attenuation could theoretically push a marginal classification into self-select territory, where the user manually selects -- but the classifier's `primary` field for that profile would still have been correct. This is not a reachability bug but a subtle distinction: some profiles may only reach certain archetypes via self-select rather than automatic classification.

**Affected Files:**
- `src/lib/classifier.ts` (centroids and classify function)
- `tests/classifier.test.ts` (centroid ideal vectors, realistic profiles, integration tests)
- `tests/archetype-distribution.test.ts` (Monte Carlo)

**Verification Criteria:** All 6 archetypes appear at >5% in Monte Carlo output. Confirmed passing. The CV-squared attenuation nuance can be verified by running a Monte Carlo through the full engine pipeline and confirming all 6 appear as `classificationResult.primary` even after attenuation.

---

### FUNC-11: Email Gate Captures Email But firstName Stored in Module Variable, Not Engine State

**Severity:** Medium
**Description:** The quiz engine's `submitEmail()` method (quiz-engine.ts, line 251) stores the email in engine state, but `firstName` is not part of the `QuizState` interface at all. In `quiz.astro`, `firstName` is captured from the form into a module-scoped variable `capturedFirstName` (line 801) and later included in the API POST body (line 661).

This design means:
1. `firstName` is invisible to the engine state machine -- `engine.getState()` never includes it.
2. If the engine state were ever serialized/restored (e.g., for session persistence), `firstName` would be lost.
3. The `firstName` is only available in the `quiz.astro` script scope. If the quiz UI were refactored to a component or framework, this module-scoped variable would need to be explicitly handled.

The API submission correctly receives both `email` and `firstName`, so the current flow works end-to-end. But the architecture is fragile: email flows through the engine state machine, firstName flows through a side channel.

**Affected Files:**
- `src/lib/quiz-engine.ts` (QuizState interface -- no firstName field)
- `src/pages/quiz.astro` (line 368: `capturedFirstName`, line 801: form capture, line 661: API payload)
- `tests/quiz-engine.test.ts` (no tests for firstName handling)

**Verification Criteria:** Either add `firstName` to `QuizState` and the `submitEmail()` signature, or document the intentional side-channel design. Test: verify that a submission with both email and firstName results in both values reaching the Loops.so payload.

---

### FUNC-12: Client API Payload Missing selfSelected When User Picks Classifier's Primary

**Severity:** Medium
**Description:** In `quiz.astro` line 664, the `selfSelected` field is conditionally included via:
```javascript
...(state.selectedArchetype && { selfSelected: state.selectedArchetype })
```

In the engine, `selectArchetype(slug)` (quiz-engine.ts line 300) sets `selectedArchetype = slug` and transitions to results. If the user is shown self-select and chooses the top-ranked archetype (which is the same as `classificationResult.primary`), then `state.selectedArchetype` will be set to that slug and `selfSelected` will be included in the payload.

The server (quiz-submit.ts line 251) then uses: `isValidArchetypeSlug(selfSelected) ? selfSelected : classificationResult.primary`. Since both match, the archetype is the same either way.

However, the analytics value is lost: there is no way to distinguish "user saw self-select and actively chose archetype X" from "user did not see self-select and was automatically classified as X." The `selfSelected` field being present means a self-select happened, but only if the user chose a *different* archetype would it be obvious. The Loops.so payload at line 323 does include `selfSelected` as a contact property when present, so presence/absence of this field could be used for segmentation -- but only if analytics consumers know to check for the field's existence rather than its value.

This is not a bug but a data-modeling gap that reduces analytics fidelity.

**Affected Files:**
- `src/pages/quiz.astro` (line 664)
- `src/pages/api/quiz-submit.ts` (lines 251, 323)

**Verification Criteria:** Consider adding a boolean `selfSelectShown: true/false` field to the API payload and Loops.so eventProperties, independent of which archetype was chosen. This allows analytics to segment "saw self-select" from "automatic classification."

---

### FUNC-13: Quiz-Submit-Medium Tests Reference "20 Questions" in Comments

**Severity:** Medium
**Description:** The `tests/quiz-submit-medium.test.ts` file contains stale comments from the v1 era:
- Line 38: `"Build a valid complete answers map — all 20 questions answered"` (v2 has 12 questions)
- The finding descriptions reference old question IDs: SYN-07 mentions "Q2-A" (line 120), SYN-11 mentions "Q11" (line 16).

While the actual test code correctly uses `questions` from quiz-data.ts (which exports the v2 12-question set), the stale comments could mislead developers. The `buildValidAnswers()` function iterates over `questions` which is the v2 array, so it correctly builds a 12-question answer map despite the "20 questions" comment.

This is a documentation accuracy issue, not a functional bug, but it reduces confidence in test correctness during code review.

**Affected Files:**
- `tests/quiz-submit-medium.test.ts` (lines 16, 38, 120)

**Verification Criteria:** `grep -n '20 questions' tests/quiz-submit-medium.test.ts` should return zero results after comment updates. Similarly for references to Q2, Q3, Q11, Q19, Q20.

---

### FUNC-14: Forced-Pair Answer Scoring Correctly Mapped After Shuffle

**Severity:** Medium (confirmation)
**Description:** Forced-pair answer scoring is verified to work correctly after shuffling. The shuffle in `quiz.astro` (lines 431-444) swaps `textContent` and `dataset.answer` between the two buttons. When the user clicks a button, the click handler reads `btn.dataset.answer` (line 750) and passes it to `engine.answerQuestion(answerId)`. Since the `data-answer` attribute is swapped along with the text content, the answerId correctly maps to the intended answer regardless of visual position.

The engine then records the answerId in `answers[question.id]`, and `computeScores()` looks up the scoring weights by answerId. Since the answerId is preserved through the shuffle, scoring is correct.

However, no test explicitly verifies that after a forced-pair shuffle, clicking the visually-first button yields the correct (potentially swapped) answerId. The unit tests verify scoring correctness for specific answerIds but don't test the shuffle-to-score pipeline. The E2E tests click buttons by position but don't verify the recorded answerId.

**Affected Files:**
- `src/pages/quiz.astro` (lines 431-444 shuffle, lines 750 click handler)
- `src/lib/classifier.ts` (computeScores lookup by answerId)
- `tests/quiz-v2-e2e.spec.ts` (Suite 5 verifies rendering but not post-shuffle scoring)

**Verification Criteria:** Add an E2E test that: (1) intercepts the API call, (2) for a forced-pair step, reads both button `data-answer` attributes from the DOM, (3) clicks the first button, (4) verifies the captured payload contains the correct answerId for that question.

---

### FUNC-15: Monte Carlo Distribution Test Uses Raw Classifier Confidence, Not Engine Confidence

**Severity:** Medium
**Description:** The `tests/archetype-distribution.test.ts` Monte Carlo self-select rate check (line 75) uses `result.confidence < 0.15` where `result` is the raw `classify()` output. In the actual quiz engine, self-select is triggered when `engineConfidence < 0.15`, where `engineConfidence = result.confidence * spreadFactor` (CV-squared attenuation). Since `spreadFactor <= 1`, the engine confidence is always <= the classifier confidence.

This means the Monte Carlo underestimates the self-select trigger rate. The test asserts `selfSelectCount < 1500` (15%), but the actual engine would trigger self-select more frequently. The memory notes state "Self-select 3.5%" but this is the raw classifier rate, not the engine rate.

This is not a broken test, but it measures the wrong quantity. The actual self-select rate in production would be higher than reported.

**Affected Files:**
- `tests/archetype-distribution.test.ts` (lines 72-78)
- `src/lib/quiz-engine.ts` (lines 268-296 -- CV-squared attenuation)

**Verification Criteria:** Create a Monte Carlo test that uses the full `createQuizEngine` pipeline (answer all questions, proceedFromCalculating, check phase === 'self-select') to measure the true self-select rate. Compare against the classifier-only rate. Both should be < 15%.

---

## Summary

- Total findings: 15
- By severity: Critical: 0, High: 3, Medium: 12
- Key themes: The three high-severity findings center on data fidelity gaps between the client and server: (1) `displayOrder` is never captured or sent, meaning shuffle audit data is permanently lost; (2) `quizVersion` is hardcoded server-side rather than declared by the client, defeating version discrimination; (3) the server and client compute classification confidence differently (raw vs. CV-squared attenuated), creating divergent analytics. The medium-severity findings cluster around test coverage gaps -- particularly self-select tests that use conditional assertions or non-deterministic strategies that can pass without exercising the claimed behavior -- and several architectural asymmetries (firstName side-channel, no back navigation from late phases, Monte Carlo measuring the wrong confidence metric).
