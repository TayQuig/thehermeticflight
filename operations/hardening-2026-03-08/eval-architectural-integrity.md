# Architectural Integrity Evaluation — Share CTA & OG Meta Tags

**Evaluator lens:** QUALITY — structure, maintainability, pattern adherence
**Date:** 2026-03-08
**Branch:** `feature/native-quiz-pipeline`
**Evaluator:** Claude Opus 4.6 (independent code evaluator)

---

## Executive Summary

The Share CTA and OG Meta Tags feature is well-integrated into the existing codebase. The Layout.astro Props extension is properly backwards-compatible, the result pages follow the site's glass-panel aesthetic, and the archetype-content module's new URL slug utilities are cleanly designed. However, the evaluation uncovered **10 findings** across three severity tiers: a hardcoded site URL that should be derived from Astro's config, duplicated slug-conversion logic between server and client code, a growing monolithic script block in quiz.astro, and a Playwright test file that bypasses the project's test runner entirely. None are critical, but several will create real maintenance burden or drift risk if left unaddressed.

---

## Findings

| ID | Title | Severity | Affected File(s) |
|----|-------|----------|-------------------|
| ARCH-01 | Hardcoded siteUrl diverges from Astro.site | High | Layout.astro, quiz.astro, [archetype].astro |
| ARCH-02 | Slug conversion logic duplicated between server and client | High | archetype-content.ts, quiz.astro (line 392) |
| ARCH-03 | Playwright E2E test is a standalone script, not integrated into CI | High | tests/quiz-flow.spec.ts |
| ARCH-04 | quiz.astro script block exceeds 250 lines — extraction needed | Medium | quiz.astro |
| ARCH-05 | elementColors map in [archetype].astro duplicates data from archetype-content.ts | Medium | [archetype].astro, archetype-content.ts |
| ARCH-06 | OG test re-implements Layout logic instead of testing actual output | Medium | tests/og-meta.test.ts |
| ARCH-07 | Blog canonical URL uses bare domain (no www) vs Layout's www prefix | Medium | blog/[...slug].astro, Layout.astro |
| ARCH-08 | Multiple `as` casts in quiz.astro bypass TypeScript safety | Medium | quiz.astro |
| ARCH-09 | Share button SVG icons inlined in two files with no shared component | Medium | quiz.astro, [archetype].astro |
| ARCH-10 | Result pages correctly independent from quiz flow | Info | [archetype].astro |

---

## Detailed Findings

### ARCH-01: Hardcoded siteUrl diverges from Astro.site (High)

**Description:** Layout.astro hardcodes `const siteUrl = 'https://www.thehermeticflight.com'` on line 11. The same URL appears hardcoded in quiz.astro line 393 and [archetype].astro lines 69 and 78. Meanwhile, `astro.config.mjs` already declares `site: 'https://www.thehermeticflight.com'`, which Astro exposes via `Astro.site`. This creates a maintenance risk: if the domain ever changes (staging environment, domain migration), every hardcoded instance must be found and updated manually.

**Evidence:**

```typescript
// Layout.astro:11
const siteUrl = 'https://www.thehermeticflight.com';

// astro.config.mjs:9
site: 'https://www.thehermeticflight.com',
```

Additionally, the blog slug page uses a *different* form of the URL without `www`:
```typescript
// blog/[...slug].astro:21
const canonicalURL = new URL(post.slug, 'https://thehermeticflight.com/blog/').toString();
```

**Recommendation:** In Layout.astro, replace the hardcoded string with `const siteUrl = Astro.site?.origin || 'https://www.thehermeticflight.com'`. For the client-side JS in quiz.astro, derive the share URL from `window.location.origin` rather than hardcoding. For the [archetype].astro template, the share URLs can be built server-side using `Astro.site`. This creates a single source of truth (astro.config.mjs) for the production domain.

---

### ARCH-02: Slug conversion logic duplicated between server and client (High)

**Description:** The `toUrlSlug()` function in archetype-content.ts converts underscores to hyphens (`slug.replace(/_/g, '-')`). However, quiz.astro's client-side `<script>` block re-implements this exact logic inline on line 392:

```typescript
// quiz.astro:392 (inside <script> block — client-side JS)
const urlSlug = quizArchetype ? quizArchetype.replace(/_/g, '-') : '';
```

