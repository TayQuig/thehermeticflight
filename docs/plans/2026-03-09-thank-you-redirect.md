# Thank-you → Result Page Redirect Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redirect quiz completers from the thank-you page to their archetype result page, ensuring every user reaches the viral loop (share buttons + OG tags).

**Architecture:** Pass archetype slug as query parameter from quiz submission flow → thank-you page reads param and renders prominent CTA to `/quiz/result/[archetype]`. Fallback: generic messaging when no archetype param present.

**Tech Stack:** Astro 5 SSG, Vitest, Playwright

---

## Context

The quiz currently shows share buttons inline after email submission (`#email-success` section in `quiz.astro`). The `thank-you.astro` page exists as a standalone landing page but is stale — it shows a "COMING SOON" revelation date, no archetype info, and no link to the result page where the viral loop lives.

Two fixes are needed:
1. **`quiz.astro`** — Add a "View Your Full Archetype Profile" link inside `#email-success`, pointing to `/quiz/result/[archetype]`.
2. **`thank-you.astro`** — Accept `?archetype=` query param. If present, show the archetype name and a prominent link to the result page. If absent, show a generic CTA back to `/quiz`.

The thank-you page is a contingency — users who land there directly (e.g., old bookmarks, edge-case redirects) should not hit a dead end.

---

## Task 1: Add "View Full Profile" CTA to quiz.astro

**File:** `src/pages/quiz.astro`

**What:** Inside `#email-success` (line 157), after the share buttons div (`#share-section`), replace the existing "Return Home" button with two CTAs: "View Your Archetype Profile" (primary) and "Return Home" (secondary). The profile link is built from `quizArchetype` using `toUrlSlug`.

**TDD Step 1 — Write failing test.**
Add to `tests/thank-you-redirect.test.ts` (new file — see Task 3):
```
// Assertion that will be verified via E2E in Task 3 Step 1
// Unit scope: confirm toUrlSlug produces the expected href format
```
The unit-level assertion (Task 3) must be written and failing before this code lands.

**TDD Step 2 — Verify the test fails.**
```bash
npx vitest run tests/thank-you-redirect.test.ts
```
Expected: test file not found or assertions fail because `#result-profile-link` does not exist in the DOM.

**TDD Step 3 — Implement.**

Locate the "Return Home" anchor at line 186 of `src/pages/quiz.astro`:
```html
<a href="/" class="btn-flame inline-block mt-6 px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
  Return Home
</a>
```

Replace it with:
```html
<!-- Primary CTA: archetype profile (href populated by JS below) -->
<a id="result-profile-link" href="/quiz"
  class="btn-flame inline-block mt-6 px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
  View Your Archetype Profile
</a>

<!-- Secondary: return home -->
<a href="/"
  class="block mt-3 text-hermetic-gold/50 hover:text-hermetic-gold text-xs font-sans tracking-widest uppercase transition-colors">
  Return Home
</a>
```

Then, in the `if (res.ok)` block of the `emailForm` submit handler (around line 388), after the share link population block (after line 430), add:

```typescript
// Point "View Your Archetype Profile" at the correct result page
const profileLink = document.getElementById('result-profile-link') as HTMLAnchorElement;
if (profileLink && urlSlug) {
  profileLink.href = `/quiz/result/${urlSlug}`;
}
```

`urlSlug` is already computed on line 393: `const urlSlug = quizArchetype ? toUrlSlug(quizArchetype as ArchetypeSlug) : '';`

**TDD Step 4 — Verify tests pass.**
```bash
npx vitest run tests/thank-you-redirect.test.ts
```

**TDD Step 5 — Commit.**
```bash
git add src/pages/quiz.astro
git commit -m "feat: add archetype profile CTA to quiz email-success section"
```

---

## Task 2: Update thank-you.astro to accept archetype query param

**File:** `src/pages/thank-you.astro`

**What:** Read `Astro.url.searchParams.get('archetype')` at build time — but since this is SSG, the param must be read client-side via `window.location.search`. The page renders two conditional content blocks: one for when an archetype param is present (JS shows it), one fallback (default visible).

**TDD Step 1 — Write failing test.**
The unit tests in Task 3 cover the JS logic. The E2E tests navigate to `/thank-you?archetype=air-weaver` and assert the link is present. Write Task 3 first; these tests will fail until this task is implemented.

**TDD Step 2 — Verify the test fails.**
```bash
npx tsx tests/thank-you-redirect.spec.ts
```
Expected: assertion that `#archetype-result-link` exists on `/thank-you?archetype=air-weaver` will fail.

