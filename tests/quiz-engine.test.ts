/**
 * Quiz Engine — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the quiz-engine module must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/lib/quiz-engine.ts
 *
 * The quiz engine is a state machine extracted from quiz.astro's inline
 * script. It manages the full quiz flow:
 *
 *   intro → segmentation → scored → email-gate → calculating
 *     → [self-select if confidence < 0.15] → results
 *
 * Exports:
 *   - QuizPhase (type)
 *   - QuizState (type)
 *   - QuizEngine (type)
 *   - createQuizEngine(seed?: number): QuizEngine
 */

import { describe, it, expect } from 'vitest';
import { createQuizEngine } from '../src/lib/quiz-engine';
import type { QuizPhase, QuizState, QuizEngine } from '../src/lib/quiz-engine';
import { questions } from '../src/lib/quiz-data';
import type { ArchetypeSlug } from '../src/lib/classifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all segmentation questions from the data. */
const segmentationQuestions = questions.filter(q => q.phase === 'segmentation');
const scoredQuestions = questions.filter(q => q.phase === 'scored');

/** Answer all segmentation questions with first answer. */
function answerAllSegmentation(engine: QuizEngine): void {
  for (const q of segmentationQuestions) {
    engine.answerQuestion(q.answers[0].id);
  }
}

/** Answer all scored questions with first answer. */
function answerAllScored(engine: QuizEngine): void {
  for (const q of scoredQuestions) {
    engine.answerQuestion(q.answers[0].id);
  }
}

/** Answer all questions (seg + scored) with first answer, get to email-gate. */
function advanceToEmailGate(engine: QuizEngine): void {
  engine.start();
  answerAllSegmentation(engine);
  answerAllScored(engine);
}

/** Get to calculating phase. */
function advanceToCalculating(engine: QuizEngine): void {
  advanceToEmailGate(engine);
  engine.skipEmail();
}

/**
 * Answer scored questions to produce roughly equal dimension scores,
 * which should yield confidence < 0.15 (self-select trigger).
 * Strategy: alternate answers across dimensions A, B, C, D cyclically.
 */
function answerScoredForLowConfidence(engine: QuizEngine): void {
  for (let i = 0; i < scoredQuestions.length; i++) {
    const q = scoredQuestions[i];
    // For normative questions: cycle through answers 0,1,2,3
    // For forced pairs: alternate between answers 0 and 1
    const answerIndex = i % q.answers.length;
    engine.answerQuestion(q.answers[answerIndex].id);
  }
}

/**
 * Answer scored questions to produce a dominant A dimension,
 * which should yield high confidence (no self-select).
 * Strategy: always pick the A-dimension answer for normative,
 * and the A-favoring answer for forced pairs.
 */
function answerScoredForHighConfidence(engine: QuizEngine): void {
  for (const q of scoredQuestions) {
    // Pick the first answer — for normative Qs this is always the A-dimension answer
    engine.answerQuestion(q.answers[0].id);
  }
}

// ---------------------------------------------------------------------------
// Type export contract
// ---------------------------------------------------------------------------

