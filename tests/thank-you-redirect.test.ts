/**
 * Thank-you redirect — unit tests.
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
      'air_weaver', 'embodied_intuitive', 'ascending_seeker',
      'shadow_dancer', 'flow_artist', 'grounded_mystic',
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
