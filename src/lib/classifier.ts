/**
 * Archetype Classifier v2
 *
 * Implements a cosine-similarity classifier that maps DimensionScores to
 * one of six ArchetypeSlugs, and a score computation function that sums
 * weighted scoring from a quiz answers map against the question data.
 *
 * v2 changes:
 *   - classify() returns ClassificationResult (not bare ArchetypeSlug)
 *   - Cosine-similarity to 6 archetype centroids in 4D space [A, B, C, D]
 *   - Input scores are z-normalized before centroid comparison, correcting for
 *     structural dimension bias introduced by forced-pair question design
 *   - ClassificationResult: { primary, confidence, memberships }
 *   - classifyLegacy() shim returns same primary as classify().primary
 *   - computeScores() unchanged (already migrated in Phase 1)
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

export interface ClassificationResult {
  primary: ArchetypeSlug;
  confidence: number;      // 0 to 1
  memberships: Record<ArchetypeSlug, number>;  // sums to 1.0
}

// ---------------------------------------------------------------------------
// CENTROIDS
//
// 6 archetype centroids defined in the z-score feature space.
// The input score vector is z-normalized per profile before computing
// cosine similarities. This removes structural bias from forced-pair
// questions that systematically inflate B and D dimensions.
//
// Centroid design:
//   - Single-dimension archetypes: pure positive axis (+1 on target, 0 elsewhere)
//   - Composite archetypes: bipolar pattern (+1 on both target dims, -1 on other two)
//     This requires the composite dims to be ABOVE the profile mean to win.
//
// [A, B, C, D]
// ---------------------------------------------------------------------------

const CENTROIDS: Record<ArchetypeSlug, [number, number, number, number]> = {
  // A-dominant: intellectual/analytical — wins when A is most above-average
  air_weaver:         [1,  0,  0,  0],
  // B-dominant: somatic/intuitive — wins when B is most above-average
  embodied_intuitive: [0,  1,  0,  0],
  // C-dominant: flow/surrender — wins when C is most above-average
  ascending_seeker:   [0,  0,  1,  0],
  // D-dominant: shadow/transformation — wins when D is most above-average
  shadow_dancer:      [0,  0,  0,  1],
  // A+D composite: wins when both A and D are above average AND B and C are below
  grounded_mystic:    [1, -1, -1,  1],
  // B+C composite: wins when both B and C are above average AND A and D are below
  flow_artist:        [-1,  1,  1, -1],
};

// Softmax temperature. Higher = sharper discrimination.
// T=6 balances confidence distribution: dominant profiles get high confidence,
// mixed profiles stay ambiguous. Self-select rate < 15% at T=6.
const SOFTMAX_TEMPERATURE = 6;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize a 4D vector to unit length. Returns zero vector for zero input. */
function normalize(v: [number, number, number, number]): [number, number, number, number] {
  const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]);
  if (mag === 0) return [0, 0, 0, 0];
  return [v[0] / mag, v[1] / mag, v[2] / mag, v[3] / mag];
}

/**
 * Z-score normalize a 4D vector: subtract mean, divide by std.
 * Returns zero vector when std = 0 (all values equal or all zero).
 */
function zscoreNormalize(
  v: [number, number, number, number],
): [number, number, number, number] {
  const mean = (v[0] + v[1] + v[2] + v[3]) / 4;
  const variance =
    ((v[0] - mean) ** 2 +
      (v[1] - mean) ** 2 +
      (v[2] - mean) ** 2 +
      (v[3] - mean) ** 2) /
    4;
  const std = Math.sqrt(variance);
  if (std === 0) return [0, 0, 0, 0];
  return [
    (v[0] - mean) / std,
    (v[1] - mean) / std,
    (v[2] - mean) / std,
    (v[3] - mean) / std,
  ];
}

