# Evaluation Report: Structural Completeness & Functional Correctness

**Evaluator lens:** Structural Completeness & Functional Correctness
**Date:** 2026-03-07
**Target:** Native quiz pipeline (quiz-data, classifier, archetype-content, quiz UI, API route, test suites)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 3     |
| Medium   | 8     |

The core pipeline -- quiz data model, classifier logic, and archetype content -- is structurally sound. All 20 questions are correctly wired, the priority-cascade classifier is exhaustive (no score pattern falls through unmatched), and the dual-scoring Grounded Mystic detectors are properly implemented. The most significant findings are in the UI interaction layer (auto-advance race condition), API input validation (empty/malicious payloads), and test coverage gaps (browser tests skip critical user flows).

---

## Findings

### [F-01]: Auto-advance setTimeout creates race condition with back button
**Severity:** High
**Affected files:** `src/pages/quiz.astro` (lines 302-306, 308-313)
**Description:** When a user selects an answer, a 500ms `setTimeout` schedules auto-advance to the next question. This timer is never cancelled. If the user clicks the back button within that 500ms window, `showStep(currentStep - 1)` fires immediately, but then the pending timeout fires and reads `state.currentStep + 1`, effectively bouncing the user forward again. The back button appears broken during this window.
**Evidence:**
```js
// Line 302-305: Timer captures state.currentStep by reference, not by value
setTimeout(() => {
  const nextStep = state.currentStep + 1;
  showStep(nextStep <= TOTAL_QUESTIONS ? nextStep : TOTAL_QUESTIONS + 1);
}, 500);
```
The back handler at line 312 sets `currentStep` to N-1 via `showStep(state.currentStep - 1)`. When the pending timeout fires 500ms after the original answer click, it reads the updated `state.currentStep` (now N-1) and advances to N -- exactly where the user was trying to leave. No `clearTimeout` mechanism exists.

---

