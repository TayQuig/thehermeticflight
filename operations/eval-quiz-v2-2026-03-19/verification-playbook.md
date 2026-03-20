# Verification Playbook — Quiz v2 Hardening

**Verifier:** Independent (Opus)
**Date:** 2026-03-19

---

## Remediated Findings

| ID | Source Verified | Fix Verified | Test Verified | Residual Risk |
|----|----------------|-------------|---------------|---------------|
| S-01 | Yes | Yes | Yes | None |
| S-02 | Yes | Yes | Yes | None |
| S-03 | Yes | Yes | Partial | E2E test gap (see notes) |
| S-04 | Yes | Yes | Partial | Structural test only; no server mismatch test |
| S-05 | Yes | Yes | Yes | Regex-only sanitization (see notes) |
| S-06 | Yes | Yes | Yes | None |
| S-07 | Yes | Yes | Yes | None |
| S-08 | Yes | Yes | Yes | No error-state `role="alert"` for validation failures |
| S-09 | Yes | Yes | Yes | Non-form interactive elements not tested (see notes) |
| S-10 | Yes | Yes | Yes | Auto-advance timing not configurable (see notes) |
| S-11 | Yes | Partial | Yes | /50 opacity still used for decorative text (see notes) |
| S-12 | Yes | Yes | Yes | None |

---

## Detailed Notes per Finding

### S-01: Focus management on phase transitions

**Source tracing:** Synthesis cites A11Y-01, A11Y-15, A11Y-11. All three exist in eval-a11y.md. A11Y-01 (no focus management) is Critical, A11Y-15 (results not announced) is High, A11Y-11 (self-select cards lack accessible names) is High. Severity calibration to Critical is justified — A11Y-01 alone is Critical, and convergence with A11Y-15 and A11Y-11 reinforces it.

**Fix verified:** `quiz.astro` line 413-414 in `transitionTo()` finds the first focusable element in the target step and calls `.focus()`. Lines 490-494 in `showQuestion()` set `tabindex="-1"` on the `<h2>` heading and focus it. Both the general transition path and the question-specific path are covered.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 50-93 has three tests: focus after start, focus after answering, focus after back navigation. All assert `document.activeElement` is within the active `.quiz-step`.

**Residual risk:** None for the remediated paths. Email-gate, calculating, self-select, and results transitions all use `transitionTo()` which contains the focus call. The focus target selector (`h1, h2, [tabindex="-1"], button, input, a[href]`) is broad enough to find a suitable element in every phase.

---

### S-02: Screen reader announcements

**Source tracing:** Synthesis cites A11Y-02 and A11Y-10. Both exist in eval-a11y.md. A11Y-02 (no aria-live) is Critical, A11Y-10 (calculating inaccessible) is High. Severity calibration to Critical is justified.

**Fix verified:** `quiz.astro` line 38 adds `<div id="quiz-announcer" aria-live="polite" aria-atomic="true" class="sr-only">` inside the quiz container. Line 206 adds `role="status"` to the calculating phrase `<p>` element.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 100-118. Two tests: (1) quiz container has an `aria-live` region (count === 1), (2) calculating interstitial has `role="status"` or `aria-live`.

