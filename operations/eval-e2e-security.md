# E2E Security Integrity Evaluation

**Date:** 2026-03-19
**Evaluator:** Security Integrity (Sonnet)
**Score:** 4.4/5.0

---

## Set-Cookie Attribute Assessment

Three distinct Set-Cookie emission sites exist in the implementation. Each is assessed against the required attribute checklist.

### Site 1 — `quiz-submit.ts` (line 491)

```
thf_sub=${encodeURIComponent(mergedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure
```

| Attribute | Required | Present | Status |
|---|---|---|---|
| `Path=/` | Yes | Yes | PASS |
| `Max-Age=15552000` | Yes | Yes | PASS |
| `SameSite=Lax` | Yes | Yes | PASS |
| `Secure` (prod only) | Prod yes | Always | ACCEPTABLE — Vercel is always HTTPS; over-inclusive is safe |
| `HttpOnly` absent | Yes | Absent | PASS |

### Site 2 — `journey-subscribe.ts` (line 304)

```
thf_sub=${encodeURIComponent(mergedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure
```

The header string is identical to Site 1. All attribute checks pass identically. No `HttpOnly` present.

### Site 3 — `[slug].astro` cookie renewal (lines 43–48)

```typescript
Astro.cookies.set('thf_sub', cookie.value, {
  path: '/',
  maxAge: 15552000,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
});
```

Live curl result (dev): `set-cookie: thf_sub=air-weaver; Max-Age=15552000; Path=/; SameSite=Lax`

| Attribute | Required | Present | Status |
|---|---|---|---|
| `Path=/` | Yes | Yes | PASS |
| `Max-Age=15552000` | Yes | Yes | PASS |
| `SameSite=Lax` | Yes | Yes (case: `Lax`) | PASS |
| `Secure` absent in dev | Expected absent | Absent | PASS (conditional on `PROD`) |
| `HttpOnly` absent | Yes | Absent | PASS |

The `Secure` conditional (`import.meta.env.PROD`) is correct by design. Dev requires no `Secure` on localhost; production will include it. The API endpoints set `Secure` unconditionally — this is also correct because Vercel serverless functions only run on HTTPS-enforced infrastructure. The parity difference is not a gap; it is appropriate to each execution context.

**Live test coverage:** Tests 4, 5, and 6 from `harden-cookie-headers.md` directly exercised Site 3. All three returned expected results. Sites 1 and 2 could not be exercised live (see API Testability Gap section below).

**Overall attribute assessment: PASS on all live-testable sites. Code review confirms Sites 1 and 2 are structurally correct.**

---

## Multi-Slug Security

The multi-slug implementation follows a clean three-step pattern at each write site: `parseCookieValue()` → `appendSlug()` → `encodeURIComponent()`. The read path inverts cleanly: `decodeURIComponent()` → `.split(',')` → `.filter(Boolean)` → `.includes()`.

### Injection test 4 (correct multi-slug access)

Cookie `thf_sub=shadow-dancer%2Cair-weaver` produced `journey-content` count of 2 (content rendered). The URL-encoded `%2C` was decoded to `,` before the split, and `includes('air-weaver')` correctly returned true. This confirms the encode/decode symmetry is intact end-to-end.

### Injection test 5 (multi-slug without target)

Cookie `thf_sub=shadow-dancer%2Cearth-invoker` produced `journey-quiz-cta` count of 1 (gate held). Two valid slugs, neither matching `air-weaver`, correctly blocked access. This confirms the gate evaluates slug membership exactly — no prefix match, no partial match, no set containment of the wrong kind.

### Deduplication contract

`appendSlug()` uses `segments.includes(newSlug)` for deduplication. This is an exact string comparison on decoded values. Because slugs are always validated before entering the cookie (against `VALID_SLUGS` in quiz-submit and `VALID_URL_SLUGS` in journey-subscribe), the deduplication cannot be confused by encoding variants — the values in the cookie are always decoded comma-separated ASCII-hyphen strings at read time.

### Maximum cookie size

