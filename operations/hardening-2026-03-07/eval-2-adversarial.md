# Evaluation Report: Adversarial Security & Input Validation

**Evaluator lens:** Adversarial Security & Input Validation
**Date:** 2026-03-07
**Scope:** Quiz pipeline — data model, classifier, API route, client-side UI

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 4     |
| Medium   | 4     |
| Total    | 8     |

The quiz pipeline has a solid foundation: server-side classification prevents client-side score
tampering, archetype content rendering uses `textContent` (preventing XSS), the API key is properly
server-side-only, and error responses never leak sensitive data. However, the API endpoint is
essentially unguarded against direct abuse. All bot-detection mechanisms exist exclusively in
client-side JavaScript and are trivially bypassed by anyone making direct HTTP requests. Combined
with the absence of rate limiting and weak email validation, an attacker can weaponize the endpoint
to pollute the mailing list, exhaust the Loops.so API quota, or inflate Vercel invocation costs.

---

## Findings

### [S-01]: No Rate Limiting or Abuse Protection on API Route
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts`
**Description:** The `/api/quiz-submit` endpoint has no rate limiting, IP throttling, or abuse
detection at any layer. An attacker can call the endpoint thousands of times per minute with
automated scripts. This enables: (1) mailing list pollution by adding thousands of junk email
addresses to Loops.so, (2) Loops.so API quota exhaustion which could block legitimate submissions,
(3) Vercel serverless invocation cost inflation.

**Evidence:** The entire `quiz-submit.ts` handler (lines 7-99) contains no rate-limiting logic,
no IP checking, no request counting, and no abuse detection. There is no Vercel middleware file
(`src/middleware.ts` does not exist) and no `vercel.json` with rate-limiting configuration. The
only protections (honeypot and timing) are client-side only (see S-02).

---

### [S-02]: Bot Detection Is Client-Side Only (Trivially Bypassed)
**Severity:** High
**Affected files:** `src/pages/quiz.astro` (lines 321-325), `src/pages/api/quiz-submit.ts`
**Description:** The quiz implements two bot-detection mechanisms: a honeypot field and a
timing check (submissions under 10 seconds are silently rejected). Both exist exclusively in the
client-side `<script>` block of `quiz.astro`. The server-side API route performs zero bot
detection. Any attacker bypassing the browser (curl, Python requests, Postman) encounters no
anti-bot protection whatsoever.

**Evidence:**
- Honeypot check at `quiz.astro` line 322: `if (formData.get('website')) return;` -- client-side
  only, never sent to server or validated there.
- Timing check at `quiz.astro` lines 323-325: `const elapsed = (Date.now() - state.startTime) /
  1000; if (elapsed < 10) return;` -- client-side only, `startTime` never transmitted to server.
- `quiz-submit.ts` accepts any POST with valid JSON structure. A minimal attack payload:
  ```
  curl -X POST https://www.thehermeticflight.com/api/quiz-submit \
    -H 'Content-Type: application/json' \
    -d '{"email":"bot@spam.com","firstName":"Bot","answers":{}}'
  ```
  This succeeds because `answers` passes the `typeof answers !== 'object'` check (line 19), and
  `computeScores` returns `{A:0, B:0, C:0, D:0}` which classifies as `air_weaver`.

---

### [S-03]: Email Validation Is Insufficient
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts` (line 13)
**Description:** Email validation consists of a single check: `!email.includes('@')`. This
accepts virtually any string containing an `@` character, including strings with no TLD, strings
with spaces, strings with control characters, and strings containing HTML or script payloads.
The unvalidated email string is then passed directly to the Loops.so API and used verbatim
in the idempotency key. The `firstName` field has no validation at all -- any type or length
is accepted and forwarded to Loops.so.

**Evidence:**
- Validation at line 13: `if (!email || typeof email !== 'string' || !email.includes('@'))`
- All of the following pass validation and reach Loops.so:
  - `"a@b"` -- no TLD
  - `"@"` -- empty local part (blocked by `!email` but `" @"` passes)
  - `"user name@domain.com"` -- spaces in local part
  - `"<script>alert(1)</script>@evil.com"` -- HTML in local part (stored XSS risk if
    Loops.so admin dashboard renders this)
  - A 100KB string containing `@` -- no length limit
- `firstName` at line 59: `firstName: firstName || ''` -- could be an object, array, number,
  or arbitrarily long string. No type or length check.
- These values are sent directly to Loops.so at lines 54-75, potentially contaminating
  the contact database or triggering unexpected behavior in the third-party API.

---

### [S-04]: Unsanitized Non-Scored Answer Values Forwarded to Loops.so
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts` (lines 31-34, 62-65)
**Description:** Non-scored answer values (Q2, Q3, Q19, Q20) are extracted from the
client-supplied `answers` object with no type checking or sanitization, then spread directly
into the Loops.so API request body as contact properties. Since the `answers` object is only
validated as `typeof answers !== 'object'` (which also passes for arrays), an attacker can
inject arbitrary data types and values into the Loops.so contact record.

**Evidence:**
- Extraction at lines 31-34:
  ```typescript
  const experienceLevel = answers['Q2'] || null;
  const painPoint = answers['Q3'] || null;
  const cardBackPref = answers['Q19'] || null;
  const productInterest = answers['Q20'] || null;
  ```
- These values can be objects, arrays, or extremely long strings since no type or length
  validation is performed on individual answer values.
- Injection into Loops.so body at lines 62-65:
  ```typescript
  ...(experienceLevel && { experienceLevel }),
  ...(painPoint && { painPoint }),
  ```
- Attack payload example:
  ```json
  {
    "email": "test@test.com",
    "answers": {
      "Q2": {"injected": "object_data", "nested": {"deep": true}},
      "Q3": "<img src=x onerror=alert(1)>",
      "Q19": "A".repeat(100000)
    }
  }
  ```
  This sends arbitrary objects and long strings as Loops.so contact properties. The scored
  answer processing in `computeScores` is robust (unknown IDs are ignored), but the non-scored
  extraction has no guardrails.

---

### [S-05]: Idempotency Key Is Gameable via Email Case Variation
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts` (line 52)
**Description:** The idempotency key `quiz_${email}_${today}` uses the raw, unnormalized
email string. Email addresses are case-insensitive in the local part per RFC 5321 in practice
(most providers treat them as case-insensitive). An attacker can submit the same effective
email address multiple times per day by varying case, generating distinct idempotency keys
that Loops.so treats as separate requests.

