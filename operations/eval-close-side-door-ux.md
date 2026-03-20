# UX & Funnel Integrity Evaluation

**Evaluator:** Independent (UX & Funnel Integrity)
**Date:** 2026-03-19
**Branch:** `feature/quiz-design-overhaul`
**Scope:** Close Side Door + Cookie Hardening — Phases 1-4 implementation

---

## Summary Score: 3.9 / 5.0

The implementation is largely sound. The gate-to-quiz-CTA substitution is clean, conditional rendering is correctly applied, SEO structured data is present, and the multi-slug cookie logic is correctly implemented server-side. Three issues hold the score back: (1) the cookie value regex in Layer 1 tests will fail for multi-slug values, representing a regression in existing test coverage; (2) the extended description (`description_extended`) is unconditionally rendered in the hero for all visitors, which was either a deliberate choice or an oversight — the plan does not address it; (3) `journey-pages.spec.ts` calls `page.$()` for sections inside `#journey-content` without a cookie, which will query DOM elements that exist in the HTML but are hidden via `display:none` — the test may pass vacuously (element present in DOM but invisible), creating a false-positive coverage gap.

---

## Lens A: Gated Experience — 4.5 / 5.0

**Hero visible for gated visitors:** PASS. The `#journey-hero` section is unconditionally rendered and contains the archetype image, title, element tag, short description (`archetypeData.description`), and extended description (`journey.data.description_extended`).

**Quiz CTA rendering:** PASS. The `{isGated && (...)}` block renders `#journey-quiz-cta` with heading "This Journey Awaits Your Archetype", a descriptive paragraph listing what is gated (affiliated cards, personalized spreads, journaling prompts, curated reading guides), a `btn-flame` CTA linking to `/quiz`, and a sub-label "Twelve questions. Five minutes. One revelation." The copy is direct and communicates concrete value.

**No dead-end:** PASS. The site logo in the header links to `/`, and the quiz CTA links to `/quiz`. A user who arrives via a shared link always has a forward path.

**Finding — extended description exposed to gated visitors (MEDIUM):** The `description_extended` field from the journey JSON is rendered inside the hero section (line 139 of `[slug].astro`), which is visible to all visitors regardless of gate state. The plan (Phase 3, item 3) only specifies removing the gate form and rendering `#journey-content` conditionally. It does not classify `description_extended` as gated. This may be intentional (teaser content) or an oversight. If the extended description is considered premium content, it is currently ungated.

**No JavaScript required for gating:** PASS. The gate is enforced server-side via SSR. The `display:none` on `#journey-content` is applied in the rendered HTML, not toggled by client-side JS. A visitor with JS disabled sees the correct gated state.

---

## Lens B: Unlocked Experience — 4.5 / 5.0

**Journey content visible when correct cookie is present:** PASS. The `#journey-content` div has `style={isGated ? 'display:none' : ''}` — when `isGated` is false, no inline style is applied and the div renders normally. Affiliated cards, spreads, journaling prompts, and blog links are all contained within this div.

**Email series form:** PASS. Wrapped in `{!isGated && (...)}` (line 270). Renders only for unlocked visitors. The form includes honeypot, timing check, and submit handler wired to `/api/journey-subscribe`.

**Footer CTAs:** PASS. The "Your Result" and "Retake the Quiz" links are wrapped in `{!isGated && (...)}` (line 315). Both render only for unlocked visitors and link to the correct paths (`/quiz/result/${urlSlug}` and `/quiz`).

**Cookie renewal:** PASS. Lines 42-49 of `[slug].astro` call `Astro.cookies.set()` to reset `Max-Age: 15552000` on every visit when the visitor is ungated. The cookie value is preserved as-is (`cookie.value`), so the slug list is not modified, only the expiry is refreshed.

**Finding — cookie renewal re-encodes the value (LOW):** The renewal at line 43 calls `Astro.cookies.set('thf_sub', cookie.value, ...)` where `cookie.value` is the raw (potentially URL-encoded) cookie value as read from the request header. If the client-side helper encoded commas (e.g. `air-weaver%2Cshadow-dancer`), `Astro.cookies.set` will pass it through. The server-side gate check correctly calls `decodeURIComponent(cookie.value)` before `.split(',')`, so the decode→split chain is consistent. However, there is no double-encoding risk check in tests. This is low risk given the current encoding discipline but worth monitoring.