```typescript
// archetype-content.ts:65 (server-side module)
export function toUrlSlug(slug: ArchetypeSlug): string {
  return slug.replace(/_/g, '-');
}
```

This is a drift risk. If the slug format ever changes (e.g., adding a prefix, switching to camelCase), the inline implementation will silently diverge from the canonical one. The issue arises because Astro `<script>` blocks in pages are bundled as client-side JS and can import from `src/lib/` modules, so `toUrlSlug` could actually be imported directly.

**Recommendation:** Import `toUrlSlug` in quiz.astro's `<script>` block (which already imports from `../lib/quiz-data`, `../lib/classifier`, and `../lib/archetype-content`). Replace the inline `.replace()` call with `toUrlSlug(quizArchetype as ArchetypeSlug)`.

---

### ARCH-03: Playwright E2E test is a standalone script, not integrated into CI (High)

**Description:** `tests/quiz-flow.spec.ts` uses raw `playwright` (not `@playwright/test`) with a custom pass/fail runner. It requires a manual three-step process (build, start preview server, run with `npx tsx`). It is excluded from the vitest config because vitest only includes `tests/**/*.test.ts`, and this file uses `.spec.ts`. The project has `playwright` as a devDependency but not `@playwright/test`.

This pattern has three problems:
1. **CI gap:** The `npm test` command will never run these tests. They are invisible to automated workflows.
2. **No standard assertion library:** The custom `pass()`/`fail()` helpers lack detailed diff output, retry logic, and timeout management that `@playwright/test` provides.
3. **Browser instance per test:** Each test function launches and closes a fresh browser. This is slow and will not scale.

**Evidence:**

```typescript
// quiz-flow.spec.ts:1-10
import { chromium } from 'playwright';
// ... custom pass/fail helpers, manual runner
```

```typescript
// vitest.config.ts:4-6
test: {
  include: ['tests/**/*.test.ts'],  // .spec.ts is excluded
},
```

```json
// package.json scripts
"test": "vitest run"  // only runs vitest
```

**Recommendation:** Either (a) migrate to `@playwright/test` with a `playwright.config.ts` and add an `"e2e"` script to package.json, or (b) rename to `.test.ts` and document the manual server dependency clearly. Option (a) is strongly preferred because it provides fixtures, parallelism, retries, and HTML reporting out of the box.

---

### ARCH-04: quiz.astro script block exceeds 250 lines — extraction needed (Medium)

**Description:** quiz.astro is 449 lines total, with its `<script>` block spanning lines 197-448 (251 lines of client-side logic). The share CTA integration added approximately 45 lines (391-425) to an already substantial block. The script block now handles five distinct concerns:

1. Quiz state management and step navigation (lines 208-272)
2. Result reveal animations (lines 274-307)
3. Answer selection and auto-advance (lines 316-343)
4. Back button navigation (lines 346-355)
5. Email form submission + share CTA population + analytics tracking (lines 358-444)

This is not yet critical, but the file is past the point where a new developer can quickly orient. The share CTA logic (building URLs, populating href attributes, clipboard API, GA4 event tracking) is a self-contained unit that could be extracted.

**Recommendation:** Extract the share CTA logic into a `src/lib/share-utils.ts` module that exports `buildShareUrls(archetype, siteUrl)` and `trackShareEvent(platform, archetype)`. This also resolves ARCH-02 by centralizing URL construction. The quiz.astro script would then call `populateShareButtons(archetypeSlug)` after successful form submission.

---

### ARCH-05: elementColors map duplicates data that should live in archetype-content.ts (Medium)

**Description:** The [archetype].astro result page defines an `elementColors` record mapping element names to hex values:

```typescript
// [archetype].astro:18-25
const elementColors: Record<string, string> = {
  Air: '#93c5fd',
  Earth: '#6ee7b7',
  Spirit: '#c4b5fd',
  Shadow: '#fca5a5',
  Water: '#67e8f9',
  Mercury: '#C5A059',
};
```

Meanwhile, `archetype-content.ts` already stores a Tailwind `color` class per archetype (e.g., `'text-blue-300'`). The hex values in `elementColors` are the CSS equivalents of those Tailwind classes but expressed in a different format. This is a parallel data structure that could drift if elements are re-themed.

