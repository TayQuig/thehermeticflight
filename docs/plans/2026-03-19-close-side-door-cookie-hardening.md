# Close Side Door + Cookie Hardening

**Date:** 2026-03-19
**Branch:** `feature/quiz-design-overhaul`
**Mastermind:** `docs/plans/2026-03-19-mastermind-journey-page-access-control.md`

## Problem Statement

The journey page gate form is a side door — anyone with a shared URL bypasses the quiz by entering their email. Meanwhile, client-side cookies expire after 7 days on Safari/iOS (ITP), and the single-slug cookie format means retaking the quiz destroys previous journey access. Fix all three: close the side door, harden the cookie with server-side Set-Cookie, and switch to multi-slug format.

## Phases

### Phase 1: Cookie Helpers (FTF) [SUBAGENT: sonnet]

**Brief:** Create `src/lib/cookie-helpers.ts` with pure functions for cookie parsing and multi-slug management. FTF discipline: test author writes contracts, implementer makes them pass.

**Entry point:** Test Author (Opus) writes `tests/cookie-helpers.test.ts`, then Implementer (Sonnet) creates `src/lib/cookie-helpers.ts`.

**Test contracts (written by Test Author):**

```
parseCookieValue(header, name):
  - empty header → ''
  - single cookie → correct value
  - multiple cookies → correct named value
  - URL-encoded value → decoded
  - missing name → ''

appendSlug(existing, newSlug):
  - empty string + slug → 'slug'
  - existing slug + new → 'old,new'
  - duplicate slug → no append (returns same)
  - malformed input with trailing comma → cleaned
  - empty segments filtered (.filter(Boolean))
```

**Files:**
- CREATE `tests/cookie-helpers.test.ts` (~50 lines) — test contracts
- CREATE `src/lib/cookie-helpers.ts` (~25 lines) — `parseCookieValue()`, `appendSlug()`

**FTF steps:**
1. Test Author writes tests → `record-baseline.sh`
2. Implementer creates module → `verify-frozen.sh`

**Pass/fail:** All unit tests green. `verify-frozen.sh` confirms test file unchanged.

**Known risks:** None — pure functions, zero dependencies.

**Failure triage:** If tests fail, implementation logic is wrong. Fix and re-run.

---

### Phase 2: Server-Side Set-Cookie (2 parallel subagents) [SUBAGENT: sonnet] x2

**Brief:** Add `Set-Cookie` header to both API endpoints on their success responses. This bypasses Safari ITP's 7-day cap on client-side cookies.

**Entry point:** Both subagents import from `cookie-helpers.ts` (Phase 1 must be complete).

**Subagent A — `quiz-submit.ts`:**

Modify `src/pages/api/quiz-submit.ts` line 480 (success response):
1. Read existing `thf_sub` from `request.headers.get('cookie')` via `parseCookieValue()`
2. Convert archetype to kebab slug: `archetype.replace(/_/g, '-')`
3. Append via `appendSlug(existing, kebabSlug)`
4. Add `Set-Cookie` header to Response: `thf_sub=${encodeURIComponent(merged)};Path=/;Max-Age=15552000;SameSite=Lax;Secure`
5. Do NOT add `HttpOnly` — cookie must remain JS-readable
6. Do NOT use `Astro.cookies.set()` — endpoint uses manual `new Response()` construction. Mixing methods risks Astro #15076.

**Subagent B — `journey-subscribe.ts`:**

Same pattern on `src/pages/api/journey-subscribe.ts` line 294. The archetype slug is already kebab-case (validated at line 148).

**Test updates:**
- `tests/quiz-submit.test.ts`: Add test asserting `Set-Cookie` header on success response. Test multi-slug append (send request with existing `Cookie: thf_sub=air-weaver`, verify response header contains `air-weaver,shadow-dancer`).
- `tests/journey-subscribe.test.ts`: Same pattern.

**Files:**
- EDIT `src/pages/api/quiz-submit.ts` (+8 lines)
- EDIT `src/pages/api/journey-subscribe.ts` (+8 lines)
- EDIT `tests/quiz-submit.test.ts` (+20 lines for Set-Cookie assertions)
- EDIT `tests/journey-subscribe.test.ts` (+20 lines)

**Pass/fail:** Existing unit tests still pass. New Set-Cookie assertions pass. `npm run build` succeeds.

**Known risks:**
- Test request mocks may not include `Cookie` header — need to add it to mock Request construction.
- `encodeURIComponent` on commas: `encodeURIComponent('air-weaver,shadow-dancer')` encodes commas as `%2C`. Server must decode before parsing. Use `decodeURIComponent()` in `parseCookieValue()`.

**Failure triage:** If Set-Cookie header missing in test, check that Response constructor `headers` object accepts the key. If test mock fails, verify Request constructor includes `headers: { cookie: '...' }`.

---

### Phase 3: Close Side Door + Client-Side Cookie [SUBAGENT: sonnet]

**Brief:** The main UI change. Remove gate form, add quiz CTA, update gate check to multi-slug, update client-side cookie helpers, add SEO structured data, add cookie renewal.

**Entry point:** Phase 1 complete (cookie-helpers available).

