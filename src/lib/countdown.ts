/**
 * Countdown Timer Utility — Hermetic Flight
 *
 * Pure function: no browser dependencies, no side effects.
 * Returns time remaining until a target Date as decomposed
 * days / hours / minutes / seconds. All values are non-negative
 * integers. Past or equal dates return all zeros.
 */

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Compute time remaining from `now` to `target`.
 *
 * @param target - The future date to count down to.
 * @param now    - Reference point for "now". Defaults to `new Date()`.
 * @returns      CountdownResult with fields: days, hours, minutes, seconds.
 *               All fields are non-negative integers.
 *               Sub-second precision is discarded via Math.floor.
 */
export function getCountdown(target: Date, now: Date = new Date()): CountdownResult {
  const diffMs = target.getTime() - now.getTime();

  // Clamp to zero — past dates return all zeros
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  // Total whole seconds remaining (floor discards sub-second ms)
  const totalSeconds = Math.floor(diffMs / 1000);

  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  return { days, hours, minutes, seconds };
}
