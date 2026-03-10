# Test Coverage Fidelity Analysis — Share CTA & OG Meta Tags

**Evaluator Lens:** Spec Fidelity
**Date:** 2026-03-08
**Feature:** Share CTA & OG Meta Tags (Plan: `docs/plans/2026-03-07-share-cta-og-tags.md`)
**Branch:** `feature/native-quiz-pipeline`

---

## Executive Summary

The test suite covers the archetype content data model thoroughly (51 unit tests) and provides reasonable E2E smoke tests for result page rendering (5 Playwright tests). However, the OG meta tag unit test (`og-meta.test.ts`) validates a reference implementation defined within the test file itself rather than the actual `Layout.astro` behavior, creating a critical spec fidelity gap — the test could pass even if Layout.astro rendered entirely wrong tags. The share CTA's client-side JavaScript logic (URL population after email submission, clipboard copy, GA4 event tracking) has zero test coverage, meaning the most user-facing and bug-prone part of the feature is entirely unvalidated by automation.

---

## Findings

| ID | Title | Severity | Description | Affected File(s) | Evidence |
|----|-------|----------|-------------|-------------------|----------|
| TCF-01 | OG meta test validates reference implementation, not Layout.astro | **Critical** | `tests/og-meta.test.ts` defines a `buildOGTags()` function inline and tests that function. It never imports from or renders `Layout.astro`. The test proves the reference logic is correct, but cannot detect drift between the reference and the actual implementation. If Layout.astro hardcoded wrong values, misspelled a property name, or dropped a tag entirely, this test would still pass. | `tests/og-meta.test.ts`, `src/layouts/Layout.astro` | The `buildOGTags` function (lines 20-38 of the test) is defined locally. No import from Layout.astro exists. The plan acknowledges this ("validates the data model only") and delegates real validation to build-time grep commands, but those are manual steps — not automated tests. |
| TCF-02 | No test for quiz.astro share link population logic | **Critical** | After email submission succeeds (`res.ok`), quiz.astro's client-side JS populates `#share-x`, `#share-fb`, and `#share-copy` with archetype-specific URLs. This involves string interpolation with `quizArchetype`, URL encoding, and DOM manipulation. No test validates that these href values are correctly constructed, that the archetype slug is properly converted from underscore to hyphen format, or that the share text matches the archetype content. A bug here (e.g., null archetype producing `/quiz/result/` with no slug) would be invisible to the test suite. | `src/pages/quiz.astro` (lines 392-411), `tests/quiz-flow.spec.ts` | The Playwright tests never complete the full quiz + email submission flow. `testQuizIntroAndStart` only clicks the start button. No test reaches the email success state. |
| TCF-03 | GA4 share event tracking completely untested | **High** | Both `quiz.astro` (lines 414-425) and `[archetype].astro` (lines 121-132) fire `gtag('event', 'share', ...)` on share button clicks. No test validates that: (a) gtag is called, (b) the event name is 'share', (c) the method parameter correctly distinguishes x/facebook/copy_link, or (d) the item_id parameter contains the correct archetype slug. Analytics regressions are silent failures — they produce no visible error but lose marketing data. | `src/pages/quiz.astro`, `src/pages/quiz/result/[archetype].astro` | Zero references to `gtag`, `share`, or `analytics` in any test file. |
| TCF-04 | No test verifies OG images exist at expected paths | **High** | Layout.astro resolves OG images to paths like `/images/og/air-weaver.png`. The result pages pass `ogImage={'/images/og/${urlSlug}.png'}`. While the 7 PNG files currently exist at `public/images/og/`, no test verifies this. An accidental deletion or rename would produce 404s for social preview images — a silent failure visible only when someone shares a link. | `public/images/og/`, `src/pages/quiz/result/[archetype].astro` | No test file references `public/images/og/` or checks for file existence. The OG image paths are validated only against string patterns, never against the filesystem. |
| TCF-05 | No test for sitemap inclusion of result pages | **High** | The plan (Task 8) explicitly requires verifying that all 6 result pages appear in `sitemap-0.xml`. The `@astrojs/sitemap` integration should auto-discover them, but there is no automated test. If a future Astro config change excluded them, the site would lose SEO discoverability for its primary viral landing pages. | `astro.config.mjs`, `tests/` | Task 8 in the plan describes a manual `grep 'result' dist/sitemap-0.xml` verification step. This was never automated. |
| TCF-06 | Edge cases in toUrlSlug/archetypeByUrlSlug not tested | **Medium** | `toUrlSlug` uses `slug.replace(/_/g, '-')` and `archetypeByUrlSlug` uses `urlSlug.replace(/-/g, '_')`. Untested edge cases: (1) empty string input to either function, (2) input with mixed separators like `air-weaver_extra`, (3) input already in hyphenated format passed to `toUrlSlug`, (4) input with leading/trailing hyphens. The `archetypeByUrlSlug` function casts the result to `ArchetypeSlug` without validation, so malformed input returns `undefined` silently rather than failing. | `src/lib/archetype-content.ts`, `tests/archetype-content.test.ts` | `toUrlSlug` is tested only with the 6 known valid slugs. `archetypeByUrlSlug` tests one valid case, one invalid case ('not-real'), and an exhaustive map of all 6 — but no boundary conditions. |
| TCF-07 | E2E tests use brittle DOM selectors | **Medium** | The Playwright tests depend on specific DOM structure: `#share-buttons a` for counting share links (exactly 2), `#copy-link-btn` for the copy button, `a[href="/quiz"]` for the CTA, `.quiz-step.active` class presence, `[data-step="1"]` attribute selectors. While most use IDs (stable), the share link count assertion (`shareLinks.length !== 2`) would break if a third platform were added. The `waitForTimeout(400)` in `testQuizIntroAndStart` is a timing-dependent assertion that could flake on slow CI runners. | `tests/quiz-flow.spec.ts` | Line 106: `if (shareLinks.length !== 2)` — hardcoded count. Line 174: `await page.waitForTimeout(400)` — fixed sleep instead of condition-based wait. |
| TCF-08 | Canonical URL test covers only one page | **Medium** | `testResultPageCanonicalURL` validates that `/quiz/result/shadow-dancer` uses the `www` prefix in its canonical URL. It does not test: (a) the homepage canonical, (b) the quiz page canonical, (c) other result pages, or (d) that the canonical path component matches the actual page path. The `www` prefix was identified as a reconciliation issue in the plan (Step 2a), making it a regression-prone area. | `tests/quiz-flow.spec.ts` (lines 191-211), `src/layouts/Layout.astro` | Only one page tested. The canonical URL logic in Layout.astro (`canonicalURL \|\| '${siteUrl}${currentPath}'`) relies on Astro.url.pathname, which could produce unexpected trailing slashes or index.html paths depending on Astro's output mode. |
| TCF-09 | Quiz CTA link on result pages tested only on one archetype | **Medium** | `testResultPageOGAndShareButtons` checks `a[href="/quiz"]` on the `air-weaver` result page. While the CTA is rendered from the same template for all 6 pages, `testAll6ResultPagesLoad` only validates that pages return 200 and have non-empty h1 text — it does not check for the quiz CTA. A conditional rendering bug on a specific archetype would go undetected. | `tests/quiz-flow.spec.ts` | `testAll6ResultPagesLoad` (lines 128-156) checks only status code and h1 presence. The deeper structural checks (OG tags, share buttons, quiz CTA) are only run against `air-weaver`. |
| TCF-10 | No test for the quiz.astro share copy-to-clipboard behavior | **Medium** | The copy link button on quiz.astro (line 407-411) calls `navigator.clipboard.writeText(shareUrl)` and toggles the button text to "Copied!" for 2 seconds. The result page has similar logic (lines 113-117 of [archetype].astro). Neither behavior is tested. While clipboard APIs are hard to test in Playwright without permissions mocking, the text toggle feedback ("Copied!" appearing and reverting) is testable. | `src/pages/quiz.astro`, `src/pages/quiz/result/[archetype].astro` | No test references clipboard, "Copied!", or `share-copy-text`. |

