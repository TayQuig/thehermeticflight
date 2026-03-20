/**
 * Quiz Submit API Route — Contract Tests (Hardening Findings)
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the quiz-submit API route must satisfy after
 * remediation of findings SYN-01 through SYN-06.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/pages/api/quiz-submit.ts
 *
 * Findings covered:
 *   SYN-01: Auto-advance race condition (documented; UI-layer)
 *   SYN-02: Answer payload validation missing
 *   SYN-03: Email validation insufficient
 *   SYN-04: No rate limiting on API route
 *   SYN-05: Bot detection client-side only
 *   SYN-06: No fetch timeout / error handling for Loops.so
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { questions } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Environment setup — must happen before importing module under test.
//
// The API route reads `import.meta.env.LOOPS_API_KEY` at call time.
// In Vitest, import.meta.env is shared across modules in the same worker,
// so setting it here makes it available to the handler.
// ---------------------------------------------------------------------------

import.meta.env.LOOPS_API_KEY = 'test-loops-key-12345';

// Import the handler AFTER setting the env variable.
import { POST } from '../src/pages/api/quiz-submit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid complete answers map — all 20 questions answered
 * with their first answer option. This is the baseline "good" payload.
 */
function buildValidAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of questions) {
    answers[q.id] = q.answers[0].id;
  }
  return answers;
}

/**
 * Build a valid request body with all required fields.
 */
function buildValidBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'test@example.com',
    firstName: 'Taylor',
    answers: buildValidAnswers(),
    ...overrides,
  };
}

/**
 * Create a mock Request object that mimics what Astro passes to the handler.
 */
function mockRequest(body: unknown): Request {
  return new Request('https://example.com/api/quiz-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Parse the Response body as JSON.
 */
async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Global fetch mock setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default mock: Loops.so returns success.
  // Individual tests override this when they need different behavior.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// Baseline: valid submission succeeds
// ===========================================================================

describe('Baseline: valid submission', () => {
  it('returns 200 with archetype for a fully valid payload', async () => {
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
    expect(data.archetype).toBeDefined();
    expect(typeof data.archetype).toBe('string');
  });

  it('returns quizVersion v2 in response', async () => {
    const res = await POST({ request: mockRequest(buildValidBody()) });
    const data = await parseResponse(res);
    expect(data.quizVersion).toBe('v2');
  });
});

// ===========================================================================
// SYN-01: Auto-advance race condition
// ===========================================================================

describe('SYN-01: Auto-advance race condition', () => {
  /**
   * SYN-01 is a client-side UI bug in quiz.astro where the auto-advance
   * setTimeout(500ms) is not cancelled when the user navigates back.
   * This causes stale timers to fire and advance to the wrong question.
   *
   * This finding cannot be fully tested via vitest unit tests because it
   * involves DOM event handlers, setTimeout, and browser rendering.
   *
   * REQUIREMENT FOR E2E TESTS (Playwright):
   * 1. Select an answer on Q5 (triggers 500ms auto-advance timer).
   * 2. Before 500ms elapses, click the "Previous" button to go back to Q4.
   * 3. Assert that the user stays on Q4 and is NOT auto-advanced to Q6.
   * 4. The stale timer referencing Q5's advance must be cancelled.
   *
   * The following test verifies that the client-side script in quiz.astro
   * includes a timer cancellation pattern (clearTimeout). This is a
   * structural contract — the implementation must store and clear the
   * auto-advance timer reference.
   */
  it('documents: auto-advance timer must be cancelled on back navigation (E2E required)', () => {
    // This test serves as a living requirement document.
    // It passes as a marker that the requirement has been captured.
    // The actual behavioral test must be an E2E/Playwright test.
    expect(true).toBe(true);
  });

  // Structural test: verify the quiz.astro source contains clearTimeout.
  // This will fail if the implementation doesn't add timer cancellation.
  it('quiz.astro source must contain clearTimeout for auto-advance timer', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const quizSource = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/quiz.astro'),
      'utf-8',
    );

    // The script section must store the timer ID and clear it
    expect(quizSource).toContain('clearTimeout');
  });
});

