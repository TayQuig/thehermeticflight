/**
 * Quiz Engine — State Machine
 *
 * Manages the full quiz flow:
 *   intro → segmentation → scored → email-gate → calculating
 *     → [self-select if confidence < 0.15] → results
 *
 * Phase 3 of the Quiz Design Overhaul.
 */

import { questions } from './quiz-data';
import type { Question } from './quiz-data';
import { classify, computeScores } from './classifier';
import type { ArchetypeSlug, ClassificationResult } from './classifier';

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type QuizPhase =
  | 'intro'
  | 'segmentation'
  | 'scored'
  | 'email-gate'
  | 'calculating'
  | 'self-select'
  | 'results';

export interface QuizState {
  phase: QuizPhase;
  /** Index into the questions array (0-based). Relevant during questioning phases. */
  questionIndex: number;
  /** Map of questionId → answerId for all answered questions. */
  answers: Record<string, string>;
  /** Email captured at the email-gate, or null if skipped. */
  email: string | null;
  /** Archetype selected during self-select phase, or null otherwise. */
  selectedArchetype: ArchetypeSlug | null;
  /** Classification result, populated after proceedFromCalculating(). */
  classificationResult: ClassificationResult | null;
}

export interface QuizEngine {
  getState(): QuizState;
  start(): void;
  answerQuestion(answerId: string): void;
  goBack(): void;
  getProgress(): { current: number; total: number };
  getShuffledAnswerIndices(questionId: string): number[];
  submitEmail(email: string): void;
  skipEmail(): void;
  proceedFromCalculating(): void;
  selectArchetype(slug: ArchetypeSlug): void;
  getCurrentQuestion(): Question | null;
}

// ---------------------------------------------------------------------------
// PRNG — mulberry32 (seeded, deterministic)
// ---------------------------------------------------------------------------

/**
 * Creates a mulberry32 PRNG seeded with the given value.
 * Returns a function that produces a new float in [0, 1) each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle using a provided PRNG
// ---------------------------------------------------------------------------

function shuffleIndices(length: number, rand: () => number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Derived question metadata (computed once at module load)
// ---------------------------------------------------------------------------

const scoredQuestions = questions.filter(q => q.phase === 'scored');
const TOTAL_SCORED = scoredQuestions.length; // 10

/** Index of the first scored question in the questions array. */
const FIRST_SCORED_INDEX = questions.findIndex(q => q.phase === 'scored');

// ---------------------------------------------------------------------------
// createQuizEngine factory
// ---------------------------------------------------------------------------

