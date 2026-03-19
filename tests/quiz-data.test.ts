/**
 * Quiz Data Model v2 — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the quiz data module must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Source of truth: operations/mastermind-quiz-design-overhaul/approved-questions.md
 *
 * Quiz v2 changes from v1:
 *   - 20 questions → 12 (2 segmentation + 10 scored)
 *   - `scored: boolean` → `phase: 'scored' | 'segmentation'`
 *   - Added `format: QuestionFormat` ('single_select' | 'forced_pair')
 *   - Added `pair: [Dimension, Dimension] | null`
 *   - Variable weighting: +3, +4, +6 tiers (was flat +4)
 *   - Forced pairs: +6/+2 dual-dimension scoring
 *   - New ID convention: NQ01-NQ07, FP01-FP03, SEG1-SEG2
 */

import { describe, it, expect } from 'vitest';
import { questions } from '../src/lib/quiz-data';
import type { Question, Answer, ScoringWeight, Dimension, QuestionFormat } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQuestionById(id: string): Question {
  const q = questions.find((q) => q.id === id);
  if (!q) throw new Error(`Question ${id} not found`);
  return q;
}

function getAnswer(questionId: string, answerId: string): Answer {
  const q = getQuestionById(questionId);
  const a = q.answers.find((a) => a.id === answerId);
  if (!a) throw new Error(`Answer ${answerId} not found in ${questionId}`);
  return a;
}

