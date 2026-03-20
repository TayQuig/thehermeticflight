# Evaluation: Email Gate + Product Research — Functional Correctness

**Evaluator lens:** Functional Correctness
**Date:** 2026-03-19
**Branch:** `feature/quiz-design-overhaul`
**Files evaluated:**

| # | File | Lines |
|---|------|-------|
| 1 | `src/pages/quiz.astro` | ~1118 |
| 2 | `src/pages/archetype/[slug].astro` | ~461 |
| 3 | `src/pages/api/quiz-submit.ts` | ~489 |
| 4 | `src/pages/api/journey-subscribe.ts` | ~298 |
| 5 | `tests/quiz-gate-e2e.spec.ts` | ~329 |
| 6 | `tests/quiz-submit.test.ts` | ~948 |

---

## Category Scores

| Category | Score | Notes |
|----------|-------|-------|
| 1. Client-Side Logic Correctness | 4 | Solid state machine, all paths handled, minor memory concern |
| 2. Server-Side Logic Correctness | 4 | Strong validation, one normalization gap |
| 3. Security | 3 | Cookie unescaped, innerHTML from trusted source, firstName unsanitized in journey-subscribe |
| 4. Error Handling | 4 | Comprehensive on server, optimistic-reveal pattern is sound |
| 5. Test Coverage | 4 | Thorough unit tests, E2E covers main paths, few gaps |

**Overall Score: 3.8 / 5**

---

## Findings

### F-01 — Cookie value not URL-encoded (Major)

**Severity:** Major
**Location:** `src/pages/quiz.astro:740`, `src/pages/archetype/[slug].astro:369`
**Description:** The cookie value is set with raw string interpolation:
```js
document.cookie = `thf_sub=${currentSlug};path=/;max-age=2592000;SameSite=Lax`;
```
The slug comes from `window.location.pathname.split('/').pop()` (in [slug].astro) or from `toUrlSlug()` (in quiz.astro). While current slugs are safe ASCII kebab-case strings, there is no encoding. If a slug ever contained `;`, `=`, or non-ASCII characters, the cookie would be malformed or truncated, potentially breaking the gate on [slug].astro.

The SSR check on [slug].astro (line 36) reads `cookie.value` via Astro's cookie API, which does perform URL decoding. If the client side does not URL-encode but the server side URL-decodes, a mismatch would cause the gate to remain locked even after email submission.

**Recommended fix:** Use `encodeURIComponent()` when setting:
```js
document.cookie = `thf_sub=${encodeURIComponent(kebabSlug)};path=/;...`;
```
This is a no-op for current slugs but defends against future slug formats.

---

### F-02 — journey-subscribe.ts does not normalize email (Major)

**Severity:** Major
**Location:** `src/pages/api/journey-subscribe.ts:110,161,207-223`
**Description:** Unlike `quiz-submit.ts` which trims and lowercases email before validation and use (line 231), `journey-subscribe.ts` passes the raw `email` value directly to:
1. The email validation function (line 122) — spaces would cause validation failure, which is correct
2. The rate limiter (line 161) — `checkEmailRateLimit(buckets, email)` uses the raw value. `"Test@Example.com"` and `"test@example.com"` would occupy separate rate limit buckets, allowing bypass
3. The Loops.so payload (line 216) — the email sent to Loops.so is not lowercased. Different casing could create duplicate contacts
4. The Idempotency-Key (line 213) — only the key itself uses `.toLowerCase()`, but the contact email does not

The rate limiter bypass is the most material issue: an attacker can vary email casing to submit 3 * N requests where N is the number of distinct casings.

**Recommended fix:** Add the same normalization present in quiz-submit.ts:
```ts
const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
```
Then use `normalizedEmail` everywhere instead of `email`.

---

### F-03 — journey-subscribe.ts does not sanitize firstName (Major)

**Severity:** Major
**Location:** `src/pages/api/journey-subscribe.ts:220`
**Description:** `quiz-submit.ts` has explicit firstName HTML-tag stripping (line 307-309):
```ts
const sanitizedFirstName = typeof firstName === 'string'
  ? firstName.replace(/<[^>]*>/g, '')
  : '';
```
`journey-subscribe.ts` has no such sanitization. It passes `firstName` directly to Loops.so (line 220):
```ts
firstName: typeof firstName === 'string' ? firstName : '',
```
A malicious `firstName` value like `<script>alert(1)</script>` would be stored as a Loops.so contact property and could appear in email templates.

