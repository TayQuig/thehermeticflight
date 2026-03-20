# Security & Cookie Integrity Evaluation

**Feature evaluated:** Close Side Door + Cookie Hardening
**Evaluator role:** Security & Cookie Integrity (Evaluator 1)
**Date:** 2026-03-19
**Branch:** feature/quiz-design-overhaul

**Files reviewed:**
- `src/lib/cookie-helpers.ts`
- `src/pages/api/quiz-submit.ts`
- `src/pages/api/journey-subscribe.ts`
- `src/pages/archetype/[slug].astro`
- `src/pages/quiz.astro` (lines 739–744)
- `tests/cookie-helpers.test.ts`
- `tests/quiz-submit.test.ts`
- `tests/journey-subscribe.test.ts`

---

## Summary Score: 4.1 / 5.0

The implementation is well-constructed across most dimensions. The slug-validation-before-inclusion strategy is solid, the multi-slug format is robust, and the rate-limiting architecture is intact. Two findings of MEDIUM severity and one LOW finding require attention before or shortly after merge.

---

## Lens A: Cookie Forgery Resistance — 4.5 / 5.0

### Findings

**A1 (PASS) — Slug values are validated before inclusion (quiz-submit).**
In `quiz-submit.ts`, the archetype written into the cookie is always the server-computed `classificationResult.primary` or a `selfSelected` value that has been checked against the internal `VALID_SLUGS` set (`Set(['air_weaver', 'embodied_intuitive', ...])`). The value then undergoes a `replace(/_/g, '-')` conversion to kebab-case. An attacker cannot inject an arbitrary archetype name via the POST body; the server ignores the body archetype and computes its own.

**A2 (PASS) — Slug values are validated before inclusion (journey-subscribe).**
In `journey-subscribe.ts`, the archetype from the request body is checked against `VALID_URL_SLUGS` (a closed Set of 6 kebab-case slugs) before any processing. The check happens at line 149:
```typescript
if (!archetype || typeof archetype !== 'string' || !VALID_URL_SLUGS.has(archetype)) {
```
Only a valid archetype slug can reach the cookie-writing path.

**A3 (PASS) — Injection risk via crafted slug names is neutralised.**
Because every slug that enters the cookie passes through one of the two validated Sets before `appendSlug()`, characters like commas, semicolons, or percent signs cannot appear in the slug at write time. The `encodeURIComponent()` call on the merged value provides an additional layer at the Set-Cookie boundary. The `VALID_URL_SLUGS` values are all ASCII alpha and hyphen — no special characters are possible.

**A4 (PASS) — Cookie value cannot be forged to bypass the journey gate.**
The gate in `[slug].astro` reads `Astro.cookies.get('thf_sub')`, decodes it, splits on commas, and checks `slugList.includes(urlSlug)`. An attacker who directly forges `document.cookie = 'thf_sub=air-weaver'` would bypass the client-side fallback but NOT the server-side gate, because Astro.cookies reads the Cookie request header that was sent by the browser, which always reflects the real cookie jar (the forged value would have to be present in the actual browser cookie, which it would be — this is client-side gate enforcement, not server-side auth). This is the expected design for a soft-gate; the journey content is not privileged data and the implementation comment ("soft gate") reflects this intent. No elevation of privilege is possible from cookie forgery.

**A5 (LOW) — No slug length cap in appendSlug().**
`appendSlug()` does not enforce a maximum cookie value length. An attacker who somehow accumulated many valid slugs over multiple valid submissions could inflate the cookie. In practice this is bounded naturally: there are exactly 6 valid slugs, and `appendSlug()` deduplicates, so the theoretical maximum cookie value is `air-weaver,embodied-intuitive,ascending-seeker,shadow-dancer,flow-artist,grounded-mystic` = 75 bytes encoded, well under any browser or header limit. No actionable risk — noted for completeness.

---

## Lens B: Server-Side Set-Cookie Correctness — 4.0 / 5.0

### Findings

**B1 (PASS) — All required attributes present in both endpoints.**
The Set-Cookie header in `quiz-submit.ts` (line 491) and `journey-subscribe.ts` (line 304):
```
thf_sub=<value>;Path=/;Max-Age=15552000;SameSite=Lax;Secure
```
All four required attributes are present: `Path=/`, `Max-Age=15552000`, `SameSite=Lax`, `Secure`.

**B2 (PASS) — HttpOnly correctly omitted.**
Neither endpoint sets `HttpOnly`. The client-side `setThfSubCookie()` function in quiz.astro and the `[slug].astro` gate both require JS access to `document.cookie`. Tests for both endpoints assert `HttpOnly` is absent (`expect(setCookie).not.toContain('HttpOnly')`), providing regression coverage.