**Changes to `src/pages/archetype/[slug].astro`:**

1. **Gate check (line 36):** Change from:
   ```ts
   const isGated = !cookie || cookie.value !== urlSlug;
   ```
   To:
   ```ts
   const slugList = cookie ? decodeURIComponent(cookie.value).split(',').filter(Boolean) : [];
   const isGated = !slugList.includes(urlSlug);
   ```

2. **Cookie renewal (after gate check):** When not gated (valid cookie), refresh it:
   ```ts
   if (!isGated && cookie) {
     Astro.cookies.set('thf_sub', cookie.value, {
       path: '/',
       maxAge: 15552000,
       sameSite: 'lax',
       secure: import.meta.env.PROD,
     });
   }
   ```
   Note: This is the ONLY place using `Astro.cookies.set()`. The API endpoints use manual headers. No mixing on the same response.

3. **Remove gate form (lines 123-161):** Delete entire `{isGated && (<div id="journey-gate-form">...)}` section.

4. **Add quiz CTA (replace gate form):**
   ```astro
   {isGated && (
     <div id="journey-quiz-cta">
       <section aria-label="Discover your archetype" class="glass-panel p-8 md:p-12 rounded-lg text-center relative">
         <!-- Corner marks (same pattern) -->
         <h2 class="font-serif text-2xl md:text-3xl text-hermetic-gold mb-4 tracking-wide">
           This Journey Awaits Your Archetype
         </h2>
         <p class="text-gray-300 font-sans font-light leading-relaxed mb-8 max-w-lg mx-auto">
           Affiliated cards, personalized spreads, journaling prompts, and curated reading guides —
           unlocked when you discover which archetype speaks through your cards.
         </p>
         <a href="/quiz" class="btn-flame inline-block px-10 py-4 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
           Take the Quiz
         </a>
         <p class="text-gray-500 font-sans text-xs mt-4">Twelve questions. Five minutes. One revelation.</p>
       </section>
     </div>
   )}
   ```

5. **Conditional email series form (lines 262-303):** Wrap in `{!isGated && (...)}`.

6. **Conditional footer CTA (lines 305-323):** Wrap in `{!isGated && (...)}`.

7. **Remove gate form JS (lines 341-398):** Delete the entire `gateForm` event listener, `gateErrorEl`, `journeyContent`, `journeyGateFormWrapper` references, and the gate form submit handler. Keep the GA4 event (lines 330-336) and email series form handler (lines 400-458).

8. **SEO structured data:** Add to `<head>` alongside existing FAQ schema:
   ```astro
   <script type="application/ld+json" slot="head" set:html={JSON.stringify({
     '@context': 'https://schema.org',
     '@type': 'WebPage',
     'isAccessibleForFree': false,
     'hasPart': {
       '@type': 'WebPageElement',
       'isAccessibleForFree': false,
       'cssSelector': '#journey-content'
     }
   })} />
   ```

**Changes to `src/pages/quiz.astro`:**

9. **Update `setThfSubCookie()` (line 739-741):**
   ```js
   function setThfSubCookie(kebabSlug) {
     const match = document.cookie.match(/(?:^|;\s*)thf_sub=([^;]*)/);
     const existing = match ? decodeURIComponent(match[1]).split(',').filter(Boolean) : [];
     if (!existing.includes(kebabSlug)) existing.push(kebabSlug);
     document.cookie = `thf_sub=${encodeURIComponent(existing.join(','))};path=/;max-age=15552000;SameSite=Lax`;
   }
   ```
   Key changes: read-append-dedup + 180-day max-age (was 30-day).

**Files:**
- EDIT `src/pages/archetype/[slug].astro` (~40 lines removed, ~30 added)
- EDIT `src/pages/quiz.astro` (~5 lines changed)

**Pass/fail:** `npm run build` succeeds. Existing frozen tests in `quiz-v2-e2e.spec.ts` still pass. Journey pages return 200.

**Known risks:**
- `Astro.cookies.set()` on the SSR page response vs manual `Set-Cookie` on API responses — these are DIFFERENT response objects, so no Astro #15076 conflict.
- `import.meta.env.PROD` for the `secure` flag — ensures dev (HTTP) still works.
- The `#journey-gate-form` selector referenced in E2E tests will break — expected, fixed in Phase 4.

**Failure triage:** If build fails, check Astro template syntax (JSX conditional rendering). If journey pages 404, check the gate check logic. If frozen tests fail, do not modify them — check what changed.

---

### Phase 4: E2E Test Updates + Integration [SUBAGENT: sonnet]

**Brief:** Update `tests/quiz-gate-e2e.spec.ts` Layer 2 tests for new gate behavior. Run full test suite to verify no regressions.

**Entry point:** Phases 2-3 complete. All code changes landed.

**Changes to `tests/quiz-gate-e2e.spec.ts`:**

1. **Test "without cookie: shows gated view" (line 263):**
   - Change: expect `#journey-quiz-cta` visible instead of `#journey-gate-form`
   - Keep: `#journey-hero` visible, `#journey-content` not visible