**Recommended fix:** Apply the same `replace(/<[^>]*>/g, '')` sanitization as in quiz-submit.ts.

---

### F-04 — innerHTML in self-select card builder uses build-time content (Minor)

**Severity:** Minor
**Location:** `src/pages/quiz.astro:712-719`
**Description:** The self-select card builder constructs HTML via `card.innerHTML`:
```js
card.innerHTML = `
  <div class="mb-3">
    <span ...>${content.element}</span>
  </div>
  <h3 ...>${content.title}</h3>
  <p ...>${tagline}</p>
  ...
`;
```
The values (`content.element`, `content.title`, `tagline`) come from the `archetypes` object, which is a static build-time import from `archetype-content.ts`. These are operator-authored strings, not user input. However, if an archetype description ever contained `<script>` or similar HTML, it would be injected.

**Recommended fix:** Use `textContent` for data values, or use `document.createElement` and set `.textContent` separately. This is low-risk given the data is hardcoded, but defense-in-depth is worthwhile.

---

### F-05 — set:html for JSON-LD schema uses operator data via JSON.stringify (Note)

**Severity:** Note
**Location:** `src/pages/archetype/[slug].astro:64`
**Description:** The line `set:html={JSON.stringify(faqSchema)}` renders JSON-LD into a `<script type="application/ld+json">` tag. `JSON.stringify` escapes `<`, `>`, and `&` within strings, so this is safe against XSS injection through the JSON content. The source data (`journey.data.journaling_prompts`) comes from Astro content collections which are operator-authored. No vulnerability here, but worth documenting that `JSON.stringify` is the correct serialization choice.

---

### F-06 — Gate form on [slug].astro does not forward honeypot to API (Minor)

**Severity:** Minor
**Location:** `src/pages/archetype/[slug].astro:392`
**Description:** The gate form handler checks the honeypot client-side (line 352: `if (formData.get('website')) return;`) but does not include the `website` field in the API payload sent to `journey-subscribe`:
```js
body: JSON.stringify({ email, archetype: currentSlug })
```
This means the server-side honeypot check in `journey-subscribe.ts` (line 114) will never fire for gate form submissions. The client-side check is sufficient to block simple bots, but a sophisticated bot that bypasses client-side JS could submit directly to the API without the honeypot field, and the server would accept it.

However, this is a minor concern because: (a) direct API submissions without the `website` field are treated as legitimate, which is the correct default, and (b) the rate limiter provides the actual server-side bot protection.

**Recommended fix:** Forward the honeypot field from the gate form to the API for consistency:
```js
body: JSON.stringify({ email, archetype: currentSlug, website: formData.get('website') || '' })
```

---

### F-07 — Email series form on [slug].astro also omits honeypot from API payload (Minor)

**Severity:** Minor
**Location:** `src/pages/archetype/[slug].astro:431`
**Description:** Same pattern as F-06. The email series signup form handler at line 431:
```js
body: JSON.stringify({ email, firstName, archetype: urlSlug })
```
Does not include the `website` honeypot field, despite the form containing a honeypot input and the client-side check at line 412.

**Recommended fix:** Include `website: ''` in the payload for consistency.

---

### F-08 — displayOrder array values not validated as numbers (Minor)

**Severity:** Minor
**Location:** `src/pages/api/quiz-submit.ts:358-359`
**Description:** The displayOrder sanitization validates keys against a regex and checks `Array.isArray(value)`, but casts the array as `number[]` without verifying that each element is actually a number:
```ts
filtered[key] = value as number[];
```
A crafted payload could include strings, objects, or nested arrays within the displayOrder values. These would be forwarded to Loops.so as event properties.

This is low-severity because displayOrder is purely analytics metadata and doesn't affect classification or gating logic. Loops.so would serialize whatever it receives.

**Recommended fix:** Add element-type validation:
```ts
if (VALID_DISPLAY_ORDER_KEY.test(key) && Array.isArray(value)
    && value.every((v: unknown) => typeof v === 'number')) {
  filtered[key] = value;
}
```

---

### F-09 — Double API call for email-submit-then-product-research path (Minor)

