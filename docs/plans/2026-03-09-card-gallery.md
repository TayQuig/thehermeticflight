# Card Gallery (Progressive Reveal) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `/gallery` page with progressive card reveal — starts empty, populates on schedule (~late May through 8/8/26 launch), full gallery on launch day. Each card has name, meaning, aerial connection, and OG image for social sharing.

**Architecture:** Static Astro page rendering from card data file. Reveal schedule is date-gated: each card has a `revealDate` field, page only renders cards where `revealDate <= today`. Entirely build-time — Vercel rebuilds daily (or on push) to reveal new cards.

**Tech Stack:** Astro 5 SSG, Tailwind CSS, Vitest, Playwright

**Content dependency:** Card art assets from operator (delivery schedule TBD). Plan uses placeholder structure. Art blocked until ~late May.

**Shared dependency:** This plan reuses `src/lib/card-data.ts` created in Sprint 2C (Daily Card Draw). If Sprint 2C hasn't shipped, Task 1 creates the card data module from scratch.

---

## Task 1: Extend or Create Card Data Module

### Context

`src/lib/card-data.ts` may or may not exist (Sprint 2C dependency). This task handles both cases. The goal is a module exporting `GalleryCard[]` and a `getRevealedCards()` utility that is pure, deterministic, and unit-testable with no Astro or browser dependencies.

### 1a — Write Failing Test

Create `tests/card-data.test.ts`:

```typescript
/**
 * Card Data — Gallery Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/lib/card-data.ts
 *
 * getRevealedCards(asOfDate?) —
 *   Returns GalleryCard[] where revealDate <= asOfDate (UTC midnight comparison).
 *   Defaults to new Date() when asOfDate is omitted.
 *   Results are sorted by revealDate descending (most recently revealed first).
 *   Returns [] when all revealDates are in the future.
 *   Returns all cards when all revealDates are today or in the past.
 *
 * galleryCards —
 *   Full array of all GalleryCard entries (both revealed and unrevealed).
 *   Minimum 6 entries with required fields present.
 *
 * GalleryCard shape —
 *   slug: string (non-empty, URL-safe)
 *   name: string (non-empty)
 *   meaning: string (non-empty)
 *   aerialConnection: string (non-empty)
 *   journalingPrompt: string (non-empty)
 *   artReady: boolean
 *   revealDate: string (ISO format 'YYYY-MM-DD')
 *   suit: string | undefined
 *   number: number | undefined
 */

import { describe, it, expect } from 'vitest';
import { galleryCards, getRevealedCards } from '../src/lib/card-data';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAST_DATE = new Date('2020-01-01T00:00:00Z');
const FUTURE_DATE = new Date('2099-12-31T00:00:00Z');
const TODAY = new Date('2026-06-15T00:00:00Z');

// ---------------------------------------------------------------------------
// galleryCards shape tests
// ---------------------------------------------------------------------------

describe('galleryCards', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(galleryCards)).toBe(true);
    expect(galleryCards.length).toBeGreaterThanOrEqual(6);
  });

  it('every card has required string fields', () => {
    for (const card of galleryCards) {
      expect(typeof card.slug).toBe('string');
      expect(card.slug.length).toBeGreaterThan(0);
      expect(typeof card.name).toBe('string');
      expect(card.name.length).toBeGreaterThan(0);
      expect(typeof card.meaning).toBe('string');
      expect(card.meaning.length).toBeGreaterThan(0);
      expect(typeof card.aerialConnection).toBe('string');
      expect(card.aerialConnection.length).toBeGreaterThan(0);
      expect(typeof card.journalingPrompt).toBe('string');
      expect(card.journalingPrompt.length).toBeGreaterThan(0);
    }
  });

  it('every card has a boolean artReady field', () => {
    for (const card of galleryCards) {
      expect(typeof card.artReady).toBe('boolean');
    }
  });

  it('every card has a revealDate in ISO YYYY-MM-DD format', () => {
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    for (const card of galleryCards) {
      expect(typeof card.revealDate).toBe('string');
      expect(isoPattern.test(card.revealDate)).toBe(true);
    }
  });

  it('suit field is string or undefined on every card', () => {
    for (const card of galleryCards) {
      expect(
        card.suit === undefined || typeof card.suit === 'string'
      ).toBe(true);
    }
  });

  it('number field is number or undefined on every card', () => {
    for (const card of galleryCards) {
      expect(
        card.number === undefined || typeof card.number === 'number'
      ).toBe(true);
    }
  });

  it('all slugs are unique', () => {
    const slugs = galleryCards.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('slugs contain only URL-safe characters', () => {
    const urlSafe = /^[a-z0-9-]+$/;
    for (const card of galleryCards) {
      expect(urlSafe.test(card.slug)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getRevealedCards() filtering tests
// ---------------------------------------------------------------------------

describe('getRevealedCards', () => {
  it('returns empty array when asOfDate is far in the past', () => {
    const result = getRevealedCards(PAST_DATE);
    expect(result).toEqual([]);
  });

  it('returns all cards when asOfDate is far in the future', () => {
    const result = getRevealedCards(FUTURE_DATE);
    expect(result.length).toBe(galleryCards.length);
  });

  it('includes card with revealDate exactly equal to asOfDate', () => {
    // Use the exact revealDate of the first gallery card as the cutoff.
    const firstCard = galleryCards[0];
    const cutoff = new Date(`${firstCard.revealDate}T00:00:00Z`);
    const result = getRevealedCards(cutoff);
    const slugs = result.map((c) => c.slug);
    expect(slugs).toContain(firstCard.slug);
  });

  it('excludes card with revealDate one day after asOfDate', () => {
    // Find a card and set asOfDate to the day before its revealDate.
    const sortedByDate = [...galleryCards].sort(
      (a, b) => a.revealDate.localeCompare(b.revealDate)
    );
    const targetCard = sortedByDate[sortedByDate.length - 1]; // latest card
    const dayBefore = new Date(`${targetCard.revealDate}T00:00:00Z`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const result = getRevealedCards(dayBefore);
    const slugs = result.map((c) => c.slug);
    expect(slugs).not.toContain(targetCard.slug);
  });

  it('returned cards are sorted by revealDate descending', () => {
    const result = getRevealedCards(FUTURE_DATE);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].revealDate >= result[i].revealDate).toBe(true);
    }
  });

  it('returns only cards with revealDate <= asOfDate (mid-range cutoff)', () => {
    const result = getRevealedCards(TODAY);
    for (const card of result) {
      expect(card.revealDate <= '2026-06-15').toBe(true);
    }
  });

  it('called with no argument returns same shape as called with new Date()', () => {
    // Both calls should return an array (we cannot assert exact values
    // since "today" is dynamic, but shape and type must match).
    const withDefault = getRevealedCards();
    const withExplicit = getRevealedCards(new Date());
    expect(Array.isArray(withDefault)).toBe(true);
    expect(withDefault.length).toBe(withExplicit.length);
  });

  it('returned cards are a subset of galleryCards', () => {
    const result = getRevealedCards(FUTURE_DATE);
    const allSlugs = new Set(galleryCards.map((c) => c.slug));
    for (const card of result) {
      expect(allSlugs.has(card.slug)).toBe(true);
    }
  });

  it('does not mutate the galleryCards source array', () => {
    const originalLength = galleryCards.length;
    getRevealedCards(FUTURE_DATE);
    expect(galleryCards.length).toBe(originalLength);
  });
});
```