---

## Lens C: Multi-Slug / Retake Behavior — 3.5 / 5.0

**Multi-slug gate check:** PASS. Line 36 of `[slug].astro`:
```ts
const slugList = cookie ? decodeURIComponent(cookie.value).split(',').filter(Boolean) : [];
const isGated = !slugList.includes(urlSlug);
```
This exactly matches the plan specification. `.filter(Boolean)` correctly handles empty strings produced by trailing commas or double-commas. The `decodeURIComponent` correctly handles URL-encoded comma separators.

**Multi-slug E2E test present:** PASS. `tests/quiz-gate-e2e.spec.ts` line 308-325 sets `thf_sub=shadow-dancer,air-weaver` (URL-encoded via `encodeURIComponent`) and asserts `#journey-content` is visible on `/archetype/air-weaver`. This is the correct scenario.

**Wrong-archetype cookie still gates:** PASS. The test at line 292 sets `thf_sub=shadow-dancer` and navigates to `/archetype/air-weaver`, asserting `#journey-quiz-cta` is visible and `#journey-content` is not visible.

**Finding — Layer 1 cookie regex is too strict for multi-slug values (HIGH):** Tests at lines 171 and 192 assert:
```ts
expect(thfCookie!.value).toMatch(/^[a-z]+-[a-z]+$/);
```
This regex matches only a single kebab-case slug (`air-weaver`, `shadow-dancer`). If the server-side `Set-Cookie` header returns a multi-slug value (e.g. `air-weaver%2Cshadow-dancer` after URL encoding), this assertion will fail. After the first quiz completion the cookie may be single-slug, so these tests may still pass in isolation. But after a retake resulting in a different archetype, the cookie will contain two slugs and these tests will break if re-run in a context that already has a cookie set. The regex should be updated to:
```ts
expect(thfCookie!.value).toMatch(/^[a-z%2C,-]+$/); // handles single or multi-slug (raw or encoded)
```
Or more precisely validate that the decoded value contains at least one valid slug. This is a pre-existing pattern that should be updated as part of Phase 4.

**Finding — empty or comma-only cookie value edge case (LOW):** The `setThfSubCookie()` client-side helper (quiz.astro line 741) uses `.filter(Boolean)` to guard against empty segments. The server-side gate check also uses `.filter(Boolean)`. A cookie value of `""` or `","` or `",,"` would produce an empty `slugList`, causing `isGated = true` — the correct safe default. This is properly handled.

---

## Lens D: SEO Structured Data — 4.5 / 5.0

**`isAccessibleForFree: false` present:** PASS. Lines 78-87 of `[slug].astro` emit a `WebPage` JSON-LD block with `isAccessibleForFree: false` and a `hasPart` child `WebPageElement` also marked `isAccessibleForFree: false` targeting `#journey-content`. This is correct per Google's subscription/paywall structured data guidelines.

**FAQ schema preserved:** PASS. Lines 77 of `[slug].astro` emit the `FAQPage` schema block first, followed by the `WebPage` schema block. Both emit from the `slot="head"` position. The FAQ schema is unchanged from the original implementation.

**Page returns 200 for both gated and ungated states:** PASS (by design). The SSR page always returns 200 — the gate state only affects which HTML sections are rendered. The `#journey-content` div is present in the DOM for both states (gated uses `display:none`). Googlebot can crawl the page and read the structured data regardless of cookie state.

**Finding — `cssSelector: '#journey-content'` targets a hidden div for gated visits (LOW):** When Googlebot crawls the page without a cookie, `#journey-content` has `style="display:none"`. The structured data correctly declares this as the gated portion via `cssSelector`. Google's documentation accepts this pattern — the selector identifies what is gated, not what is visible. No action required, but noting for awareness.

