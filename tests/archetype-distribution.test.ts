/**
 * Archetype Distribution — Monte Carlo Validation
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during implementation.
 *
 * Tests that the v2 classifier produces a balanced distribution across
 * all 6 archetypes when given random answer sets through the full
 * computeScores() → classify() pipeline.
 *
 * Random generation: for each question, uniformly select one answer
 * (index 0..N-1) using a seeded PRNG for deterministic reproducibility.
 *
 * Thresholds (from plan):
 *   - All 6 archetypes appear at > 5% (500 of 10,000)
 *   - No archetype exceeds 40% (4,000 of 10,000)
 *   - Ascending Seeker appears at > 8% (800 of 10,000) — junk-drawer guard
 *   - Self-select triggers (confidence < 0.15) for < 15% of sets
 */

import { describe, it, expect } from 'vitest';
import { classify, computeScores } from '../src/lib/classifier';
import type { ArchetypeSlug } from '../src/lib/classifier';
import { questions } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 for deterministic reproducibility
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Monte Carlo simulation
// ---------------------------------------------------------------------------

const SAMPLE_SIZE = 10_000;
const SEED = 42;

/** Generate a random answer set: for each question, pick one answer uniformly. */
function generateRandomAnswers(rng: () => number): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const idx = Math.floor(rng() * question.answers.length);
    answers[question.id] = question.answers[idx].id;
  }
  return answers;
}

describe('Monte Carlo archetype distribution (10K samples)', () => {
  // Run the full simulation once, share results across assertions
  const counts: Record<ArchetypeSlug, number> = {
    air_weaver: 0,
    embodied_intuitive: 0,
    ascending_seeker: 0,
    shadow_dancer: 0,
    flow_artist: 0,
    grounded_mystic: 0,
  };
  let selfSelectCount = 0;

  const rng = mulberry32(SEED);
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const answers = generateRandomAnswers(rng);
    const scores = computeScores(answers, questions);
    const result = classify(scores);
    counts[result.primary]++;
    if (result.confidence < 0.15) {
      selfSelectCount++;
    }
  }

  // -------------------------------------------------------------------------
  // Distribution balance tests
  // -------------------------------------------------------------------------

  it('air_weaver appears at > 5%', () => {
    expect(counts.air_weaver).toBeGreaterThan(500);
  });

  it('embodied_intuitive appears at > 5%', () => {
    expect(counts.embodied_intuitive).toBeGreaterThan(500);
  });

  it('ascending_seeker appears at > 5%', () => {
    expect(counts.ascending_seeker).toBeGreaterThan(500);
  });

  it('shadow_dancer appears at > 5%', () => {
    expect(counts.shadow_dancer).toBeGreaterThan(500);
  });

  it('flow_artist appears at > 5%', () => {
    expect(counts.flow_artist).toBeGreaterThan(500);
  });

  it('grounded_mystic appears at > 5%', () => {
    expect(counts.grounded_mystic).toBeGreaterThan(500);
  });

  // -------------------------------------------------------------------------
  // No archetype dominates
  // -------------------------------------------------------------------------

  it('no archetype exceeds 40%', () => {
    for (const [slug, count] of Object.entries(counts)) {
      expect(
        count,
        `${slug} at ${count}/${SAMPLE_SIZE} (${((count / SAMPLE_SIZE) * 100).toFixed(1)}%) exceeds 40%`,
      ).toBeLessThan(4000);
    }
  });

  // -------------------------------------------------------------------------
  // Ascending Seeker junk-drawer regression guard
  // -------------------------------------------------------------------------

  it('ascending_seeker appears at > 8% (not a junk drawer)', () => {
    expect(counts.ascending_seeker).toBeGreaterThan(800);
  });

  // -------------------------------------------------------------------------
  // Self-select trigger rate
  // -------------------------------------------------------------------------

  it('self-select triggers (confidence < 0.15) for < 15% of sets', () => {
    expect(selfSelectCount).toBeLessThan(1500);
  });

  // -------------------------------------------------------------------------
  // Diagnostic: log distribution (always passes, for debugging)
  // -------------------------------------------------------------------------

  it('distribution diagnostic (always passes)', () => {
    const lines = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(
        ([slug, count]) =>
          `  ${slug}: ${count} (${((count / SAMPLE_SIZE) * 100).toFixed(1)}%)`,
      );
    console.log(
      `\nMonte Carlo Distribution (n=${SAMPLE_SIZE}, seed=${SEED}):\n${lines.join('\n')}` +
        `\n  self-select: ${selfSelectCount} (${((selfSelectCount / SAMPLE_SIZE) * 100).toFixed(1)}%)`,
    );
    expect(true).toBe(true);
  });
});