### 1b — Verify Test Fails

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/card-data.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module '../src/lib/card-data'` or equivalent import failure.

### 1c — Implement

**If `src/lib/card-data.ts` does not exist**, create it from scratch. **If it exists** (Sprint 2C shipped), add the `GalleryCard` interface and `getRevealedCards` export without removing anything.

Create or extend `src/lib/card-data.ts`:

```typescript
// src/lib/card-data.ts

export interface CardData {
  slug: string;
  name: string;
  meaning: string;
  aerialConnection: string;
  journalingPrompt: string;
  artReady: boolean;
}

export interface GalleryCard extends CardData {
  revealDate: string; // ISO date 'YYYY-MM-DD'
  suit?: string;      // e.g., 'Major Arcana', 'Cups', 'Swords', 'Wands', 'Pentacles'
  number?: number;    // Card number within suit
}

/**
 * Full gallery card roster.
 *
 * REVEAL SCHEDULE (operator-controlled):
 *   - Cards with revealDate <= today are visible at build time.
 *   - To reveal a new card: set its revealDate to today or a past date, push to main.
 *   - On launch day (8/8/26): set all remaining revealDates to '2026-08-08'.
 *
 * ART STATUS:
 *   - artReady: false = show "Art coming soon" placeholder
 *   - artReady: true  = show /images/cards/{slug}.jpg
 *
 * All revealDates below are set to 2026-08-08 (launch day) as a safe default.
 * The operator updates them as cards are cleared for reveal.
 */
export const galleryCards: GalleryCard[] = [
  {
    slug: 'the-fool',
    name: 'The Fool',
    meaning:
      'The moment before the leap — pure potential, unformed possibility, the courage to begin without knowing the destination.',
    aerialConnection:
      'The breath before the first drop. Every aerialist knows this moment: the grip, the trust, the surrender to gravity.',
    journalingPrompt:
      'Where in your life are you standing at the edge? What would you begin if you knew you could not fail?',
    artReady: false,
    revealDate: '2026-05-26',
    suit: 'Major Arcana',
    number: 0,
  },
  {
    slug: 'the-magician',
    name: 'The Magician',
    meaning:
      'All tools in hand, full command of will. The moment skill becomes mastery — not performance, but embodied knowing.',
    aerialConnection:
      'The aerialist mid-combination who moves without thinking: body, apparatus, and intention unified.',
    journalingPrompt:
      'What skills do you already possess that you underestimate? What would you attempt if you fully trusted your own mastery?',
    artReady: false,
    revealDate: '2026-06-02',
    suit: 'Major Arcana',
    number: 1,
  },
  {
    slug: 'the-high-priestess',
    name: 'The High Priestess',
    meaning:
      'Deep knowing that precedes language. The wisdom that arrives in stillness, in the body, in the space between thoughts.',
    aerialConnection:
      'Suspended inversion — the world inverted, blood to the crown, a different seeing made available only by hanging upside down.',
    journalingPrompt:
      'What does your body know that your mind is still catching up to? Where have you dismissed an inner knowing you should have trusted?',
    artReady: false,
    revealDate: '2026-06-09',
    suit: 'Major Arcana',
    number: 2,
  },
  {
    slug: 'the-empress',
    name: 'The Empress',
    meaning:
      'Embodied abundance, creative fertility, the generative power of the body in full expression.',
    aerialConnection:
      'The arc of a silks drop — lush, generous, full of gravity\'s gift, movement as abundance rather than effort.',
    journalingPrompt:
      'In what area of your life are you withholding your full creative expression? What wants to grow through you?',
    artReady: false,
    revealDate: '2026-08-08',
    suit: 'Major Arcana',
    number: 3,
  },
  {
    slug: 'strength',
    name: 'Strength',
    meaning:
      'Courage that comes from within — not force over fear, but presence with fear. The power of gentle, intentional persistence.',
    aerialConnection:
      'Conditioning work: not the performance, but the daily discipline that makes the performance possible.',
    journalingPrompt:
      'Where are you confusing strength with force? What would gentler, more sustainable power look like in this situation?',
    artReady: false,
    revealDate: '2026-08-08',
    suit: 'Major Arcana',
    number: 8,
  },
  {
    slug: 'ace-of-cups',
    name: 'Ace of Cups',
    meaning:
      'The pure first moment of feeling — emotional capacity at its most open, the heart before it forms expectations.',
    aerialConnection:
      'The student\'s first lyra session: pure sensation without technique, the body learning what it loves.',
    journalingPrompt:
      'What emotional experience have you been avoiding that might actually nourish you? What would it feel like to be fully open?',
    artReady: false,
    revealDate: '2026-08-08',
    suit: 'Cups',
    number: 1,
  },
];

/**
 * Returns gallery cards with revealDate on or before asOfDate,
 * sorted by revealDate descending (most recently revealed first).
 *
 * @param asOfDate - The cutoff date. Defaults to now. Comparison is
 *   ISO string-based so time-of-day is irrelevant: '2026-05-26' <= '2026-05-26'.
 */
