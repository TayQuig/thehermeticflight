# Evaluation Synthesis — Quiz v2 Hardening

**Date:** 2026-03-19
**Evaluators:** 3 (Functional, Security + Data Integrity, UX + Accessibility)
**Raw findings:** 45 (FUNC: 15, SEC: 13, A11Y: 17)
**Deduplicated findings:** 12
**Deferred findings:** 33

---

## Section A: Finding Inventory (Calibrated Severity)

| ID | Title | Severity | Sources |
|----|-------|----------|---------|
| S-01 | No focus management on phase transitions | Critical | A11Y-01, A11Y-15, A11Y-11 |
| S-02 | No screen reader announcements for content changes | Critical | A11Y-02, A11Y-10 |
| S-03 | displayOrder never captured by client; injection risk on server | High | FUNC-01, SEC-03 |
| S-04 | quizVersion not sent by client | High | FUNC-02, SEC-08 |
| S-05 | firstName forwarded to Loops.so without sanitization | High | SEC-01 |
| S-06 | Email not trimmed/normalized server-side | High | SEC-02, SEC-14 |
| S-07 | Progress bar lacks ARIA role and value attributes | High | A11Y-03 |
| S-08 | Email gate form inputs lack accessible labels | High | A11Y-04 |
| S-09 | Focus indicators suppressed on interactive elements | High | A11Y-05 |
| S-10 | No prefers-reduced-motion; auto-advance not adjustable | High | A11Y-06, A11Y-07 |
| S-11 | Color contrast failures on low-opacity text elements | High | A11Y-13 |
| S-12 | Self-select tests use conditional assertions (false coverage) | High | FUNC-04 |

---

## Section B: Convergence Matrix

| Finding | FUNC | SEC | A11Y | Confidence |
|---------|------|-----|------|------------|
| S-01 | — | — | A11Y-01,15,11 | 1/3 (single-evaluator, high impact) |
| S-02 | — | — | A11Y-02,10 | 1/3 (single-evaluator, high impact) |
| S-03 | FUNC-01 | SEC-03 | — | 2/3 |
| S-04 | FUNC-02 | SEC-08 | — | 2/3 |
| S-05 | — | SEC-01 | — | 1/3 |
| S-06 | — | SEC-02,14 | — | 1/3 |
| S-07 | — | — | A11Y-03 | 1/3 |
| S-08 | — | — | A11Y-04 | 1/3 |
| S-09 | — | — | A11Y-05 | 1/3 |
| S-10 | — | — | A11Y-06,07 | 1/3 |
| S-11 | — | — | A11Y-13 | 1/3 |
| S-12 | FUNC-04 | — | — | 1/3 |

Note: A11Y findings are inherently single-evaluator (only the a11y evaluator tests accessibility). Low convergence here does not indicate low confidence — it reflects the orthogonal lens design.

---

## Section C: Affected Files Inventory

| File | Findings | Action |
|------|----------|--------|
| `src/pages/quiz.astro` | S-01,02,03,04,07,08,09,10,11 | Modify (HTML template + inline script) |
| `src/pages/api/quiz-submit.ts` | S-03,04,05,06 | Modify (validation + normalization) |
| `src/styles/global.css` | S-10 | Modify (prefers-reduced-motion media query) |
| `tests/quiz-engine.test.ts` | S-12 | Modify (replace conditional assertions) |
| `tests/quiz-submit.test.ts` | S-03,04,05,06 | Modify (add regression tests) |
| `tests/quiz-v2-e2e.spec.ts` | S-01,02,03 | Modify (add a11y + displayOrder assertions) |

Read-only references: `src/lib/quiz-engine.ts`, `src/lib/quiz-data.ts`, `src/lib/classifier.ts`

---

## Section D: Remediation Phases

### Cycle 1 — Critical (S-01, S-02)

Focus management + screen reader announcements. These are interrelated: both involve making phase transitions perceivable and operable for assistive technology users.

**Scope:** quiz.astro HTML template (aria-live regions, focus calls in transition functions). Also A11Y-08 (or-divider aria-hidden), A11Y-14 (back button arrow aria-hidden), A11Y-12 (share button aria-labels) bundled as trivial fixes.

### Cycle 2 — High: Accessibility (S-07, S-08, S-09, S-10, S-11)

ARIA semantics, form labels, focus indicators, reduced-motion, contrast. All HTML/CSS layer changes in quiz.astro and global.css.

### Cycle 3 — High: Data Integrity + Security (S-03, S-04, S-05, S-06)

displayOrder capture, quizVersion declaration, firstName sanitization, email normalization. JS logic in quiz.astro and quiz-submit.ts.

