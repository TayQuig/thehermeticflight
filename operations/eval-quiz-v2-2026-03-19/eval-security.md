# Security + Data Integrity Evaluation Report

**Evaluator:** Security + Data Integrity
**Target:** Quiz v2 (quiz-design-overhaul)
**Date:** 2026-03-19

## Findings

### SEC-01: firstName field passed to Loops.so without sanitization

**Severity:** High
**Description:** The `firstName` field is validated only for type (string) and length (<=100 chars) in `validateFirstName()` (lines 107-113 of `quiz-submit.ts`). It is then forwarded verbatim to the Loops.so API at line 318: `firstName: typeof firstName === 'string' ? firstName : ''`. No sanitization, stripping, or encoding is applied. A user (or attacker) can submit `firstName` values containing HTML tags (e.g., `<script>alert(1)</script>`), emoji sequences, control characters, or Loops.so template injection syntax (e.g., `{{variable}}`). If Loops.so renders this value in email templates without escaping, it becomes a stored XSS or template injection vector in outbound emails. The server should strip HTML tags and control characters before forwarding to the third-party API.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 107-113, 318)
**Verification Criteria:** Add a test in `tests/quiz-submit.test.ts` that submits `firstName: '<script>alert(1)</script>'` and verifies the Loops.so payload's `firstName` field does not contain `<script>` tags. Alternatively, grep `quiz-submit.ts` for a sanitization step (regex strip of HTML tags, or a dedicated sanitizer) applied to `firstName` before the Loops.so fetch call.

---

### SEC-02: Email not trimmed or normalized server-side before use

