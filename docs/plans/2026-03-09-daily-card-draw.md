# Daily Card Draw Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an interactive `/daily` page where users see the same card each day, with interpretation, journaling prompt, and share button. Drives repeat visits and daily CTA impressions.

**Architecture:** Entirely client-side. Date-seeded deterministic PRNG selects a card index. Pre-reveal mode (before art delivery) shows card back + text. Post-reveal mode shows art. No backend required.

**Tech Stack:** Astro 5 SSG, CSS animations (card flip), Vitest

**Content dependency:** 78-card tarot data (name, meaning, aerial connection, journaling prompt) from operator. Plan uses placeholder schema with 6 sample cards.

---

## Task 1: Create card data module

**Files:**
- Create: `src/lib/card-data.ts`
- Test: `tests/daily-draw.test.ts` (written in Task 4 — data module is a dependency)

**Step 1: Write the failing test**

The test for the data module is co-located with the draw utility tests in Task 4. Proceed directly to implementation here since `card-data.ts` is pure data/types with no logic to test independently — the draw utility tests exercise it transitively.

**Step 2: Implement `src/lib/card-data.ts`**

Create the file with the TypeScript interface and 6 placeholder cards:

```typescript
/**
 * Card Data — Hermetic Flight Tarot
 *
 * Defines the schema for a single tarot card and exports the full card array.
 * Operator will expand CARDS from 6 placeholders to 78 entries before launch.
 * The draw utility reads CARDS.length — no other changes needed when expanding.
 */

export interface CardData {
  /** URL-safe slug: used for image paths and share URLs (e.g. 'the-fool') */
  slug: string;
  /** Display name (e.g. 'The Fool') */
  name: string;
  /** One-paragraph interpretation of the card's core meaning */
  meaning: string;
  /** How this card connects to aerial / flight themes */
  aerialConnection: string;
  /** Open-ended journaling prompt for the reader */
  journalingPrompt: string;
  /**
   * True once the card art PNG has been delivered and placed at
   * /public/images/cards/[slug].png. Controls pre- vs post-reveal rendering.
   * Set to false for all cards until art is ready.
   */
  artReady: boolean;
}

/**
 * Full card array. Operator expands this to 78 entries.
 * Order is arbitrary — the deterministic PRNG selects by index.
 */
export const CARDS: CardData[] = [
  {
    slug: 'the-fool',
    name: 'The Fool',
    meaning:
      'A leap before the map is drawn. The Fool carries the beginner\'s mind — unburdened by past failures, unguarded against wonder. This card invites radical openness: to not-knowing as a form of wisdom, to the edge of the familiar as the first step of flight.',
    aerialConnection:
      'Every first flight begins before the pilot fully understands the sky. The Fool is the moment before wheels leave the ground — pure potential, weight surrendered to air.',
    journalingPrompt:
      'What would you begin today if you allowed yourself to not know how it ends?',
    artReady: false,
  },
  {
    slug: 'the-magician',
    name: 'The Magician',
    meaning:
      'All tools present, all elements aligned. The Magician does not wait for permission or perfect conditions — mastery is the act of gathering what is already at hand and moving. Will becomes form. Intention becomes action.',
    aerialConnection:
      'A pilot\'s pre-flight checklist is a ritual of the Magician: every instrument verified, every control surface tested. The sacred and the technical are the same gesture.',
    journalingPrompt:
      'What resources do you already have that you have been treating as incomplete?',
    artReady: false,
  },
  {
    slug: 'the-high-priestess',
    name: 'The High Priestess',
    meaning:
      'What cannot be spoken directly can only be received in stillness. The High Priestess holds the scroll and does not open it — she is the reminder that some knowledge arrives only when we stop reaching. Intuition is the signal beneath the noise.',
    aerialConnection:
      'At altitude, the body knows things the instruments have not yet registered. The subtle pull before a stall, the shift in sound before turbulence. Trust the knowing that arrives before the data.',
    journalingPrompt:
      'What have you been sensing that you have not yet allowed yourself to trust?',
    artReady: false,
  },
  {
    slug: 'the-tower',
    name: 'The Tower',
    meaning:
      'The structure that was never sound finally meets the storm it was hiding from. The Tower is not punishment — it is revelation. What collapses was always hollow. What survives is what was real. Disruption in service of clarity.',
    aerialConnection:
      'An emergency landing strips every non-essential. The altimeter, the horizon, the runway. The Tower is the moment all the noise drops away and only the essential remains.',
    journalingPrompt:
      'What structure in your life are you maintaining that has already begun to crack?',
    artReady: false,
  },
  {
    slug: 'the-star',
    name: 'The Star',
    meaning:
      'After the storm, an open sky. The Star is the quiet that follows transformation — not the silence of depletion but of renewal. Hope restored not through certainty but through presence. Vulnerability as a form of radiance.',
    aerialConnection:
      'Navigating by stars requires that you look up rather than in. The Star asks you to orient by what is permanent and luminous rather than by what is immediate and anxious.',
    journalingPrompt:
      'What does hope feel like in your body right now, and where are you resisting it?',
    artReady: false,
  },
  {
    slug: 'the-world',
    name: 'The World',
    meaning:
      'The cycle completes and the dancer moves at the center — not because the dance is over but because she has earned the stillness at the eye of it. Wholeness is not a destination. It is a recognition: everything necessary was always here.',
    aerialConnection:
      'The view from altitude at the end of a long flight. The geography of the journey made visible all at once. The World is the moment you see the shape of where you have been and understand why each heading was necessary.',
    journalingPrompt:
      'What in your current chapter is asking to be recognized as complete before you move to the next?',
    artReady: false,
  },
];

/** Total number of cards. The draw utility uses this to keep indices in bounds. */
export const TOTAL_CARDS = CARDS.length;
```

