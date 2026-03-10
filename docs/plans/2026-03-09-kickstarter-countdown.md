# Kickstarter Countdown Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated `/launch` page as the canonical marketing URL for all pre-launch traffic, featuring an animated countdown to 8/8/26, pledge tier previews, and a "Notify Me" email CTA.

**Architecture:** Static Astro page with client-side countdown timer (JS), Vercel serverless API route for Loops.so `launch_notify` event, placeholder content for pledge tiers.

**Tech Stack:** Astro 5 SSG, Vercel serverless, Loops.so events/send API, Vitest, Playwright

**Content dependency:** Pledge tier names/prices/rewards from operator. Plan uses placeholder structure.

---

## Context: How This Fits the Codebase

### Existing Loops.so integration pattern (from `src/pages/api/quiz-submit.ts`)

- POST to `https://app.loops.so/api/v1/events/send`
- Headers: `Authorization: Bearer ${LOOPS_API_KEY}`, `Content-Type: application/json`, `Idempotency-Key: launch_${email.toLowerCase()}_${today}`
- Two-layer timeout: `AbortController` (5s) + `Promise.race` with `TIMEOUT_SENTINEL`
- Rate limiting: `WeakMap<Function, { global: RateLimitEntry; perEmail: Map<string, RateLimitEntry> }>` keyed on `globalThis.fetch`
- Global limit: 10 requests per cold start. Per-email limit: 3 requests.
- Response: `{ success: true }` on 200

### Existing page patterns (from `src/pages/quiz.astro`, `src/layouts/Layout.astro`)

- Layout props: `title`, `description`, `canonicalURL?`, `ogImage?`, `ogType?`
- `Layout.astro` auto-derives `siteUrl` from `Astro.site?.origin`, falls back to `'https://www.thehermeticflight.com'`
- `resolvedOgImage` is auto-qualified to absolute URL from `siteUrl`
- Glass panel: `class="glass-panel p-8 md:p-12 rounded-lg"` with corner brackets
- Primary CTA button: `class="btn-flame ..."`
- Color tokens: `text-hermetic-gold`, `text-hermetic-white`, `bg-hermetic-void`, `text-hermetic-emerald`, `text-hermetic-sulfur`
- Fonts: `font-serif` (Cinzel), `font-sans` (Lato)
- Animations: `animate-rise`, staggered opacity/translate reveal via `requestAnimationFrame`
- Background layers injected by Layout: `.stars`, `.fog-layer`, `.noise-overlay`, central gold spine line
- Honeypot: `<div style="position:absolute;left:-9999px;" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" /></div>`
- Timing gate: `(Date.now() - state.startTime) / 1000 < 3` = bot (shorter threshold than quiz — notify form is faster to fill than a 20-question quiz)
- GA4 via `gtag('event', ...)` — guarded with `if (typeof gtag === 'function')`
- Meta Pixel via `fbq('track', ...)` — guarded with `if (typeof fbq === 'function')`

### Existing test patterns (from `tests/quiz-submit.test.ts`)

- Vitest, `describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach`
- `import.meta.env.LOOPS_API_KEY = 'test-loops-key-12345'` — set BEFORE importing module under test
- `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(...))` in `beforeEach`
- `vi.restoreAllMocks()` in `afterEach`
- `mockRequest(body)`: `new Request('https://example.com/api/...', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })`
- Rate limit test: fire 20 requests, assert at least one 429
- Structural tests: `fs.readFileSync(path.resolve(__dirname, '../src/...'), 'utf-8')` — check source contains expected patterns

### Existing E2E pattern (from `tests/quiz-flow.spec.ts`)

- Raw Playwright (not `@playwright/test`) with custom `pass(name)` / `fail(name, err)` helpers
- `chromium.launch()` per test, `browser.close()` in `finally`
- `process.env.TEST_URL || 'http://localhost:4321'`
- No `@playwright/test` runner — invoked via `npx tsx tests/<file>.spec.ts`
- Assertions use `throw new Error(...)` inside try/catch, then call `pass()` or `fail()`

### Vitest config (`vitest.config.ts`)

```ts
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

E2E spec files (`*.spec.ts`) are NOT included in `vitest run`. They are run separately via `npx tsx`.

---

## Task 1: Create the Countdown Timer Utility

**Files created:** `src/lib/countdown.ts`

**Purpose:** Pure function returning `{ days, hours, minutes, seconds }` given a target ISO date string and a current date. No browser API dependency — importable in both server (tests) and client contexts. The countdown display logic in the page script calls this every second via `setInterval`.

### 1a. Write the failing test first

Create `tests/countdown.test.ts`:

```ts
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
    const now = new Date('2026-08-05T20:55:55.000Z');
    const target = new Date('2026-08-07T23:59:60.000Z'); // 2d 3h 4m 5s later
    // Recalculate precisely: 2026-08-07T23:59:60 normalizes to 2026-08-08T00:00:00
    // Use a clean example instead:
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

  it('hours is always 0–23', () => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.hours).toBeGreaterThanOrEqual(0);
    expect(result.hours).toBeLessThanOrEqual(23);
  });

  it('minutes is always 0–59', () => {
    const now = new Date('2026-08-07T23:00:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.minutes).toBeGreaterThanOrEqual(0);
    expect(result.minutes).toBeLessThanOrEqual(59);
  });

  it('seconds is always 0–59', () => {
    const now = new Date('2026-08-07T23:59:00.000Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    expect(result.seconds).toBeGreaterThanOrEqual(0);
    expect(result.seconds).toBeLessThanOrEqual(59);
  });
});

// ---------------------------------------------------------------------------
// LNC-04: Timezone correctness
// ---------------------------------------------------------------------------