**TDD Step 3 — Implement.**

Replace the full contents of `src/pages/thank-you.astro` with:

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout
  title="Thank You | The Hermetic Flight"
  description="You are confirmed. Await the prophecy."
>
  <script is:inline slot="head">
    fbq('track', 'Lead');
  </script>
  <main class="w-full h-screen flex items-center justify-center relative z-10 animate-rise p-6">

    <!-- Content Card -->
    <div class="glass-panel p-8 md:p-12 rounded-lg relative max-w-[600px] w-full border-hermetic-gold/30">

      <!-- Decorative Corners -->
      <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
      <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
      <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
      <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

      <div class="text-center space-y-6">
        <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white uppercase tracking-widest border-b border-hermetic-gold/30 pb-4 inline-block">
          The Path is Revealed
        </h2>

        <p class="font-sans text-lg text-gray-300 font-light leading-relaxed">
          Thank you for completing the quiz. As an initiate, you have secured an exclusive <span class="text-hermetic-sulfur font-normal">tarot reading with the first 5 cards</span>.
        </p>

        <!-- Archetype CTA — shown when ?archetype= param is present -->
        <div id="archetype-cta" class="hidden py-6 relative group">
          <div class="absolute inset-0 bg-hermetic-emerald/50 rounded-lg blur opacity-50 group-hover:opacity-75 transition duration-500"></div>
          <div class="relative border border-hermetic-gold/50 rounded-lg p-6 bg-hermetic-void">
            <p class="font-serif text-hermetic-gold text-sm tracking-widest uppercase mb-2">Your Archetype</p>
            <p id="archetype-name" class="font-serif text-2xl text-white font-bold tracking-wider mb-4"></p>
            <a id="archetype-result-link" href="/quiz/result/"
              class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
              View Your Full Profile
            </a>
          </div>
        </div>

        <!-- Fallback — shown when no archetype param -->
        <div id="fallback-cta" class="py-6 relative group">
          <div class="absolute inset-0 bg-hermetic-emerald/50 rounded-lg blur opacity-50 group-hover:opacity-75 transition duration-500"></div>
          <div class="relative border border-hermetic-gold/50 rounded-lg p-6 bg-hermetic-void">
            <p class="font-serif text-hermetic-gold text-sm tracking-widest uppercase mb-2">Discover Your Archetype</p>
            <p class="font-serif text-xl text-white tracking-wider mb-4">Six paths await. Which is yours?</p>
            <a href="/quiz"
              class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
              Take the Quiz
            </a>
          </div>
        </div>

        <p class="font-sans text-gray-300 font-light">
          You also have early access to the Kickstarter to secure one of the <span class="text-hermetic-sulfur">first 333 decks</span>.
        </p>

        <!-- Beta Access Badge -->
        <div class="bg-hermetic-forest/30 border-l-2 border-hermetic-sulfur p-4 text-left mx-auto max-w-sm">
          <p class="text-sm font-sans text-gray-300">
            <span class="text-hermetic-sulfur font-bold uppercase text-xs block mb-1">Status Update</span>
            Beta access privileges granted. Your feedback will help shape the final artifact.
          </p>
        </div>
      </div>

      <!-- Footer Section -->
      <div class="mt-10 pt-6 border-t border-hermetic-gold/20 text-center space-y-6">
        <p class="text-gray-400 text-sm font-sans">
          Await further transmission from<br>
          <a href="mailto:contact@thehermeticflight.com" class="text-hermetic-gold hover:text-hermetic-sulfur transition-colors">contact@thehermeticflight.com</a>
        </p>

        <a href="/"
          class="btn-flame inline-block text-white font-sans font-bold text-sm tracking-widest uppercase px-10 py-4 no-underline">
          Return Home
        </a>
      </div>
    </div>
  </main>

  <script is:inline>
    (function () {
      const VALID_SLUGS = [
        'air-weaver',
        'embodied-intuitive',
        'ascending-seeker',
        'shadow-dancer',
        'flow-artist',
        'grounded-mystic',
      ];

      const ARCHETYPE_NAMES = {
        'air-weaver': 'The Air Weaver',
        'embodied-intuitive': 'The Embodied Intuitive',
        'ascending-seeker': 'The Ascending Seeker',
        'shadow-dancer': 'The Shadow Dancer',
        'flow-artist': 'The Flow Artist',
        'grounded-mystic': 'The Grounded Mystic',
      };

      const params = new URLSearchParams(window.location.search);
      const slug = params.get('archetype');

      if (slug && VALID_SLUGS.includes(slug)) {
        const archetypeCta = document.getElementById('archetype-cta');
        const fallbackCta = document.getElementById('fallback-cta');
        const archetypeName = document.getElementById('archetype-name');
        const resultLink = document.getElementById('archetype-result-link');

        if (archetypeCta) archetypeCta.classList.remove('hidden');
        if (fallbackCta) fallbackCta.classList.add('hidden');
        if (archetypeName) archetypeName.textContent = ARCHETYPE_NAMES[slug] || slug;
        if (resultLink) resultLink.href = '/quiz/result/' + slug;
      }
    })();
  </script>
