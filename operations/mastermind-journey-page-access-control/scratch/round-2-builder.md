# Round 2 — Builder: Revised Implementation Plan

## Summary of Round 1 Feedback

The Devil's Advocate raised two legitimate blocking issues:

- **R-01 (Safari ITP):** Client-side `document.cookie` is capped to 7 days on
  all WebKit browsers. With a 4.5-month pre-launch window, Safari/iOS users lose
  journey access after one week. Fix: set the cookie server-side via `Set-Cookie`
  header.
- **R-03 (Multi-slug overwrite):** Single-value `thf_sub` cookie means retaking
  the quiz overwrites the previous slug, locking users out of their earlier
  journey. Fix: comma-separated multi-slug cookie.

Both are accepted. This plan integrates them into the build order.

---

## 1. Server-Side Cookie Setting — Exact Code Path

### Current state (3 call sites, all client-side)

| Location | Line | Trigger |
|----------|------|---------|
| `quiz.astro` | 739-741 | `setThfSubCookie()` helper sets `document.cookie` |
| `quiz.astro` | 919 | Called after email-gated quiz completion |
| `quiz.astro` | 980 | Called after re-capture form submission |
| `[slug].astro` | 369 | Gate form email submission on journey page |

### Problem

All four writes use `document.cookie = ...`, which triggers Safari ITP's 7-day
cap. The fix is to set the cookie via `Set-Cookie` response header from the
server-side API endpoints that already run on Vercel serverless.

### Which endpoints set the cookie

There are two server-side API endpoints involved:

1. **`/api/quiz-submit`** (`src/pages/api/quiz-submit.ts`) — called from
   `quiz.astro` lines 922 and 965. Currently returns
   `{ success: true, archetype, quizVersion }` on line 480.

2. **`/api/journey-subscribe`** (`src/pages/api/journey-subscribe.ts`) — called
   from `[slug].astro` line 389. Currently returns `{ success: true }` on
   line 294.

### Changes to `/api/quiz-submit.ts`

The endpoint already computes the archetype (line 289) and converts it to a
kebab-case URL slug for the response. We need to:

1. **Read existing `thf_sub` cookie from the request** (for multi-slug append).
2. **Return a `Set-Cookie` header** alongside the JSON response.

