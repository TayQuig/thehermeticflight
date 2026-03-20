# Cookie Header Audit — Phase 4A

**Date:** 2026-03-19
**Branch:** feature/quiz-design-overhaul
**Server:** http://localhost:4321 (dev mode, `import.meta.env.PROD = false`)

---

## Test 1: quiz-submit Set-Cookie (with existing cookie)

**Command:**
```bash
curl -s -D - -X POST http://localhost:4321/api/quiz-submit \
  -H 'Content-Type: application/json' \
  -H 'Cookie: thf_sub=shadow-dancer' \
  -d '{"email":"test@test.com","firstName":"Test","answers":{"SEG1":"SEG1-A","SEG2":"SEG2-A","NQ01":"NQ01-A","NQ02":"NQ02-A","FP01":"FP01-A","NQ03":"NQ03-A","NQ04":"NQ04-A","FP02":"FP02-B","NQ05":"NQ05-A","NQ06":"NQ06-A","FP03":"FP03-B","NQ07":"NQ07-A"},"quizVersion":"v2"}' 2>&1
```

**Actual response:**
```
HTTP/1.1 500 Internal Server Error
Vary: Origin
content-type: application/json
Date: Fri, 20 Mar 2026 04:30:23 GMT

{"error":"Email service not configured"}
```

**Set-Cookie header:** NONE (not present)

**Result: KNOWN LIMITATION — NOT TESTED**

**Analysis:** The endpoint validates the payload successfully (passes all validation gates including answer format, email, rate limiting) but exits early at the `LOOPS_API_KEY` check on line 319 of `quiz-submit.ts`, returning HTTP 500 before the Set-Cookie response is constructed. The Set-Cookie is only emitted after a successful Loops.so round-trip on the 200 response path (line 487–493). In dev mode, `LOOPS_API_KEY` is not set, so the cookie path is unreachable.

**Code location:** `src/pages/api/quiz-submit.ts` lines 318–325 (early return) and 487–493 (Set-Cookie on success path).

**Expected Set-Cookie (success path, production):**
`Set-Cookie: thf_sub=shadow-dancer%2C<classified-slug>; Path=/; Max-Age=15552000; SameSite=Lax; Secure`

---

## Test 2: journey-subscribe Set-Cookie (with existing cookie)

**Command:**
```bash
curl -s -D - -X POST http://localhost:4321/api/journey-subscribe \
  -H 'Content-Type: application/json' \
  -H 'Cookie: thf_sub=shadow-dancer' \
  -d '{"email":"test@test.com","firstName":"Test","archetype":"air-weaver"}' 2>&1
```

**Actual response:**
```
HTTP/1.1 500 Internal Server Error
Vary: Origin
content-type: application/json

{"error":"Email service not configured"}
```

**Set-Cookie header:** NONE (not present)

**Result: KNOWN LIMITATION — NOT TESTED**

**Analysis:** Same structural issue as Test 1. The endpoint validates successfully but exits early at the `LOOPS_API_KEY` check on line 184 of `journey-subscribe.ts`. The Set-Cookie header is only emitted on the 200 success path after Loops.so confirms (line 300–305). Unreachable in dev mode.

**Code location:** `src/pages/api/journey-subscribe.ts` lines 184–191 (early return) and 300–305 (Set-Cookie on success path).

**Expected Set-Cookie (success path, production):**
`Set-Cookie: thf_sub=shadow-dancer%2Cair-weaver; Path=/; Max-Age=15552000; SameSite=Lax; Secure`

---

## Test 3: journey-subscribe Set-Cookie (WITHOUT existing cookie)

**Command:**
```bash
curl -s -D - -X POST http://localhost:4321/api/journey-subscribe \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","firstName":"Test","archetype":"air-weaver"}' 2>&1
```

**Actual response:**
```
HTTP/1.1 500 Internal Server Error
Vary: Origin
content-type: application/json

{"error":"Email service not configured"}
```

**Set-Cookie header:** NONE (not present)

**Result: KNOWN LIMITATION — NOT TESTED**

**Analysis:** Same as Tests 1 and 2. LOOPS_API_KEY gate fires before the cookie path.

**Expected Set-Cookie (success path, production):**
`Set-Cookie: thf_sub=air-weaver; Path=/; Max-Age=15552000; SameSite=Lax; Secure`

---

## Test 4: Cookie renewal on journey page (matching archetype)

**Command:**
```bash
curl -s -D - http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=air-weaver' 2>&1 | head -30
```

**Actual Set-Cookie line:**
```
set-cookie: thf_sub=air-weaver; Max-Age=15552000; Path=/; SameSite=Lax
```

