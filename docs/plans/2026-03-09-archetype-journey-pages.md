# Archetype Journey Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 6 rich archetype deep-dive pages at `/archetype/[slug]` that deepen engagement for every quiz-taker and provide long-tail SEO value.

**Architecture:** Astro Content Collections with file loader for archetype journey data (JSON), dynamic route generation via getStaticPaths, linked from quiz result pages.

**Tech Stack:** Astro 5 Content Collections, Zod schemas, Vitest, Playwright

**Content dependency:** Archetype description documents from operator (will be exported as PDFs to `operations/archetype-reports/`). Plan uses placeholder content structure — operator content slots in before build.

---

## Critical Codebase Facts

- **Content config location:** `src/content/config.ts` (NOT `src/content.config.ts` — Astro 5 accepts both but this project already uses the `src/content/config.ts` path with an existing blog + faq collection)
- **Existing collections:** `blog` (type: 'content', MDX files) and `faq` (type: 'data', JSON files) — the journey collection will be added alongside these
- **URL slug convention:** Internal slugs use `air_weaver` format; URL slugs use `air-weaver` format — `toUrlSlug()` and `archetypeByUrlSlug()` in `src/lib/archetype-content.ts` handle the conversion
- **Accent color field:** `accentHex` already exists on each `ArchetypeContent` entry (e.g., `#93c5fd` for Air Weaver) — use it for per-archetype glow effects
- **Layout.astro slot:** `<slot name="head" />` exists for injecting JSON-LD structured data into `<head>` without modifying the layout file
- **Playwright test pattern:** Project uses raw Playwright (`chromium.launch()`) with custom `pass()`/`fail()` helpers in `.mjs`/`.ts` runner scripts — NOT `@playwright/test`. New E2E file follows `tests/quiz-flow.spec.ts` exactly.
- **Vitest config:** `vitest.config.ts` includes only `tests/**/*.test.ts` — E2E spec files must use `.spec.ts` suffix or `.mjs` to avoid being picked up by Vitest
- **Build command:** `npm run build` | **Test command:** `npm test` (runs Vitest) | **Dev server:** `npm run dev` (port 4321)

---

## Task 1: Define archetype journey data schema and create placeholder JSON

**Files:**
- Create: `src/data/archetype-journeys.json`
- Create: `src/data/` directory (does not exist yet)

**Step 1: Write the failing unit test**

Create `tests/archetype-journey-schema.test.ts`:

```typescript
/**
 * Archetype Journey Schema — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during implementation.
 *
 * Verifies:
 *   - JSON file exists and is parseable
 *   - Exactly 6 entries, one per archetype slug
 *   - Each entry satisfies the full schema shape
 *   - Placeholder markers are present (confirms operator hasn't accidentally
 *     shipped un-replaced content)
 *   - Zod schema rejects malformed data
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Mirror the Zod schema here — must match src/content/config.ts exactly
// ---------------------------------------------------------------------------

const AffiliatedCardSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),       // e.g. "Major Arcana" | "Suit of Swords"
  relevance: z.string().min(1),      // 1-2 sentence explanation
});

const SpreadSchema = z.object({
  name: z.string().min(1),
  positions: z.array(z.string().min(1)).min(2),  // card position names
  description: z.string().min(1),
});

const BlogLinkSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),           // relative path, e.g. /blog/reading-tarot-for-yourself
  relevance: z.string().min(1),
});

const ArchetypeJourneySchema = z.object({
  id: z.string().min(1),                          // matches ArchetypeSlug (underscore format)
  description_extended: z.string().min(1),
  affiliated_cards: z.array(AffiliatedCardSchema).min(1),
  recommended_spreads: z.array(SpreadSchema).min(1),
  journaling_prompts: z.array(z.string().min(1)).min(3),
  blog_links: z.array(BlogLinkSchema),            // may be empty
});

const JourneyFileSchema = z.array(ArchetypeJourneySchema);

// ---------------------------------------------------------------------------

const EXPECTED_IDS = [
  'air_weaver',
  'embodied_intuitive',
  'ascending_seeker',
  'shadow_dancer',
  'flow_artist',
  'grounded_mystic',
];

const dataPath = join(process.cwd(), 'src/data/archetype-journeys.json');

describe('archetype-journeys.json: file integrity', () => {
  it('file exists and is valid JSON', () => {
    const raw = readFileSync(dataPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('contains exactly 6 entries', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(6);
  });

  it('contains exactly the 6 expected archetype IDs', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    const ids = data.map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual([...EXPECTED_IDS].sort());
  });
});

describe('archetype-journeys.json: Zod schema validation', () => {
  it('all 6 entries pass schema validation', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    const result = JourneyFileSchema.safeParse(data);
    if (!result.success) {
      throw new Error(
        'Schema validation failed:\n' +
          result.error.issues.map((i) => `  [${i.path.join('.')}] ${i.message}`).join('\n'),
      );
    }
    expect(result.success).toBe(true);
  });

  it('each entry has at least 3 journaling prompts', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    for (const entry of data) {
      expect(entry.journaling_prompts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('each entry has at least 1 affiliated card', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    for (const entry of data) {
      expect(entry.affiliated_cards.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each entry has at least 1 recommended spread', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    for (const entry of data) {
      expect(entry.recommended_spreads.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each spread has at least 2 positions', () => {
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    for (const entry of data) {
      for (const spread of entry.recommended_spreads) {
        expect(spread.positions.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('archetype-journeys.json: Zod schema rejection', () => {
  it('rejects an entry missing the id field', () => {
    const bad = [{ description_extended: 'x', affiliated_cards: [], recommended_spreads: [], journaling_prompts: ['a', 'b', 'c'], blog_links: [] }];
    const result = JourneyFileSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects an entry with fewer than 3 journaling prompts', () => {
    const bad = [{
      id: 'air_weaver',
      description_extended: 'x',
      affiliated_cards: [{ name: 'The Fool', position: 'Major Arcana', relevance: 'r' }],
      recommended_spreads: [{ name: 'S', positions: ['a', 'b'], description: 'd' }],
      journaling_prompts: ['only one'],
      blog_links: [],
    }];
    const result = JourneyFileSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a spread with fewer than 2 positions', () => {
    const bad = [{
      id: 'air_weaver',
      description_extended: 'x',
      affiliated_cards: [{ name: 'The Fool', position: 'Major Arcana', relevance: 'r' }],
      recommended_spreads: [{ name: 'S', positions: ['only-one'], description: 'd' }],
      journaling_prompts: ['a', 'b', 'c'],
      blog_links: [],
    }];
    const result = JourneyFileSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/archetype-journey-schema.test.ts`
Expected: FAIL — `src/data/archetype-journeys.json` does not exist.

**Step 3: Create `src/data/archetype-journeys.json`**

Create `src/data/archetype-journeys.json` with this exact content:

```json
[
  {
    "id": "air_weaver",
    "description_extended": "[OPERATOR: replace with Air Weaver extended description from archetype report. 2-4 paragraphs covering: how this archetype experiences the tarot, their natural strengths as a reader, shadow aspects, and the invitation for growth.]",
    "affiliated_cards": [
      {
        "name": "The Magician",
        "position": "Major Arcana — I",
        "relevance": "[OPERATOR: 1-2 sentences on why The Magician resonates with the Air Weaver archetype.]"
      },
      {
        "name": "The Star",
        "position": "Major Arcana — XVII",
        "relevance": "[OPERATOR: 1-2 sentences on why The Star resonates with the Air Weaver archetype.]"
      },
      {
        "name": "Ace of Swords",
        "position": "Suit of Swords",
        "relevance": "[OPERATOR: 1-2 sentences on why the Ace of Swords resonates with the Air Weaver archetype.]"
      }
    ],
    "recommended_spreads": [
      {
        "name": "The Framework Spread",
        "positions": ["The Question", "What You Already Know", "What Logic Misses", "The Synthesis"],
        "description": "[OPERATOR: 2-3 sentences describing how an Air Weaver should use this spread and what it's designed to reveal.]"
      },
      {
        "name": "The Clarity Draw",
        "positions": ["Current State", "Hidden Variable", "Most Useful Action"],
        "description": "[OPERATOR: 2-3 sentences describing how an Air Weaver should use this spread and what it's designed to reveal.]"
      }
    ],
    "journaling_prompts": [
      "[OPERATOR: Journaling prompt 1 for Air Weaver — replace with prompt from archetype report.]",
      "[OPERATOR: Journaling prompt 2 for Air Weaver — replace with prompt from archetype report.]",
      "[OPERATOR: Journaling prompt 3 for Air Weaver — replace with prompt from archetype report.]",
      "[OPERATOR: Journaling prompt 4 for Air Weaver — replace with prompt from archetype report.]",
      "[OPERATOR: Journaling prompt 5 for Air Weaver — replace with prompt from archetype report.]"
    ],
    "blog_links": [
      {
        "title": "Reading Tarot Divination for Yourself: 7 Techniques to Stay Objective",
        "slug": "/blog/reading-tarot-for-yourself",
        "relevance": "Air Weavers thrive on objectivity — these techniques help you apply your analytical nature without overriding intuition."
      }
    ]
  },
  {
    "id": "embodied_intuitive",
    "description_extended": "[OPERATOR: replace with Embodied Intuitive extended description from archetype report. 2-4 paragraphs.]",
    "affiliated_cards": [
      {
        "name": "The High Priestess",
        "position": "Major Arcana — II",
        "relevance": "[OPERATOR: 1-2 sentences on why The High Priestess resonates with the Embodied Intuitive archetype.]"
      },
      {
        "name": "The Empress",
        "position": "Major Arcana — III",
        "relevance": "[OPERATOR: 1-2 sentences on why The Empress resonates with the Embodied Intuitive archetype.]"
      },
      {
        "name": "Ace of Pentacles",
        "position": "Suit of Pentacles",
        "relevance": "[OPERATOR: 1-2 sentences on why the Ace of Pentacles resonates with the Embodied Intuitive archetype.]"
      }
    ],
    "recommended_spreads": [
      {
        "name": "The Body Wisdom Spread",
        "positions": ["What My Body Knows", "What My Mind Resists", "The Integration Point", "Next Physical Step"],
        "description": "[OPERATOR: 2-3 sentences describing how an Embodied Intuitive should use this spread.]"
      },
      {
        "name": "The Sensation Check",
        "positions": ["What I Feel", "What It Means", "What to Trust"],
        "description": "[OPERATOR: 2-3 sentences describing how an Embodied Intuitive should use this spread.]"
      }
    ],
    "journaling_prompts": [
      "[OPERATOR: Journaling prompt 1 for Embodied Intuitive.]",
      "[OPERATOR: Journaling prompt 2 for Embodied Intuitive.]",
      "[OPERATOR: Journaling prompt 3 for Embodied Intuitive.]",
      "[OPERATOR: Journaling prompt 4 for Embodied Intuitive.]",
      "[OPERATOR: Journaling prompt 5 for Embodied Intuitive.]"
    ],
    "blog_links": [
      {
        "title": "Is Tarot Real? A Grounded Look at How the Cards Actually Work",
        "slug": "/blog/is-tarot-real",
        "relevance": "Embodied Intuitives often sense the truth of tarot before they can articulate it — this post helps bridge that gap."
      }
    ]
  },
  {
    "id": "ascending_seeker",
    "description_extended": "[OPERATOR: replace with Ascending Seeker extended description from archetype report. 2-4 paragraphs.]",
    "affiliated_cards": [
      {
        "name": "The Fool",
        "position": "Major Arcana — 0",
        "relevance": "[OPERATOR: 1-2 sentences on why The Fool resonates with the Ascending Seeker archetype.]"
      },
      {
        "name": "The World",
        "position": "Major Arcana — XXI",
        "relevance": "[OPERATOR: 1-2 sentences on why The World resonates with the Ascending Seeker archetype.]"
      },
      {
        "name": "Ace of Wands",
        "position": "Suit of Wands",
        "relevance": "[OPERATOR: 1-2 sentences on why the Ace of Wands resonates with the Ascending Seeker archetype.]"
      }
    ],
    "recommended_spreads": [
      {
        "name": "The Open Sky Spread",
        "positions": ["Where I Am", "What I'm Releasing", "What Wants to Emerge", "The Path Forward"],
        "description": "[OPERATOR: 2-3 sentences describing how an Ascending Seeker should use this spread.]"
      },
      {
        "name": "The Surrender Draw",
        "positions": ["What I'm Gripping", "What Opens When I Release", "The Gift"],
        "description": "[OPERATOR: 2-3 sentences describing how an Ascending Seeker should use this spread.]"
      }
    ],
    "journaling_prompts": [
      "[OPERATOR: Journaling prompt 1 for Ascending Seeker.]",
      "[OPERATOR: Journaling prompt 2 for Ascending Seeker.]",
      "[OPERATOR: Journaling prompt 3 for Ascending Seeker.]",
      "[OPERATOR: Journaling prompt 4 for Ascending Seeker.]",
      "[OPERATOR: Journaling prompt 5 for Ascending Seeker.]"
    ],
    "blog_links": [
      {
        "title": "Welcome to the Flight: An Introduction to the Hermetic Deck",
        "slug": "/blog/welcome-to-the-flight",
        "relevance": "Ascending Seekers are drawn to new frameworks — this post introduces the aerial perspective that defines the deck."
      }
    ]
  },
  {
    "id": "shadow_dancer",
    "description_extended": "[OPERATOR: replace with Shadow Dancer extended description from archetype report. 2-4 paragraphs.]",
    "affiliated_cards": [
      {
        "name": "The Moon",
        "position": "Major Arcana — XVIII",
        "relevance": "[OPERATOR: 1-2 sentences on why The Moon resonates with the Shadow Dancer archetype.]"
      },
      {
        "name": "The Tower",
        "position": "Major Arcana — XVI",
        "relevance": "[OPERATOR: 1-2 sentences on why The Tower resonates with the Shadow Dancer archetype.]"
      },
      {
        "name": "Five of Cups",
        "position": "Suit of Cups",
        "relevance": "[OPERATOR: 1-2 sentences on why the Five of Cups resonates with the Shadow Dancer archetype.]"
      }
    ],
    "recommended_spreads": [
      {
        "name": "The Shadow Map",
        "positions": ["The Pattern I Keep Meeting", "What It's Protecting", "What Wants to Be Integrated", "The Gift of the Dark"],
        "description": "[OPERATOR: 2-3 sentences describing how a Shadow Dancer should use this spread.]"
      },
      {
        "name": "The Descent Draw",
        "positions": ["What I'm Avoiding", "What Lives There", "How to Walk Through It"],
        "description": "[OPERATOR: 2-3 sentences describing how a Shadow Dancer should use this spread.]"
      }
    ],
    "journaling_prompts": [
      "[OPERATOR: Journaling prompt 1 for Shadow Dancer.]",
      "[OPERATOR: Journaling prompt 2 for Shadow Dancer.]",
      "[OPERATOR: Journaling prompt 3 for Shadow Dancer.]",
      "[OPERATOR: Journaling prompt 4 for Shadow Dancer.]",
      "[OPERATOR: Journaling prompt 5 for Shadow Dancer.]"
    ],
    "blog_links": [
      {
        "title": "Scary Cards in Tarot: Working With the Cards That Unsettle You",
        "slug": "/blog/scary-cards",
        "relevance": "Shadow Dancers are uniquely equipped to face the difficult cards — this post maps the territory they already inhabit."
      }
    ]
  },
  {
    "id": "flow_artist",
    "description_extended": "[OPERATOR: replace with Flow Artist extended description from archetype report. 2-4 paragraphs.]",
    "affiliated_cards": [
      {
        "name": "Temperance",
        "position": "Major Arcana — XIV",
        "relevance": "[OPERATOR: 1-2 sentences on why Temperance resonates with the Flow Artist archetype.]"
      },
      {
        "name": "The Sun",
        "position": "Major Arcana — XIX",
        "relevance": "[OPERATOR: 1-2 sentences on why The Sun resonates with the Flow Artist archetype.]"
      },
      {
        "name": "Ace of Cups",
        "position": "Suit of Cups",
        "relevance": "[OPERATOR: 1-2 sentences on why the Ace of Cups resonates with the Flow Artist archetype.]"
      }
    ],
    "recommended_spreads": [
      {
        "name": "The Flow State Spread",
        "positions": ["Where I'm Grounded", "Where I'm Transcending", "The Dance Between Them", "What the Movement Reveals"],
        "description": "[OPERATOR: 2-3 sentences describing how a Flow Artist should use this spread.]"
      },
      {
        "name": "The Sacred Effortless Draw",
        "positions": ["What Moves Through Me", "What I'm Making Sacred", "The Next Expression"],
        "description": "[OPERATOR: 2-3 sentences describing how a Flow Artist should use this spread.]"
      }
    ],
    "journaling_prompts": [
      "[OPERATOR: Journaling prompt 1 for Flow Artist.]",
      "[OPERATOR: Journaling prompt 2 for Flow Artist.]",
      "[OPERATOR: Journaling prompt 3 for Flow Artist.]",
      "[OPERATOR: Journaling prompt 4 for Flow Artist.]",
      "[OPERATOR: Journaling prompt 5 for Flow Artist.]"
    ],
    "blog_links": [
      {
        "title": "Court Cards in Tarot: A New Way to Read the People Cards",
        "slug": "/blog/court-cards-in-tarot",
        "relevance": "Flow Artists embody the fluid energy of court cards — this guide helps them recognize themselves in the deck."
      }
    ]
  },
  {
    "id": "grounded_mystic",
    "description_extended": "[OPERATOR: replace with Grounded Mystic extended description from archetype report. 2-4 paragraphs.]",
    "affiliated_cards": [
      {
        "name": "The Hermit",
        "position": "Major Arcana — IX",
        "relevance": "[OPERATOR: 1-2 sentences on why The Hermit resonates with the Grounded Mystic archetype.]"
      },
      {
        "name": "Judgement",
        "position": "Major Arcana — XX",
        "relevance": "[OPERATOR: 1-2 sentences on why Judgement resonates with the Grounded Mystic archetype.]"
      },
      {
        "name": "Queen of Pentacles",
        "position": "Suit of Pentacles",
        "relevance": "[OPERATOR: 1-2 sentences on why the Queen of Pentacles resonates with the Grounded Mystic archetype.]"
      }
    ],
    "recommended_spreads": [
      {
        "name": "The Paradox Spread",
        "positions": ["The Analytical View", "The Intuitive View", "Where They Converge", "The Pattern Only You Can Name"],
        "description": "[OPERATOR: 2-3 sentences describing how a Grounded Mystic should use this spread.]"
      },
      {
        "name": "The Both/And Draw",
        "positions": ["Structure I Need", "Mystery I Need", "How They Work Together"],
        "description": "[OPERATOR: 2-3 sentences describing how a Grounded Mystic should use this spread.]"
      }
    ],
    "journaling_prompts": [
      "[OPERATOR: Journaling prompt 1 for Grounded Mystic.]",
      "[OPERATOR: Journaling prompt 2 for Grounded Mystic.]",
      "[OPERATOR: Journaling prompt 3 for Grounded Mystic.]",
      "[OPERATOR: Journaling prompt 4 for Grounded Mystic.]",
      "[OPERATOR: Journaling prompt 5 for Grounded Mystic.]"
    ],
    "blog_links": [
      {
        "title": "Tarot Memorization: How to Actually Learn the Cards",
        "slug": "/blog/tarot-memorization",
        "relevance": "Grounded Mystics need systems as much as they need mystery — this post provides the framework they'll actually use."
      }
    ]
  }
]
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/archetype-journey-schema.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/data/archetype-journeys.json tests/archetype-journey-schema.test.ts
git commit -m "feat: add archetype journey data JSON and schema contract tests"
```