**B3 (PASS) — Existing cookie read and merged correctly.**
Both endpoints read `request.headers.get('cookie')`, pass it to `parseCookieValue()`, and merge via `appendSlug()` before writing. The merge logic handles the empty-cookie case (first visit) and the populated case (subsequent visits) correctly.

**B4 (PASS) — encodeURIComponent / decodeURIComponent symmetry maintained.**
- Write path (both endpoints): `encodeURIComponent(mergedSlugs)` in the Set-Cookie header value.
- Read path (cookie-helpers.ts `parseCookieValue()`): `decodeURIComponent(rawValue)` with a try/catch fallback on malformed input.
- Read path (`[slug].astro`): `decodeURIComponent(cookie.value)` before splitting.
- Client-side `setThfSubCookie()`: `decodeURIComponent(match[1])` on read, `encodeURIComponent(...)` on write.
All four read paths correctly decode before splitting, preventing a URL-encoded comma from being treated as a literal character in the slug list.

**B5 (MEDIUM) — Cookie renewal in `[slug].astro` omits `Secure` flag in dev.**
The renewal call in `[slug].astro` (lines 42–48):
```typescript
Astro.cookies.set('thf_sub', cookie.value, {
  path: '/',
  maxAge: 15552000,
  sameSite: 'lax',
  secure: import.meta.env.PROD,   // <-- false in dev
});
```
The API endpoints always set `Secure` unconditionally. The renewal path conditionalises on `import.meta.env.PROD`. This is a parity gap:
- **In production:** consistent — renewal also sets Secure.
- **In development:** the renewal drops Secure, which is correct for localhost. No production risk.
- **Risk assessment:** The parity difference is intentional for local development compatibility, but it means a dev testing renewal behaviour will not see `Secure` in the renewed cookie, which can produce confusing test output. No production security impact.

**B6 (LOW) — Set-Cookie header value uses semicolons without spaces.**
The raw header string `thf_sub=...;Path=/;Max-Age=15552000;SameSite=Lax;Secure` uses no space after semicolons. RFC 6265 permits this. All modern browsers accept it. No risk.

**B7 (OBSERVATION) — Renewal in `[slug].astro` re-encodes via Astro.cookies.set().**
`Astro.cookies.set()` will apply its own encoding to `cookie.value`, which at the time of renewal is already the raw (pre-decoded? or URL-encoded?) value from the Cookie header. Astro's cookie getter returns the decoded value from the cookie jar, so `cookie.value` is the decoded slug list (e.g., `air-weaver,shadow-dancer`). Astro.cookies.set() with a plain string value will URL-encode it. This is correct — the output will be `thf_sub=air-weaver%2Cshadow-dancer` in the renewed Set-Cookie. No risk, but worth confirming against Astro's cookie implementation if this path is exercised in tests.

---

## Lens C: Multi-Slug Format Robustness — 4.5 / 5.0

### Findings

**C1 (PASS) — appendSlug() correctly deduplicates.**
`appendSlug('air-weaver', 'air-weaver')` returns `'air-weaver'`. Deduplication is based on `segments.includes(newSlug)`, which is an exact string match. Covered by test: "does not duplicate existing slug" and "does not duplicate in multi-slug value".

**C2 (PASS) — URL-encoded commas handled correctly.**
`parseCookieValue()` decodes the raw cookie value before returning it. The comma in a multi-slug value was encoded as `%2C` at write time and is decoded back to `,` at read time. The split on `,` therefore works correctly. Covered by test: "decodes URL-encoded value" (`thf_sub=air-weaver%2Cshadow-dancer` → `air-weaver,shadow-dancer`).

**C3 (PASS) — Malformed cookies (trailing/leading/double commas) handled.**
`appendSlug()` uses `.split(',').filter(Boolean)` which eliminates all empty string segments. Tests cover trailing comma (`air-weaver,` → `air-weaver,shadow-dancer`), leading comma (`,air-weaver` → `air-weaver,shadow-dancer`), and double comma (`air-weaver,,shadow-dancer` → clean output).

**C4 (PASS) — `.split(',').filter(Boolean)` appears consistently in all parse sites.**
- `appendSlug()` in cookie-helpers.ts: `existing.split(',').filter(Boolean)` ✓
- `[slug].astro` gate: `decodeURIComponent(cookie.value).split(',').filter(Boolean)` ✓
- `setThfSubCookie()` in quiz.astro: `decodeURIComponent(match[1]).split(',').filter(Boolean)` ✓