/** Dot product of two 4D vectors. */
function dot(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

// Ordered list of all archetype slugs (stable iteration order).
const ALL_SLUGS: ArchetypeSlug[] = [
  'air_weaver',
  'embodied_intuitive',
  'ascending_seeker',
  'shadow_dancer',
  'flow_artist',
  'grounded_mystic',
];

// Pre-normalize all centroids once at module load time.
const NORMALIZED_CENTROIDS: Record<
  ArchetypeSlug,
  [number, number, number, number]
> = Object.fromEntries(
  ALL_SLUGS.map((slug) => [slug, normalize(CENTROIDS[slug])]),
) as Record<ArchetypeSlug, [number, number, number, number]>;

// ---------------------------------------------------------------------------
// classify()
//
// 1. Z-normalize the raw score vector per-profile (removes structural bias).
// 2. L2-normalize the z-scored vector.
// 3. Compute cosine similarity to each pre-normalized centroid.
// 4. Convert similarities to memberships via softmax.
// 5. Primary = archetype with highest membership.
// 6. Confidence = 1 - (second / first) membership, clamped [0, 1].
// 7. Special case: zero/equal vector → uniform memberships, confidence = 0.
// ---------------------------------------------------------------------------

export function classify(scores: DimensionScores): ClassificationResult {
  const { A, B, C, D } = scores;

  // Z-score the input: this centers and scales the score vector.
  // Equal scores and all-zero scores both produce a zero z-vector.
  const zVec = zscoreNormalize([A, B, C, D]);
  const isZero = zVec[0] === 0 && zVec[1] === 0 && zVec[2] === 0 && zVec[3] === 0;

  if (isZero) {
    // Uniform memberships — no dimension distinguishes this profile.
    const uniform = 1 / 6;
    const memberships = Object.fromEntries(
      ALL_SLUGS.map((slug) => [slug, uniform]),
    ) as Record<ArchetypeSlug, number>;
    return {
      primary: 'air_weaver',
      confidence: 0,
      memberships,
    };
  }

  const inputUnit = normalize(zVec);

  // Compute cosine similarities (dot products of unit vectors).
  const similarities: Record<ArchetypeSlug, number> = Object.fromEntries(
    ALL_SLUGS.map((slug) => [
      slug,
      dot(inputUnit, NORMALIZED_CENTROIDS[slug]),
    ]),
  ) as Record<ArchetypeSlug, number>;

  // Convert to memberships via softmax over scaled similarities.
  const expValues: Record<ArchetypeSlug, number> = {} as Record<ArchetypeSlug, number>;
  let expSum = 0;
  for (const slug of ALL_SLUGS) {
    const e = Math.exp(similarities[slug] * SOFTMAX_TEMPERATURE);
    expValues[slug] = e;
    expSum += e;
  }

  const memberships: Record<ArchetypeSlug, number> = {} as Record<ArchetypeSlug, number>;
  for (const slug of ALL_SLUGS) {
    memberships[slug] = expValues[slug] / expSum;
  }

  // Find primary (highest membership) and second-highest for confidence.
  const sortedSlugs = [...ALL_SLUGS].sort(
    (a, b) => memberships[b] - memberships[a],
  );
  const primary = sortedSlugs[0];
  const highestMembership = memberships[sortedSlugs[0]];
  const secondHighestMembership = memberships[sortedSlugs[1]];

  // Confidence: how much the primary leads over the runner-up.
  const confidence =
    highestMembership <= 0
      ? 0
      : Math.max(
          0,
          Math.min(1, 1 - secondHighestMembership / highestMembership),
        );

  return { primary, confidence, memberships };
}

// ---------------------------------------------------------------------------
// classifyLegacy()
//
// Shim that returns just the primary ArchetypeSlug from classify().
// Drop-in replacement for the v1 classify() signature.
// ---------------------------------------------------------------------------

export function classifyLegacy(scores: DimensionScores): ArchetypeSlug {
  return classify(scores).primary;
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
  const answerScoringMap = new Map<
    string,
    { dimension: 'A' | 'B' | 'C' | 'D'; points: number }[]
  >();

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
