/**
 * Archetype Classifier v2 — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the classifier module must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/lib/classifier.ts
 *
 * v2 changes:
 *   - classify() returns ClassificationResult (not bare ArchetypeSlug)
 *   - Cosine-similarity to 6 archetype centroids in 4D space [A, B, C, D]
 *   - ClassificationResult: { primary, confidence, memberships }
 *   - classifyLegacy() shim returns same primary as classify().primary
 *   - computeScores() unchanged (already migrated in Phase 1)
 *
 * Centroids (design spec — implementer determines exact values):
 *   - air_weaver:         A-dominant
 *   - embodied_intuitive: B-dominant
 *   - ascending_seeker:   C-dominant
 *   - shadow_dancer:      D-dominant
 *   - grounded_mystic:    A+D composite
 *   - flow_artist:        B+C composite
 */

import { describe, it, expect } from 'vitest';
import {
  classify,
  classifyLegacy,
  computeScores,
} from '../src/lib/classifier';
import type {
  ArchetypeSlug,
  DimensionScores,
  ClassificationResult,
} from '../src/lib/classifier';
import { questions } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for building DimensionScores. */
function scores(A: number, B: number, C: number, D: number): DimensionScores {
  return { A, B, C, D };
}

/** All valid archetype slugs. */
const ALL_ARCHETYPES: ArchetypeSlug[] = [
  'air_weaver',
  'embodied_intuitive',
  'ascending_seeker',
  'shadow_dancer',
  'flow_artist',
  'grounded_mystic',
];

// ===========================================================================
// classify() — return type and structure
// ===========================================================================