**Severity:** Minor
**Location:** `src/pages/quiz.astro:922-934` and `src/pages/quiz.astro:839-855`
**Description:** When a user submits their email at the gate, the `revealResults()` function fires a `fetch('/api/quiz-submit', ...)` call immediately (line 922-934) without product research data. Then, when the user clicks "Continue" on the product research section, a second `fetch('/api/quiz-submit', ...)` fires (line 839-855) with the product research data included.

This results in two API calls to quiz-submit for every user who completes product research. The first call has no product research, the second has it. The Idempotency-Key in both calls is `quiz_${normalizedEmail}_${today}`, so Loops.so may deduplicate and only process the first one — meaning the product research data from the second call may be silently dropped by Loops.so.

**Recommended fix:** Either:
1. Defer the first API call until after the product research phase (skip or continue), or
2. Use a different idempotency key for the product research follow-up (e.g., `quiz_pr_${email}_${today}`)

This is likely the most impactful functional bug found.

---

### F-10 — Re-capture form handler registered with { once: true } (Note)

**Severity:** Note
**Location:** `src/pages/quiz.astro:984`
**Description:** The re-capture form submit handler is registered with `{ once: true }`:
```js
recaptureForm.addEventListener('submit', async (e) => { ... }, { once: true });
```
This means if the first submission fails (e.g., network error), the user cannot retry by submitting the form again. However, since the re-capture fires the API call as fire-and-forget and reveals content optimistically regardless of API success, the `{ once: true }` is appropriate — the content is revealed on first submission regardless, and double-submission is prevented.

No fix needed; this is correct behavior.

---

### F-11 — Product research continue/skip buttons also use { once: true } (Note)

**Severity:** Note
**Location:** `src/pages/quiz.astro:824,859`
**Description:** Both the product research skip and continue buttons are registered with `{ once: true }`. This prevents double-clicking from firing multiple API calls or re-triggering the CTA reveal. This is correct defensive behavior.

---

### F-12 — Copy link handler can accumulate on self-select-card re-render (Note)

**Severity:** Note
**Location:** `src/pages/quiz.astro:766-778`
**Description:** The `showJourneyCta()` function attaches event listeners to `#share-copy`, `#share-x`, and `#share-fb` every time it is called. In the current flow, `showJourneyCta()` is only called once (from either skip or continue), so this is not a problem. However, if future changes cause it to be called multiple times, the listeners would stack.

No fix needed currently, but worth noting for future maintenance.

---

### F-13 — thf_sub cookie is per-archetype, not per-user (Note)

**Severity:** Note
**Location:** `src/pages/archetype/[slug].astro:36`
**Description:** The cookie check `cookie.value !== urlSlug` means the cookie stores only the last archetype that was gated. If a user takes the quiz twice and gets different archetypes, only the most recent archetype's journey page is unlocked. Visiting the first archetype's journey page would show the gate again.

This is likely intentional (encouraging re-engagement), but worth documenting as a design decision. If the intent is to unlock all previously visited journeys, the cookie would need to store a comma-separated list of slugs.

---

### F-14 — No unit tests for journey-subscribe firstName sanitization (Major)

**Severity:** Major
**Location:** `tests/journey-subscribe.test.ts` (absent test)
**Description:** The journey-subscribe test file has no test verifying that firstName is sanitized before being forwarded to Loops.so. This is connected to F-03 — the sanitization is missing in the implementation, and there is no test to catch this gap. The quiz-submit test file (lines 768-805) has thorough firstName sanitization tests that serve as the model.

**Recommended fix:** After implementing F-03's fix, add tests mirroring `quiz-submit.test.ts`'s S-05 tests:
- Strips HTML tags from firstName before sending to Loops.so
- Preserves valid firstName without HTML

---

### F-15 — E2E tests do not cover wrong-archetype cookie scenario on quiz results page (Minor)

**Severity:** Minor
**Location:** `tests/quiz-gate-e2e.spec.ts` (absent test)
**Description:** The E2E tests cover the journey page's wrong-archetype cookie scenario (test at line 292), but there is no E2E test verifying what happens when a user has a `thf_sub` cookie from a previous quiz and takes the quiz again, getting a different archetype. The cookie would be overwritten by the new archetype.