### [F-02]: API accepts empty or minimal answers objects without validation
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts` (lines 19-24)
**Description:** The API validates only that `answers` is truthy and `typeof answers === 'object'`. It does not validate minimum answer count, answer ID format, or that answers correspond to real questions. An attacker can submit `{email: "a@b.com", answers: {}}` and create a Loops.so contact with archetype `air_weaver` (all-zero scores default to Air Weaver). This pollutes the subscriber list with meaningless data and could exhaust Loops.so free tier quotas.
**Evidence:**
```js
// Line 19-24: Only checks truthiness and type
if (!answers || typeof answers !== 'object') {
  return new Response(JSON.stringify({ error: 'Answers required' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
```
Additionally, `typeof [] === 'object'` in JavaScript, so an array passes this check. `Object.entries([])` returns `[]`, producing zero scores and a phantom Air Weaver classification.

---

### [F-03]: computeScores ignores questionId -- only answerId matters for scoring
**Severity:** High
**Affected files:** `src/lib/classifier.ts` (lines 100-108)
**Description:** `computeScores` iterates over `Object.entries(answers)` but uses only the answer ID (value) for lookup, completely ignoring the question ID (key). A malicious or buggy client could submit `{Q1: "Q8-E"}` and the scoring would process Q8-E's dual weights (A+4, D+4) as if it were Q1's answer. While this doesn't enable score inflation beyond what legitimate answers allow (all weights are +4), it allows answers to be attributed to wrong questions, and could allow the same answer ID to be submitted under multiple question keys, effectively double-counting a single answer's weights.
**Evidence:**
```js
// Line 101-103: questionId is destructured but never used for validation
for (const [questionId, answerId] of Object.entries(answers)) {
  const scoring = answerScoringMap.get(answerId);  // Only answerId is used
  if (!scoring) continue;
```
Concrete exploit: `{Q1: "Q7-E", Q4: "Q7-E", Q5: "Q7-E"}` would apply Q7-E's dual scoring (+4 A, +4 D) three times, producing A=12, D=12 from just three "answers" that all reference the same option.

---

### [F-04]: Non-scored answers sent to Loops.so as raw IDs instead of readable text
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts` (lines 31-34)
**Description:** The API extracts non-scored answers for segmentation (experience level, pain point, card back preference, product interest) using the raw answer ID (e.g., `"Q2-A"`) rather than the human-readable text (e.g., `"Curious, but just beginning."`). This means the Loops.so contact records contain opaque IDs that require an external lookup table to interpret, making segmentation and email personalization harder.
**Evidence:**
```js
// Line 31-34: Stores "Q2-A" not "Curious, but just beginning."
const experienceLevel = answers['Q2'] || null;
const painPoint = answers['Q3'] || null;
const cardBackPref = answers['Q19'] || null;
const productInterest = answers['Q20'] || null;
```

---

### [F-05]: Progress bar never reaches 100% before results screen
**Severity:** Medium
**Affected files:** `src/pages/quiz.astro` (lines 233-236)
**Description:** The progress bar percentage is calculated as `((step - 1) / TOTAL_QUESTIONS) * 100`. On the last question (step 20), this shows `(19/20) * 100 = 95%`. The bar jumps from 95% to hidden (opacity 0) when results appear. Users never see a satisfying 100% completion state.
**Evidence:**
```js
// Line 234: At step=20 (last question), shows 95%
const pct = ((step - 1) / TOTAL_QUESTIONS) * 100;
progressFill.style.width = `${pct}%`;
progressText.textContent = `${step} of ${TOTAL_QUESTIONS}`;
```
The text shows "20 of 20" on the last question, but the bar itself is only at 95%.

---

### [F-06]: Browser test suite has fake back-button assertion
**Severity:** Medium
**Affected files:** `tests/quiz-browser.test.mjs` (line 70-71)
**Description:** Test #10 claims to verify "Back buttons rendered on Q2-Q20" but simply calls `pass()` unconditionally without actually checking the DOM. This test would pass even if all back buttons were missing.
**Evidence:**
```js
// Line 70-71: Assertion without any DOM check
pass('Back buttons rendered on Q2-Q20');
```
Compare with the other tests that actually inspect the DOM (e.g., lines 14-15 checking `isVisible()`).

---

### [F-07]: Browser tests do not cover email form submission
**Severity:** Medium
**Affected files:** `tests/quiz-browser.test.mjs`
**Description:** The browser test suite verifies that the email form is visible but never tests form submission (neither success nor error paths). The honeypot check, timing check, error display, and success state transitions are all untested at the browser level. The API route itself has no unit tests either -- it's tested only through the shared `computeScores`/`classify` unit tests, not its own validation logic or Loops.so integration.
**Evidence:** The test file ends at line 82 with only 10 test assertions. No `page.fill()`, `emailForm.submit()`, or network interception is present anywhere in the file.

---

### [F-08]: Minimal email validation in API route
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts` (line 13)
**Description:** Email validation only checks `typeof email === 'string'` and `email.includes('@')`. Strings like `"@"`, `"a@"`, or `"@b"` pass validation. While Loops.so likely performs its own validation and would reject truly malformed addresses, invalid emails waste API calls and could create partial/broken contacts.
**Evidence:**
```js
// Line 13: Only checks for presence of '@'
if (!email || typeof email !== 'string' || !email.includes('@')) {
```

---

### [F-09]: Client displays archetype before server confirmation with no reconciliation
**Severity:** Medium
**Affected files:** `src/pages/quiz.astro` (lines 247-280, 334-365)
**Description:** The quiz UI computes and displays the archetype result immediately on the client side before the API call. The server re-classifies independently, but the API response's `archetype` field is never compared against the displayed result. If the client-side answers object differs from what gets sent to the API (e.g., due to a race condition, browser extension, or serialization issue), the user would see one archetype on screen while a different archetype is recorded in Loops.so.
**Evidence:**
```js
// Lines 247-249: Client classifies and displays immediately
const scores = computeScores(state.answers, questions);
const archetype = classify(scores);
const content = archetypes[archetype];

// Lines 345-346: API response checked for ok/not-ok but archetype not verified
if (res.ok) {
  emailSection.style.display = 'none';
```

---

### [F-10]: All-way dimension tie defaults to Air Weaver with no explicit documentation in user-facing content
**Severity:** Medium
**Affected files:** `src/lib/classifier.ts` (lines 56-59)
**Description:** When all four dimensions are exactly equal (including all zeros), the classifier returns `air_weaver` because it is the first `>=` check in the cascade. This is a deliberate design choice and is documented in code comments, but it means a perfectly balanced quiz-taker or a submission with no scored answers always receives Air Weaver. Combined with F-02 (empty answers validation), this means all malicious/empty submissions default to Air Weaver, potentially skewing archetype distribution analytics.
**Evidence:**
```js
// Line 57: All-equal scores satisfy A >= B, A >= C, A >= D
if (A >= B && A >= C && A >= D) {
  return 'air_weaver';
}
```
Test confirms: `classify(scores(0, 0, 0, 0))` returns `'air_weaver'` and `classify(scores(10, 10, 10, 10))` returns `'air_weaver'`.

---

### [F-11]: No back navigation from Q1 to intro screen
**Severity:** Medium
**Affected files:** `src/pages/quiz.astro` (line 96)
**Description:** The back button is rendered conditionally with `{i > 0 && ...}`, where `i` is the zero-based question index. Q1 (index 0) has no back button, so once a user clicks "Begin the Reading," there is no way to return to the intro screen without refreshing the page. While this may be an intentional UX decision to maintain forward momentum, it could frustrate users who clicked "Begin" accidentally.
**Evidence:**
```astro
{i > 0 && (
  <button class="back-btn ...">
    <span class="text-xs">&larr;</span> Previous
  </button>
)}
```

---

## Positive Observations

These are areas where the implementation is notably well-done:

1. **Classifier exhaustiveness:** The priority cascade is mathematically complete. Every possible `(A, B, C, D)` tuple maps to exactly one archetype. The ascending_seeker fallback correctly captures all C-dominant patterns that no other archetype claims. No score combination falls through unhandled.

2. **Dual-scoring wiring:** Q7-E and Q8-E correctly implement `[w('A'), w('D')]`, and `computeScores` correctly iterates over multi-weight arrays. The Grounded Mystic detection pathway works as designed.

3. **Tally bug corrections:** All five operator-confirmed corrections (Q5 shifted scoring, Q6 B/C swap, Q8-A missing scoring, Q9-A duplicate, Q9-D all-dimensions) are properly applied and individually verified by tests.

4. **Server-side re-classification:** The API route does not trust the client's classification. It imports the same `computeScores` and `classify` functions and re-derives the archetype from raw answers, preventing client-side manipulation of the result.

5. **Quiz data test suite depth:** 16 describe blocks with highly specific assertions covering structural integrity, scoring corrections, dimension coverage, and cross-question consistency. This is production-quality test coverage for the data model.

6. **Classifier test suite thoroughness:** Boundary conditions, strict inequality failures, multi-way ties, integration tests, and edge cases (zero scores, large scores, single-dimension) are all covered. The test suite demonstrates deep understanding of the cascade's behavior.

7. **Archetype content completeness:** All six archetypes have consistent content structure with slug, name, title, description, element, and color. No missing entries.