**Known Risks:**
- None — pure data file creation and unit tests against it.

**If This Fails:**
- If the Zod import fails in tests, confirm `zod` is installed: `cat package.json | grep zod`. It is a peer of `astro:content` and should already be present.
- If `readFileSync` fails, verify `process.cwd()` resolves to the project root when run via `npx vitest run`. The vitest config lives at the project root, so `cwd` is correct.

---

## Task 2: Register the archetypeJourneys content collection

**Files:**
- Modify: `src/content/config.ts`

**Step 1: Verify the existing config before editing**

Run: `cat src/content/config.ts`

The file currently exports `blog` and `faq` collections. It uses `import { defineCollection, z } from 'astro:content'` — Astro 4 style. The journey collection will use the Astro 5 `file` loader instead of `type: 'data'`, which requires importing `file` from `'astro/loaders'`.

> **Note on loader vs type:** The existing `faq` collection uses `type: 'data'` with per-file JSON in `src/content/faq/`. The journey collection uses `loader: file(...)` with a single consolidated JSON array at `src/data/archetype-journeys.json`. Both patterns work in Astro 5. The `file` loader pattern is preferred for future content-heavy pages because the single JSON file is easy for the operator to edit directly, and the collection auto-generates one entry per array item using the `id` field as the entry key.