**Step 3: Verify the file compiles**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npx tsc --noEmit
```

Expected: no errors. If TypeScript errors appear, fix before proceeding.

**Step 4: Commit**

```bash
git add src/lib/card-data.ts
git commit -m "feat: add card-data module with CardData interface and 6 placeholder cards"
```

---

## Task 2: Create daily draw utility

**Files:**
- Create: `src/lib/daily-draw.ts`
- Test: `tests/daily-draw.test.ts` (Task 4 — write test first, then return here to implement)

**IMPORTANT — Frozen Test File Protocol:** Tasks 2 and 4 are interleaved. The correct execution order is:

1. Write `tests/daily-draw.test.ts` (Task 4, Step 1)
2. Run baseline — confirm tests fail
3. Record frozen baseline (`record-baseline.sh`)
4. Implement `src/lib/daily-draw.ts` (Task 2, Steps 2–4)
5. Run tests — confirm all pass
6. Verify file unchanged (`verify-frozen.sh`)

For plan execution, implement Task 4 Step 1 before Task 2 Steps 2–4.

**Step 1: (See Task 4 Step 1 — write the test first)**

**Step 2: Implement `src/lib/daily-draw.ts`**

```typescript
/**
 * Daily Draw Utility — Hermetic Flight
 *
 * Exports getDailyCard(date?) which deterministically selects a card for
 * any given date. Same date → same card for every user worldwide.
 *
 * Algorithm:
 *   1. Serialize date as 'YYYY-MM-DD' (UTC, so midnight-boundary is consistent)
 *   2. Hash the string with a simple polynomial accumulator → 32-bit seed
 *   3. Feed seed into Mulberry32 PRNG → first float in [0, 1)
 *   4. Multiply by TOTAL_CARDS, floor → card index
 */

import { CARDS, TOTAL_CARDS } from './card-data';
import type { CardData } from './card-data';

// ---------------------------------------------------------------------------
// mulberry32 — fast, seedable 32-bit PRNG
// Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// dateToSeed — polynomial hash of 'YYYY-MM-DD' string
//
// Uses a simple Horner's method accumulator: seed = seed * 31 + charCode
// This produces well-distributed seeds across consecutive dates.
// Wraps via |0 (signed 32-bit truncation) to keep values in safe integer range.
// ---------------------------------------------------------------------------

export function dateToSeed(date: Date): number {
  // Use UTC date string so the card flips at midnight UTC for all users,
  // giving a single consistent daily boundary worldwide.
  const dateStr = date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (Math.imul(seed, 31) + dateStr.charCodeAt(i)) | 0;
  }
  return seed;
}

// ---------------------------------------------------------------------------
// getDailyCardIndex — exported for testing boundary behavior
// ---------------------------------------------------------------------------

export function getDailyCardIndex(date: Date): number {
  const seed = dateToSeed(date);
  const rng = mulberry32(seed);
  return Math.floor(rng() * TOTAL_CARDS);
}

// ---------------------------------------------------------------------------
// getDailyCard — primary export
//
// Pass a Date to get that day's card. Defaults to today (new Date()).
// Always returns a valid CardData — index is guaranteed in [0, TOTAL_CARDS - 1].
// ---------------------------------------------------------------------------

export function getDailyCard(date: Date = new Date()): CardData {
  const index = getDailyCardIndex(date);
  return CARDS[index];
}
```

**Step 3: Verify the file compiles**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Run unit tests**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm test
```

Expected: all daily-draw tests pass. All pre-existing tests continue to pass.

**Step 5: Verify frozen test file is unchanged**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && bash scripts/verify-frozen.sh tests/daily-draw.test.ts
```

**Step 6: Commit**

```bash
git add src/lib/daily-draw.ts
git commit -m "feat: add daily-draw utility with mulberry32 PRNG and getDailyCard export"
```

---

## Task 3: Create the daily page

**Files:**
- Create: `src/pages/daily.astro`

**Step 1: Create `/public/images/og/daily.png` placeholder**

The OG image must exist before the build will succeed. Create a 1200x630 placeholder PNG using the same convention as the other OG images. If ImageMagick is available:

```bash
convert -size 1200x630 xc:#0a0a0a \
  -font "DejaVu-Serif" -pointsize 80 -fill "#C5A059" \
  -gravity Center -annotate 0 "The Hermetic Flight\nDaily Card Draw" \
  /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/daily.png
```

If ImageMagick is not available, copy any existing OG image as a temporary stand-in:

```bash
cp /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/default.png \
   /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/daily.png
```

Also create the card-back placeholder image directory:

```bash
mkdir -p /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/cards
```

Create a minimal card-back placeholder (1px PNG — replace with real art later):

```bash
cp /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/default.png \
   /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/cards/card-back.png
```

**Step 2: Implement `src/pages/daily.astro`**

The page must be entirely SSG (no server-side logic). All date calculation and card selection runs in the client-side `<script>` block. The Astro frontmatter only handles static OG metadata (using a fixed title that the client script will update via `document.title` after computing the card).

```astro
---
/**
 * /daily — Daily Card Draw
 *
 * Architecture: Entirely client-side. The Astro frontmatter sets static
 * metadata for the initial SSG build. The <script> block runs in the browser,
 * computes today's card via the same PRNG as the utility module, and renders
 * the card content into the DOM.
 *
 * Pre-reveal mode: Shows card back image + text interpretation.
 *   REVEAL_DATE constant controls when art is shown instead.
 * Post-reveal mode: Shows card art with a click-to-flip CSS animation.
 *
 * Note: The PRNG and card data are inlined into the script block (not
 * imported) because Astro SSG pages cannot dynamically import client-side
 * TS modules at runtime. The logic mirrors src/lib/daily-draw.ts exactly.
 */