describe('LNC-04: getCountdown timezone correctness', () => {
  it('computes the delta correctly regardless of the local timezone of the caller', () => {
    // The function takes Date objects — timezone neutrality is the caller's responsibility.
    // The function itself must compute delta purely from millisecond timestamps.
    // Verify that two Date objects 24 hours apart always yield exactly 1 day.
    const now = new Date(Date.UTC(2026, 7, 7, 4, 0, 0)); // 2026-08-07T04:00:00Z
    const target = new Date(Date.UTC(2026, 7, 8, 4, 0, 0)); // 2026-08-08T04:00:00Z
    const result = getCountdown(target, now);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it('accepts Date objects (not strings)', () => {
    // The export signature must accept Date, not string.
    // TypeScript will enforce this; runtime test confirms no implicit coercion.
    const now = new Date(2026, 7, 7, 0, 0, 0);
    const target = new Date(2026, 7, 8, 0, 0, 0);
    expect(() => getCountdown(target, now)).not.toThrow();
  });

  it('handles millisecond precision — does not round up seconds', () => {
    // 59.999 seconds remaining must be floor'd to 59, not rounded to 60.
    const now = new Date('2026-08-07T23:59:00.001Z');
    const target = new Date('2026-08-08T00:00:00.000Z');
    const result = getCountdown(target, now);
    // 59999ms remaining = 0d 0h 0m 59s (floor, not round)
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// LNC-05: LAUNCH_DATE export
// ---------------------------------------------------------------------------

describe('LNC-05: LAUNCH_DATE constant', () => {
  it('exports a LAUNCH_DATE constant as a Date object', async () => {
    const mod = await import('../src/lib/countdown');
    expect(mod.LAUNCH_DATE).toBeInstanceOf(Date);
  });

  it('LAUNCH_DATE is set to 2026-08-08 in the EDT timezone offset', async () => {
    const mod = await import('../src/lib/countdown');
    // Target: 2026-08-08T00:00:00-04:00 = 2026-08-08T04:00:00Z
    // The UTC time of the LAUNCH_DATE must equal 2026-08-08T04:00:00Z (EDT = UTC-4)
    expect(mod.LAUNCH_DATE.toISOString()).toBe('2026-08-08T04:00:00.000Z');
  });
});
```

### 1b. Verify the test fails before implementation

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/countdown.test.ts
```

Expected: All tests fail with "Cannot find module '../src/lib/countdown'".

### 1c. Record the frozen baseline

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
~/.claude/skills/frozen-test-file/record-baseline.sh tests/countdown.test.ts
```

Add to `.gitignore` if not already present:
```
.frozen-test-baseline
.frozen-test-manifest
```

### 1d. Implement `src/lib/countdown.ts`

```ts
/**
 * Countdown timer utility.
 *
 * Pure function: given a target Date and a current Date, returns the
 * remaining time broken into { days, hours, minutes, seconds }.
 *
 * No browser API dependency — safe to use in Node/test environments.
 * Client-side usage: call getCountdown(LAUNCH_DATE, new Date()) every second.
 *
 * LAUNCH_DATE is set to 2026-08-08T00:00:00-04:00 (midnight EDT).
 * EDT = UTC-4, so the UTC equivalent is 2026-08-08T04:00:00Z.
 */

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// 2026-08-08T00:00:00-04:00 (midnight Eastern Daylight Time)
export const LAUNCH_DATE = new Date('2026-08-08T04:00:00.000Z');

/**
 * Compute remaining time from `now` to `target`.
 *
 * Returns all zeros if `target` is in the past or equals `now`.
 * All fields are non-negative integers. Seconds and minutes are 0–59.
 * Hours is 0–23. Days is unbounded above.
 */
export function getCountdown(target: Date, now: Date): CountdownResult {
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1_000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  return { days, hours, minutes, seconds };
}
```

### 1e. Verify the frozen baseline is intact and all tests pass

```bash
~/.claude/skills/frozen-test-file/verify-frozen.sh
npx vitest run tests/countdown.test.ts
```

Expected: `verify-frozen.sh` exits 0. All countdown tests pass.

### 1f. Commit

```bash
git add src/lib/countdown.ts tests/countdown.test.ts
git commit -m "feat: add countdown timer utility (LNC-01 through LNC-05)"
```

### 1g. Clean the baseline

```bash
~/.claude/skills/frozen-test-file/record-baseline.sh --clean
```

---

## Task 2: Create the Launch-Notify API Route

**Files created:** `src/pages/api/launch-notify.ts`

**Purpose:** Serverless API route that accepts email + firstName, validates, rate-limits, and sends the `launch_notify` event to Loops.so. Mirrors `quiz-submit.ts` patterns exactly. No answer payload or classifier — simpler body.

### 2a. Write the failing test first

Create `tests/launch-notify.test.ts`:

```ts
/**
 * Launch Notify API Route — Unit Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/pages/api/launch-notify.ts
 *
 * Patterns mirror tests/quiz-submit.test.ts exactly (WeakMap rate limiter,
 * two-layer timeout, honeypot, email/firstName validation).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Environment setup — must happen before importing module under test.
// ---------------------------------------------------------------------------

import.meta.env.LOOPS_API_KEY = 'test-loops-key-12345';

import { POST } from '../src/pages/api/launch-notify';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRequest(body: unknown): Request {
  return new Request('https://example.com/api/launch-notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json();
}

function buildValidBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'test@example.com',
    firstName: 'Taylor',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Global fetch mock setup
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

function makeLoopsSuccess(): Response {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(makeLoopsSuccess()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// LNN-01: Baseline — valid submission succeeds
// ===========================================================================

describe('LNN-01: Baseline valid submission', () => {
  it('returns 200 with { success: true } for a valid email', async () => {
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('accepts submission without firstName', async () => {
    const res = await POST({ request: mockRequest({ email: 'user@example.com' }) });
    expect(res.status).toBe(200);
  });

  it('accepts submission with empty firstName', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: '' })) });
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// LNN-02: Email validation
// ===========================================================================

describe('LNN-02: Email validation', () => {
  it('rejects missing email', async () => {
    const res = await POST({ request: mockRequest({ firstName: 'Taylor' }) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects email with only @ character', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: '@' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email without domain', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user@' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email without local part', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: '@example.com' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email without TLD', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user@localhost' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email with spaces', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user @example.com' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email with multiple @ symbols', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user@@example.com' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email with double dots', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user@example..com' })) });
    expect(res.status).toBe(400);
  });

  it('rejects excessively long email (>254 chars)', async () => {
    const longLocal = 'a'.repeat(250);
    const res = await POST({ request: mockRequest(buildValidBody({ email: `${longLocal}@example.com` })) });
    expect(res.status).toBe(400);
  });

  it('accepts valid standard email', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user@example.com' })) });
    expect(res.status).toBe(200);
  });

  it('accepts valid email with subdomain', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user@mail.example.com' })) });
    expect(res.status).toBe(200);
  });

  it('accepts valid email with plus addressing', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'user+tag@example.com' })) });
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// LNN-03: firstName validation
// ===========================================================================

describe('LNN-03: firstName validation', () => {
  it('rejects firstName that is a number', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: 12345 })) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects firstName longer than 100 characters', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: 'A'.repeat(200) })) });
    expect(res.status).toBe(400);
  });

  it('rejects firstName that is an object', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: { injection: 'payload' } })) });
    expect(res.status).toBe(400);
  });

  it('accepts empty firstName', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: '' })) });
    expect(res.status).toBe(200);
  });

  it('accepts absent firstName', async () => {
    const res = await POST({ request: mockRequest({ email: 'user@example.com' }) });
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// LNN-04: Honeypot bot detection
// ===========================================================================

describe('LNN-04: Server-side bot detection', () => {
  it('rejects requests where honeypot field is filled', async () => {
    const body = { ...buildValidBody(), website: 'http://spam.example.com' };
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('accepts requests where honeypot field is empty string', async () => {
    const body = { ...buildValidBody(), website: '' };
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('accepts requests where honeypot field is absent', async () => {
    const body = buildValidBody();
    expect(body).not.toHaveProperty('website');
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('launch-notify source contains honeypot check', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/api/launch-notify.ts'),
      'utf-8',
    );
    expect(source).toMatch(/website|honeypot/i);
  });
});

// ===========================================================================
// LNN-05: Rate limiting
// ===========================================================================

describe('LNN-05: Rate limiting', () => {
  it('returns 429 after exceeding global request limit', async () => {
    const responses: Response[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await POST({ request: mockRequest(buildValidBody({ email: `user${i}@example.com` })) });
      responses.push(res);
    }
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('rate limit response includes error message', async () => {
    let rateLimitedResponse: Response | null = null;
    for (let i = 0; i < 20; i++) {
      const res = await POST({ request: mockRequest(buildValidBody({ email: `burst${i}@example.com` })) });
      if (res.status === 429) {
        rateLimitedResponse = res;
        break;
      }
    }
    expect(rateLimitedResponse).not.toBeNull();
    if (rateLimitedResponse) {
      const data = await parseResponse(rateLimitedResponse);
      expect(data.error).toBeDefined();
    }
  });

  it('rate limits per email to prevent duplicate signups', async () => {
    const body = buildValidBody({ email: 'duplicate@example.com' });
    const responses: Response[] = [];
    for (let i = 0; i < 10; i++) {
      responses.push(await POST({ request: mockRequest(body) }));
    }
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// LNN-06: Loops.so payload structure
// ===========================================================================

describe('LNN-06: Loops.so payload structure', () => {
  it('sends to correct Loops.so events endpoint', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const url = fetchMock.mock.calls[0][0];
    expect(url).toBe('https://app.loops.so/api/v1/events/send');
  });

  it('uses POST method', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('sends correct Authorization header', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer test-loops-key-12345');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('includes Idempotency-Key header', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Idempotency-Key']).toBeDefined();
    expect(typeof headers['Idempotency-Key']).toBe('string');
    expect(headers['Idempotency-Key'].length).toBeGreaterThan(0);
  });

  it('Idempotency-Key uses lowercase email', async () => {
    await POST({ request: mockRequest(buildValidBody({ email: 'UPPER@CASE.COM' })) });
    const headers = fetchMock.mock.calls[0][1].headers;
    const key = headers['Idempotency-Key'];
    expect(key).toContain('upper@case.com');
    expect(key).not.toContain('UPPER');
  });

  it('Idempotency-Key uses launch_ prefix', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers['Idempotency-Key']).toMatch(/^launch_/);
  });

  it('sends correct eventName: launch_notify', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const loopsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(loopsBody.eventName).toBe('launch_notify');
  });

  it('sends email in payload', async () => {
    await POST({ request: mockRequest(buildValidBody({ email: 'send-test@example.com' })) });
    const loopsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(loopsBody.email).toBe('send-test@example.com');
  });

  it('sends firstName in payload when provided', async () => {
    await POST({ request: mockRequest(buildValidBody({ firstName: 'Seeker' })) });
    const loopsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(loopsBody.firstName).toBe('Seeker');
  });

  it('sends source: launch_page in payload', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const loopsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(loopsBody.source).toBe('launch_page');
  });

  it('does NOT send archetype, answers, or quiz-specific fields', async () => {
    await POST({ request: mockRequest(buildValidBody()) });
    const loopsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(loopsBody).not.toHaveProperty('archetype');
    expect(loopsBody).not.toHaveProperty('answers');
    expect(loopsBody).not.toHaveProperty('eventProperties');
  });
});

// ===========================================================================
// LNN-07: Timeout and error handling (mirrors SYN-06)
// ===========================================================================

describe('LNN-07: Loops.so fetch timeout and error handling', () => {
  it('handles connection timeout gracefully (returns 500 within timeout window)', async () => {
    let fetchTimerId: ReturnType<typeof setTimeout>;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            fetchTimerId = setTimeout(() => {
              resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
            }, 30_000);
          }),
      ),
    );

    const handlerPromise = POST({ request: mockRequest(buildValidBody()) });
    const timeoutSentinel = new Promise<'TIMED_OUT'>((resolve) =>
      setTimeout(() => resolve('TIMED_OUT'), 6_000),
    );

    const result = await Promise.race([handlerPromise, timeoutSentinel]);
    clearTimeout(fetchTimerId!);

    if (result === 'TIMED_OUT') {
      expect.fail('Handler hung — no timeout mechanism implemented');
    } else {
      expect(result.status).toBe(500);
      const data = await parseResponse(result);
      expect(data.error).toBeDefined();
    }
  }, 10_000);

  it('handles non-JSON response from Loops.so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>Service Unavailable</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('handles empty response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 200 })),
    );
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
  });

  it('handles network error (fetch throws)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error: DNS resolution failed')),
    );
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('handles AbortError with timeout message', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toMatch(/timeout|timed out|unavailable/i);
  });

  it('uses AbortController or equivalent timeout mechanism', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/api/launch-notify.ts'),
      'utf-8',
    );
    const hasAbortMechanism =
      source.includes('AbortController') ||
      source.includes('AbortSignal.timeout') ||
      source.includes('signal:') ||
      source.includes('signal,');
    expect(hasAbortMechanism).toBe(true);
  });

  it('handles Loops.so returning { success: false }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: 'Invalid key' }), { status: 200 }),
      ),
    );
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });
});

// ===========================================================================
// LNN-08: Missing LOOPS_API_KEY
// ===========================================================================

describe('LNN-08: Missing LOOPS_API_KEY', () => {
  it('returns 500 with a configuration error when LOOPS_API_KEY is absent', async () => {
    // Temporarily unset the key
    const originalKey = import.meta.env.LOOPS_API_KEY;
    import.meta.env.LOOPS_API_KEY = '';

    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();

    // Restore
    import.meta.env.LOOPS_API_KEY = originalKey;
  });
});
```

### 2b. Verify the test fails before implementation

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/launch-notify.test.ts
```

Expected: All tests fail with "Cannot find module '../src/pages/api/launch-notify'".

### 2c. Record the frozen baseline

```bash
~/.claude/skills/frozen-test-file/record-baseline.sh tests/launch-notify.test.ts
```

### 2d. Implement `src/pages/api/launch-notify.ts`

The implementation is a direct adaptation of `quiz-submit.ts` with the answer/classifier logic removed. Copy the WeakMap rate limiter, email/firstName validators, two-layer timeout, and error handling verbatim. Change only what differs: event name, payload body, and idempotency key prefix.

```ts
export const prerender = false;

import type { APIRoute } from 'astro';

// ---------------------------------------------------------------------------
// Rate limiter — identical WeakMap pattern as quiz-submit.ts.
// Resets on Vercel cold start. Per-test isolation via vi.stubGlobal('fetch').
// ---------------------------------------------------------------------------

interface RateLimitEntry { count: number; }
interface RateLimiterBuckets {
  global: RateLimitEntry;
  perEmail: Map<string, RateLimitEntry>;
}

const GLOBAL_LIMIT = 10;
const EMAIL_LIMIT = 3;
const rateLimiterRegistry = new WeakMap<Function, RateLimiterBuckets>();

function getBuckets(fetchFn: Function): RateLimiterBuckets {
  if (!rateLimiterRegistry.has(fetchFn)) {
    rateLimiterRegistry.set(fetchFn, {
      global: { count: 0 },
      perEmail: new Map(),
    });
  }
  return rateLimiterRegistry.get(fetchFn)!;
}

function checkGlobalRateLimit(buckets: RateLimiterBuckets): boolean {
  buckets.global.count += 1;
  return buckets.global.count > GLOBAL_LIMIT;
}

function checkEmailRateLimit(buckets: RateLimiterBuckets, email: string): boolean {
  const entry = buckets.perEmail.get(email);
  if (!entry) {
    buckets.perEmail.set(email, { count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > EMAIL_LIMIT;
}

// ---------------------------------------------------------------------------
// Validation helpers — identical to quiz-submit.ts
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOUBLE_DOT_REGEX = /\.\./;
const MULTIPLE_AT_REGEX = /@.*@/;
const MAX_EMAIL_LENGTH = 254;
const MAX_FIRST_NAME_LENGTH = 100;

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string') return 'Valid email required';
  if (email.length > MAX_EMAIL_LENGTH) return 'Email too long';
  if (MULTIPLE_AT_REGEX.test(email)) return 'Invalid email format';
  if (DOUBLE_DOT_REGEX.test(email)) return 'Invalid email format';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email format';
  return null;
}

function validateFirstName(firstName: unknown): string | null {
  if (firstName === undefined || firstName === null || firstName === '') return null;
  if (typeof firstName !== 'string') return 'firstName must be a string';
  if (firstName.length > MAX_FIRST_NAME_LENGTH) return 'firstName too long';
  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, firstName, website } = body;

    // Server-side honeypot check
    if (website) {
      return new Response(
        JSON.stringify({ error: 'Bot detected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return new Response(
        JSON.stringify({ error: emailError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const firstNameError = validateFirstName(firstName);
    if (firstNameError) {
      return new Response(
        JSON.stringify({ error: firstNameError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Rate limiting — keyed on fetch reference
    const currentFetch = globalThis.fetch as unknown as Function;
    const buckets = getBuckets(currentFetch);

    if (checkGlobalRateLimit(buckets)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests — please try again later' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (checkEmailRateLimit(buckets, email)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests from this email — please try again later' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
    if (!LOOPS_API_KEY) {
      console.error('LOOPS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // Two-layer timeout — identical to quiz-submit.ts
    const FETCH_TIMEOUT_MS = 5_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const TIMEOUT_SENTINEL = Symbol('FETCH_TIMEOUT');
    const timeoutRace = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
      setTimeout(() => resolve(TIMEOUT_SENTINEL), FETCH_TIMEOUT_MS);
    });

    let loopsRes: Response;
    try {
      const fetchPromise = fetch('https://app.loops.so/api/v1/events/send', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${LOOPS_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `launch_${email.toLowerCase()}_${today}`,
        },
        body: JSON.stringify({
          email,
          eventName: 'launch_notify',
          firstName: typeof firstName === 'string' ? firstName : '',
          source: 'launch_page',
        }),
      });

      const result = await Promise.race([fetchPromise, timeoutRace]);

      if (result === TIMEOUT_SENTINEL) {
        controller.abort();
        clearTimeout(timeoutId);
        console.error('Loops.so fetch timed out after', FETCH_TIMEOUT_MS, 'ms');
        return new Response(
          JSON.stringify({ error: 'Email service unavailable — request timed out' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      loopsRes = result as Response;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        console.error('Loops.so fetch aborted (timed out):', fetchError);
        return new Response(
          JSON.stringify({ error: 'Email service unavailable — request timed out' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      console.error('Loops.so fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to connect to email service' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    let loopsData: Record<string, unknown>;
    try {
      const text = await loopsRes.text();
      if (!text) throw new Error('Empty response body from Loops.so');
      loopsData = JSON.parse(text) as Record<string, unknown>;
    } catch (parseError) {
      console.error('Loops.so response parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid response from email service' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!loopsData.success) {
      console.error('Loops.so event failed:', loopsData.message);
      return new Response(
        JSON.stringify({ error: 'Failed to register with email service' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Launch notify error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

### 2e. Verify baseline intact and all tests pass

```bash
~/.claude/skills/frozen-test-file/verify-frozen.sh
npx vitest run tests/launch-notify.test.ts
```

Expected: `verify-frozen.sh` exits 0. All launch-notify tests pass.

### 2f. Commit

```bash
git add src/pages/api/launch-notify.ts tests/launch-notify.test.ts
git commit -m "feat: add launch-notify API route (LNN-01 through LNN-08)"
```

### 2g. Clean the baseline

```bash
~/.claude/skills/frozen-test-file/record-baseline.sh --clean
```

---

## Task 3: Create the Launch Page

**Files created:** `src/pages/launch.astro`

**Files needed (already existing):** `src/layouts/Layout.astro`, `src/lib/countdown.ts`

**OG image needed:** `public/images/og/launch.png` — placeholder 1200x630 PNG. Create if it does not exist by copying `public/images/og/default.png`.

```bash
cp /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/default.png \
   /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/public/images/og/launch.png
```

### Pledge tier data structure

The following is a placeholder structure. All content tagged `// OPERATOR: fill in` must be replaced by the operator before launch. The data structure is intentional — it is easy to update in one place.

### 3a. Implement `src/pages/launch.astro`

```astro
---
import Layout from '../layouts/Layout.astro';

// Pledge tier placeholder data.
// OPERATOR: Replace name, price, and perks before launch.
// Add or remove tier objects to match your actual Kickstarter tiers.
const pledgeTiers = [
  {
    id: 'early-bird',
    name: 'Early Mystic',          // OPERATOR: fill in
    price: '$XX',                  // OPERATOR: fill in
    badge: 'Early Bird',
    perks: [
      'First Edition Deck',        // OPERATOR: fill in
      'Digital Guidebook',         // OPERATOR: fill in
      'Early Backer Discord',      // OPERATOR: fill in
    ],
    highlight: false,
  },
  {
    id: 'seeker',
    name: 'The Seeker',            // OPERATOR: fill in
    price: '$XX',                  // OPERATOR: fill in
    badge: 'Most Popular',
    perks: [
      'First Edition Deck',        // OPERATOR: fill in
      'Signed Print',              // OPERATOR: fill in
      'Digital Guidebook',         // OPERATOR: fill in
      'Early Backer Discord',      // OPERATOR: fill in
    ],
    highlight: true,
  },
  {
    id: 'adept',
    name: 'The Adept',             // OPERATOR: fill in
    price: '$XX',                  // OPERATOR: fill in
    badge: 'Full Collection',
    perks: [
      'Everything in Seeker',      // OPERATOR: fill in
      'Collector's Box',           // OPERATOR: fill in
      'Art Prints (Set of 6)',     // OPERATOR: fill in
      'Name in Guidebook',         // OPERATOR: fill in
    ],
    highlight: false,
  },
];

const launchDateDisplay = 'August 8, 2026';
---

<Layout
  title="The Hermetic Flight — Aerial Tarot Deck | Launching August 8, 2026"
  description="An aerial photography tarot deck that transforms flight into divination. Six archetypes. Twenty-two major cards. One Kickstarter launching August 8, 2026."
  canonicalURL="https://www.thehermeticflight.com/launch"
  ogImage="/images/og/launch.png"
>

  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-20 px-4">

    <!-- Header -->
    <header class="w-full py-4 flex justify-center mb-8">
      <a href="/" class="group flex items-center gap-3">
        <img src="/images/logo.png" alt="The Hermetic Flight" class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">The Hermetic Flight</span>
      </a>
    </header>

    <!-- ================================================================ -->
    <!-- SECTION 1: Hero + Countdown Timer                                -->
    <!-- ================================================================ -->
    <section class="w-full max-w-3xl text-center mb-20">
      <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-4">Kickstarter Launch</p>
      <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>

      <h1 class="font-serif text-4xl md:text-6xl text-hermetic-white leading-tight tracking-wide mb-4">
        The Hermetic Flight<br>
        <span class="text-hermetic-gold italic">Takes Flight</span>
      </h1>

      <p class="text-gray-300 font-sans font-light text-lg max-w-xl mx-auto mb-12 leading-relaxed">
        An aerial photography tarot deck that transforms the language of flight into a language of the soul.
        Launching on Kickstarter {launchDateDisplay}.
      </p>

      <!-- Countdown Timer -->
      <div class="glass-panel p-8 md:p-10 rounded-lg mb-4 relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <p class="text-hermetic-gold/60 text-xs tracking-[0.25em] uppercase font-sans mb-6">Launching In</p>

        <div id="countdown-display" class="grid grid-cols-4 gap-2 md:gap-6">
          <!-- Days -->
          <div class="flex flex-col items-center">
            <div class="text-4xl md:text-6xl font-serif text-hermetic-white tabular-nums" id="cd-days">--</div>
            <div class="text-hermetic-gold/40 text-xs tracking-[0.2em] uppercase font-sans mt-2">Days</div>
          </div>
          <!-- Hours -->
          <div class="flex flex-col items-center">
            <div class="text-4xl md:text-6xl font-serif text-hermetic-white tabular-nums" id="cd-hours">--</div>
            <div class="text-hermetic-gold/40 text-xs tracking-[0.2em] uppercase font-sans mt-2">Hours</div>
          </div>
          <!-- Minutes -->
          <div class="flex flex-col items-center">
            <div class="text-4xl md:text-6xl font-serif text-hermetic-white tabular-nums" id="cd-minutes">--</div>
            <div class="text-hermetic-gold/40 text-xs tracking-[0.2em] uppercase font-sans mt-2">Minutes</div>
          </div>
          <!-- Seconds -->
          <div class="flex flex-col items-center">
            <div class="text-4xl md:text-6xl font-serif text-hermetic-white tabular-nums" id="cd-seconds">--</div>
            <div class="text-hermetic-gold/40 text-xs tracking-[0.2em] uppercase font-sans mt-2">Seconds</div>
          </div>
        </div>

        <!-- Post-launch state (hidden until launch) -->
        <div id="countdown-launched" class="hidden text-center py-4">
          <p class="font-serif text-2xl text-hermetic-gold">We Have Liftoff.</p>
          <p class="text-gray-300 font-sans font-light mt-2">The Kickstarter is live.</p>
          <a href="#" id="kickstarter-link" class="btn-flame inline-block mt-4 px-8 py-3 text-white font-sans font-bold text-sm tracking-widest uppercase no-underline">
            Back Us on Kickstarter
          </a>
        </div>
      </div>

      <p class="text-hermetic-gold/30 text-xs font-sans tracking-wider">{launchDateDisplay} — Midnight Eastern</p>
    </section>

    <!-- ================================================================ -->
    <!-- SECTION 2: Why The Hermetic Flight                               -->
    <!-- ================================================================ -->
    <section class="w-full max-w-3xl mb-20">
      <div class="glass-panel p-8 md:p-12 rounded-lg relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2">The Concept</p>
        <div class="w-12 h-[1px] bg-hermetic-gold/20 mb-6"></div>

        <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white mb-6 leading-tight">
          A Tarot Deck Born 10,000 Feet Above the Earth
        </h2>

        <div class="space-y-4 text-gray-300 font-sans font-light leading-relaxed">
          <p>
            Every tarot deck tells a story about the human condition. The Hermetic Flight tells that story from above — through the lens of an aerial photographer who has spent years reading the landscape from altitude.
          </p>
          <p>
            The cards use aerial photography — coastlines, mountain ridges, river deltas, storm formations — as visual metaphors for the 22 Major Arcana. From this vantage point, the patterns we can't see from the ground become undeniable.
          </p>
          <p>
            This is a deck for people who think in systems and feel in symbols. Six archetypes. One revelation.
          </p>
        </div>

        <div class="border-t border-hermetic-gold/20 mt-8 pt-8">
          <a href="/quiz" class="inline-flex items-center gap-2 text-hermetic-gold/60 hover:text-hermetic-gold text-sm font-sans transition-colors">
            <span>Discover your aerial tarot archetype</span>
            <span class="text-xs">&rarr;</span>
          </a>
        </div>
      </div>
    </section>

    <!-- ================================================================ -->
    <!-- SECTION 3: Pledge Tier Preview Cards                             -->
    <!-- ================================================================ -->
    <section class="w-full max-w-4xl mb-20">
      <div class="text-center mb-10">
        <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2">Pledge Tiers</p>
        <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-4"></div>
        <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white">Choose Your Path</h2>
        <p class="text-gray-400 font-sans font-light text-sm mt-3">Final pricing revealed at launch. Early notification earns priority access.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pledgeTiers.map((tier) => (
          <div class={`glass-panel p-6 rounded-lg relative flex flex-col ${tier.highlight ? 'border border-hermetic-gold/40' : ''}`}>
            <div class="absolute top-2 left-2 w-2 h-2 border-t border-l border-hermetic-gold/30"></div>
            <div class="absolute top-2 right-2 w-2 h-2 border-t border-r border-hermetic-gold/30"></div>
            <div class="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-hermetic-gold/30"></div>
            <div class="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-hermetic-gold/30"></div>

            {tier.highlight && (
              <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                <span class="bg-hermetic-gold text-black text-xs font-sans font-bold px-3 py-1 rounded-full tracking-wider uppercase">{tier.badge}</span>
              </div>
            )}

            {!tier.highlight && (
              <p class="text-hermetic-gold/50 text-xs tracking-[0.2em] uppercase font-sans mb-4">{tier.badge}</p>
            )}

            <h3 class="font-serif text-xl text-hermetic-white mb-1">{tier.name}</h3>
            <p class="text-hermetic-gold text-2xl font-serif mb-4">{tier.price}</p>

            <ul class="space-y-2 flex-grow">
              {tier.perks.map((perk) => (
                <li class="flex items-start gap-2 text-gray-300 font-sans font-light text-sm">
                  <span class="text-hermetic-gold/50 mt-0.5 flex-shrink-0">&#x2022;</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>

            <div class="border-t border-hermetic-gold/10 mt-6 pt-4">
              <p class="text-hermetic-gold/30 text-xs font-sans text-center tracking-wider">Available at launch</p>
            </div>
          </div>
        ))}
      </div>

      <p class="text-center text-gray-500 font-sans text-xs mt-6">
        Pledge amounts and reward details are placeholders — final tiers revealed August 8, 2026.
      </p>
    </section>

    <!-- ================================================================ -->
    <!-- SECTION 4: Social Proof Strip                                    -->
    <!-- ================================================================ -->
    <section class="w-full max-w-3xl mb-20">
      <div class="glass-panel p-6 md:p-8 rounded-lg relative">
        <div class="absolute top-2 left-2 w-2 h-2 border-t border-l border-hermetic-gold/30"></div>
        <div class="absolute top-2 right-2 w-2 h-2 border-t border-r border-hermetic-gold/30"></div>
        <div class="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-hermetic-gold/30"></div>
        <div class="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-hermetic-gold/30"></div>

        <div class="flex flex-col md:flex-row items-center justify-around gap-8 text-center">
          <div>
            <div class="font-serif text-4xl text-hermetic-gold mb-1" id="proof-quiz-count">500+</div>
            <p class="text-hermetic-gold/50 text-xs tracking-[0.2em] uppercase font-sans">Archetype Readings</p>
          </div>
          <div class="w-px h-12 bg-hermetic-gold/20 hidden md:block"></div>
          <div>
            <div class="font-serif text-4xl text-hermetic-gold mb-1">6</div>
            <p class="text-hermetic-gold/50 text-xs tracking-[0.2em] uppercase font-sans">Unique Archetypes</p>
          </div>
          <div class="w-px h-12 bg-hermetic-gold/20 hidden md:block"></div>
          <div>
            <div class="font-serif text-4xl text-hermetic-gold mb-1">22</div>
            <p class="text-hermetic-gold/50 text-xs tracking-[0.2em] uppercase font-sans">Major Arcana Cards</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ================================================================ -->
    <!-- SECTION 5: Notify Me Email Form (CTA)                           -->
    <!-- ================================================================ -->
    <section class="w-full max-w-2xl mb-20" id="notify">
      <div class="glass-panel p-8 md:p-12 rounded-lg text-center relative">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <!-- Radial glow behind heading -->
        <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-[80px] pointer-events-none" style="background: radial-gradient(circle, #C5A059, transparent 70%);"></div>

        <div class="relative">
          <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2">Be First to Know</p>
          <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>

          <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white mb-3">Get Launch Day Access</h2>
          <p class="text-gray-300 font-sans font-light leading-relaxed mb-8 max-w-md mx-auto">
            Be notified the moment the campaign goes live. Early supporters receive priority access to limited early-bird tiers before they sell out.
          </p>

          <!-- Notify Me Form -->
          <form id="notify-form" class="space-y-3 max-w-sm mx-auto" novalidate>
            <!-- Honeypot (off-screen, invisible to humans) -->
            <div style="position:absolute;left:-9999px;" aria-hidden="true">
              <input type="text" name="website" tabindex="-1" autocomplete="off" />
            </div>

            <input
              type="text"
              name="firstName"
              placeholder="First Name (optional)"
              class="w-full p-3 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-gray-500 focus:border-hermetic-gold/50 focus:outline-none transition-colors duration-300"
            />
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              required
              class="w-full p-3 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-gray-500 focus:border-hermetic-gold/50 focus:outline-none transition-colors duration-300"
            />
            <button
              type="submit"
              id="notify-submit-btn"
              class="btn-flame w-full py-3 text-white font-sans font-bold text-sm tracking-widest uppercase"
            >
              Notify Me at Launch
            </button>
          </form>

          <!-- Error message -->
          <p id="notify-error" class="hidden text-red-400 font-sans text-sm mt-4"></p>

          <!-- Success state -->
          <div id="notify-success" class="hidden">
            <div class="w-12 h-12 rounded-full border border-hermetic-gold/50 mx-auto mb-4 flex items-center justify-center">
              <span class="text-hermetic-gold text-xl">&#x2713;</span>
            </div>
            <p class="text-hermetic-gold font-serif text-xl mb-2">You're on the List</p>
            <p class="text-gray-300 font-sans font-light">We'll notify you the moment the campaign launches. Watch your inbox on {launchDateDisplay}.</p>
          </div>

          <p class="text-hermetic-gold/30 text-xs font-sans mt-6 tracking-wider">No spam. Launch notification only.</p>
        </div>
      </div>
    </section>

    <!-- ================================================================ -->
    <!-- SECTION 6: FAQ Excerpt                                           -->
    <!-- ================================================================ -->
    <section class="w-full max-w-3xl mb-12">
      <div class="text-center mb-8">
        <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2">Questions</p>
        <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-4"></div>
        <h2 class="font-serif text-2xl text-hermetic-white">Common Questions</h2>
      </div>

      <div class="space-y-4">
        {[
          {
            q: 'Do I need to know tarot to use this deck?',
            a: 'No. The Hermetic Flight is designed to work for beginners and experienced readers alike. Each card includes a guidebook interpretation rooted in the aerial imagery itself.',
          },
          {
            q: 'What makes aerial photography meaningful for tarot?',
            a: 'From altitude, patterns invisible at ground level become clear — river systems, erosion, the geometry of growth. The same is true in readings. The aerial perspective creates natural metaphors for the Major Arcana that feel both primal and precise.',
          },
          {
            q: 'When will I be charged?',
            a: 'Kickstarter charges backers only if the campaign reaches its funding goal. You won\'t be charged until the campaign closes successfully on September 8, 2026.',
          },
          {
            q: 'Will there be international shipping?',
            a: 'Yes. International shipping options and estimated costs will be detailed in the campaign at launch.',
          },
        ].map((faq) => (
          <div class="glass-panel p-6 rounded-lg relative">
            <div class="absolute top-2 left-2 w-2 h-2 border-t border-l border-hermetic-gold/20"></div>
            <div class="absolute top-2 right-2 w-2 h-2 border-t border-r border-hermetic-gold/20"></div>
            <h3 class="font-serif text-hermetic-white mb-3">{faq.q}</h3>
            <p class="text-gray-400 font-sans font-light text-sm leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>

    <!-- Footer navigation -->
    <div class="text-center">
      <a href="/quiz" class="text-hermetic-gold/40 hover:text-hermetic-gold text-sm font-sans transition-colors">
        Discover Your Archetype &rarr;
      </a>
    </div>

  </main>

  <!-- ================================================================== -->
  <!-- Client-side JS: countdown timer + notify form                      -->
  <!-- ================================================================== -->
  <script>
    import { getCountdown, LAUNCH_DATE } from '../lib/countdown';

    // -----------------------------------------------------------------
    // Countdown timer
    // -----------------------------------------------------------------

    const cdDays    = document.getElementById('cd-days')!;
    const cdHours   = document.getElementById('cd-hours')!;
    const cdMinutes = document.getElementById('cd-minutes')!;
    const cdSeconds = document.getElementById('cd-seconds')!;
    const cdDisplay = document.getElementById('countdown-display')!;
    const cdLaunched = document.getElementById('countdown-launched')!;

    function pad(n: number): string {
      return String(n).padStart(2, '0');
    }

    function tick() {
      const now = new Date();
      const result = getCountdown(LAUNCH_DATE, now);

      if (LAUNCH_DATE <= now) {
        // Show post-launch state
        cdDisplay.classList.add('hidden');
        cdLaunched.classList.remove('hidden');
        clearInterval(intervalId);
        return;
      }

      cdDays.textContent    = String(result.days);
      cdHours.textContent   = pad(result.hours);
      cdMinutes.textContent = pad(result.minutes);
      cdSeconds.textContent = pad(result.seconds);
    }

    tick(); // immediate first render (no flash of '--')
    const intervalId = setInterval(tick, 1_000);

    // -----------------------------------------------------------------
    // Notify Me form
    // -----------------------------------------------------------------

    const notifyForm      = document.getElementById('notify-form') as HTMLFormElement;
    const notifySubmitBtn = document.getElementById('notify-submit-btn')!;
    const notifySuccess   = document.getElementById('notify-success')!;
    const notifyError     = document.getElementById('notify-error')!;

    const startTime = Date.now();

    notifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(notifyForm);

      // Client-side honeypot check
      if (formData.get('website')) return;

      // Timing gate (< 3s = bot — shorter than quiz timing gate)
      const elapsed = (Date.now() - startTime) / 1_000;
      if (elapsed < 3) return;

      const email     = (formData.get('email') as string)?.trim();
      const firstName = (formData.get('firstName') as string)?.trim();

      if (!email) {
        notifyError.textContent = 'Please enter your email address.';
        notifyError.classList.remove('hidden');
        return;
      }

      notifySubmitBtn.textContent = 'Sending...';
      notifySubmitBtn.setAttribute('disabled', 'true');
      notifySubmitBtn.style.opacity = '0.6';
      notifyError.classList.add('hidden');

      try {
        const res = await fetch('/api/launch-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, firstName, website: '' }),
        });

        if (res.ok) {
          notifyForm.classList.add('hidden');
          notifySuccess.classList.remove('hidden');

          // GA4 event
          if (typeof gtag === 'function') {
            gtag('event', 'launch_notify_signup', {
              event_category: 'launch_page',
              email_domain: email.split('@')[1] ?? 'unknown',
            });
          }
          // Meta Pixel
          if (typeof fbq === 'function') {
            fbq('track', 'Lead');
          }
        } else {
          const data = await res.json().catch(() => ({}));
          const message = typeof data.error === 'string' ? data.error : 'Something went wrong — please try again.';
          notifyError.textContent = message;
          notifyError.classList.remove('hidden');
          notifySubmitBtn.textContent = 'Notify Me at Launch';
          notifySubmitBtn.removeAttribute('disabled');
          notifySubmitBtn.style.opacity = '1';
        }
      } catch {
        notifyError.textContent = 'Something went wrong — please try again.';
        notifyError.classList.remove('hidden');
        notifySubmitBtn.textContent = 'Notify Me at Launch';
        notifySubmitBtn.removeAttribute('disabled');
        notifySubmitBtn.style.opacity = '1';
      }
    });

    // GA4 page view event (supplements Layout's gtag config call)
    if (typeof gtag === 'function') {
      gtag('event', 'launch_page_view', { event_category: 'launch_page' });
    }
  </script>

</Layout>
```

### 3b. Verify the build succeeds

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build
```

Expected: Build completes with no errors. `dist/launch/index.html` is present.

### 3c. Visual smoke test

```bash
npm run preview &
# Open http://localhost:4321/launch in browser.
# Verify: countdown numbers render and tick, form is visible, sections load.
# Kill preview: kill %1
```

### 3d. Commit

```bash
git add src/pages/launch.astro public/images/og/launch.png
git commit -m "feat: add /launch page with countdown timer, pledge tiers, notify CTA"
```

---

## Task 4: Tests

**Files created:**
- `tests/launch-notify.test.ts` (already created in Task 2)
- `tests/countdown.test.ts` (already created in Task 1)
- `tests/launch-page.spec.ts` (E2E, created here)

Both unit test files follow the frozen-test-file protocol and were written before their implementations. This section covers the E2E spec.

### 4a. Create `tests/launch-page.spec.ts`

Following the exact raw-Playwright pattern from `tests/quiz-flow.spec.ts`:

```ts
/**
 * Launch Page E2E Tests
 *
 * Usage:
 *   1. npm run build
 *   2. npm run preview &   (starts on port 4321)
 *   3. npx tsx tests/launch-page.spec.ts
 *
 * Uses raw playwright (not @playwright/test) with custom pass/fail helpers.
 * Mirrors the pattern from tests/quiz-flow.spec.ts exactly.
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:4321';
let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(name: string) {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function fail(name: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  failures.push(`${name}: ${msg}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}: ${msg}`);
}

// ---------------------------------------------------------------------------
// Test: Launch page loads (HTTP 200)
// ---------------------------------------------------------------------------
async function testLaunchPageLoads() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const res = await page.goto(`${BASE_URL}/launch`);
    if (!res || res.status() !== 200) {
      throw new Error(`/launch returned status ${res?.status()}`);
    }
    const h1 = await page.textContent('h1');
    if (!h1 || h1.length === 0) {
      throw new Error('/launch h1 is empty');
    }
    pass('testLaunchPageLoads');
  } catch (err) {
    fail('testLaunchPageLoads', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Countdown timer displays numeric values
// ---------------------------------------------------------------------------
async function testCountdownDisplaysNumbers() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    // Wait up to 2s for the countdown script to run
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cd-days');
        return el && el.textContent !== '--' && el.textContent !== '';
      },
      { timeout: 2_000 },
    );

    const daysText = await page.textContent('#cd-days');
    const hoursText = await page.textContent('#cd-hours');
    const minutesText = await page.textContent('#cd-minutes');
    const secondsText = await page.textContent('#cd-seconds');

    if (!daysText || isNaN(parseInt(daysText, 10))) {
      throw new Error(`Days not a number: "${daysText}"`);
    }
    if (!hoursText || isNaN(parseInt(hoursText, 10))) {
      throw new Error(`Hours not a number: "${hoursText}"`);
    }
    if (!minutesText || isNaN(parseInt(minutesText, 10))) {
      throw new Error(`Minutes not a number: "${minutesText}"`);
    }
    if (!secondsText || isNaN(parseInt(secondsText, 10))) {
      throw new Error(`Seconds not a number: "${secondsText}"`);
    }

    pass('testCountdownDisplaysNumbers');
  } catch (err) {
    fail('testCountdownDisplaysNumbers', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Countdown timer ticks (seconds decrements or wraps)
// ---------------------------------------------------------------------------
async function testCountdownTicks() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    // Read initial seconds
    await page.waitForFunction(
      () => {
        const el = document.getElementById('cd-seconds');
        return el && el.textContent !== '--';
      },
      { timeout: 2_000 },
    );
    const first = await page.textContent('#cd-seconds');

    // Wait 1.5s and read again
    await page.waitForTimeout(1_500);
    const second = await page.textContent('#cd-seconds');

    // The value must have changed (either decremented or wrapped from 00 to 59)
    if (first === second) {
      throw new Error(`Countdown seconds did not change after 1.5s: "${first}" → "${second}"`);
    }

    pass('testCountdownTicks');
  } catch (err) {
    fail('testCountdownTicks', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: OG tags present and correct
// ---------------------------------------------------------------------------
async function testLaunchPageOGTags() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle || ogTitle.length === 0) {
      throw new Error('og:title missing or empty');
    }

    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogImage?.includes('thehermeticflight.com')) {
      throw new Error(`og:image doesn't contain site URL: ${ogImage}`);
    }
    if (!ogImage?.includes('launch.png')) {
      throw new Error(`og:image should reference launch.png, got: ${ogImage}`);
    }

    const twitterCard = await page.$eval(
      'meta[name="twitter:card"]',
      (el) => el.getAttribute('content'),
    );
    if (twitterCard !== 'summary_large_image') {
      throw new Error(`twitter:card should be summary_large_image, got: ${twitterCard}`);
    }

    pass('testLaunchPageOGTags');
  } catch (err) {
    fail('testLaunchPageOGTags', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Canonical URL
// ---------------------------------------------------------------------------
async function testLaunchPageCanonicalURL() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    const canonical = await page.$eval(
      'link[rel="canonical"]',
      (el) => el.getAttribute('href'),
    );
    if (!canonical?.startsWith('https://www.thehermeticflight.com')) {
      throw new Error(`Canonical should use www prefix, got: ${canonical}`);
    }
    if (!canonical?.includes('/launch')) {
      throw new Error(`Canonical should include /launch path, got: ${canonical}`);
    }

    pass('testLaunchPageCanonicalURL');
  } catch (err) {
    fail('testLaunchPageCanonicalURL', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Notify Me form is present and has required elements
// ---------------------------------------------------------------------------
async function testNotifyFormPresent() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    const emailInput = await page.$('form#notify-form input[type="email"]');
    if (!emailInput) throw new Error('Email input not found in notify form');

    const submitBtn = await page.$('#notify-submit-btn');
    if (!submitBtn) throw new Error('Submit button not found');

    const honeypot = await page.$('input[name="website"]');
    if (!honeypot) throw new Error('Honeypot input not found');

    // Honeypot must be off-screen / invisible
    const honeypotParent = await honeypot.evaluateHandle((el) => el.parentElement);
    const parentStyle = await (honeypotParent as any).evaluate((el: HTMLElement) => el.style.cssText);
    if (!parentStyle.includes('-9999px')) {
      throw new Error(`Honeypot parent is not off-screen: "${parentStyle}"`);
    }

    pass('testNotifyFormPresent');
  } catch (err) {
    fail('testNotifyFormPresent', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Pledge tier cards are rendered (at least one visible)
// ---------------------------------------------------------------------------
async function testPledgeTiersRendered() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    // Each tier card has an h3 — check at least one exists
    const tierHeadings = await page.$$('h3');
    if (tierHeadings.length === 0) {
      throw new Error('No pledge tier h3 headings found');
    }

    pass('testPledgeTiersRendered');
  } catch (err) {
    fail('testPledgeTiersRendered', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Quiz CTA link present
// ---------------------------------------------------------------------------
async function testQuizCTALink() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/launch`);

    const quizLink = await page.$('a[href="/quiz"]');
    if (!quizLink) throw new Error('No link to /quiz found on launch page');

    pass('testQuizCTALink');
  } catch (err) {
    fail('testQuizCTALink', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n  Launch Page E2E Tests\n');

  await testLaunchPageLoads();
  await testCountdownDisplaysNumbers();
  await testCountdownTicks();
  await testLaunchPageOGTags();
  await testLaunchPageCanonicalURL();
  await testNotifyFormPresent();
  await testPledgeTiersRendered();
  await testQuizCTALink();

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failures.length > 0) {
    console.log('  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
```

### 4b. Run the full test suite

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight

# Unit tests
npx vitest run

# E2E tests (requires preview server)
npm run build
npm run preview &
PREVIEW_PID=$!
sleep 2
npx tsx tests/launch-page.spec.ts
kill $PREVIEW_PID
```

Expected: All unit tests pass. All 8 E2E tests pass.

### 4c. Commit

```bash
git add tests/launch-page.spec.ts
git commit -m "test: add E2E tests for launch page (countdown, OG tags, form, pledge tiers)"
```

---

## Task 5: Quality Gates

### 5a. Frozen Test File — Final Verification

After Tasks 1–4 are complete, confirm no frozen test files were modified during implementation:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight

# Check the git log to confirm test files were authored in separate commits
# from their implementations.
git log --oneline --name-only | head -30

# Run the full test suite as the final gate
npx vitest run
```

Expected: `vitest run` exits 0. All unit tests across all test files pass.

Record any bugs or gaps discovered:

```bash
~/.claude/skills/frozen-test-file/record-learning.sh \
  "Countdown timer edge case: millisecond floor" \
  "Writing tests for getCountdown, noticed floor vs round matters at 59.999s" \
  "LNC-04 test covers this explicitly — implementation must use Math.floor" \
  --prevention "Always test millisecond boundary in time-based utilities" \
  --severity info \
  --tags "countdown,math,edge-case"
```

### 5b. Evaluation Protocol — 3 Evaluators

After all tasks complete and all tests pass, run the evaluation protocol with 3 independent evaluators. Each evaluator receives a fresh context with no knowledge of the other evaluators' findings.

**Scratch directory:**

```bash
mkdir -p /tmp/eval-scratch-launch-2026-03-09
```

**Sprint ID:** `launch-2026-03-09`

**Evaluator lenses (orthogonal):**

**Evaluator 1: Conversion Lens**
Examine the `/launch` page as a marketing conversion artifact.
- Is the CTA above the fold on mobile?
- Is the countdown timer the first thing users see?
- Is the "Notify Me" button copy specific and action-oriented?
- Is the form friction appropriate (too many vs. too few fields)?
- Does the success state clearly communicate what happens next?
- Is the quiz CTA cross-link well-placed?
- What is the expected conversion funnel from landing to signup?
- What signals indicate trust or urgency to a cold visitor?

**Evaluator 2: Security Lens**
Examine the API route and page from a security perspective.
- Is the rate limiter robust against the WeakMap reset on cold start? What attack vectors exist?
- Is the honeypot truly invisible to CSS-based scrapers?
- Does the timing gate (3s) in the client form add meaningful protection?
- Are there injection vectors in email or firstName fields that bypass validation?
- Is the Idempotency-Key sufficient to prevent duplicate signup spam?
- Does the `source: 'launch_page'` field in the Loops payload prevent cross-contamination with quiz signups?
- What CSP implications does the inline `<script>` have relative to the Layout's GTM/GA4 scripts?

**Evaluator 3: SEO and Marketing Lens**
Examine the page for discoverability, social sharing, and brand consistency.
- Are the `og:title`, `og:description`, and `og:image` compelling for click-through on social?
- Is the canonical URL set correctly to avoid duplicate content with `/`?
- Does the page have a meaningful `<title>` tag that includes the launch date?
- Are the FAQ items semantically marked up for potential rich results?
- Is the Kickstarter launch date (8/8/26) surfaced prominently enough for SEO?
- Does the page link internally to `/quiz` (supporting quiz SEO)?
- Is the `launch.png` OG image placeholder acceptable for pre-launch sharing, or should a real image be a hard prerequisite?
- What schema.org markup (e.g., `Event`) would improve search discoverability?

**Output format per evaluator:**

Each evaluator writes a report to `operations/eval-launch-2026-03-09/eval-{1,2,3}-{lens}.md` with:
- Finding ID (e.g., LNC-V1-01)
- Title
- Severity (Critical / High / Medium / Deferred)
- Description (no implementation hints — stripped)
- Verification criterion

**Synthesis:** Orchestrator runs convergence analysis across all 3 reports, produces `operations/eval-launch-2026-03-09/synthesis.md`.

**Remediation:** Any Critical or High findings go through frozen-test-file cycles before this sprint is closed.

**After Sprint 2 integration:** Once the full Sprint 2 feature set is assembled (Track A: Thank-you redirect, Track B: Infrastructure hardening, Track C: Kickstarter Countdown), run `harden` across the integrated `/launch` page and the full quiz pipeline together.

```bash
# Placeholder — invoke after integration
# claude harden
```

### 5c. Final commit and task archive

After evaluation and remediation:

```bash
# Record key decisions and learnings
~/.claude/skills/frozen-test-file/record-learning.sh \
  "launch-notify mirrors quiz-submit — DRY opportunity deferred" \
  "Writing launch-notify.ts, validation and rate-limit logic is copied verbatim from quiz-submit.ts" \
  "Deferred extraction to a shared lib (e.g., src/lib/api-helpers.ts) — would require re-freezing quiz-submit tests" \
  --prevention "If a third API route is added, extract shared helpers before writing the route" \
  --severity info \
  --tags "architecture,dry,api-routes"
```

Update `TASKBOARD.md` to mark Sprint 2B: Kickstarter Countdown as complete. Archive to `task-archive.md`.

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/countdown.ts` | Create | Pure countdown utility, `getCountdown()` + `LAUNCH_DATE` |
| `src/pages/api/launch-notify.ts` | Create | Serverless API route → Loops.so `launch_notify` event |
| `src/pages/launch.astro` | Create | Canonical marketing page with countdown, tiers, CTA |
| `public/images/og/launch.png` | Create | Placeholder OG image for launch page social sharing |
| `tests/countdown.test.ts` | Create | Vitest unit tests for countdown utility (frozen) |
| `tests/launch-notify.test.ts` | Create | Vitest unit tests for launch-notify API route (frozen) |
| `tests/launch-page.spec.ts` | Create | Playwright E2E tests for launch page |
| `operations/eval-launch-2026-03-09/` | Create (post-impl) | Evaluator reports, synthesis, verification playbook |

## Operator Tasks (Before Launch)

These items require operator action and cannot be automated:

1. **Pledge tier content:** Replace all `// OPERATOR: fill in` comments in `pledgeTiers` array inside `src/pages/launch.astro` with real tier names, prices, and perks.
2. **Kickstarter link:** Update `href="#"` on the `#kickstarter-link` element to the real Kickstarter campaign URL once it exists.
3. **OG image:** Replace `public/images/og/launch.png` placeholder with a real 1200x630 image for social sharing before any social promotion begins.
4. **Quiz count social proof:** Update the `500+` static value in the social proof strip (id: `proof-quiz-count`) if the real count diverges significantly.
5. **Loops.so dashboard:** Create the `launch_notify` event trigger in the Loops.so dashboard and configure the launch notification drip sequence.
6. **FAQ content:** Review the FAQ excerpt in Task 3 and update Q&A to match the actual campaign details once Kickstarter terms are finalized.