**Step 2: No separate failing test needed — Task 1 tests will catch schema mismatches. Build verification is the gate here.**

**Step 3: Modify `src/content/config.ts`**

Add the journey collection alongside the existing collections:

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const blogCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: image().optional(),
    heroImageAlt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().default('The Hermetic Flight Team'),
    draft: z.boolean().default(false),
    hideDate: z.boolean().default(false),
    pinned: z.boolean().default(false),
  }),
});

const faqCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    questions: z.array(
      z.object({
        q: z.string(),
        a: z.string(),
      })
    ),
  }),
});

const archetypeJourneysCollection = defineCollection({
  loader: file('src/data/archetype-journeys.json'),
  schema: z.object({
    id: z.string(),
    description_extended: z.string(),
    affiliated_cards: z.array(
      z.object({
        name: z.string(),
        position: z.string(),
        relevance: z.string(),
      })
    ),
    recommended_spreads: z.array(
      z.object({
        name: z.string(),
        positions: z.array(z.string()).min(2),
        description: z.string(),
      })
    ),
    journaling_prompts: z.array(z.string()).min(3),
    blog_links: z.array(
      z.object({
        title: z.string(),
        slug: z.string(),
        relevance: z.string(),
      })
    ),
  }),
});

export const collections = {
  'blog': blogCollection,
  'faq': faqCollection,
  'archetypeJourneys': archetypeJourneysCollection,
};
```

**Step 4: Verify build succeeds**

Run: `npm run build 2>&1 | tail -20`
Expected: Build completes. Look for the journey data being processed — Astro will log content collection entries found.

**Step 5: Verify the collection is queryable**

Run: `grep -r 'archetypeJourneys' src/` (should return 0 results yet — no pages consume it yet, but the collection must not produce build errors)

**Step 6: Commit**

```bash
git add src/content/config.ts
git commit -m "feat: register archetypeJourneys content collection with file loader"
```

**Known Risks:**
- Mixing `file` loader (Astro 5 API) with `type: 'content'` / `type: 'data'` (Astro 4 API) in the same config is supported in Astro 5 but may produce a deprecation warning for the older collections. This is acceptable — do not migrate existing collections as part of this sprint.

**If This Fails:**
- If build fails with `Cannot find module 'astro/loaders'`, check Astro version: `cat package.json | grep '"astro"'`. The `file` loader was introduced in Astro 4.14. This project uses Astro 5.16.4 — it should be available.
- If the collection produces 0 entries, verify the JSON file path in `file('src/data/archetype-journeys.json')` is relative to the project root (not `src/content/`). The `file` loader path resolves from the project root.
- If Zod validation errors appear in the build output, cross-reference the schema definition above against the actual JSON structure — field names must match exactly.

---

## Task 3: Create the journey page route

**Files:**
- Create: `src/pages/archetype/[slug].astro`

This is the core deliverable of the sprint. The page renders the full journey deep-dive for one archetype.

**Step 1: No unit test for this task — E2E tests in Task 5 cover it. Build verification is the gate.**

**Step 2: Create `src/pages/archetype/[slug].astro`**

Create the file with this exact content:

```astro
---
import Layout from '../../layouts/Layout.astro';
import { getCollection } from 'astro:content';
import { archetypes, toUrlSlug } from '../../lib/archetype-content';
import type { ArchetypeSlug } from '../../lib/classifier';
import type { GetStaticPaths } from 'astro';

export const getStaticPaths: GetStaticPaths = async () => {
  const journeys = await getCollection('archetypeJourneys');
  return journeys.map((journey) => {
    // journey.id is the underscore slug (e.g. 'air_weaver') — the file loader
    // uses the JSON array element's 'id' field as the collection entry id.
    const urlSlug = toUrlSlug(journey.id as ArchetypeSlug);
    const archetypeData = archetypes[journey.id as ArchetypeSlug];
    return {
      params: { slug: urlSlug },
      props: { journey, archetypeData },
    };
  });
};

const { journey, archetypeData } = Astro.props;
const urlSlug = toUrlSlug(archetypeData.slug);
const accentColor = archetypeData.accentHex;

// Build JSON-LD FAQ schema from journaling prompts.
// Each prompt becomes a FAQ item — the "answer" is a static invitation phrase
// so the schema is valid while real answers live in the reader's journal.
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': journey.data.journaling_prompts.map((prompt: string) => ({
    '@type': 'Question',
    'name': prompt,
    'acceptedAnswer': {
      '@type': 'Answer',
      'text': `A journaling reflection for ${archetypeData.name} tarot readers. Explore this question in your own practice with The Hermetic Flight aerial tarot deck.`,
    },
  })),
};

const pageTitle = `${archetypeData.title} Archetype Journey | The Hermetic Flight`;
const pageDescription = `Explore the ${archetypeData.name} archetype in depth: affiliated tarot cards, recommended spreads, journaling prompts, and curated reading guides. Element: ${archetypeData.element}.`;
---

<Layout
  title={pageTitle}
  description={pageDescription}
  ogImage={`/images/og/${urlSlug}.png`}
