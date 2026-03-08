/**
 * Quiz Data Model — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the quiz data module must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Source of truth: tally-quiz-extraction.md + operator-confirmed corrections (2026-03-07)
 *
 * Corrections applied (vs. original Tally form):
 *   - Q5: Shifted scoring fixed -> A=A, B=B, C=C, D=D
 *   - Q6: B/C swap fixed -> B=B, C=C
 *   - Q8-A: Missing scoring fixed -> Air Weaver +4
 *   - Q9-A: Duplicate scoring fixed -> Air Weaver +4 (once)
 *   - Q9-D: All-dimensions bug fixed -> Shadow Dancer +4 only
 */

import { describe, it, expect } from 'vitest';
import { questions } from '../src/lib/quiz-data';
import type { Question, Answer, ScoringWeight, Dimension } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQuestion(num: number): Question {
  const q = questions.find((q) => q.number === num);
  if (!q) throw new Error(`Question ${num} not found`);
  return q;
}

function getAnswer(questionNum: number, letter: string): Answer {
  const q = getQuestion(questionNum);
  const id = `Q${questionNum}-${letter}`;
  const a = q.answers.find((a) => a.id === id);
  if (!a) throw new Error(`Answer ${id} not found in Q${questionNum}`);
  return a;
}

const NON_SCORED_NUMBERS = [2, 3, 11, 19, 20] as const;
const SCORED_NUMBERS = [1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18] as const;
const ALL_DIMENSIONS: Dimension[] = ['A', 'B', 'C', 'D'];

// ---------------------------------------------------------------------------
// 1. Structural tests
// ---------------------------------------------------------------------------

