# Synthesis Report — Share CTA & OG Meta Tags Hardening

**Sprint:** hardening-2026-03-08
**Evaluators:** 4 (Structural Completeness, Adversarial Security, Architectural Integrity, Test Coverage Fidelity)
**Date:** 2026-03-08

---

## 1. Finding ID + Calibrated Severity

### F-01: Blog canonical URL missing `www` prefix
**Severity:** High
**Convergence:** 3/4 (SC-01, ARCH-07, ARCH-01)
**Affected Files:** `src/pages/blog/[...slug].astro`
**Original Severity Range:** High (SC-01), Medium (ARCH-07)

### F-02: OG meta test validates reference implementation, not actual Layout
**Severity:** High
**Convergence:** 3/4 (SC-03, ARCH-06, TCF-01)
**Affected Files:** `tests/og-meta.test.ts`, `src/layouts/Layout.astro`
**Original Severity Range:** Critical (TCF-01), Medium (SC-03, ARCH-06)

### F-03: No test for full quiz → share CTA user journey
**Severity:** High
**Convergence:** 1/4 (TCF-02)
**Affected Files:** `tests/quiz-flow.spec.ts`
**Original Severity Range:** Critical (TCF-02)

### F-04: Clipboard API calls lack error handling
**Severity:** Medium
**Convergence:** 2/4 (SC-02, ADV-02)
**Affected Files:** `src/pages/quiz.astro`, `src/pages/quiz/result/[archetype].astro`
**Original Severity Range:** Medium (SC-02), Low (ADV-02)

### F-05: Hardcoded siteUrl should derive from Astro.site
**Severity:** Medium
**Convergence:** 1/4 (ARCH-01)
**Affected Files:** `src/layouts/Layout.astro`
**Original Severity Range:** High (ARCH-01)

### F-06: Slug conversion logic duplicated between server and client
**Severity:** Medium
**Convergence:** 1/4 (ARCH-02)
**Affected Files:** `src/pages/quiz.astro`
**Original Severity Range:** High (ARCH-02)

### F-07: No test verifies OG images exist at expected paths
**Severity:** Medium
**Convergence:** 1/4 (TCF-04)
**Affected Files:** `tests/og-images.test.ts` (create)
**Original Severity Range:** High (TCF-04)

### F-08: No test for sitemap inclusion of result pages
**Severity:** Medium
**Convergence:** 1/4 (TCF-05)
**Affected Files:** `tests/sitemap.test.ts` (create)
**Original Severity Range:** High (TCF-05)

### F-09: elementColors map duplicated outside archetype-content.ts
**Severity:** Medium
**Convergence:** 1/4 (ARCH-05)
**Affected Files:** `src/pages/quiz/result/[archetype].astro`, `src/lib/archetype-content.ts`
**Original Severity Range:** Medium (ARCH-05)

**Severity calibration notes:**
- TCF-01 downgraded from Critical to High: E2E tests (`testHomepageOGTags`, `testResultPageOGAndShareButtons`) partially validate actual rendered HTML.
- TCF-02 downgraded from Critical to High: Share links use hardcoded data and `encodeURIComponent`; risk of silent failure exists but is not exploitable.
- ARCH-01/ARCH-02 downgraded from High to Medium: Maintenance risks, not bugs.
- TCF-04/TCF-05 downgraded from High to Medium: Silent failure prevention, not correctness bugs.

---

## 2. Convergence Matrix

| Finding | Structural | Adversarial | Architectural | Test Coverage | Convergence | Confidence |
|---------|-----------|-------------|---------------|---------------|-------------|------------|
| F-01 | SC-01 | — | ARCH-07, ARCH-01 | — | 3/4 | **High** |
| F-02 | SC-03 | — | ARCH-06 | TCF-01 | 3/4 | **High** |
| F-03 | — | — | — | TCF-02 | 1/4 | Low (but critical gap) |
| F-04 | SC-02 | ADV-02 | — | — | 2/4 | **Medium** |
| F-05 | — | — | ARCH-01 | — | 1/4 | Low |
| F-06 | — | — | ARCH-02 | — | 1/4 | Low |
| F-07 | — | — | — | TCF-04 | 1/4 | Low |
| F-08 | — | — | — | TCF-05 | 1/4 | Low |
| F-09 | — | — | ARCH-05 | — | 1/4 | Low |

---

## 3. Affected Files Inventory

| File | Action | Findings |
|------|--------|----------|
| `src/pages/blog/[...slug].astro` | Modify | F-01 |
| `src/layouts/Layout.astro` | Modify | F-05 |
| `src/pages/quiz.astro` | Modify | F-04, F-06 |
| `src/pages/quiz/result/[archetype].astro` | Modify | F-04, F-09 |
| `src/lib/archetype-content.ts` | Modify | F-09 |
| `tests/og-meta.test.ts` | Modify | F-02 |
| `tests/quiz-flow.spec.ts` | Modify | F-03 |
| `tests/og-images.test.ts` | Create | F-07 |
| `tests/sitemap.test.ts` | Create | F-08 |

---

## Remediation Plan

### High Severity Cycle (F-01, F-02, F-03)
- F-01: Fix blog canonical URL to use `www` prefix
- F-02: Replace OG meta reference implementation test with build-output validation
- F-03: Add E2E test for full quiz → email → share CTA flow

### Medium Severity Cycle (F-04, F-05, F-06, F-07, F-08, F-09)
- F-04: Add try/catch to clipboard API calls with user feedback
- F-05: Derive siteUrl from Astro.site instead of hardcoding
- F-06: Import toUrlSlug in quiz.astro instead of inline reimplementation
- F-07: Add OG image file existence test
- F-08: Add sitemap result page inclusion test
- F-09: Move elementColors hex values into archetype-content.ts

