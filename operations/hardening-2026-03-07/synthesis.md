# Synthesis Report — Hardening Sprint 2026-03-07

**Date:** 2026-03-07
**Evaluators:** 4 (Functional, Adversarial, Architectural, Spec-Fidelity)
**Target:** Quiz pipeline (quiz-data, classifier, archetype-content, quiz.astro, quiz-submit API)
**Total raw findings:** 32 (across 4 evaluators)
**Deduplicated findings:** 14 (6 High, 8 Medium, 0 Critical)

---

## 1. Finding ID + Calibrated Severity

| ID | Title | Calibrated Severity | Sources | Effort |
|----|-------|---------------------|---------|--------|
| SYN-01 | Auto-advance race condition | High | F-01, A-01 | Small |
| SYN-02 | Answer payload validation missing | High | F-02, F-03, S-04, A-02 | Medium |
| SYN-03 | Email validation insufficient | High | F-08, S-03, A-03 | Small |
| SYN-04 | No rate limiting on API route | High | S-01 | Medium |
| SYN-05 | Bot detection client-side only | High | S-02 | Medium |
| SYN-06 | No fetch timeout / error handling for Loops.so | High | A-06 | Small |
| SYN-07 | Non-scored answers as raw IDs | Medium | F-04, P-05 | Small |
| SYN-08 | No API route test coverage | Medium | F-07, P-02 | Medium |
| SYN-09 | Browser test fake back-button assertion | Medium | F-06, P-03 | Small |
| SYN-10 | No archetype-content test coverage | Medium | P-04 | Small |
| SYN-11 | Q11 flow state not extracted | Medium | P-01 | Small |
| SYN-12 | Type safety gaps in quiz.astro | Medium | A-04, A-05 | Medium |
| SYN-13 | Idempotency key case-sensitive | Medium | S-05 | Small |
| SYN-14 | Missing env.d.ts type declarations | Medium | A-07 | Small |

**Severity calibration notes:**
- A-01 downgraded from Critical to High: the race condition causes a skipped question, not data loss or security breach. It's a genuine UX bug but does not "completely subvert" the artifact.
- S-01 and S-02 kept at High despite 1/4 convergence: the API is publicly accessible and directly exploitable without the evaluators needing to converge on the same observation.
- A-04 and A-05 downgraded from High to Medium (grouped as SYN-12): the `(window as any)` pattern and non-null assertions work correctly at runtime — they're type safety gaps, not functional failures.

---

## 2. Convergence Matrix

| Finding | Functional | Adversarial | Architectural | Spec-Fidelity | Confidence |
|---------|:----------:|:-----------:|:-------------:|:-------------:|:----------:|
| SYN-01 | F-01 | — | A-01 | — | 2/4 (50%) |
| SYN-02 | F-02, F-03 | S-04 | A-02 | — | 3/4 (75%) |
| SYN-03 | F-08 | S-03 | A-03 | — | 3/4 (75%) |
| SYN-04 | — | S-01 | — | — | 1/4 (25%) |
| SYN-05 | — | S-02 | — | — | 1/4 (25%) |
| SYN-06 | — | — | A-06 | — | 1/4 (25%) |
| SYN-07 | F-04 | — | — | P-05 | 2/4 (50%) |
| SYN-08 | F-07 | — | — | P-02 | 2/4 (50%) |
| SYN-09 | F-06 | — | — | P-03 | 2/4 (50%) |
| SYN-10 | — | — | — | P-04 | 1/4 (25%) |
| SYN-11 | — | — | — | P-01 | 1/4 (25%) |
| SYN-12 | — | — | A-04, A-05 | — | 1/4 (25%) |
| SYN-13 | — | S-05 | — | — | 1/4 (25%) |
| SYN-14 | — | — | A-07 | — | 1/4 (25%) |

**Convergence highlights:**
- SYN-02 and SYN-03 have the highest convergence (75%) — 3 of 4 evaluators independently flagged answer validation and email validation gaps.
- SYN-01, SYN-07, SYN-08, SYN-09 at 50% — solid dual confirmation.
- Single-evaluator findings (25%) retained because they address genuine, directly-testable gaps.

---

## 3. Affected Files Inventory

| File | Action | Findings |
|------|--------|----------|
| `src/pages/api/quiz-submit.ts` | **modify** | SYN-02, SYN-03, SYN-04, SYN-05, SYN-06, SYN-07, SYN-11, SYN-13 |
| `src/pages/quiz.astro` | **modify** | SYN-01, SYN-12 |
| `src/lib/classifier.ts` | **modify** | SYN-02 (answer-question binding) |
| `src/env.d.ts` | **create** | SYN-14 |
| `tests/quiz-submit.test.ts` | **create** | SYN-08 |
| `tests/archetype-content.test.ts` | **create** | SYN-10 |
| `tests/quiz-browser.test.mjs` | **modify** | SYN-09 |
| `src/lib/quiz-data.ts` | read-only | — |
| `src/lib/archetype-content.ts` | read-only | — |

---

## 4. Sprint Phase Assignments by Severity

### High Severity Cycle (SYN-01 through SYN-06)

Six findings affecting `quiz-submit.ts`, `quiz.astro`, and `classifier.ts`. These are the must-fix items before deployment.

**Remediation approach:** One frozen-test-file cycle. Test Author receives stripped descriptions for all 6 findings, writes contract tests. Implementer receives frozen tests.

### Medium Severity Cycle (SYN-07 through SYN-14)

Eight findings spanning API improvements, test coverage, and type safety. These improve robustness and maintainability.

**Remediation approach:** One frozen-test-file cycle. Test Author writes contract tests for SYN-07, SYN-08, SYN-09, SYN-10, SYN-11, SYN-13. SYN-12 and SYN-14 are non-testable code quality improvements — handled directly by implementer.

