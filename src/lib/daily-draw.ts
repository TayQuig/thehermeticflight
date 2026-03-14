/**
 * Daily Draw Utility — Hermetic Flight
 *
 * Deterministic card selection: same date → same card for all users.
 * Algorithm: UTC date string → polynomial hash → Mulberry32 PRNG → card index
 */

import { CARDS, TOTAL_CARDS } from './card-data';
import type { CardData } from './card-data';

// Mulberry32 — fast, seedable 32-bit PRNG
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Horner's method polynomial hash of 'YYYY-MM-DD'
export function dateToSeed(date: Date): number {
  const dateStr = date.toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = (Math.imul(seed, 31) + dateStr.charCodeAt(i)) | 0;
  }
  return seed;
}

export function getDailyCardIndex(date: Date): number {
  const seed = dateToSeed(date);
  const rng = mulberry32(seed);
  return Math.floor(rng() * TOTAL_CARDS);
}

export function getDailyCard(date: Date = new Date()): CardData {
  return CARDS[getDailyCardIndex(date)];
}