---

## 5. Deferred Findings with Rationale

| Original ID | Title | Reason for Deferral |
|-------------|-------|---------------------|
| ADV-01 | No Content Security Policy | Pre-existing site-wide gap, not introduced by this feature. Requires GTM/analytics architecture decisions. Backlog item. |
| ARCH-03 | Playwright tests not in CI | Infrastructure task requiring CI pipeline setup. Out of scope for code hardening. Backlog item. |
| ARCH-04 | quiz.astro script block >250 lines | Refactoring preference, not a bug. F-06 partially addresses by extracting slug logic. |
| ARCH-08 | Multiple `as` casts in quiz.astro | Pre-existing pattern across the codebase. Addressing comprehensively would require a separate refactoring sprint. |
| ARCH-09 | Share button SVGs duplicated | DRY refactoring. Low risk of drift given both files are in the same feature. |
| TCF-03 | GA4 share events untested | Requires gtag mock infrastructure. Analytics testing is a separate concern. |
| TCF-06 | Edge cases in slug functions | Functions only receive known-good data from typed sources. Extremely low practical risk. |
| TCF-07 | Brittle E2E DOM selectors | Maintenance concern, not a bug. waitForTimeout can be improved incrementally. |
| TCF-08 | Canonical URL tested on 1 page | Subsumed by F-01 fix + its verification criteria. |
| TCF-09 | Deep structural checks on 1 archetype | Template rendering means all 6 pages are identical in structure. Low risk. |
| TCF-10 | Clipboard copy feedback untested | Low risk; user feedback, not data integrity. |

---

## 6. Verification Criteria

### F-01: Blog canonical URL uses www
```bash
npm run build && grep -o 'canonical.*href="[^"]*"' dist/client/blog/*/index.html | head -5
```
**Expected:** All canonical hrefs start with `https://www.thehermeticflight.com`

### F-02: OG meta test validates actual build output
```bash
npx vitest run tests/og-meta.test.ts 2>&1 | tail -5
```
**Expected:** Tests import or read from build output / check actual rendered HTML. No inline `buildOGTags` reference implementation.

### F-03: Quiz→share E2E test exists
```bash
grep -c 'share' tests/quiz-flow.spec.ts
```
**Expected:** At least one test function validates share link population after quiz completion.

### F-04: Clipboard calls have try/catch
```bash
grep -A3 'clipboard.writeText' src/pages/quiz.astro src/pages/quiz/result/\[archetype\].astro
```
**Expected:** Every `clipboard.writeText` call is inside a try block.

### F-05: siteUrl derived from Astro.site
```bash
grep 'siteUrl' src/layouts/Layout.astro
```
**Expected:** Uses `Astro.site` rather than hardcoded string.

### F-06: No duplicated slug conversion
```bash
grep -n 'replace(/_/g' src/pages/quiz.astro
```
**Expected:** Zero matches (uses imported `toUrlSlug` instead).

### F-07: OG image existence test passes
```bash
npx vitest run tests/og-images.test.ts 2>&1 | tail -5
```
**Expected:** All tests pass, verifying 7 PNG files exist.

### F-08: Sitemap test passes
```bash
npx vitest run tests/sitemap.test.ts 2>&1 | tail -5
```
**Expected:** All tests pass, verifying 6 result pages in sitemap.

### F-09: elementColors in archetype-content.ts
```bash
grep 'elementColors\|accentHex' src/pages/quiz/result/\[archetype\].astro src/lib/archetype-content.ts
```
**Expected:** Hex values defined in archetype-content.ts, result page reads from archetype data.

---

## 7. Stripped Finding Descriptions (for Test Author)

### High Severity Group

**F-01:** The blog post page at `src/pages/blog/[...slug].astro` constructs its canonical URL using `https://thehermeticflight.com` (no `www` prefix), while all other pages use `https://www.thehermeticflight.com`. This creates a split-canonical signal for search engines.

**F-02:** The OG meta tag test file (`tests/og-meta.test.ts`) defines its own `buildOGTags()` function inline and tests that function — it never validates the actual `Layout.astro` output. If Layout.astro's OG tag rendering diverged, the test would still pass.

**F-03:** No automated test validates the complete user journey: take quiz → see archetype result → submit email → share section becomes visible → share links contain correct archetype-specific URLs.

### Medium Severity Group

**F-04:** Both `src/pages/quiz.astro` and `src/pages/quiz/result/[archetype].astro` call `navigator.clipboard.writeText()` without try/catch. If the clipboard API is unavailable or denied, an unhandled promise rejection occurs with no user feedback.

**F-05:** `Layout.astro` hardcodes `const siteUrl = 'https://www.thehermeticflight.com'` instead of deriving from `Astro.site` (which is already configured in `astro.config.mjs`). The same hardcoded URL appears in quiz.astro and [archetype].astro.

**F-06:** quiz.astro line 392 re-implements slug conversion inline (`quizArchetype.replace(/_/g, '-')`) instead of importing the canonical `toUrlSlug()` function from archetype-content.ts.

**F-07:** No automated test verifies that the 7 expected OG image files exist at `public/images/og/`. An accidental deletion or rename would produce 404s for social preview images.

**F-08:** No automated test verifies that all 6 archetype result pages appear in the built sitemap. The plan required this verification but it was only done manually.

**F-09:** The `[archetype].astro` result page defines an `elementColors` hex map that duplicates color data already partially present in archetype-content.ts. This parallel data structure can drift if elements are re-themed.