With exactly 6 valid slugs, the maximum unencoded value is approximately 75 characters. URL-encoding the commas (`%2C`) adds 4 bytes per separator (5 commas = 20 bytes), yielding a maximum of ~95 bytes. This is far below the 4096-byte browser limit and also well below the 8192-byte typical server header limit. No size-related security concern exists.

**Multi-slug assessment: Fully correct. Encode/decode symmetry verified live. Gate logic exact.**

---

## Injection Resistance

### Vectors covered by the 10-test audit

| Vector | Mechanism | Result |
|---|---|---|
| Forged cookie (random value) | `includes()` exact match fails | PASS |
| Wrong-archetype slug | `includes()` exact match fails | PASS |
| Path traversal (`../../etc/passwd`) | Treated as unrecognized slug token; no filesystem interaction | PASS |
| Script tag injection | Never reflected in HTML; no XSS | PASS |
| Oversized cookie (2000 tokens, ~3KB) | Parsed without crash; server degrades gracefully | PASS |
| URL-encoded comma (multi-slug format) | `decodeURIComponent` applied before split | PASS |

### Vectors not directly covered by the 10-test audit

**Double-encoding attack:** An attacker could attempt `thf_sub=air-weaver%252Cshadow-dancer` (percent-encoded percent sign), hoping that a double decode results in a comma. The `[slug].astro` read path calls `decodeURIComponent(cookie.value)` exactly once. A single decode of `%252C` yields `%2C` (a literal percent-two-C string), not a comma. The `.split(',')` then treats this as a single segment `air-weaver%2Cshadow-dancer`, which is not in the valid slug set. No bypass.