import Layout from '../layouts/Layout.astro';

const siteUrl = Astro.site?.origin ?? 'https://www.thehermeticflight.com';
---

<Layout
  title="Daily Card Draw | The Hermetic Flight"
  description="See today's aerial tarot card — a new card every day, the same for everyone. Interpretation, journaling prompt, and share button."
  ogImage="/images/og/daily.png"
>
  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-16 px-4">

    <!-- Header -->
    <header class="w-full py-4 flex justify-center mb-4">
      <a href="/" class="group flex items-center gap-3">
        <img
          src="/images/logo.png"
          alt="The Hermetic Flight"
          class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">
          The Hermetic Flight
        </span>
      </a>
    </header>

    <!-- Page Hero -->
    <div class="w-full max-w-2xl text-center mb-8">
      <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-3">Aerial Tarot</p>
      <h1 class="font-serif text-3xl md:text-4xl text-hermetic-white mb-2 tracking-wide">Today's Card</h1>
      <p id="daily-date" class="text-gray-500 font-sans text-sm tracking-wide">Loading...</p>
    </div>

    <!-- Card Draw Area -->
    <div class="w-full max-w-2xl">
      <div class="glass-panel p-8 md:p-12 rounded-lg text-center relative" id="card-panel">

        <!-- Corner accents (matches result page pattern) -->
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <!-- Glow effect (gold, matches site palette) -->
        <div class="absolute inset-0 rounded-lg opacity-20"
          style="background: radial-gradient(circle at 50% 30%, #C5A05920 0%, transparent 60%);"></div>

        <div class="relative z-10">
          <!-- Card name and separator -->
          <p id="card-label" class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-4">
            Drawing card...
          </p>
          <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>

          <!-- Card flip container (pre-reveal: static display, post-reveal: 3D flip) -->
          <div class="flex justify-center mb-8">
            <div id="card-container" class="relative w-48 h-72 cursor-pointer" style="perspective: 1000px;">
              <div
                id="card-inner"
                class="w-full h-full relative"
                style="transform-style: preserve-3d; transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);"
              >
                <!-- Card back (face-down side) -->
                <div
                  id="card-back-face"
                  class="absolute inset-0 rounded-lg overflow-hidden border border-hermetic-gold/30"
                  style="backface-visibility: hidden;"
                >
                  <img
                    src="/images/cards/card-back.png"
                    alt="Card back"
                    class="w-full h-full object-cover"
                  />
                </div>

                <!-- Card front (face-up side — hidden until flipped in post-reveal) -->
                <div
                  id="card-front-face"
                  class="absolute inset-0 rounded-lg overflow-hidden border border-hermetic-gold/30 flex items-center justify-center"
                  style="backface-visibility: hidden; transform: rotateY(180deg);"
                >
                  <img
                    id="card-art"
                    src=""
                    alt=""
                    class="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Pre-reveal tap hint (hidden in post-reveal mode) -->
          <p id="tap-hint" class="text-gray-500 font-sans text-xs tracking-[0.2em] mb-6 hidden">
            Tap card to reveal
          </p>

          <!-- Card name heading -->
          <h2 id="card-name" class="font-serif text-2xl md:text-3xl text-hermetic-white mb-2 tracking-wide opacity-0 transition-opacity duration-700">
            ...
          </h2>

          <!-- Card meaning -->
          <p id="card-meaning" class="text-gray-300 font-light font-sans leading-relaxed mb-8 max-w-lg mx-auto opacity-0 transition-opacity duration-700">
            ...
          </p>

          <!-- Aerial Connection -->
          <div id="aerial-connection-block" class="mb-8 opacity-0 transition-opacity duration-700">
            <div class="w-12 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/40 to-transparent mx-auto mb-4"></div>
            <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2">Aerial Connection</p>
            <p id="card-aerial" class="text-gray-400 font-light font-sans leading-relaxed text-sm max-w-lg mx-auto italic">
              ...
            </p>
          </div>

          <!-- Journaling Prompt -->
          <div id="journaling-block" class="glass-panel rounded-lg p-6 mb-8 text-left opacity-0 transition-opacity duration-700">
            <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-3">Today's Prompt</p>
            <p id="card-prompt" class="text-hermetic-white font-serif text-lg leading-relaxed">
              ...
            </p>
          </div>

          <!-- Share Section -->
          <div class="border-t border-hermetic-gold/20 pt-8 mt-4">
            <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-4">Share Today's Card</p>
            <div class="flex justify-center gap-3" id="share-buttons">
              <a
                id="share-x"
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Post
              </a>
              <a
                id="share-facebook"
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Share
              </a>
              <button
                id="copy-link-btn"
                class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span id="copy-text">Copy Link</span>
              </button>
            </div>
          </div>

          <!-- CTA -->
          <div class="border-t border-hermetic-gold/20 pt-8 mt-8">
            <p class="text-hermetic-white font-serif text-lg mb-2">Discover Your Aerial Tarot Archetype</p>
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
    // -------------------------------------------------------------------------
    // PRNG — Mulberry32 (mirrors src/lib/daily-draw.ts exactly)
    // Inlined here because Astro SSG pages cannot dynamically import TS modules.
    // -------------------------------------------------------------------------

    function mulberry32(seed: number): () => number {
      return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function dateToSeed(dateStr: string): number {
      let seed = 0;
      for (let i = 0; i < dateStr.length; i++) {
        seed = (Math.imul(seed, 31) + dateStr.charCodeAt(i)) | 0;
      }
      return seed;
    }

    // -------------------------------------------------------------------------
    // Card data — 6 placeholders (mirrors src/lib/card-data.ts)
    // -------------------------------------------------------------------------

    interface CardData {
      slug: string;
      name: string;
      meaning: string;
      aerialConnection: string;
      journalingPrompt: string;
      artReady: boolean;
    }

    const CARDS: CardData[] = [
      {
        slug: 'the-fool',
        name: 'The Fool',
        meaning: "A leap before the map is drawn. The Fool carries the beginner's mind — unburdened by past failures, unguarded against wonder. This card invites radical openness: to not-knowing as a form of wisdom, to the edge of the familiar as the first step of flight.",
        aerialConnection: "Every first flight begins before the pilot fully understands the sky. The Fool is the moment before wheels leave the ground — pure potential, weight surrendered to air.",
        journalingPrompt: "What would you begin today if you allowed yourself to not know how it ends?",
        artReady: false,
      },
      {
        slug: 'the-magician',
        name: 'The Magician',
        meaning: "All tools present, all elements aligned. The Magician does not wait for permission or perfect conditions — mastery is the act of gathering what is already at hand and moving. Will becomes form. Intention becomes action.",
        aerialConnection: "A pilot's pre-flight checklist is a ritual of the Magician: every instrument verified, every control surface tested. The sacred and the technical are the same gesture.",
        journalingPrompt: "What resources do you already have that you have been treating as incomplete?",
        artReady: false,
      },
      {
        slug: 'the-high-priestess',
        name: 'The High Priestess',
        meaning: "What cannot be spoken directly can only be received in stillness. The High Priestess holds the scroll and does not open it — she is the reminder that some knowledge arrives only when we stop reaching. Intuition is the signal beneath the noise.",
        aerialConnection: "At altitude, the body knows things the instruments have not yet registered. The subtle pull before a stall, the shift in sound before turbulence. Trust the knowing that arrives before the data.",
        journalingPrompt: "What have you been sensing that you have not yet allowed yourself to trust?",
        artReady: false,
      },
      {
        slug: 'the-tower',
        name: 'The Tower',
        meaning: "The structure that was never sound finally meets the storm it was hiding from. The Tower is not punishment — it is revelation. What collapses was always hollow. What survives is what was real. Disruption in service of clarity.",
        aerialConnection: "An emergency landing strips every non-essential. The altimeter, the horizon, the runway. The Tower is the moment all the noise drops away and only the essential remains.",
        journalingPrompt: "What structure in your life are you maintaining that has already begun to crack?",
        artReady: false,
      },
      {
        slug: 'the-star',
        name: 'The Star',
        meaning: "After the storm, an open sky. The Star is the quiet that follows transformation — not the silence of depletion but of renewal. Hope restored not through certainty but through presence. Vulnerability as a form of radiance.",
        aerialConnection: "Navigating by stars requires that you look up rather than in. The Star asks you to orient by what is permanent and luminous rather than by what is immediate and anxious.",
        journalingPrompt: "What does hope feel like in your body right now, and where are you resisting it?",
        artReady: false,
      },
      {
        slug: 'the-world',
        name: 'The World',
        meaning: "The cycle completes and the dancer moves at the center — not because the dance is over but because she has earned the stillness at the eye of it. Wholeness is not a destination. It is a recognition: everything necessary was always here.",
        aerialConnection: "The view from altitude at the end of a long flight. The geography of the journey made visible all at once. The World is the moment you see the shape of where you have been and understand why each heading was necessary.",
        journalingPrompt: "What in your current chapter is asking to be recognized as complete before you move to the next?",
        artReady: false,
      },
    ];

    const TOTAL_CARDS = CARDS.length;

    // -------------------------------------------------------------------------
    // Reveal gate
    // Same card → same reveal state for all users on a given date.
    // Update REVEAL_DATE when art is delivered.
    // -------------------------------------------------------------------------

    const REVEAL_DATE = new Date('2026-06-01T00:00:00Z');
    const isRevealed = new Date() >= REVEAL_DATE;

    // -------------------------------------------------------------------------
    // Compute today's card
    // -------------------------------------------------------------------------

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC
    const seed = dateToSeed(dateStr);
    const rng = mulberry32(seed);
    const cardIndex = Math.floor(rng() * TOTAL_CARDS);
    const card = CARDS[cardIndex];

    // -------------------------------------------------------------------------
    // Render date label
    // -------------------------------------------------------------------------

    const dateLabel = document.getElementById('daily-date');
    if (dateLabel) {
      dateLabel.textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    // -------------------------------------------------------------------------
    // Render card content
    // -------------------------------------------------------------------------

    function setText(id: string, value: string) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    function showEl(id: string) {
      const el = document.getElementById(id) as HTMLElement | null;
      if (el) el.style.opacity = '1';
    }

    setText('card-label', 'Card of the Day');
    setText('card-name', card.name);
    setText('card-meaning', card.meaning);
    setText('card-aerial', card.aerialConnection);
    setText('card-prompt', card.journalingPrompt);

    // Stagger reveal for visual polish
    setTimeout(() => showEl('card-name'), 100);
    setTimeout(() => showEl('card-meaning'), 300);
    setTimeout(() => showEl('aerial-connection-block'), 500);
    setTimeout(() => showEl('journaling-block'), 700);

    // Update page title to include card name
    document.title = `${card.name} — Daily Card | The Hermetic Flight`;

    // -------------------------------------------------------------------------
    // Card flip behavior (post-reveal) vs static display (pre-reveal)
    // -------------------------------------------------------------------------

    const cardContainer = document.getElementById('card-container');
    const cardInner = document.getElementById('card-inner') as HTMLElement | null;
    const cardArt = document.getElementById('card-art') as HTMLImageElement | null;
    const tapHint = document.getElementById('tap-hint');

    if (isRevealed && card.artReady) {
      // Post-reveal: set art src and enable click-to-flip
      if (cardArt) {
        cardArt.src = `/images/cards/${card.slug}.png`;
        cardArt.alt = card.name;
      }
      if (tapHint) {
        tapHint.classList.remove('hidden');
      }
      if (cardContainer && cardInner) {
        let flipped = false;
        cardContainer.addEventListener('click', () => {
          flipped = !flipped;
          cardInner.style.transform = flipped ? 'rotateY(180deg)' : '';
          if (tapHint) {
            tapHint.textContent = flipped ? 'Tap to turn over' : 'Tap card to reveal';
          }
        });
      }
    }
    // Pre-reveal: card-back image is already visible by default. No flip behavior.

    // -------------------------------------------------------------------------
    // Share buttons — build URLs after card is known
    // -------------------------------------------------------------------------

    const pageUrl = `https://www.thehermeticflight.com/daily`;
    const shareText = `Today's aerial tarot card is ${card.name}. ${card.aerialConnection.slice(0, 100)}...`;

    const shareX = document.getElementById('share-x') as HTMLAnchorElement | null;
    if (shareX) {
      shareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`;
    }

    const shareFb = document.getElementById('share-facebook') as HTMLAnchorElement | null;
    if (shareFb) {
      shareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
    }

    // Copy link
    const copyBtn = document.getElementById('copy-link-btn');
    const copyText = document.getElementById('copy-text');
    if (copyBtn && copyText) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(pageUrl);
          copyText.textContent = 'Copied!';
        } catch {
          copyText.textContent = 'Copy failed';
        }
        setTimeout(() => {
          copyText.textContent = 'Copy Link';
        }, 2000);
      });
    }

    // -------------------------------------------------------------------------
    // GA4 tracking — matches existing site pattern
    // -------------------------------------------------------------------------

    // Page view event with card context
    if (typeof gtag === 'function') {
      gtag('event', 'daily_draw_view', {
        card_name: card.name,
        card_slug: card.slug,
        date_utc: dateStr,
        reveal_mode: isRevealed ? 'post_reveal' : 'pre_reveal',
      });
    }

    // Share button tracking
    document.getElementById('share-buttons')?.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('a, button');
      if (!link || typeof gtag !== 'function') return;
      const platform =
        link.tagName === 'BUTTON'
          ? 'copy_link'
          : (link as HTMLAnchorElement).href.includes('x.com')
          ? 'x'
          : 'facebook';
      gtag('event', 'share', {
        method: platform,
        content_type: 'daily_card',
        item_id: card.name,
      });
    });
  </script>
</Layout>
```

**Step 3: Build the site and verify no errors**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm run build
```

Expected: build succeeds. `/daily` page included in output.

**Step 4: Smoke-test in preview**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm run preview &
# Open http://localhost:4321/daily in browser
# Verify: date displays, card name and meaning render, share buttons visible, CTA present
```

**Step 5: Commit**

```bash
git add src/pages/daily.astro public/images/og/daily.png public/images/cards/card-back.png
git commit -m "feat: add /daily page with card-flip animation, pre-reveal mode, share buttons, and GA4 tracking"
```

---

## Task 4: Tests

**Files:**
- Create: `tests/daily-draw.test.ts` (unit tests)
- Create: `tests/daily-page.spec.ts` (E2E tests)

**CRITICAL: Write these tests BEFORE implementing Task 2. Verify they fail first. Record frozen baseline.**

### Step 1: Write `tests/daily-draw.test.ts` (unit tests)

**Write this before implementing `src/lib/daily-draw.ts`.**

```typescript
/**
 * Daily Draw Utility — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during or after implementation.
 *
 * Modules under test:
 *   src/lib/card-data.ts  — CardData interface, CARDS array, TOTAL_CARDS
 *   src/lib/daily-draw.ts — mulberry32, dateToSeed, getDailyCardIndex, getDailyCard
 *
 * Core invariants verified:
 *   1. Same date → same card index (determinism)
 *   2. Different date → different card index (distribution)
 *   3. Index always in [0, TOTAL_CARDS - 1] (bounds)
 *   4. Midnight boundary: 23:59:59 and 00:00:00 next day return different cards
 *   5. getDailyCard returns a valid CardData with all required fields
 *   6. TOTAL_CARDS matches CARDS array length
 */

import { describe, it, expect } from 'vitest';
import { CARDS, TOTAL_CARDS } from '../src/lib/card-data';
import type { CardData } from '../src/lib/card-data';
import { dateToSeed, getDailyCardIndex, getDailyCard } from '../src/lib/daily-draw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Date from 'YYYY-MM-DD' string at UTC midnight. */
function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** Build a Date at the last second of a UTC day. */
function utcEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59Z`);
}

// ---------------------------------------------------------------------------
// card-data module
// ---------------------------------------------------------------------------

describe('card-data module', () => {
  it('TOTAL_CARDS equals CARDS array length', () => {
    expect(TOTAL_CARDS).toBe(CARDS.length);
  });

  it('TOTAL_CARDS is at least 1', () => {
    expect(TOTAL_CARDS).toBeGreaterThanOrEqual(1);
  });

  it('every card has all required fields', () => {
    const requiredKeys: (keyof CardData)[] = [
      'slug',
      'name',
      'meaning',
      'aerialConnection',
      'journalingPrompt',
      'artReady',
    ];
    for (const card of CARDS) {
      for (const key of requiredKeys) {
        expect(card[key], `card "${card.name}" missing "${key}"`).toBeDefined();
      }
    }
  });

  it('every card slug is non-empty and URL-safe (lowercase, hyphens only)', () => {
    for (const card of CARDS) {
      expect(card.slug.length, `card "${card.name}" slug is empty`).toBeGreaterThan(0);
      expect(card.slug, `card "${card.name}" slug has invalid chars`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('every card slug is unique', () => {
    const slugs = CARDS.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('artReady is a boolean on every card', () => {
    for (const card of CARDS) {
      expect(typeof card.artReady, `card "${card.name}" artReady is not boolean`).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// dateToSeed
// ---------------------------------------------------------------------------

describe('dateToSeed', () => {
  it('returns the same seed for the same date', () => {
    const d1 = utcDate('2026-03-09');
    const d2 = utcDate('2026-03-09');
    expect(dateToSeed(d1)).toBe(dateToSeed(d2));
  });

  it('returns different seeds for different dates', () => {
    expect(dateToSeed(utcDate('2026-03-09'))).not.toBe(dateToSeed(utcDate('2026-03-10')));
  });

  it('returns a number (may be negative due to 32-bit truncation)', () => {
    expect(typeof dateToSeed(utcDate('2026-03-09'))).toBe('number');
  });

  it('consecutive dates produce different seeds', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 10; i++) {
      const d = new Date(`2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`);
      seeds.add(dateToSeed(d));
    }
    // All 10 consecutive dates should yield distinct seeds
    expect(seeds.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getDailyCardIndex
// ---------------------------------------------------------------------------

describe('getDailyCardIndex', () => {
  it('returns the same index for the same date', () => {
    const date = utcDate('2026-03-09');
    expect(getDailyCardIndex(date)).toBe(getDailyCardIndex(date));
  });

  it('index is always within [0, TOTAL_CARDS - 1]', () => {
    const testDates = [
      '2026-01-01', '2026-03-09', '2026-06-01',
      '2026-08-08', '2026-12-31', '2025-01-01',
      '2024-02-29', // leap day
    ];
    for (const ds of testDates) {
      const idx = getDailyCardIndex(utcDate(ds));
      expect(idx, `index for ${ds} out of bounds`).toBeGreaterThanOrEqual(0);
      expect(idx, `index for ${ds} out of bounds`).toBeLessThan(TOTAL_CARDS);
    }
  });

  it('index is always an integer', () => {
    const idx = getDailyCardIndex(utcDate('2026-03-09'));
    expect(Number.isInteger(idx)).toBe(true);
  });

  it('different dates generally produce different indices (distribution check)', () => {
    // With 6 cards and 30 distinct dates, we should see at least 2 unique indices
    const indices = new Set<number>();
    for (let day = 1; day <= 30; day++) {
      const ds = `2026-03-${String(day).padStart(2, '0')}`;
      indices.add(getDailyCardIndex(utcDate(ds)));
    }
    expect(indices.size).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Date boundary test
// ---------------------------------------------------------------------------

describe('date boundary behavior', () => {
  it('23:59:59 UTC and 00:00:00 UTC next day return different card indices', () => {
    // The card changes at UTC midnight. Last second of March 9 vs first moment of March 10.
    const lastSecondMarch9 = utcEndOfDay('2026-03-09');
    const firstMomentMarch10 = utcDate('2026-03-10');

    const idxA = getDailyCardIndex(lastSecondMarch9);
    const idxB = getDailyCardIndex(firstMomentMarch10);

    // dateToSeed uses toISOString().slice(0,10) which is UTC date.
    // 23:59:59 UTC on March 9 → '2026-03-09', so same index as UTC midnight March 9.
    // 00:00:00 UTC on March 10 → '2026-03-10', so different index.
    const idxMarch9Midnight = getDailyCardIndex(utcDate('2026-03-09'));

    expect(idxA).toBe(idxMarch9Midnight); // 23:59:59 is still March 9 UTC
    expect(idxA).not.toBe(idxB);          // March 9 vs March 10 differ
  });

  it('any time on the same UTC calendar day returns the same index', () => {
    const morning = new Date('2026-03-09T06:00:00Z');
    const noon = new Date('2026-03-09T12:00:00Z');
    const evening = new Date('2026-03-09T20:00:00Z');
    const midnight = utcDate('2026-03-09');

    expect(getDailyCardIndex(morning)).toBe(getDailyCardIndex(midnight));
    expect(getDailyCardIndex(noon)).toBe(getDailyCardIndex(midnight));
    expect(getDailyCardIndex(evening)).toBe(getDailyCardIndex(midnight));
  });
});

// ---------------------------------------------------------------------------
// getDailyCard
// ---------------------------------------------------------------------------

describe('getDailyCard', () => {
  it('returns a CardData object with all required fields', () => {
    const card = getDailyCard(utcDate('2026-03-09'));
    expect(card).toBeDefined();
    expect(typeof card.slug).toBe('string');
    expect(typeof card.name).toBe('string');
    expect(typeof card.meaning).toBe('string');
    expect(typeof card.aerialConnection).toBe('string');
    expect(typeof card.journalingPrompt).toBe('string');
    expect(typeof card.artReady).toBe('boolean');
  });

  it('returns the same card for the same date called twice', () => {
    const d = utcDate('2026-06-01');
    expect(getDailyCard(d).slug).toBe(getDailyCard(d).slug);
  });

  it('returns a card whose slug exists in the CARDS array', () => {
    const card = getDailyCard(utcDate('2026-03-09'));
    const slugs = CARDS.map((c) => c.slug);
    expect(slugs).toContain(card.slug);
  });

  it('defaults to today (smoke test — does not throw)', () => {
    expect(() => getDailyCard()).not.toThrow();
    const card = getDailyCard();
    expect(card.name.length).toBeGreaterThan(0);
  });

  it('returns different cards for sufficiently separated dates', () => {
    // March 9 and August 8 are 5 months apart — very likely to differ with 6 cards
    const cardA = getDailyCard(utcDate('2026-03-09'));
    const cardB = getDailyCard(utcDate('2026-08-08'));
    // We cannot guarantee they differ (could be same by chance), but with 6 cards
    // and this many months apart it would be surprising. Test across 7 dates instead.
    const slugs = new Set<string>();
    for (let month = 1; month <= 7; month++) {
      const ds = `2026-${String(month).padStart(2, '0')}-15`;
      slugs.add(getDailyCard(utcDate(ds)).slug);
    }
    expect(slugs.size).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Verify tests fail (before implementation)**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm test -- --reporter=verbose 2>&1 | grep -E "daily-draw|FAIL|PASS"
```

Expected: tests fail with import errors (modules do not exist yet). This confirms the frozen contract.

**Step 3: Record frozen baseline**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && bash scripts/record-baseline.sh tests/daily-draw.test.ts
```

**Step 4: Now implement Task 2** (return to Task 2 Steps 2–6 above).

**Step 5: Run all tests and verify**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm test
```

Expected: all daily-draw tests pass. All pre-existing tests continue to pass.

**Step 6: Verify frozen file unchanged**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && bash scripts/verify-frozen.sh tests/daily-draw.test.ts
```

### Step 7: Write `tests/daily-page.spec.ts` (E2E tests)

This test follows the same raw Playwright pattern as `tests/quiz-flow.spec.ts`. Run it after `npm run build && npm run preview`.

```typescript
/**
 * Playwright E2E tests for the /daily page.
 *
 * Usage:
 *   1. npm run build
 *   2. npm run preview &   (starts on port 4321)
 *   3. npx tsx tests/daily-page.spec.ts
 *
 * Uses raw playwright (not @playwright/test) with custom pass/fail helpers,
 * matching the pattern established in tests/quiz-flow.spec.ts.
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
// Test: Daily page loads and renders a card name
// ---------------------------------------------------------------------------
async function testDailyPageLoads() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const res = await page.goto(`${BASE_URL}/daily`);
    if (!res || res.status() !== 200) {
      throw new Error(`/daily returned status ${res?.status()}`);
    }

    // Wait for client-side script to populate card name
    await page.waitForFunction(
      () => {
        const el = document.getElementById('card-name');
        return el && el.textContent && el.textContent.trim() !== '...';
      },
      { timeout: 5000 },
    );

    const cardName = await page.textContent('#card-name');
    if (!cardName || cardName.trim() === '...' || cardName.trim().length === 0) {
      throw new Error(`Card name did not render. Got: "${cardName}"`);
    }

    pass('testDailyPageLoads');
  } catch (err) {
    fail('testDailyPageLoads', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Date label renders today's date
// ---------------------------------------------------------------------------
async function testDateLabelRenders() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/daily`);
    await page.waitForFunction(
      () => {
        const el = document.getElementById('daily-date');
        return el && el.textContent && el.textContent !== 'Loading...';
      },
      { timeout: 5000 },
    );

    const dateText = await page.textContent('#daily-date');
    // Should contain the current year at minimum
    const currentYear = new Date().getFullYear().toString();
    if (!dateText?.includes(currentYear)) {
      throw new Error(`Date label does not contain current year. Got: "${dateText}"`);
    }

    pass('testDateLabelRenders');
  } catch (err) {
    fail('testDateLabelRenders', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Share buttons are present
// ---------------------------------------------------------------------------
async function testShareButtonsPresent() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/daily`);

    const shareLinks = await page.$$('#share-buttons a');
    if (shareLinks.length !== 2) {
      throw new Error(`Expected 2 share links (X + Facebook), got: ${shareLinks.length}`);
    }

    const copyBtn = await page.$('#copy-link-btn');
    if (!copyBtn) throw new Error('Copy link button not found');

    pass('testShareButtonsPresent');
  } catch (err) {
    fail('testShareButtonsPresent', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Quiz CTA link present
// ---------------------------------------------------------------------------
async function testQuizCTAPresent() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/daily`);

    const quizCta = await page.$('a[href="/quiz"]');
    if (!quizCta) throw new Error('Quiz CTA link (/quiz) not found on /daily page');

    pass('testQuizCTAPresent');
  } catch (err) {
    fail('testQuizCTAPresent', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: OG meta tags present
// ---------------------------------------------------------------------------
async function testDailyPageOGTags() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/daily`);

    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle?.includes('Daily Card Draw')) {
      throw new Error(`og:title should contain "Daily Card Draw", got: "${ogTitle}"`);
    }

    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogImage?.includes('daily.png')) {
      throw new Error(`og:image should reference daily.png, got: "${ogImage}"`);
    }

    const twitterCard = await page.$eval(
      'meta[name="twitter:card"]',
      (el) => el.getAttribute('content'),
    );
    if (twitterCard !== 'summary_large_image') {
      throw new Error(`twitter:card should be summary_large_image, got: "${twitterCard}"`);
    }

    pass('testDailyPageOGTags');
  } catch (err) {
    fail('testDailyPageOGTags', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n  Daily Page E2E Tests\n');

  await testDailyPageLoads();
  await testDateLabelRenders();
  await testShareButtonsPresent();
  await testQuizCTAPresent();
  await testDailyPageOGTags();

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failures.length > 0) {
    console.log('  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
```

**Step 8: Run E2E tests**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm run build && npm run preview &
sleep 3
npx tsx tests/daily-page.spec.ts
```

Expected: 5/5 E2E tests pass.

**Step 9: Commit**

```bash
git add tests/daily-draw.test.ts tests/daily-page.spec.ts
git commit -m "test: add daily-draw unit tests and daily-page E2E tests (frozen contract)"
```

---

## Task 5: Quality Gates

**Step 1: Run full test suite — confirm no regressions**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm test
```

Expected: all tests pass (original 341 + new daily-draw tests).

**Step 2: Final build verification**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && npm run build
```

Expected: clean build. `/daily` page in output. No TypeScript errors.

**Step 3: Frozen Test File verification**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight && bash scripts/verify-frozen.sh tests/daily-draw.test.ts
```

Expected: checksum matches baseline. File has not been modified since authorship.

**Step 4: Evaluation Protocol — 2 Evaluators**

Run after all tasks are complete. Deploy two evaluators with orthogonal lenses:

**Evaluator 1 — UX Lens**

Review `src/pages/daily.astro` and answer:

1. **Card flip animation**: Does the CSS transition feel smooth at 0.8s? Is `perspective: 1000px` the right depth for a tarot card aspect ratio (2:3)? Any jank on mobile Safari due to `transform-style: preserve-3d`?
2. **Mobile touch**: Is `cursor-pointer` sufficient for touch discoverability? Should the tap-hint text be more prominent on mobile?
3. **Loading state**: The page renders `"..."` in card fields before the client script runs. Is the flash-of-unstyled-content acceptable, or should initial `opacity-0` be used on the container to hide it until ready?
4. **Pre-reveal mode**: With `artReady: false` on all cards, the card back image is shown but the tap-to-flip interaction is disabled. Is this clear to users? Is a visual indicator needed?
5. **Share button X href**: In pre-reveal mode, the share text truncates `aerialConnection` at 100 chars with `...`. Is this the right length for X's 280-char limit given the URL also appears?
6. **Accessibility**: Are the share buttons keyboard-accessible? Does the copy button provide sufficient feedback (2s timeout)?

**Evaluator 2 — Correctness Lens**

Review `src/lib/daily-draw.ts`, `src/lib/card-data.ts`, and `tests/daily-draw.test.ts` and answer:

1. **Determinism**: Can you construct a date where `dateToSeed` produces the same seed as a different date? The polynomial hash `seed = seed * 31 + charCode` over 10 ASCII chars — is collision risk acceptable?
2. **Timezone handling**: The spec says "UTC date." Confirm that `new Date().toISOString().slice(0, 10)` in the page script correctly returns UTC date, not local. Does this match what `getDailyCard()` does in the unit under test?
3. **Pre/post reveal toggle**: The `REVEAL_DATE` constant is `new Date('2026-06-01T00:00:00Z')`. Confirm the comparison `new Date() >= REVEAL_DATE` is correct. What happens at exactly midnight UTC on June 1?
4. **Bounds safety**: `Math.floor(rng() * TOTAL_CARDS)` — can `rng()` ever return exactly 1.0, producing an out-of-bounds index? (Mulberry32 output range is `[0, 4294967295] / 4294967296`, so max is `0.9999999997...`. Safe.)
5. **PRNG duplication**: The page script inlines the PRNG and card data rather than importing from `src/lib/`. If the operator updates `card-data.ts` (e.g., to expand to 78 cards), will they remember to update the inlined copy in `daily.astro`? Flag this as a maintenance risk.
6. **Test coverage gaps**: Are there any invariants in `daily-draw.ts` not covered by the unit tests? (e.g., behavior when TOTAL_CARDS is 1, or PRNG output distribution uniformity across a full year of dates)

**Step 5: Synthesize evaluator findings**

Collect findings from both evaluators. Triage by severity:
- Critical (breaks correctness or user experience) → fix before merge
- High (significant UX issue) → fix before merge
- Medium → create follow-up task in TASKBOARD.md backlog
- Low / deferred → note in task-archive when closing sprint

**Step 6: Remediate critical and high findings**

For each critical/high finding: fix → run `npm test` → verify frozen test file → commit.

**Step 7: Archive sprint task in TASKBOARD.md**

Move "Sprint 2C: Daily Card Draw" from Active to task-archive with:
- Summary of what was built
- Evaluation findings (count by severity, what was remediated vs deferred)
- Handoff context: operator must update `CARDS` array and `REVEAL_DATE` when art is delivered

---

## Post-Sprint Note

After Sprint 2 integration (Tracks A, B, C all merged to main), run `/harden` against the full site to catch any cross-feature regressions introduced by the three parallel tracks shipping simultaneously.

---

## Operator Handoff Checklist

These actions are required from the operator after Sprint 2C ships:

1. **Card data**: Replace the 6 placeholder entries in `src/lib/card-data.ts` (and the inlined copy in `src/pages/daily.astro`) with all 78 cards when content is ready.
2. **Card art**: Place card art PNGs at `/public/images/cards/[slug].png` (1 file per card, named by slug). Set `artReady: true` on each card in the data arrays as art arrives.
3. **REVEAL_DATE**: Update `const REVEAL_DATE = new Date('2026-06-01T00:00:00Z')` in `src/pages/daily.astro` to the actual art reveal date once confirmed.
4. **OG image**: Replace `/public/images/og/daily.png` placeholder with a proper 1200x630 design.
5. **Card back image**: Replace `/public/images/cards/card-back.png` placeholder with the final card back design.