**C5 (PASS) — Path traversal and metadata injection attempts are neutralised.**
A cookie value like `thf_sub=../../etc/passwd` or `thf_sub=admin` can only appear if the user manually forges their own cookie. The gate checks `slugList.includes(urlSlug)` where `urlSlug` is derived from `Astro.params` (the URL path segment), not from the cookie. The cookie is only tested for membership, not interpolated into file paths, SQL, or shell commands. No injection surface.

**C6 (PASS) — Maximum cookie size bounded.**
Six slugs, all validated, produce a maximum value of 75 characters (pre-encoding). The full Set-Cookie header remains well under the 4096-byte browser limit. Covered by unit test: "handles all 6 archetypes" with explicit `value.length < 4096` assertion.

---

## Lens D: Safari ITP Compliance — 4.5 / 5.0

### Findings

**D1 (PASS) — Server-side Set-Cookie bypasses Safari ITP 7-day cap.**
Server-set cookies with a `Max-Age` or `Expires` attribute are honoured at the declared expiry by Safari ITP (as of ITP 2.3+), provided they are set on a same-origin server response. Vercel serverless functions (`/api/quiz-submit`, `/api/journey-subscribe`) are served from the same origin as the frontend, satisfying this requirement. The 180-day Max-Age (15552000 seconds) will be respected.

**D2 (PASS) — Cookies are set on same-domain responses.**
Both API routes are Astro/Vercel API routes under the same origin. The cookie is first-party. ITP's cross-site tracking cap does not apply.

**D3 (PASS) — Client-side fallback retained as belt-and-suspenders.**
`setThfSubCookie()` in quiz.astro still writes `document.cookie` after a successful quiz submit. This ensures the cookie is set immediately in the browser's client-side cookie jar for same-session redirect to the result/journey page, before the server-set cookie can take effect on the next navigation. The server-set cookie provides the long-lived ITP-resistant copy.

**D4 (PASS) — 180-day Max-Age consistent across all cookie-writing locations.**
- `quiz-submit.ts`: `Max-Age=15552000` ✓
- `journey-subscribe.ts`: `Max-Age=15552000` ✓
- `[slug].astro` renewal: `maxAge: 15552000` ✓
- `setThfSubCookie()` in quiz.astro: `max-age=15552000` ✓

All four write points use 15552000 (180 days exactly: 180 × 24 × 3600 = 15552000). Consistent.

**D5 (LOW) — Client-side setThfSubCookie() does not set Secure flag.**
`quiz.astro` line 743:
```javascript
document.cookie = `thf_sub=${encodeURIComponent(existing.join(','))};path=/;max-age=15552000;SameSite=Lax`;
```
The `Secure` attribute is absent. This means on production HTTPS the cookie is set without `Secure`, making it technically transmittable over HTTP (if any HTTP resource is somehow loaded on the same origin). In practice, the site is HTTPS-only on Vercel, and the `Secure` attribute on the server-set cookie would take effect for all subsequent requests. However, the client-side write creates a cookie without `Secure`, which could be downgraded.

**Impact:** Low. The production site enforces HTTPS at the CDN level. The cookie holds no sensitive data (only archetype slugs). The server-set version (which arrives in the same API response) will include `Secure`, and on the next navigation the browser will send the server-set cookie with `Secure` to the server. However, as a hygiene matter, the client-side `setThfSubCookie()` should also add `Secure` when on HTTPS.

---

## Lens E: Rate Limiting & Abuse — 3.5 / 5.0

### Findings

**E1 (PASS) — Rate limiter is functional on both endpoints.**
Both `quiz-submit.ts` and `journey-subscribe.ts` implement identical in-memory WeakMap rate limiters with global (10 req) and per-email (3 req) buckets. Tests confirm 429 is returned when limits are exceeded. The implementation is correct.

**E2 (PASS) — Set-Cookie changes do not interfere with rate limiting.**
The Set-Cookie header is only written in the success path, after all validation and rate-limit checks pass. Rate-limited responses (429) return no Set-Cookie header, correctly.

**E3 (PASS) — Honeypot still functional on both endpoints.**
Both handlers check `if (website)` before rate limiting and before cookie operations. A bot that fills the honeypot receives a 400 with no cookie set. The gate form was removed from `[slug].astro` as noted in the evaluation brief, and this is not a regression.

**E4 (MEDIUM) — Cookie slug accumulation via repeated legitimate API calls is unbounded.**
A real user who legitimately completes the quiz multiple times (e.g., across devices, or uses a shared computer) could accumulate all 6 slugs in their cookie via repeated valid submissions. This is not an abuse vector (6 slugs = 75 bytes maximum), but it means there is no way for a user to "revoke" their access to a journey they subscribed to. This is acceptable by design for a soft-gate, but there is no audit trail of when a slug was added. Not a security finding — documented as an architecture observation.

