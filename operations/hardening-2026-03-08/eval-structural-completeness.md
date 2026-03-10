# Structural Completeness Evaluation — Share CTA & OG Meta Tags

**Evaluator Lens:** Functional Correctness
**Date:** 2026-03-08
**Scope:** OG meta infrastructure, 6 archetype result pages, share CTA, GA4 tracking, OG images

---

## Executive Summary

The Share CTA & OG Meta Tags implementation is functionally sound across its core paths. All 6 archetype result pages generate correctly via `getStaticPaths`, all share URLs are well-formed, and the OG tag infrastructure in `Layout.astro` produces correct absolute image URLs and consistent `www`-prefixed canonicals for all pages except blog posts. Three findings were identified: one high-severity canonical URL inconsistency in blog posts, one medium-severity missing error handling on the clipboard API, and one medium-severity concern about the OG meta test suite not testing the actual Layout.astro rendering logic.

---

## Analysis Responses

### 1. Do ALL pages rendered through Layout.astro receive correct OG tags?

**Yes, with one partial gap.** Seven page files use `Layout.astro`:

| Page | title | description | ogImage | ogType |
|------|-------|-------------|---------|--------|
| `index.astro` | Explicit | Explicit | Default (fallback) | Default (`website`) |
| `quiz.astro` | Explicit | Explicit | Default (fallback) | Default (`website`) |
| `quiz/result/[archetype].astro` | Dynamic | Dynamic | Per-archetype | Default (`website`) |
| `blog.astro` | Explicit | Explicit | Default (fallback) | Default (`website`) |
| `blog/[...slug].astro` | Dynamic | Dynamic | Default (fallback) | Default (`website`) |
| `thank-you.astro` | Explicit | Explicit | Default (fallback) | Default (`website`) |
| `faq.astro` | Explicit | Explicit | Default (fallback) | Default (`website`) |

All pages pass both `title` and `description`, so no page will render broken/empty OG tags. Blog posts do not pass `ogImage`, so they fall back to `default.png` -- this is acceptable behavior.

### 2. Do all 6 archetype result pages generate correctly via getStaticPaths?

**Yes.** The chain is complete and lossless:

1. `classifier.ts` exports `ArchetypeSlug` (6 literal union members)
2. `archetype-content.ts` exports `archetypes` keyed by `ArchetypeSlug` (6 entries)
3. `[archetype].astro` calls `Object.keys(archetypes) as ArchetypeSlug[]` and maps each through `toUrlSlug()` to produce params
4. `toUrlSlug()` simply replaces `_` with `-`

Result: 6 pages generated at `/quiz/result/air-weaver`, `/quiz/result/embodied-intuitive`, `/quiz/result/ascending-seeker`, `/quiz/result/shadow-dancer`, `/quiz/result/flow-artist`, `/quiz/result/grounded-mystic`.

### 3. Are share URLs correctly constructed for all 6 archetypes?

**Yes.** Both code paths produce identical URLs:

- **Static result pages** (`[archetype].astro` line 69): Template literal builds `https://www.thehermeticflight.com/quiz/result/${urlSlug}` where `urlSlug = toUrlSlug(archetype.slug)`. Values are `encodeURIComponent`-wrapped in the X and Facebook share hrefs.
- **Dynamic quiz.astro** (line 392-393): `quizArchetype.replace(/_/g, '-')` produces the same slug transformation as `toUrlSlug`. The resulting `shareUrl` is then `encodeURIComponent`-wrapped for both X and Facebook share links.

All 6 archetypes produce slugs containing only lowercase letters and hyphens, which require no percent-encoding.

### 4. Is the canonical URL consistently using `www` across all pages?

**No.** This is the most significant finding. `Layout.astro` line 11 defines `siteUrl = 'https://www.thehermeticflight.com'` and all pages that rely on the default canonical (most pages) get the `www` prefix correctly. However, `blog/[...slug].astro` line 21 constructs its own canonical:

```typescript
const canonicalURL = new URL(post.slug, 'https://thehermeticflight.com/blog/').toString();
```

This produces `https://thehermeticflight.com/blog/...` (no `www`), which conflicts with the `www`-prefixed canonical used everywhere else. See finding SC-01.

### 5. Do OG images resolve to valid absolute URLs?

**Yes.** The resolution logic in `Layout.astro` lines 14-16 is correct:

```typescript
const resolvedOgImage = ogImage
  ? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`)
  : `${siteUrl}/images/og/default.png`;
```

- If `ogImage` is provided and starts with `http`, it passes through unchanged (handles external CDN URLs).
- If `ogImage` is provided as a relative path (e.g., `/images/og/air-weaver.png`), it prepends `siteUrl`.
- If `ogImage` is omitted, it falls back to `default.png` with the full absolute URL.

All 7 OG images exist on disk at `public/images/og/` and are valid 1200x630 PNGs (the recommended OG image size). Edge case: if someone passed an ogImage without a leading `/` (e.g., `images/og/foo.png`), the URL would be malformed (`https://www.thehermeticflight.comimages/og/foo.png`). However, no current page exercises this path, so it is a theoretical concern only.

### 6. Does the share CTA on quiz.astro correctly populate links only after email submission succeeds?

**Yes.** The share section HTML is inside `#email-success` which has `class="hidden"` (line 157). It only becomes visible at line 389 inside the `if (res.ok)` branch after a successful API response. The share link `href` attributes are populated at lines 404-405 only within this same success branch. Before submission, the share links have `href="#"` which is inert but harmless since the entire section is hidden.

### 7. Are there any archetype slugs that would produce invalid URL paths?