describe('Quiz Engine — Type exports', () => {
  it('createQuizEngine is a function', () => {
    expect(typeof createQuizEngine).toBe('function');
  });

  it('createQuizEngine returns an object with the expected API', () => {
    const engine = createQuizEngine(42);
    expect(typeof engine.getState).toBe('function');
    expect(typeof engine.start).toBe('function');
    expect(typeof engine.answerQuestion).toBe('function');
    expect(typeof engine.goBack).toBe('function');
    expect(typeof engine.getProgress).toBe('function');
    expect(typeof engine.getShuffledAnswerIndices).toBe('function');
    expect(typeof engine.submitEmail).toBe('function');
    expect(typeof engine.skipEmail).toBe('function');
    expect(typeof engine.proceedFromCalculating).toBe('function');
    expect(typeof engine.selectArchetype).toBe('function');
    expect(typeof engine.getCurrentQuestion).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('Quiz Engine — Initial state', () => {
  it('starts in intro phase', () => {
    const engine = createQuizEngine(42);
    const state = engine.getState();
    expect(state.phase).toBe('intro');
  });

  it('getCurrentQuestion returns null in intro phase', () => {
    const engine = createQuizEngine(42);
    expect(engine.getCurrentQuestion()).toBeNull();
  });

  it('getProgress returns { current: 0, total: 10 } in intro', () => {
    const engine = createQuizEngine(42);
    const progress = engine.getProgress();
    expect(progress.current).toBe(0);
    expect(progress.total).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Phase flow: intro → segmentation → scored → email-gate → calculating → results
// ---------------------------------------------------------------------------

describe('Quiz Engine — Phase flow', () => {
  it('start() transitions from intro to first question', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const state = engine.getState();
    expect(state.phase).toBe('segmentation');
    expect(engine.getCurrentQuestion()).not.toBeNull();
    expect(engine.getCurrentQuestion()!.id).toBe(segmentationQuestions[0].id);
  });

  it('answering segmentation questions keeps phase as segmentation', () => {
    const engine = createQuizEngine(42);
    engine.start();
    // Answer first segmentation question
    engine.answerQuestion(segmentationQuestions[0].answers[0].id);
    const state = engine.getState();
    if (segmentationQuestions.length > 1) {
      expect(state.phase).toBe('segmentation');
      expect(engine.getCurrentQuestion()!.id).toBe(segmentationQuestions[1].id);
    }
  });

  it('transitions from segmentation to scored after all segmentation questions', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    const state = engine.getState();
    expect(state.phase).toBe('scored');
    expect(engine.getCurrentQuestion()!.id).toBe(scoredQuestions[0].id);
  });

  it('transitions to email-gate after all scored questions', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    expect(engine.getState().phase).toBe('email-gate');
    expect(engine.getCurrentQuestion()).toBeNull();
  });

  it('submitEmail() transitions to calculating', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    engine.submitEmail('test@example.com');
    expect(engine.getState().phase).toBe('calculating');
  });

  it('skipEmail() transitions to calculating', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    engine.skipEmail();
    expect(engine.getState().phase).toBe('calculating');
  });

  it('proceedFromCalculating() transitions to results when confidence >= 0.15', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    answerScoredForHighConfidence(engine);
    engine.skipEmail();
    engine.proceedFromCalculating();
    const state = engine.getState();
    // Should go to results, not self-select
    expect(state.phase).toBe('results');
    expect(state.classificationResult).not.toBeNull();
    expect(state.classificationResult!.confidence).toBeGreaterThanOrEqual(0.15);
  });

  it('full happy path: intro → segmentation → scored → email-gate → calculating → results', () => {
    const engine = createQuizEngine(42);

    // intro
    expect(engine.getState().phase).toBe('intro');

    // start → first segmentation
    engine.start();
    expect(engine.getState().phase).toBe('segmentation');

    // answer all segmentation → first scored
    answerAllSegmentation(engine);
    expect(engine.getState().phase).toBe('scored');

    // answer all scored → email-gate
    answerAllScored(engine);
    expect(engine.getState().phase).toBe('email-gate');

    // submit email → calculating
    engine.submitEmail('user@example.com');
    expect(engine.getState().phase).toBe('calculating');

    // proceed → results
    engine.proceedFromCalculating();
    expect(engine.getState().phase).toBe('results');
    expect(engine.getState().classificationResult).not.toBeNull();
    expect(engine.getState().classificationResult!.primary).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Self-select phase
// ---------------------------------------------------------------------------

describe('Quiz Engine — Self-select', () => {
  it('triggers self-select when classification confidence < 0.15', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    answerScoredForLowConfidence(engine);
    engine.skipEmail();
    engine.proceedFromCalculating();

    const state = engine.getState();
    // S-12: Unconditional assertion — even distribution MUST produce low confidence
    expect(state.classificationResult!.confidence).toBeLessThan(0.15);
    expect(state.phase).toBe('self-select');
  });

  it('does NOT trigger self-select when confidence >= 0.15', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    answerScoredForHighConfidence(engine);
    engine.skipEmail();
    engine.proceedFromCalculating();

    const state = engine.getState();
    expect(state.phase).toBe('results');
    expect(state.classificationResult!.confidence).toBeGreaterThanOrEqual(0.15);
  });

  it('selectArchetype() records selection and transitions to results', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    answerScoredForLowConfidence(engine);
    engine.skipEmail();
    engine.proceedFromCalculating();

    // S-12: Unconditional assertion — even distribution reaches self-select
    const state = engine.getState();
    expect(state.phase).toBe('self-select');
    const slug: ArchetypeSlug = 'shadow_dancer';
    engine.selectArchetype(slug);
    const afterSelect = engine.getState();
    expect(afterSelect.phase).toBe('results');
    expect(afterSelect.selectedArchetype).toBe(slug);
  });
});

// ---------------------------------------------------------------------------
// Deterministic self-select testing with controlled scores
// ---------------------------------------------------------------------------

describe('Quiz Engine — Self-select deterministic', () => {
  /**
   * Construct an answer set that cycles evenly across dimensions.
   * For each normative question, pick the answer at index (i % 4).
   * This distributes points evenly across A, B, C, D.
   * For forced pairs, alternate between the two answers.
   * Equal-ish scores → low confidence → self-select.
   */
  it('even distribution of answers triggers self-select (confidence < 0.15)', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);

    // Answer scored questions with rotating dimension selection
    let normativeIndex = 0;
    let fpIndex = 0;
    for (const q of scoredQuestions) {
      if (q.format === 'forced_pair') {
        engine.answerQuestion(q.answers[fpIndex % 2].id);
        fpIndex++;
      } else {
        engine.answerQuestion(q.answers[normativeIndex % 4].id);
        normativeIndex++;
      }
    }

    engine.skipEmail();
    engine.proceedFromCalculating();

    const state = engine.getState();
    expect(state.classificationResult).not.toBeNull();
    // With evenly distributed answers, confidence should be low
    expect(state.classificationResult!.confidence).toBeLessThan(0.15);
    expect(state.phase).toBe('self-select');
  });

  it('all-A answers produce high confidence (no self-select)', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);

    // Pick A-dimension answer for every scored question
    for (const q of scoredQuestions) {
      // First answer is always the A-dimension answer for normative
      // For forced pairs: FP01 answer 0 is A-favoring, FP02 and FP03 are B/D
      // So we pick first answer which always has the first dimension of the pair
      engine.answerQuestion(q.answers[0].id);
    }

    engine.skipEmail();
    engine.proceedFromCalculating();

    const state = engine.getState();
    expect(state.classificationResult).not.toBeNull();
    expect(state.classificationResult!.confidence).toBeGreaterThanOrEqual(0.15);
    expect(state.phase).toBe('results');
  });
});