</Layout>
```

Key decisions:
- `is:inline` script runs synchronously after DOM parses — no flash of wrong content.
- `VALID_SLUGS` whitelist prevents arbitrary slug injection into the href.
- `ARCHETYPE_NAMES` map converts URL slug to display name without importing TypeScript modules in an inline script.
- Fallback CTA is visible by default; archetype CTA is `hidden`. JS swaps them if a valid slug is present.
- Facebook Pixel `fbq('track', 'Lead')` stays in `<head>` slot, unchanged.

**TDD Step 4 — Verify tests pass.**
```bash
npx tsx tests/thank-you-redirect.spec.ts
```

**TDD Step 5 — Commit.**
```bash
git add src/pages/thank-you.astro
git commit -m "feat: update thank-you page to link to archetype result when slug param present"
```

---

## Task 3: Write tests

Two test files: one Vitest unit test for the slug validation and name-mapping logic, one Playwright E2E test for the end-to-end page behavior.

### 3A: Vitest unit test — `tests/thank-you-redirect.test.ts`

Write this file FIRST, before implementing Tasks 1 and 2, so tests are provably failing at authorship time.

```typescript
/**
 * Thank-you redirect — unit tests.
 *
 * Tests the slug validation and name-mapping logic extracted from
 * thank-you.astro's inline script, and confirms toUrlSlug produces
 * the correct href format for the quiz.astro profile link.
 *
 * Frozen-test-file protocol: do NOT modify this file during implementation.
 */

import { describe, it, expect } from 'vitest';
import { toUrlSlug, archetypeByUrlSlug } from '../src/lib/archetype-content';
import type { ArchetypeSlug } from '../src/lib/classifier';

const VALID_SLUGS = [
  'air-weaver',
  'embodied-intuitive',
  'ascending-seeker',
  'shadow-dancer',
  'flow-artist',
  'grounded-mystic',
] as const;

const ARCHETYPE_NAMES: Record<string, string> = {
  'air-weaver': 'The Air Weaver',
  'embodied-intuitive': 'The Embodied Intuitive',
  'ascending-seeker': 'The Ascending Seeker',
  'shadow-dancer': 'The Shadow Dancer',
  'flow-artist': 'The Flow Artist',
  'grounded-mystic': 'The Grounded Mystic',
};

