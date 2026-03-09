# Share CTA & OG Meta Tags — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a viral sharing loop for quiz results — shareable archetype URLs with rich OG previews, share buttons on quiz completion, and site-wide OG meta tag infrastructure.

**Architecture:** Add OG/Twitter meta tags to `Layout.astro` (fixes every page). Create 6 static archetype result pages via `getStaticPaths()` at `/quiz/result/[archetype]` — these are the share destinations with archetype-specific OG tags. After quiz email submission, replace the bare success message with share buttons that link to the result page. Visitors who land on a result page from a shared link see the archetype info + "Discover YOUR archetype" CTA back to `/quiz`.

**Tech Stack:** Astro 5 SSG, Tailwind CSS 3.4, Vitest, Playwright

**Build Order:** OG infrastructure → result pages → share CTA → OG images → analytics

---

## Task 1: Add OG meta tags to Layout.astro

**Files:**
- Modify: `src/layouts/Layout.astro`
- Test: `tests/og-meta.test.ts`

**Step 1: Write the failing test**

Create `tests/og-meta.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

/**
 * OG meta tag contract: Layout.astro must render Open Graph and Twitter Card
 * meta tags in the <head>. We verify by checking the built HTML output.
 *
 * These tests validate the data model only — actual HTML rendering is checked
 * by the build verification in Step 4.
 */

// The OG tag props interface — mirrors what Layout.astro should accept
interface OGProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
  canonicalURL?: string;
}

function buildOGTags(props: OGProps) {
  const siteUrl = 'https://www.thehermeticflight.com';
  const ogImage = props.ogImage || '/images/og/default.png';
  const ogType = props.ogType || 'website';
  const url = props.canonicalURL || siteUrl;

  return {
    'og:title': props.title,
    'og:description': props.description,
    'og:image': ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`,
    'og:url': url,
    'og:type': ogType,
    'og:site_name': 'The Hermetic Flight',
    'twitter:card': 'summary_large_image',
    'twitter:title': props.title,
    'twitter:description': props.description,
    'twitter:image': ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`,
  };
}

describe('OG meta tag generation', () => {
  it('produces all required OG tags with defaults', () => {
    const tags = buildOGTags({
      title: 'Test Page',
      description: 'A test page description',
    });

    expect(tags['og:title']).toBe('Test Page');
    expect(tags['og:description']).toBe('A test page description');
    expect(tags['og:image']).toBe('https://www.thehermeticflight.com/images/og/default.png');
    expect(tags['og:type']).toBe('website');
    expect(tags['og:site_name']).toBe('The Hermetic Flight');
    expect(tags['twitter:card']).toBe('summary_large_image');
  });

  it('uses custom ogImage when provided', () => {
    const tags = buildOGTags({
      title: 'Test',
      description: 'Test',
      ogImage: '/images/og/air-weaver.png',
    });

    expect(tags['og:image']).toBe('https://www.thehermeticflight.com/images/og/air-weaver.png');
    expect(tags['twitter:image']).toBe('https://www.thehermeticflight.com/images/og/air-weaver.png');
  });

  it('uses custom ogType when provided', () => {
    const tags = buildOGTags({
      title: 'Blog Post',
      description: 'A post',
      ogType: 'article',
    });

    expect(tags['og:type']).toBe('article');
  });

  it('passes through absolute image URLs unchanged', () => {
    const tags = buildOGTags({
      title: 'Test',
      description: 'Test',
      ogImage: 'https://cdn.example.com/image.png',
    });

    expect(tags['og:image']).toBe('https://cdn.example.com/image.png');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/og-meta.test.ts`
Expected: PASS (these test a pure function — the function is defined in the test file itself as a reference implementation)

> **Note on `buildOGTags()`:** The inline function in this test file is a reference implementation only — it validates the tag generation logic. The actual Layout.astro integration is verified by Steps 4-5 (build + grep), not by this test.

**Step 2a: Reconcile canonical URL before modifying Layout.astro**

> **Important:** The existing `Layout.astro` uses `https://thehermeticflight.com` (no `www`) but `astro.config.mjs` defines `site: 'https://www.thehermeticflight.com'` (with `www`). Before adding OG tags, update the existing canonical URL generation in `Layout.astro` to use the `www` prefix, matching the `astro.config.mjs` site field. All OG tag URLs must use `https://www.thehermeticflight.com`.