**Recommendation:** Add an optional `accentHex` field to `ArchetypeContent` in archetype-content.ts. This keeps all archetype display data in one canonical location. The result page can then use `archetype.accentHex` directly instead of maintaining a separate lookup.

---

### ARCH-06: OG test re-implements Layout logic instead of testing actual output (Medium)

**Description:** `tests/og-meta.test.ts` defines its own `buildOGTags()` function that mirrors what Layout.astro does, then tests that function. This is a "testing the test" anti-pattern — if Layout.astro's logic diverges from `buildOGTags()`, the tests will still pass while production is broken.

```typescript
// og-meta.test.ts:20-38
function buildOGTags(props: OGProps) {
  const siteUrl = 'https://www.thehermeticflight.com';
  // ... reimplements Layout.astro logic
}
```

The comment on line 8 acknowledges this: "actual HTML rendering is checked by the build verification in Step 4." However, the Playwright E2E tests (ARCH-03) that would serve as that verification layer are not in CI.

**Recommendation:** This is acceptable as a data-model contract test *only if* there is a corresponding integration test that validates the actual rendered HTML. Since the Playwright tests are not in CI (ARCH-03), this creates a gap. Fix ARCH-03 first, and this becomes a non-issue. Alternatively, add a build-output test that reads the generated HTML from `dist/` and validates the meta tags are present.

---

### ARCH-07: Blog canonical URL uses bare domain (no www) vs Layout's www prefix (Medium)

**Description:** Layout.astro uses `https://www.thehermeticflight.com` for all canonical URLs and OG tags. However, the blog slug page constructs its canonical URL with the bare domain:

```typescript
// blog/[...slug].astro:21
const canonicalURL = new URL(post.slug, 'https://thehermeticflight.com/blog/').toString();
```

This means blog posts will have canonical URLs without `www` while all other pages have canonical URLs with `www`. Search engines treat these as different URLs, which can dilute SEO signals.

**Recommendation:** Use the same `www` domain, or better yet, derive from `Astro.site` as recommended in ARCH-01. This is a pre-existing issue not introduced by the Share CTA feature, but the feature work exposes the inconsistency.

---

### ARCH-08: Multiple `as` casts in quiz.astro bypass TypeScript safety (Medium)

**Description:** The quiz.astro script block contains several `as` casts that suppress type checking:

```typescript
// Line 227: could return null if element doesn't exist
const emailForm = document.getElementById('email-form') as HTMLFormElement;

// Line 317: double cast to HTMLElement then assumed non-null
const btn = (e.target as HTMLElement).closest('.answer-btn') as HTMLElement;

// Line 369-370: FormData.get() returns FormDataEntryValue | null
const email = formData.get('email') as string;
const firstName = formData.get('firstName') as string;

// Line 394: archetypes lookup bypasses ArchetypeSlug type
const content = quizArchetype ? archetypes[quizArchetype as keyof typeof archetypes] : null;
```

The non-null assertions (`!`) on lines 216-229 are a separate but related concern — if any DOM element ID is mistyped, the error will be a cryptic `null.style` TypeError at runtime rather than a compile-time error.

**Recommendation:** For DOM element lookups, consider a helper function that throws a descriptive error: `function getEl<T extends HTMLElement>(id: string): T { const el = document.getElementById(id); if (!el) throw new Error(\`Element #\${id} not found\`); return el as T; }`. For `FormData.get()`, add null checks before using the values. For the archetypes lookup on line 394, import `toUrlSlug` and use the typed function path (which also fixes ARCH-02).

---

### ARCH-09: Share button SVG icons inlined in two files with no shared component (Medium)

**Description:** The X (Twitter), Facebook, and link copy SVG icons are copy-pasted identically in quiz.astro (lines 170-181) and [archetype].astro (lines 74-91). The share button styling classes are also duplicated. This is a classic DRY violation that will cause inconsistency if one file's buttons are updated but not the other.

**Evidence:** The X logo SVG path `M18.244 2.25h3.308l-7.227...` appears character-for-character identical in both files. The Facebook SVG path and link icon SVG are similarly duplicated.

**Recommendation:** Create a `src/components/ShareButtons.astro` component that accepts `shareUrl`, `shareText`, and an optional `archetype` prop. Both quiz.astro and [archetype].astro would use this component. The client-side copy-link behavior can be a small inline script within the component.

---

### ARCH-10: Result pages are correctly independent from quiz flow (Info)