---

## Coverage Matrix

| Requirement (from Plan) | Unit Test | E2E Test | Manual/Build Verification | Gap? |
|--------------------------|-----------|----------|---------------------------|------|
| **Task 1:** OG tags in Layout.astro `<head>` | Reference impl only (TCF-01) | Homepage OG checked | Build grep (manual) | YES — no automated validation of actual Layout.astro output |
| **Task 1:** Twitter Card tags | Reference impl only | twitter:card checked in E2E | Build grep (manual) | Partial |
| **Task 1:** Canonical URL with www | None | 1 result page checked | None | Partial (TCF-08) |
| **Task 1:** Custom ogImage path resolution | Reference impl only | OG image checked on air-weaver | None | YES — reference impl only |
| **Task 1:** Absolute URL passthrough | Reference impl only | None | None | YES — reference impl only |
| **Task 2:** toUrlSlug converts all 6 slugs | YES (6 assertions) | N/A | N/A | No |
| **Task 2:** archetypeByUrlSlug round-trips | YES (6 + invalid) | N/A | N/A | No |
| **Task 2:** Edge cases (empty, mixed) | None | N/A | N/A | YES (TCF-06, low risk) |
| **Task 3:** 6 result pages render at correct URLs | N/A | YES (all 6 checked for 200 + h1) | Build output verified | No |
| **Task 3:** Result pages have archetype-specific OG tags | N/A | 1 page (air-weaver) | Build grep (manual) | Partial (TCF-09) |
| **Task 3:** Result pages have share buttons (X, FB, copy) | N/A | 1 page (air-weaver) | None | Partial (TCF-09) |
| **Task 3:** Result pages have "Discover Your Archetype" CTA | N/A | 1 page (air-weaver) | None | Partial (TCF-09) |
| **Task 4:** Share CTA appears after email submission | None | None | None | YES (TCF-02) |
| **Task 4:** Share links populated with correct archetype URLs | None | None | None | YES (TCF-02) |
| **Task 4:** Copy link button copies URL to clipboard | None | None | None | YES (TCF-10) |
| **Task 5:** 7 OG images exist at expected paths | None | None | Manual `ls` only | YES (TCF-04) |
| **Task 6:** GA4 share events fire with correct parameters | None | None | Manual GA4 Realtime check | YES (TCF-03) |
| **Task 7:** Quiz intro loads and start button works | N/A | YES | N/A | No |
| **Task 8:** Sitemap includes all 6 result pages | None | None | Manual grep only | YES (TCF-05) |

