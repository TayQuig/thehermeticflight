# Cookie Injection + Gate Bypass Audit

**Date:** 2026-03-19
**Phase:** 4B — E2E Verification
**Target:** `http://localhost:4321/archetype/air-weaver`
**Gate mechanism:** `thf_sub` cookie, SSR via `src/pages/archetype/[slug].astro`

---

## Test Results

### Test 1 — Gate bypass with forged cookie (random value)

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=INJECTED' | grep -c 'journey-quiz-cta'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 1 |
| Result | **PASS** |

The value `INJECTED` is not in the server's slug list for `air-weaver`, so `isGated = true` and the quiz CTA block is rendered. The forged cookie grants no access.

---

### Test 2 — Gate bypass with wrong archetype cookie

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=shadow-dancer' | grep -c 'journey-quiz-cta'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 1 |
| Result | **PASS** |

A valid archetype slug for a *different* archetype does not unlock the `air-weaver` journey. Server correctly evaluates `slugList.includes('air-weaver')` as false.

---

### Test 3 — Correct single-slug access

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=air-weaver' | grep -c 'journey-content'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 2 |
| Result | **PASS** |

Cookie value exactly matches the page's `urlSlug`. `isGated = false`. The `journey-content` div is rendered without `display:none` (count of 2 reflects the div ID appearing in the Schema.org `cssSelector` field in the JSON-LD head block as well as the rendered div).

---

### Test 4 — Correct multi-slug access

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=shadow-dancer%2Cair-weaver' | grep -c 'journey-content'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 2 |
| Result | **PASS** |

URL-encoded comma separator is correctly parsed. `decodeURIComponent` + `.split(',')` extracts `['shadow-dancer', 'air-weaver']`; `includes('air-weaver')` is true.

---

### Test 5 — Multi-slug without target archetype

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=shadow-dancer%2Cearth-invoker' | grep -c 'journey-quiz-cta'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 1 |
| Result | **PASS** |

Two valid slugs present, neither is `air-weaver`. Gate holds correctly.

---

### Test 6 — Cookie injection: path traversal in value

#### 6a — Content accessible (air-weaver still matches)

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=air-weaver%2C../../etc/passwd' | grep -c 'journey-content'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 2 |
| Result | **PASS** |

#### 6b — HTTP status (no server crash)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=air-weaver%2C../../etc/passwd'
```

| | |
|---|---|
| Expected | 200 |
| Actual | 200 |
| Result | **PASS** |

The path traversal string `../../etc/passwd` is simply treated as an unrecognized slug token. The server never resolves it as a filesystem path — it is only compared via `slugList.includes(urlSlug)`. The valid `air-weaver` token in the same cookie still grants access. No crash, no 5xx.

---

### Test 7 — Cookie injection: script tag in value

#### 7a — HTTP status (no server crash)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=%3Cscript%3Ealert(1)%3C/script%3E'
```

| | |
|---|---|
| Expected | 200 |
| Actual | 200 |
| Result | **PASS** |

#### 7b — XSS reflection check

```bash
curl -s http://localhost:4321/archetype/air-weaver \
  -H 'Cookie: thf_sub=%3Cscript%3Ealert(1)%3C/script%3E' | grep -c '<script>alert(1)</script>'
```

| | |
|---|---|
| Expected | 0 |
| Actual | 0 |
| Result | **PASS** |

The cookie value is never reflected back into the HTML response. Astro only uses the cookie value for the server-side boolean `isGated` — it is never interpolated into template output. Even if it were, Astro's JSX-style template escaping would prevent raw HTML injection.

---

### Test 8 — Cookie injection: very long value

```bash
LONG_VALUE=$(python3 -c "print('a-b,' * 500 + 'air-weaver')")
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/archetype/air-weaver \
  -H "Cookie: thf_sub=$LONG_VALUE"
```

| | |
|---|---|
| Expected | 200 |
| Actual | 200 |
| Result | **PASS** |

A 2000-token slug list (~3KB cookie value) does not crash the server. Node's HTTP parser accepts it, and `decodeURIComponent().split(',').filter(Boolean)` handles it without error. Note: browser cookie size limits (~4KB) would prevent this value from being set in practice, making this attack vector inaccessible from the browser. The server-side handler degrades gracefully regardless.

---

### Test 9 — SEO structured data presence

```bash
curl -s http://localhost:4321/archetype/air-weaver | grep -c 'isAccessibleForFree'
```

| | |
|---|---|
| Expected | count >= 1 |
| Actual | 1 |
| Result | **PASS** |

