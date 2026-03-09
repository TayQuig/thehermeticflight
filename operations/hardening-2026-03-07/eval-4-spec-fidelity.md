# Evaluator 4: Spec Fidelity & Contract Compliance

**Date:** 2026-03-07
**Evaluator lens:** Spec Fidelity — Do implementation artifacts faithfully encode the spec?
**Artifacts analyzed:** 11 files (5 implementation, 3 test contracts, 3 reference docs)
**Verdict:** No critical or high-severity findings. 5 medium findings identified.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 5 |

The implementation is remarkably faithful to its spec. All 5 operator-confirmed scoring corrections are encoded exactly. The classifier priority cascade matches the extraction document to the operator and variable level. The Loops.so API integration uses the correct endpoint, authentication pattern, and payload structure. The quiz UI implements every Phase 5 requirement from the implementation plan.

The findings below are gaps in test coverage and a missing data extraction, not implementation errors.

---

## Findings

### [P-01]: Q11 Flow State Answer Not Extracted in API Route
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts`
**Description:** The Tally quiz extraction document (Section 8, "Non-Scored Question Handling") specifies that Q11 responses should be preserved for flow-state segmentation tagging. The API route extracts Q2 (experience level), Q3 (pain point), Q19 (card back preference), and Q20 (product interest) as contact properties for Loops.so, but omits Q11 entirely. This means the flow-state segmentation data is captured by the client but silently discarded on the server.
**Evidence:** `quiz-submit.ts` lines 31-34 extract four non-scored answers:
```typescript
const experienceLevel = answers['Q2'] || null;
const painPoint = answers['Q3'] || null;
const cardBackPref = answers['Q19'] || null;
const productInterest = answers['Q20'] || null;
```
Q11 is absent. The extraction doc states: "Segmentation tagging (Q2 experience level, Q3 pain points, Q11 flow state type)." The implementation plan Task 6 code (line 1076-1079) also omits Q11, so the implementation faithfully reproduces the plan's omission. The gap originates in the spec itself.

---

### [P-02]: No API Route Test Coverage
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts`, `tests/` (missing file)
**Description:** The quiz-submit API route has zero test coverage. There are no unit or integration tests validating: input validation logic (email format, answers object), server-side reclassification, non-scored answer extraction, Loops.so payload construction, error handling paths (missing API key, Loops.so failure), or response format. The browser test (`quiz-browser.test.mjs`) covers the UI flow but does not exercise the API route at all — it only verifies that the form renders, not that submission works correctly.
**Evidence:** `tests/` contains only `quiz-data.test.ts`, `classifier.test.ts`, and `quiz-browser.test.mjs`. None test the API route. The implementation plan (Task 6) includes manual curl verification steps but no automated test contract. The quiz-data and classifier modules are thoroughly tested via frozen-test-file protocol, but the API route — which composes them — has no contract.

---

### [P-03]: Browser Test Hardcodes Pass for Back Button Verification
**Severity:** Medium
**Affected files:** `tests/quiz-browser.test.mjs`
**Description:** The browser test claims to verify that back buttons render on Q2-Q20 but the assertion is hardcoded to pass without any DOM verification. This means the test would report success even if back buttons were removed from the template.
**Evidence:** `quiz-browser.test.mjs` line 71:
```javascript
pass('Back buttons rendered on Q2-Q20');
```
This line executes unconditionally — there is no Playwright locator query, no `isVisible()` check, and no iteration over question steps. Compare this to all other assertions in the file (lines 14-68) which perform actual DOM queries before calling `pass()` or `fail()`.

---

### [P-04]: No Test Coverage for archetype-content.ts
**Severity:** Medium
**Affected files:** `src/lib/archetype-content.ts`, `tests/` (missing file)
**Description:** The archetype content module defines static display data for all 6 archetypes (name, title, description, element, color). There are no tests verifying: all 6 archetype slugs have entries, no fields are empty strings, the `slug` field matches the Record key, or the `title` field includes the "The " prefix. This module is consumed by both the quiz results UI and could be consumed by the API route for email templates. A typo or missing entry would cause a runtime failure on the results screen.
**Evidence:** The `tests/` directory has no `archetype-content.test.ts` file. The implementation plan (Task 4) includes no test step — only a commit step. The classifier test suite validates that `classify()` returns valid `ArchetypeSlug` values, but never verifies that `archetypes[slug]` resolves to a populated content object.