```typescript
// --- In the success path (around line 480) ---

// Read existing cookie for multi-slug append
const cookieHeader = request.headers.get('cookie') || '';
const existingSlugs = parseCookieValue(cookieHeader, 'thf_sub');
const kebabArchetype = archetype.replace(/_/g, '-');
const updatedSlugs = appendSlug(existingSlugs, kebabArchetype);

const setCookieValue = `thf_sub=${encodeURIComponent(updatedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure`;

return new Response(JSON.stringify({ success: true, archetype, quizVersion: 'v2' }), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Set-Cookie': setCookieValue,
  },
});
```

### Changes to `/api/journey-subscribe.ts`

Same pattern — the archetype URL slug is already validated (line 148). We need to:

```typescript
// --- In the success path (around line 294) ---

const cookieHeader = request.headers.get('cookie') || '';
const existingSlugs = parseCookieValue(cookieHeader, 'thf_sub');
const updatedSlugs = appendSlug(existingSlugs, archetype); // already kebab-case

const setCookieValue = `thf_sub=${encodeURIComponent(updatedSlugs)};Path=/;Max-Age=15552000;SameSite=Lax;Secure`;

return new Response(JSON.stringify({ success: true }), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Set-Cookie': setCookieValue,
  },
});
```

### Shared helper: `src/lib/cookie-helpers.ts` (new file, ~20 lines)

```typescript
/**
 * Parse a specific cookie value from a raw Cookie header string.
 */
export function parseCookieValue(cookieHeader: string, name: string): string {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Append a slug to a comma-separated cookie value, deduplicating.
 * Returns the updated comma-separated string.
 */
export function appendSlug(existing: string, newSlug: string): string {
  const slugs = existing ? existing.split(',').filter(Boolean) : [];
  if (!slugs.includes(newSlug)) {
    slugs.push(newSlug);
  }
  return slugs.join(',');
}
```

This is pure logic, zero dependencies, easily unit-tested.

### Changes to `quiz.astro` (client-side)

The client-side `setThfSubCookie()` (line 739) currently fires *before* the
`/api/quiz-submit` fetch response comes back (fire-and-forget pattern on lines
922-934 and 965-977). The server-set cookie from the API response will arrive
when the response completes. But since these fetches are fire-and-forget (no
`await` on the response), the client needs a fallback:

**Option A (recommended): Keep client-side cookie as immediate fallback, let
server-side cookie overwrite it.**

The client-side cookie set via `document.cookie` will work immediately (even on
Safari, it works for 7 days). The server-side `Set-Cookie` header from the API
response will overwrite it with a 180-day server-set cookie that bypasses ITP.
This is a belt-and-suspenders approach — no user ever sees a broken state.

The only change needed in `setThfSubCookie()` is multi-slug support:

```typescript
// quiz.astro line 739 — replace the helper
function setThfSubCookie(kebabSlug: string) {
  const existing = document.cookie.match(/(?:^|;\s*)thf_sub=([^;]*)/);
  const currentSlugs = existing ? decodeURIComponent(existing[1]).split(',').filter(Boolean) : [];
  if (!currentSlugs.includes(kebabSlug)) {
    currentSlugs.push(kebabSlug);
  }
  const updated = currentSlugs.join(',');
  document.cookie = `thf_sub=${encodeURIComponent(updated)};path=/;max-age=15552000;SameSite=Lax`;
}
```

**Critical detail:** Change `max-age` from `2592000` (30 days) to `15552000`
(180 days) to match the server-side cookie duration. The client-side 7-day ITP
cap will still apply, but the server-side `Set-Cookie` will extend it to 180
days. If the server response fails, the user still gets 7 days on Safari (30
days on Chrome/Firefox).

We do NOT need to `await` the fetch response to read the `Set-Cookie` header —
the browser automatically processes `Set-Cookie` from fetch responses. The
server-set cookie replaces the client-set one because they share the same name
and path.

### Changes to `[slug].astro` (client-side, line 369)

Same multi-slug pattern for the gate form handler:

```typescript
// [slug].astro line 369 — replace the single-slug cookie set
const existing = document.cookie.match(/(?:^|;\s*)thf_sub=([^;]*)/);
const currentSlugs = existing ? decodeURIComponent(existing[1]).split(',').filter(Boolean) : [];
if (!currentSlugs.includes(currentSlug)) {
  currentSlugs.push(currentSlug);
}
document.cookie = `thf_sub=${encodeURIComponent(currentSlugs.join(','))};path=/;max-age=15552000;SameSite=Lax`;
```

The `/api/journey-subscribe` call (line 389) is also fire-and-forget, so the
same belt-and-suspenders logic applies: client sets it immediately, server
overwrites with ITP-bypassing version.

---

## 2. Multi-Slug Cookie — All Change Sites

### `[slug].astro` server-side gate check (line 35-36)

Current code:
```typescript
const cookie = Astro.cookies.get('thf_sub');
const isGated = !cookie || cookie.value !== urlSlug;
```

New code:
```typescript
const cookie = Astro.cookies.get('thf_sub');
const slugList = cookie ? cookie.value.split(',').map(s => s.trim()) : [];
const isGated = !slugList.includes(urlSlug);
```

This is the only server-side gate check. It runs on every page load of
`/archetype/[slug]`. With multi-slug, the user who completed as `air-weaver`
then retook and got `shadow-dancer` will have
`thf_sub=air-weaver,shadow-dancer`. Both journey pages are unlocked.

### Cookie size concern

6 archetypes max, longest slug is `embodied-intuitive` (19 chars). Worst case:
`air-weaver,embodied-intuitive,ascending-seeker,shadow-dancer,flow-artist,grounded-mystic`
= 88 characters. Well under the 4096-byte cookie limit.

---

## 3. Revised Build Order (4 Phases)

### Phase 1: Cookie Infrastructure (effort: ~30 min)

Files touched:
- **CREATE** `src/lib/cookie-helpers.ts` (~20 lines)
- **CREATE** `tests/cookie-helpers.test.ts` (~40 lines)

Deliverables:
- `parseCookieValue()` — extracts a named cookie from raw header string
- `appendSlug()` — deduplicating comma-separated append
- Unit tests: empty cookie, single slug, append new, deduplicate existing,
  URL-encoded values

No integration risk. Pure functions, no imports beyond the test runner.

### Phase 2: Server-Side Cookie on API Endpoints (effort: ~45 min)

Files touched:
- **EDIT** `src/pages/api/quiz-submit.ts` — import cookie-helpers, add
  `Set-Cookie` header to success response (line 480)
- **EDIT** `src/pages/api/journey-subscribe.ts` — import cookie-helpers, add
  `Set-Cookie` header to success response (line 294)
- **EDIT** `tests/quiz-submit.test.ts` — add test asserting `Set-Cookie` header
  presence and multi-slug append behavior
- **EDIT** `tests/journey-subscribe.test.ts` — same

Key implementation detail: Both endpoints already receive the `request` object
via Astro's `APIRoute` signature (`{ request }`). The `request.headers.get('cookie')`
call is standard — no additional Astro API needed.

The `Set-Cookie` header is added to the `Response` constructor's `headers`
object. Current code uses `{ 'Content-Type': 'application/json' }`. We add
`'Set-Cookie': setCookieValue` alongside it.

**Complexity risk:** The existing tests mock `fetch` for the Loops.so call. We
need to verify that the test harness passes through the `request.headers`
correctly. Looking at the test setup, the tests construct `Request` objects
directly — we just need to include a `Cookie` header in the test requests.

### Phase 3: Client-Side Multi-Slug (effort: ~30 min)

Files touched:
- **EDIT** `src/pages/quiz.astro` — update `setThfSubCookie()` helper (line
  739-741) to read-append-write
- **EDIT** `src/pages/archetype/[slug].astro` — update inline cookie set (line
  369) to read-append-write, update gate check (lines 35-36) to split-includes

This phase touches `.astro` template files. The changes are confined to:
- One JS helper function (3 lines to ~7 lines)
- One inline JS statement (1 line to ~5 lines)
- One server-side TypeScript expression (1 line to 2 lines)

No new dependencies. No layout changes. No markup changes.

### Phase 4: Test + Verify (effort: ~30 min)

- **EDIT** `tests/journey-pages.spec.ts` (Playwright) — verify:
  - Multi-slug cookie grants access to previously-completed archetype
  - Server-set cookie survives across page loads
  - Gate check correctly denies access for slugs NOT in the cookie
- Manual Safari check (or BrowserStack): confirm cookie persists >7 days
  (requires deploying to Vercel preview)

---

## 4. What Does NOT Change

- **No new API endpoints.** Both `/api/quiz-submit` and `/api/journey-subscribe`
  already exist and already run server-side.
- **No database.** Cookie is the only storage mechanism.
- **No localStorage fallback.** The server-side cookie bypasses ITP. The
  client-side cookie is a 7-day fallback, not a replacement.
- **No breaking changes to API response shape.** The JSON body is unchanged.
  Only a new response header is added.
- **The gate form on `[slug].astro` stays.** This is the journey-page email
  gate, which is a separate concern from the quiz-completion gate. It continues
  to work exactly as before, just with multi-slug support.

## 5. Net Line Count

| File | Added | Removed | Net |
|------|-------|---------|-----|
| `src/lib/cookie-helpers.ts` | +20 | 0 | +20 |
| `tests/cookie-helpers.test.ts` | +40 | 0 | +40 |
| `src/pages/api/quiz-submit.ts` | +8 | -2 | +6 |
| `src/pages/api/journey-subscribe.ts` | +8 | -2 | +6 |
| `src/pages/quiz.astro` | +7 | -3 | +4 |
| `src/pages/archetype/[slug].astro` | +7 | -3 | +4 |
| Test files (existing) | +20 | 0 | +20 |
| **Total** | **+110** | **-10** | **+100** |

Round 1 estimated net -90 lines (removal-heavy). Round 2 adds ~100 lines net
due to the cookie infrastructure. This is the correct tradeoff — 100 lines of
cookie handling prevents a class of user-facing bugs on the platform that
represents ~30% of web traffic (Safari/iOS).

## 6. Complexity Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `Set-Cookie` header not processed by browser on fire-and-forget fetch | LOW | Browsers process `Set-Cookie` from any fetch response, even if the JS doesn't read the response body. The client-side cookie provides immediate fallback. |
| Cookie header not forwarded from Vercel edge to serverless function | LOW | Vercel serverless functions receive all request headers by default. The `request` object in Astro's `APIRoute` is the standard `Request` — headers are preserved. |
| Test isolation: existing test mocks don't include `Cookie` header | MEDIUM | Must update test request construction to include `Cookie: thf_sub=...` for multi-slug tests. New tests, not changes to existing assertions. |
| `encodeURIComponent` on commas | LOW | `encodeURIComponent(',')` produces `%2C`. The server-side read uses `decodeURIComponent` before splitting. The client-side regex captures the encoded value. Covered by unit tests in Phase 1. |
| Astro `cookies.get()` auto-decodes | LOW | Astro's `cookies.get()` returns the raw value. Need to verify it doesn't double-decode. One manual check in Phase 4. |

## 7. Open Question for Moderator

The current fire-and-forget pattern on `quiz.astro` lines 922-934 means the
`/api/quiz-submit` response (and its `Set-Cookie` header) may arrive *after* the
user has already navigated to the journey page. If the server response hasn't
arrived yet, the only cookie is the client-set one (7-day ITP cap on Safari).

**Is this acceptable?** I believe yes, because:
1. The quiz result page stays visible for several seconds (product research
   form, share section, journey CTA). The fetch typically completes in <2s.
2. Even if the user clicks the journey link before the response arrives, the
   client-side cookie is already set and will work for 7 days.
3. On the next server interaction (e.g., the journey page gate form, or
   revisiting the quiz), the server will set/refresh the cookie.

If the panel disagrees, the alternative is to `await` the fetch response before
showing the journey CTA, but this adds visible latency to the quiz result reveal
(the current fire-and-forget pattern was a deliberate UX choice).