**Finding — `journey-pages.spec.ts` testJourneyPageSEO only checks for FAQPage (LOW):** The `testJourneyPageSEO` function (line 149) uses `page.$eval('script[type="application/ld+json"]', ...)` which returns only the first matching element. This will return the FAQPage schema (which comes first in the `<head>`) and passes. The WebPage schema (second `<script>` tag) is not validated by any test. A regression removing the WebPage schema would not be caught. Recommend adding a test that queries `querySelectorAll('script[type="application/ld+json"]')` and checks that at least one contains `isAccessibleForFree`.

---

## Lens E: Conditional Rendering Correctness — 4.5 / 5.0

**Email series form hidden for gated visitors:** PASS. Line 270: `{!isGated && (<section ...>`. The `journey-email-form` and `journey-submit-btn` elements do not exist in the DOM for gated visitors. The client-side script guards with `if (journeyForm && journeySubmitBtn)` — even if this were not the case, the null check prevents errors.

**Footer CTAs hidden for gated visitors:** PASS. Line 315: `{!isGated && (<div ...>`. Both "Your Result" and "Retake the Quiz" links are absent from the DOM for gated visitors.

**Gate form JS handler removed:** PASS. The script block (lines 339-408) contains only two logical sections: (1) the GA4 `journey_page_view` event, and (2) the email series form submit handler keyed to `#journey-email-form`. A search for `gateForm`, `journey-gate-form`, `gateError`, `journeyContent` (old references), and `journeyGateFormWrapper` returned no matches in the file. The old gate form event listener has been fully removed.

**GA4 event still fires:** PASS. Lines 341-347 fire `journey_page_view` on every page load, for both gated and ungated visitors. This is correct — we want to track all visits.

**Email series form handler functional for ungated visitors:** PASS. The handler at lines 355-407 is complete: honeypot check, timing check, fetch to `/api/journey-subscribe`, success/error states, GA4 `generate_lead` event, and Meta Pixel `Lead` event.

**Finding — `journey-pages.spec.ts` testAirWeaverJourneyPageContent queries gated sections without a cookie (MEDIUM):** The test at lines 68-104 navigates to `/archetype/air-weaver` without setting a cookie, then queries:
- `section[aria-label="Affiliated tarot cards"]`
- `section[aria-label="Recommended tarot spreads"]`
- `section[aria-label="Journaling prompts"]`

All three of these sections live inside `#journey-content`, which has `style="display:none"` for gated visitors. Playwright's `page.$()` and `page.$$()` query the DOM, not the visual render — elements with `display:none` are present in the DOM and will be found. The test will pass but is asserting DOM presence, not visibility. This creates a false-positive: the sections exist in the HTML but are hidden. The test should either (a) set a cookie to test ungated content, or (b) explicitly assert `.isVisible()` to verify content is accessible. For the gated state, this is technically a regression in test quality introduced by the close-side-door change (previously the sections may have been conditionally rendered out of the DOM entirely). Note: this is a test coverage gap, not a production bug.

---

## Lens F: Test Coverage — 3.5 / 5.0

**E2E gated view (quiz CTA visible):** PASS. `quiz-gate-e2e.spec.ts` line 263-272 asserts `#journey-quiz-cta` visible and `#journey-content` not visible without a cookie.

**E2E ungated view (content visible):** PASS. Line 274-290 asserts `#journey-content` visible and `#journey-quiz-cta` not visible with the correct cookie.

**E2E wrong cookie (still gated):** PASS. Line 292-306 asserts the wrong-archetype cookie still gates the correct archetype.

**E2E multi-slug cookie:** PASS. Line 308-325 tests `shadow-dancer,air-weaver` cookie unlocking air-weaver.

**Old gate form submission test deleted:** PASS. There is no test referencing `#journey-gate-form` or a gate form submit action in `quiz-gate-e2e.spec.ts`. The plan specified deleting this test (item 4), and it is absent.

**`journey-pages.spec.ts` testJourneyPageBackLink cookie setup:** PASS. Lines 204-213 correctly add a `thf_sub=flow-artist` cookie before navigating to `/archetype/flow-artist`, ensuring the footer CTA is rendered and the "Your Result" link can be found.

**Finding — Layer 1 cookie regex will fail for multi-slug values (HIGH):** See Lens C. Lines 171 and 192 use `/^[a-z]+-[a-z]+$/` which will not match URL-encoded multi-slug values. These tests pass today only because a fresh quiz completion produces a single-slug cookie. In a context where `thf_sub` already exists with another archetype, the server-side append will produce a multi-slug value and these assertions will fail.