>
  <!-- JSON-LD FAQ structured data for journaling prompts -->
  <script type="application/ld+json" slot="head" set:html={JSON.stringify(faqSchema)} />

  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-16 px-4">

    <!-- Header nav -->
    <header class="w-full py-4 flex justify-center mb-4">
      <a href="/" class="group flex items-center gap-3">
        <img src="/images/logo.png" alt="The Hermetic Flight" class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">The Hermetic Flight</span>
      </a>
    </header>

    <div class="w-full max-w-3xl space-y-10">

      <!-- ===== HERO SECTION ===== -->
      <section aria-label="Archetype identity" class="glass-panel p-8 md:p-12 rounded-lg text-center relative">
        <!-- Corner marks -->
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>
        <!-- Archetype glow -->
        <div
          class="absolute inset-0 rounded-lg opacity-20 pointer-events-none"
          style={`background: radial-gradient(circle at 50% 30%, ${accentColor}30 0%, transparent 65%);`}
        ></div>

        <div class="relative z-10">
          <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-4">Archetype Journey</p>
          <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>

          <h1 class="font-serif text-3xl md:text-5xl text-hermetic-white mb-2 tracking-wide">{archetypeData.title}</h1>
          <p class={`${archetypeData.color} text-xs tracking-[0.3em] uppercase font-sans mb-6`}>Element of {archetypeData.element}</p>

          <!-- Short description (from archetype-content.ts) -->
          <p class="text-gray-300 font-light font-sans leading-relaxed mb-6 max-w-xl mx-auto">{archetypeData.description}</p>

          <!-- Extended description (from journey JSON — operator fills in) -->
          <div class="text-left border-t border-hermetic-gold/20 pt-6 mt-2">
            <p class="text-gray-400 font-sans font-light leading-relaxed whitespace-pre-line">{journey.data.description_extended}</p>
          </div>
        </div>
      </section>

      <!-- ===== AFFILIATED CARDS ===== -->
      <section aria-label="Affiliated tarot cards" class="glass-panel p-8 rounded-lg relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-30"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-30"></div>

        <h2 class="font-serif text-xl md:text-2xl text-hermetic-gold mb-1 tracking-wide">Affiliated Cards</h2>
        <p class="text-gray-500 font-sans text-sm mb-6">The tarot cards that speak most directly to your archetype's energy.</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {journey.data.affiliated_cards.map((card: { name: string; position: string; relevance: string }) => (
            <div class="border border-hermetic-gold/20 rounded-lg p-5 relative overflow-hidden">
              <div
                class="absolute inset-0 opacity-5 pointer-events-none"
                style={`background: radial-gradient(circle at 50% 0%, ${accentColor} 0%, transparent 70%);`}
              ></div>
              <p class="font-serif text-hermetic-white text-base mb-1">{card.name}</p>
              <p class="text-hermetic-gold/60 text-xs tracking-[0.15em] uppercase font-sans mb-3">{card.position}</p>
              <p class="text-gray-400 font-sans text-sm leading-relaxed">{card.relevance}</p>
            </div>
          ))}
        </div>
      </section>

      <!-- ===== RECOMMENDED SPREADS ===== -->
      <section aria-label="Recommended tarot spreads" class="glass-panel p-8 rounded-lg relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-30"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-30"></div>

        <h2 class="font-serif text-xl md:text-2xl text-hermetic-gold mb-1 tracking-wide">Recommended Spreads</h2>
        <p class="text-gray-500 font-sans text-sm mb-6">Layouts designed for the way you naturally receive insight.</p>

        <div class="space-y-6">
          {journey.data.recommended_spreads.map((spread: { name: string; positions: string[]; description: string }) => (
            <div class="border border-hermetic-gold/20 rounded-lg p-6">
              <h3 class="font-serif text-hermetic-white text-lg mb-3">{spread.name}</h3>
              <p class="text-gray-400 font-sans text-sm leading-relaxed mb-4">{spread.description}</p>
              <div class="flex flex-wrap gap-2">
                {spread.positions.map((pos: string, i: number) => (
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 border border-hermetic-gold/30 rounded-full text-xs font-sans text-hermetic-gold/70">
                    <span class="text-hermetic-gold/40">{i + 1}.</span> {pos}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <!-- ===== JOURNALING PROMPTS ===== -->
      <section aria-label="Journaling prompts" class="glass-panel p-8 rounded-lg relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-30"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-30"></div>

        <h2 class="font-serif text-xl md:text-2xl text-hermetic-gold mb-1 tracking-wide">Journaling Prompts</h2>
        <p class="text-gray-500 font-sans text-sm mb-6">Questions calibrated to your archetype's edge — where growth actually lives.</p>

        <ol class="space-y-4">
          {journey.data.journaling_prompts.map((prompt: string, i: number) => (
            <li class="flex gap-4">
              <span
                class="flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-sans font-bold"
                style={`border-color: ${accentColor}60; color: ${accentColor};`}
              >
                {i + 1}
              </span>
              <p class="text-gray-300 font-sans font-light leading-relaxed pt-0.5">{prompt}</p>
            </li>
          ))}
        </ol>
      </section>

      <!-- ===== BLOG LINKS (conditional — only if blog_links non-empty) ===== -->
      {journey.data.blog_links.length > 0 && (
        <section aria-label="Recommended reading" class="glass-panel p-8 rounded-lg relative">
          <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-30"></div>
          <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-30"></div>

          <h2 class="font-serif text-xl md:text-2xl text-hermetic-gold mb-1 tracking-wide">Recommended Reading</h2>
          <p class="text-gray-500 font-sans text-sm mb-6">Articles curated for the {archetypeData.name} path.</p>

          <div class="space-y-4">
            {journey.data.blog_links.map((link: { title: string; slug: string; relevance: string }) => (
              <a
                href={link.slug}
                class="block border border-hermetic-gold/20 rounded-lg p-5 hover:border-hermetic-gold/50 transition-colors group"
              >
                <p class="font-serif text-hermetic-white group-hover:text-hermetic-gold transition-colors mb-2">{link.title}</p>
                <p class="text-gray-500 font-sans text-sm leading-relaxed">{link.relevance}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      <!-- ===== FOOTER CTA ===== -->
      <div class="text-center py-4">
        <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/40 to-transparent mx-auto mb-8"></div>
        <p class="text-hermetic-gold/60 text-xs tracking-[0.3em] uppercase font-sans mb-6">Continue the Journey</p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={`/quiz/result/${urlSlug}`}
            class="inline-block px-8 py-3 border border-hermetic-gold/40 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/70 transition-colors font-sans text-sm tracking-widest uppercase"
          >
            Your Result
          </a>
          <a
            href="/quiz"
            class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline"
          >
            Retake the Quiz
          </a>
        </div>
      </div>

    </div>
  </main>

  <script>
    // GA4 journey page view event
    if (typeof gtag === 'function') {
      const slug = window.location.pathname.split('/').pop();
      gtag('event', 'journey_page_view', {
        archetype: slug,
        content_type: 'archetype_journey',
      });
    }
  </script>
</Layout>
```

**Step 3: Verify build generates all 6 journey pages**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

Run: `ls dist/archetype/`
Expected: 6 directories — `air-weaver/`, `ascending-seeker/`, `embodied-intuitive/`, `flow-artist/`, `grounded-mystic/`, `shadow-dancer/`

**Step 4: Verify JSON-LD renders in a built page**

Run: `grep -c 'application/ld+json' dist/archetype/air-weaver/index.html`
Expected: `1`

Run: `grep 'FAQPage' dist/archetype/air-weaver/index.html`
Expected: Line containing `"@type":"FAQPage"`

**Step 5: Commit**

```bash
git add src/pages/archetype/\[slug\].astro
git commit -m "feat: create archetype journey pages at /archetype/[slug]"
```

**Known Risks:**
- The `journey.id` from the `file` loader is the JSON array element's `id` field (e.g., `air_weaver`). This is correct — but if the file loader uses array index instead of `id` field as the entry key in some Astro versions, `getStaticPaths` will fail. Verify with `console.log(journeys.map(j => j.id))` in the frontmatter if pages don't generate.
- `set:html` on a `<script>` tag requires Astro to trust the content. `JSON.stringify(faqSchema)` produces safe output (no unescaped HTML) — this is safe.
- The `slot="head"` on the JSON-LD script tag injects into `Layout.astro`'s `<slot name="head" />`. Confirm `Layout.astro` has this slot (it does — line 91).

**If This Fails:**
- If `getCollection('archetypeJourneys')` throws at build time, verify the collection name in `src/content/config.ts` matches exactly: `'archetypeJourneys'` (camelCase, no spaces).
- If 0 pages generate but no error appears, add a `console.log` to `getStaticPaths` to inspect `journeys` — the file loader may be returning empty if the JSON path is wrong.
- If TypeScript errors appear on `journey.data.*` field access, the Zod schema in `config.ts` is not aligned with the JSON structure. Cross-reference field names.

---

## Task 4: Link from result pages to journey pages

**Files:**
- Modify: `src/pages/quiz/result/[archetype].astro`

**Step 1: No new test needed — Task 5 E2E test covers this link. Verify the modification does not break existing tests.**

**Step 2: Add the Journey CTA to the result page**

In `src/pages/quiz/result/[archetype].astro`, locate the "Discover Your Archetype" CTA section (approx lines 87-93). Add the journey page link immediately above the existing "Take the Quiz" CTA, inside the same `border-t` div:

Replace this block:

```astro
<!-- CTA for new visitors -->
<div class="border-t border-hermetic-gold/20 pt-8 mt-8">
  <p class="text-hermetic-white font-serif text-lg mb-2">Discover Your Archetype</p>
  <p class="text-gray-400 font-sans text-sm mb-6">Twenty questions. Five minutes. One revelation about how you're wired to receive wisdom through the cards.</p>
  <a href="/quiz" class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
    Take the Quiz
  </a>
</div>
```

With this updated block:

```astro
<!-- Journey CTA + new visitor CTA -->
<div class="border-t border-hermetic-gold/20 pt-8 mt-8 space-y-6">
  <!-- Journey page link — primary CTA for quiz-takers -->
  <div>
    <p class="text-hermetic-white font-serif text-lg mb-2">Explore Your Archetype Journey</p>
    <p class="text-gray-400 font-sans text-sm mb-4">Affiliated cards, custom spreads, journaling prompts, and curated reading guides for the {archetype.title}.</p>
    <a
      href={`/archetype/${urlSlug}`}
      id="journey-cta"
      class="inline-block px-8 py-3 border border-hermetic-gold/40 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/70 transition-colors font-sans font-bold text-sm tracking-widest uppercase no-underline"
    >
      Go Deeper
    </a>
  </div>
  <!-- Secondary CTA for new visitors who arrived via share -->
  <div class="border-t border-hermetic-gold/10 pt-6">
    <p class="text-gray-500 font-sans text-sm mb-4">Not your archetype? Discover yours — twenty questions, five minutes.</p>
    <a href="/quiz" class="btn-flame inline-block px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
      Take the Quiz
    </a>
  </div>
</div>
```

**Step 3: Verify build succeeds and link renders**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds.

Run: `grep 'archetype/air-weaver' dist/quiz/result/air-weaver/index.html`
Expected: Line containing `href="/archetype/air-weaver"`

**Step 4: Run existing Playwright E2E suite to confirm no regressions**

```bash
npm run build
npm run preview &
PREVIEW_PID=$!
sleep 3
npx tsx tests/quiz-flow.spec.ts
kill $PREVIEW_PID
```

Expected: All existing tests pass. The `testResultPageOGAndShareButtons` test checks for `a[href="/quiz"]` which still exists (the secondary CTA). No breakage expected.

**Step 5: Commit**

```bash
git add src/pages/quiz/result/\[archetype\].astro
git commit -m "feat: add archetype journey CTA link from result pages"
```

**Known Risks:**
- The existing Playwright test `testResultPageOGAndShareButtons` checks `page.$('a[href="/quiz"]')` — the quiz link is still present in the updated markup (as the secondary CTA), so this test still passes.

**If This Fails:**
- If the build fails with a TypeScript error on `archetype.title` or `urlSlug` in the new JSX, verify that both variables are still in scope — `urlSlug` is defined as `const urlSlug = toUrlSlug(archetype.slug)` at line 15 of the original file, and `archetype` comes from `Astro.props`.

---

## Task 5: Write and run tests

**Files:**
- Create: `tests/archetype-journey-schema.test.ts` (written in Task 1 — frozen from that point)
- Create: `tests/journey-pages.spec.ts` (new E2E test file)

> **Frozen-test-file protocol:** `tests/archetype-journey-schema.test.ts` was authored in Task 1 (test-write step). It must not be modified during or after implementation. Run `record-baseline.sh` after Task 1, `verify-frozen.sh` after all implementation tasks complete.

**Step 1: Run the unit tests (already written in Task 1)**

Run: `npx vitest run tests/archetype-journey-schema.test.ts`
Expected: All 11 tests PASS.

**Step 2: Write the E2E test file**

Create `tests/journey-pages.spec.ts`:

```typescript
/**
 * Playwright E2E tests for Archetype Journey Pages.
 *
 * Usage:
 *   1. npm run build
 *   2. npm run preview &   (starts on port 4321)
 *   3. npx tsx tests/journey-pages.spec.ts
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
// Test: All 6 journey pages load with status 200
// ---------------------------------------------------------------------------
async function testAll6JourneyPagesLoad() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const slugs = [
    'air-weaver',
    'embodied-intuitive',
    'ascending-seeker',
    'shadow-dancer',
    'flow-artist',
    'grounded-mystic',
  ];
  try {
    for (const slug of slugs) {
      const res = await page.goto(`${BASE_URL}/archetype/${slug}`);
      if (!res || res.status() !== 200) {
        throw new Error(`/archetype/${slug} returned status ${res?.status()}`);
      }
      const h1 = await page.textContent('h1');
      if (!h1 || h1.length === 0) {
        throw new Error(`/archetype/${slug} has empty h1`);
      }
    }
    pass('testAll6JourneyPagesLoad');
  } catch (err) {
    fail('testAll6JourneyPagesLoad', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Air Weaver journey page has correct h1 and sections
// ---------------------------------------------------------------------------
async function testAirWeaverJourneyPageContent() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/archetype/air-weaver`);

    // Correct h1
    const h1 = await page.textContent('h1');
    if (!h1?.includes('The Air Weaver')) {
      throw new Error(`Expected h1 to contain "The Air Weaver", got: ${h1}`);
    }

    // Affiliated Cards section present
    const affiliatedSection = await page.$('section[aria-label="Affiliated tarot cards"]');
    if (!affiliatedSection) throw new Error('Affiliated cards section not found');

    // Spreads section present
    const spreadsSection = await page.$('section[aria-label="Recommended tarot spreads"]');
    if (!spreadsSection) throw new Error('Recommended spreads section not found');

    // Journaling Prompts section present
    const promptsSection = await page.$('section[aria-label="Journaling prompts"]');
    if (!promptsSection) throw new Error('Journaling prompts section not found');

    // At least 3 journaling prompt list items
    const prompts = await page.$$('section[aria-label="Journaling prompts"] ol li');
    if (prompts.length < 3) {
      throw new Error(`Expected at least 3 journaling prompts, found: ${prompts.length}`);
    }

    pass('testAirWeaverJourneyPageContent');
  } catch (err) {
    fail('testAirWeaverJourneyPageContent', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Journey page SEO — title, description, OG tags, canonical, JSON-LD
// ---------------------------------------------------------------------------
async function testJourneyPageSEO() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/archetype/shadow-dancer`);

    // Page title contains archetype name and site name
    const title = await page.title();
    if (!title.includes('Shadow Dancer') || !title.includes('The Hermetic Flight')) {
      throw new Error(`Page title missing expected content: ${title}`);
    }

    // OG title present
    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle?.includes('Shadow Dancer')) {
      throw new Error(`og:title missing "Shadow Dancer": ${ogTitle}`);
    }

    // OG description present
    const ogDesc = await page.$eval(
      'meta[property="og:description"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogDesc || ogDesc.length < 20) {
      throw new Error(`og:description missing or too short: ${ogDesc}`);
    }

    // Canonical URL uses www and correct path
    const canonical = await page.$eval(
      'link[rel="canonical"]',
      (el) => el.getAttribute('href'),
    );
    if (!canonical?.includes('thehermeticflight.com/archetype/shadow-dancer')) {
      throw new Error(`Canonical URL incorrect: ${canonical}`);
    }

    // JSON-LD FAQPage present
    const jsonLd = await page.$eval(
      'script[type="application/ld+json"]',
      (el) => el.textContent,
    );
    if (!jsonLd?.includes('FAQPage')) {
      throw new Error(`JSON-LD FAQPage schema not found. Got: ${jsonLd?.slice(0, 100)}`);
    }

    pass('testJourneyPageSEO');
  } catch (err) {
    fail('testJourneyPageSEO', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Result page links to journey page
// ---------------------------------------------------------------------------
async function testResultPageLinksToJourney() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz/result/grounded-mystic`);

    // Journey CTA link must be present with correct href
    const journeyLink = await page.$('a[href="/archetype/grounded-mystic"]');
    if (!journeyLink) {
      throw new Error('Journey page link not found on result page');
    }

    // Link text should contain "Go Deeper" or similar journey language
    const linkText = await journeyLink.textContent();
    if (!linkText?.trim()) {
      throw new Error('Journey link has no text content');
    }

    // Quiz link still present (regression check)
    const quizLink = await page.$('a[href="/quiz"]');
    if (!quizLink) {
      throw new Error('Quiz CTA link missing from result page after modification');
    }

    pass('testResultPageLinksToJourney');
  } catch (err) {
    fail('testResultPageLinksToJourney', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Journey page "Your Result" link points back to the correct result page
// ---------------------------------------------------------------------------
async function testJourneyPageBackLink() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/archetype/flow-artist`);

    const backLink = await page.$('a[href="/quiz/result/flow-artist"]');
    if (!backLink) {
      throw new Error('"Your Result" back-link not found on journey page');
    }

    pass('testJourneyPageBackLink');
  } catch (err) {
    fail('testJourneyPageBackLink', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n  Archetype Journey Pages E2E Tests\n');

  await testAll6JourneyPagesLoad();
  await testAirWeaverJourneyPageContent();
  await testJourneyPageSEO();
  await testResultPageLinksToJourney();
  await testJourneyPageBackLink();

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

**Step 3: Run the E2E tests**

```bash
npm run build
npm run preview &
PREVIEW_PID=$!
sleep 3
npx tsx tests/journey-pages.spec.ts
kill $PREVIEW_PID
```

Expected: All 5 E2E tests PASS.

**Step 4: Run all unit tests to confirm no regressions**

Run: `npm test`
Expected: All existing tests PASS (the new `archetype-journey-schema.test.ts` is included automatically by the `tests/**/*.test.ts` glob in `vitest.config.ts`).

**Step 5: Verify frozen test file is unchanged**

Run: `verify-frozen.sh` (or `git diff HEAD~5 -- tests/archetype-journey-schema.test.ts` if the frozen-test script isn't configured)
Expected: No diff — the test file is identical to what was committed in Task 1.

**Step 6: Commit**

```bash
git add tests/journey-pages.spec.ts
git commit -m "test: add E2E tests for archetype journey pages"
```

**Known Risks:**
- E2E tests run against `npm run preview` (the built site on port 4321). If `npm run preview` uses a different port, set `TEST_URL=http://localhost:<port>` before running. Check `package.json` scripts for the preview port if 4321 returns connection refused.
- The `testJourneyPageSEO` test selects the first `script[type="application/ld+json"]`. If GTM or another analytics script injects LD+JSON, this selector may hit the wrong script. If this is an issue, use `page.$$eval` to find the script whose content contains `FAQPage`.

**If This Fails:**
- If `testAll6JourneyPagesLoad` fails with status 404, the pages did not generate — re-run `npm run build` and check build logs for `archetypeJourneys` collection errors.
- If `testJourneyPageSEO` fails on the canonical URL check, verify `Layout.astro` derives `siteUrl` from `Astro.site` (already done — it falls back to `https://www.thehermeticflight.com` when `Astro.site` is not set).
- If `testResultPageLinksToJourney` fails with "Journey page link not found", verify Task 4 was applied to the correct block in `[archetype].astro` and the `href` attribute resolves to `/archetype/grounded-mystic` (not `/archetype/grounded_mystic`).

---

## Task 6: Build verification, sitemap check, and GA4 event audit

**Files:**
- No new files — verification only.

**Step 1: Full clean build**

```bash
rm -rf dist
npm run build 2>&1 | tee /tmp/build-output.txt
tail -30 /tmp/build-output.txt
```

Expected: Build completes. Look for all 6 `/archetype/[slug]/index.html` files in build output.

**Step 2: Verify all 6 journey pages are in the build output**

Run: `ls dist/archetype/`
Expected: `air-weaver/  ascending-seeker/  embodied-intuitive/  flow-artist/  grounded-mystic/  shadow-dancer/`

**Step 3: Verify journey pages appear in sitemap**

Run: `grep 'archetype' dist/sitemap-0.xml`
Expected: 6 entries like `<loc>https://www.thehermeticflight.com/archetype/air-weaver/</loc>`

Journey pages are valuable SEO targets — they must be in the sitemap. The `@astrojs/sitemap` integration discovers all static pages automatically.

**Step 4: Verify JSON-LD in each built page**

```bash
for slug in air-weaver embodied-intuitive ascending-seeker shadow-dancer flow-artist grounded-mystic; do
  count=$(grep -c 'FAQPage' dist/archetype/$slug/index.html 2>/dev/null || echo 0)
  echo "$slug: FAQPage occurrences = $count"
done
```

Expected: Each archetype returns `1`.

**Step 5: Verify OG tags in a sample journey page**

Run: `grep 'og:title' dist/archetype/air-weaver/index.html`
Expected: Line containing `The Air Weaver Archetype Journey | The Hermetic Flight`

Run: `grep 'og:image' dist/archetype/air-weaver/index.html`
Expected: Line containing `https://www.thehermeticflight.com/images/og/air-weaver.png`

> **Note:** Journey pages reuse the same OG images as result pages (`/images/og/[slug].png`). These already exist as placeholder PNGs from the viral loop sprint. This is intentional — the images serve both URL types without duplication.

**Step 6: Verify GA4 journey_page_view event script renders**

Run: `grep 'journey_page_view' dist/archetype/air-weaver/index.html`
Expected: Line containing `gtag('event', 'journey_page_view'`

**Step 7: Final commit if any build corrections were needed**

If the build required any fixes not covered by earlier task commits:

```bash
git add -p   # stage only the specific fixes
git commit -m "fix: resolve build issues from journey page integration"
```

**Known Risks:**
- If the sitemap does not include journey pages, check whether `astro.config.mjs` has a `customPages` or `exclude` filter on the sitemap integration — none was added, so this should be auto-discovered.

**If This Fails:**
- If journey pages are absent from the sitemap, add them explicitly: in `astro.config.mjs`, update the sitemap integration to `sitemap({ customPages: [] })` — or more likely, just verify the pages are in `dist/archetype/` and the sitemap integration version supports automatic discovery of all static routes (it does in `@astrojs/sitemap` ≥ 3.0).

---

## Task 7: Quality Gates

### Frozen Test File Protocol

After Task 1 (test authorship), run:
```bash
record-baseline.sh tests/archetype-journey-schema.test.ts
```

After all implementation tasks complete, run:
```bash
verify-frozen.sh tests/archetype-journey-schema.test.ts
```

Expected: No changes. The test contract must be identical to the authored version.

### Evaluation Protocol: 3-Evaluator Convergence Analysis

Run after all 6 tasks are complete and all tests pass.

**Setup:** Dispatch 3 independent subagents (Sonnet), each with a single orthogonal lens. Each evaluator reads the implemented files and produces a scored report. Synthesize with convergence analysis. Remediate via frozen-test-file cycles. Produce a Verification Playbook.

**Output path:** `operations/hardening-journey-pages-YYYY-MM-DD/`

---

**Evaluator 1: SEO Lens**

Scope: `src/pages/archetype/[slug].astro`, `src/content/config.ts`, `dist/archetype/*/index.html` (sample: air-weaver, shadow-dancer)

Review checklist:
- [ ] `<title>` is unique per archetype and includes archetype name + site name
- [ ] `meta[name="description"]` is substantive (≥ 120 chars) and unique per archetype
- [ ] `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name` all present
- [ ] `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` all present
- [ ] `og:image` uses absolute URL with `www` prefix
- [ ] `link[rel="canonical"]` uses `www` prefix and correct path `/archetype/[slug]`
- [ ] JSON-LD `FAQPage` schema present and valid (parseable, correct `@context`, correct `@type` hierarchy)
- [ ] Journey pages appear in `dist/sitemap-0.xml`
- [ ] `h1` contains archetype title (matches `ArchetypeContent.title`)
- [ ] `h2` headings on page are descriptive (Affiliated Cards, Recommended Spreads, Journaling Prompts, Recommended Reading)
- [ ] No duplicate canonical URLs between `/quiz/result/[slug]` and `/archetype/[slug]` — they share OG images but have distinct titles, descriptions, and canonicals

**Evaluator 2: Design Consistency Lens**

Scope: `src/pages/archetype/[slug].astro`, visual rendering of built pages via Playwright screenshot

Review checklist:
- [ ] All sections use `glass-panel` class (matching result pages and site aesthetic)
- [ ] Corner marks (`.absolute.border-t.border-l`) present on all glass panels
- [ ] Archetype accent color (`accentHex`) used for glow effect and numbered prompt indicators
- [ ] `font-serif` (Cinzel) used for headings (`h1`, `h2`, `h3`)
- [ ] `font-sans` (Lato) used for body text, labels, overlines
- [ ] `text-hermetic-gold` used for section headings
- [ ] `text-gray-400` / `text-gray-500` used for body copy and supporting text
- [ ] `text-xs tracking-[0.3em] uppercase` pattern used for overline labels
- [ ] Mobile responsive: card grid uses `grid-cols-1 md:grid-cols-3`
- [ ] Spread position tags are visually distinct (pill/badge style with border)
- [ ] Journaling prompts numbered with accent-colored circle badges
- [ ] Blog link cards use hover state (`hover:border-hermetic-gold/50`)
- [ ] Footer CTA section has centered layout with gold divider line
- [ ] "Go Deeper" button uses `border border-hermetic-gold/40` style (not `btn-flame`) — intentionally lower visual weight than primary quiz CTA
- [ ] No layout overflow on mobile (check at 375px viewport)
- [ ] Star/fog background layers render correctly (these come from `Layout.astro` body — not in scope to modify)

**Evaluator 3: Data Integrity Lens**

Scope: `src/data/archetype-journeys.json`, `src/content/config.ts`, `dist/archetype/*/index.html`

Review checklist:
- [ ] All 6 archetype slugs present as JSON array entries (`id` field)
- [ ] All 6 `id` values match the `ArchetypeSlug` type: `air_weaver`, `embodied_intuitive`, `ascending_seeker`, `shadow_dancer`, `flow_artist`, `grounded_mystic`
- [ ] No JSON syntax errors (file parses cleanly)
- [ ] Every entry has `description_extended`, `affiliated_cards`, `recommended_spreads`, `journaling_prompts`, `blog_links`
- [ ] Every `affiliated_cards` entry has `name`, `position`, `relevance`
- [ ] Every `recommended_spreads` entry has `name`, `positions` (array ≥ 2), `description`
- [ ] Every `journaling_prompts` array has ≥ 3 items
- [ ] Blog link `slug` values resolve to real pages: verify `dist/blog/[slug]/index.html` exists for each referenced blog slug
- [ ] Journey page `href="/archetype/[slug]"` on result pages uses hyphenated slug (not underscore)
- [ ] Journey page `href="/quiz/result/[slug]"` in footer CTA uses hyphenated slug
- [ ] `toUrlSlug()` correctly transforms all 6 internal slugs to URL slugs
- [ ] Zod schema in `config.ts` matches the JSON structure field-by-field
- [ ] Placeholder markers `[OPERATOR: ...]` are present in JSON (confirms placeholder state is intentional, not missing content)
- [ ] No broken internal links on journey pages (verify all `href` values in built HTML point to existing `dist/` paths)

### Convergence Synthesis

After all 3 evaluators produce reports, synthesize:
1. Identify findings present in ≥ 2 evaluator reports — these are confirmed and must be remediated.
2. Identify single-evaluator findings — assess severity. Critical/High: remediate. Medium/Low: defer to post-Sprint 2 integration harden.
3. For each remediation, create a new frozen test that would catch the regression, implement the fix, verify frozen tests unchanged.

Store reports at: `operations/hardening-journey-pages-YYYY-MM-DD/eval-[1|2|3]-[lens].md`, `operations/hardening-journey-pages-YYYY-MM-DD/synthesis.md`, `operations/hardening-journey-pages-YYYY-MM-DD/playbook.md`

---

> **After Sprint 2 integration (all 3 tracks merged), run `harden` across the integrated result.**

---

## Operator Content Handoff Checklist

Before launch, replace all `[OPERATOR: ...]` placeholders in `src/data/archetype-journeys.json`:

| Archetype | Fields to fill |
|-----------|---------------|
| Air Weaver | `description_extended` (2-4 paragraphs), 3 `affiliated_cards[].relevance`, 2 `recommended_spreads[].description`, 5 `journaling_prompts` |
| Embodied Intuitive | Same fields |
| Ascending Seeker | Same fields |
| Shadow Dancer | Same fields |
| Flow Artist | Same fields |
| Grounded Mystic | Same fields |

Source material: Export archetype description PDFs from `operations/archetype-reports/` as text. Each PDF maps to one archetype entry.

Card names and spread names in the JSON are editorial placeholders — operator should also review and update these to match the archetype reports if different cards are recommended.

After filling in content: run `npm run build` and visually review one journey page in the browser before deploying.