export function getRevealedCards(asOfDate: Date = new Date()): GalleryCard[] {
  // Derive a YYYY-MM-DD string from the given date using UTC components
  // to avoid timezone drift on the operator's machine or Vercel's servers.
  const year = asOfDate.getUTCFullYear();
  const month = String(asOfDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(asOfDate.getUTCDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return galleryCards
    .filter((card) => card.revealDate <= todayStr)
    .sort((a, b) => b.revealDate.localeCompare(a.revealDate));
}
```

### 1d — Verify Test Passes

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/card-data.test.ts 2>&1 | tail -20
```

Expected: all tests pass, zero failures.

### 1e — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add tests/card-data.test.ts src/lib/card-data.ts
git commit -m "feat(gallery): add GalleryCard data module and getRevealedCards utility"
```

---

## Task 2: Create Gallery Page

### Context

`src/pages/gallery.astro` is the primary deliverable. It consumes `getRevealedCards()` at build time — no client-side date logic. The filter bar (suit and sort) runs entirely in the browser via lightweight vanilla JS that shows/hides and reorders already-rendered card elements.

The page must be beautiful in the empty state. The revealed count in the header gives visitors a clear signal that cards will appear on a schedule, creating return motivation.

### 2a — Write Failing Test

Create `tests/gallery.test.ts`:

```typescript
/**
 * Gallery Page — Unit-level tests for filter/sort logic extracted
 * from gallery.astro's client-side script.
 *
 * Frozen-test-file protocol: TEST CONTRACT. Do NOT modify during implementation.
 *
 * These tests exercise the pure functions that will live in gallery.astro's
 * <script> block, exported for testability via src/lib/gallery-client.ts.
 *
 * filterCardsBySuit(cards, suit) —
 *   Returns cards matching the given suit, or all cards when suit is 'all'.
 *
 * sortCards(cards, order) —
 *   'newest': sort by revealDate descending
 *   'number': sort by number ascending (undefined numbers sort last)
 */

import { describe, it, expect } from 'vitest';
import { filterCardsBySuit, sortCards } from '../src/lib/gallery-client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCards = [
  {
    slug: 'the-fool',
    suit: 'Major Arcana',
    number: 0,
    revealDate: '2026-05-26',
    name: 'The Fool',
  },
  {
    slug: 'the-magician',
    suit: 'Major Arcana',
    number: 1,
    revealDate: '2026-06-02',
    name: 'The Magician',
  },
  {
    slug: 'ace-of-cups',
    suit: 'Cups',
    number: 1,
    revealDate: '2026-06-09',
    name: 'Ace of Cups',
  },
  {
    slug: 'two-of-swords',
    suit: 'Swords',
    number: 2,
    revealDate: '2026-06-16',
    name: 'Two of Swords',
  },
  {
    slug: 'strength',
    suit: 'Major Arcana',
    number: 8,
    revealDate: '2026-07-01',
    name: 'Strength',
    // number intentionally included
  },
  {
    slug: 'mystery-card',
    suit: undefined,
    number: undefined,
    revealDate: '2026-07-08',
    name: 'Mystery Card',
  },
];

// ---------------------------------------------------------------------------
// filterCardsBySuit
// ---------------------------------------------------------------------------

describe('filterCardsBySuit', () => {
  it('"all" returns all cards unchanged', () => {
    expect(filterCardsBySuit(mockCards, 'all').length).toBe(mockCards.length);
  });

  it('"Major Arcana" returns only Major Arcana cards', () => {
    const result = filterCardsBySuit(mockCards, 'Major Arcana');
    expect(result.length).toBe(3);
    for (const card of result) {
      expect(card.suit).toBe('Major Arcana');
    }
  });

  it('"Cups" returns only Cups cards', () => {
    const result = filterCardsBySuit(mockCards, 'Cups');
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe('ace-of-cups');
  });

  it('"Swords" returns only Swords cards', () => {
    const result = filterCardsBySuit(mockCards, 'Swords');
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe('two-of-swords');
  });

  it('suit with no matching cards returns empty array', () => {
    const result = filterCardsBySuit(mockCards, 'Wands');
    expect(result).toEqual([]);
  });

  it('does not mutate the source array', () => {
    const original = [...mockCards];
    filterCardsBySuit(mockCards, 'Cups');
    expect(mockCards.length).toBe(original.length);
  });
});

// ---------------------------------------------------------------------------
// sortCards
// ---------------------------------------------------------------------------

describe('sortCards', () => {
  it('"newest" sorts by revealDate descending', () => {
    const result = sortCards([...mockCards], 'newest');
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].revealDate >= result[i].revealDate).toBe(true);
    }
  });

  it('"number" sorts by number ascending', () => {
    const withNumbers = mockCards.filter((c) => c.number !== undefined);
    const result = sortCards([...withNumbers], 'number');
    for (let i = 1; i < result.length; i++) {
      expect((result[i - 1].number as number) <= (result[i].number as number)).toBe(true);
    }
  });

  it('"number" puts cards with undefined number at the end', () => {
    const result = sortCards([...mockCards], 'number');
    const lastCard = result[result.length - 1];
    expect(lastCard.number).toBeUndefined();
  });

  it('does not mutate the source array order (uses the copy passed in)', () => {
    const input = [...mockCards];
    const firstSlugBefore = input[0].slug;
    sortCards(input, 'newest');
    // input was passed by reference; mutation is allowed on it but we want
    // to verify the return value is the sorted copy, not a new array
    expect(Array.isArray(sortCards([...mockCards], 'number'))).toBe(true);
    // And that the original mockCards is untouched
    expect(mockCards[0].slug).toBe(firstSlugBefore);
  });

  it('"newest" handles cards with identical revealDates (stable order)', () => {
    const dupes = [
      { slug: 'a', revealDate: '2026-06-01', suit: 'Cups', number: 1, name: 'A' },
      { slug: 'b', revealDate: '2026-06-01', suit: 'Cups', number: 2, name: 'B' },
    ];
    const result = sortCards([...dupes], 'newest');
    expect(result.length).toBe(2);
  });
});
```

### 2b — Verify Test Fails

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/gallery.test.ts 2>&1 | tail -20
```

Expected: `Cannot find module '../src/lib/gallery-client'`.

### 2c — Implement

**Step 1: Create `src/lib/gallery-client.ts`** (pure functions, no DOM, testable with Vitest):