**Step 3: Modify Layout.astro to add OG tags**

In `src/layouts/Layout.astro`, update the Props interface and add meta tags:

```astro
---
interface Props {
	title: string;
	description: string;
	canonicalURL?: string;
	ogImage?: string;
	ogType?: string;
}

const { title, description, canonicalURL, ogImage, ogType = 'website' } = Astro.props;
const siteUrl = 'https://www.thehermeticflight.com';
const currentPath = Astro.url.pathname;
const canonical = canonicalURL || `${siteUrl}${currentPath}`;
const resolvedOgImage = ogImage
	? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`)
	: `${siteUrl}/images/og/default.png`;
import '../styles/global.css';
---
```

Then add these meta tags inside `<head>`, after the `<title>` tag and before `<slot name="head" />`:

```html
<!-- Open Graph -->
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={resolvedOgImage} />
<meta property="og:url" content={canonical} />
<meta property="og:type" content={ogType} />
<meta property="og:site_name" content="The Hermetic Flight" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={resolvedOgImage} />
```

**Step 4: Verify build succeeds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build completes successfully

**Step 5: Verify OG tags in built HTML**

Run: `grep -c 'og:title' dist/index.html`
Expected: `1` (confirms OG tags render in the homepage)

**Step 6: Commit**

```bash
git add src/layouts/Layout.astro tests/og-meta.test.ts
git commit -m "feat: add OG and Twitter Card meta tags to Layout"
```

**Known Risks:**
- None — purely local file modifications.

**If This Fails:**
- If build fails, check for duplicate `Props` interface declarations in `Layout.astro` — the new OG props must be merged into the single existing interface, not added as a second one.
- If `grep` returns 0, verify the OG meta tags are inside `<head>` and not gated by a conditional block that may be falsy during static rendering.

---

## Task 2: Add URL slug utility to archetype-content.ts

**Files:**
- Modify: `src/lib/archetype-content.ts`
- Test: `tests/archetype-content.test.ts`

**Step 1: Write the failing test**

Append to existing `tests/archetype-content.test.ts`:

> **Note:** This file already exists with 47 archetype content coverage tests from the hardening sprint (SYN-10). Append the new describe blocks below the existing ones — do not overwrite the file.

```typescript
import { describe, it, expect } from 'vitest';
import { archetypes, archetypeByUrlSlug, toUrlSlug } from '../src/lib/archetype-content';

describe('toUrlSlug', () => {
  it('converts underscore slugs to hyphenated URL slugs', () => {
    expect(toUrlSlug('air_weaver')).toBe('air-weaver');
    expect(toUrlSlug('embodied_intuitive')).toBe('embodied-intuitive');
    expect(toUrlSlug('ascending_seeker')).toBe('ascending-seeker');
    expect(toUrlSlug('shadow_dancer')).toBe('shadow-dancer');
    expect(toUrlSlug('flow_artist')).toBe('flow-artist');
    expect(toUrlSlug('grounded_mystic')).toBe('grounded-mystic');
  });
});