**Severity:** High
**Description:** The client-side code in `quiz.astro` trims the email (line 798: `const email = (formData.get('email') as string)?.trim()`), but the server-side handler in `quiz-submit.ts` uses the raw `email` from `request.json()` (line 184) without trimming. Leading/trailing whitespace in the email would: (1) pass the regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` rejects internal spaces but not leading/trailing), (2) be sent to Loops.so as a whitespace-padded email, (3) produce different idempotency keys for `" user@example.com"` vs `"user@example.com"` (the `toLowerCase()` on line 311 does not trim), (4) create a different per-email rate limit bucket. This enables duplicate submissions via trivially different email strings and creates inconsistent contact records in Loops.so.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 184, 236, 311, 314)
**Verification Criteria:** Add a test that submits email `"  test@example.com  "` and verifies: (a) the Loops.so payload's `email` field is `"test@example.com"` (trimmed), and (b) the Idempotency-Key matches what would be produced for `"test@example.com"`. Alternatively, grep `quiz-submit.ts` for `email.trim()` or equivalent normalization applied immediately after extraction from the body.

---

### SEC-03: displayOrder field forwarded to Loops.so without content validation

**Severity:** High
**Description:** The `displayOrder` field from the client payload is forwarded to Loops.so's `eventProperties` with only a shallow type guard (line 337: `typeof displayOrder === 'object' && !Array.isArray(displayOrder)`). There is no validation that the object contains only numeric indices. An attacker can craft a request with `displayOrder: { "email": "victim@example.com", "firstName": "malicious", "archetype": "shadow_dancer" }` and those keys would be spread into `eventProperties` via the object spread operator, potentially overwriting the legitimate `archetype` key in `eventProperties`. More critically, there is no check that values are numeric or that keys match expected question IDs. This violates the requirement that displayOrder contain only numeric data and no PII.

Additionally, the client-side code in `quiz.astro` does not appear to send a `displayOrder` field at all (no reference to `displayOrder` in the quiz.astro script section), meaning this field on the API is only reachable by direct API calls from crafted requests, not the legitimate client flow.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 184, 337)
**Verification Criteria:** (1) Add a test that sends `displayOrder: { archetype: "shadow_dancer", email: "evil@example.com" }` and verifies the Loops.so payload's `eventProperties.archetype` still matches the server-computed archetype, not the injected value. (2) Add validation that if `displayOrder` is present, all its keys match `/^(SEG[12]|NQ0[1-7]|FP0[1-3])$/` and all values are arrays of numbers. (3) Verify the client sends no `displayOrder` field, or if it should, add the code to generate it.

---

### SEC-04: No CSRF protection or origin validation on the API endpoint

**Severity:** High
**Description:** The `quiz-submit.ts` POST handler (line 181) has no CSRF token validation, no `Origin` or `Referer` header check, and no CORS configuration. The only protections are the honeypot field (easily bypassed by omitting or leaving empty) and the rate limiter. Any script on any domain can submit a POST request with a valid payload to `/api/quiz-submit` and register arbitrary email addresses into the Loops.so email sequence. Combined with the fact that the honeypot field is public knowledge (visible in the HTML source of quiz.astro, line 154-156), an attacker can write a simple script that enumerates email addresses and registers them for unsolicited email. This turns the quiz endpoint into an email-bombing vector.

The rate limiter provides partial protection (10 global, 3 per-email per cold start), but it resets on every Vercel cold start (new fetch function reference = new WeakMap entry), so a distributed attack across multiple serverless instances would face effectively no rate limit.

**Affected Files:** `src/pages/api/quiz-submit.ts` (line 181)
**Verification Criteria:** (1) Grep `quiz-submit.ts` for `request.headers.get('origin')` or `request.headers.get('referer')` — should find origin validation. (2) Alternatively, check for Astro middleware or Vercel Edge middleware that validates `Origin` headers. (3) A test should verify that requests with an `Origin` header not matching `thehermeticflight.com` are rejected with 403.

---

### SEC-05: selfSelected field allows client to override classification — by design, but without audit trail

**Severity:** Medium
**Description:** The `selfSelected` field (line 184, 251) allows the client to override the server-side classifier result. Line 251: `const archetype = isValidArchetypeSlug(selfSelected) ? selfSelected : classificationResult.primary`. The server validates that the slug is one of the 6 valid archetypes (lines 247-250), which prevents arbitrary string injection. However, there is no validation that the `selfSelected` archetype was one of the top-2 archetypes suggested during the self-select phase. A client can send any valid archetype slug as `selfSelected` regardless of their actual quiz answers, effectively bypassing classification entirely. While this is somewhat by design (self-select is a feature), it means any API client can claim any archetype. The Loops.so payload records `selfSelected` when present (line 323), providing a partial audit trail, but the server-side classification scores and memberships are recorded in `eventProperties`, meaning post-hoc analysis can detect manipulation. The concern is that a malicious actor could register many email addresses under a specific archetype to skew analytics.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 247-251, 323)
**Verification Criteria:** (1) Add a test that sends `selfSelected: "shadow_dancer"` with answers that would classify as `air_weaver`, and verify the response's `archetype` is `shadow_dancer` (documenting the override behavior). (2) Verify the Loops.so payload contains both `archetype: "shadow_dancer"` (the override) and `eventProperties.archetype: "shadow_dancer"` along with the raw scores that would have yielded `air_weaver`, enabling post-hoc detection. (3) Consider whether the server should validate that `selfSelected` is in the top-2 memberships.

---

### SEC-06: Rate limiter resets on every Vercel cold start

**Severity:** High
**Description:** The rate limiter (lines 22-62) is an in-memory construct backed by a `WeakMap` keyed on the global `fetch` function reference. In Vercel's serverless model, each cold start creates a new function instance with a new `fetch` reference, meaning the rate limiter state is completely reset. There is no persistent store (Redis, KV, etc.). An attacker sending requests to different serverless instances (achieved by varying query parameters or waiting for cold starts) faces no effective rate limit. The design comment on lines 10-16 acknowledges this: "each cold start gets a fresh rate limiter." The per-email limit of 3 and global limit of 10 only protect within a single warm instance. Additionally, the `checkGlobalRateLimit` function (line 49-52) increments the counter before checking, meaning the limit triggers on request 11 (not 10) — this is a minor fencepost issue.

There is also no time-based window — the counters only grow and never decay. A legitimate user who submits once, gets an error, fixes their input, and resubmits would exhaust their 3-email limit and be locked out for the lifetime of that warm instance.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 22-62)
**Verification Criteria:** (1) Verify that a persistent rate limiting mechanism exists (check for Redis/KV/Vercel Edge Config references in the codebase). (2) Add a test that simulates time-window-based rate limiting: after N requests in window W, the N+1th is rejected; after window W expires, a new request succeeds. (3) For the immediate in-memory approach, add a TTL-based eviction mechanism so counters reset after a configurable window (e.g., 15 minutes).

---

### SEC-07: innerHTML used with template literals in self-select card builder

**Severity:** Medium
**Description:** In `quiz.astro` line 575, the `buildSelfSelectCards()` function uses `card.innerHTML` with template literal interpolation of archetype content fields (`content.accentHex`, `content.element`, `content.title`, `tagline`). While these values currently come from the statically-defined `archetype-content.ts` module (hardcoded string literals — not user input), this pattern is fragile. If archetype content were ever sourced from a CMS, database, or API, the `innerHTML` assignment would become an XSS vector. The `revealResults()` function at lines 632-635 correctly uses `textContent` for the same type of data, demonstrating the project already has the safer pattern available. The self-select builder should use `textContent` and `createElement` instead of `innerHTML`.

**Affected Files:** `src/pages/quiz.astro` (lines 575-582)
**Verification Criteria:** Grep `quiz.astro` for `innerHTML` — should find zero occurrences, or all occurrences should only assign empty strings (like the `container.innerHTML = ''` on line 563, which is safe). The self-select card builder should use DOM APIs (`createElement`, `textContent`, `setAttribute`) instead of template literals with `innerHTML`.

---

### SEC-08: No quizVersion validation — v1 payloads accepted by v2 endpoint

**Severity:** Medium
**Description:** The API endpoint does not require or validate a `quizVersion` field in the incoming payload. It accepts any payload that passes answer validation against the current (v2) question set. If old v1 question IDs (e.g., `Q2`, `Q3`, `Q11`) are sent, they would fail the `validQuestionIds` check (line 144) and be rejected with 400, which is safe. However, the server does not explicitly require a `quizVersion` field, meaning there is no way to distinguish between a v2 client and a crafted request that happens to use v2 question IDs. More importantly, the response always returns `quizVersion: 'v2'` (line 402) regardless of what the client claims, so Loops.so always gets the correct version label. The risk is low because the question ID namespace changed completely between v1 and v2, providing implicit version gating. If a future v3 reuses any v2 question IDs, this implicit protection would break.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 184, 328, 402)
**Verification Criteria:** (1) Send a request with old v1 question IDs (`Q2`, `Q3`, `Q11`) and verify a 400 rejection. (2) Send a valid v2 payload without a `quizVersion` field and verify the response and Loops.so payload both contain `quizVersion: 'v2'`. These tests confirm the implicit version gating works for the v1->v2 transition.

---

### SEC-09: Fire-and-forget API call can silently fail — user sees result, server never processes

**Severity:** Medium
**Description:** In `quiz.astro` lines 656-666, the API call to `/api/quiz-submit` is fire-and-forget: `fetch(...).catch((err) => console.error(...))`. If this request fails (network error, 429 rate limit, 500 server error, or the user navigates away before the fetch completes), the user sees their archetype result and continues their journey, but their email is never registered with Loops.so. They would never receive the archetype email sequence. There is no retry mechanism, no user notification, and no local fallback (e.g., localStorage queue). The only indication is a `console.error` that no user would see. Given that the email sequence is the primary conversion funnel (quiz -> email drip -> Kickstarter), silent failures directly impact revenue.

**Affected Files:** `src/pages/quiz.astro` (lines 656-666)
**Verification Criteria:** (1) This is partially a design decision (documented in line 653: "Fire-and-forget"). (2) A mitigation test: in the E2E suite, intercept `/api/quiz-submit` with a 500 response, verify the user still sees results (current behavior), and add a test that verifies some visible indication of failure (e.g., a toast notification, a retry button, or at minimum a `data-submit-status` attribute on the DOM for monitoring). (3) Alternative: verify localStorage contains a queued submission that a service worker or next page load can retry.

---

### SEC-10: Loops.so API key not exposed client-side — VERIFIED SAFE

**Severity:** (No finding — positive verification)
**Description:** The `LOOPS_API_KEY` is read from `import.meta.env` / `process.env` on the server side only (line 271 of `quiz-submit.ts`). The client-side code in `quiz.astro` never references the API key — it only calls `/api/quiz-submit` and does not interact with Loops.so directly. Error responses from the API (lines 274-277, 348-351, etc.) return generic messages like `"Email service not configured"` and `"Email service unavailable"` — the key value is never leaked in responses. The `env.d.ts` file declares `LOOPS_API_KEY` as part of `ImportMetaEnv`, and Astro's SSR build pipeline does not expose server-only env vars to client bundles when `prerender = false` (line 1 of quiz-submit.ts). This is correctly implemented.

**Affected Files:** N/A (verification complete)
**Verification Criteria:** Grep the built client-side JavaScript bundle for `LOOPS_API_KEY` or `test-loops-key` — should find zero matches. Grep `quiz.astro` script section for `LOOPS_API_KEY` — zero matches.

---

### SEC-11: No test coverage for selfSelected, displayOrder, or CSRF scenarios

**Severity:** Medium
**Description:** The existing test suites (`quiz-submit.test.ts`, `quiz-submit-medium.test.ts`) have thorough coverage for SYN-01 through SYN-13, but have no tests for: (1) `selfSelected` field tampering — no test sends `selfSelected` with valid/invalid archetype slugs, (2) `displayOrder` field content validation — no test sends a `displayOrder` with non-numeric content or PII, (3) cross-origin request handling — no test validates or rejects requests without proper `Origin` headers. These gaps mean the security properties of these fields are untested and could regress without detection.

**Affected Files:** `tests/quiz-submit.test.ts`, `tests/quiz-submit-medium.test.ts`
**Verification Criteria:** (1) `grep -c 'selfSelected' tests/quiz-submit*.test.ts` should return at least 3 (one test for valid override, one for invalid slug rejection, one for absent field). (2) `grep -c 'displayOrder' tests/quiz-submit*.test.ts` should return at least 2 (one test for valid numeric content, one for injected non-numeric content). (3) `grep -c 'origin\|Origin\|csrf\|CSRF' tests/quiz-submit*.test.ts` should return at least 1.

---

### SEC-12: Replay protection relies solely on Loops.so Idempotency-Key

**Severity:** Medium
**Description:** The only replay protection is the `Idempotency-Key` header sent to Loops.so (line 311): `quiz_${email.toLowerCase()}_${today}`. This means: (1) the same email can be submitted once per calendar day, (2) different emails have no replay protection at all (limited only by the fragile in-memory rate limiter), (3) the replay protection is entirely delegated to Loops.so's server-side idempotency handling — the quiz server itself does not track or reject duplicates. If Loops.so does not enforce idempotency keys, or if it interprets them differently, duplicate email registrations can occur. Additionally, the idempotency key format is easily guessable (attacker knows the victim's email + today's date), so the key provides no authentication — it only prevents accidental duplicates within Loops.so, not malicious ones.

**Affected Files:** `src/pages/api/quiz-submit.ts` (line 311)
**Verification Criteria:** (1) Verify Loops.so documentation confirms they enforce `Idempotency-Key` headers. (2) Consider adding server-side deduplication: track submitted emails in a persistent store (KV/DB) with TTL, and reject duplicates before calling Loops.so.

---

### SEC-13: answerQuestion in quiz-engine does not validate answerId belongs to current question

**Severity:** Medium
**Description:** The `answerQuestion(answerId)` method in `quiz-engine.ts` (lines 171-188) records the provided `answerId` for the current question without validating that the answerId actually belongs to that question. It simply does `answers[question.id] = answerId`. While this is a client-side engine (and the server-side `validateAnswers()` in `quiz-submit.ts` does proper cross-question validation), a manipulated client could inject any string as an answerId into the engine state. This wouldn't cause a security issue on the server (the server validates independently), but it could cause unexpected client-side behavior — e.g., inserting an answerId from a different question would cause the `classificationResult` to be computed with incorrect scores, potentially triggering (or avoiding) the self-select flow.

**Affected Files:** `src/lib/quiz-engine.ts` (lines 171-188)
**Verification Criteria:** (1) Add a unit test in `tests/quiz-engine.test.ts` that calls `engine.answerQuestion('INVALID-ID')` and verifies the engine either rejects it or handles it gracefully (e.g., computes scores that ignore unknown IDs — which `computeScores` already does via the `answerScoringMap.get(answerId)` lookup). (2) This is low-risk because server-side validation catches all manipulation before it reaches Loops.so.

---

### SEC-14: Email sent to Loops.so in original case despite lowercase idempotency key

**Severity:** Medium
**Description:** The idempotency key normalizes the email to lowercase (line 311: `email.toLowerCase()`), but the email sent to Loops.so as a contact property (line 314: `email`) preserves the original case from the request. This means: (a) `User@Example.com` and `user@example.com` produce the same idempotency key (correct dedup), but (b) the first submission's email casing is what Loops.so stores as the contact email. If Loops.so treats email as case-sensitive for contact dedup, a second submission with different casing might create a new contact despite the idempotency key match (since the idempotency key might only prevent duplicate *events*, not duplicate *contacts*). The email should be lowercased before sending to Loops.so as well.

**Affected Files:** `src/pages/api/quiz-submit.ts` (lines 311, 314)
**Verification Criteria:** (1) Verify that the `email` field in the Loops.so payload is lowercased: `expect(loopsBody.email).toBe('user@example.com')` when submitting `User@Example.com`. (2) Grep `quiz-submit.ts` for `email.toLowerCase()` or `email.trim().toLowerCase()` being assigned to a normalized variable used in both the idempotency key and the Loops.so payload body.

---

## Summary

- Total findings: 13 (SEC-10 is a positive verification, not a finding)
- By severity: Critical: 0, High: 4 (SEC-01, SEC-02, SEC-03, SEC-04, SEC-06), Medium: 8 (SEC-05, SEC-07, SEC-08, SEC-09, SEC-11, SEC-12, SEC-13, SEC-14)
- Key themes: The primary attack surface is the API endpoint's trust boundary — it accepts raw user input (firstName, email, displayOrder) and forwards it to Loops.so with minimal sanitization. The rate limiter is structurally weak (in-memory, resets on cold start, no time window). There is no CSRF/origin protection, making the endpoint an open email registration vector. The strongest security property is the server-side answer validation (SYN-02), which is thorough and correctly rejects malformed payloads. The weakest areas are input sanitization for forwarded fields and the absence of persistent rate limiting.