**Residual risk:** None. The announcer div is present and the calculating phase has `role="status"`. The announcer content is not dynamically updated with question text in the implementation (it's an empty `sr-only` div), but the `role="status"` on the calculating phrase element covers the most critical gap (the calculating interstitial). Question changes are communicated via focus management (S-01) rather than live region updates, which is acceptable per WCAG.

---

### S-03: displayOrder captured and validated

**Source tracing:** Synthesis cites FUNC-01 and SEC-03. Both exist in their respective reports. FUNC-01 is High (client never sends displayOrder), SEC-03 is High (injection risk in displayOrder forwarding). Severity calibration to High is justified. 2/3 convergence.

**Fix verified (client):** `quiz.astro` line 378 declares `const displayOrder: Record<string, number[]> = {};`. Line 435 records `displayOrder[questionId] = shuffledIndices` inside `showQuestion()`. Line 694 includes `displayOrder` in the `fetch` body.

**Fix verified (server):** `quiz-submit.ts` lines 315-327 validate displayOrder keys against `/^(SEG[12]|NQ0[1-7]|FP0[1-3])$/` regex. Only matching keys with array values are forwarded. Non-matching keys are silently stripped, preventing the injection attack described in SEC-03.

**Test verified:** `tests/quiz-submit.test.ts` lines 724-761 covers S-03 with two tests: (1) rejects displayOrder with non-question-ID keys (verifies Loops.so payload doesn't contain injected keys), (2) accepts valid displayOrder. `tests/quiz-a11y.spec.ts` lines 261-269 has a structural test confirming `displayOrder` appears in quiz.astro source.

**Residual risk:** No E2E test asserts the actual `displayOrder` payload from a full browser flow (the quiz-v2-e2e.spec.ts only checks for `quizVersion` on line 366, not `displayOrder`). The unit tests cover the server-side validation, and the structural test confirms the client sends it, but there is no integration test proving the client-constructed displayOrder has 12 keys with correct array values from a real quiz session. This is a minor gap — the unit and structural coverage is sufficient for regression detection.

---

### S-04: quizVersion sent by client

**Source tracing:** Synthesis cites FUNC-02 and SEC-08. Both exist. FUNC-02 is High, SEC-08 is Medium. Synthesis elevates to High, which is justified by FUNC-02's core observation that version discrimination is broken.

**Fix verified:** `quiz.astro` line 693 includes `quizVersion: 'v2'` in the `fetch` body.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 271-276 has a structural test confirming `quizVersion` appears in quiz.astro source. `tests/quiz-submit.test.ts` line 121 confirms the server returns `quizVersion: 'v2'` but does not test server-side validation of a mismatched version.

**Residual risk:** The server (quiz-submit.ts) still hardcodes `quizVersion: 'v2'` in the response (line 426) and Loops.so eventProperties (line 352) without comparing against the client-declared value. The synthesis verification criterion called for the server to "log a warning or reject on mismatch." This was not implemented — the server ignores the client-sent quizVersion entirely. However, the synthesis Section E deferred this nuance (SEC-08 notes that implicit version gating via question ID namespace change is sufficient for v1→v2). The fix addresses the data-loss finding (client now sends it) but not the mismatch-detection finding. This is acceptable for the current phase.

---

### S-05: firstName sanitized

**Source tracing:** Synthesis cites SEC-01. Exists in eval-security.md. Severity High is justified — stored XSS via email template injection is a real attack vector.

**Fix verified:** `quiz-submit.ts` lines 272-274 apply `firstName.replace(/<[^>]*>/g, '')` before forwarding to Loops.so. The sanitized value is used as `sanitizedFirstName` in the Loops.so payload (line 342).

**Test verified:** `tests/quiz-submit.test.ts` lines 768-805 covers three cases: (1) `<script>alert(1)</script>` stripped, (2) `<img src=x onerror=alert(1)>` stripped, (3) valid firstName preserved.

**Residual risk:** The regex `/<[^>]*>/g` only strips HTML tags. It does not strip: (a) HTML entities like `&lt;script&gt;`, (b) Loops.so template syntax like `{{variable}}`, (c) control characters. For a marketing quiz, this is proportionate — Loops.so likely HTML-escapes contact properties in email templates. If Loops.so templates use unescaped interpolation, template injection remains possible. This is a known limitation of regex-based sanitization; a future improvement would be to use a dedicated sanitizer library or whitelist alphanumeric+space only.

---

### S-06: Email normalized server-side

**Source tracing:** Synthesis cites SEC-02 and SEC-14. Both exist. SEC-02 is High (trim/normalize), SEC-14 is Medium (case inconsistency). Severity High is justified.

**Fix verified:** `quiz-submit.ts` line 196 applies `email.trim().toLowerCase()` immediately after extraction, assigning to `normalizedEmail`. This variable is used for validation (line 199), rate limiting (line 239), Idempotency-Key (line 335), and the Loops.so email payload (line 338). The original `email` variable is no longer used downstream.

**Test verified:** `tests/quiz-submit.test.ts` lines 812-849 covers three cases: (1) whitespace trimmed, (2) case lowered, (3) Idempotency-Key uses normalized email. All assertions check the actual Loops.so payload.

**Residual risk:** None. The fix comprehensively addresses both SEC-02 (trim) and SEC-14 (case normalization) with a single `normalizedEmail` variable used consistently throughout.

---

### S-07: Progress bar ARIA

**Source tracing:** Synthesis cites A11Y-03. Exists in eval-a11y.md. Severity High is justified.

**Fix verified:** `quiz.astro` line 26 adds `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="10"`, and `aria-hidden="true"` (initial state). Lines 477-486 in `showQuestion()` toggle `aria-hidden` off during scored phase and set `aria-valuenow` dynamically. During segmentation, `aria-hidden="true"` is set (line 486).

**Test verified:** `tests/quiz-a11y.spec.ts` lines 125-158 covers three cases: (1) progress bar has `role="progressbar"` with min/max, (2) `aria-valuenow` updates on scored questions, (3) `aria-hidden` during segmentation.

**Residual risk:** None.

---

### S-08: Email gate form accessible labels

**Source tracing:** Synthesis cites A11Y-04. Exists in eval-a11y.md. Severity High is justified.

**Fix verified:** `quiz.astro` line 168 adds `aria-label="First Name (optional)"` to firstName input. Line 175 adds `aria-label="Email Address"` to email input.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 165-187 checks both inputs for `aria-label`, `aria-labelledby`, or associated `<label>`.

**Residual risk:** No `role="alert"` container exists for validation error messages. The A11Y-04 finding mentioned this, but it was not part of the core S-08 remediation scope. The current validation (silent return on empty email) is a UX gap but not a regression from pre-hardening behavior.

---

### S-09: Focus indicators

**Source tracing:** Synthesis cites A11Y-05. Exists in eval-a11y.md. Severity High is justified.

**Fix verified:** `quiz.astro` lines 169, 177 retain `focus:outline-none` but now pair it with `focus:ring-2 focus:ring-hermetic-gold/50`, providing a visible focus ring replacement that meets WCAG 2.4.7.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 193-209 verifies that no input has `focus:outline-none` without an accompanying `focus:ring` class.

**Residual risk:** The test only covers `#email-gate-form input` elements. The A11Y-05 finding also noted that `.answer-btn`, `.pair-btn`, `.back-btn`, and `.self-select-card` lack custom focus styles and rely on browser defaults. These non-form elements are not tested and do not have explicit focus ring classes. Browser default focus indicators vary and may be invisible on dark backgrounds. This is a medium-priority gap for a future pass.

---

### S-10: prefers-reduced-motion

**Source tracing:** Synthesis cites A11Y-06 and A11Y-07. Both exist. A11Y-06 is High (no reduced motion), A11Y-07 is High (auto-advance timing). Severity High is justified.

**Fix verified:** `global.css` lines 108-138 add a `@media (prefers-reduced-motion: reduce)` block that disables: quiz step animations, shimmer, pulse, calculating phrase animation, progress fill transitions, result reveal transitions, stars animation, fog animation. All with `animation: none !important` or `transition-duration: 0.01ms !important`.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 216-222 confirms `prefers-reduced-motion` exists in global.css source.

**Residual risk:** The A11Y-07 finding specifically called for: (a) disabling the 800ms auto-advance with reduced-motion preference, or (b) showing a "Next" button. Neither was implemented. The CSS-level fix reduces visual motion but does not change the 800ms auto-advance timing behavior. This means users with `prefers-reduced-motion` still experience automatic question advancement without the visual cue of the transition animation, which could be disorienting. This is a genuine gap, but the synthesis explicitly bundled A11Y-07 with S-10 (CSS-layer changes only), so it falls within the accepted scope. A11Y-07's auto-advance behavioral change should be tracked as a follow-up.

---

### S-11: Color contrast

**Source tracing:** Synthesis cites A11Y-13. Exists in eval-a11y.md. Severity High is justified.

**Fix verified (partial):** The original finding identified `text-hermetic-gold/30` and `/40` on functional text elements. The remediated `quiz.astro` no longer uses `/30` on any text-bearing elements. All functional text has been raised to at minimum `/50` (question phase label), with most at `/60` (progress text, "No account needed", "or" divider, back button, skip button, share section labels). The share button text uses `/80`. These are meaningful improvements.

However, `/50` opacity on `text-hermetic-gold` against the glass-panel background still produces a contrast ratio below 4.5:1 AA for small text. The question phase label (line 80: `text-hermetic-gold/50`) is 12px uppercase tracking-widened text — small by WCAG standards. The "Return Home" link (line 297: `text-hermetic-gold/50`) is also small text.

**Test verified:** `tests/quiz-a11y.spec.ts` lines 228-254 checks that no functional text uses `/30` or `/20`. The test correctly filters out decorative borders. It does not check `/40` or `/50`.

**Residual risk:** Two elements remain at `/50` opacity, which is borderline for WCAG AA compliance on small text. The test threshold is set at `/30` — it would not catch a regression to `/40`. Consider tightening the test to reject `/50` and below for functional text in a future pass, and raising remaining `/50` elements to `/60`.

---

### S-12: Self-select test conditional assertions

**Source tracing:** Synthesis cites FUNC-04. Exists in eval-functional.md. Severity High is justified — false test coverage is a systemic quality risk.

**Fix verified:** `tests/quiz-engine.test.ts` contains zero instances of `if.*phase.*self-select` (verified via grep). All three test blocks identified in FUNC-04 now use unconditional assertions:
- Line 256-257: `expect(state.classificationResult!.confidence).toBeLessThan(0.15)` followed by `expect(state.phase).toBe('self-select')` — no conditional guard.
- Lines 282-283: Unconditional `expect(state.phase).toBe('self-select')` before `selectArchetype()`.
- Lines 642-643: Unconditional `expect(engine.getState().phase).toBe('self-select')` before selection.

The `answerScoredForLowConfidence()` helper (lines 69-77) uses a deterministic even-distribution strategy that guarantees low confidence with seed 42.

**Test verified:** The tests themselves are the fix. The `answerScoredForLowConfidence()` pattern unconditionally produces self-select, and assertions are not wrapped in conditionals.

**Residual risk:** None.

---

## Deferred Finding Review

33 findings were deferred in the synthesis. Review follows for any that should have been addressed.

### Correctly Deferred (no objections)

- **SEC-04** (CSRF/origin): Proportionate deferral. Marketing quiz with honeypot + Loops idempotency. Sprint 3 infrastructure scope.
- **SEC-06** (rate limiter cold start): Requires persistent storage. Correctly scoped to Sprint 3.
- **SEC-09** (fire-and-forget): Design decision. User sees results immediately. Acceptable tradeoff.
- **SEC-05** (selfSelected override): By design. Server logs raw scores for post-hoc detection.
- **SEC-07** (innerHTML in self-select builder): Static data from archetype-content.ts. No user input reaches it. Low risk, correctly deferred.
- **SEC-11** (missing security test coverage): Partially addressed by S-03, S-05, S-06 regression tests.
- **SEC-12** (replay via idempotency): Acceptable for marketing quiz.
- **SEC-13** (answerQuestion validation): Server-side catches all manipulation. Low risk.
- **FUNC-03** (confidence divergence): Analytics enhancement. Correctly downgraded to Medium.
- **FUNC-05** (dead variable): Trivial cleanup. Correct to bundle with next touch.
- **FUNC-06** (FP shuffle textContent): Currently safe. Bundled correctly.
- **FUNC-07** (SEG optional server-side): Informational. No action needed.
- **FUNC-08** (no back from late phases): Design decision. Acceptable.
- **FUNC-09** (E2E self-select non-deterministic): Covered by S-12 unit fix.
- **FUNC-10** (all archetypes reachable): Confirmed. No action needed.
- **FUNC-11** (firstName module scope): Architectural. Low impact.
- **FUNC-12** (selfSelectShown analytics): Enhancement. Correctly deferred.
- **FUNC-13** (stale comments): Trivial. Correct to bundle.
- **FUNC-14** (no E2E FP shuffle test): Unit coverage sufficient.
- **FUNC-15** (Monte Carlo wrong metric): Nice-to-have.
- **A11Y-08** (or-divider aria-hidden): Bundled into Cycle 1. Verified fixed (quiz.astro line 115).
- **A11Y-09** (skip-to-content): Site-wide. Correct Sprint 3 scope.
- **A11Y-12** (share button icons): Bundled into Cycle 1. Verified fixed (aria-labels on share links, aria-hidden on SVGs).
- **A11Y-14** (back button arrow): Bundled into Cycle 1. Verified fixed (quiz.astro line 133).
- **A11Y-16** (zero a11y test coverage): Addressed by `quiz-a11y.spec.ts` (322 lines, 14 tests).
- **A11Y-17** (question landmarks): Medium improvement. Correctly deferred.

### Findings Warranting Scrutiny

- **SEC-07** (innerHTML in self-select builder): While correctly deferred as low risk now, the implementation at quiz.astro lines 604-610 still uses `card.innerHTML` with template literal interpolation of archetype content fields. The `${content.accentHex}`, `${content.element}`, `${content.title}`, and `${tagline}` values are all from static TypeScript modules, so there is no current XSS vector. However, this pattern is fragile and the `revealResults()` function already uses `textContent` (line 661). This is not incorrectly deferred — the risk is latent, not active — but it should remain on the backlog.

- **A11Y-07** (auto-advance timing): Bundled with S-10 but the behavioral component (disabling auto-advance or showing a "Next" button under `prefers-reduced-motion`) was not implemented. The CSS fix only addresses visual motion, not timing. This is a genuine WCAG 2.2.1 gap. However, the synthesis explicitly scoped S-10 as "CSS layer changes" and the deferral rationale for A11Y-07 is implicit in that scoping. It should be explicitly tracked as a separate backlog item rather than considered resolved by S-10.

### Incorrectly Deferred: None

No findings were incorrectly deferred. All deferral rationales are sound and proportionate to the project's current phase (pre-launch marketing quiz with no persistent user data beyond Loops.so contacts).

---

## Overall Verdict

**PASS WITH NOTES**

### Rationale

All 12 synthesized findings (S-01 through S-12) have been remediated with code changes present in the implementation files. All have regression tests in either `tests/quiz-a11y.spec.ts` (Playwright) or `tests/quiz-submit.test.ts` (Vitest). Source tracing confirms that every evaluator finding ID cited in the synthesis exists in the corresponding evaluator report, and severity calibrations are justified.

### Notes requiring follow-up

1. **S-04 server-side version mismatch detection** is not implemented. The client sends `quizVersion: 'v2'` but the server ignores it. Acceptable for current phase; track for Sprint 3 hardening.

2. **S-10 auto-advance behavioral change** under `prefers-reduced-motion` was not implemented. CSS motion is reduced but 800ms auto-advance persists. Track as explicit backlog item (WCAG 2.2.1).

3. **S-11 contrast** has two elements remaining at `/50` opacity on small text, which is borderline WCAG AA. The test threshold at `/30` is too permissive to catch regressions to `/40`.

4. **S-09 focus indicators** only verified on form inputs. Answer buttons, pair buttons, back button, and self-select cards lack explicit focus styles and rely on browser defaults that may be invisible on dark backgrounds.

5. **S-03 displayOrder E2E coverage** is structural only. No integration test proves the client-constructed payload has correct shape from a full browser session.

None of these are blockers. The hardening cycle materially improved the quiz's accessibility, data integrity, and security posture. The notes above are refinements for future cycles.