// ---------------------------------------------------------------------------
// answerQuestion()
// ---------------------------------------------------------------------------

describe('Quiz Engine — answerQuestion()', () => {
  it('records the answer in state', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const q = segmentationQuestions[0];
    engine.answerQuestion(q.answers[1].id);
    expect(engine.getState().answers[q.id]).toBe(q.answers[1].id);
  });

  it('advances to next question after answering', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const firstQ = engine.getCurrentQuestion()!;
    engine.answerQuestion(firstQ.answers[0].id);
    const secondQ = engine.getCurrentQuestion()!;
    expect(secondQ.id).not.toBe(firstQ.id);
  });

  it('answering overwrites previous answer for same question (via goBack)', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const q = segmentationQuestions[0];
    engine.answerQuestion(q.answers[0].id);
    engine.goBack();
    engine.answerQuestion(q.answers[1].id);
    expect(engine.getState().answers[q.id]).toBe(q.answers[1].id);
  });
});

// ---------------------------------------------------------------------------
// goBack()
// ---------------------------------------------------------------------------

describe('Quiz Engine — goBack()', () => {
  it('returns to the previous question', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const firstQ = engine.getCurrentQuestion()!;
    engine.answerQuestion(firstQ.answers[0].id);
    const secondQ = engine.getCurrentQuestion()!;
    engine.goBack();
    expect(engine.getCurrentQuestion()!.id).toBe(firstQ.id);
  });

  it('preserves the previous answer after going back', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const q = segmentationQuestions[0];
    const answerId = q.answers[1].id;
    engine.answerQuestion(answerId);
    engine.goBack();
    expect(engine.getState().answers[q.id]).toBe(answerId);
  });

  it('does nothing when at the first question', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const firstQ = engine.getCurrentQuestion()!;
    engine.goBack();
    expect(engine.getCurrentQuestion()!.id).toBe(firstQ.id);
  });

  it('does nothing in intro phase', () => {
    const engine = createQuizEngine(42);
    engine.goBack();
    expect(engine.getState().phase).toBe('intro');
  });

  it('works across segmentation-to-scored boundary', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    // Now at first scored question
    expect(engine.getState().phase).toBe('scored');
    engine.goBack();
    // Should be back at last segmentation question
    const currentQ = engine.getCurrentQuestion()!;
    expect(currentQ.id).toBe(segmentationQuestions[segmentationQuestions.length - 1].id);
    expect(engine.getState().phase).toBe('segmentation');
  });

  it('can go back from email-gate to last scored question', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    expect(engine.getState().phase).toBe('email-gate');
    engine.goBack();
    expect(engine.getState().phase).toBe('scored');
    expect(engine.getCurrentQuestion()!.id).toBe(
      scoredQuestions[scoredQuestions.length - 1].id
    );
  });
});