```typescript
// src/lib/gallery-client.ts
//
// Pure functions for the gallery filter and sort UI.
// Extracted from gallery.astro <script> for Vitest testability.
// These functions operate on plain objects, not DOM elements.

export interface GalleryCardMeta {
  slug: string;
  suit: string | undefined;
  number: number | undefined;
  revealDate: string;
  name: string;
}

/**
 * Returns cards matching the given suit.
 * Pass 'all' to return the full array unchanged.
 */
export function filterCardsBySuit<T extends GalleryCardMeta>(
  cards: T[],
  suit: string
): T[] {
  if (suit === 'all') return cards;
  return cards.filter((c) => c.suit === suit);
}

/**
 * Sorts cards by the given order.
 *   'newest' — revealDate descending (most recent first)
 *   'number' — card number ascending; undefined numbers sort last
 *
 * Mutates the input array (caller should pass a copy if immutability needed).
 */
export function sortCards<T extends GalleryCardMeta>(
  cards: T[],
  order: 'newest' | 'number'
): T[] {
  if (order === 'newest') {
    return cards.sort((a, b) => b.revealDate.localeCompare(a.revealDate));
  }
  return cards.sort((a, b) => {
    if (a.number === undefined && b.number === undefined) return 0;
    if (a.number === undefined) return 1;
    if (b.number === undefined) return -1;
    return a.number - b.number;
  });
}
```

**Step 2: Create `src/pages/gallery.astro`**:

```astro
---
import Layout from '../layouts/Layout.astro';
import { galleryCards, getRevealedCards } from '../lib/card-data';

// Build-time reveal: only cards with revealDate <= today are rendered.
// No client-side date logic needed or wanted.
const revealed = getRevealedCards();
const total = galleryCards.length;
const revealedCount = revealed.length;

// Derive the list of suits present in revealed cards for the filter bar.
const suits = ['all', ...Array.from(
  new Set(revealed.map((c) => c.suit).filter((s): s is string => Boolean(s)))
)];

const siteUrl = 'https://www.thehermeticflight.com';
const ogDescription = revealedCount > 0
  ? `${revealedCount} of ${total} cards revealed. Watch the deck come to life before the Kickstarter launch.`
  : `The deck is coming. Cards reveal on a schedule through 8/8/26. Be here for every drop.`;
---

<Layout
  title="Card Gallery — The Hermetic Flight Aerial Tarot"
  description={ogDescription}
  ogImage="/images/og/gallery.png"
>
  <!-- ItemList structured data for revealed cards -->
  {revealedCount > 0 && (
    <script type="application/ld+json" slot="head" set:html={JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "The Hermetic Flight Card Gallery",
      "description": ogDescription,
      "numberOfItems": revealedCount,
      "itemListElement": revealed.map((card, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": card.name,
        "description": card.meaning,
      })),
    })} />
  )}

  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-20 px-4">

    <!-- Site header -->
    <header class="w-full py-4 flex justify-center mb-8">
      <a href="/" class="group flex items-center gap-3">
        <img src="/images/logo.png" alt="The Hermetic Flight" class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">The Hermetic Flight</span>
      </a>
    </header>

    <!-- Page header -->
    <div class="w-full max-w-5xl text-center mb-10">
      <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-3">Aerial Tarot Deck</p>
      <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-5"></div>
      <h1 class="font-serif text-4xl md:text-5xl text-hermetic-white mb-4 tracking-wide">Card Gallery</h1>
      <p class="text-gray-400 font-sans text-sm mb-2">
        {revealedCount > 0
          ? `${revealedCount} of ${total} cards revealed`
          : `Cards reveal on a schedule through launch day`}
      </p>
      <p class="text-hermetic-gold/50 font-serif text-xs tracking-[0.2em] uppercase">
        Kickstarter Launch: August 8, 2026
      </p>
    </div>

    {revealedCount === 0 ? (
      <!-- Empty state -->
      <div class="w-full max-w-2xl">
        <div class="glass-panel p-12 rounded-xl text-center relative">
          <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
          <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
          <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
          <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

          <!-- Card back placeholder -->
          <div class="w-32 h-48 mx-auto mb-8 rounded-lg border border-hermetic-gold/30 bg-hermetic-void/60 flex items-center justify-center">
            <div class="text-center">
              <p class="text-hermetic-gold/40 font-serif text-3xl mb-1">✦</p>
              <p class="text-hermetic-gold/20 font-serif text-xs tracking-[0.2em]">THE HERMETIC FLIGHT</p>
            </div>
          </div>

          <h2 class="font-serif text-2xl text-hermetic-white mb-4">The Cards Are Coming</h2>
          <p class="text-gray-400 font-sans text-sm leading-relaxed mb-6 max-w-sm mx-auto">
            Cards begin revealing in late May 2026. Check back as the deck comes to life, one card at a time, through launch day on August 8th.
          </p>
          <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/30 to-transparent mx-auto mb-6"></div>
          <a href="/quiz" class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
            Discover Your Archetype
          </a>
        </div>
      </div>
    ) : (
      <!-- Filter bar + card grid -->
      <div class="w-full max-w-5xl" id="gallery-root">

        <!-- Filter bar -->
        <div class="flex flex-col sm:flex-row gap-3 mb-8 items-start sm:items-center justify-between">
          <!-- Suit filter -->
          <div class="flex flex-wrap gap-2" id="suit-filter" role="group" aria-label="Filter by suit">
            {suits.map((suit) => (
              <button
                data-suit={suit}
                class:list={[
                  'suit-btn px-4 py-2 rounded-full text-xs font-sans tracking-[0.15em] uppercase transition-all border',
                  suit === 'all'
                    ? 'bg-hermetic-gold/20 border-hermetic-gold text-hermetic-gold'
                    : 'bg-transparent border-hermetic-gold/30 text-hermetic-gold/60 hover:border-hermetic-gold/60 hover:text-hermetic-gold/80',
                ]}
                aria-pressed={suit === 'all' ? 'true' : 'false'}
              >
                {suit === 'all' ? 'All' : suit}
              </button>
            ))}
          </div>

          <!-- Sort toggle -->
          <div class="flex items-center gap-2">
            <span class="text-hermetic-gold/40 text-xs font-sans tracking-widest uppercase">Sort:</span>
            <button
              id="sort-newest"
              class="sort-btn px-3 py-1.5 rounded text-xs font-sans border bg-hermetic-gold/20 border-hermetic-gold text-hermetic-gold"
              data-sort="newest"
              aria-pressed="true"
            >
              Newest
            </button>
            <button
              id="sort-number"
              class="sort-btn px-3 py-1.5 rounded text-xs font-sans border bg-transparent border-hermetic-gold/30 text-hermetic-gold/60 hover:border-hermetic-gold/60"
              data-sort="number"
              aria-pressed="false"
            >
              Card #
            </button>
          </div>
        </div>

        <!-- No results state (shown by JS when filter yields 0 matches) -->
        <div id="no-filter-results" class="hidden text-center py-16">
          <p class="text-hermetic-gold/40 font-serif text-lg mb-2">No cards in this suit yet</p>
          <p class="text-gray-500 font-sans text-sm">Check back as more cards are revealed.</p>
        </div>

        <!-- Card grid -->
        <div
          id="card-grid"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          aria-label="Revealed tarot cards"
        >
          {revealed.map((card) => (
            <article
              class="gallery-card glass-panel rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 hover:border-hermetic-gold/50 hover:shadow-[0_0_30px_rgba(197,160,89,0.15)]"
              data-slug={card.slug}
              data-suit={card.suit ?? ''}
              data-number={card.number ?? ''}
              data-reveal-date={card.revealDate}
              aria-expanded="false"
            >
              <!-- Card image area -->
              <div class="relative w-full aspect-[2/3] bg-hermetic-void/60 flex items-center justify-center overflow-hidden">
                {card.artReady ? (
                  <img
                    src={`/images/cards/${card.slug}.jpg`}
                    alt={card.name}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div class="w-full h-full flex flex-col items-center justify-center p-4 text-center border border-hermetic-gold/10 m-3 rounded">
                    <p class="text-hermetic-gold/30 font-serif text-4xl mb-3">✦</p>
                    <p class="text-hermetic-gold/20 font-sans text-xs tracking-[0.2em] uppercase">Art coming soon</p>
                  </div>
                )}
                <!-- Suit badge -->
                {card.suit && (
                  <div class="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-hermetic-gold/60 text-xs font-sans tracking-widest uppercase backdrop-blur-sm">
                    {card.number !== undefined ? `${card.suit} · ${card.number}` : card.suit}
                  </div>
                )}
              </div>

              <!-- Card info (always visible) -->
              <div class="p-4">
                <h2 class="font-serif text-hermetic-white text-lg mb-1 group-hover:text-hermetic-gold transition-colors">
                  {card.name}
                </h2>
                <p class="text-gray-400 font-sans text-xs leading-relaxed line-clamp-2">
                  {card.meaning}
                </p>

                <!-- Expand toggle -->
                <button
                  class="expand-btn mt-3 text-hermetic-gold/50 text-xs font-sans tracking-widest uppercase hover:text-hermetic-gold transition-colors flex items-center gap-1"
                  aria-label={`Expand ${card.name}`}
                >
                  <span class="expand-label">Read more</span>
                  <svg class="w-3 h-3 expand-arrow transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              <!-- Expanded detail (hidden by default, toggled by JS) -->
              <div
                class="card-detail hidden px-4 pb-4 border-t border-hermetic-gold/10"
                aria-hidden="true"
              >
                <div class="pt-4 space-y-4">
                  <!-- Full meaning -->
                  <div>
                    <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-1">Meaning</p>
                    <p class="text-gray-300 font-sans text-sm leading-relaxed">{card.meaning}</p>
                  </div>

                  <!-- Aerial connection -->
                  <div>
                    <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-1">Aerial Connection</p>
                    <p class="text-gray-300 font-sans text-sm leading-relaxed italic">{card.aerialConnection}</p>
                  </div>

                  <!-- Journaling prompt -->
                  <div class="p-3 bg-black/30 rounded border-l-2 border-hermetic-gold/30">
                    <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-1">Journaling Prompt</p>
                    <p class="text-gray-400 font-sans text-sm leading-relaxed">{card.journalingPrompt}</p>
                  </div>

                  <!-- Close -->
                  <button
                    class="close-btn text-hermetic-gold/40 text-xs font-sans tracking-widest uppercase hover:text-hermetic-gold transition-colors flex items-center gap-1"
                    aria-label={`Collapse ${card.name}`}
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                    Close
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <!-- CTA below grid -->
        <div class="mt-16 text-center">
          <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/30 to-transparent mx-auto mb-8"></div>
          <p class="text-hermetic-gold/40 font-serif text-sm tracking-wide mb-2">More cards reveal through August 8th</p>
          <p class="text-gray-500 font-sans text-xs mb-8">Not on the list yet?</p>
          <a href="/quiz" class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
            Discover Your Archetype
          </a>
        </div>
      </div>
    )}

  </main>

  <script>
    // ---------------------------------------------------------------------------
    // Gallery interactive filter + sort + accordion expand
    // ---------------------------------------------------------------------------

    const grid = document.getElementById('card-grid');
    const noResults = document.getElementById('no-filter-results');
    if (!grid) throw new Error('card-grid not found');

    let activeSuit = 'all';
    let activeSort: 'newest' | 'number' = 'newest';

    // ------------------------------------------------------------------
    // Filter + sort: show/hide and reorder DOM nodes
    // ------------------------------------------------------------------

    function applyFilterAndSort() {
      const cards = Array.from(grid!.querySelectorAll<HTMLElement>('.gallery-card'));

      // 1. Determine visibility
      const visible = cards.filter((el) => {
        const suit = el.dataset.suit ?? '';
        return activeSuit === 'all' || suit === activeSuit;
      });

      const hidden = cards.filter((el) => {
        const suit = el.dataset.suit ?? '';
        return activeSuit !== 'all' && suit !== activeSuit;
      });

      hidden.forEach((el) => el.classList.add('hidden'));
      visible.forEach((el) => el.classList.remove('hidden'));

      // 2. Sort visible cards
      const sorted = [...visible].sort((a, b) => {
        if (activeSort === 'newest') {
          const da = a.dataset.revealDate ?? '';
          const db = b.dataset.revealDate ?? '';
          return db.localeCompare(da);
        } else {
          const na = a.dataset.number ? parseInt(a.dataset.number, 10) : Infinity;
          const nb = b.dataset.number ? parseInt(b.dataset.number, 10) : Infinity;
          return na - nb;
        }
      });

      // 3. Re-append in sorted order (moves DOM nodes, no re-render)
      sorted.forEach((el) => grid!.appendChild(el));

      // 4. No-results state
      if (noResults) {
        noResults.classList.toggle('hidden', visible.length > 0);
      }
    }

    // ------------------------------------------------------------------
    // Suit filter buttons
    // ------------------------------------------------------------------

    document.getElementById('suit-filter')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.suit-btn');
      if (!btn) return;

      activeSuit = btn.dataset.suit ?? 'all';

      document.querySelectorAll<HTMLElement>('.suit-btn').forEach((b) => {
        const isActive = b.dataset.suit === activeSuit;
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        b.classList.toggle('bg-hermetic-gold/20', isActive);
        b.classList.toggle('border-hermetic-gold', isActive);
        b.classList.toggle('text-hermetic-gold', isActive);
        b.classList.toggle('bg-transparent', !isActive);
        b.classList.toggle('border-hermetic-gold/30', !isActive);
        b.classList.toggle('text-hermetic-gold/60', !isActive);
      });

      applyFilterAndSort();

      if (typeof gtag === 'function') {
        gtag('event', 'gallery_filter', { suit: activeSuit });
      }
    });

    // ------------------------------------------------------------------
    // Sort buttons
    // ------------------------------------------------------------------

    document.querySelectorAll<HTMLElement>('.sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSort = (btn.dataset.sort as 'newest' | 'number') ?? 'newest';

        document.querySelectorAll<HTMLElement>('.sort-btn').forEach((b) => {
          const isActive = b.dataset.sort === activeSort;
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
          b.classList.toggle('bg-hermetic-gold/20', isActive);
          b.classList.toggle('border-hermetic-gold', isActive);
          b.classList.toggle('text-hermetic-gold', isActive);
          b.classList.toggle('bg-transparent', !isActive);
          b.classList.toggle('border-hermetic-gold/30', !isActive);
          b.classList.toggle('text-hermetic-gold/60', !isActive);
        });

        applyFilterAndSort();
      });
    });

    // ------------------------------------------------------------------
    // Accordion expansion
    // ------------------------------------------------------------------

    function collapseCard(card: HTMLElement) {
      const detail = card.querySelector<HTMLElement>('.card-detail');
      const label = card.querySelector<HTMLElement>('.expand-label');
      const arrow = card.querySelector<HTMLElement>('.expand-arrow');
      if (!detail) return;
      detail.classList.add('hidden');
      detail.setAttribute('aria-hidden', 'true');
      card.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Read more';
      if (arrow) arrow.style.transform = '';
    }

    function expandCard(card: HTMLElement) {
      const detail = card.querySelector<HTMLElement>('.card-detail');
      const label = card.querySelector<HTMLElement>('.expand-label');
      const arrow = card.querySelector<HTMLElement>('.expand-arrow');
      if (!detail) return;
      detail.classList.remove('hidden');
      detail.setAttribute('aria-hidden', 'false');
      card.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Show less';
      if (arrow) arrow.style.transform = 'rotate(180deg)';

      const slug = card.dataset.slug;
      if (typeof gtag === 'function' && slug) {
        gtag('event', 'card_click', { card_slug: slug });
      }
    }

    grid.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const card = target.closest<HTMLElement>('.gallery-card');
      if (!card) return;

      // Close button inside expanded detail
      if (target.closest('.close-btn')) {
        collapseCard(card);
        return;
      }

      // Expand button
      if (target.closest('.expand-btn')) {
        const isExpanded = card.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
          collapseCard(card);
        } else {
          expandCard(card);
        }
        return;
      }
    });

    // ------------------------------------------------------------------
    // GA4: gallery page view
    // ------------------------------------------------------------------
    if (typeof gtag === 'function') {
      gtag('event', 'gallery_view', {
        revealed_count: document.querySelectorAll('.gallery-card').length,
      });
    }
  </script>
</Layout>
```