---

### [P-05]: Non-Scored Answer Values Stored as Raw IDs in Loops.so
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts`
**Description:** When non-scored answers (Q2, Q3, Q19, Q20) are sent to Loops.so as contact properties, the values are raw answer IDs like `"Q2-A"`, `"Q3-C"`, `"Q19-B"`, `"Q20-D"`. These are cryptic in the Loops.so dashboard and make audience filtering and segmentation difficult for the operator. A segment filter for "Curious, but just beginning" tarot users would require the operator to know that this maps to `experienceLevel == "Q2-A"`. The implementation is faithful to the spec — the implementation plan also sends raw IDs — but this is a usability gap inherited from the plan.
**Evidence:** `quiz-submit.ts` lines 31-34 extract raw answer IDs:
```typescript
const experienceLevel = answers['Q2'] || null;  // Value: "Q2-A", "Q2-B", or "Q2-C"
```
The `answers` map structure (from quiz.astro line 299) stores `state.answers[questionId] = answerId`, where `answerId` is the raw ID string. No lookup is performed to resolve the ID to the answer's text field before sending to Loops.so.

---

## Spec Fidelity Verification Matrix

The following table maps each analytical question to its finding.

| # | Question | Verdict | Notes |
|---|----------|---------|-------|
| 1 | 5 scoring corrections match spec? | PASS | All 5 corrections exactly match implementation plan decisions |
| 2 | Loops.so API integration matches reference? | PASS | Endpoint, auth, payload, event/contact property separation all correct |
| 3 | Classifier matches design document? | PASS | All 6 priority levels, operators, and slugs match extraction doc Section 4 |
| 4 | Test contracts accurately encode spec? | PARTIAL | Quiz data and classifier tests are thorough; API route and archetype content have no tests (P-02, P-04) |
| 5 | Quiz UI matches Phase 5 requirements? | PASS | All functional requirements implemented; cosmetic enhancements beyond spec |
| 6 | Dual-scoring Q7-E/Q8-E correct? | PASS | Both correctly score A+D with +4 each; comprehensively tested |
| 7 | API route payload matches Loops spec? | PASS | Contact properties top-level, event properties nested; matches API reference exactly |
| 8 | Unimplemented requirements? | PARTIAL | Q11 flow state not extracted (P-01); originated in implementation plan omission |
| 9 | Non-scored questions have empty scoring? | PASS | All 5 non-scored questions verified in both implementation and tests |

---

## Positive Observations

These are not findings but noteworthy aspects of spec fidelity worth documenting:

1. **Scoring correction documentation quality.** Every corrected question in `quiz-data.ts` includes inline comments documenting the original Tally bug and the correction rationale. This is exemplary for long-term maintainability.

2. **Implementation plan faithfulness.** The implementation deviates from the plan in exactly two ways: adding Idempotency-Key support (improvement) and using CSS animation transitions instead of hidden/shown toggling (UX enhancement). Both are improvements, not regressions.

3. **Classifier test depth.** The `classifier.test.ts` file goes significantly beyond the implementation plan's suggested tests, covering strict inequality edge cases, three-way ties, zero scores, and large values. The test author clearly understood the cascade logic deeply.

4. **Server-side reclassification.** The API route performs server-side reclassification (`computeScores` + `classify`) rather than trusting the client-side result. This matches the implementation plan's "integrity check" architecture and prevents a client-side manipulation from selecting a different archetype.

5. **Tally extraction doc internal inconsistency.** The extraction doc claims "14 scored questions" and "6 non-scored questions" in Section 1, but Section 5 lists 15 scored questions (Q1, Q4-Q10, Q12-Q18) and 5 non-scored (Q2, Q3, Q11, Q19, Q20). The "6th non-scored" was Q8 option A (a single dead answer, not a whole question). The implementation correctly uses the 15/5 split. This is a doc inconsistency, not an implementation error.
