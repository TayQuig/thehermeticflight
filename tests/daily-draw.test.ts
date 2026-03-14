/**
 * Daily Draw — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during or after implementation.
 *
 * Modules under test:
 *   src/lib/card-data.ts  — CardData interface, CARDS array, TOTAL_CARDS
 *   src/lib/daily-draw.ts — dateToSeed, getDailyCardIndex, getDailyCard
 */

import { describe, it, expect } from 'vitest';
import { CARDS, TOTAL_CARDS } from '../src/lib/card-data';
import type { CardData } from '../src/lib/card-data';
import { dateToSeed, getDailyCardIndex, getDailyCard } from '../src/lib/daily-draw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function utcEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59Z`);
}

// ---------------------------------------------------------------------------
// card-data module
// ---------------------------------------------------------------------------

describe('card-data module', () => {
  it('TOTAL_CARDS is exactly 78', () => {
    expect(TOTAL_CARDS, 'TOTAL_CARDS must equal 78').toBe(78);
  });

  it('TOTAL_CARDS equals CARDS.length', () => {
    expect(TOTAL_CARDS, 'TOTAL_CARDS must match the actual length of CARDS').toBe(CARDS.length);
  });

  it('every card has all required fields', () => {
    const requiredFields: (keyof CardData)[] = [
      'slug',
      'name',
      'meaning',
      'aerialConnection',
      'journalingPrompt',
      'artReady',
    ];
    for (const card of CARDS) {
      for (const field of requiredFields) {
        expect(
          card[field],
          `Card "${card.name ?? '(unnamed)'}" is missing required field "${field}"`,
        ).toBeDefined();
      }
    }
  });

  it('every slug is non-empty and matches ^[a-z0-9-]+$', () => {
    const slugPattern = /^[a-z0-9-]+$/;
    for (const card of CARDS) {
      expect(
        card.slug.length,
        `Card "${card.name}" has an empty slug`,
      ).toBeGreaterThan(0);
      expect(
        slugPattern.test(card.slug),
        `Card "${card.name}" slug "${card.slug}" must match ^[a-z0-9-]+$`,
      ).toBe(true);
    }
  });

  it('all 78 slugs are unique', () => {
    const slugs = CARDS.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(
      unique.size,
      `Expected 78 unique slugs but found ${unique.size} — there are duplicate slugs`,
    ).toBe(78);
  });

  it('artReady is boolean on every card', () => {
    for (const card of CARDS) {
      expect(
        typeof card.artReady,
        `Card "${card.name}" artReady must be boolean, got ${typeof card.artReady}`,
      ).toBe('boolean');
    }
  });

  it('all 22 Major Arcana are present by name', () => {
    const majorArcana = [
      'The Fool',
      'The Magician',
      'The High Priestess',
      'The Empress',
      'The Emperor',
      'The Hierophant',
      'The Lovers',
      'The Chariot',
      'Strength',
      'The Hermit',
      'Wheel of Fortune',
      'Justice',
      'The Hanged Man',
      'Death',
      'Temperance',
      'The Devil',
      'The Tower',
      'The Star',
      'The Moon',
      'The Sun',
      'Judgement',
      'The World',
    ];
    const cardNames = new Set(CARDS.map((c) => c.name));
    for (const arcana of majorArcana) {
      expect(
        cardNames.has(arcana),
        `Major Arcana card "${arcana}" is missing from CARDS`,
      ).toBe(true);
    }
  });

  it('all 4 suits are represented in the Minor Arcana', () => {
    const suits = ['Torches', 'Cups', 'Swords', 'Pentacles'];
    for (const suit of suits) {
      const hasSuit = CARDS.some((c) => c.name.includes(suit));
      expect(
        hasSuit,
        `No card found with suit "${suit}" in its name — all 4 suits must be represented`,
      ).toBe(true);
    }
  });

  it('no court card has a bare name — every Page/Knight/Queen/King includes " of "', () => {
    const courtTitles = ['Page', 'Knight', 'Queen', 'King'];
    for (const card of CARDS) {
      const startsWithCourt = courtTitles.some((title) =>
        card.name.startsWith(title),
      );
      if (startsWithCourt) {
        expect(
          card.name.includes(' of '),
          `Court card "${card.name}" must include " of " (e.g., "Page of Torches") — bare names are not allowed`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// dateToSeed
// ---------------------------------------------------------------------------

describe('dateToSeed', () => {
  it('same date produces same seed', () => {
    const d1 = utcDate('2026-03-13');
    const d2 = utcDate('2026-03-13');
    expect(
      dateToSeed(d1),
      'dateToSeed must be deterministic — same date must yield same seed',
    ).toBe(dateToSeed(d2));
  });

  it('different dates produce different seeds', () => {
    const d1 = utcDate('2026-03-13');
    const d2 = utcDate('2026-03-14');
    expect(
      dateToSeed(d1),
      'Different dates must produce different seeds',
    ).not.toBe(dateToSeed(d2));
  });

  it('returns a number', () => {
    const seed = dateToSeed(utcDate('2026-03-13'));
    expect(
      typeof seed,
      'dateToSeed must return a number',
    ).toBe('number');
  });

  it('10 consecutive dates produce 10 distinct seeds', () => {
    const seeds = Array.from({ length: 10 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 2, 13 + i)); // 2026-03-13 + i days
      return dateToSeed(date);
    });
    const unique = new Set(seeds);
    expect(
      unique.size,
      `Expected 10 distinct seeds for 10 consecutive dates, got ${unique.size}`,
    ).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getDailyCardIndex
// ---------------------------------------------------------------------------

describe('getDailyCardIndex', () => {
  it('same date returns same index (deterministic)', () => {
    const d1 = utcDate('2026-06-07');
    const d2 = utcDate('2026-06-07');
    expect(
      getDailyCardIndex(d1),
      'getDailyCardIndex must be deterministic — same date must yield same index',
    ).toBe(getDailyCardIndex(d2));
  });

  it('always returns an index in [0, TOTAL_CARDS - 1]', () => {
    // Spot-check 50 different dates across multiple years
    const dates = Array.from({ length: 50 }, (_, i) => {
      return new Date(Date.UTC(2026, 0, 1 + i));
    });
    for (const date of dates) {
      const index = getDailyCardIndex(date);
      expect(
        index,
        `Index for ${date.toISOString()} must be >= 0`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        index,
        `Index for ${date.toISOString()} must be <= ${TOTAL_CARDS - 1} (TOTAL_CARDS - 1)`,
      ).toBeLessThanOrEqual(TOTAL_CARDS - 1);
    }
  });

  it('always returns an integer', () => {
    const dates = Array.from({ length: 20 }, (_, i) => {
      return new Date(Date.UTC(2026, 3, 1 + i));
    });
    for (const date of dates) {
      const index = getDailyCardIndex(date);
      expect(
        Number.isInteger(index),
        `Index for ${date.toISOString()} must be an integer, got ${index}`,
      ).toBe(true);
    }
  });

  it('30 different dates produce at least 10 unique indices', () => {
    const indices = Array.from({ length: 30 }, (_, i) => {
      return getDailyCardIndex(new Date(Date.UTC(2026, 4, 1 + i)));
    });
    const unique = new Set(indices);
    expect(
      unique.size,
      `Expected at least 10 unique indices over 30 dates (with 78 cards, expected ~25 unique), got ${unique.size}`,
    ).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// date boundary behavior
// ---------------------------------------------------------------------------

describe('date boundary behavior', () => {
  it('23:59:59 UTC on day N returns the same index as midnight UTC on day N', () => {
    const midnight = utcDate('2026-08-08');
    const endOfDay = utcEndOfDay('2026-08-08');
    expect(
      getDailyCardIndex(midnight),
      '23:59:59 UTC and 00:00:00 UTC on the same calendar day must produce the same index',
    ).toBe(getDailyCardIndex(endOfDay));
  });

  it('23:59:59 UTC on day N returns a different index from midnight UTC on day N+1', () => {
    const endOfDayN = utcEndOfDay('2026-08-08');
    const midnightNextDay = utcDate('2026-08-09');
    expect(
      getDailyCardIndex(endOfDayN),
      '23:59:59 UTC on day N must differ from 00:00:00 UTC on day N+1',
    ).not.toBe(getDailyCardIndex(midnightNextDay));
  });

  it('same UTC calendar day at any hour returns the same index', () => {
    const hours = [0, 3, 6, 9, 12, 15, 18, 21, 23];
    const indices = hours.map((h) =>
      getDailyCardIndex(new Date(Date.UTC(2026, 5, 7, h, 30, 0))),
    );
    const referenceIndex = indices[0];
    for (let i = 1; i < indices.length; i++) {
      expect(
        indices[i],
        `getDailyCardIndex at hour ${hours[i]} UTC must equal the index at hour 0 UTC on the same day`,
      ).toBe(referenceIndex);
    }
  });
});

// ---------------------------------------------------------------------------
// getDailyCard
// ---------------------------------------------------------------------------

describe('getDailyCard', () => {
  it('returns an object with all required CardData fields', () => {
    const card = getDailyCard(utcDate('2026-03-13'));
    const requiredFields: (keyof CardData)[] = [
      'slug',
      'name',
      'meaning',
      'aerialConnection',
      'journalingPrompt',
      'artReady',
    ];
    for (const field of requiredFields) {
      expect(
        card[field],
        `getDailyCard result is missing required field "${field}"`,
      ).toBeDefined();
    }
  });

  it('name is a non-empty string', () => {
    const card = getDailyCard(utcDate('2026-04-01'));
    expect(
      typeof card.name,
      'getDailyCard result must have a string name',
    ).toBe('string');
    expect(
      card.name.length,
      'getDailyCard result name must be non-empty',
    ).toBeGreaterThan(0);
  });

  it('meaning is a non-empty string', () => {
    const card = getDailyCard(utcDate('2026-04-01'));
    expect(
      typeof card.meaning,
      'getDailyCard result must have a string meaning',
    ).toBe('string');
    expect(
      card.meaning.length,
      'getDailyCard result meaning must be non-empty',
    ).toBeGreaterThan(0);
  });

  it('same date returns the same card', () => {
    const d1 = utcDate('2026-08-08');
    const d2 = utcDate('2026-08-08');
    const card1 = getDailyCard(d1);
    const card2 = getDailyCard(d2);
    expect(
      card1.slug,
      'getDailyCard must return the same card for the same date — slug differs',
    ).toBe(card2.slug);
    expect(
      card1.name,
      'getDailyCard must return the same card for the same date — name differs',
    ).toBe(card2.name);
  });
});