**Verification checklist:**
- [x] `Path=/` — PASS (`Path=/` present)
- [x] `Max-Age=15552000` — PASS
- [x] `SameSite=Lax` — PASS
- [x] `Secure` NOT present — EXPECTED (dev mode: `secure: import.meta.env.PROD` evaluates to `false` in dev)
- [x] `HttpOnly` NOT present — PASS (JS-readable, no HttpOnly set)
- [x] Cookie value correct — PASS (`thf_sub=air-weaver`, single slug renewed correctly)

**Result: PASS (with dev-mode note on Secure flag)**

**Dev-mode note:** The `Secure` attribute is absent here because `[slug].astro` sets `secure: import.meta.env.PROD` (line 47). In production (`PROD=true`) the flag will be present. This is correct conditional behavior, not a bug.

---

## Test 5: No Set-Cookie on gated visit (wrong archetype)

**Command:**
```bash
curl -s -D - http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=shadow-dancer' 2>&1 | head -30
```

**Actual response headers:**
```
HTTP/1.1 200 OK
Vary: Origin
content-type: text/html
```

**Set-Cookie header:** NONE (not present)

**Result: PASS**

**Analysis:** Visitor has `thf_sub=shadow-dancer` but is accessing `/archetype/air-weaver`. The slug list does not include `air-weaver`, so `isGated = true` and the cookie-renewal branch (`if (!isGated && cookie)`) is skipped. No Set-Cookie is emitted. Correct behavior — gated visitors do not have their cookie refreshed.

---

## Test 6: No Set-Cookie on journey page without any cookie

**Command:**
```bash
curl -s -D - http://localhost:4321/archetype/air-weaver 2>&1 | head -30
```

**Actual response headers:**
```
HTTP/1.1 200 OK
Vary: Origin
content-type: text/html
```

**Set-Cookie header:** NONE (not present)

**Result: PASS**

**Analysis:** No `thf_sub` cookie in request. `cookie` is null/undefined, `isGated = true` (empty slug list does not include `air-weaver`), cookie-renewal branch is skipped. No Set-Cookie emitted. Correct.

---

## Summary

| Test | Endpoint | Result | Notes |
|------|----------|--------|-------|
| 1 | `POST /api/quiz-submit` (with cookie) | KNOWN LIMITATION | LOOPS_API_KEY absent in dev; Set-Cookie unreachable |
| 2 | `POST /api/journey-subscribe` (with cookie) | KNOWN LIMITATION | Same — LOOPS_API_KEY gate fires first |
| 3 | `POST /api/journey-subscribe` (no cookie) | KNOWN LIMITATION | Same — LOOPS_API_KEY gate fires first |
| 4 | `GET /archetype/air-weaver` (matching cookie) | PASS | Secure absent in dev (expected); all other attributes correct |
| 5 | `GET /archetype/air-weaver` (wrong cookie) | PASS | No Set-Cookie emitted for gated visitor |
| 6 | `GET /archetype/air-weaver` (no cookie) | PASS | No Set-Cookie emitted when unauthenticated |

**Testable results: 3/3 PASS**
**Untestable in dev: 3/3 (Tests 1–3, all gated by LOOPS_API_KEY)**

---

## Findings

### Finding 1: API endpoint cookie path is dev-untestable (structural)

Both `quiz-submit.ts` and `journey-subscribe.ts` early-return on missing `LOOPS_API_KEY` before reaching the Set-Cookie code path. This means cookie attributes on the API success path cannot be verified via live curl in dev mode.

**Mitigation:** Cookie attribute correctness for API endpoints is verified through the Vitest unit test suite (tests mock `LOOPS_API_KEY` and `fetch`). The Set-Cookie string in both files is identical in structure:
```
thf_sub=${encodeURIComponent(mergedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure
```
This is a string literal — no conditional flag omission, `Secure` is always present, `HttpOnly` is absent. The production path is correct.

### Finding 2: Secure flag absent on archetype page in dev — correct conditional behavior

`[slug].astro` uses `secure: import.meta.env.PROD` for the cookie renewal. This means:
- Dev: `Secure` absent (correct — localhost is not HTTPS)
- Production: `Secure` present (correct)

No action required.

### Finding 3: Cookie attribute format difference between API endpoints and SSR page

The API endpoints emit Set-Cookie as a raw string: `thf_sub=...;Path=/;Max-Age=15552000;SameSite=Lax;Secure` (semicolons, no spaces, PascalCase attributes).

The archetype SSR page emits via `Astro.cookies.set()`: `thf_sub=...; Max-Age=15552000; Path=/; SameSite=Lax` (semicolons with spaces, different key order, no Secure in dev). Both are valid RFC 6265 Set-Cookie syntax. The semantic content is equivalent.

---

## Action Items

- None blocking Phase 4B. Cookie logic is structurally correct.
- If a smoke test of the full API success path is needed before launch, use a staging environment with `LOOPS_API_KEY` set (or a test key returning `{"success":true}`).