const SCORED_IDS = ['NQ01', 'NQ02', 'FP01', 'NQ03', 'NQ04', 'FP02', 'NQ05', 'NQ06', 'FP03', 'NQ07'] as const;
const NORMATIVE_IDS = ['NQ01', 'NQ02', 'NQ03', 'NQ04', 'NQ05', 'NQ06', 'NQ07'] as const;
const FORCED_PAIR_IDS = ['FP01', 'FP02', 'FP03'] as const;
const SEGMENTATION_IDS = ['SEG1', 'SEG2'] as const;
const ALL_DIMENSIONS: Dimension[] = ['A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------
// 1. Structural tests
// ---------------------------------------------------------------------------

describe('Structural integrity', () => {
  it('exports exactly 12 questions', () => {
    expect(questions).toHaveLength(12);
  });

  it('questions are numbered 1 through 12', () => {
    const numbers = questions.map((q) => q.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('every question has a unique id', () => {
    const ids = questions.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(12);
  });

  it('every answer has a unique id across the entire quiz', () => {
    const allAnswerIds = questions.flatMap((q) => q.answers.map((a) => a.id));
    const uniqueAnswerIds = new Set(allAnswerIds);
    expect(uniqueAnswerIds.size).toBe(allAnswerIds.length);
  });

  it('every question has at least 2 answers', () => {
    for (const q of questions) {
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every question has the required properties', () => {
    for (const q of questions) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('number');
      expect(q).toHaveProperty('text');
      expect(q).toHaveProperty('answers');
      expect(q).toHaveProperty('format');
      expect(q).toHaveProperty('phase');
      expect(q).toHaveProperty('pair');
      expect(typeof q.id).toBe('string');
      expect(typeof q.number).toBe('number');
      expect(typeof q.text).toBe('string');
      expect(Array.isArray(q.answers)).toBe(true);
      expect(typeof q.format).toBe('string');
      expect(typeof q.phase).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Phase split (scored vs segmentation)
// ---------------------------------------------------------------------------

describe('Phase split', () => {
  it('has exactly 10 scored questions', () => {
    const scored = questions.filter((q) => q.phase === 'scored');
    expect(scored).toHaveLength(10);
  });

  it('has exactly 2 segmentation questions', () => {
    const seg = questions.filter((q) => q.phase === 'segmentation');
    expect(seg).toHaveLength(2);
  });

  it('scored questions have ids NQ01-NQ07 and FP01-FP03', () => {
    const scoredIds = questions
      .filter((q) => q.phase === 'scored')
      .map((q) => q.id)
      .sort();
    expect(scoredIds).toEqual([...SCORED_IDS].sort());
  });

  it('segmentation questions have ids SEG1 and SEG2', () => {
    const segIds = questions
      .filter((q) => q.phase === 'segmentation')
      .map((q) => q.id)
      .sort();
    expect(segIds).toEqual([...SEGMENTATION_IDS].sort());
  });
});

// ---------------------------------------------------------------------------
// 3. Format split (normative vs forced-pair)
// ---------------------------------------------------------------------------

describe('Format split', () => {
  it('has exactly 7 normative (single_select) scored questions', () => {
    const normative = questions.filter(
      (q) => q.phase === 'scored' && q.format === 'single_select',
    );
    expect(normative).toHaveLength(7);
  });

  it('has exactly 3 forced-pair scored questions', () => {
    const fp = questions.filter(
      (q) => q.phase === 'scored' && q.format === 'forced_pair',
    );
    expect(fp).toHaveLength(3);
  });

  it('every normative scored question has exactly 4 answers', () => {
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      expect(q.answers, `${id} should have 4 answers`).toHaveLength(4);
    }
  });

  it('every forced-pair question has exactly 2 answers', () => {
    for (const id of FORCED_PAIR_IDS) {
      const q = getQuestionById(id);
      expect(q.answers, `${id} should have 2 answers`).toHaveLength(2);
    }
  });

  it('segmentation questions use single_select format', () => {
    for (const id of SEGMENTATION_IDS) {
      const q = getQuestionById(id);
      expect(q.format).toBe('single_select');
    }
  });

  it('normative scored questions have pair = null', () => {
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      expect(q.pair, `${id} should have pair = null`).toBeNull();
    }
  });

  it('segmentation questions have pair = null', () => {
    for (const id of SEGMENTATION_IDS) {
      const q = getQuestionById(id);
      expect(q.pair).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Forced-pair scoring contracts
// ---------------------------------------------------------------------------

describe('Forced-pair scoring', () => {
  it('every forced-pair answer has exactly 2 scoring weights', () => {
    for (const id of FORCED_PAIR_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        expect(
          a.scoring.length,
          `${a.id} should have exactly 2 scoring weights`,
        ).toBe(2);
      }
    }
  });

  it('every forced-pair answer has one weight at +6 and one at +2', () => {
    for (const id of FORCED_PAIR_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        const points = a.scoring.map((w) => w.points).sort((a, b) => a - b);
        expect(points, `${a.id} should have [2, 6] points`).toEqual([2, 6]);
      }
    }
  });

  it('FP01 tests A vs D (Grounded Mystic boundary)', () => {
    const q = getQuestionById('FP01');
    expect(q.pair).toEqual(['A', 'D']);
    const dims = new Set(q.answers.flatMap((a) => a.scoring.map((w) => w.dimension)));
    expect(dims.has('A')).toBe(true);
    expect(dims.has('D')).toBe(true);
  });

  it('FP02 tests B vs C (Flow Artist boundary)', () => {
    const q = getQuestionById('FP02');
    expect(q.pair).toEqual(['B', 'C']);
    const dims = new Set(q.answers.flatMap((a) => a.scoring.map((w) => w.dimension)));
    expect(dims.has('B')).toBe(true);
    expect(dims.has('C')).toBe(true);
  });

  it('FP03 tests B vs D (flexible boundary)', () => {
    const q = getQuestionById('FP03');
    expect(q.pair).toEqual(['B', 'D']);
    const dims = new Set(q.answers.flatMap((a) => a.scoring.map((w) => w.dimension)));
    expect(dims.has('B')).toBe(true);
    expect(dims.has('D')).toBe(true);
  });

  it('each forced-pair answer has the +6 weight on one pair dimension and +2 on the other', () => {
    for (const id of FORCED_PAIR_IDS) {
      const q = getQuestionById(id);
      const [dim1, dim2] = q.pair!;
      for (const a of q.answers) {
        const scoringDims = a.scoring.map((w) => w.dimension).sort();
        expect(scoringDims, `${a.id} should score exactly ${dim1} and ${dim2}`).toEqual(
          [dim1, dim2].sort(),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Variable weighting on normative questions
// ---------------------------------------------------------------------------

describe('Variable weighting', () => {
  it('normative questions use weights from the set {3, 4, 6}', () => {
    const validWeights = new Set([3, 4, 6]);
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        for (const w of a.scoring) {
          expect(
            validWeights.has(w.points),
            `${a.id} weight ${w.points} not in {3, 4, 6}`,
          ).toBe(true);
        }
      }
    }
  });

  it('all answers within a normative question have the same point value', () => {
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      const weights = q.answers.map((a) => a.scoring[0]?.points).filter(Boolean);
      const uniqueWeights = new Set(weights);
      expect(
        uniqueWeights.size,
        `${id} should have uniform weight across its answers`,
      ).toBe(1);
    }
  });

  it('at least one normative question uses +6 (anchor) weight', () => {
    const hasAnchor = NORMATIVE_IDS.some((id) => {
      const q = getQuestionById(id);
      return q.answers.some((a) => a.scoring.some((w) => w.points === 6));
    });
    expect(hasAnchor).toBe(true);
  });

  it('at least one normative question uses +3 (lighter) weight', () => {
    const hasLighter = NORMATIVE_IDS.some((id) => {
      const q = getQuestionById(id);
      return q.answers.some((a) => a.scoring.some((w) => w.points === 3));
    });
    expect(hasLighter).toBe(true);
  });

  it('exactly 2 normative questions are anchor (+6)', () => {
    const anchors = NORMATIVE_IDS.filter((id) => {
      const q = getQuestionById(id);
      return q.answers[0]?.scoring[0]?.points === 6;
    });
    expect(anchors).toHaveLength(2);
  });

  it('exactly 2 normative questions are lighter (+3)', () => {
    const lighter = NORMATIVE_IDS.filter((id) => {
      const q = getQuestionById(id);
      return q.answers[0]?.scoring[0]?.points === 3;
    });
    expect(lighter).toHaveLength(2);
  });

  it('exactly 3 normative questions are standard (+4)', () => {
    const standard = NORMATIVE_IDS.filter((id) => {
      const q = getQuestionById(id);
      return q.answers[0]?.scoring[0]?.points === 4;
    });
    expect(standard).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 6. Scoring integrity
// ---------------------------------------------------------------------------

describe('Scoring integrity', () => {
  it('every answer in a scored question has at least one scoring weight', () => {
    for (const id of SCORED_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        expect(
          a.scoring.length,
          `${a.id} in scored ${id} should have scoring weights`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every answer in a segmentation question has an empty scoring array', () => {
    for (const id of SEGMENTATION_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        expect(
          a.scoring,
          `${a.id} in segmentation ${id} should have empty scoring`,
        ).toEqual([]);
      }
    }
  });

  it('every scoring weight references a valid dimension (A, B, C, or D)', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        for (const w of a.scoring) {
          expect(ALL_DIMENSIONS, `${a.id} has invalid dimension ${w.dimension}`).toContain(
            w.dimension,
          );
        }
      }
    }
  });

  it('normative scored answers each have exactly 1 scoring weight', () => {
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        expect(a.scoring, `${a.id} should have exactly 1 weight`).toHaveLength(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Question sequencing
// ---------------------------------------------------------------------------

describe('Question sequencing', () => {
  it('questions are in the correct order: SEG1, SEG2, then scored', () => {
    expect(questions[0].id).toBe('SEG1');
    expect(questions[1].id).toBe('SEG2');
  });

  it('scored questions follow sequencing spec: NQ, NQ, FP, NQ, NQ, FP, NQ, NQ, FP, NQ', () => {
    const scoredQuestions = questions.filter((q) => q.phase === 'scored');
    const expectedIds = ['NQ01', 'NQ02', 'FP01', 'NQ03', 'NQ04', 'FP02', 'NQ05', 'NQ06', 'FP03', 'NQ07'];
    const actualIds = scoredQuestions.map((q) => q.id);
    expect(actualIds).toEqual(expectedIds);
  });

  it('forced pairs are at positions 3, 6, 9 within the scored section', () => {
    const scoredQuestions = questions.filter((q) => q.phase === 'scored');
    expect(scoredQuestions[2].format).toBe('forced_pair'); // position 3
    expect(scoredQuestions[5].format).toBe('forced_pair'); // position 6
    expect(scoredQuestions[8].format).toBe('forced_pair'); // position 9
  });
});

// ---------------------------------------------------------------------------
// 8. Dimension coverage
// ---------------------------------------------------------------------------

describe('Dimension coverage', () => {
  it('all 4 dimensions are represented across scored question answers', () => {
    const allDimensions = new Set<string>();
    for (const id of SCORED_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        for (const w of a.scoring) {
          allDimensions.add(w.dimension);
        }
      }
    }
    expect(allDimensions.size).toBe(4);
    for (const dim of ALL_DIMENSIONS) {
      expect(allDimensions.has(dim)).toBe(true);
    }
  });

  it('every normative question covers all 4 dimensions (one per answer)', () => {
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      const dims = q.answers.map((a) => a.scoring[0]?.dimension).sort();
      expect(dims, `${id} should cover A, B, C, D`).toEqual(['A', 'B', 'C', 'D']);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Segmentation question shape
// ---------------------------------------------------------------------------

describe('Segmentation questions', () => {
  it('SEG1 has 3 answers', () => {
    expect(getQuestionById('SEG1').answers).toHaveLength(3);
  });

  it('SEG2 has 6 answers', () => {
    expect(getQuestionById('SEG2').answers).toHaveLength(6);
  });

  it('segmentation questions have non-empty text', () => {
    for (const id of SEGMENTATION_IDS) {
      const q = getQuestionById(id);
      expect(q.text.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Text completeness
// ---------------------------------------------------------------------------

describe('Text completeness', () => {
  it('every question has non-empty text', () => {
    for (const q of questions) {
      expect(q.text.trim().length, `${q.id} text should not be empty`).toBeGreaterThan(0);
    }
  });

  it('every answer has non-empty text', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        expect(a.text.trim().length, `${a.id} text should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Specific weight tier assignments (per approved-questions.md)
// ---------------------------------------------------------------------------

describe('Specific weight tier assignments', () => {
  it('NQ03 (feel most alive) is anchor weight +6', () => {
    const q = getQuestionById('NQ03');
    expect(q.answers[0].scoring[0].points).toBe(6);
  });

  it('NQ06 (defying gravity) is anchor weight +6', () => {
    const q = getQuestionById('NQ06');
    expect(q.answers[0].scoring[0].points).toBe(6);
  });

  it('NQ01 is standard weight +4', () => {
    const q = getQuestionById('NQ01');
    expect(q.answers[0].scoring[0].points).toBe(4);
  });

  it('NQ02 is standard weight +4', () => {
    const q = getQuestionById('NQ02');
    expect(q.answers[0].scoring[0].points).toBe(4);
  });

  it('NQ04 is standard weight +4', () => {
    const q = getQuestionById('NQ04');
    expect(q.answers[0].scoring[0].points).toBe(4);
  });

  it('NQ05 is lighter weight +3', () => {
    const q = getQuestionById('NQ05');
    expect(q.answers[0].scoring[0].points).toBe(3);
  });

  it('NQ07 is lighter weight +3', () => {
    const q = getQuestionById('NQ07');
    expect(q.answers[0].scoring[0].points).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 12. Answer ID format
// ---------------------------------------------------------------------------

describe('Answer ID format', () => {
  it('normative answer IDs follow format "{QuestionID}-{A|B|C|D}"', () => {
    for (const id of NORMATIVE_IDS) {
      const q = getQuestionById(id);
      const expectedLetters = ['A', 'B', 'C', 'D'];
      for (let i = 0; i < q.answers.length; i++) {
        expect(q.answers[i].id).toBe(`${id}-${expectedLetters[i]}`);
      }
    }
  });

  it('forced-pair answer IDs use the dimension letters from the pair', () => {
    for (const id of FORCED_PAIR_IDS) {
      const q = getQuestionById(id);
      const [dim1, dim2] = q.pair!;
      const answerIds = q.answers.map((a) => a.id).sort();
      expect(answerIds).toEqual([`${id}-${dim1}`, `${id}-${dim2}`].sort());
    }
  });

  it('segmentation answer IDs follow format "{QuestionID}-{letter}"', () => {
    for (const id of SEGMENTATION_IDS) {
      const q = getQuestionById(id);
      for (const a of q.answers) {
        expect(a.id).toMatch(new RegExp(`^${id}-[A-F]$`));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Export shape
// ---------------------------------------------------------------------------

describe('Export shape', () => {
  it('questions is a non-empty array', () => {
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
  });

  it('every answer object has the required properties', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('text');
        expect(a).toHaveProperty('scoring');
        expect(typeof a.id).toBe('string');
        expect(typeof a.text).toBe('string');
        expect(Array.isArray(a.scoring)).toBe(true);
      }
    }
  });

  it('every scoring weight has dimension and points properties', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        for (const w of a.scoring) {
          expect(w).toHaveProperty('dimension');
          expect(w).toHaveProperty('points');
          expect(typeof w.dimension).toBe('string');
          expect(typeof w.points).toBe('number');
        }
      }
    }
  });
});