**`decodeURIComponent` with malformed percent sequences:** The `parseCookieValue()` function wraps `decodeURIComponent` in a `try/catch` that falls back to the raw value on `URIError`. The `[slug].astro` read path calls `decodeURIComponent(cookie.value)` without a try/catch. A malformed percent sequence (e.g., `thf_sub=%GG`) would throw a `URIError` at runtime on the journey page. This would not crash the server (Astro's SSR error boundary would catch it and likely return a 500), but it would produce an unexpected error response rather than a gated page. An attacker exploiting this could cause a denial-of-service on the archetype page by setting a malformed cookie in a victim's browser — but only if they can set the victim's cookie, which requires XSS or subdomain compromise, not a trivially achievable attack. Severity: LOW.

**`set:html` bypass attempt:** The two `set:html` blocks in `[slug].astro` (lines 77 and 78) bypass Astro's automatic HTML escaping. However, neither block incorporates any user-controlled input: line 77 uses `JSON.stringify(faqSchema)` derived from CMS-sourced journey data, and line 78 uses a static object literal. No cookie values, URL parameters, or request headers reach these blocks. No injection surface.

**Cookie name smuggling:** If an attacker could set a cookie named `thf_sub ` (with a trailing space), browsers would not merge it with `thf_sub`. The `parseCookieValue()` function trims both the name and the search target (`cookieName !== name` where both are trimmed). This correctly rejects a space-padded name variant, so no collision is possible.

**`null` byte injection:** HTTP/1.1 headers reject null bytes at the protocol level. Node's HTTP parser would reject a Cookie header containing a null byte before it reaches application code. Not exploitable.

**Overall injection resistance: Strong. One low-severity issue (missing try/catch on `decodeURIComponent` in `[slug].astro`) identified. All other vectors tested or analytically closed.**

---

## Remediation Assessment

### Finding: `display:none` CSS gate converted to `{!isGated && (...)}`

The pre-fix implementation rendered the `#journey-content` div unconditionally and applied `style="display:none"` when `isGated = true`. This meant the full journey content (affiliated cards, recommended spreads, journaling prompts, blog links) was present in the raw HTML response body for every unauthenticated visitor.

The fix converted the div to an Astro conditional: `{!isGated && (...)}` at line 171, with the closing `)}` at line 269. Post-fix verification (`grep -c 'journey-content'` returns 1 on an unauthenticated request) confirms only the JSON-LD `cssSelector` reference remains — the content div and all its children are excluded from the response body.

**Completeness check — are there any remaining content leakage paths?**

1. The `journey-content` div wrapper and all child sections (affiliated cards, recommended spreads, journaling prompts, blog links) are all inside the single `{!isGated && (...)}` block (lines 171–269). There is no partial rendering of any subsection.

2. The email series signup form (lines 272–314) and the footer CTA (lines 317–336) are each in their own `{!isGated && (...)}` conditionals. These are not nested inside the journey-content block, so they could theoretically be missed in a refactor — but both are correctly gated by `!isGated` already.

3. The `#journey-hero` section (lines 102–143), which shows the archetype name, description, and image, is outside any gate and is intentionally always visible. This is by design — the hero section is the marketing hook, not the gated content.

4. The JSON-LD `cssSelector: "#journey-content"` reference in the `<head>` remains unconditionally. This is correct SEO signaling to Google that gated content exists; it does not expose the content itself.

5. The `#journey-quiz-cta` block (lines 146–168) is conditionally rendered with `{isGated && (...)}` — the inverse of the content gate. This is correct: quiz CTA visible when gated, hidden when not.

**Assessment: The remediation is complete. No content leakage paths remain. The fix follows the existing pattern used by the quiz CTA and email series sections, making it structurally consistent with the rest of the template.**

---

## API Testability Gap

### The gap

Both `quiz-submit.ts` and `journey-subscribe.ts` perform an early return at the `LOOPS_API_KEY` check (lines 318–325 and 184–191 respectively) before reaching the Set-Cookie code path. In dev mode without a Loops.so key, the cookie attributes on the API success path cannot be exercised via live curl.

### Risk assessment

The Set-Cookie string is a static string literal in both endpoints:
```
thf_sub=${encodeURIComponent(mergedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure
```

There is no conditional logic in this string — no `if (PROD)` guard, no flag that could be omitted at runtime. The `Secure` flag is unconditional (always present), which is correct because the API endpoints only execute on Vercel's HTTPS-enforced infrastructure. The only runtime-variable element is the cookie value itself (the `mergedSlugs` string), which is tested thoroughly by the Vitest unit test suite.

The unit tests mock `LOOPS_API_KEY` and the `fetch` call to Loops.so, reaching the Set-Cookie path. They assert all required attributes:
- `Path=/` present
- `Max-Age=15552000` present
- `SameSite=Lax` present
- `Secure` present
- `HttpOnly` absent

This means the attribute contract is covered by the test suite even though it cannot be covered by live curl in dev.

### Residual risk

The gap represents a staging/production smoke test deficit, not a code correctness deficit. If the Loops.so integration were ever refactored to move the `LOOPS_API_KEY` check after the Set-Cookie construction, the test would still pass but the live behavior would change. This is a structural coupling issue rather than a current security flaw. The mitigation is a pre-launch staging smoke test with a real or mock `LOOPS_API_KEY` present.

**Assessment: The gap is known, bounded, and mitigated by unit tests. No current security risk. A staging smoke test before launch is the appropriate remaining action.**

---

## Delta from Previous Eval

The previous security evaluation (`eval-close-side-door-security.md`) scored the implementation at **4.1/5.0** and identified:

| Finding | Previous Severity | Current Status |
|---|---|---|
| B5: `secure: PROD` conditional in `[slug].astro` | MEDIUM (parity gap) | UNCHANGED — assessed as intentional and correct |
| E5: In-memory rate limiter resets on cold start | MEDIUM (Loops.so abuse) | UNCHANGED — accepted pre-launch |
| D5: Client-side `setThfSubCookie()` missing Secure flag | LOW (hygiene) | UNCHANGED — production HTTPS-only via Vercel CDN |
| LOW-2: No comment on snake_case vs kebab-case asymmetry | LOW (maintainability) | UNCHANGED — not a security issue |

**New finding since previous eval:**

The previous eval was conducted against source code only. The E2E live audit (Phase 4A/4B) discovered and remediated a MEDIUM-severity finding that was not surfaced by static code review alone:

**Test 10 finding (REMEDIATED):** The `#journey-content` div used `style="display:none"` instead of conditional rendering. This was a genuine content exposure vulnerability — the gated journey content was present in every unauthenticated response body. The previous static eval did not catch this because the gate logic itself was correct; only live HTTP response inspection revealed that the CSS gate was client-side only.

This remediation is the primary delta between the two evaluations. It changes the security posture from "correctly gated in logic but leaking content in transport" to "correctly gated in logic and correctly excluded from transport."

**Score delta justification:** The previous 4.1 score reflected correct logic with an unverified transport layer. The post-remediation score of 4.4 reflects the same correct logic plus confirmed server-side content exclusion. The remaining 0.6 points withheld reflects: the API endpoint live testability gap (structural, not a bug), the `decodeURIComponent` missing try/catch on the journey page (low-severity), and the client-side cookie missing `Secure` flag (low-severity hygiene).

---

## Findings

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| S-01 | REMEDIATED | `#journey-content` rendered with `display:none` (CSS gate) when `isGated=true` — full journey content present in unauthenticated HTTP responses | Fixed: converted to `{!isGated && (...)}` Astro conditional rendering; post-fix verified by live curl (grep count = 1) |
| S-02 | LOW | `decodeURIComponent(cookie.value)` in `[slug].astro` line 36 has no try/catch. A malformed percent sequence in `thf_sub` (e.g., `%GG`) throws `URIError`, which Astro's SSR boundary will catch and return a 500 | Wrap in try/catch matching the pattern in `parseCookieValue()`. Fallback to `cookie.value` raw string. Low priority — requires attacker to control victim's cookie jar |
| S-03 | LOW | Client-side `setThfSubCookie()` in `quiz.astro` line 743 does not include `Secure` flag | Add `const secureFlag = location.protocol === 'https:' ? ';Secure' : '';` and append to the `document.cookie` string. Hygiene only; production site is HTTPS-enforced at CDN level |
| S-04 | LOW | API endpoint Set-Cookie path cannot be exercised by live curl in dev mode due to `LOOPS_API_KEY` early return | Run a pre-launch staging smoke test with a Loops.so test key or mock key returning `{"success":true}` |
| S-05 | INFO | In-memory WeakMap rate limiter resets on Vercel cold starts. Not a cookie security issue; Loops.so abuse risk mitigated by `Idempotency-Key` per-day deduplication | Accept pre-launch; add backlog item for Upstash Redis if high-traffic campaigns are planned |

---

## Score Justification

**4.4 / 5.0**

The implementation earns high marks because:

1. The fundamental gate mechanism is server-side and correct. Cookie values are never trusted directly — the server computes the archetype from quiz answers (quiz-submit) or validates against a closed set (journey-subscribe) before writing to the cookie. Forgery produces no privilege escalation.

2. The critical CSS gate finding (S-01) was discovered by the live audit and fully remediated. The fix is complete with no remaining leakage paths.

3. Encode/decode symmetry is maintained across all four cookie read/write sites. No encoding confusion attacks are possible.

4. Injection resistance is strong. The cookie value is used only in a string membership check and never reflected in HTML output. Astro's auto-escaping provides a structural backstop against any future accidental interpolation.

5. All three live-testable Set-Cookie scenarios (Test 4: renewal with matching cookie, Test 5: no renewal on gated visit, Test 6: no cookie on unauthenticated visit) passed.

Points withheld:

- **-0.3** for the API endpoint live testability gap. The cookie attributes are correct per code review and unit tests, but the absence of a live end-to-end confirmation is a real verification gap, not a theoretical one.
- **-0.2** for the two low-severity findings (S-02 missing try/catch, S-03 client-side Secure flag) that remain unresolved. Neither is a current exploit path, but both represent hygiene gaps against future changes.
- **-0.1** for the rate limiter cold-start issue (S-05), which is adjacent to the cookie system even though it is not a cookie security flaw.

The implementation is production-suitable at this score with the caveat that S-04 (staging smoke test) should be completed before the Kickstarter launch.