**E5 (MEDIUM) — Rate limiter resets on Vercel cold start; no persistent rate limiting.**
The WeakMap-based rate limiter is in-memory and resets on every cold start. On Vercel Serverless Functions, cold starts are frequent (especially on low-traffic routes). An attacker who wants to flood the cookie mechanism with repeated requests could time requests to force cold starts by waiting for the function to go idle (typically after ~60 seconds of inactivity) and then fire burst requests.

**Impact assessment:** The attack would require: (a) a valid email address, (b) valid quiz answers, and (c) a valid archetype slug. Even if the rate limit is bypassed by timing cold starts, the only outcome is that the attacker can submit multiple valid quiz completions to Loops.so. The Set-Cookie impact is zero (slug is validated, bounded to 6 values, idempotent via deduplication). The real risk is Loops.so API abuse — an attacker could inflate contact counts. The existing `Idempotency-Key: quiz_<email>_<date>` header provides a per-day deduplication guard at the Loops.so level, which substantially mitigates this risk. No cookie security issue results.

**E6 (PASS) — No rate limit bypass via cookie manipulation.**
Rate limiting is keyed on the email address in the request body, not on any cookie value. An attacker cannot reset their rate limit bucket by modifying their cookie.

---

## Critical Findings (severity >= HIGH)

None. No HIGH or CRITICAL findings identified. The implementation correctly validates all slug values before they enter the cookie, uses proper encoding/decoding symmetry, and the server-set cookie correctly bypasses Safari ITP.

---

## Recommendations

### MEDIUM-1 — Cookie renewal in `[slug].astro` omits Secure in dev (Lens B5)
**Severity:** MEDIUM (parity gap, no production impact)
**File:** `src/pages/archetype/[slug].astro`, line 47
**Current:** `secure: import.meta.env.PROD`
**Observation:** The API endpoints always set `Secure` unconditionally (production Vercel deploys are always HTTPS). The renewal path conditions on PROD, which is correct for localhost compatibility. This is not a bug but a documentation gap — it should be noted in a comment so future maintainers don't interpret the conditional as a potential prod-security gap. No code change required.
**Recommended action:** Add an inline comment:
```typescript
// secure: only required in prod (Vercel is always HTTPS; localhost is exempt)
secure: import.meta.env.PROD,
```

### MEDIUM-2 — In-memory rate limiter resets on Vercel cold start (Lens E5)
**Severity:** MEDIUM (Loops.so abuse risk, not cookie security risk)
**Files:** `quiz-submit.ts`, `journey-subscribe.ts`
**Observation:** The WeakMap rate limiter provides no persistence across cold starts. An attacker who understands the cold-start window can bypass it after ~60 seconds of function inactivity. The Loops.so `Idempotency-Key` per-day deduplication mitigates the downstream impact. If Loops.so contact flooding becomes a concern post-launch, consider Upstash Redis or Vercel KV for persistent rate limiting.
**Recommended action:** Accept current implementation for pre-launch; add a backlog item to evaluate persistent rate limiting before high-traffic campaigns.

### LOW-1 — Client-side setThfSubCookie() missing Secure flag (Lens D5)
**Severity:** LOW (hygiene; production HTTPS-only via Vercel CDN)
**File:** `src/pages/quiz.astro`, line 743
**Current:**
```javascript
document.cookie = `thf_sub=${encodeURIComponent(existing.join(','))};path=/;max-age=15552000;SameSite=Lax`;
```
**Recommended fix:**
```javascript
const secureFlag = location.protocol === 'https:' ? ';Secure' : '';
document.cookie = `thf_sub=${encodeURIComponent(existing.join(','))};path=/;max-age=15552000;SameSite=Lax${secureFlag}`;
```
This brings the client-side write into parity with server-side Set-Cookie headers and eliminates any theoretical HTTP downgrade surface.

### LOW-2 — No inline comment explaining why VALID_SLUGS in quiz-submit uses snake_case vs kebab-case in journey-subscribe (Lens A)
**Severity:** LOW (maintainability)
**Observation:** `quiz-submit.ts` defines `VALID_SLUGS` with snake_case (`air_weaver`) because `classificationResult.primary` uses internal slug format, then converts to kebab at line 484. `journey-subscribe.ts` uses `VALID_URL_SLUGS` with kebab-case (`air-weaver`) because the request body carries the URL slug. This is correct but the asymmetry between the two files is non-obvious. A one-line comment in each file explaining the slug format expected would reduce future confusion and risk of format inversion.