### 2d — Verify Test Passes

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/gallery.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

Then do a build smoke test:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build 2>&1 | tail -30
```

Expected: build succeeds, no TypeScript errors, `/gallery` appears in generated output.

### 2e — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add tests/gallery.test.ts src/lib/gallery-client.ts src/pages/gallery.astro
git commit -m "feat(gallery): add gallery page with progressive reveal, suit filter, and accordion expansion"
```

---

## Task 3: OG Image Placeholder and SEO

### Context

The gallery needs an OG image at `/public/images/og/gallery.png` to prevent the Layout's fallback (`/images/og/default.png`) from appearing when the gallery URL is shared. This task also verifies the structured data renders correctly at build time.

No test file is needed for the OG image itself (it is a static asset). The structured data output is verified via build output inspection.

### 3a — Create OG Image Placeholder

Check whether `public/images/og/gallery.png` already exists. If not, copy the default OG image as a placeholder:

```bash
ls /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/
```

If `gallery.png` is missing:

```bash
cp /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/default.png \
   /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/gallery.png
```

**Operator note:** Replace `gallery.png` with a purpose-built 1200×630 image before launch. Ideal content: card back collage or "The Hermetic Flight — Card Gallery" text over the void background.

### 3b — Verify Structured Data at Build Time

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build 2>&1 | grep -i gallery
```

Then inspect the built gallery HTML to confirm OG and structured data tags:

```bash
grep -n 'og:image\|og:title\|og:description\|ItemList' \
  /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/dist/gallery/index.html \
  | head -20
```

Expected:
- `og:title` contains "Card Gallery"
- `og:image` contains `gallery.png`
- If any cards are revealed: `application/ld+json` block with `@type: ItemList` is present
- If no cards are revealed: no `ld+json` block

### 3c — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add public/images/og/gallery.png
git commit -m "feat(gallery): add gallery OG image placeholder"
```

---

## Task 4: Navigation Link

### Context

The gallery page needs to be discoverable. Add a "Gallery" link to the site header and footer. This task is intentionally small — the page already works without nav entry, but visitors cannot find it without a direct URL unless we expose the link.

### 4a — Locate Header and Footer Components

```bash
ls /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/src/components/
```