The `WebPage` JSON-LD schema with `isAccessibleForFree: false` and `cssSelector: "#journey-content"` is present in the `<head>` of every response, regardless of gate state. This correctly signals to Google that the content is metered/gated.

---

### Test 10 — Gated page does NOT contain journey content

```bash
curl -s http://localhost:4321/archetype/air-weaver | grep -c 'journey-content'
```

| | |
|---|---|
| Expected | 0 |
| Actual (pre-fix) | 2 |
| Actual (post-fix) | 1 (JSON-LD schema reference only — no content div) |
| Result | **PASS (after remediation)** |

**This test revealed a structural security finding.** The `#journey-content` div used `style="display:none"` instead of conditional rendering. Remediated by converting to `{!isGated && (...)}` Astro conditional. Post-fix, the only match is the JSON-LD `cssSelector` reference. See Security Assessment below.

---

## Summary

**10/10 tests passed (after remediation of Test 10 finding).**

Test 10 originally failed — the `#journey-content` div was rendered with `display:none` instead of being excluded from the HTML. Fixed by converting to Astro conditional rendering (`{!isGated && (...)}`). All 639 unit tests and 12/12 quiz-gate E2E tests pass after the fix. FTF verification confirms no frozen test files were modified.

---

## Security Assessment

### Finding: Client-Side CSS Gate — REMEDIATED (Severity: Medium → Resolved)

**What the test revealed:** The `#journey-content` div was rendered in the server response HTML even when `isGated = true`, hidden only via `style="display:none"`. Anyone viewing source or using curl could read the gated content.

**Root cause:** `src/pages/archetype/[slug].astro` line 171 used CSS hiding instead of conditional rendering:
```astro
<!-- BEFORE (vulnerable) -->
<div id="journey-content" style={isGated ? 'display:none' : ''}>
```

**Fix applied:** Converted to Astro conditional rendering, matching the pattern already used by the quiz CTA block and email series section:
```astro
<!-- AFTER (server-gated) -->
{!isGated && (
<div id="journey-content">
```

**Verification:** Post-fix, `curl -s http://localhost:4321/archetype/air-weaver | grep -c 'journey-content'` returns 1 (JSON-LD schema reference only). The actual content div and all its children are excluded from the response body. 639/639 unit tests pass, 12/12 quiz-gate E2E tests pass, FTF verification passes.

**Note:** The JSON-LD schema `cssSelector: "#journey-content"` reference remains in the `<head>` for SEO signaling. This is correct — it tells Google the content exists but is gated, which is now truly enforced at the server response boundary.

### Injection Vectors Confirmed Not Exploitable

| Vector | Result |
|---|---|
| Arbitrary string in cookie value | Treated as non-matching slug token only — never executed, never reflected |
| Path traversal (`../../etc/passwd`) | Slug string comparison only — no filesystem interaction |
| Script tag injection | Cookie value not reflected in HTML; no XSS vector |
| Oversized cookie value | Parsed successfully; no buffer overflow or crash |
| Wrong-archetype slug | Slug comparison is exact — no partial match, no prefix attack |
| URL-encoded comma as multi-slug separator | `decodeURIComponent` applied before split — encoding tricks do not create false matches |

### Defense Layer: Astro Automatic HTML Escaping

Astro's template engine (JSX-style `{}` interpolation) HTML-escapes all dynamic values by default. Even if a future change were to interpolate the cookie value directly into the template output, characters such as `<`, `>`, `"`, and `&` would be entity-encoded before being written to the response body. This provides a structural defense against reflected XSS that does not depend on developer discipline at each call site.

The `set:html` directive (used for the JSON-LD blocks on lines 77–87) bypasses this escaping, but those blocks use only server-controlled data (`JSON.stringify()` of structured objects) — no user input reaches them.

### Vectors Not Covered by This Audit

- **Cookie stuffing via subdomain:** If a subdomain could set cookies on the apex domain, an attacker could poison `thf_sub` for a victim. Not testable against localhost; assess at production deploy with `Domain=` attribute absent (current implementation does not set `Domain=`, which is correct — cookies scoped to the exact domain only).
- **Race condition on cookie renewal:** The renewal path (lines 42–49) reads then sets the cookie in the same request. Under extremely high concurrency this is benign (worst case: two renewals for the same visitor), but worth noting.
- **API endpoint (`/api/journey-subscribe`) gate bypass:** Out of scope for this audit (Phase 5). The journey-subscribe endpoint is what *sets* the cookie; its own validation (email format, honeypot, timing) was not exercised here.