**Recommended fix:** Add an E2E test that:
1. Sets an existing `thf_sub` cookie with one archetype
2. Completes the quiz (possibly getting a different archetype)
3. Verifies the cookie is updated to the new archetype

---

### F-16 — E2E product research API payload test relies on waitForTimeout (Minor)

**Severity:** Minor
**Location:** `tests/quiz-gate-e2e.spec.ts:246`
**Description:** The test at line 246 uses `await page.waitForTimeout(1500)` to wait for the API call to be captured. This is a brittle timing-dependent assertion. If the page is slow (CI environment, cold start), the timeout may not be sufficient.

**Recommended fix:** Use `await page.waitForRequest('**/api/quiz-submit')` or poll for `capturedPayload` to be non-null:
```ts
await expect.poll(() => capturedPayload).not.toBeNull();
```

---

### F-17 — Product research test may capture first API call, not second (Critical)

**Severity:** Critical
**Location:** `tests/quiz-gate-e2e.spec.ts:221-254`
**Description:** Directly related to F-09. The E2E test at line 221 intercepts `**/api/quiz-submit` and captures the payload. However, due to the double-API-call issue (F-09), the route handler will be invoked twice: once at email submission (no product research) and once at product-research continue click. The route handler calls `route.fulfill()` on each request.

The variable `capturedPayload` is overwritten each time, so after the `waitForTimeout(1500)`, it should contain the second call's payload. However, there's a race: if the second call hasn't fired yet by the time the assertion runs, `capturedPayload` would contain the first call's payload (without product research), and the test would fail with `pr` being undefined.

The test is likely passing because the 1500ms timeout is generous enough, but this is fragile.

**Recommended fix:** Track all payloads in an array and assert on the last one, or specifically wait for the second request:
```ts
const payloads: Record<string, unknown>[] = [];
await page.route('**/api/quiz-submit', async (route) => {
  payloads.push(JSON.parse(route.request().postData() ?? '{}'));
  await route.fulfill({ ... });
});
// ... do quiz + product research ...
await expect.poll(() => payloads.length).toBeGreaterThanOrEqual(2);
const pr = (payloads[payloads.length - 1]).productResearch;
```

---

### F-18 — journey-subscribe rate limiter uses raw email, not normalized (Minor)

**Severity:** Minor (duplicate of F-02, called out for rate limiter specifically)
**Location:** `src/pages/api/journey-subscribe.ts:161`
**Description:** `checkEmailRateLimit(buckets, email)` uses the raw email. Since emails are case-insensitive per RFC 5321, `User@Example.com` and `user@example.com` should hit the same bucket. They don't, allowing the per-email rate limit to be trivially bypassed by varying case.

**Recommended fix:** Already covered by F-02's normalization fix.

---

## Summary

The email gate and product research implementation is solidly built with well-structured state management, comprehensive server-side validation, and a defense-in-depth approach to security. The quiz engine's state machine correctly routes all user paths (email submit, skip, re-capture, product research continue/skip), and the cookie-based gating on the journey page works correctly.

The most significant functional issue is F-09 (double API call with identical idempotency key), which means Loops.so likely discards the product research data on the second call. This directly undermines the purpose of the product research feature. The second most impactful cluster is F-02/F-03 (missing email normalization and firstName sanitization in journey-subscribe.ts), which represents a parity gap between the two API endpoints. The E2E test for product research payloads (F-17) is fragile due to the double-call issue.

The cookie handling is correct for current slug formats but lacks encoding (F-01). Security posture is reasonable: input validation is thorough on both endpoints, rate limiting exists, honeypots are checked client-side, and the innerHTML usage comes from trusted build-time data. The main security concern is the unsanitized firstName in journey-subscribe.ts being forwarded to Loops.so.

Recommended priority order for fixes:
1. **F-09** (Critical functional: double API call loses product research data)
2. **F-17** (Critical test: product research E2E is fragile due to F-09)
3. **F-02** (Major: email normalization parity in journey-subscribe)
4. **F-03** (Major: firstName sanitization parity in journey-subscribe)
5. **F-14** (Major: missing test coverage for F-03)
6. **F-01** (Major: cookie encoding)
7. F-06, F-07, F-08 (Minor: honeypot forwarding, displayOrder validation)
8. F-04, F-15, F-16 (Minor: innerHTML defense-in-depth, E2E gaps)
