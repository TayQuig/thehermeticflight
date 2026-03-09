# Verification Playbook — hardening-2026-03-08

## Prerequisites
- Node.js 18+, npm
- Working checkout of `feature/native-quiz-pipeline` at HEAD
- `npm install` completed

## Per-Finding Checks

### F-01: Blog canonical URL uses www
**Command:**
```bash
grep 'thehermeticflight.com' src/pages/blog/\[...slug\].astro | grep -v 'www\.'
```
**Expected:** Zero output (no bare domain without www)

### F-02: OG meta test validates actual Layout.astro
**Command:**
```bash
npx vitest run tests/hardening-high.test.ts --reporter=verbose 2>&1 | grep "F-02"
```
**Expected:** All F-02 tests pass. No `tests/og-meta.test.ts` file exists.

### F-03: Quiz share CTA journey tests exist
**Command:**
```bash
npx vitest run tests/hardening-high.test.ts --reporter=verbose 2>&1 | grep "F-03"
```
**Expected:** All F-03 tests pass (share URL construction, result page share contracts, slug roundtrips).

### F-04: Clipboard calls have try/catch
**Command:**
```bash
grep -A5 'clipboard.writeText' src/pages/quiz.astro src/pages/quiz/result/\[archetype\].astro
```
**Expected:** Every `clipboard.writeText` appears inside a `try {` block with a `catch` providing user feedback.

### F-05: siteUrl derived from Astro.site
**Command:**
```bash
grep 'siteUrl' src/layouts/Layout.astro | head -2
```
**Expected:** First line references `Astro.site?.origin`. Fallback on second line only.

### F-06: No duplicated slug conversion
**Command:**
```bash
grep -n 'replace(/_/g' src/pages/quiz.astro
```
**Expected:** Zero matches. `toUrlSlug` is imported and used instead.

### F-07: OG images exist
**Command:**
```bash
ls -la public/images/og/*.png | wc -l
```
**Expected:** 7 files (default + 6 archetypes)

### F-08: Sitemap includes result pages
**Command:**
```bash
npm run build 2>/dev/null && grep 'quiz/result' dist/client/sitemap-0.xml | wc -l
```
**Expected:** 6 result page URLs in sitemap

### F-09: elementColors centralized in archetype-content.ts
**Command:**
```bash
grep 'accentHex' src/lib/archetype-content.ts | wc -l && grep 'elementColors' src/pages/quiz/result/\[archetype\].astro | wc -l
```
**Expected:** 7+ accentHex references in archetype-content.ts, 0 elementColors references in [archetype].astro

## Aggregate Check
```bash
npx vitest run 2>&1 | tail -5
```
**Expected:** 7 test files, 341 tests passed, 0 failed.