2. **Test "with correct cookie: shows full content" (line 274):**
   - Keep assertions as-is (content visible, gate not visible)
   - Change: expect `#journey-quiz-cta` not visible instead of `#journey-gate-form`

3. **Test "with wrong archetype cookie: shows gated view" (line 292):**
   - With multi-slug, a user with `shadow-dancer` cookie visiting air-weaver should STILL be gated (cookie doesn't contain `air-weaver`)
   - Change: expect `#journey-quiz-cta` visible instead of `#journey-gate-form`

4. **Test "submitting email on gated page..." (line 308):**
   - DELETE entirely — the gate form no longer exists

5. **ADD new test: "multi-slug cookie unlocks matching journey":**
   - Set cookie `thf_sub=shadow-dancer,air-weaver`
   - Navigate to `/archetype/air-weaver`
   - Assert `#journey-content` visible

6. **Update cookie value assertions:** Where tests check `thfCookie!.value`, account for multi-slug format (value may contain commas).

7. **Update header comment:** Update cookie contract doc to reflect multi-slug, 180-day, server-side Set-Cookie.

**Integration verification:**
- `npm run test` — all unit tests pass
- `npx playwright test` — all E2E tests pass
- `npm run build` — clean build
- Verify frozen test baselines: `verify-frozen.sh` on `quiz-v2-e2e.spec.ts`

**Files:**
- EDIT `tests/quiz-gate-e2e.spec.ts` (~30 lines changed, ~20 lines removed)

**Pass/fail:** 0 test failures. Build clean. Frozen baselines verified.

**Known risks:**
- Layer 1 tests (quiz result gating) may also reference cookie values — check for single-slug assumptions.
- `journey-pages.spec.ts` tests hit pages without cookies — they test page load (200 status), not content visibility. Should still pass since SSR returns 200 regardless of gate state.

**Failure triage:** If E2E tests timeout, check if dev server is running. If assertions fail on selectors, inspect the rendered HTML with `page.content()`. If frozen tests break, stop — something in Phase 3 inadvertently changed quiz behavior.

---

### Phase 5: Eval Protocol (2 evaluators)

**Brief:** Deploy two independent evaluators to assess the implementation. This is a multi-file change affecting cookie infrastructure, access control, and SEO — warrants full eval.

**Evaluator 1 — Security & Cookie Integrity:**
- Lens: Can the cookie be forged to bypass the gate? Does server-side Set-Cookie work correctly? Is the multi-slug format robust against injection? Does the encoding/decoding roundtrip work?
- Check: Safari ITP compliance (server-set cookie attributes)
- Check: No HttpOnly on thf_sub (must remain JS-readable)
- Check: No cookie value injection via crafted slug names
- Check: Rate limiting still works on both API endpoints

**Evaluator 2 — UX & Funnel Integrity:**
- Lens: Does the gated experience make sense for new visitors? Is the quiz CTA compelling? Does the email series form show/hide correctly? Does cookie renewal work?
- Check: Direct URL visit → hero + quiz CTA (no dead end)
- Check: Quiz completer → full journey content visible
- Check: Retake → both journeys accessible (multi-slug)
- Check: SEO structured data present in page source
- Check: Footer CTAs hidden for gated visitors

**Pass/fail:** Both evaluators score >= 3.5/5.0. Critical findings (severity >= HIGH) must be remediated before merge.

**Known risks:** False positives on the "share-section visible" finding from previous eval — this is intentional per frozen test contract.

**Failure triage:** Remediate findings via targeted fixes. Re-run affected tests. If a finding requires architectural change, escalate to operator.

## Dependencies

```
Phase 1 (cookie-helpers) ──→ Phase 2 (server-side) ──→ Phase 4 (tests)
                          ──→ Phase 3 (side door)   ──→ Phase 4 (tests)
                                                          ↓
                                                     Phase 5 (eval)
```

Phases 2 and 3 are parallelizable after Phase 1 completes.

## Hard Constraints (from Mastermind)

- [x] Server-side Set-Cookie on quiz-submit success: `Path=/; Max-Age=15552000; SameSite=Lax; Secure`
- [x] Multi-slug append-merge on server: read existing thf_sub from request Cookie header
- [x] Client-side setThfSubCookie() retained as fallback with read-append-dedup
- [x] 180-day Max-Age everywhere (no 30-day values remaining)
- [x] Defensive parsing: `.split(',').filter(Boolean)`
- [x] No HttpOnly on this cookie
- [x] Do not modify frozen `quiz-v2-e2e.spec.ts`
- [x] Fire-and-forget fetch pattern preserved in quiz.astro

## Estimated Effort

| Phase | Effort | Parallelism |
|-------|--------|-------------|
| 1. Cookie Helpers (FTF) | ~20 min | Sequential (foundation) |
| 2. Server-Side Set-Cookie | ~30 min | 2 parallel Sonnet subagents |
| 3. Close Side Door + Client | ~40 min | Parallel with Phase 2 |
| 4. E2E Tests + Integration | ~30 min | Sequential (depends on 2+3) |
| 5. Eval Protocol | ~20 min | Sequential (post-implementation) |
| **Total** | **~2.5 hours** | |