**Evidence:**
- Idempotency key construction at line 52: `` `quiz_${email}_${today}` ``
- `user@gmail.com`, `User@gmail.com`, `USER@GMAIL.COM`, and `uSeR@gmail.com` all generate
  different idempotency keys but deliver to the same inbox.
- Additionally, the key resets daily (uses `today` date), so the same email can resubmit
  every 24 hours with potentially different quiz results, overwriting their archetype in
  Loops.so.

---

### [S-06]: No CSRF Protection Allows Cross-Origin Email Subscription
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts`
**Description:** The API endpoint performs no CSRF validation: no token verification, no
Origin header checking, no Referer validation. While the `Content-Type: application/json`
requirement provides partial protection (browsers send a CORS preflight for non-simple
content types), the server still processes the request even if the browser blocks the
response. A malicious website could submit a victim's email address to the quiz endpoint,
subscribing them to the mailing list without consent.

**Evidence:**
- No CSRF token generation or validation anywhere in the codebase.
- No Origin or Referer header checks in `quiz-submit.ts`.
- No Vercel middleware or `vercel.json` CORS configuration exists.
- Attack scenario: A page on `evil.com` includes JavaScript that calls
  `fetch('https://www.thehermeticflight.com/api/quiz-submit', ...)` with a victim's email.
  Even if the CORS preflight fails and the browser blocks the response, the Vercel function
  has already executed and the Loops.so event has been sent. The practical impact is
  unsolicited mailing list subscription, which could result in CAN-SPAM/GDPR liability.

---

### [S-07]: No Application-Level Request Body Size Limit
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts` (line 9)
**Description:** The endpoint calls `request.json()` without any prior body size validation.
While Vercel imposes a default ~4.5MB body limit for serverless functions, the application
performs no size checking. A 4MB JSON payload with thousands of answer keys would be fully
parsed and then iterated over in `computeScores` via `Object.entries(answers)`, consuming
CPU time. Combined with the absence of rate limiting (S-01), this creates a resource
exhaustion vector.

**Evidence:**
- `request.json()` at line 9 with no preceding size check.
- `Object.entries(answers)` iteration in `computeScores` at `classifier.ts` line 101
  would iterate over every key in the answers object.
- Attack payload: A 4MB JSON body with 100,000 answer keys, each requiring a Map lookup
  in `answerScoringMap.get(answerId)`. While each lookup is O(1), the volume could
  consume several hundred milliseconds of serverless compute per request.

---

### [S-08]: Error Responses Lack Security Headers
**Severity:** Medium
**Affected files:** `src/pages/api/quiz-submit.ts` (all Response constructors)
**Description:** All API responses include only `Content-Type: application/json` with no
additional security headers. Missing headers include `X-Content-Type-Options: nosniff`
(prevents MIME-type sniffing), `Cache-Control: no-store` (prevents caching of error
responses containing potentially diagnostic information), and `X-Frame-Options: DENY`
(though less relevant for JSON API responses). While these are defense-in-depth measures
and not directly exploitable in this context, their absence represents incomplete security
hygiene for a public-facing API.

**Evidence:**
- Every Response constructor in `quiz-submit.ts` (lines 14-16, 20-22, 40-42, 82-84,
  88-90, 94-96) includes only:
  ```typescript
  headers: { 'Content-Type': 'application/json' }
  ```
- No `vercel.json` exists to add security headers at the platform level.
- No Astro middleware exists to inject headers globally.

---

## Notable Positives (Not Findings)

The following areas were evaluated and found to be adequately handled:

1. **XSS Prevention:** The quiz UI exclusively uses `textContent` for rendering archetype
   results (lines 252-254 of `quiz.astro`), preventing DOM-based XSS. Archetype content is
   static and hardcoded, not derived from user input. Astro's build-time templating auto-escapes
   quiz question and answer text.

2. **API Key Protection:** `LOOPS_API_KEY` is accessed via `import.meta.env` which Astro
   restricts to server-side code. It is never exposed in client bundles. Error responses are
   generic and never include the key or Loops.so-specific details.

3. **Classifier Robustness:** `computeScores` uses a `Map` for answer lookups (immune to
   prototype pollution), silently ignores unknown answer IDs, and only processes scored
   questions. The `classify` function operates on numeric `DimensionScores` values, making
   it immune to type confusion attacks. The classifier cannot be tricked into returning an
   invalid archetype slug.

4. **Server-Side Classification:** The server recomputes scores and classification
   independently (line 27-28 of `quiz-submit.ts`), never trusting client-supplied archetype
   values. This prevents score manipulation.