describe('thank-you archetype slug handling', () => {
  it('toUrlSlug converts all ArchetypeSlugs to valid URL slugs in VALID_SLUGS', () => {
    const internalSlugs: ArchetypeSlug[] = [
      'air_weaver',
      'embodied_intuitive',
      'ascending_seeker',
      'shadow_dancer',
      'flow_artist',
      'grounded_mystic',
    ];
    for (const slug of internalSlugs) {
      const urlSlug = toUrlSlug(slug);
      expect(VALID_SLUGS).toContain(urlSlug);
    }
  });

  it('ARCHETYPE_NAMES covers all VALID_SLUGS', () => {
    for (const slug of VALID_SLUGS) {
      expect(ARCHETYPE_NAMES[slug]).toBeDefined();
      expect(ARCHETYPE_NAMES[slug]).toMatch(/^The /);
    }
  });

  it('archetypeByUrlSlug round-trips all VALID_SLUGS', () => {
    for (const urlSlug of VALID_SLUGS) {
      const content = archetypeByUrlSlug(urlSlug);
      expect(content).toBeDefined();
      expect(content!.name).toBeTruthy();
      // Confirm the display name matches ARCHETYPE_NAMES
      expect(ARCHETYPE_NAMES[urlSlug]).toBe(content!.title);
    }
  });

  it('invalid slugs are not in VALID_SLUGS', () => {
    const bogus = ['javascript:alert(1)', '../admin', 'unknown-archetype', ''];
    for (const slug of bogus) {
      expect(VALID_SLUGS).not.toContain(slug);
    }
  });

  it('result page href is constructed correctly from url slug', () => {
    const slug: ArchetypeSlug = 'air_weaver';
    const urlSlug = toUrlSlug(slug);
    const href = `/quiz/result/${urlSlug}`;
    expect(href).toBe('/quiz/result/air-weaver');
  });
});
```

Run to confirm failure before implementation:
```bash
npx vitest run tests/thank-you-redirect.test.ts
```
Expected at this point: the file runs but `archetypeByUrlSlug` name-match assertions may fail if `ARCHETYPE_NAMES` map is not yet aligned (or all pass because they test `archetype-content.ts` directly — that is fine; the E2E spec below will fail until Task 2 is done).

### 3B: Playwright E2E test — `tests/thank-you-redirect.spec.ts`

```typescript
/**
 * Thank-you redirect — Playwright E2E tests.
 *
 * Usage:
 *   1. npm run build && npm run preview &
 *   2. npx tsx tests/thank-you-redirect.spec.ts
 *
 * Uses raw playwright (not @playwright/test) matching existing project pattern.
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:4321';
let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(name: string) {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function fail(name: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  failures.push(`${name}: ${msg}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}: ${msg}`);
}

// ---------------------------------------------------------------------------
// Test: thank-you with valid archetype param shows result link, hides fallback
// ---------------------------------------------------------------------------
async function testThankYouWithArchetypeParam() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/thank-you?archetype=air-weaver`);

    // Archetype CTA is visible
    const archetypeCta = await page.$('#archetype-cta');
    if (!archetypeCta) throw new Error('#archetype-cta element not found');
    const ctaVisible = await archetypeCta.isVisible();
    if (!ctaVisible) throw new Error('#archetype-cta is hidden, expected visible');

    // Fallback CTA is hidden
    const fallbackCta = await page.$('#fallback-cta');
    if (!fallbackCta) throw new Error('#fallback-cta element not found');
    const fallbackVisible = await fallbackCta.isVisible();
    if (fallbackVisible) throw new Error('#fallback-cta is visible, expected hidden');

    // Result link points to correct URL
    const resultLink = await page.$('#archetype-result-link');
    if (!resultLink) throw new Error('#archetype-result-link not found');
    const href = await resultLink.getAttribute('href');
    if (href !== '/quiz/result/air-weaver') {
      throw new Error(`Expected href /quiz/result/air-weaver, got: ${href}`);
    }

    // Archetype name is rendered
    const nameEl = await page.$('#archetype-name');
    if (!nameEl) throw new Error('#archetype-name element not found');
    const nameText = await nameEl.textContent();
    if (!nameText?.includes('Air Weaver')) {
      throw new Error(`Expected archetype name to contain "Air Weaver", got: ${nameText}`);
    }

    pass('testThankYouWithArchetypeParam');
  } catch (err) {
    fail('testThankYouWithArchetypeParam', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: thank-you without archetype param shows fallback, hides archetype CTA
// ---------------------------------------------------------------------------
async function testThankYouWithoutArchetypeParam() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/thank-you`);

    // Archetype CTA is hidden
    const archetypeCta = await page.$('#archetype-cta');
    if (!archetypeCta) throw new Error('#archetype-cta element not found');
    const ctaVisible = await archetypeCta.isVisible();
    if (ctaVisible) throw new Error('#archetype-cta is visible, expected hidden');

    // Fallback CTA is visible
    const fallbackCta = await page.$('#fallback-cta');
    if (!fallbackCta) throw new Error('#fallback-cta element not found');
    const fallbackVisible = await fallbackCta.isVisible();
    if (!fallbackVisible) throw new Error('#fallback-cta is hidden, expected visible');

    // Fallback links to /quiz
    const quizLink = await page.$('#fallback-cta a[href="/quiz"]');
    if (!quizLink) throw new Error('Fallback /quiz link not found inside #fallback-cta');

    pass('testThankYouWithoutArchetypeParam');
  } catch (err) {
    fail('testThankYouWithoutArchetypeParam', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: invalid archetype slug falls back to fallback CTA (whitelist enforced)
// ---------------------------------------------------------------------------
async function testThankYouWithInvalidSlug() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/thank-you?archetype=not-a-real-archetype`);

    // Archetype CTA stays hidden — invalid slug should not trigger it
    const archetypeCta = await page.$('#archetype-cta');
    if (!archetypeCta) throw new Error('#archetype-cta element not found');
    const ctaVisible = await archetypeCta.isVisible();
    if (ctaVisible) throw new Error('#archetype-cta is visible for invalid slug, expected hidden');

    // Fallback remains visible
    const fallbackCta = await page.$('#fallback-cta');
    if (!fallbackCta) throw new Error('#fallback-cta element not found');
    const fallbackVisible = await fallbackCta.isVisible();
    if (!fallbackVisible) throw new Error('#fallback-cta hidden for invalid slug, expected visible');

    pass('testThankYouWithInvalidSlug');
  } catch (err) {
    fail('testThankYouWithInvalidSlug', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: quiz.astro email-success section contains profile link element
// ---------------------------------------------------------------------------
async function testQuizProfileLinkPresent() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz`);

    // The #result-profile-link anchor exists in the DOM (inside #email-success, initially hidden)
    const profileLink = await page.$('#result-profile-link');
    if (!profileLink) throw new Error('#result-profile-link not found in quiz page DOM');

    // Its default href points to /quiz (will be updated by JS after submission)
    const defaultHref = await profileLink.getAttribute('href');
    if (defaultHref !== '/quiz') {
      throw new Error(`Expected default href /quiz, got: ${defaultHref}`);
    }

    pass('testQuizProfileLinkPresent');
  } catch (err) {
    fail('testQuizProfileLinkPresent', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log('\nThank-you redirect — E2E Tests');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}\n`);

  await testThankYouWithArchetypeParam();
  await testThankYouWithoutArchetypeParam();
  await testThankYouWithInvalidSlug();
  await testQuizProfileLinkPresent();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Runner error:', err);
  process.exit(1);
});
```

**Run commands:**

Unit tests:
```bash
npx vitest run tests/thank-you-redirect.test.ts
```

E2E tests (requires built preview server):
```bash
npm run build && npm run preview &
sleep 3
npx tsx tests/thank-you-redirect.spec.ts
```

**TDD Step 5 — Commit.**
```bash
git add tests/thank-you-redirect.test.ts tests/thank-you-redirect.spec.ts
git commit -m "test: add thank-you redirect unit and E2E tests (frozen)"
```

---

## Task 4: Frozen Test File Verification

**Step 1: Record test baseline**

No `record-baseline.sh` exists in this project. Run manually:
```bash
cp tests/thank-you-redirect.test.ts tests/thank-you-redirect.test.ts.frozen
cp tests/thank-you-redirect.spec.ts tests/thank-you-redirect.spec.ts.frozen
```

**Step 2: Verify all tests pass**
```bash
npx vitest run tests/thank-you-redirect.test.ts
npm run build && npm run preview &
sleep 3
npx tsx tests/thank-you-redirect.spec.ts
```
Expected: 5 unit test assertions pass, 4 E2E tests pass.

Also confirm existing tests are not broken:
```bash
npx vitest run
npx tsx tests/quiz-flow.spec.ts
```

**Step 3: Verify frozen test integrity**

No `verify-frozen.sh` exists. Run manually:
```bash
diff tests/thank-you-redirect.test.ts tests/thank-you-redirect.test.ts.frozen
diff tests/thank-you-redirect.spec.ts tests/thank-you-redirect.spec.ts.frozen
```
Expected: no differences — implementation agent did NOT modify the test files.

**Step 4: Clean up frozen copies**
```bash
rm tests/thank-you-redirect.test.ts.frozen tests/thank-you-redirect.spec.ts.frozen
```

**Step 5: Final commit**
```bash
git add src/pages/quiz.astro src/pages/thank-you.astro tests/thank-you-redirect.test.ts tests/thank-you-redirect.spec.ts
git commit -m "feat: thank-you → result page redirect (Sprint 1A complete)"
```

---

## Implementation Order Summary

1. Write `tests/thank-you-redirect.test.ts` and `tests/thank-you-redirect.spec.ts` → verify failing
2. Implement `src/pages/thank-you.astro` (Task 2)
3. Implement the profile link addition in `src/pages/quiz.astro` (Task 1)
4. Verify all tests pass
5. Frozen file integrity check
6. Final commit

---

> **Sprint Integration Note:** This feature is part of Sprint 1. After Sprint 1 integration (all 3 tracks merged), run `evaluation-protocol` across the integrated result, then `harden` if findings warrant remediation.