describe('Structural integrity', () => {
  it('exports exactly 20 questions', () => {
    expect(questions).toHaveLength(20);
  });

  it('questions are numbered 1 through 20', () => {
    const numbers = questions.map((q) => q.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('every question has a unique id in format "Q{number}"', () => {
    const ids = questions.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(20);

    for (const q of questions) {
      expect(q.id).toBe(`Q${q.number}`);
    }
  });

  it('every answer has a unique id across the entire quiz', () => {
    const allAnswerIds = questions.flatMap((q) => q.answers.map((a) => a.id));
    const uniqueAnswerIds = new Set(allAnswerIds);
    expect(uniqueAnswerIds.size).toBe(allAnswerIds.length);
  });

  it('every answer id follows the format "Q{number}-{letter}"', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        expect(a.id).toMatch(/^Q\d{1,2}-[A-F]$/);
        expect(a.id).toMatch(new RegExp(`^Q${q.number}-`));
      }
    }
  });

  it('every question has at least 2 answers', () => {
    for (const q of questions) {
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Scored / non-scored split
// ---------------------------------------------------------------------------

describe('Scored and non-scored question split', () => {
  it('has exactly 15 scored questions', () => {
    const scored = questions.filter((q) => q.scored);
    expect(scored).toHaveLength(15);
  });

  it('has exactly 5 non-scored questions', () => {
    const nonScored = questions.filter((q) => !q.scored);
    expect(nonScored).toHaveLength(5);
  });

  it('non-scored questions are exactly Q2, Q3, Q11, Q19, Q20', () => {
    const nonScoredNumbers = questions
      .filter((q) => !q.scored)
      .map((q) => q.number)
      .sort((a, b) => a - b);
    expect(nonScoredNumbers).toEqual([2, 3, 11, 19, 20]);
  });

  it('scored questions are exactly Q1, Q4-Q10, Q12-Q18', () => {
    const scoredNumbers = questions
      .filter((q) => q.scored)
      .map((q) => q.number)
      .sort((a, b) => a - b);
    expect(scoredNumbers).toEqual([...SCORED_NUMBERS]);
  });
});

// ---------------------------------------------------------------------------
// 3. Scoring integrity: scored vs. non-scored answer behavior
// ---------------------------------------------------------------------------

describe('Scoring integrity', () => {
  it('every answer in a scored question has at least one scoring weight', () => {
    for (const num of SCORED_NUMBERS) {
      const q = getQuestion(num);
      for (const a of q.answers) {
        expect(
          a.scoring.length,
          `${a.id} in scored Q${num} should have scoring weights`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every answer in a non-scored question has an empty scoring array', () => {
    for (const num of NON_SCORED_NUMBERS) {
      const q = getQuestion(num);
      for (const a of q.answers) {
        expect(
          a.scoring,
          `${a.id} in non-scored Q${num} should have empty scoring`,
        ).toEqual([]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Standard scoring: all weights are exactly +4
// ---------------------------------------------------------------------------

describe('Standard scoring values', () => {
  it('every scoring weight across all questions is exactly +4 points', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        for (const w of a.scoring) {
          expect(w.points, `${a.id} weight for ${w.dimension}`).toBe(4);
        }
      }
    }
  });

  it('every scoring weight references a valid dimension (A, B, C, or D)', () => {
    for (const q of questions) {
      for (const a of q.answers) {
        for (const w of a.scoring) {
          expect(ALL_DIMENSIONS).toContain(w.dimension);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Grounded Mystic detectors: Q7-E and Q8-E dual scoring
// ---------------------------------------------------------------------------

describe('Grounded Mystic detector answers (Q7-E and Q8-E)', () => {
  it('Q7-E has exactly 2 scoring weights', () => {
    const answer = getAnswer(7, 'E');
    expect(answer.scoring).toHaveLength(2);
  });

  it('Q7-E scores both Air Weaver (A) and Shadow Dancer (D)', () => {
    const answer = getAnswer(7, 'E');
    const dims = answer.scoring.map((w) => w.dimension).sort();
    expect(dims).toEqual(['A', 'D']);
  });

  it('Q7-E awards +4 to each scored dimension', () => {
    const answer = getAnswer(7, 'E');
    for (const w of answer.scoring) {
      expect(w.points).toBe(4);
    }
  });

  it('Q8-E has exactly 2 scoring weights', () => {
    const answer = getAnswer(8, 'E');
    expect(answer.scoring).toHaveLength(2);
  });

  it('Q8-E scores both Air Weaver (A) and Shadow Dancer (D)', () => {
    const answer = getAnswer(8, 'E');
    const dims = answer.scoring.map((w) => w.dimension).sort();
    expect(dims).toEqual(['A', 'D']);
  });

  it('Q8-E awards +4 to each scored dimension', () => {
    const answer = getAnswer(8, 'E');
    for (const w of answer.scoring) {
      expect(w.points).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Answer count validation
// ---------------------------------------------------------------------------

describe('Answer count per question', () => {
  it('Q7 has exactly 5 answer options (A-E)', () => {
    const q = getQuestion(7);
    expect(q.answers).toHaveLength(5);
  });

  it('Q8 has exactly 5 answer options (A-E)', () => {
    const q = getQuestion(8);
    expect(q.answers).toHaveLength(5);
  });

  it('all scored questions except Q7 and Q8 have exactly 4 answers', () => {
    const fourOptionScored = SCORED_NUMBERS.filter((n) => n !== 7 && n !== 8);
    for (const num of fourOptionScored) {
      const q = getQuestion(num);
      expect(q.answers, `Q${num} should have 4 answers`).toHaveLength(4);
    }
  });

  // Non-scored questions have varying answer counts per the extraction
  it('Q2 has 3 answers', () => {
    expect(getQuestion(2).answers).toHaveLength(3);
  });

  it('Q3 has 6 answers', () => {
    expect(getQuestion(3).answers).toHaveLength(6);
  });

  it('Q11 has 4 answers', () => {
    expect(getQuestion(11).answers).toHaveLength(4);
  });

  it('Q19 has 2 answers', () => {
    expect(getQuestion(19).answers).toHaveLength(2);
  });

  it('Q20 has 5 answers', () => {
    expect(getQuestion(20).answers).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// 7. Corrected scoring verification (operator-confirmed 2026-03-07)
// ---------------------------------------------------------------------------

describe('Corrected scoring (operator-confirmed fixes)', () => {
  describe('Q5: shifted scoring corrected to A=A, B=B, C=C, D=D', () => {
    it('Q5-A scores Air Weaver (A) only', () => {
      const answer = getAnswer(5, 'A');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('A');
      expect(answer.scoring[0].points).toBe(4);
    });

    it('Q5-B scores Embodied Intuitive (B) only', () => {
      const answer = getAnswer(5, 'B');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('B');
      expect(answer.scoring[0].points).toBe(4);
    });

    it('Q5-C scores Ascending Seeker (C) only', () => {
      const answer = getAnswer(5, 'C');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('C');
      expect(answer.scoring[0].points).toBe(4);
    });

    it('Q5-D scores Shadow Dancer (D) only', () => {
      const answer = getAnswer(5, 'D');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('D');
      expect(answer.scoring[0].points).toBe(4);
    });
  });

  describe('Q6: B/C swap corrected to B=B, C=C', () => {
    it('Q6-A scores Air Weaver (A) — unchanged', () => {
      const answer = getAnswer(6, 'A');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('A');
    });

    it('Q6-B scores Embodied Intuitive (B), not Ascending Seeker', () => {
      const answer = getAnswer(6, 'B');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('B');
      expect(answer.scoring[0].points).toBe(4);
    });

    it('Q6-C scores Ascending Seeker (C), not Embodied Intuitive', () => {
      const answer = getAnswer(6, 'C');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('C');
      expect(answer.scoring[0].points).toBe(4);
    });

    it('Q6-D scores Shadow Dancer (D) — unchanged', () => {
      const answer = getAnswer(6, 'D');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('D');
    });
  });

  describe('Q8-A: missing scoring corrected to Air Weaver +4', () => {
    it('Q8-A scores Air Weaver (A) with +4 points', () => {
      const answer = getAnswer(8, 'A');
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe('A');
      expect(answer.scoring[0].points).toBe(4);
    });
  });

  describe('Q9-A: duplicate scoring corrected to single Air Weaver +4', () => {
    it('Q9-A has exactly 1 scoring weight', () => {
      const answer = getAnswer(9, 'A');
      expect(answer.scoring).toHaveLength(1);
    });

    it('Q9-A scores Air Weaver (A) with +4 points (not +8)', () => {
      const answer = getAnswer(9, 'A');
      expect(answer.scoring[0].dimension).toBe('A');
      expect(answer.scoring[0].points).toBe(4);
    });
  });

  describe('Q9-D: all-dimensions bug corrected to Shadow Dancer +4 only', () => {
    it('Q9-D has exactly 1 scoring weight', () => {
      const answer = getAnswer(9, 'D');
      expect(answer.scoring).toHaveLength(1);
    });

    it('Q9-D scores Shadow Dancer (D) only with +4 points', () => {
      const answer = getAnswer(9, 'D');
      expect(answer.scoring[0].dimension).toBe('D');
      expect(answer.scoring[0].points).toBe(4);
    });
  });
});

// ---------------------------------------------------------------------------
// 8. Dimension coverage across scored questions
// ---------------------------------------------------------------------------

describe('Dimension coverage', () => {
  it('all 4 dimensions are represented across scored question answers', () => {
    const allDimensions = new Set<Dimension>();

    for (const num of SCORED_NUMBERS) {
      const q = getQuestion(num);
      for (const a of q.answers) {
        for (const w of a.scoring) {
          allDimensions.add(w.dimension);
        }
      }
    }

    expect(allDimensions.size).toBe(4);
    for (const dim of ALL_DIMENSIONS) {
      expect(allDimensions.has(dim), `Dimension ${dim} should be present`).toBe(true);
    }
  });

  it('each dimension appears in multiple scored questions', () => {
    const dimQuestionCounts: Record<Dimension, Set<number>> = {
      A: new Set(),
      B: new Set(),
      C: new Set(),
      D: new Set(),
    };

    for (const num of SCORED_NUMBERS) {
      const q = getQuestion(num);
      for (const a of q.answers) {
        for (const w of a.scoring) {
          dimQuestionCounts[w.dimension].add(num);
        }
      }
    }

    for (const dim of ALL_DIMENSIONS) {
      expect(
        dimQuestionCounts[dim].size,
        `Dimension ${dim} should appear in multiple questions`,
      ).toBeGreaterThanOrEqual(10);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Non-scored question IDs (redundant with #2, but explicit contract)
// ---------------------------------------------------------------------------

describe('Non-scored question identity', () => {
  it.each([
    [2, 'Q2'],
    [3, 'Q3'],
    [11, 'Q11'],
    [19, 'Q19'],
    [20, 'Q20'],
  ])('Q%i exists with id "%s" and scored=false', (num, expectedId) => {
    const q = getQuestion(num);
    expect(q.id).toBe(expectedId);
    expect(q.scored).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Question and answer text completeness
// ---------------------------------------------------------------------------

describe('Text completeness', () => {
  it('every question has non-empty text', () => {
    for (const q of questions) {
      expect(q.text.trim().length, `Q${q.number} text should not be empty`).toBeGreaterThan(0);
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
// 11. Single-scored answers: most answers have exactly 1 weight
// ---------------------------------------------------------------------------

describe('Single vs. dual scoring', () => {
  it('only Q7-E and Q8-E have dual scoring (2 weights); all other answers have exactly 1', () => {
    const dualScoredIds = new Set(['Q7-E', 'Q8-E']);

    for (const num of SCORED_NUMBERS) {
      const q = getQuestion(num);
      for (const a of q.answers) {
        if (dualScoredIds.has(a.id)) {
          expect(a.scoring, `${a.id} should have 2 scoring weights`).toHaveLength(2);
        } else {
          expect(a.scoring, `${a.id} should have exactly 1 scoring weight`).toHaveLength(1);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Clean question spot-checks (verifying standard A/B/C/D pattern)
// ---------------------------------------------------------------------------

describe('Clean question scoring patterns', () => {
  const cleanQuestions = [1, 4, 10, 12, 13, 14, 15, 16, 17, 18];

  it.each(cleanQuestions)('Q%i has standard A=A, B=B, C=C, D=D scoring', (num) => {
    const expectedMap: Record<string, Dimension> = { A: 'A', B: 'B', C: 'C', D: 'D' };

    for (const [letter, expectedDim] of Object.entries(expectedMap)) {
      const answer = getAnswer(num, letter);
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe(expectedDim);
      expect(answer.scoring[0].points).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Q7 full scoring verification (includes standard + dual-scored E)
// ---------------------------------------------------------------------------

describe('Q7 full scoring map', () => {
  it('Q7-A scores A, Q7-B scores B, Q7-C scores C, Q7-D scores D (single weights)', () => {
    const map: [string, Dimension][] = [
      ['A', 'A'],
      ['B', 'B'],
      ['C', 'C'],
      ['D', 'D'],
    ];
    for (const [letter, dim] of map) {
      const answer = getAnswer(7, letter);
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe(dim);
      expect(answer.scoring[0].points).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 14. Q8 full scoring verification (corrected A + standard B/C/D + dual E)
// ---------------------------------------------------------------------------

describe('Q8 full scoring map', () => {
  it('Q8-A scores A, Q8-B scores B, Q8-C scores C, Q8-D scores D (single weights)', () => {
    const map: [string, Dimension][] = [
      ['A', 'A'],
      ['B', 'B'],
      ['C', 'C'],
      ['D', 'D'],
    ];
    for (const [letter, dim] of map) {
      const answer = getAnswer(8, letter);
      expect(answer.scoring).toHaveLength(1);
      expect(answer.scoring[0].dimension).toBe(dim);
      expect(answer.scoring[0].points).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. Q9 full scoring verification (all corrections applied)
// ---------------------------------------------------------------------------

describe('Q9 full scoring map (corrected)', () => {
  it('Q9-A scores A only (+4, not duplicate +8)', () => {
    const answer = getAnswer(9, 'A');
    expect(answer.scoring).toHaveLength(1);
    expect(answer.scoring[0]).toEqual({ dimension: 'A', points: 4 });
  });

  it('Q9-B scores B (+4)', () => {
    const answer = getAnswer(9, 'B');
    expect(answer.scoring).toHaveLength(1);
    expect(answer.scoring[0]).toEqual({ dimension: 'B', points: 4 });
  });

  it('Q9-C scores C (+4)', () => {
    const answer = getAnswer(9, 'C');
    expect(answer.scoring).toHaveLength(1);
    expect(answer.scoring[0]).toEqual({ dimension: 'C', points: 4 });
  });

  it('Q9-D scores D only (+4, not all-dimensions)', () => {
    const answer = getAnswer(9, 'D');
    expect(answer.scoring).toHaveLength(1);
    expect(answer.scoring[0]).toEqual({ dimension: 'D', points: 4 });
  });
});

// ---------------------------------------------------------------------------
// 16. Type safety: exported array shape
// ---------------------------------------------------------------------------

describe('Export shape', () => {
  it('questions is a non-empty array', () => {
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
  });

  it('every question object has the required properties', () => {
    for (const q of questions) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('number');
      expect(q).toHaveProperty('text');
      expect(q).toHaveProperty('answers');
      expect(q).toHaveProperty('scored');
      expect(typeof q.id).toBe('string');
      expect(typeof q.number).toBe('number');
      expect(typeof q.text).toBe('string');
      expect(Array.isArray(q.answers)).toBe(true);
      expect(typeof q.scored).toBe('boolean');
    }
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