**Description:** This is a positive finding. The [archetype].astro result pages are fully self-contained: they derive all content from `getStaticPaths()` props and the archetype-content module, include a CTA to take the quiz, and do not depend on session state, URL parameters, or the quiz submission flow. A user arriving from a shared link sees the full archetype result and can take the quiz themselves. This is the correct architectural choice for shareable content.

---

## Analysis Questions — Responses

**1. Does Layout.astro's new Props interface maintain backwards compatibility?**

Yes. The three new props (`canonicalURL`, `ogImage`, `ogType`) are all optional with sensible defaults. All 7 pages that consume Layout were checked: 5 pass only `title` + `description` (backwards compatible), 1 passes `canonicalURL` (blog slug, pre-existing), and 1 passes `ogImage` (result page, new). No breaking changes.

**2. Is the siteUrl hardcoded in Layout.astro consistent with astro.config.mjs's site field? Should it be derived from Astro.site instead?**

The value is consistent (`https://www.thehermeticflight.com`), but it should be derived from `Astro.site`. See ARCH-01. The hardcoding is additionally inconsistent with blog/[...slug].astro which uses the bare domain without `www`. See ARCH-07.

**3. Does the [archetype].astro result page follow the same design patterns as other pages?**

Yes. It uses the glass-panel pattern with corner decorations (the `absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold` motif), the Hermetic gold/gray color palette, Cinzel serif headings, Lato sans-serif body text, and the `btn-flame` CTA class. The inline header matches the quiz page's minimal header pattern rather than the full Header.astro component used by blog/faq/homepage — this is a deliberate design choice for the quiz flow.

**4. Is quiz.astro's script block growing too large?**

Yes. At 251 lines it exceeds a reasonable threshold. See ARCH-04.

**5. Is the slug conversion logic duplicated?**

Yes. See ARCH-02. quiz.astro line 392 re-implements `toUrlSlug()` inline.

**6. Does the Playwright test file follow a sustainable pattern?**

No. It is a one-off script with a custom runner. See ARCH-03.

**7. Are the OG image paths hardcoded or derived?**

The image *file names* follow a convention that matches the URL slugs (e.g., `air-weaver.png`), and the result page constructs the path using `toUrlSlug()`: `` ogImage={`/images/og/${urlSlug}.png`} ``. This is a derived path. The default image (`/images/og/default.png`) is a hardcoded fallback in Layout.astro. The naming convention is consistent across all 7 files in `public/images/og/`. The images are 1200x630px PNGs at ~3.6KB each — correctly sized for OG but suspiciously small (likely placeholder gradients, not final artwork). No source-of-truth issue here.

**8. Is there unnecessary coupling between the result page and quiz flow?**

No. See ARCH-10. Result pages are fully independent.

**9. Does the elementColors mapping duplicate data?**

Yes. See ARCH-05. The hex-to-element mapping should be centralized in archetype-content.ts.

**10. Are there TypeScript type safety gaps?**

Yes. See ARCH-08. Multiple `as` casts and non-null assertions in quiz.astro could hide runtime bugs.

---

## Recommendations Summary (priority order)

1. **ARCH-01 (High):** Derive `siteUrl` from `Astro.site` in Layout.astro. Fix blog canonical URL to use `www`. Use `window.location.origin` for client-side share URLs.
2. **ARCH-02 (High):** Import `toUrlSlug` in quiz.astro's script block instead of re-implementing inline.
3. **ARCH-03 (High):** Migrate Playwright tests to `@playwright/test` with a config file and an `"e2e"` npm script. Or at minimum, document the manual process and add a CI step.
4. **ARCH-04 (Medium):** Extract share CTA logic into `src/lib/share-utils.ts`.
5. **ARCH-05 (Medium):** Move `elementColors` hex values into `archetype-content.ts` as an `accentHex` field.
6. **ARCH-09 (Medium):** Extract shared SVG share buttons into `src/components/ShareButtons.astro`.
7. **ARCH-07 (Medium):** Fix blog canonical URL to use `www` (can piggyback on ARCH-01 fix).
8. **ARCH-08 (Medium):** Add null-safe DOM helpers and reduce `as` casts in quiz.astro.
9. **ARCH-06 (Medium):** Acceptable as-is if ARCH-03 is resolved; otherwise add build-output integration test.