// ---------------------------------------------------------------------------
// getProgress()
// ---------------------------------------------------------------------------

describe('Quiz Engine — getProgress()', () => {
  it('total is always 10 (number of scored questions)', () => {
    const engine = createQuizEngine(42);
    expect(engine.getProgress().total).toBe(10);
    expect(scoredQuestions.length).toBe(10);
  });

  it('current is 0 before any scored questions are answered', () => {
    const engine = createQuizEngine(42);
    engine.start();
    // During segmentation
    expect(engine.getProgress().current).toBe(0);
    answerAllSegmentation(engine);
    // Just entered first scored question but haven't answered it yet
    expect(engine.getProgress().current).toBe(0);
  });

  it('segmentation questions do not increment progress', () => {
    const engine = createQuizEngine(42);
    engine.start();
    engine.answerQuestion(segmentationQuestions[0].answers[0].id);
    expect(engine.getProgress().current).toBe(0);
  });

  it('increments for each scored question answered', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);

    for (let i = 0; i < scoredQuestions.length; i++) {
      expect(engine.getProgress().current).toBe(i);
      engine.answerQuestion(scoredQuestions[i].answers[0].id);
    }
    expect(engine.getProgress().current).toBe(10);
  });

  it('decrements when going back from a scored question', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);
    engine.answerQuestion(scoredQuestions[0].answers[0].id);
    expect(engine.getProgress().current).toBe(1);
    engine.goBack();
    // Back at first scored question — answer exists but we're reviewing it
    // Progress should reflect we're AT question 0 (0 scored completed behind us)
    expect(engine.getProgress().current).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getShuffledAnswerIndices()
// ---------------------------------------------------------------------------