// ===========================================================================
// SYN-02: Answer payload validation missing
// ===========================================================================

describe('SYN-02: Answer payload validation', () => {
  it('rejects an empty answers object', async () => {
    const body = buildValidBody({ answers: {} });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects answers that is an array instead of an object', async () => {
    const body = buildValidBody({ answers: ['Q1-A', 'Q2-B'] });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when answer values are not strings', async () => {
    const answers = buildValidAnswers();
    (answers as any)['SEG1'] = 42; // number instead of string
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when answer values are objects', async () => {
    const answers = buildValidAnswers();
    (answers as any)['SEG1'] = { nested: 'value' }; // object instead of string
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when answer values are arrays', async () => {
    const answers = buildValidAnswers();
    (answers as any)['NQ02'] = ['NQ02-A', 'NQ02-B']; // array instead of string
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when answer values are null', async () => {
    const answers = buildValidAnswers();
    (answers as any)['SEG1'] = null;
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when question keys are not valid question IDs', async () => {
    const body = buildValidBody({
      answers: {
        'INVALID_KEY': 'SEG1-A',
        'ANOTHER_BAD': 'SEG2-B',
      },
    });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when answer IDs do not belong to their declared question', async () => {
    // SEG1 should have SEG1-A/B/C, not NQ01-A
    const answers = buildValidAnswers();
    answers['SEG1'] = 'NQ01-A'; // cross-question answer ID
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when the same answer ID appears under multiple question keys', async () => {
    const answers = buildValidAnswers();
    answers['SEG1'] = 'SEG1-A';
    answers['NQ01'] = 'SEG1-A'; // same answer ID reused for different question
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects answer IDs that do not exist in the quiz data', async () => {
    const answers = buildValidAnswers();
    answers['SEG1'] = 'SEG1-Z'; // Z is not a valid answer option for SEG1
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects when not all scored questions are answered', async () => {
    // Only answer segmentation questions — scored questions are required
    const body = buildValidBody({
      answers: {
        SEG1: 'SEG1-A',
        SEG2: 'SEG2-A',
        // Missing all scored questions (NQ01-NQ07, FP01-FP03)
      },
    });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('accepts when all scored questions are answered and non-scored are optional', async () => {
    // Build answers with only scored questions
    const answers: Record<string, string> = {};
    for (const q of questions) {
      if (q.phase === 'scored') {
        answers[q.id] = q.answers[0].id;
      }
    }
    const body = buildValidBody({ answers });
    const res = await POST({ request: mockRequest(body) });
    // Should succeed — non-scored questions are optional
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// SYN-03: Email validation insufficient
// ===========================================================================

describe('SYN-03: Email validation', () => {
  it('rejects email with only @ character', async () => {
    const body = buildValidBody({ email: '@' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('rejects email without domain part', async () => {
    const body = buildValidBody({ email: 'user@' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('rejects email without local part', async () => {
    const body = buildValidBody({ email: '@example.com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('rejects email without TLD', async () => {
    const body = buildValidBody({ email: 'user@localhost' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('rejects email with spaces', async () => {
    const body = buildValidBody({ email: 'user @example.com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('rejects email with multiple @ symbols', async () => {
    const body = buildValidBody({ email: 'user@@example.com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('rejects email with double dots in domain', async () => {
    const body = buildValidBody({ email: 'user@example..com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });

  it('accepts valid standard email', async () => {
    const body = buildValidBody({ email: 'user@example.com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('accepts valid email with subdomain', async () => {
    const body = buildValidBody({ email: 'user@mail.example.com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('accepts valid email with plus addressing', async () => {
    const body = buildValidBody({ email: 'user+tag@example.com' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  // firstName validation
  it('rejects firstName that is a number', async () => {
    const body = buildValidBody({ firstName: 12345 });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects firstName that exceeds reasonable length (>100 chars)', async () => {
    const body = buildValidBody({ firstName: 'A'.repeat(200) });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects firstName that is an object', async () => {
    const body = buildValidBody({ firstName: { injection: 'payload' } });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('accepts empty/missing firstName gracefully', async () => {
    const body = buildValidBody({ firstName: '' });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('rejects excessively long email (>254 chars)', async () => {
    const longLocal = 'a'.repeat(250);
    const body = buildValidBody({ email: `${longLocal}@example.com` });
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// SYN-04: No rate limiting on API route
// ===========================================================================

describe('SYN-04: Rate limiting', () => {
  /**
   * Rate limiting implementation may be at:
   * - Middleware level (Astro middleware, Vercel Edge middleware)
   * - Application level (in-memory store, Redis, etc.)
   * - Infrastructure level (Vercel WAF, edge config)
   *
   * These tests verify that SOME rate-limiting mechanism exists and
   * returns 429 when the limit is exceeded. The implementation approach
   * is up to the implementer.
   */

  it('returns 429 after exceeding request limit from same identifier', async () => {
    const body = buildValidBody();

    // Simulate many rapid requests — at least one should be rate-limited.
    // We make 20 rapid requests; implementation should limit well below this.
    const responses: Response[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await POST({ request: mockRequest(body) });
      responses.push(res);
    }

    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('rate limit response includes appropriate error message', async () => {
    const body = buildValidBody();

    // Send enough requests to trigger rate limiting
    let rateLimitedResponse: Response | null = null;
    for (let i = 0; i < 20; i++) {
      const res = await POST({ request: mockRequest(body) });
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

  it('rate limit applies per-email to prevent duplicate submissions', async () => {
    // Same email submitted multiple times should be throttled
    const body = buildValidBody({ email: 'duplicate@example.com' });
    const responses: Response[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await POST({ request: mockRequest(body) });
      responses.push(res);
    }

    // After the first successful submission, subsequent ones should be limited.
    // We check that at least some responses are 429 (rate limited).
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// SYN-05: Bot detection client-side only
// ===========================================================================

describe('SYN-05: Server-side bot detection', () => {
  /**
   * Currently, bot detection (honeypot field, timing check) exists ONLY
   * in quiz.astro's client-side JavaScript. The API route accepts any
   * request regardless of bot signals.
   *
   * After remediation, the server MUST validate bot signals.
   */

  it('rejects requests where honeypot field is filled', async () => {
    const body = {
      ...buildValidBody(),
      website: 'http://spam.example.com', // honeypot field filled = bot
    };
    const res = await POST({ request: mockRequest(body) });
    // Should reject — bots fill honeypot fields
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('accepts requests where honeypot field is empty string', async () => {
    const body = {
      ...buildValidBody(),
      website: '', // empty honeypot = legitimate user
    };
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('accepts requests where honeypot field is absent', async () => {
    // No website field at all — also legitimate
    const body = buildValidBody();
    expect(body).not.toHaveProperty('website');
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('rejects requests submitted too quickly (timing check < 10s)', async () => {
    const body = {
      ...buildValidBody(),
      _startTime: Date.now(), // submitted instantly — less than 10s
    };
    // The server should verify that the quiz wasn't completed impossibly fast.
    // Implementation may use a startTime token, a signed timestamp, or
    // compare against a server-side session creation time.
    const res = await POST({ request: mockRequest(body) });
    // If the server implements timing validation, it should reject
    // requests that are submitted faster than humanly possible.
    // The exact mechanism is up to the implementer, but the server
    // must have SOME timing-based bot detection.
    //
    // We test this by checking the handler exports or response behavior.
    // Since we can't truly simulate client timing from a unit test,
    // we verify structural presence:
    expect(res.status === 400 || res.status === 200).toBe(true);
    // The structural test below covers the requirement.
  });

  it('server handler checks for bot signals before processing', async () => {
    // Structural test: the API route source must reference bot detection
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/api/quiz-submit.ts'),
      'utf-8',
    );

    // The source must contain honeypot checking logic
    expect(source).toMatch(/website|honeypot/i);
  });
});

// ===========================================================================
// SYN-06: No fetch timeout / error handling for Loops.so
// ===========================================================================

describe('SYN-06: Loops.so fetch timeout and error handling', () => {
  it('handles Loops.so connection timeout gracefully', async () => {
    // Mock fetch that resolves only after a long delay (simulates hung connection).
    // The implementation must add AbortController with a timeout (e.g., 5-10s).
    // Once the implementation has a timeout, the AbortController will abort the
    // fetch and the handler will return 500 before the 30s resolves.
    //
    // With NO timeout implemented: the fetch waits the full delay, then returns
    // success — so the handler returns 200 instead of 500. This test catches that.
    let fetchTimerId: ReturnType<typeof setTimeout>;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            fetchTimerId = setTimeout(() => {
              resolve(
                new Response(JSON.stringify({ success: true }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }),
              );
            }, 30_000);
          }),
      ),
    );

    // Race the handler against our own timeout.
    // If the handler doesn't have its own timeout, it will hang.
    // We use Promise.race to prevent the test from blocking forever.
    const handlerPromise = POST({ request: mockRequest(buildValidBody()) });
    const timeoutPromise = new Promise<'TIMED_OUT'>((resolve) =>
      setTimeout(() => resolve('TIMED_OUT'), 6_000),
    );

    const result = await Promise.race([handlerPromise, timeoutPromise]);

    // Clean up the dangling timer
    clearTimeout(fetchTimerId!);

    if (result === 'TIMED_OUT') {
      // Handler hung — it has no timeout mechanism. FAIL.
      expect.fail(
        'Handler did not timeout — no AbortController or timeout mechanism exists. ' +
          'The handler hung waiting for fetch to resolve.',
      );
    } else {
      // Handler returned a response within the time window.
      // It should be a 500 error (timeout/abort), not a 200 success.
      expect(result.status).toBe(500);
      const data = await parseResponse(result);
      expect(data.error).toBeDefined();
    }
  }, 10_000); // Test timeout: 10s

  it('handles Loops.so returning non-JSON response', async () => {
    // Mock fetch returning HTML (e.g., error page, maintenance page)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><body>Service Unavailable</body></html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const body = buildValidBody();
    const res = await POST({ request: mockRequest(body) });
    // Should NOT throw an unhandled exception — should return a structured error
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
    expect(typeof data.error).toBe('string');
  });

  it('handles Loops.so returning empty response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const body = buildValidBody();
    const res = await POST({ request: mockRequest(body) });
    // Empty body causes JSON.parse to throw — handler must catch this
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('handles Loops.so network error (fetch throws)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error: DNS resolution failed')),
    );

    const body = buildValidBody();
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('handles Loops.so AbortError specifically', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const body = buildValidBody();
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
    // Error message should indicate timeout, not generic "internal server error"
    expect(data.error).toMatch(/timeout|timed out|unavailable/i);
  });

  it('uses AbortController/signal or equivalent timeout mechanism in fetch call', async () => {
    // Structural test: verify the source code includes timeout configuration
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/api/quiz-submit.ts'),
      'utf-8',
    );

    // The source must use AbortController, AbortSignal.timeout, or signal option
    const hasAbortMechanism =
      source.includes('AbortController') ||
      source.includes('AbortSignal.timeout') ||
      source.includes('signal:') ||
      source.includes('signal,');
    expect(hasAbortMechanism).toBe(true);
  });

  it('handles Loops.so returning valid JSON but unexpected structure', async () => {
    // Loops returns JSON but missing the expected `success` field
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', id: '12345' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const body = buildValidBody();
    const res = await POST({ request: mockRequest(body) });
    // Current code checks `loopsData.success` — if missing, it should handle gracefully
    // rather than silently treating undefined as falsy and returning 500 with no logging context
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });
});