describe('classify() return type', () => {
  it('returns a ClassificationResult object', () => {
    const result = classify(scores(20, 4, 4, 4));
    expect(result).toHaveProperty('primary');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('memberships');
  });

  it('primary is a valid ArchetypeSlug', () => {
    const result = classify(scores(20, 4, 4, 4));
    expect(ALL_ARCHETYPES).toContain(result.primary);
  });

  it('confidence is a number in [0, 1]', () => {
    const result = classify(scores(20, 4, 4, 4));
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('memberships contains all 6 archetypes', () => {
    const result = classify(scores(20, 4, 4, 4));
    for (const slug of ALL_ARCHETYPES) {
      expect(result.memberships).toHaveProperty(slug);
    }
  });

  it('memberships values sum to 1.0 (±0.001)', () => {
    const result = classify(scores(20, 4, 4, 4));
    const sum = Object.values(result.memberships).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('each membership value is in [0, 1]', () => {
    const result = classify(scores(20, 4, 4, 4));
    for (const value of Object.values(result.memberships)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

// ===========================================================================
// classify() — centroid ideal vectors classify to their archetype
// ===========================================================================

describe('classify() centroid ideal vectors', () => {
  it('high A => air_weaver', () => {
    const result = classify(scores(30, 4, 4, 4));
    expect(result.primary).toBe('air_weaver');
  });

  it('high B => embodied_intuitive', () => {
    const result = classify(scores(4, 30, 4, 4));
    expect(result.primary).toBe('embodied_intuitive');
  });

  it('high C => ascending_seeker', () => {
    const result = classify(scores(4, 4, 30, 4));
    expect(result.primary).toBe('ascending_seeker');
  });

  it('high D => shadow_dancer', () => {
    const result = classify(scores(4, 4, 4, 30));
    expect(result.primary).toBe('shadow_dancer');
  });

  it('high A + high D => grounded_mystic', () => {
    const result = classify(scores(25, 4, 4, 25));
    expect(result.primary).toBe('grounded_mystic');
  });

  it('high B + high C => flow_artist', () => {
    const result = classify(scores(4, 25, 25, 4));
    expect(result.primary).toBe('flow_artist');
  });
});

// ===========================================================================
// classify() — all 6 archetypes reachable with realistic score profiles
// ===========================================================================

describe('classify() realistic profiles', () => {
  it('analytical profile => air_weaver', () => {
    // Realistic: mostly A answers with some spread
    const result = classify(scores(22, 8, 6, 6));
    expect(result.primary).toBe('air_weaver');
  });

  it('somatic profile => embodied_intuitive', () => {
    const result = classify(scores(6, 22, 8, 6));
    expect(result.primary).toBe('embodied_intuitive');
  });

  it('seeker profile => ascending_seeker', () => {
    const result = classify(scores(6, 8, 22, 6));
    expect(result.primary).toBe('ascending_seeker');
  });

  it('shadow profile => shadow_dancer', () => {
    const result = classify(scores(6, 6, 8, 22));
    expect(result.primary).toBe('shadow_dancer');
  });

  it('grounded mystic profile => grounded_mystic', () => {
    // High A and D, low B and C
    const result = classify(scores(18, 5, 5, 18));
    expect(result.primary).toBe('grounded_mystic');
  });

  it('flow artist profile => flow_artist', () => {
    // High B and C, low A and D
    const result = classify(scores(5, 18, 18, 5));
    expect(result.primary).toBe('flow_artist');
  });
});

// ===========================================================================
// classify() — confidence behavior
// ===========================================================================

describe('classify() confidence', () => {
  it('strongly dominant profile has high confidence', () => {
    const result = classify(scores(30, 2, 2, 2));
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('all-equal scores produce confidence < 0.15 (ambiguous)', () => {
    const result = classify(scores(10, 10, 10, 10));
    expect(result.confidence).toBeLessThan(0.15);
  });

  it('zero vector produces confidence 0', () => {
    const result = classify(scores(0, 0, 0, 0));
    expect(result.confidence).toBe(0);
  });

  it('zero vector produces uniform memberships', () => {
    const result = classify(scores(0, 0, 0, 0));
    const values = Object.values(result.memberships);
    const expected = 1 / 6;
    for (const v of values) {
      expect(v).toBeCloseTo(expected, 2);
    }
  });

  it('memberships sum to 1.0 for zero vector', () => {
    const result = classify(scores(0, 0, 0, 0));
    const sum = Object.values(result.memberships).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('memberships sum to 1.0 for equal scores', () => {
    const result = classify(scores(10, 10, 10, 10));
    const sum = Object.values(result.memberships).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('memberships sum to 1.0 for highly dominant profile', () => {
    const result = classify(scores(30, 2, 2, 2));
    const sum = Object.values(result.memberships).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('primary archetype has highest membership', () => {
    const result = classify(scores(20, 8, 4, 4));
    const primaryMembership = result.memberships[result.primary];
    for (const [slug, value] of Object.entries(result.memberships)) {
      if (slug !== result.primary) {
        expect(primaryMembership).toBeGreaterThanOrEqual(value);
      }
    }
  });
});

// ===========================================================================
// classify() — composite archetype boundary tests
// ===========================================================================

describe('classify() composite boundaries', () => {
  it('A+D dominant (both high) => grounded_mystic, not air_weaver', () => {
    const result = classify(scores(20, 3, 3, 20));
    expect(result.primary).toBe('grounded_mystic');
  });

  it('B+C dominant (both high) => flow_artist, not embodied_intuitive', () => {
    const result = classify(scores(3, 20, 20, 3));
    expect(result.primary).toBe('flow_artist');
  });

  it('A slightly higher than D but both high => grounded_mystic', () => {
    const result = classify(scores(22, 4, 4, 18));
    expect(result.primary).toBe('grounded_mystic');
  });

  it('B slightly higher than C but both high => flow_artist', () => {
    const result = classify(scores(4, 22, 18, 4));
    expect(result.primary).toBe('flow_artist');
  });
});

// ===========================================================================
// classifyLegacy() shim
// ===========================================================================

describe('classifyLegacy()', () => {
  it('returns same primary as classify().primary', () => {
    const testCases = [
      scores(30, 4, 4, 4),
      scores(4, 30, 4, 4),
      scores(4, 4, 30, 4),
      scores(4, 4, 4, 30),
      scores(25, 4, 4, 25),
      scores(4, 25, 25, 4),
      scores(10, 10, 10, 10),
    ];
    for (const s of testCases) {
      expect(classifyLegacy(s)).toBe(classify(s).primary);
    }
  });

  it('returns a valid ArchetypeSlug', () => {
    const result = classifyLegacy(scores(20, 4, 4, 4));
    expect(ALL_ARCHETYPES).toContain(result);
  });
});

// ===========================================================================
// computeScores() — v2 question IDs (NQ01-NQ07, FP01-FP03, SEG1-SEG2)
// ===========================================================================

describe('computeScores() v2', () => {
  it('single normative answer scores the correct dimension', () => {
    // NQ01-A scores A +4
    const result = computeScores({ NQ01: 'NQ01-A' }, questions);
    expect(result).toEqual({ A: 4, B: 0, C: 0, D: 0 });
  });

  it('single normative answer for dimension B', () => {
    // NQ01-B scores B +4
    const result = computeScores({ NQ01: 'NQ01-B' }, questions);
    expect(result).toEqual({ A: 0, B: 4, C: 0, D: 0 });
  });

  it('single normative answer for dimension C', () => {
    // NQ01-C scores C +4
    const result = computeScores({ NQ01: 'NQ01-C' }, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 4, D: 0 });
  });

  it('single normative answer for dimension D', () => {
    // NQ01-D scores D +4
    const result = computeScores({ NQ01: 'NQ01-D' }, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 4 });
  });

  it('multiple normative answers accumulate correctly', () => {
    // NQ01-A (A+4) + NQ02-A (A+4) + NQ03-A (A+6) = A: 14
    const result = computeScores(
      { NQ01: 'NQ01-A', NQ02: 'NQ02-A', NQ03: 'NQ03-A' },
      questions,
    );
    expect(result.A).toBe(14);
    expect(result.B).toBe(0);
  });

  it('variable weights: +3, +4, +6 tiers produce different scores', () => {
    // NQ05-A: A+3 (lighter), NQ01-A: A+4 (standard), NQ03-A: A+6 (anchor)
    const result = computeScores(
      { NQ05: 'NQ05-A', NQ01: 'NQ01-A', NQ03: 'NQ03-A' },
      questions,
    );
    expect(result.A).toBe(13); // 3 + 4 + 6
  });

  // Forced-pair dual scoring
  it('FP01-A gives A+6 and D+2 (forced pair dual scoring)', () => {
    const result = computeScores({ FP01: 'FP01-A' }, questions);
    expect(result.A).toBe(6);
    expect(result.D).toBe(2);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
  });

  it('FP01-D gives D+6 and A+2 (forced pair dual scoring)', () => {
    const result = computeScores({ FP01: 'FP01-D' }, questions);
    expect(result.D).toBe(6);
    expect(result.A).toBe(2);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
  });

  it('FP02-B gives B+6 and C+2', () => {
    const result = computeScores({ FP02: 'FP02-B' }, questions);
    expect(result.B).toBe(6);
    expect(result.C).toBe(2);
  });

  it('FP02-C gives C+6 and B+2', () => {
    const result = computeScores({ FP02: 'FP02-C' }, questions);
    expect(result.C).toBe(6);
    expect(result.B).toBe(2);
  });

  it('FP03-B gives B+6 and D+2', () => {
    const result = computeScores({ FP03: 'FP03-B' }, questions);
    expect(result.B).toBe(6);
    expect(result.D).toBe(2);
  });

  it('FP03-D gives D+6 and B+2', () => {
    const result = computeScores({ FP03: 'FP03-D' }, questions);
    expect(result.D).toBe(6);
    expect(result.B).toBe(2);
  });

  // Segmentation questions contribute nothing
  it('segmentation answers contribute zero', () => {
    const result = computeScores(
      { SEG1: 'SEG1-A', SEG2: 'SEG2-A' },
      questions,
    );
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  it('segmentation + scored answers only count scored', () => {
    const result = computeScores(
      { SEG1: 'SEG1-A', NQ01: 'NQ01-A' },
      questions,
    );
    expect(result).toEqual({ A: 4, B: 0, C: 0, D: 0 });
  });

  // Edge cases
  it('empty answers return all zeros', () => {
    const result = computeScores({}, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  it('unknown question IDs are ignored', () => {
    const result = computeScores({ QXYZ: 'QXYZ-A' }, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  // Full quiz scoring
  it('all 10 scored questions answered with A option => correct total', () => {
    // NQ01-A(4) + NQ02-A(4) + NQ03-A(6) + NQ04-A(4) + NQ05-A(3) +
    // NQ06-A(6) + NQ07-A(3) + FP01-A(A:6,D:2) + FP02-B(B:6,C:2) + FP03-B(B:6,D:2)
    // A: 4+4+6+4+3+6+3+6 = 36, B: 6+6=12, C: 2, D: 2+2=4
    const result = computeScores(
      {
        NQ01: 'NQ01-A',
        NQ02: 'NQ02-A',
        NQ03: 'NQ03-A',
        NQ04: 'NQ04-A',
        NQ05: 'NQ05-A',
        NQ06: 'NQ06-A',
        NQ07: 'NQ07-A',
        FP01: 'FP01-A',
        FP02: 'FP02-B',
        FP03: 'FP03-B',
      },
      questions,
    );
    // Normative A answers: 4+4+6+4+3+6+3 = 30
    // FP01-A: A+6, D+2
    // FP02-B: B+6, C+2
    // FP03-B: B+6, D+2
    expect(result.A).toBe(36);
    expect(result.B).toBe(12);
    expect(result.C).toBe(2);
    expect(result.D).toBe(4);
  });

  it('complete quiz with mixed answers produces correct totals', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-A', // A+4
        NQ02: 'NQ02-B', // B+4
        NQ03: 'NQ03-C', // C+6
        NQ04: 'NQ04-D', // D+4
        NQ05: 'NQ05-A', // A+3
        NQ06: 'NQ06-B', // B+6
        NQ07: 'NQ07-C', // C+3
        FP01: 'FP01-D', // D+6, A+2
        FP02: 'FP02-C', // C+6, B+2
        FP03: 'FP03-B', // B+6, D+2
      },
      questions,
    );
    // A: 4+3+2 = 9
    // B: 4+6+2+6 = 18
    // C: 6+3+6 = 15
    // D: 4+6+2 = 12
    expect(result).toEqual({ A: 9, B: 18, C: 15, D: 12 });
  });
});

// ===========================================================================
// Integration: computeScores -> classify (v2)
// ===========================================================================

describe('integration: computeScores -> classify (v2)', () => {
  it('all-A normative answers + A-favoring FPs => air_weaver', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-A',
        NQ02: 'NQ02-A',
        NQ03: 'NQ03-A',
        NQ04: 'NQ04-A',
        NQ05: 'NQ05-A',
        NQ06: 'NQ06-A',
        NQ07: 'NQ07-A',
        FP01: 'FP01-A', // A+6, D+2
        FP02: 'FP02-B', // B+6, C+2 (no A option)
        FP03: 'FP03-B', // B+6, D+2 (no A option)
      },
      questions,
    );
    expect(classify(result).primary).toBe('air_weaver');
  });

  it('all-B normative answers + B-favoring FPs => embodied_intuitive', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-B',
        NQ02: 'NQ02-B',
        NQ03: 'NQ03-B',
        NQ04: 'NQ04-B',
        NQ05: 'NQ05-B',
        NQ06: 'NQ06-B',
        NQ07: 'NQ07-B',
        FP01: 'FP01-A', // A+6, D+2 (no B option)
        FP02: 'FP02-B', // B+6, C+2
        FP03: 'FP03-B', // B+6, D+2
      },
      questions,
    );
    expect(classify(result).primary).toBe('embodied_intuitive');
  });

  it('all-C normative answers + C-favoring FPs => ascending_seeker', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-C',
        NQ02: 'NQ02-C',
        NQ03: 'NQ03-C',
        NQ04: 'NQ04-C',
        NQ05: 'NQ05-C',
        NQ06: 'NQ06-C',
        NQ07: 'NQ07-C',
        FP01: 'FP01-D', // D+6, A+2 (no C option)
        FP02: 'FP02-C', // C+6, B+2
        FP03: 'FP03-D', // D+6, B+2 (no C option)
      },
      questions,
    );
    expect(classify(result).primary).toBe('ascending_seeker');
  });

  it('all-D normative answers + D-favoring FPs => shadow_dancer', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-D',
        NQ02: 'NQ02-D',
        NQ03: 'NQ03-D',
        NQ04: 'NQ04-D',
        NQ05: 'NQ05-D',
        NQ06: 'NQ06-D',
        NQ07: 'NQ07-D',
        FP01: 'FP01-D', // D+6, A+2
        FP02: 'FP02-C', // C+6, B+2 (no D option)
        FP03: 'FP03-D', // D+6, B+2
      },
      questions,
    );
    expect(classify(result).primary).toBe('shadow_dancer');
  });

  it('A+D heavy answers => grounded_mystic', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-A', // A+4
        NQ02: 'NQ02-D', // D+4
        NQ03: 'NQ03-A', // A+6
        NQ04: 'NQ04-D', // D+4
        NQ05: 'NQ05-A', // A+3
        NQ06: 'NQ06-D', // D+6
        NQ07: 'NQ07-A', // A+3
        FP01: 'FP01-A', // A+6, D+2 (both contribute)
        FP02: 'FP02-B', // B+6, C+2 (neutral)
        FP03: 'FP03-D', // D+6, B+2
      },
      questions,
    );
    // A: 4+6+3+3+6 = 22, D: 4+4+6+2+6 = 22, B: 6+2 = 8, C: 2
    expect(classify(result).primary).toBe('grounded_mystic');
  });

  it('B+C heavy answers => flow_artist', () => {
    const result = computeScores(
      {
        NQ01: 'NQ01-B', // B+4
        NQ02: 'NQ02-C', // C+4
        NQ03: 'NQ03-B', // B+6
        NQ04: 'NQ04-C', // C+4
        NQ05: 'NQ05-B', // B+3
        NQ06: 'NQ06-C', // C+6
        NQ07: 'NQ07-B', // B+3
        FP01: 'FP01-A', // A+6, D+2 (neutral)
        FP02: 'FP02-B', // B+6, C+2 (both contribute)
        FP03: 'FP03-B', // B+6, D+2
      },
      questions,
    );
    // B: 4+6+3+3+6+6 = 28, C: 4+4+6+2 = 16, A: 6, D: 2+2 = 4
    expect(classify(result).primary).toBe('flow_artist');
  });
});
