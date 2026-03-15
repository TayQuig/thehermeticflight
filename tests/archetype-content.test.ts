/**
 * Archetype Content Module — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the archetype-content module must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/lib/archetype-content.ts
 *
 * Finding covered:
 *   SYN-10: No archetype-content test coverage
 *
 * Verifies:
 *   - All 6 archetypes exist as keys in the archetypes record
 *   - Each entry has non-empty name, title, description, element, color
 *   - slug field matches its Record key
 *   - title includes "The " prefix
 *   - ArchetypeContent interface is properly typed
 */

import { describe, it, expect } from 'vitest';
import { archetypes, archetypeByUrlSlug, toUrlSlug } from '../src/lib/archetype-content';
import type { ArchetypeContent } from '../src/lib/archetype-content';
import type { ArchetypeSlug } from '../src/lib/classifier';

// ---------------------------------------------------------------------------
// Expected archetype slugs — the 6 archetypes defined by the quiz system
// ---------------------------------------------------------------------------

const EXPECTED_SLUGS: ArchetypeSlug[] = [
  'air_weaver',
  'embodied_intuitive',
  'ascending_seeker',
  'shadow_dancer',
  'flow_artist',
  'grounded_mystic',
];

// ===========================================================================
// SYN-10: Archetype content coverage
// ===========================================================================

describe('SYN-10: Archetype content completeness', () => {
  it('archetypes record contains exactly 6 entries', () => {
    const keys = Object.keys(archetypes);
    expect(keys).toHaveLength(6);
  });

  it('all 6 expected archetype slugs exist as keys', () => {
    for (const slug of EXPECTED_SLUGS) {
      expect(archetypes).toHaveProperty(slug);
    }
  });

  it('has no unexpected archetype keys', () => {
    const keys = Object.keys(archetypes);
    for (const key of keys) {
      expect(EXPECTED_SLUGS).toContain(key);
    }
  });
});

describe('SYN-10: Each archetype has populated fields', () => {
  for (const slug of EXPECTED_SLUGS) {
    describe(`${slug}`, () => {
      it('has a non-empty name', () => {
        const entry = archetypes[slug];
        expect(typeof entry.name).toBe('string');
        expect(entry.name.length).toBeGreaterThan(0);
      });

      it('has a non-empty title', () => {
        const entry = archetypes[slug];
        expect(typeof entry.title).toBe('string');
        expect(entry.title.length).toBeGreaterThan(0);
      });

      it('has a non-empty description', () => {
        const entry = archetypes[slug];
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);
      });

      it('has a non-empty element', () => {
        const entry = archetypes[slug];
        expect(typeof entry.element).toBe('string');
        expect(entry.element.length).toBeGreaterThan(0);
      });

      it('has a non-empty color', () => {
        const entry = archetypes[slug];
        expect(typeof entry.color).toBe('string');
        expect(entry.color.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('SYN-10: Archetype slug field consistency', () => {
  for (const slug of EXPECTED_SLUGS) {
    it(`${slug}: slug field matches its Record key`, () => {
      const entry = archetypes[slug];
      expect(entry.slug).toBe(slug);
    });
  }
});

describe('SYN-10: Archetype title format', () => {
  for (const slug of EXPECTED_SLUGS) {
    it(`${slug}: title starts with "The "`, () => {
      const entry = archetypes[slug];
      expect(entry.title).toMatch(/^The /);
    });
  }
});

describe('SYN-10: Archetype type correctness', () => {
  it('each entry satisfies the ArchetypeContent interface shape', () => {
    for (const slug of EXPECTED_SLUGS) {
      const entry: ArchetypeContent = archetypes[slug];
      // TypeScript compile-time check via the type annotation above.
      // Runtime check ensures all fields exist and are strings.
      expect(entry).toEqual(
        expect.objectContaining({
          slug: expect.any(String),
          name: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          element: expect.any(String),
          color: expect.any(String),
        }),
      );
    }
  });

  it('descriptions are substantive (at least 50 characters)', () => {
    for (const slug of EXPECTED_SLUGS) {
      const entry = archetypes[slug];
      expect(entry.description.length).toBeGreaterThanOrEqual(50);
    }
  });
});

// ===========================================================================
// URL slug utilities (Share CTA support)
// ===========================================================================

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

// ===========================================================================
// TCF-06: Slug function edge cases
// ===========================================================================

describe('TCF-06: toUrlSlug edge cases', () => {
  it('handles a slug with no underscores (single word)', () => {
    // Type cast required since single-word slugs are not valid ArchetypeSlug values,
    // but the function should still work gracefully on any string.
    expect(toUrlSlug('air' as ArchetypeSlug)).toBe('air');
  });

  it('converts multiple consecutive underscores correctly', () => {
    // Defensive: toUrlSlug replaces all _ globally
    expect(toUrlSlug('air__weaver' as ArchetypeSlug)).toBe('air--weaver');
  });

  it('does not mutate the input string', () => {
    const input = 'air_weaver' as ArchetypeSlug;
    toUrlSlug(input);
    expect(input).toBe('air_weaver');
  });
});

describe('TCF-06: archetypeByUrlSlug edge cases', () => {
  it('returns undefined for an empty string', () => {
    expect(archetypeByUrlSlug('')).toBeUndefined();
  });

  it('returns undefined for a slug with wrong separator (underscore instead of hyphen)', () => {
    expect(archetypeByUrlSlug('air_weaver')).toBeUndefined();
  });

  it('returns undefined for a partial match', () => {
    expect(archetypeByUrlSlug('air')).toBeUndefined();
  });

  it('returns undefined for a slug with trailing hyphen', () => {
    expect(archetypeByUrlSlug('air-weaver-')).toBeUndefined();
  });

  it('is case-sensitive — uppercase does not match', () => {
    expect(archetypeByUrlSlug('Air-Weaver')).toBeUndefined();
  });

  it('returns undefined for well-formed but unknown slug', () => {
    const result = archetypeByUrlSlug('valid-but-unknown');
    expect(result).toBeUndefined();
  });
});
