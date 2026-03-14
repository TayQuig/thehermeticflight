/**
 * Countdown Timer Utility — Unit Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/lib/countdown.ts
 */

import { describe, it, expect } from 'vitest';
import { getCountdown } from '../src/lib/countdown';

// ---------------------------------------------------------------------------
// LNC-01: Basic arithmetic
// ---------------------------------------------------------------------------

describe('LNC-01: getCountdown basic arithmetic', () => {
  it('returns correct days, hours, minutes, seconds for a future date exactly 1 day away', () => {
    const now = new Date('2026-08-07T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it('returns correct values for a date 2 days, 3 hours, 4 minutes, 5 seconds away', () => {
    const now2 = new Date('2026-08-05T00:00:00.000Z');
    const target2 = new Date('2026-08-07T03:04:05.000Z');
    const result = getCountdown(target2, now2);
    expect(result.days).toBe(2);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(4);
    expect(result.seconds).toBe(5);
  });

  it('returns correct values for exactly 30 seconds remaining', () => {
    const now = new Date('2026-08-07T23:59:30.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(30);
  });

  it('returns correct values for 1 hour and 30 minutes remaining', () => {
    const now = new Date('2026-08-07T22:30:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(30);
    expect(result.seconds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LNC-02: Past date handling
// ---------------------------------------------------------------------------

describe('LNC-02: getCountdown past date handling', () => {
  it('returns all zeros when target date is in the past', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it('returns all zeros when target equals now', () => {
    const now = new Date('2026-08-08T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it('never returns negative values for any field', () => {
    const now = new Date('2027-01-01T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBeGreaterThanOrEqual(0);
    expect(result.hours).toBeGreaterThanOrEqual(0);
    expect(result.minutes).toBeGreaterThanOrEqual(0);
    expect(result.seconds).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// LNC-03: Return type contract
// ---------------------------------------------------------------------------

describe('LNC-03: getCountdown return type contract', () => {
  it('returns an object with exactly the four expected fields', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result).toHaveProperty('days');
    expect(result).toHaveProperty('hours');
    expect(result).toHaveProperty('minutes');
    expect(result).toHaveProperty('seconds');
  });

  it('all returned values are non-negative integers', () => {
    const now = new Date('2026-07-01T12:34:56.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(Number.isInteger(result.days)).toBe(true);
    expect(Number.isInteger(result.hours)).toBe(true);
    expect(Number.isInteger(result.minutes)).toBe(true);
    expect(Number.isInteger(result.seconds)).toBe(true);
    expect(result.days).toBeGreaterThanOrEqual(0);
    expect(result.hours).toBeGreaterThanOrEqual(0);
    expect(result.minutes).toBeGreaterThanOrEqual(0);
    expect(result.seconds).toBeGreaterThanOrEqual(0);
  });

  it('hours is always 0-23, minutes 0-59, seconds 0-59', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.hours).toBeLessThanOrEqual(23);
    expect(result.minutes).toBeLessThanOrEqual(59);
    expect(result.seconds).toBeLessThanOrEqual(59);
  });
});

// ---------------------------------------------------------------------------
// LNC-04: Large span
// ---------------------------------------------------------------------------

describe('LNC-04: Large time spans', () => {
  it('handles 365+ day span correctly', () => {
    const now = new Date('2025-01-01T00:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.days).toBeGreaterThan(365);
    expect(result.hours).toBeLessThanOrEqual(23);
  });
});

// ---------------------------------------------------------------------------
// LNC-05: Millisecond boundary
// ---------------------------------------------------------------------------

describe('LNC-05: Millisecond boundary', () => {
  it('ignores sub-second precision (floors to whole seconds)', () => {
    const now = new Date('2026-08-07T23:59:59.500Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    // 500ms remaining — should floor to 0 seconds, not round to 1
    expect(result.seconds).toBe(0);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
  });
});