### Cycle 4 — High: Test Quality (S-12)

Replace conditional self-select test assertions with deterministic patterns. quiz-engine.test.ts only.

---

## Section E: Deferred Findings

| Source | Title | Severity | Deferral Rationale |
|--------|-------|----------|-------------------|
| SEC-04 | No CSRF/origin protection | High→Medium | Proportionate for marketing quiz. Honeypot + Loops.so idempotency provide baseline. Add to Sprint 3 infrastructure backlog. |
| SEC-06 | Rate limiter resets on cold start | High | Requires persistent storage (KV/Redis). Beyond quiz scope. Sprint 3 infrastructure. |
| SEC-09 | Fire-and-forget can silently fail | Medium | Design decision documented. Showing results immediately is higher priority than guaranteed API processing. Monitor via Loops.so contact count vs quiz completion events. |
| SEC-05 | selfSelected allows any archetype override | Medium | By design. Server logs both selfSelected and raw classification scores, enabling post-hoc detection. |
| SEC-07 | innerHTML in self-select card builder | Medium | Data is static from archetype-content.ts. No user input reaches innerHTML. Low risk, fragile pattern. Backlog. |
| SEC-11 | Missing test coverage for security scenarios | Medium | Will be partially addressed by Cycle 3 regression tests. Remaining gaps added to backlog. |
| SEC-12 | Replay protection relies on Loops.so idempotency | Medium | Acceptable for marketing quiz. Loops.so handles dedup. |
| SEC-13 | answerQuestion doesn't validate answerId | Medium | Server-side validation catches all manipulation. Low risk. |
| FUNC-03 | Server/client confidence divergence | High→Medium | Analytics enhancement only. Archetype assignment is correct. Document that Loops.so confidence is raw classifier value, not CV²-attenuated. |
| FUNC-05 | Dead variable lastScoredIndex | Medium | Trivial cleanup. Bundle with next code touch. |
| FUNC-06 | FP shuffle swaps textContent not innerHTML | Medium | Currently safe (answer text is plain strings). Bundled with S-01 (aria attribute fixes). |
| FUNC-07 | SEG answers optional server-side | Medium | Informational. Current behavior is acceptable. |
| FUNC-08 | No back nav from late phases | Medium | Design decision. Back from calculating/results is not standard quiz UX. |
| FUNC-09 | E2E self-select test non-deterministic | Medium | Covered by S-12 (unit test fix). E2E handles both branches by design. |
| FUNC-10 | All 6 archetypes reachable | Medium | Confirmed. No action needed. |
| FUNC-11 | firstName in module scope not engine state | Medium | Architectural. Would require quiz-engine.ts API change. Low impact — current flow works. |
| FUNC-12 | selfSelectShown not distinguished in analytics | Medium | Analytics enhancement. Add selfSelectShown boolean to API payload in future sprint. |
| FUNC-13 | Stale "20 questions" comments | Medium | Documentation. Trivial. Bundle with next code touch. |
| FUNC-14 | No E2E test for FP shuffle-to-score pipeline | Medium | Unit tests cover scoring correctness. E2E gap is low risk. |
| FUNC-15 | Monte Carlo measures raw not engine self-select rate | Medium | Nice-to-have. Current test validates classifier distribution. Engine-level Monte Carlo is a future enhancement. |
| A11Y-08 | "or" divider not aria-hidden | Medium | Bundled into Cycle 1 (trivial 1-line fix). |
| A11Y-09 | No skip-to-content link | Medium | Site-wide concern. Should be added to Layout.astro in Sprint 3 a11y backlog. |
| A11Y-12 | Share button icons lack accessible names | Medium | Bundled into Cycle 1 (trivial fix). |
| A11Y-14 | Back button arrow not aria-hidden | Medium | Bundled into Cycle 1 (trivial fix). |
| A11Y-16 | Zero a11y test coverage | High→Medium | Will be addressed as verification tests in remediation cycles. Full axe-core integration is Sprint 3 scope. |
| A11Y-17 | Question sections lack landmarks | Medium | Improvement. Add aria-labelledby in future pass. |

---

## Section F: Verification Criteria

### S-01: Focus management on phase transitions
After each phase transition, `document.activeElement` is within the newly-active `.quiz-step`. Test: Playwright assertion `document.activeElement?.closest('.quiz-step.active') !== null` after every transition.

### S-02: Screen reader announcements
An `aria-live` region exists within the quiz. Question text changes are announced. Test: `page.locator('#quiz-container [aria-live]')` has count >= 1.

### S-03: displayOrder captured and validated
Client sends `displayOrder` in POST body with keys matching question IDs and array values. Server validates keys against expected question ID pattern. E2E test asserts `capturedPayload.displayOrder` is non-null object with 12 keys.

