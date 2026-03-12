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