---

## Recommendations

### Critical (should block deployment)

1. **TCF-01: Replace reference implementation with build output validation.** The current OG meta test provides false confidence. Two options:
   - **Option A (preferred):** Add a Vitest test that uses `@astrojs/test-utils` or reads the `dist/index.html` after build to verify actual `<meta property="og:title">` tags exist with expected content.
   - **Option B (simpler):** Add a Playwright test that validates all required OG tags on the homepage AND at least one result page, checking content values — not just presence. The existing `testHomepageOGTags` E2E test partially does this but could be strengthened with value assertions.
   - **Priority note:** The E2E tests (`testHomepageOGTags`, `testResultPageOGAndShareButtons`) partially compensate for TCF-01 by checking the actual rendered HTML. The real risk is if those E2E tests aren't run regularly (they require a build + preview server). Consider whether the E2E coverage is sufficient given the team's CI setup.

2. **TCF-02: Add E2E test for full quiz completion through share CTA.** This is the primary user journey the feature exists to enable. Test should: complete all 20 questions, verify result screen appears, submit email form (mock the API endpoint), verify share section becomes visible, verify share link hrefs contain the correct archetype URL slug.

### High (should be addressed before marketing launch)

3. **TCF-03: Add GA4 event contract test.** Inject a mock `gtag` function via Playwright's `page.evaluate`, click each share button, and verify the mock was called with expected parameters. This is a ~20-line addition per page and prevents silent analytics regressions.

4. **TCF-04: Add OG image existence test.** A simple Vitest test that checks `fs.existsSync('public/images/og/[slug].png')` for all 7 expected files. Takes 5 minutes to write, prevents broken social previews.

5. **TCF-05: Add sitemap verification test.** After build, verify that `dist/sitemap-0.xml` contains all 6 result page URLs. This can be a build-step script or a Vitest test that reads the file.

### Medium (good hygiene, address when convenient)

6. **TCF-06: Add edge case tests for URL slug functions.** Test empty string, already-hyphenated input, and mixed separators. Low risk since these functions are only called with known-good data in practice, but good defensive coverage.

7. **TCF-07: Replace `waitForTimeout` with condition-based waits.** Change `await page.waitForTimeout(400)` to `await page.waitForSelector('[data-step="1"].active', { timeout: 5000 })` to eliminate timing flakiness. Consider making the share link count assertion more flexible (e.g., `>= 2`).

8. **TCF-08: Extend canonical URL test to multiple pages.** Add homepage and quiz page canonical checks. Verify the path component of the canonical URL matches the actual page path (not just the www prefix).

9. **TCF-09: Extend structural checks to all 6 result pages.** The `testAll6ResultPagesLoad` test could be enhanced to also check for share button presence and quiz CTA on each page, not just status + h1.

10. **TCF-10: Test copy-link feedback text toggle.** In Playwright, after clicking the copy button, assert that `#copy-text` (or `#share-copy-text` on quiz.astro) changes to "Copied!" and reverts after 2 seconds. Skip the actual clipboard assertion if permissions are complex.

---

## Risk Assessment Summary

| Risk Level | Count | IDs |
|------------|-------|-----|
| Critical | 2 | TCF-01, TCF-02 |
| High | 3 | TCF-03, TCF-04, TCF-05 |
| Medium | 5 | TCF-06, TCF-07, TCF-08, TCF-09, TCF-10 |

The most dangerous gap is TCF-02 — the full quiz-to-share flow is the *raison d'etre* of this feature and has zero automated validation. A null reference in the share URL construction, a failed API mock, or a CSS visibility bug in the email-success reveal would all be invisible to the current test suite.

The OG meta test (TCF-01) is a legitimate concern but partially mitigated by the E2E tests that do check actual rendered HTML. The severity depends on whether the E2E tests are run as part of CI or only manually.

---

*Evaluator: Spec Fidelity Lens | Generated 2026-03-08*