**No.** All 6 `ArchetypeSlug` values contain only lowercase ASCII letters and underscores. `toUrlSlug` converts underscores to hyphens. The resulting URL slugs (`air-weaver`, `embodied-intuitive`, `ascending-seeker`, `shadow-dancer`, `flow-artist`, `grounded-mystic`) are all valid URL path segments requiring no encoding.

### 8. Does the copy-link button work correctly?

**Partially.** Both implementations use `navigator.clipboard.writeText()`:

- **Result page** (`[archetype].astro` line 114): Uses `window.location.href` -- correct, gives the actual page URL.
- **Quiz page** (`quiz.astro` line 408): Uses the constructed `shareUrl` variable -- correct, matches the result page URL.

Both update the button text to "Copied!" and reset after 2 seconds. However, neither implementation handles the case where `navigator.clipboard.writeText()` rejects (e.g., denied permissions, non-HTTPS in dev, unsupported browser). The `await` without a try/catch means an unhandled promise rejection would occur silently. See finding SC-02.

### 9. Is the toUrlSlug/archetypeByUrlSlug round-trip lossless for all 6 archetypes?

**Yes.** The transformations are perfectly symmetric:

- `toUrlSlug`: replaces `_` with `-` globally
- `archetypeByUrlSlug`: replaces `-` with `_` globally, then does a keyed lookup

Since no archetype slug contains hyphens (they only contain lowercase letters and underscores), the round-trip is lossless. The test suite in `archetype-content.test.ts` explicitly verifies all 6 slugs in both directions.

### 10. Are there pages that use Layout.astro but DON'T pass description, causing broken OG tags?

**No.** Every page that uses `Layout.astro` passes an explicit `description` prop. The `description` field is required in the `Props` interface (line 4 of `Layout.astro`), so TypeScript would catch any omission at build time. Verified all 7 page files pass description.

---

## Findings Table

| ID | Title | Severity | Description | Affected File(s) | Evidence |
|----|-------|----------|-------------|-------------------|----------|
| SC-01 | Blog post canonical URL missing `www` prefix | **High** | `blog/[...slug].astro` constructs its canonical URL with `https://thehermeticflight.com/blog/` (no `www`), while every other page uses `https://www.thehermeticflight.com` via Layout.astro's `siteUrl` constant. This creates a split-canonical signal for search engines. The `og:url` will use the Layout-computed canonical (with `www`), but the `<link rel="canonical">` and `og:url` will both use the no-`www` value since it is passed as `canonicalURL` prop, overriding the Layout default. | `src/pages/blog/[...slug].astro` (line 21) | `const canonicalURL = new URL(post.slug, 'https://thehermeticflight.com/blog/').toString();` — missing `www.` prefix |
| SC-02 | Clipboard API calls lack error handling | **Medium** | Both copy-link button implementations use `await navigator.clipboard.writeText()` without try/catch. If the Clipboard API is unavailable (older browsers, non-HTTPS context in dev, or denied permissions), an unhandled promise rejection occurs. The button text would remain "Copy Link" with no user feedback that the operation failed. | `src/pages/quiz.astro` (line 408), `src/pages/quiz/result/[archetype].astro` (line 114) | `await navigator.clipboard.writeText(shareUrl);` — bare await, no catch |
| SC-03 | OG meta test suite tests a reimplemented model, not the actual Layout | **Medium** | `tests/og-meta.test.ts` defines its own `buildOGTags()` function that mirrors Layout.astro's logic, then tests that function. If Layout.astro's logic diverges (e.g., the fallback URL changes), the tests would still pass while the site is broken. The test also does not exercise the canonical URL construction logic (`canonicalURL || siteUrl + currentPath`), missing the `currentPath` fallback entirely — its default uses just `siteUrl` rather than `siteUrl + pathname`. | `tests/og-meta.test.ts` (lines 20-38) | `function buildOGTags(props: OGProps) { ... const url = props.canonicalURL \|\| siteUrl; ... }` — diverges from Layout.astro's `const canonical = canonicalURL \|\| \`${siteUrl}${currentPath}\`;` |

---

## Recommendations

### SC-01: Fix blog canonical URL to use `www` (High Priority)

In `src/pages/blog/[...slug].astro` line 21, change:

```typescript
const canonicalURL = new URL(post.slug, 'https://thehermeticflight.com/blog/').toString();
```

to:

```typescript
const canonicalURL = new URL(post.slug, 'https://www.thehermeticflight.com/blog/').toString();
```

Alternatively, extract the site URL to a shared constant to prevent future drift.

### SC-02: Add try/catch to clipboard operations (Medium Priority)

Wrap both clipboard calls in try/catch with user-visible feedback:

```typescript
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    copyText.textContent = 'Copied!';
    setTimeout(() => { copyText.textContent = 'Copy Link'; }, 2000);
  } catch {
    copyText.textContent = 'Copy failed';
    setTimeout(() => { copyText.textContent = 'Copy Link'; }, 2000);
  }
});
```

### SC-03: Strengthen OG meta tests (Medium Priority)

The current unit test approach (testing a reimplemented model) is acceptable for fast feedback but should be supplemented with build-output validation. The E2E tests in `quiz-flow.spec.ts` partially cover this by checking actual rendered HTML. Consider:

1. Adding a test that reads built HTML files and asserts OG tag presence (build verification).
2. Updating the `buildOGTags` function to match Layout.astro's canonical fallback logic (use `siteUrl + path` instead of just `siteUrl`).

---

## Summary

The implementation is well-structured and functionally correct for the core share flow. The high-severity finding (SC-01) is a real SEO issue that should be fixed before the next deploy. The medium-severity findings are defensive hardening items that reduce risk of silent failures in edge cases.