### S-04: quizVersion sent by client
Client POST body includes `quizVersion: 'v2'`. Server logs warning on mismatch. Grep: `quizVersion` appears in quiz.astro fetch body.

### S-05: firstName sanitized
HTML tags stripped from firstName before Loops.so call. Test: submit `firstName: '<script>alert(1)</script>'` → Loops.so payload firstName contains no `<` or `>` characters.

### S-06: Email normalized server-side
Email trimmed and lowercased before use. Test: submit `"  Test@Example.COM  "` → Loops.so email is `"test@example.com"`. Idempotency key uses same normalized value.

### S-07: Progress bar ARIA
Progress bar has `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="10"`, dynamic `aria-valuenow`. Hidden (`aria-hidden="true"`) during segmentation. Test: `page.locator('[role="progressbar"]').getAttribute('aria-valuenow')` returns numeric string.

### S-08: Form inputs labeled
Email and firstName inputs have `aria-label` or associated `<label>`. Test: `page.locator('input[name="email"]').getAttribute('aria-label')` is non-null.

### S-09: Focus indicators visible
No `focus:outline-none` without a visible high-contrast replacement. All interactive elements have visible focus state. Test: `grep 'focus:outline-none' quiz.astro` returns 0 hits, or each has `focus:ring-2` companion.

### S-10: Reduced motion + timing
`@media (prefers-reduced-motion: reduce)` block exists in global.css. With reduced-motion preference, auto-advance is disabled or a "Next" button appears. Test: `grep 'prefers-reduced-motion' src/styles/global.css` returns >= 1.

### S-11: Contrast ratios
All text meets WCAG 2.1 AA (4.5:1 normal, 3:1 large). No `text-hermetic-gold/30` on dark backgrounds for functional text. Test: axe-core color-contrast rule passes, or manual verification that opacity modifiers >= /60 for small text.

### S-12: Self-select tests unconditional
All self-select unit tests assert unconditionally (no `if (state.phase === 'self-select')` guards). Test: `grep -c 'if.*phase.*self-select' tests/quiz-engine.test.ts` returns 0.

---

## Section G: Stripped Finding Descriptions (for remediation agents)

### S-01
Phase transitions (question advance, back, email gate, calculating, self-select, results) leave focus on `<body>`. Focus must move to the newly-active step's primary content element after each transition.

### S-02
No `aria-live` regions exist. Screen readers receive no notification when questions change, when the calculating interstitial appears, or when results are revealed. Content changes are invisible to non-visual users.

### S-03
The client POST to `/api/quiz-submit` does not include `displayOrder`. The server destructures it but receives `undefined`. Shuffle audit data is permanently lost. Additionally, the server forwards `displayOrder` to Loops.so with only a shallow type guard — crafted values could inject arbitrary keys into `eventProperties`.

### S-04
The client does not send `quizVersion` in the POST body. The server hardcodes `'v2'`. A cached v1 page posting to the v2 endpoint would be incorrectly stamped as v2.

### S-05
`firstName` is validated for type and length (≤100 chars) but forwarded to Loops.so without stripping HTML tags or control characters. Could enable stored XSS or template injection in outbound emails.

### S-06
Server uses raw email from request body without trimming or case normalization. Whitespace-padded emails bypass per-email rate limiting and create inconsistent Loops.so contacts. Idempotency key lowercases email but the Loops.so payload preserves original case.

### S-07
Progress bar uses generic `<div>` and `<p>` elements. Missing: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. During segmentation phases (opacity: 0), the bar remains in the accessibility tree.

### S-08
Email gate form inputs use `placeholder` only. No `<label>` elements, no `aria-label`, no `aria-labelledby`. No error state handling (no `role="alert"` for validation failures).

### S-09
Form inputs use `focus:outline-none` with only a subtle border-opacity change as replacement. Answer buttons, pair buttons, back button, and self-select cards have no custom focus styles.

### S-10
Zero `prefers-reduced-motion` media queries in the codebase. Multiple animations run unconditionally: step transitions, calculating pulse, phrase cycling, progress shimmer, background effects. The 800ms auto-advance has no user override.

### S-11
Text elements use `text-hermetic-gold/30` through `/50` opacity modifiers producing contrast ratios well below 4.5:1 AA. Affected: progress text, "No account needed", "or" divider, back button text, skip button, question phase label.

### S-12
Self-select unit tests wrap assertions in `if (state.phase === 'self-select')` guards. If the engine doesn't reach self-select, no assertion runs. Tests pass without exercising the claimed behavior.