export function createQuizEngine(seed?: number): QuizEngine {
  // Use provided seed or generate one from Date.now()
  const effectiveSeed = seed !== undefined ? seed : Date.now();

  // Internal mutable state
  let phase: QuizPhase = 'intro';
  let questionIndex = 0;
  let answers: Record<string, string> = {};
  let email: string | null = null;
  let selectedArchetype: ArchetypeSlug | null = null;
  let classificationResult: ClassificationResult | null = null;

  // Shuffled answer indices cache: questionId → number[]
  // Each question gets its own PRNG seeded from effectiveSeed + a hash of the questionId.
  const shuffleCache = new Map<string, number[]>();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Returns a copy of current state (snapshot for immutability). */
  function snapshotState(): QuizState {
    return {
      phase,
      questionIndex,
      answers: { ...answers },
      email,
      selectedArchetype,
      classificationResult,
    };
  }

  /** Derive the QuizPhase for the question at a given index. */
  function phaseForIndex(idx: number): QuizPhase {
    if (idx < 0 || idx >= questions.length) return 'intro';
    return questions[idx].phase as QuizPhase;
  }

  /**
   * Compute progress current: number of scored questions whose index is
   * strictly behind the current questionIndex (i.e., already answered and passed).
   */
  function computeProgressCurrent(): number {
    // Count how many scored questions have a lower index than the current one
    let count = 0;
    for (let i = 0; i < questionIndex; i++) {
      if (questions[i].phase === 'scored') count++;
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function getState(): QuizState {
    return snapshotState();
  }

  function start(): void {
    // Idempotent: do nothing if already past intro
    if (phase !== 'intro') return;
    questionIndex = 0;
    phase = phaseForIndex(0);
  }

  function answerQuestion(answerId: string): void {
    if (phase !== 'segmentation' && phase !== 'scored') return;
    const question = questions[questionIndex];
    if (!question) return;

    // Record the answer
    answers[question.id] = answerId;

    // Advance to next question
    const nextIndex = questionIndex + 1;
    if (nextIndex < questions.length) {
      questionIndex = nextIndex;
      phase = phaseForIndex(nextIndex);
    } else {
      // All questions answered — move to email-gate
      phase = 'email-gate';
    }
  }

  function goBack(): void {
    // No-op in intro phase
    if (phase === 'intro') return;

    if (phase === 'email-gate') {
      // Go back to last scored question
      const lastScoredIndex = questions.length - 1;
      // Find last scored question (walk backwards)
      for (let i = questions.length - 1; i >= 0; i--) {
        if (questions[i].phase === 'scored') {
          questionIndex = i;
          phase = 'scored';
          return;
        }
      }
      return;
    }

    // In a questioning phase: go back one question
    if (phase === 'segmentation' || phase === 'scored') {
      if (questionIndex === 0) return; // Already at first question
      questionIndex--;
      phase = phaseForIndex(questionIndex);
    }
  }

  function getProgress(): { current: number; total: number } {
    const current = (phase === 'segmentation' || phase === 'scored')
      ? computeProgressCurrent()
      : phase === 'email-gate'
        ? TOTAL_SCORED  // All scored questions completed
        : 0;

    return { current, total: TOTAL_SCORED };
  }

  function getShuffledAnswerIndices(questionId: string): number[] {
    if (shuffleCache.has(questionId)) {
      return shuffleCache.get(questionId)!;
    }

    // Derive a deterministic seed from effectiveSeed + a simple hash of questionId
    let idHash = 0;
    for (let i = 0; i < questionId.length; i++) {
      // Simple polynomial rolling hash
      idHash = (Math.imul(idHash, 31) + questionId.charCodeAt(i)) >>> 0;
    }
    const questionSeed = (effectiveSeed + idHash) >>> 0;
    const rand = mulberry32(questionSeed);

    // Find answer count for this question
    const question = questions.find(q => q.id === questionId);
    const count = question ? question.answers.length : 0;
    const indices = shuffleIndices(count, rand);

    shuffleCache.set(questionId, indices);
    return indices;
  }

  function submitEmail(e: string): void {
    if (phase !== 'email-gate') return;
    email = e;
    phase = 'calculating';
  }

  function skipEmail(): void {
    if (phase !== 'email-gate') return;
    email = null;
    phase = 'calculating';
  }

  function proceedFromCalculating(): void {
    if (phase !== 'calculating') return;

    // Compute scores and classify
    const scores = computeScores(answers, questions);
    const result = classify(scores);

    // Engine-level confidence attenuation: the classifier operates in z-score
    // space where even small differences between dimension scores get amplified
    // into seemingly confident classifications. The engine adds domain knowledge
    // that raw scores must be meaningfully spread apart for a classification to
    // be trustworthy. We measure this via the coefficient of variation (CV) of
    // the raw dimension scores: CV → 0 means all scores are similar (no real
    // preference), CV → 1+ means clear dimensional dominance.
    //
    // Attenuate confidence by CV² (quadratic provides a smooth gate that rapidly
    // suppresses confidence when scores cluster together).
    const vals = [scores.A, scores.B, scores.C, scores.D];
    const mean = vals.reduce((a, b) => a + b, 0) / 4;
    const cv = mean > 0
      ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / 4) / mean
      : 0;
    const spreadFactor = Math.min(1, cv * cv);
    const engineConfidence = result.confidence * spreadFactor;

    classificationResult = {
      primary: result.primary,
      confidence: engineConfidence,
      memberships: result.memberships,
    };

    if (engineConfidence < 0.15) {
      phase = 'self-select';
    } else {
      phase = 'results';
    }
  }

  function selectArchetype(slug: ArchetypeSlug): void {
    if (phase !== 'self-select') return;
    selectedArchetype = slug;
    phase = 'results';
  }

  function getCurrentQuestion(): Question | null {
    if (phase !== 'segmentation' && phase !== 'scored') return null;
    return questions[questionIndex] ?? null;
  }

  return {
    getState,
    start,
    answerQuestion,
    goBack,
    getProgress,
    getShuffledAnswerIndices,
    submitEmail,
    skipEmail,
    proceedFromCalculating,
    selectArchetype,
    getCurrentQuestion,
  };
}