---

## 5. Deferred Findings with Rationale

| Raw Finding | Reason for Deferral |
|-------------|---------------------|
| S-06: No CSRF protection | JSON `Content-Type` triggers CORS preflight, providing partial protection. Vercel CORS config is the correct fix but requires platform-level configuration, not code change. |
| S-07: No body size limit | Vercel imposes 4.5MB default limit. Application-level check adds marginal value. |
| S-08: Security headers | Defense-in-depth. Best addressed via Vercel `headers` config or Astro middleware, not per-response. |
| A-08, A-11: Browser test disconnected from runner / hardcoded port | Subsumes into SYN-09 (fix the fake assertion). Full test runner integration is a separate infrastructure task. |
| A-09: Duplicate type definition | Minor. classifier.ts inline type structurally matches ScoringWeight. |
| A-10: Redundant Octokit deps | Out of scope — not quiz pipeline. |
| A-12: Classifier scalability | 6 archetypes is stable. Future concern for 8+ archetypes. |
| F-05, A-13: Progress bar UX | Cosmetic. Bar shows "20 of 20" text; visual percentage is a polish item. |
| F-09: Client-server archetype reconciliation | Low risk — both sides run identical code. Would require API response parsing to reconcile. |
| F-10: All-way tie → Air Weaver | By design. Documented in classifier comments and tests. |
| F-11: No back from Q1 to intro | Intentional UX decision — maintains forward momentum. |

---

## 6. Concrete Verification Criteria per Finding

| Finding | Verification Criterion |
|---------|----------------------|
| SYN-01 | Rapid double-click on answer does not skip a question. Back button works within 500ms of answer selection. Test: click answer, immediately click back, verify same question re-displays. |
| SYN-02 | API returns 400 for: empty answers `{}`, array answers `[]`, answers with unknown question IDs, answers with non-string values. Same answer ID under multiple question keys does not multiply scores. |
| SYN-03 | API returns 400 for: `"@"`, `"a@b"`, emails with spaces, emails >254 chars. firstName validated as string with length limit. |
| SYN-04 | After N requests from same source within T seconds, API returns 429. |
| SYN-05 | Server-side check rejects submissions that bypass client-side timing/honeypot checks (direct curl with no timing signal). |
| SYN-06 | Loops.so fetch aborts after configurable timeout. Non-JSON Loops.so response does not crash handler. User receives appropriate error. |
| SYN-07 | Loops.so contact properties contain human-readable text (e.g., "Curious, but just beginning") not raw IDs (e.g., "Q2-A"). |
| SYN-08 | `vitest run` exercises API route validation, classification, non-scored extraction, Loops.so payload construction, and error paths. |
| SYN-09 | Browser test queries DOM for back button elements on Q2+ and asserts visibility. |
| SYN-10 | Tests verify all 6 archetype slugs have non-empty name, title, description, element, color. Slug field matches Record key. |
| SYN-11 | Q11 answer extracted and sent to Loops.so as `flowState` contact property. |
| SYN-12 | No `(window as any)` casts in quiz.astro. Module-scoped variables for cross-function state. DOM queries handle null gracefully. |
| SYN-13 | Idempotency key uses lowercased email. `User@Gmail.com` and `user@gmail.com` produce the same key. |
| SYN-14 | `src/env.d.ts` exists and declares `LOOPS_API_KEY` on `ImportMetaEnv`. TypeScript reports error for misspelled env var names. |

---

## 7. Stripped Finding Descriptions (for Test Authors / Implementers)

These descriptions contain the "what" without implementation hints:

| Finding | Stripped Description |
|---------|---------------------|
| SYN-01 | Auto-advance timer not cancelled on navigation; stale timer fires after back button press, advancing user to wrong question. |
| SYN-02 | API does not validate answers map contents. Empty objects, arrays, and arbitrary values are accepted. Answer IDs are not bound to their declared questions — the same answer ID can appear under multiple question keys, and non-scored answer values of any type flow through to Loops.so without validation. |
| SYN-03 | Email validated only for presence of `@` character. Accepts malformed addresses. `firstName` field has no type or length validation. |
| SYN-04 | API endpoint has no request throttling. Unlimited requests accepted per time window. |
| SYN-05 | Bot detection mechanisms (honeypot, timing check) exist only in client-side JavaScript. Server-side handler receives and processes requests with no bot signals. |
| SYN-06 | External API call to Loops.so has no timeout mechanism. Non-JSON responses from Loops.so cause unhandled exceptions. |
| SYN-07 | Non-scored answer values sent to Loops.so as opaque answer IDs (e.g., "Q2-A") instead of human-readable answer text. |
| SYN-08 | API route (`quiz-submit.ts`) has no automated test coverage. Validation logic, server-side classification, non-scored answer extraction, Loops.so payload construction, and error handling paths are all untested. |
| SYN-09 | Browser test asserts that back buttons are rendered on Q2-Q20 but performs no DOM verification — assertion passes unconditionally. |
| SYN-10 | Archetype content module (`archetype-content.ts`) has no tests verifying that all 6 archetypes have populated entries with non-empty fields. |
| SYN-11 | Q11 flow state answer is captured on the client but not extracted by the server-side API route. It is silently discarded. |
| SYN-12 | Cross-function state sharing in quiz.astro uses `(window as any)` globals instead of module-scoped variables. Fourteen DOM element queries use non-null assertions (`!`) with no runtime fallback if elements are missing. |
| SYN-13 | Idempotency key treats the same email address with different casing as distinct requests. |
| SYN-14 | Environment variable types are not declared. `import.meta.env.LOOPS_API_KEY` is typed as `any`. Typos in env var names are not caught at compile time. |
