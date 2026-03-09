/**
 * Archetype Classifier — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the classifier module must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/lib/classifier.ts
 *
 * classify(scores) — priority cascade classifier:
 *   Priority 1: grounded_mystic  — A > B AND A > C AND D > B AND D > C
 *   Priority 2: flow_artist      — B > A AND B > D AND C > A AND C > D
 *   Priority 3: air_weaver       — A >= B AND A >= C AND A >= D
 *   Priority 4: embodied_intuitive — B >= A AND B >= C AND B >= D
 *   Priority 5: shadow_dancer    — D >= A AND D >= B AND D >= C
 *   Priority 6: ascending_seeker — fallback (all other cases)
 *
 * computeScores(answers, questions) — sums scoring weights from answer map.
 */

import { describe, it, expect } from 'vitest';
import { classify, computeScores } from '../src/lib/classifier';
import type { ArchetypeSlug, DimensionScores } from '../src/lib/classifier';
import { questions } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for building DimensionScores. */
function scores(A: number, B: number, C: number, D: number): DimensionScores {
  return { A, B, C, D };
}

// ===========================================================================
// classify() tests
// ===========================================================================

describe('classify', () => {
  // -------------------------------------------------------------------------
  // 1. Each base archetype wins when its dimension is clearly dominant
  // -------------------------------------------------------------------------

  describe('base archetype dominance', () => {
    it('Air Weaver wins when A is clearly highest', () => {
      expect(classify(scores(20, 4, 4, 4))).toBe('air_weaver');
    });

    it('Embodied Intuitive wins when B is clearly highest', () => {
      expect(classify(scores(4, 20, 4, 4))).toBe('embodied_intuitive');
    });

    it('Shadow Dancer wins when D is clearly highest', () => {
      expect(classify(scores(4, 4, 4, 20))).toBe('shadow_dancer');
    });

    it('Ascending Seeker wins when C is clearly highest', () => {
      // C dominant: C > A, C > B, C > D
      // This does NOT match grounded_mystic (A not > B, D not > C)
      // Does NOT match flow_artist (B not > A)
      // Does NOT match air_weaver (A not >= C)
      // Does NOT match embodied_intuitive (B not >= C)
      // Does NOT match shadow_dancer (D not >= C)
      // Falls through to ascending_seeker
      expect(classify(scores(4, 4, 20, 4))).toBe('ascending_seeker');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Grounded Mystic wins when A+D both strictly dominate B+C
  // -------------------------------------------------------------------------

  describe('Grounded Mystic (combination archetype)', () => {
    it('wins when A and D both strictly dominate B and C', () => {
      // A > B (16 > 4), A > C (16 > 4), D > B (16 > 4), D > C (16 > 4)
      expect(classify(scores(16, 4, 4, 16))).toBe('grounded_mystic');
    });

    it('wins with asymmetric A and D as long as both dominate B and C', () => {
      // A=20 > B=4, A=20 > C=8, D=12 > B=4, D=12 > C=8
      expect(classify(scores(20, 4, 8, 12))).toBe('grounded_mystic');
    });

    it('wins even when A and D are not equal', () => {
      // A=12 > B=4, A=12 > C=4, D=20 > B=4, D=20 > C=4
      expect(classify(scores(12, 4, 4, 20))).toBe('grounded_mystic');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Flow Artist wins when B+C both strictly dominate A+D
  // -------------------------------------------------------------------------

  describe('Flow Artist (combination archetype)', () => {
    it('wins when B and C both strictly dominate A and D', () => {
      // B > A (16 > 4), B > D (16 > 4), C > A (16 > 4), C > D (16 > 4)
      expect(classify(scores(4, 16, 16, 4))).toBe('flow_artist');
    });

    it('wins with asymmetric B and C as long as both dominate A and D', () => {
      // B=20 > A=4, B=20 > D=8, C=12 > A=4, C=12 > D=8
      expect(classify(scores(4, 20, 12, 8))).toBe('flow_artist');
    });

    it('wins even when B and C are not equal', () => {
      // B=12 > A=4, B=12 > D=4, C=20 > A=4, C=20 > D=4
      expect(classify(scores(4, 12, 20, 4))).toBe('flow_artist');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Grounded Mystic beats Air Weaver (priority 1 > priority 3)
  // -------------------------------------------------------------------------

  describe('priority: Grounded Mystic over Air Weaver', () => {
    it('Grounded Mystic wins even when A is the single highest dimension', () => {
      // A=24 is highest overall, but D=16 also dominates B=8 and C=8
      // Grounded Mystic: A>B (24>8), A>C (24>8), D>B (16>8), D>C (16>8) => YES
      // Air Weaver would also match: A>=B, A>=C, A>=D => YES
      // But Grounded Mystic is priority 1, checked first
      expect(classify(scores(24, 8, 8, 16))).toBe('grounded_mystic');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Flow Artist beats Embodied Intuitive (priority 2 > priority 4)
  // -------------------------------------------------------------------------

  describe('priority: Flow Artist over Embodied Intuitive', () => {
    it('Flow Artist wins even when B is the single highest dimension', () => {
      // B=24 is highest overall, but C=16 also dominates A=8 and D=8
      // Flow Artist: B>A (24>8), B>D (24>8), C>A (16>8), C>D (16>8) => YES
      // Embodied Intuitive would also match: B>=A, B>=C, B>=D => YES
      // But Flow Artist is priority 2, checked first
      expect(classify(scores(8, 24, 16, 8))).toBe('flow_artist');
    });
  });

  // -------------------------------------------------------------------------
  // 6. All-way tie (equal scores) => Air Weaver
  // -------------------------------------------------------------------------

  describe('all-way ties', () => {
    it('all dimensions equal => Air Weaver (highest priority base)', () => {
      expect(classify(scores(10, 10, 10, 10))).toBe('air_weaver');
    });

    it('all dimensions equal at higher value => Air Weaver', () => {
      expect(classify(scores(60, 60, 60, 60))).toBe('air_weaver');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Ascending Seeker as fallback for C-dominant ambiguous patterns
  // -------------------------------------------------------------------------

  describe('Ascending Seeker as fallback', () => {
    it('C dominant alone falls through to Ascending Seeker', () => {
      // C=20, all others low and equal
      // Not grounded_mystic (A not > B), not flow_artist (B not > A)
      // Not air_weaver (A not >= C), not embodied_intuitive (B not >= C)
      // Not shadow_dancer (D not >= C)
      // => ascending_seeker
      expect(classify(scores(4, 4, 20, 4))).toBe('ascending_seeker');
    });

    it('C and B co-dominant but not meeting flow_artist conditions', () => {
      // B=16, C=16, A=12, D=12
      // Not grounded_mystic (A not > B)
      // Not flow_artist: B>A? 16>12 yes. B>D? 16>12 yes. C>A? 16>12 yes. C>D? 16>12 yes => FLOW ARTIST
      // Actually this IS flow_artist. Let me construct a proper ambiguous case.
      // B=12, C=16, A=8, D=12
      // Not grounded_mystic (A=8 not > B=12)
      // Flow_artist: B>A? 12>8 yes. B>D? 12>12 NO => not flow_artist
      // Air_weaver: A>=B? 8>=12 no => not air_weaver
      // Embodied_intuitive: B>=A? 12>=8 yes. B>=C? 12>=16 no => not embodied
      // Shadow_dancer: D>=A? 12>=8 yes. D>=B? 12>=12 yes. D>=C? 12>=16 no => not shadow
      // => ascending_seeker
      expect(classify(scores(8, 12, 16, 12))).toBe('ascending_seeker');
    });

    it('pattern where C leads but cannot satisfy any named archetype', () => {
      // A=4, B=8, C=12, D=4
      // Not grounded_mystic (A not > B)
      // Flow_artist: B>A? 8>4 yes. B>D? 8>4 yes. C>A? 12>4 yes. C>D? 12>4 yes => FLOW ARTIST
      // Hmm, need a case where C leads but flow_artist fails.
      // A=8, B=4, C=12, D=8
      // Not grounded_mystic: A>B? 8>4 yes. A>C? 8>12 no => not grounded_mystic
      // Flow_artist: B>A? 4>8 no => not flow_artist
      // Air_weaver: A>=B? 8>=4 yes. A>=C? 8>=12 no => not air_weaver
      // Embodied_intuitive: B>=A? 4>=8 no => not embodied
      // Shadow_dancer: D>=A? 8>=8 yes. D>=B? 8>=4 yes. D>=C? 8>=12 no => not shadow
      // => ascending_seeker
      expect(classify(scores(8, 4, 12, 8))).toBe('ascending_seeker');
    });
  });

  // -------------------------------------------------------------------------
  // 8. Grounded Mystic requires STRICT dominance (equal doesn't trigger)
  // -------------------------------------------------------------------------

  describe('Grounded Mystic strict inequality requirement', () => {
    it('fails when A equals B (not strictly greater)', () => {
      // A=16, B=16, C=4, D=20
      // Grounded Mystic: A > B? 16 > 16 => NO. Fails.
      // Flow Artist: B > A? 16 > 16 => NO. Fails.
      // Air Weaver: A >= B? yes. A >= C? yes. A >= D? 16>=20 no. Fails.
      // Embodied: B >= A? yes. B >= C? yes. B >= D? 16>=20 no. Fails.
      // Shadow: D >= A? 20>=16 yes. D >= B? 20>=16 yes. D >= C? 20>=4 yes. => SHADOW DANCER
      expect(classify(scores(16, 16, 4, 20))).toBe('shadow_dancer');
    });

    it('fails when D equals C (not strictly greater)', () => {
      // A=16, B=4, C=12, D=12
      // Grounded Mystic: A>B? 16>4 yes. A>C? 16>12 yes. D>B? 12>4 yes. D>C? 12>12 NO. Fails.
      // Flow Artist: B>A? no. Fails.
      // Air Weaver: A>=B? yes. A>=C? yes. A>=D? 16>=12 yes. => AIR WEAVER
      expect(classify(scores(16, 4, 12, 12))).toBe('air_weaver');
    });

    it('fails when A equals C (not strictly greater)', () => {
      // A=12, B=4, C=12, D=16
      // Grounded Mystic: A>B? 12>4 yes. A>C? 12>12 NO. Fails.
      // Flow Artist: B>A? no. Fails.
      // Air Weaver: A>=B? yes. A>=C? yes. A>=D? 12>=16 no. Fails.
      // Embodied: B>=A? no. Fails.
      // Shadow: D>=A? yes. D>=B? yes. D>=C? yes. => SHADOW DANCER
      expect(classify(scores(12, 4, 12, 16))).toBe('shadow_dancer');
    });

    it('fails when D equals B (not strictly greater)', () => {
      // A=16, B=12, C=4, D=12
      // Grounded Mystic: A>B? 16>12 yes. A>C? 16>4 yes. D>B? 12>12 NO. Fails.
      // Flow Artist: B>A? no. Fails.
      // Air Weaver: A>=B? yes. A>=C? yes. A>=D? yes. => AIR WEAVER
      expect(classify(scores(16, 12, 4, 12))).toBe('air_weaver');
    });
  });

  // -------------------------------------------------------------------------
  // 9. Flow Artist requires STRICT dominance (equal doesn't trigger)
  // -------------------------------------------------------------------------

  describe('Flow Artist strict inequality requirement', () => {
    it('fails when B equals A (not strictly greater)', () => {
      // A=16, B=16, C=20, D=4
      // Grounded Mystic: A>B? no. Fails.
      // Flow Artist: B>A? 16>16 NO. Fails.
      // Air Weaver: A>=B? yes. A>=C? 16>=20 no. Fails.
      // Embodied: B>=A? yes. B>=C? 16>=20 no. Fails.
      // Shadow: D>=A? no. Fails.
      // => ascending_seeker
      expect(classify(scores(16, 16, 20, 4))).toBe('ascending_seeker');
    });

    it('fails when C equals D (not strictly greater)', () => {
      // A=4, B=16, C=12, D=12
      // Grounded Mystic: A>B? no. Fails.
      // Flow Artist: B>A? yes. B>D? 16>12 yes. C>A? yes. C>D? 12>12 NO. Fails.
      // Air Weaver: A>=B? no. Fails.
      // Embodied: B>=A? yes. B>=C? yes. B>=D? yes. => EMBODIED INTUITIVE
      expect(classify(scores(4, 16, 12, 12))).toBe('embodied_intuitive');
    });

    it('fails when B equals D (not strictly greater)', () => {
      // A=4, B=12, C=16, D=12
      // Grounded Mystic: A>B? no. Fails.
      // Flow Artist: B>A? yes. B>D? 12>12 NO. Fails.
      // Air Weaver: A>=B? no. Fails.
      // Embodied: B>=A? yes. B>=C? 12>=16 no. Fails.
      // Shadow: D>=A? yes. D>=B? yes. D>=C? 12>=16 no. Fails.
      // => ascending_seeker
      expect(classify(scores(4, 12, 16, 12))).toBe('ascending_seeker');
    });

    it('fails when C equals A (not strictly greater)', () => {
      // A=12, B=16, C=12, D=4
      // Grounded Mystic: A>B? no. Fails.
      // Flow Artist: B>A? yes. B>D? yes. C>A? 12>12 NO. Fails.
      // Air Weaver: A>=B? 12>=16 no. Fails.
      // Embodied: B>=A? yes. B>=C? yes. B>=D? yes. => EMBODIED INTUITIVE
      expect(classify(scores(12, 16, 12, 4))).toBe('embodied_intuitive');
    });
  });

  // -------------------------------------------------------------------------
  // 10. Two-way tie: A=B => Air Weaver (priority 3 beats 4)
  // -------------------------------------------------------------------------

  describe('two-way tie: A=B', () => {
    it('A=B with both dominant => Air Weaver (priority 3 over 4)', () => {
      // A=16, B=16, C=4, D=4
      // Grounded Mystic: A>B? no. Fails.
      // Flow Artist: B>A? no. Fails.
      // Air Weaver: A>=B? 16>=16 yes. A>=C? yes. A>=D? yes. => AIR WEAVER
      expect(classify(scores(16, 16, 4, 4))).toBe('air_weaver');
    });
  });

  // -------------------------------------------------------------------------
  // 11. Two-way tie: A=D => Air Weaver (priority 3 beats 5)
  // -------------------------------------------------------------------------

  describe('two-way tie: A=D', () => {
    it('A=D with both dominant => Air Weaver (priority 3 over 5)', () => {
      // A=16, B=4, C=4, D=16
      // Grounded Mystic: A>B? yes. A>C? yes. D>B? yes. D>C? yes. => GROUNDED MYSTIC
      // Wait — this actually triggers Grounded Mystic!
      // Need A=D but NOT triggering GM. That means B or C must equal A or D.
      // A=12, B=8, C=8, D=12 — GM: A>B 12>8 yes, A>C 12>8 yes, D>B 12>8 yes, D>C 12>8 yes => GM
      // Still GM. The issue is when A=D and both > B,C, grounded_mystic always wins.
      // For Air Weaver to win the A=D tie, we need to NOT trigger GM.
      // That means some of B,C must be >= A or D.
      // A=12, B=12, C=4, D=12
      // GM: A>B? 12>12 no. Fails.
      // Flow Artist: B>A? no. Fails.
      // Air Weaver: A>=B? yes. A>=C? yes. A>=D? yes. => AIR WEAVER
      expect(classify(scores(12, 12, 4, 12))).toBe('air_weaver');
    });
  });

  // -------------------------------------------------------------------------
  // 12. Two-way tie: B=D => Embodied Intuitive (priority 4 beats 5)
  // -------------------------------------------------------------------------

  describe('two-way tie: B=D', () => {
    it('B=D with both dominant => Embodied Intuitive (priority 4 over 5)', () => {
      // A=4, B=16, C=4, D=16
      // Grounded Mystic: A>B? no. Fails.
      // Flow Artist: B>A? yes. B>D? 16>16 no. Fails.
      // Air Weaver: A>=B? no. Fails.
      // Embodied: B>=A? yes. B>=C? yes. B>=D? 16>=16 yes. => EMBODIED INTUITIVE
      expect(classify(scores(4, 16, 4, 16))).toBe('embodied_intuitive');
    });
  });

  // -------------------------------------------------------------------------
  // 13. Zero scores => Air Weaver (all tied at 0)
  // -------------------------------------------------------------------------

  describe('zero scores', () => {
    it('all zeros => Air Weaver (all-way tie at 0)', () => {
      expect(classify(scores(0, 0, 0, 0))).toBe('air_weaver');
    });
  });

  // -------------------------------------------------------------------------
  // 14. Edge case: very large scores
  // -------------------------------------------------------------------------

  describe('edge case: very large scores', () => {
    it('handles very large score values correctly', () => {
      expect(classify(scores(10000, 1, 1, 1))).toBe('air_weaver');
    });

    it('handles very large equal scores correctly', () => {
      expect(classify(scores(999999, 999999, 999999, 999999))).toBe('air_weaver');
    });

    it('Grounded Mystic with very large A and D', () => {
      expect(classify(scores(5000, 1, 1, 5000))).toBe('grounded_mystic');
    });
  });

  // -------------------------------------------------------------------------
  // 15. Edge case: only one dimension has points
  // -------------------------------------------------------------------------

  describe('edge case: only one dimension has points', () => {
    it('only A has points => Air Weaver', () => {
      expect(classify(scores(8, 0, 0, 0))).toBe('air_weaver');
    });

    it('only B has points => Embodied Intuitive', () => {
      expect(classify(scores(0, 8, 0, 0))).toBe('embodied_intuitive');
    });

    it('only C has points => Ascending Seeker (C alone cannot win named)', () => {
      // C=8, rest 0
      // GM: A>B? 0>0 no. Fails.
      // FA: B>A? 0>0 no. Fails.
      // AW: A>=B? yes. A>=C? 0>=8 no. Fails.
      // EI: B>=A? yes. B>=C? 0>=8 no. Fails.
      // SD: D>=A? yes. D>=B? yes. D>=C? 0>=8 no. Fails.
      // => ascending_seeker
      expect(classify(scores(0, 0, 8, 0))).toBe('ascending_seeker');
    });

    it('only D has points => Shadow Dancer', () => {
      expect(classify(scores(0, 0, 0, 8))).toBe('shadow_dancer');
    });
  });

  // -------------------------------------------------------------------------
  // Additional boundary tests for comprehensive coverage
  // -------------------------------------------------------------------------

  describe('additional boundary cases', () => {
    it('Ascending Seeker is truly unreachable via direct comparison', () => {
      // Ascending Seeker has no >= conditions — it can only be the fallback.
      // C being dominant with mixed other scores should still fall through.
      // A=4, B=8, C=16, D=12
      // GM: A>B? no. Fails.
      // FA: B>A? yes. B>D? 8>12 no. Fails.
      // AW: A>=B? no. Fails.
      // EI: B>=A? yes. B>=C? no. Fails.
      // SD: D>=A? yes. D>=B? yes. D>=C? 12>=16 no. Fails.
      // => ascending_seeker
      expect(classify(scores(4, 8, 16, 12))).toBe('ascending_seeker');
    });

    it('three-way tie A=B=D, C lower => Air Weaver', () => {
      // A=12, B=12, C=4, D=12
      // GM: A>B? no. Fails.
      // FA: B>A? no. Fails.
      // AW: A>=B? yes. A>=C? yes. A>=D? yes. => AIR WEAVER
      expect(classify(scores(12, 12, 4, 12))).toBe('air_weaver');
    });

    it('three-way tie A=B=C, D lower => Air Weaver', () => {
      // A=12, B=12, C=12, D=4
      // GM: A>B? no. Fails.
      // FA: B>A? no. Fails.
      // AW: A>=B? yes. A>=C? yes. A>=D? yes. => AIR WEAVER
      expect(classify(scores(12, 12, 12, 4))).toBe('air_weaver');
    });

    it('three-way tie B=C=D, A lower => Embodied Intuitive', () => {
      // A=4, B=12, C=12, D=12
      // GM: A>B? no. Fails.
      // FA: B>A? yes. B>D? 12>12 no. Fails.
      // AW: A>=B? no. Fails.
      // EI: B>=A? yes. B>=C? yes. B>=D? yes. => EMBODIED INTUITIVE
      expect(classify(scores(4, 12, 12, 12))).toBe('embodied_intuitive');
    });

    it('classify returns a valid ArchetypeSlug type', () => {
      const validSlugs: ArchetypeSlug[] = [
        'air_weaver',
        'embodied_intuitive',
        'ascending_seeker',
        'shadow_dancer',
        'flow_artist',
        'grounded_mystic',
      ];
      const result = classify(scores(10, 10, 10, 10));
      expect(validSlugs).toContain(result);
    });
  });
});

// ===========================================================================
// computeScores() tests
// ===========================================================================

describe('computeScores', () => {
  // -------------------------------------------------------------------------
  // 1. Simple single-answer scoring
  // -------------------------------------------------------------------------

  it('single answer scores the correct dimension', () => {
    // Q1-A scores Air Weaver (A) +4
    const answers: Record<string, string> = { Q1: 'Q1-A' };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 4, B: 0, C: 0, D: 0 });
  });

  it('single answer for dimension B', () => {
    // Q1-B scores Embodied Intuitive (B) +4
    const answers: Record<string, string> = { Q1: 'Q1-B' };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 4, C: 0, D: 0 });
  });

  it('single answer for dimension C', () => {
    // Q1-C scores Ascending Seeker (C) +4
    const answers: Record<string, string> = { Q1: 'Q1-C' };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 4, D: 0 });
  });

  it('single answer for dimension D', () => {
    // Q1-D scores Shadow Dancer (D) +4
    const answers: Record<string, string> = { Q1: 'Q1-D' };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 4 });
  });

  // -------------------------------------------------------------------------
  // 2. Multiple answers accumulate
  // -------------------------------------------------------------------------

  it('multiple answers accumulate scores per dimension', () => {
    // Q1-A: A+4, Q4-A: A+4, Q5-A: A+4
    const answers: Record<string, string> = {
      Q1: 'Q1-A',
      Q4: 'Q4-A',
      Q5: 'Q5-A',
    };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(12);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(0);
  });

  it('answers across different dimensions accumulate independently', () => {
    // Q1-A: A+4, Q4-B: B+4, Q5-C: C+4, Q6-D: D+4
    const answers: Record<string, string> = {
      Q1: 'Q1-A',
      Q4: 'Q4-B',
      Q5: 'Q5-C',
      Q6: 'Q6-D',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 4, B: 4, C: 4, D: 4 });
  });

  // -------------------------------------------------------------------------
  // 3. Dual-scored answers (Q7-E, Q8-E) add to both A and D
  // -------------------------------------------------------------------------

  it('Q7-E dual-scored answer adds to both A and D', () => {
    const answers: Record<string, string> = { Q7: 'Q7-E' };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(4);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(4);
  });

  it('Q8-E dual-scored answer adds to both A and D', () => {
    const answers: Record<string, string> = { Q8: 'Q8-E' };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(4);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(4);
  });

  it('both dual-scored answers together contribute A+8, D+8', () => {
    const answers: Record<string, string> = {
      Q7: 'Q7-E',
      Q8: 'Q8-E',
    };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(8);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(8);
  });

  // -------------------------------------------------------------------------
  // 4. Non-scored questions contribute nothing
  // -------------------------------------------------------------------------

  it('non-scored question answers contribute zero to all dimensions', () => {
    // Q2 is non-scored, Q3 is non-scored
    const answers: Record<string, string> = {
      Q2: 'Q2-A',
      Q3: 'Q3-B',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  it('non-scored answers mixed with scored answers only count scored', () => {
    // Q2-A: non-scored (0), Q1-A: A+4
    const answers: Record<string, string> = {
      Q2: 'Q2-A',
      Q1: 'Q1-A',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 4, B: 0, C: 0, D: 0 });
  });

  it('all non-scored questions answered produce zero scores', () => {
    const answers: Record<string, string> = {
      Q2: 'Q2-B',
      Q3: 'Q3-C',
      Q11: 'Q11-A',
      Q19: 'Q19-A',
      Q20: 'Q20-D',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  // -------------------------------------------------------------------------
  // 5. Empty answers map returns all zeros
  // -------------------------------------------------------------------------

  it('empty answers map returns all zeros', () => {
    const result = computeScores({}, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  // -------------------------------------------------------------------------
  // 6. Unknown question IDs are ignored
  // -------------------------------------------------------------------------

  it('unknown question IDs are ignored gracefully', () => {
    const answers: Record<string, string> = {
      QXYZ: 'QXYZ-A',
      Q999: 'Q999-B',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 0 });
  });

  it('mix of valid and unknown question IDs only counts valid', () => {
    const answers: Record<string, string> = {
      Q1: 'Q1-D',
      QFAKE: 'QFAKE-A',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 0, B: 0, C: 0, D: 4 });
  });

  // -------------------------------------------------------------------------
  // 7. All 15 scored questions contribute to totals
  // -------------------------------------------------------------------------

  it('all 15 scored questions answered with A option => A gets 15 * 4 = 60', () => {
    // All scored questions: 1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18
    // Answering all with the A option (single-dimension A scoring)
    const answers: Record<string, string> = {
      Q1: 'Q1-A',
      Q4: 'Q4-A',
      Q5: 'Q5-A',
      Q6: 'Q6-A',
      Q7: 'Q7-A',
      Q8: 'Q8-A',
      Q9: 'Q9-A',
      Q10: 'Q10-A',
      Q12: 'Q12-A',
      Q13: 'Q13-A',
      Q14: 'Q14-A',
      Q15: 'Q15-A',
      Q16: 'Q16-A',
      Q17: 'Q17-A',
      Q18: 'Q18-A',
    };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(60); // 15 questions * 4 points each
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(0);
  });

  it('all 15 scored questions answered with D option => D gets 15 * 4 = 60', () => {
    const answers: Record<string, string> = {
      Q1: 'Q1-D',
      Q4: 'Q4-D',
      Q5: 'Q5-D',
      Q6: 'Q6-D',
      Q7: 'Q7-D',
      Q8: 'Q8-D',
      Q9: 'Q9-D',
      Q10: 'Q10-D',
      Q12: 'Q12-D',
      Q13: 'Q13-D',
      Q14: 'Q14-D',
      Q15: 'Q15-D',
      Q16: 'Q16-D',
      Q17: 'Q17-D',
      Q18: 'Q18-D',
    };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(0);
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(60); // 15 questions * 4 points each
  });

  it('complete quiz with mixed answers produces correct totals', () => {
    // Strategic mix: 5 A answers, 4 B answers, 3 C answers, 3 D answers
    // Q1-A(A+4), Q4-A(A+4), Q5-A(A+4), Q6-A(A+4), Q7-A(A+4)  => A: 20
    // Q8-B(B+4), Q9-B(B+4), Q10-B(B+4), Q12-B(B+4)             => B: 16
    // Q13-C(C+4), Q14-C(C+4), Q15-C(C+4)                        => C: 12
    // Q16-D(D+4), Q17-D(D+4), Q18-D(D+4)                        => D: 12
    const answers: Record<string, string> = {
      Q1: 'Q1-A',
      Q4: 'Q4-A',
      Q5: 'Q5-A',
      Q6: 'Q6-A',
      Q7: 'Q7-A',
      Q8: 'Q8-B',
      Q9: 'Q9-B',
      Q10: 'Q10-B',
      Q12: 'Q12-B',
      Q13: 'Q13-C',
      Q14: 'Q14-C',
      Q15: 'Q15-C',
      Q16: 'Q16-D',
      Q17: 'Q17-D',
      Q18: 'Q18-D',
    };
    const result = computeScores(answers, questions);
    expect(result).toEqual({ A: 20, B: 16, C: 12, D: 12 });
  });

  it('dual-scored answers increase total dimension points beyond 60', () => {
    // If Q7-E and Q8-E are chosen, they contribute to BOTH A and D.
    // 13 standard A-option answers (all scored except Q7 and Q8) = 52 A points
    // Plus Q7-E and Q8-E each add +4 A and +4 D = 8 more A points
    // Total A = 52 + 8 = 60. Total D = 0 + 8 = 8.
    const answers: Record<string, string> = {
      Q1: 'Q1-A',
      Q4: 'Q4-A',
      Q5: 'Q5-A',
      Q6: 'Q6-A',
      Q7: 'Q7-E', // A+4, D+4
      Q8: 'Q8-E', // A+4, D+4
      Q9: 'Q9-A',
      Q10: 'Q10-A',
      Q12: 'Q12-A',
      Q13: 'Q13-A',
      Q14: 'Q14-A',
      Q15: 'Q15-A',
      Q16: 'Q16-A',
      Q17: 'Q17-A',
      Q18: 'Q18-A',
    };
    const result = computeScores(answers, questions);
    expect(result.A).toBe(60); // 13 * 4 + 2 * 4 = 52 + 8 = 60
    expect(result.B).toBe(0);
    expect(result.C).toBe(0);
    expect(result.D).toBe(8); // 2 * 4 = 8
  });

  it('non-scored questions in a full quiz do not affect totals', () => {
    // Answer all 20 questions (15 scored + 5 non-scored)
    // Only scored questions should contribute
    const answers: Record<string, string> = {
      Q1: 'Q1-A',
      Q2: 'Q2-A', // non-scored
      Q3: 'Q3-A', // non-scored
      Q4: 'Q4-B',
      Q5: 'Q5-C',
      Q6: 'Q6-D',
      Q7: 'Q7-A',
      Q8: 'Q8-B',
      Q9: 'Q9-C',
      Q10: 'Q10-D',
      Q11: 'Q11-A', // non-scored
      Q12: 'Q12-A',
      Q13: 'Q13-B',
      Q14: 'Q14-C',
      Q15: 'Q15-D',
      Q16: 'Q16-A',
      Q17: 'Q17-B',
      Q18: 'Q18-C',
      Q19: 'Q19-A', // non-scored
      Q20: 'Q20-A', // non-scored
    };
    const result = computeScores(answers, questions);
    // Count by dimension:
    // A: Q1-A(4) + Q7-A(4) + Q12-A(4) + Q16-A(4) = 16
    // B: Q4-B(4) + Q8-B(4) + Q13-B(4) + Q17-B(4) = 16
    // C: Q5-C(4) + Q9-C(4) + Q14-C(4) + Q18-C(4) = 16
    // D: Q6-D(4) + Q10-D(4) + Q15-D(4) = 12
    expect(result).toEqual({ A: 16, B: 16, C: 16, D: 12 });
  });
});

// ===========================================================================
// Integration: computeScores -> classify
// ===========================================================================

describe('integration: computeScores -> classify', () => {
  it('all-A answers produce Air Weaver classification', () => {
    const answers: Record<string, string> = {
      Q1: 'Q1-A', Q4: 'Q4-A', Q5: 'Q5-A', Q6: 'Q6-A', Q7: 'Q7-A',
      Q8: 'Q8-A', Q9: 'Q9-A', Q10: 'Q10-A', Q12: 'Q12-A', Q13: 'Q13-A',
      Q14: 'Q14-A', Q15: 'Q15-A', Q16: 'Q16-A', Q17: 'Q17-A', Q18: 'Q18-A',
    };
    const result = computeScores(answers, questions);
    expect(classify(result)).toBe('air_weaver');
  });

  it('all-B answers produce Embodied Intuitive classification', () => {
    const answers: Record<string, string> = {
      Q1: 'Q1-B', Q4: 'Q4-B', Q5: 'Q5-B', Q6: 'Q6-B', Q7: 'Q7-B',
      Q8: 'Q8-B', Q9: 'Q9-B', Q10: 'Q10-B', Q12: 'Q12-B', Q13: 'Q13-B',
      Q14: 'Q14-B', Q15: 'Q15-B', Q16: 'Q16-B', Q17: 'Q17-B', Q18: 'Q18-B',
    };
    const result = computeScores(answers, questions);
    expect(classify(result)).toBe('embodied_intuitive');
  });

  it('all-D answers produce Shadow Dancer classification', () => {
    const answers: Record<string, string> = {
      Q1: 'Q1-D', Q4: 'Q4-D', Q5: 'Q5-D', Q6: 'Q6-D', Q7: 'Q7-D',
      Q8: 'Q8-D', Q9: 'Q9-D', Q10: 'Q10-D', Q12: 'Q12-D', Q13: 'Q13-D',
      Q14: 'Q14-D', Q15: 'Q15-D', Q16: 'Q16-D', Q17: 'Q17-D', Q18: 'Q18-D',
    };
    const result = computeScores(answers, questions);
    expect(classify(result)).toBe('shadow_dancer');
  });

  it('all-C answers produce Ascending Seeker classification', () => {
    const answers: Record<string, string> = {
      Q1: 'Q1-C', Q4: 'Q4-C', Q5: 'Q5-C', Q6: 'Q6-C', Q7: 'Q7-C',
      Q8: 'Q8-C', Q9: 'Q9-C', Q10: 'Q10-C', Q12: 'Q12-C', Q13: 'Q13-C',
      Q14: 'Q14-C', Q15: 'Q15-C', Q16: 'Q16-C', Q17: 'Q17-C', Q18: 'Q18-C',
    };
    const result = computeScores(answers, questions);
    expect(classify(result)).toBe('ascending_seeker');
  });

  it('dual-scored E answers (Q7-E, Q8-E) with remaining A answers => Grounded Mystic', () => {
    // Q7-E and Q8-E each give A+4, D+4.
    // Remaining 13 scored questions answered A gives A another +52.
    // Total: A=60, B=0, C=0, D=8
    // GM: A>B(60>0) yes. A>C(60>0) yes. D>B(8>0) yes. D>C(8>0) yes. => GROUNDED MYSTIC
    const answers: Record<string, string> = {
      Q1: 'Q1-A', Q4: 'Q4-A', Q5: 'Q5-A', Q6: 'Q6-A',
      Q7: 'Q7-E', Q8: 'Q8-E',
      Q9: 'Q9-A', Q10: 'Q10-A', Q12: 'Q12-A', Q13: 'Q13-A',
      Q14: 'Q14-A', Q15: 'Q15-A', Q16: 'Q16-A', Q17: 'Q17-A', Q18: 'Q18-A',
    };
    const result = computeScores(answers, questions);
    expect(classify(result)).toBe('grounded_mystic');
  });

  it('mixed B/C answers produce Flow Artist classification', () => {
    // 8 B answers + 7 C answers: B=32, C=28, A=0, D=0
    // FA: B>A(32>0) yes. B>D(32>0) yes. C>A(28>0) yes. C>D(28>0) yes. => FLOW ARTIST
    const answers: Record<string, string> = {
      Q1: 'Q1-B', Q4: 'Q4-B', Q5: 'Q5-B', Q6: 'Q6-B',
      Q7: 'Q7-B', Q8: 'Q8-B', Q9: 'Q9-B', Q10: 'Q10-B',
      Q12: 'Q12-C', Q13: 'Q13-C', Q14: 'Q14-C', Q15: 'Q15-C',
      Q16: 'Q16-C', Q17: 'Q17-C', Q18: 'Q18-C',
    };
    const result = computeScores(answers, questions);
    expect(classify(result)).toBe('flow_artist');
  });
});
