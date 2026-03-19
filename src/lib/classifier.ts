/**
 * Archetype Classifier
 *
 * Implements a priority-cascade classifier that maps DimensionScores to
 * one of six ArchetypeSlugs, and a score computation function that sums
 * weighted scoring from a quiz answers map against the question data.
 */

import type { Question } from './quiz-data';

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ArchetypeSlug =
  | 'air_weaver'
  | 'embodied_intuitive'
  | 'ascending_seeker'
  | 'shadow_dancer'
  | 'flow_artist'
  | 'grounded_mystic';

export interface DimensionScores {
  A: number;
  B: number;
  C: number;
  D: number;
}

// ---------------------------------------------------------------------------
// classify()
//
// Priority-cascade classifier. First matching condition wins:
//
//   1. grounded_mystic:      A > B AND A > C AND D > B AND D > C
//   2. flow_artist:          B > A AND B > D AND C > A AND C > D
//   3. air_weaver:           A >= B AND A >= C AND A >= D
//   4. embodied_intuitive:   B >= A AND B >= C AND B >= D
//   5. shadow_dancer:        D >= A AND D >= B AND D >= C
//   6. ascending_seeker:     fallback
// ---------------------------------------------------------------------------

export function classify(scores: DimensionScores): ArchetypeSlug {
  const { A, B, C, D } = scores;

  // Priority 1: Grounded Mystic — both A and D strictly dominate both B and C
  if (A > B && A > C && D > B && D > C) {
    return 'grounded_mystic';
  }

  // Priority 2: Flow Artist — both B and C strictly dominate both A and D
  if (B > A && B > D && C > A && C > D) {
    return 'flow_artist';
  }

  // Priority 3: Air Weaver — A is at least as high as every other dimension
  if (A >= B && A >= C && A >= D) {
    return 'air_weaver';
  }

  // Priority 4: Embodied Intuitive — B is at least as high as every other dimension
  if (B >= A && B >= C && B >= D) {
    return 'embodied_intuitive';
  }

  // Priority 5: Shadow Dancer — D is at least as high as every other dimension
  if (D >= A && D >= B && D >= C) {
    return 'shadow_dancer';
  }

  // Priority 6: Ascending Seeker — fallback for all remaining patterns (C-dominant)
  return 'ascending_seeker';
}

// ---------------------------------------------------------------------------
// computeScores()
//
// Takes a map of questionId -> answerId and the questions array.
// Looks up each answer's scoring weights and sums them per dimension.
// Non-scored questions and unknown IDs are silently ignored.
// ---------------------------------------------------------------------------

export function computeScores(
  answers: Record<string, string>,
  questions: Question[]
): DimensionScores {
  const totals: DimensionScores = { A: 0, B: 0, C: 0, D: 0 };

  // Build a flat lookup map: answerId -> ScoringWeight[]
  // Only from questions that are scored.
  const answerScoringMap = new Map<string, { dimension: 'A' | 'B' | 'C' | 'D'; points: number }[]>();

  for (const question of questions) {
    if (question.phase !== 'scored') continue;
    for (const answer of question.answers) {
      answerScoringMap.set(answer.id, answer.scoring);
    }
  }

  // Iterate over provided answers; ignore unknown question IDs gracefully
  for (const [questionId, answerId] of Object.entries(answers)) {
    const scoring = answerScoringMap.get(answerId);
    if (!scoring) continue; // unknown answerId or non-scored question

    for (const weight of scoring) {
      totals[weight.dimension] += weight.points;
    }
  }

  return totals;
}