describe('Quiz Engine — getShuffledAnswerIndices()', () => {
  it('returns consistent order for same questionId within a session', () => {
    const engine = createQuizEngine(42);
    const qId = questions[0].id;
    const first = engine.getShuffledAnswerIndices(qId);
    const second = engine.getShuffledAnswerIndices(qId);
    expect(first).toEqual(second);
  });

  it('returns [0,1] or [1,0] for forced-pair questions (2 answers)', () => {
    const engine = createQuizEngine(42);
    const fpQuestions = questions.filter(q => q.format === 'forced_pair');
    expect(fpQuestions.length).toBe(3);

    for (const q of fpQuestions) {
      const indices = engine.getShuffledAnswerIndices(q.id);
      expect(indices).toHaveLength(2);
      expect(indices.sort()).toEqual([0, 1]);
    }
  });

  it('returns a permutation of [0,1,2,3] for normative questions (4 answers)', () => {
    const engine = createQuizEngine(42);
    const normativeQuestions = questions.filter(
      q => q.format === 'single_select' && q.phase === 'scored'
    );

    for (const q of normativeQuestions) {
      const indices = engine.getShuffledAnswerIndices(q.id);
      expect(indices).toHaveLength(4);
      expect([...indices].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('returns a valid permutation for segmentation questions', () => {
    const engine = createQuizEngine(42);
    for (const q of segmentationQuestions) {
      const indices = engine.getShuffledAnswerIndices(q.id);
      expect(indices).toHaveLength(q.answers.length);
      const sorted = [...indices].sort((a, b) => a - b);
      const expected = Array.from({ length: q.answers.length }, (_, i) => i);
      expect(sorted).toEqual(expected);
    }
  });

  it('produces different orders for different questionIds (with high probability)', () => {
    const engine = createQuizEngine(42);
    const normativeQuestions = questions.filter(
      q => q.format === 'single_select' && q.phase === 'scored'
    );

    // With 7 normative questions and seed 42, at least one should differ
    // from the identity permutation [0,1,2,3]
    const allIdentity = normativeQuestions.every(q => {
      const indices = engine.getShuffledAnswerIndices(q.id);
      return indices[0] === 0 && indices[1] === 1 && indices[2] === 2 && indices[3] === 3;
    });
    expect(allIdentity).toBe(false);
  });

  it('different seeds produce different shuffle orders', () => {
    const engine1 = createQuizEngine(42);
    const engine2 = createQuizEngine(999);
    const qId = scoredQuestions[0].id;

    const order1 = engine1.getShuffledAnswerIndices(qId);
    const order2 = engine2.getShuffledAnswerIndices(qId);

    // Not guaranteed to differ for every single question, but should
    // differ for at least some questions across the full set
    const anyDifferent = scoredQuestions.some(q => {
      const o1 = engine1.getShuffledAnswerIndices(q.id);
      const o2 = engine2.getShuffledAnswerIndices(q.id);
      return JSON.stringify(o1) !== JSON.stringify(o2);
    });
    expect(anyDifferent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// submitEmail() / skipEmail()
// ---------------------------------------------------------------------------

describe('Quiz Engine — Email gate', () => {
  it('submitEmail() records email in state', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    engine.submitEmail('hello@example.com');
    expect(engine.getState().email).toBe('hello@example.com');
  });

  it('skipEmail() transitions to calculating without email', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    engine.skipEmail();
    expect(engine.getState().phase).toBe('calculating');
    expect(engine.getState().email).toBeNull();
  });

  it('submitEmail() transitions to calculating', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    engine.submitEmail('a@b.com');
    expect(engine.getState().phase).toBe('calculating');
  });
});

// ---------------------------------------------------------------------------
// selectArchetype()
// ---------------------------------------------------------------------------

describe('Quiz Engine — selectArchetype()', () => {
  it('records selection in state during self-select phase', () => {
    const engine = createQuizEngine(42);
    engine.start();
    answerAllSegmentation(engine);

    // Use even distribution for low confidence
    let normativeIndex = 0;
    let fpIndex = 0;
    for (const q of scoredQuestions) {
      if (q.format === 'forced_pair') {
        engine.answerQuestion(q.answers[fpIndex % 2].id);
        fpIndex++;
      } else {
        engine.answerQuestion(q.answers[normativeIndex % 4].id);
        normativeIndex++;
      }
    }

    engine.skipEmail();
    engine.proceedFromCalculating();

    // S-12: Unconditional assertion — even distribution reaches self-select
    expect(engine.getState().phase).toBe('self-select');
    const slug: ArchetypeSlug = 'flow_artist';
    engine.selectArchetype(slug);
    expect(engine.getState().selectedArchetype).toBe(slug);
    expect(engine.getState().phase).toBe('results');
  });
});

// ---------------------------------------------------------------------------
// getCurrentQuestion()
// ---------------------------------------------------------------------------

describe('Quiz Engine — getCurrentQuestion()', () => {
  it('returns null in intro phase', () => {
    const engine = createQuizEngine(42);
    expect(engine.getCurrentQuestion()).toBeNull();
  });

  it('returns the current question during questioning phases', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const q = engine.getCurrentQuestion();
    expect(q).not.toBeNull();
    expect(q!.id).toBe(questions[0].id);
  });

  it('returns null in email-gate phase', () => {
    const engine = createQuizEngine(42);
    advanceToEmailGate(engine);
    expect(engine.getCurrentQuestion()).toBeNull();
  });

  it('returns null in calculating phase', () => {
    const engine = createQuizEngine(42);
    advanceToCalculating(engine);
    expect(engine.getCurrentQuestion()).toBeNull();
  });

  it('returns null in results phase', () => {
    const engine = createQuizEngine(42);
    advanceToCalculating(engine);
    engine.proceedFromCalculating();
    expect(engine.getCurrentQuestion()).toBeNull();
  });

  it('walks through questions in order', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const visitedIds: string[] = [];
    for (const q of questions) {
      const current = engine.getCurrentQuestion();
      expect(current).not.toBeNull();
      visitedIds.push(current!.id);
      engine.answerQuestion(q.answers[0].id);
    }
    expect(visitedIds).toEqual(questions.map(q => q.id));
  });
});

// ---------------------------------------------------------------------------
// State immutability
// ---------------------------------------------------------------------------

describe('Quiz Engine — State immutability', () => {
  it('getState() returns a snapshot, not a mutable reference', () => {
    const engine = createQuizEngine(42);
    const state1 = engine.getState();
    engine.start();
    const state2 = engine.getState();
    // state1 should not have been mutated by start()
    expect(state1.phase).toBe('intro');
    expect(state2.phase).toBe('segmentation');
  });

  it('mutating returned state does not affect engine', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const state = engine.getState();
    state.answers['FAKE'] = 'FAKE';
    expect(engine.getState().answers['FAKE']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// classificationResult in state
// ---------------------------------------------------------------------------

describe('Quiz Engine — classificationResult', () => {
  it('is null before calculating phase', () => {
    const engine = createQuizEngine(42);
    expect(engine.getState().classificationResult).toBeNull();

    engine.start();
    expect(engine.getState().classificationResult).toBeNull();

    answerAllSegmentation(engine);
    expect(engine.getState().classificationResult).toBeNull();
  });

  it('is populated after proceedFromCalculating()', () => {
    const engine = createQuizEngine(42);
    advanceToCalculating(engine);
    engine.proceedFromCalculating();
    const result = engine.getState().classificationResult;
    expect(result).not.toBeNull();
    expect(result!.primary).toBeTruthy();
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(result!.memberships).toBeDefined();
    // Memberships sum to 1.0
    const membershipSum = Object.values(result!.memberships).reduce((a, b) => a + b, 0);
    expect(membershipSum).toBeCloseTo(1.0, 2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases / invalid operations
// ---------------------------------------------------------------------------

describe('Quiz Engine — Edge cases', () => {
  it('start() is idempotent if already started', () => {
    const engine = createQuizEngine(42);
    engine.start();
    const q1 = engine.getCurrentQuestion()!.id;
    engine.start(); // second call should not reset
    expect(engine.getCurrentQuestion()!.id).toBe(q1);
  });

  it('default seed is generated when none provided', () => {
    const engine = createQuizEngine();
    expect(engine.getState().phase).toBe('intro');
    // Should work without errors
    engine.start();
    expect(engine.getState().phase).toBe('segmentation');
  });
});