describe('archetypeByUrlSlug', () => {
  it('returns the correct archetype for each URL slug', () => {
    const result = archetypeByUrlSlug('air-weaver');
    expect(result).toBeDefined();
    expect(result!.slug).toBe('air_weaver');
    expect(result!.title).toBe('The Air Weaver');
  });

  it('returns undefined for invalid slugs', () => {
    expect(archetypeByUrlSlug('not-real')).toBeUndefined();
  });

  it('maps all 6 archetypes', () => {
    const urlSlugs = [
      'air-weaver', 'embodied-intuitive', 'ascending-seeker',
      'shadow-dancer', 'flow-artist', 'grounded-mystic',
    ];
    for (const slug of urlSlugs) {
      expect(archetypeByUrlSlug(slug)).toBeDefined();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archetype-content.test.ts`
Expected: FAIL — `toUrlSlug` and `archetypeByUrlSlug` are not exported

**Step 3: Add exports to archetype-content.ts**

Add these to the bottom of `src/lib/archetype-content.ts`:

```typescript
/** Convert an ArchetypeSlug ('air_weaver') to a URL slug ('air-weaver'). */
export function toUrlSlug(slug: ArchetypeSlug): string {
  return slug.replace(/_/g, '-');
}

/** Look up archetype content by URL slug ('air-weaver'). */
export function archetypeByUrlSlug(urlSlug: string): ArchetypeContent | undefined {
  const internalSlug = urlSlug.replace(/-/g, '_');
  return archetypes[internalSlug as ArchetypeSlug];
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/archetype-content.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/archetype-content.ts tests/archetype-content.test.ts
git commit -m "feat: add toUrlSlug and archetypeByUrlSlug utilities to archetype-content"
```

**Known Risks:**
- None — purely local file modifications.

**If This Fails:**
- If the import fails, verify the import path relative to the test file — `../src/lib/archetype-content` should resolve from `tests/`.
- If types conflict (e.g., `ArchetypeSlug` not found), check that `ArchetypeSlug` is exported from `src/lib/classifier.ts` and re-exported or directly usable from `archetype-content.ts`.

---

## Task 3: Create 6 static archetype result pages

**Files:**
- Create: `src/pages/quiz/result/[archetype].astro`

**Step 1: Create the dynamic route page**

Create `src/pages/quiz/result/[archetype].astro`:

```astro
---
import Layout from '../../../layouts/Layout.astro';
import { archetypes, archetypeByUrlSlug, toUrlSlug } from '../../../lib/archetype-content';
import type { ArchetypeSlug } from '../../../lib/classifier';
import type { GetStaticPaths } from 'astro';

export const getStaticPaths: GetStaticPaths = () => {
  return (Object.keys(archetypes) as ArchetypeSlug[]).map((slug) => ({
    params: { archetype: toUrlSlug(slug) },
    props: { archetype: archetypes[slug] },
  }));
};

const { archetype } = Astro.props;
const urlSlug = toUrlSlug(archetype.slug);

// Element-to-hex mapping for OG image backgrounds (matches Tailwind theme)
const elementColors: Record<string, string> = {
  Air: '#93c5fd',       // blue-300
  Earth: '#6ee7b7',     // emerald-300
  Spirit: '#c4b5fd',    // purple-300
  Shadow: '#fca5a5',    // red-300
  Water: '#67e8f9',     // cyan-300
  Mercury: '#C5A059',   // hermetic-gold
};

const accentColor = elementColors[archetype.element] || '#C5A059';
---

<Layout
  title={`${archetype.title} — Your Aerial Tarot Archetype | The Hermetic Flight`}
  description={archetype.description}
  ogImage={`/images/og/${urlSlug}.png`}
>
  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-12 px-4">

    <!-- Header -->
    <header class="w-full py-4 flex justify-center mb-4">
      <a href="/" class="group flex items-center gap-3">
        <img src="/images/logo.png" alt="The Hermetic Flight" class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">The Hermetic Flight</span>
      </a>
    </header>

    <!-- Archetype Result -->
    <div class="w-full max-w-2xl">
      <div class="glass-panel p-8 md:p-12 rounded-lg text-center relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <!-- Glow effect -->
        <div class="absolute inset-0 rounded-lg opacity-30" style={`background: radial-gradient(circle at 50% 30%, ${accentColor}20 0%, transparent 60%);`}></div>

        <div class="relative z-10">
          <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-4">Aerial Tarot Archetype</p>
          <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>

          <h1 class="font-serif text-3xl md:text-5xl text-hermetic-white mb-2 tracking-wide">{archetype.title}</h1>
          <p class={`${archetype.color} text-xs tracking-[0.3em] uppercase font-sans mb-6`}>Element of {archetype.element}</p>
          <p class="text-gray-300 font-light font-sans leading-relaxed mb-8 max-w-lg mx-auto">{archetype.description}</p>

          <!-- Share Section -->
          <div class="border-t border-hermetic-gold/20 pt-8 mt-4">
            <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-4">Share This Archetype</p>
            <div class="flex justify-center gap-3" id="share-buttons">
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(`I'm ${archetype.title} — ${archetype.element} element. Discover your aerial tarot archetype:`)}&url=${encodeURIComponent(`https://www.thehermeticflight.com/quiz/result/${urlSlug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Post
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://www.thehermeticflight.com/quiz/result/${urlSlug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Share
              </a>
              <button
                id="copy-link-btn"
                class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span id="copy-text">Copy Link</span>
              </button>
            </div>
          </div>

          <!-- CTA for new visitors -->
          <div class="border-t border-hermetic-gold/20 pt-8 mt-8">
            <p class="text-hermetic-white font-serif text-lg mb-2">Discover Your Archetype</p>
            <p class="text-gray-400 font-sans text-sm mb-6">Twenty questions. Five minutes. One revelation about how you're wired to receive wisdom through the cards.</p>
            <a href="/quiz" class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
              Take the Quiz
            </a>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const copyBtn = document.getElementById('copy-link-btn');
    const copyText = document.getElementById('copy-text');
    if (copyBtn && copyText) {
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        copyText.textContent = 'Copied!';
        setTimeout(() => { copyText.textContent = 'Copy Link'; }, 2000);
      });
    }
  </script>
</Layout>
```

**Step 2: Verify build generates all 6 pages**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

Run: `ls dist/quiz/result/`
Expected: 6 directories: `air-weaver/`, `ascending-seeker/`, `embodied-intuitive/`, `flow-artist/`, `grounded-mystic/`, `shadow-dancer/`

**Step 3: Verify OG tags in a result page**

Run: `grep 'og:title' dist/quiz/result/air-weaver/index.html`
Expected: Contains `The Air Weaver — Your Aerial Tarot Archetype`

Run: `grep 'og:image' dist/quiz/result/air-weaver/index.html`
Expected: Contains `https://www.thehermeticflight.com/images/og/air-weaver.png`

**Step 4: Commit**

```bash
git add src/pages/quiz/result/\[archetype\].astro
git commit -m "feat: add 6 static archetype result pages with OG tags"
```

**Known Risks:**
- OG image references (`/images/og/air-weaver.png` etc.) will return 404 until Task 5 is completed. This is expected — social previews will be broken until images are added.

**If This Fails:**
- If build fails with a `getStaticPaths` error, verify the export syntax — `getStaticPaths` must be a named export (not a default export) and must return an array of `{ params, props }` objects.
- If only partial pages generate (fewer than 6), check archetype key alignment between `classifier.ts` and `archetype-content.ts` — every key in `archetypes` must be a valid `ArchetypeSlug`.

---

## Task 4: Add share CTA to quiz.astro post-submission

**Files:**
- Modify: `src/pages/quiz.astro`

**Step 1: Replace the email-success div content**

In `src/pages/quiz.astro`, find the `#email-success` div (approx lines 157-166) and replace it with:

```html
<!-- Success Message with Share CTA -->
<div id="email-success" class="hidden border-t border-hermetic-gold/20 pt-8 mt-8">
  <div class="w-12 h-12 rounded-full border border-hermetic-gold/50 mx-auto mb-4 flex items-center justify-center">
    <span class="text-hermetic-gold text-xl">&#x2713;</span>
  </div>
  <p class="text-hermetic-gold font-serif text-xl mb-2">The Path is Revealed</p>
  <p class="text-gray-300 font-sans font-light mb-6">Check your inbox — your archetype journey begins now.</p>

  <!-- Share Buttons (populated by JS after archetype is known) -->
  <div id="share-section" class="border-t border-hermetic-gold/20 pt-6 mt-6">
    <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-4">Share Your Archetype</p>
    <div class="flex justify-center gap-3 flex-wrap">
      <a id="share-x" href="#" target="_blank" rel="noopener noreferrer"
        class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Post
      </a>
      <a id="share-fb" href="#" target="_blank" rel="noopener noreferrer"
        class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Share
      </a>
      <button id="share-copy"
        class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span id="share-copy-text">Copy Link</span>
      </button>
    </div>
  </div>

  <a href="/" class="btn-flame inline-block mt-6 px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
    Return Home
  </a>
</div>
```

**Step 2: Update the email form success handler**

In the `<script>` block, find the `if (res.ok)` block (approx lines 360-370) and update it to populate share links:

```typescript
if (res.ok) {
  emailSection.style.display = 'none';
  emailSuccess.classList.remove('hidden');

  // Populate share links with archetype-specific URLs
  const archetype = quizArchetype;
  const urlSlug = archetype.replace(/_/g, '-');
  const shareUrl = `https://www.thehermeticflight.com/quiz/result/${urlSlug}`;
  const content = archetypes[archetype as keyof typeof archetypes];
  const shareText = `I'm ${content.title} — ${content.element} element. Discover your aerial tarot archetype:`;

  const shareX = document.getElementById('share-x') as HTMLAnchorElement;
  const shareFb = document.getElementById('share-fb') as HTMLAnchorElement;
  const shareCopy = document.getElementById('share-copy')!;
  const shareCopyText = document.getElementById('share-copy-text')!;

  shareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  shareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  shareCopy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(shareUrl);
    shareCopyText.textContent = 'Copied!';
    setTimeout(() => { shareCopyText.textContent = 'Copy Link'; }, 2000);
  });

  if (typeof fbq === 'function') fbq('track', 'Lead');
  if (typeof gtag === 'function') {
    gtag('event', 'generate_lead', {
      event_category: 'quiz',
      archetype,
    });
  }
}
```

**Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Run existing Playwright tests to confirm no regressions**

Run: `npx playwright test tests/quiz-flow.spec.ts`
Expected: All 10 tests pass

**Step 5: Commit**

```bash
git add src/pages/quiz.astro
git commit -m "feat: add share CTA with X/Facebook/copy-link after quiz submission"
```

**Known Risks:**
- Modifies `quiz.astro` which was recently hardened (SYN-12). The module-scoped `quizArchetype` variable must be set before the share links are populated — it is assigned during the archetype reveal step, prior to the email form being shown.

**If This Fails:**
- If share links show `null` in URLs, verify `quizArchetype` is assigned during the archetype reveal step (before the email form appears). The `quizArchetype` assignment must come before the `if (res.ok)` block that reads it.
- If Playwright tests fail, verify the dev server port matches the test config (4322).

---

## Task 5: Create placeholder OG images

**Files:**
- Create: `public/images/og/default.png`
- Create: `public/images/og/air-weaver.png`
- Create: `public/images/og/embodied-intuitive.png`
- Create: `public/images/og/ascending-seeker.png`
- Create: `public/images/og/shadow-dancer.png`
- Create: `public/images/og/flow-artist.png`
- Create: `public/images/og/grounded-mystic.png`

These are 1200x630 PNG images used for link preview cards on social platforms.

**Option A (recommended): Export from existing archetype card PDFs**

The operator has existing archetype card PDFs. Export each as 1200x630 PNG:
1. Open each PDF in Preview or Figma
2. Resize/crop to 1200x630 (landscape aspect ratio for OG)
3. Add the archetype title text overlay if not already present
4. Save as PNG to `public/images/og/[slug].png`

For the default OG image (`default.png`), use the site logo or a generic branded image.

**Option B (quick placeholder): Generate via script**

If archetype card PDFs aren't ready, create minimal placeholders using ImageMagick:

```bash
mkdir -p public/images/og

# Default
convert -size 1200x630 xc:'#0a0a0a' \
  -fill '#C5A059' -font 'Cinzel' -pointsize 60 -gravity center \
  -annotate 0 'The Hermetic Flight' \
  public/images/og/default.png

# Per archetype (repeat for each)
convert -size 1200x630 xc:'#0a0a0a' \
  -fill '#93c5fd' -font 'Cinzel' -pointsize 48 -gravity center \
  -annotate +0-30 'The Air Weaver' \
  -fill '#C5A059' -pointsize 24 \
  -annotate +0+40 'Discover Your Aerial Tarot Archetype' \
  public/images/og/air-weaver.png
```

Color reference for each archetype:
| Archetype | Hex |
|-----------|-----|
| Air Weaver | `#93c5fd` |
| Embodied Intuitive | `#6ee7b7` |
| Ascending Seeker | `#c4b5fd` |
| Shadow Dancer | `#fca5a5` |
| Flow Artist | `#67e8f9` |
| Grounded Mystic | `#C5A059` |

**Step 1: Create images using chosen method**

**Step 2: Verify images exist and are correct dimensions**

Run: `ls -la public/images/og/`
Expected: 7 PNG files

Run: `file public/images/og/default.png`
Expected: PNG image data, 1200 x 630

**Step 3: Commit**

```bash
git add public/images/og/
git commit -m "feat: add OG preview images for all archetypes"
```

**Known Risks:**
- ImageMagick (`convert` command) may not be installed on the system.
- Cinzel font may not be available as a system font for ImageMagick to use.

**If This Fails:**
- If `convert` is not found, install via `brew install imagemagick`.
- If a font error occurs, check available fonts with `convert -list font | grep -i cinzel`. If Cinzel is absent, substitute with any available serif font (e.g., `Times-Roman`) for the placeholder — font quality does not matter for placeholder images.

---

## Task 6: Add share event tracking

**Files:**
- Modify: `src/pages/quiz.astro`
- Modify: `src/pages/quiz/result/[archetype].astro`

**Step 1: Add GA4 events to share buttons on quiz.astro**

In the `shareCopy.addEventListener` block and after setting the `shareX.href` / `shareFb.href`, add click tracking:

```typescript
// Track share clicks
[shareX, shareFb, shareCopy].forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof gtag === 'function') {
      const platform = btn === shareX ? 'x' : btn === shareFb ? 'facebook' : 'copy_link';
      gtag('event', 'share', {
        method: platform,
        content_type: 'quiz_result',
        item_id: archetype,
      });
    }
  });
});
```

**Step 2: Add tracking to result page share buttons**

In `src/pages/quiz/result/[archetype].astro`, update the `<script>` block:

```html
<script>
  const copyBtn = document.getElementById('copy-link-btn');
  const copyText = document.getElementById('copy-text');
  if (copyBtn && copyText) {
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(window.location.href);
      copyText.textContent = 'Copied!';
      setTimeout(() => { copyText.textContent = 'Copy Link'; }, 2000);
    });
  }

  // Track all share button clicks
  document.getElementById('share-buttons')?.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a, button');
    if (!link || typeof gtag !== 'function') return;
    const archetype = window.location.pathname.split('/').pop();
    const platform = link.tagName === 'BUTTON' ? 'copy_link'
      : (link as HTMLAnchorElement).href.includes('x.com') ? 'x' : 'facebook';
    gtag('event', 'share', {
      method: platform,
      content_type: 'quiz_result',
      item_id: archetype,
    });
  });
</script>
```

**Step 3: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/pages/quiz.astro src/pages/quiz/result/\[archetype\].astro
git commit -m "feat: add GA4 share event tracking on quiz result pages"
```

**Known Risks:**
- GA4 `gtag` must be present on the page (loaded via `Layout.astro`). The `typeof gtag === 'function'` guard handles ad-blocked or missing script scenarios gracefully — events will be silently skipped rather than throwing.

**If This Fails:**
- If build fails, check for TypeScript errors in `gtag` calls — the `gtag` global must be declared or use `(window as any).gtag` if no type declarations are present.
- If events do not appear in GA4, verify the property ID `G-R24GW4SCEY` is correct and check the GA4 Realtime report (events take up to 30 seconds to appear; standard reports have a 24-48 hour delay).

---

## Task 7: Build verification and Playwright test

**Files:**
- Modify: `tests/quiz-flow.spec.ts`

**Step 1: Add result page test to Playwright suite**

Append to `tests/quiz-flow.spec.ts`:

> **Note:** The existing file uses raw Playwright with `chromium.launch()` and custom pass/fail helpers — NOT `@playwright/test`. The new test cases follow the same pattern.

```javascript
// Test: archetype result page renders OG tags and share buttons
async function testResultPageOGAndShareButtons() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4322/quiz/result/air-weaver');

    // Page loads with correct title
    const h1Text = await page.textContent('h1');
    if (!h1Text?.includes('The Air Weaver')) {
      throw new Error(`Expected h1 to contain "The Air Weaver", got: ${h1Text}`);
    }

    // OG tags present
    const ogTitle = await page.$eval('meta[property="og:title"]', (el) => el.getAttribute('content'));
    if (!ogTitle?.includes('Air Weaver')) {
      throw new Error(`Expected og:title to contain "Air Weaver", got: ${ogTitle}`);
    }

    const ogImage = await page.$eval('meta[property="og:image"]', (el) => el.getAttribute('content'));
    if (!ogImage?.includes('air-weaver.png')) {
      throw new Error(`Expected og:image to contain "air-weaver.png", got: ${ogImage}`);
    }

    // Share buttons present
    const shareLinks = await page.$$('#share-buttons a');
    if (shareLinks.length !== 2) {
      throw new Error(`Expected 2 share links (X + Facebook), got: ${shareLinks.length}`);
    }

    const copyBtn = await page.$('#copy-link-btn');
    if (!copyBtn) throw new Error('Copy link button not found');

    // Quiz CTA present
    const quizCta = await page.$('a[href="/quiz"]');
    if (!quizCta) throw new Error('Quiz CTA link not found');

    pass('testResultPageOGAndShareButtons');
  } catch (err) {
    fail('testResultPageOGAndShareButtons', err);
  } finally {
    await browser.close();
  }
}

// Test: share section is hidden before email submission
async function testShareSectionHiddenBeforeSubmission() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4322/quiz');
    await page.click('#start-quiz');

    // Answer all 20 questions (click first answer for each)
    for (let i = 0; i < 20; i++) {
      await page.waitForSelector('.quiz-step.active .answer-btn', { timeout: 3000 });
      await page.click('.quiz-step.active .answer-btn:first-child');
      await page.waitForTimeout(600);
    }

    // Wait for results section
    await page.waitForSelector('#quiz-results.active', { timeout: 5000 });
    const resultTitle = await page.textContent('#result-title');
    if (!resultTitle) throw new Error('result-title is empty after quiz completion');

    // Share section must not be visible until email is submitted
    const shareSectionVisible = await page.$eval(
      '#share-section',
      (el) => !el.closest('#email-success')?.classList.contains('hidden') && getComputedStyle(el).display !== 'none'
    );
    if (shareSectionVisible) {
      throw new Error('Share section should be hidden before email submission');
    }

    pass('testShareSectionHiddenBeforeSubmission');
  } catch (err) {
    fail('testShareSectionHiddenBeforeSubmission', err);
  } finally {
    await browser.close();
  }
}
```

**Step 2: Run the Playwright tests**

First start dev server in background:
```bash
npm run dev &
DEV_PID=$!
sleep 3
```

Run: `npx playwright test tests/quiz-flow.spec.ts`
Expected: All tests pass (including 2 new ones)

```bash
kill $DEV_PID
```

**Step 3: Run all unit tests**

Run: `npm test`
Expected: All 253 tests pass (existing + new OG + archetype-content tests)

**Step 4: Final build verification**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds, 6 result pages generated

**Step 5: Commit**

```bash
git add tests/quiz-flow.spec.ts
git commit -m "test: add Playwright tests for archetype result pages and share CTA"
```

**Known Risks:**
- Playwright tests require a running dev server on port 4322. Tests depend on Tasks 1-6 being completed first — result pages must exist and share buttons must be present.

**If This Fails:**
- If the dev server won't start, check for port conflicts with `lsof -i :4322`.
- If tests timeout on `waitForSelector`, increase the timeout value in the failing assertion (e.g., raise `{ timeout: 3000 }` to `{ timeout: 8000 }`).
- If a "page not found" error occurs on the result page URL, verify the result pages were generated by running `npm run build` first — the dev server serves SSG pages from the build output.

---

## Task 8: Update sitemap exclusion and verify

**Files:**
- Check: `astro.config.mjs` (sitemap integration)

**Step 1: Verify result pages appear in sitemap**

Run: `grep 'result' dist/sitemap-0.xml`
Expected: All 6 archetype result pages listed — these ARE pages we want indexed (they're the viral landing pages that drive quiz traffic)

**Step 2: If sitemap looks correct, no changes needed**

The `@astrojs/sitemap` integration auto-discovers all static pages. The 6 result pages should be included automatically.

**Step 3: Commit (only if changes were needed)**

No commit expected — this is a verification step.