**Finding — no test validates cookie renewal (Max-Age refresh) (LOW):** No test verifies that visiting the journey page as an unlocked user refreshes the `Max-Age` on the `thf_sub` cookie. This is difficult to test in Playwright since cookie expiry timestamps are not reliably inspectable. Acceptable gap given the implementation is straightforward SSR code, but worth noting.

**Finding — no test for empty/malformed cookie values (LOW):** Edge cases like `thf_sub=` (empty value), `thf_sub=,` (only commas), or `thf_sub=%2C` (encoded comma only) are not tested. These all result in `isGated = true` by the `.filter(Boolean)` guard, which is the safe default. Low priority but recommended for hardening.

**Finding — `journey-pages.spec.ts` uses raw `playwright` (not `@playwright/test`) (LOW):** The file imports from `playwright` (line 13) rather than `@playwright/test`, using a custom pass/fail runner pattern. This means it does not integrate with the Playwright test runner's reporting, retry logic, or parallelism. The `quiz-gate-e2e.spec.ts` correctly uses `@playwright/test`. This is a pre-existing inconsistency, not introduced by this change. Low priority for migration.

---

## Critical Findings (severity >= HIGH)

**HIGH-1: Layer 1 cookie value regex too strict for multi-slug values**
- Location: `tests/quiz-gate-e2e.spec.ts` lines 171 and 192
- Pattern: `expect(thfCookie!.value).toMatch(/^[a-z]+-[a-z]+$/)`
- Problem: This regex matches only a single kebab-case slug. After a retake where the user already has a cookie, the server-side append produces a multi-slug value (e.g. `air-weaver%2Cshadow-dancer`). The assertion fails.
- Fix: Update the regex to be multi-slug aware. One option:
  ```ts
  // Decoded value should contain at least one valid kebab-case slug
  const decodedValue = decodeURIComponent(thfCookie!.value);
  expect(decodedValue).toMatch(/^[a-z]+-[a-z]+(?:,[a-z]+-[a-z]+)*$/);
  ```
- Severity: HIGH — this is a test regression that will cause CI failures in real retake scenarios.

---

## Recommendations

**MEDIUM-1: Clarify gating intent for `description_extended`**
- Location: `src/pages/archetype/[slug].astro` line 139
- The `description_extended` field is rendered inside the hero section which is always visible, not inside `#journey-content`. This means all visitors (gated and ungated) see the extended description.
- If this is intentional (extended description as teaser to drive quiz completion) — document it in a comment so future developers do not accidentally gate it.
- If this was an oversight (extended description should be gated) — move it inside `#journey-content` or add a conditional render.

**MEDIUM-2: `journey-pages.spec.ts` testAirWeaverJourneyPageContent — section queries are visibility-blind**
- Location: `tests/journey-pages.spec.ts` lines 81-95
- The test queries sections inside `#journey-content` without a cookie, so the sections exist in the DOM but are hidden. The test passes vacuously.
- Recommended fix: Add a cookie to the browser context before navigating, then assert section visibility rather than DOM presence. Alternatively, add a separate test for the gated state that asserts sections are NOT visible.

**LOW-1: `testJourneyPageSEO` does not validate the WebPage structured data**
- Location: `tests/journey-pages.spec.ts` lines 149-155
- Only the first `<script type="application/ld+json">` tag is checked, which returns FAQPage. The WebPage + `isAccessibleForFree` schema is not validated.
- Recommended fix: Query all LD+JSON script tags and assert at least one contains `isAccessibleForFree`.

**LOW-2: Cookie renewal not tested**
- No E2E assertion validates that `Max-Age` is refreshed on an authenticated visit. Acceptable given the simplicity of the implementation, but a unit test of the Astro SSR page response headers would provide stronger coverage.

**LOW-3: Missing edge-case tests for malformed cookie values**
- Empty string, commas-only, and URL-encoded-only-commas are not tested. All resolve safely to `isGated = true` due to `.filter(Boolean)`. Consider adding unit tests to the cookie parsing logic to document this contract.