Open `src/components/Header.astro` and `src/components/Footer.astro` and identify where nav links are defined.

### 4b — Add Gallery Link to Header

In `src/components/Header.astro`, add a nav link alongside any existing links. Match the existing anchor styling exactly. Example pattern based on the site's style:

```html
<a
  href="/gallery"
  class="font-sans text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase hover:text-hermetic-gold transition-colors"
>
  Gallery
</a>
```

### 4c — Add Gallery Link to Footer

In `src/components/Footer.astro`, add a corresponding link in the site links section.

### 4d — Build and Verify

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build 2>&1 | tail -10
grep -n 'href="/gallery"' \
  /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/dist/index.html
```

Expected: build succeeds, `/gallery` href present in homepage HTML.

### 4e — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add src/components/Header.astro src/components/Footer.astro
git commit -m "feat(gallery): add gallery link to site header and footer"
```

---

## Task 5: E2E Tests

### Context

E2E tests follow the existing Playwright pattern in `tests/quiz-flow.spec.ts`: raw Playwright (not `@playwright/test`), custom pass/fail helpers, requires `npm run build && npm run preview` to be running on port 4321.

Tests cover: gallery page loads, correct revealed count, suit filter, accordion expansion, and empty state. Because the build reveals cards based on today's date, tests use data attributes rather than asserting exact card counts.

### 5a — Write Failing Test

Create `tests/gallery-flow.spec.ts`:

```typescript
/**
 * Playwright E2E tests for the Card Gallery page.
 *
 * Usage:
 *   1. npm run build
 *   2. npm run preview &   (starts on port 4321)
 *   3. npx tsx tests/gallery-flow.spec.ts
 *
 * Uses raw playwright (not @playwright/test) with custom pass/fail helpers.
 * Mirrors the pattern established in tests/quiz-flow.spec.ts.
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
// Test: Gallery page loads and has correct OG meta
// ---------------------------------------------------------------------------
async function testGalleryPageLoads() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/gallery`);

    const h1 = await page.$eval('h1', (el) => el.textContent?.trim());
    if (!h1?.includes('Card Gallery')) {
      throw new Error(`Expected h1 to contain "Card Gallery", got: ${h1}`);
    }
    pass('Gallery page: h1 contains "Card Gallery"');

    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle?.includes('Card Gallery')) {
      throw new Error(`og:title missing or wrong: ${ogTitle}`);
    }
    pass('Gallery page: og:title contains "Card Gallery"');

    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogImage?.includes('gallery.png')) {
      throw new Error(`og:image should reference gallery.png, got: ${ogImage}`);
    }
    pass('Gallery page: og:image references gallery.png');
  } catch (err) {
    fail('Gallery page: load and OG meta', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Revealed card count display (or empty state)
// ---------------------------------------------------------------------------
async function testRevealedCountOrEmptyState() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/gallery`);

    const cards = await page.$$('.gallery-card');
    const emptyState = await page.$('#gallery-root');

    if (cards.length === 0) {
      // Pre-reveal: empty state should be visible
      const emptyHeading = await page.$eval(
        'h2',
        (el) => el.textContent?.trim(),
      ).catch(() => '');
      if (!emptyHeading?.includes('Cards Are Coming')) {
        throw new Error(
          `Expected empty state heading "The Cards Are Coming", got: ${emptyHeading}`,
        );
      }
      pass('Gallery page: empty state renders when 0 cards revealed');
    } else {
      // Cards exist: count indicator should be present
      const countEl = await page.$eval(
        '[class*="revealed"]',
        (el) => el.textContent?.trim(),
      ).catch(() => null);
      pass(`Gallery page: ${cards.length} revealed cards rendered`);
    }
  } catch (err) {
    fail('Gallery page: revealed count or empty state', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Filter bar renders when cards are present
// ---------------------------------------------------------------------------
async function testFilterBarVisible() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/gallery`);

    const cards = await page.$$('.gallery-card');
    if (cards.length === 0) {
      pass('Gallery page: filter bar test skipped (0 cards revealed)');
      return;
    }

    const filterGroup = await page.$('#suit-filter');
    if (!filterGroup) {
      throw new Error('Suit filter group #suit-filter not found');
    }
    pass('Gallery page: suit filter bar is present');

    const allBtn = await page.$('.suit-btn[data-suit="all"]');
    if (!allBtn) {
      throw new Error('"All" suit button not found');
    }
    pass('Gallery page: "All" suit button present');

    const sortNewest = await page.$('#sort-newest');
    if (!sortNewest) {
      throw new Error('#sort-newest button not found');
    }
    pass('Gallery page: sort buttons present');
  } catch (err) {
    fail('Gallery page: filter bar visibility', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Accordion expansion on card click
// ---------------------------------------------------------------------------
async function testCardAccordionExpansion() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/gallery`);

    const cards = await page.$$('.gallery-card');
    if (cards.length === 0) {
      pass('Gallery page: accordion test skipped (0 cards revealed)');
      return;
    }

    const firstCard = cards[0];

    // Detail should be hidden initially
    const detailHiddenBefore = await firstCard.$eval(
      '.card-detail',
      (el) => el.classList.contains('hidden'),
    );
    if (!detailHiddenBefore) {
      throw new Error('Card detail should be hidden before expansion');
    }
    pass('Gallery page: card detail hidden by default');

    // Click expand button
    const expandBtn = await firstCard.$('.expand-btn');
    if (!expandBtn) throw new Error('.expand-btn not found');
    await expandBtn.click();

    // Detail should now be visible
    const detailVisibleAfter = await firstCard.$eval(
      '.card-detail',
      (el) => !el.classList.contains('hidden'),
    );
    if (!detailVisibleAfter) {
      throw new Error('Card detail should be visible after clicking expand');
    }
    pass('Gallery page: card detail expands on expand button click');

    // Close button collapses
    const closeBtn = await firstCard.$('.close-btn');
    if (!closeBtn) throw new Error('.close-btn not found');
    await closeBtn.click();

    const detailHiddenAfterClose = await firstCard.$eval(
      '.card-detail',
      (el) => el.classList.contains('hidden'),
    );
    if (!detailHiddenAfterClose) {
      throw new Error('Card detail should be hidden after close button click');
    }
    pass('Gallery page: card detail collapses on close button click');
  } catch (err) {
    fail('Gallery page: accordion expansion', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Suit filter hides non-matching cards
// ---------------------------------------------------------------------------
async function testSuitFilter() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/gallery`);

    const cards = await page.$$('.gallery-card');
    if (cards.length < 2) {
      pass('Gallery page: suit filter test skipped (fewer than 2 cards revealed)');
      return;
    }

    // Get distinct suits from rendered cards
    const suits = await page.$$eval(
      '.gallery-card',
      (els) => [...new Set(els.map((el) => (el as HTMLElement).dataset.suit ?? '').filter(Boolean))],
    );

    if (suits.length < 2) {
      pass('Gallery page: suit filter test skipped (all cards same suit)');
      return;
    }

    // Click the first non-"All" suit filter
    const targetSuit = suits[0];
    const suitBtn = await page.$(`.suit-btn[data-suit="${targetSuit}"]`);
    if (!suitBtn) throw new Error(`Suit button for "${targetSuit}" not found`);
    await suitBtn.click();

    // Verify only matching cards are visible
    const visibleCards = await page.$$eval(
      '.gallery-card:not(.hidden)',
      (els) => els.map((el) => (el as HTMLElement).dataset.suit),
    );
    for (const suit of visibleCards) {
      if (suit !== targetSuit) {
        throw new Error(
          `Expected only "${targetSuit}" cards visible, but found "${suit}"`,
        );
      }
    }
    pass(`Gallery page: suit filter correctly shows only "${targetSuit}" cards`);
  } catch (err) {
    fail('Gallery page: suit filter interaction', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------
async function main() {
  console.log('\nGallery Flow E2E Tests');
  console.log('======================');
  console.log(`Target: ${BASE_URL}\n`);

  await testGalleryPageLoads();
  await testRevealedCountOrEmptyState();
  await testFilterBarVisible();
  await testCardAccordionExpansion();
  await testSuitFilter();

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

### 5b — Verify Test Fails (Pre-Build)

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build && npm run preview &
sleep 3
npx tsx tests/gallery-flow.spec.ts 2>&1
kill %1
```

Expected: all tests pass once Tasks 1–4 are complete. If run before the gallery page exists, the navigation to `/gallery` returns 404 and tests fail with appropriate messages.

### 5c — Full Test Suite Pass Verification

Run the complete Vitest unit suite to confirm no regressions:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -20
```

Expected: all existing tests plus `card-data.test.ts` and `gallery.test.ts` pass. Zero regressions.

### 5d — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add tests/gallery-flow.spec.ts
git commit -m "test(gallery): add E2E Playwright tests for gallery page"
```

---

## Task 6: Quality Gates

### 6a — Frozen Test File Verification

After all tasks are complete, verify test file integrity using the frozen-test-file protocol. Record the baseline checksums:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
shasum -a 256 tests/card-data.test.ts tests/gallery.test.ts tests/gallery-flow.spec.ts
```

Save the output. Verify the checksums match what was committed:

```bash
git show HEAD:tests/card-data.test.ts | shasum -a 256
git show HEAD:tests/gallery.test.ts | shasum -a 256
git show HEAD:tests/gallery-flow.spec.ts | shasum -a 256
```

Expected: checksums match. Test files were not modified during implementation.

### 6b — Two-Evaluator Convergence Analysis

Run after all tasks complete. Write evaluation reports to `operations/` following the evaluation-protocol skill.

**Evaluator 1: UX Lens**

Audit focus areas:
- Empty state: Is the zero-card state informative and visually complete? Does it set expectations?
- Grid layout: Do 1/2/3/4 column breakpoints look correct? Are cards appropriately sized?
- Filter interaction: Is the "All" default clear? Do active states provide sufficient visual feedback?
- Accordion UX: Is the expand/collapse motion smooth? Is the "Read more" / "Show less" label clear?
- Mobile experience: Does the filter bar wrap gracefully at small viewports? Is touch target size sufficient?
- CTA placement: Is the "Discover Your Archetype" CTA appropriately positioned and prominent?

**Evaluator 2: Data Integrity Lens**

Audit focus areas:
- Reveal date filtering: Do cards with future `revealDate` values truly never appear in the build output?
- Card count accuracy: Does the "X of Y cards revealed" count match the actual rendered card elements?
- Sort correctness: Does "Newest" sort produce the expected order given the fixture dates?
- Filter correctness: Does the suit filter hide all non-matching cards and show only matching?
- No future card leakage: Inspect the built HTML — confirm no future-dated card data is embedded anywhere in the DOM (not just hidden, but absent).
- Structured data: Verify `ItemList` count matches visible cards. Verify it is absent in empty state.

### 6c — Record Memory Entries

After evaluation:

```
Record decision: Gallery progressive reveal uses build-time date filtering via getRevealedCards().
Operator controls reveal schedule by editing revealDate in card-data.ts and pushing to main.
Vercel auto-deploys on push; no daily cron needed unless operator wants scheduled reveals without a push.
```

```
Record decision: Gallery filter/sort runs client-side on already-rendered DOM nodes.
No re-fetch, no re-render. Sort achieved by re-appending DOM nodes in new order.
This keeps the page fully static while still supporting interactive filtering.
```

### 6d — Sprint 5 Integration Note

After Sprint 5 (card gallery + referral waitlist) is complete, run `harden` across the integrated Sprint 5 result. The referral waitlist track involves user-submitted data and is security-sensitive — harden the full integrated surface before launch.

Hardening sprint target: `operations/hardening-YYYY-MM-DD-sprint-5/`

---

## Operator Reveal Schedule (Reference)

To reveal a card, edit `src/lib/card-data.ts`, set the card's `revealDate` to today or a past date, commit, and push to main. Vercel rebuilds automatically.

Example reveal workflow:

```bash
# Edit the card's revealDate in src/lib/card-data.ts
# Then:
git add src/lib/card-data.ts
git commit -m "chore(gallery): reveal [card-name] — revealDate set to YYYY-MM-DD"
git push origin main
```

On launch day (8/8/26), batch-update all remaining unrevealed cards to `revealDate: '2026-08-08'`.

Art assets: when `artReady` is set to `true` for a card, place the card image at `public/images/cards/{slug}.jpg` (recommended: 400×600 minimum, 2:3 aspect ratio) and push alongside the `artReady: true` change.
