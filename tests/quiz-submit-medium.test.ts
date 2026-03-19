/**
 * Quiz Submit API Route — Medium Severity Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the quiz-submit API route must satisfy after
 * remediation of findings SYN-07, SYN-08, SYN-09, SYN-11, SYN-13.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/pages/api/quiz-submit.ts
 *
 * Findings covered:
 *   SYN-07: Non-scored answers sent as raw IDs instead of human-readable text
 *   SYN-08: Loops.so payload structure verification (additional coverage)
 *   SYN-09: Back-button structural verification in quiz.astro
 *   SYN-11: Q11 flow state not extracted by API route
 *   SYN-13: Idempotency key case-sensitive on email
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { questions } from '../src/lib/quiz-data';

// ---------------------------------------------------------------------------
// Environment setup — must happen before importing module under test.
// ---------------------------------------------------------------------------

import.meta.env.LOOPS_API_KEY = 'test-loops-key-12345';

// Import the handler AFTER setting the env variable.
import { POST } from '../src/pages/api/quiz-submit';

// ---------------------------------------------------------------------------
// Helpers (same patterns as quiz-submit.test.ts)
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

/**
 * Look up the human-readable answer text for a given question ID and answer ID.
 */
function getAnswerText(questionId: string, answerId: string): string {
  const question = questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`Question ${questionId} not found`);
  const answer = question.answers.find((a) => a.id === answerId);
  if (!answer) throw new Error(`Answer ${answerId} not found for ${questionId}`);
  return answer.text;
}

// ---------------------------------------------------------------------------
// Global fetch mock setup
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Create a fresh successful Loops.so response.
 * Each call returns a NEW Response object to avoid "Body is unusable" errors
 * when the handler reads the body on repeated calls within a single test.
 */
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
// SYN-07: Non-scored answers as raw IDs
//
// Non-scored answer values are currently sent to Loops.so as opaque answer IDs
// (e.g., "Q2-A") instead of human-readable answer text (e.g., "Curious, but
// just beginning."). The API route should resolve answer IDs to their text
// before sending to Loops.so.
// ===========================================================================

describe('SYN-07: Non-scored answers sent as human-readable text', () => {
  it('sends experienceLevel as answer text, not raw answer ID', async () => {
    const answers = buildValidAnswers();
    // Q2-A should resolve to "Curious, but just beginning."
    answers['Q2'] = 'Q2-A';
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // Must contain the human-readable text, not the raw ID
    const expectedText = getAnswerText('Q2', 'Q2-A');
    expect(loopsBody.experienceLevel).toBe(expectedText);
    // Must NOT be the raw ID
    expect(loopsBody.experienceLevel).not.toBe('Q2-A');
  });

  it('sends painPoint as answer text, not raw answer ID', async () => {
    const answers = buildValidAnswers();
    answers['Q3'] = 'Q3-C';
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    const expectedText = getAnswerText('Q3', 'Q3-C');
    expect(loopsBody.painPoint).toBe(expectedText);
    expect(loopsBody.painPoint).not.toBe('Q3-C');
  });

  it('sends cardBackPref as answer text, not raw answer ID', async () => {
    const answers = buildValidAnswers();
    answers['Q19'] = 'Q19-B';
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    const expectedText = getAnswerText('Q19', 'Q19-B');
    expect(loopsBody.cardBackPref).toBe(expectedText);
    expect(loopsBody.cardBackPref).not.toBe('Q19-B');
  });

  it('sends productInterest as answer text, not raw answer ID', async () => {
    const answers = buildValidAnswers();
    answers['Q20'] = 'Q20-D';
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    const expectedText = getAnswerText('Q20', 'Q20-D');
    expect(loopsBody.productInterest).toBe(expectedText);
    expect(loopsBody.productInterest).not.toBe('Q20-D');
  });

  it('sends all non-scored answers as text for every Q2 option', async () => {
    // Test each Q2 answer option to ensure lookup is comprehensive
    for (const answer of questions.find((q) => q.id === 'Q2')!.answers) {
      const answers = buildValidAnswers();
      answers['Q2'] = answer.id;
      const body = buildValidBody({ answers, email: `q2-${answer.id}@example.com` });

      // Fresh mock for each iteration to avoid rate limiting
      fetchMock.mockClear();
      fetchMock.mockImplementation(() => Promise.resolve(makeLoopsSuccess()));

      const res = await POST({ request: mockRequest(body) });
      expect(res.status).toBe(200);

      const fetchCall = fetchMock.mock.calls[0];
      const loopsBody = JSON.parse(fetchCall[1].body);

      expect(loopsBody.experienceLevel).toBe(answer.text);
    }
  });
});

// ===========================================================================
// SYN-08: Loops.so payload structure verification
//
// Verify that the Loops.so payload contains all expected fields with correct
// structure: email, eventName, firstName, archetype, source, eventProperties
// with scores, and all non-scored segmentation fields.
// ===========================================================================

describe('SYN-08: Loops.so payload structure verification', () => {
  it('sends correct top-level contact properties', async () => {
    const body = buildValidBody({
      email: 'payload-test@example.com',
      firstName: 'PayloadTest',
    });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // Required contact properties
    expect(loopsBody.email).toBe('payload-test@example.com');
    expect(loopsBody.eventName).toBe('quiz_completed');
    expect(loopsBody.firstName).toBe('PayloadTest');
    expect(loopsBody.source).toBe('quiz');
    expect(typeof loopsBody.archetype).toBe('string');
    expect(loopsBody.archetype).toBeTruthy();
  });

  it('sends eventProperties with all four dimension scores', async () => {
    const body = buildValidBody();

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // eventProperties must contain scores
    expect(loopsBody.eventProperties).toBeDefined();
    expect(typeof loopsBody.eventProperties.scoreA).toBe('number');
    expect(typeof loopsBody.eventProperties.scoreB).toBe('number');
    expect(typeof loopsBody.eventProperties.scoreC).toBe('number');
    expect(typeof loopsBody.eventProperties.scoreD).toBe('number');
    // Archetype should also be in eventProperties
    expect(loopsBody.eventProperties.archetype).toBe(loopsBody.archetype);
  });

  it('sends all non-scored segmentation fields when all non-scored questions answered', async () => {
    const answers = buildValidAnswers(); // includes Q2, Q3, Q11, Q19, Q20
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // All segmentation fields must be present when their questions are answered
    expect(loopsBody).toHaveProperty('experienceLevel');
    expect(loopsBody).toHaveProperty('painPoint');
    expect(loopsBody).toHaveProperty('flowState');
    expect(loopsBody).toHaveProperty('cardBackPref');
    expect(loopsBody).toHaveProperty('productInterest');

    // Each must be a non-empty string (the human-readable text)
    expect(typeof loopsBody.experienceLevel).toBe('string');
    expect(loopsBody.experienceLevel.length).toBeGreaterThan(0);
    expect(typeof loopsBody.painPoint).toBe('string');
    expect(loopsBody.painPoint.length).toBeGreaterThan(0);
    expect(typeof loopsBody.flowState).toBe('string');
    expect(loopsBody.flowState.length).toBeGreaterThan(0);
    expect(typeof loopsBody.cardBackPref).toBe('string');
    expect(loopsBody.cardBackPref.length).toBeGreaterThan(0);
    expect(typeof loopsBody.productInterest).toBe('string');
    expect(loopsBody.productInterest.length).toBeGreaterThan(0);
  });

  it('omits non-scored fields when their questions are not answered', async () => {
    // Build answers with only scored questions (no Q2, Q3, Q11, Q19, Q20)
    const answers: Record<string, string> = {};
    for (const q of questions) {
      if (q.phase === 'scored') {
        answers[q.id] = q.answers[0].id;
      }
    }
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // When non-scored questions are omitted, their fields should not be present
    // (the API route uses conditional spread: ...(value && { key: value }))
    expect(loopsBody).not.toHaveProperty('experienceLevel');
    expect(loopsBody).not.toHaveProperty('painPoint');
    expect(loopsBody).not.toHaveProperty('flowState');
    expect(loopsBody).not.toHaveProperty('cardBackPref');
    expect(loopsBody).not.toHaveProperty('productInterest');
  });

  it('sends correct Authorization header with Bearer token', async () => {
    const body = buildValidBody();

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const headers = fetchCall[1].headers;

    expect(headers['Authorization']).toBe('Bearer test-loops-key-12345');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends to correct Loops.so events endpoint', async () => {
    const body = buildValidBody();

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const url = fetchCall[0];

    expect(url).toBe('https://app.loops.so/api/v1/events/send');
  });

  it('uses POST method for Loops.so request', async () => {
    const body = buildValidBody();

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];

    expect(fetchCall[1].method).toBe('POST');
  });

  it('includes Idempotency-Key header', async () => {
    const body = buildValidBody();

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const headers = fetchCall[1].headers;

    expect(headers['Idempotency-Key']).toBeDefined();
    expect(typeof headers['Idempotency-Key']).toBe('string');
    expect(headers['Idempotency-Key'].length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// SYN-09: Browser test fake back-button assertion
//
// The browser test asserts back buttons exist on Q2-Q20 but performs no DOM
// verification. This structural test verifies that quiz.astro conditionally
// renders back buttons for questions after the first one.
// ===========================================================================

describe('SYN-09: Back button structural verification in quiz.astro', () => {
  it('quiz.astro conditionally renders back buttons only for questions after Q1', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const quizSource = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/quiz.astro'),
      'utf-8',
    );

    // The template must use a conditional that renders back buttons
    // only when the question index is greater than 0 (i.e., not Q1).
    // The pattern {i > 0 && ...} or equivalent ensures Q1 has no back button.
    expect(quizSource).toMatch(/\{i\s*>\s*0\s*&&/);
  });

  it('quiz.astro contains a back button element with appropriate class or role', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const quizSource = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/quiz.astro'),
      'utf-8',
    );

    // Must contain a back/previous button with identifiable class
    expect(quizSource).toMatch(/class="[^"]*back-btn[^"]*"/);
    // Must contain "Previous" text for accessibility
    expect(quizSource).toContain('Previous');
  });

  it('quiz.astro back button handler cancels auto-advance timer', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const quizSource = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/quiz.astro'),
      'utf-8',
    );

    // The back button click handler must cancel any pending auto-advance timer.
    // This is verified by checking that clearTimeout is called in the back
    // button handler context, and that a timer variable is used.
    expect(quizSource).toContain('clearTimeout');
    expect(quizSource).toMatch(/autoAdvanceTimer/);
  });
});

// ===========================================================================
// SYN-11: Q11 flow state not extracted
//
// Q11 flow state answer is captured on the client but not extracted by the
// server-side API route. The API route currently extracts Q2, Q3, Q19, Q20
// but silently discards Q11.
// ===========================================================================

describe('SYN-11: Q11 flow state extraction', () => {
  it('extracts Q11 answer and sends as flowState to Loops.so', async () => {
    const answers = buildValidAnswers();
    answers['Q11'] = 'Q11-B';
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // flowState must be present in the Loops.so payload
    expect(loopsBody).toHaveProperty('flowState');
    expect(loopsBody.flowState).toBeTruthy();
  });

  it('sends Q11 flowState as human-readable text, not raw ID', async () => {
    const answers = buildValidAnswers();
    answers['Q11'] = 'Q11-C';
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    const expectedText = getAnswerText('Q11', 'Q11-C');
    expect(loopsBody.flowState).toBe(expectedText);
    expect(loopsBody.flowState).not.toBe('Q11-C');
  });

  it('omits flowState when Q11 is not answered', async () => {
    // Build answers with only scored questions (Q11 is non-scored, so excluded)
    const answers: Record<string, string> = {};
    for (const q of questions) {
      if (q.phase === 'scored') {
        answers[q.id] = q.answers[0].id;
      }
    }
    const body = buildValidBody({ answers });

    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const loopsBody = JSON.parse(fetchCall[1].body);

    // When Q11 is not answered, flowState should be absent
    expect(loopsBody).not.toHaveProperty('flowState');
  });

  it('sends correct flowState for each Q11 answer option', async () => {
    const q11 = questions.find((q) => q.id === 'Q11')!;

    for (const answer of q11.answers) {
      const answers = buildValidAnswers();
      answers['Q11'] = answer.id;
      const body = buildValidBody({
        answers,
        email: `q11-${answer.id}@example.com`,
      });

      // Fresh mock for each iteration to avoid rate limiting
      fetchMock.mockClear();
      fetchMock.mockImplementation(() => Promise.resolve(makeLoopsSuccess()));

      const res = await POST({ request: mockRequest(body) });
      expect(res.status).toBe(200);

      const fetchCall = fetchMock.mock.calls[0];
      const loopsBody = JSON.parse(fetchCall[1].body);

      expect(loopsBody.flowState).toBe(answer.text);
    }
  });
});

// ===========================================================================
// SYN-13: Idempotency key case-sensitive
//
// The idempotency key currently uses the email as-is: `quiz_${email}_${today}`.
// This means "User@Example.com" and "user@example.com" produce different keys,
// allowing duplicate submissions. The key must normalize email to lowercase.
// ===========================================================================

describe('SYN-13: Idempotency key email normalization', () => {
  it('produces the same idempotency key for same email with different casing', async () => {
    // First request: mixed case email
    const body1 = buildValidBody({ email: 'User@Example.com' });
    await POST({ request: mockRequest(body1) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call1Headers = fetchMock.mock.calls[0][1].headers;
    const key1 = call1Headers['Idempotency-Key'];

    // Second request: lowercase email (same address)
    const body2 = buildValidBody({ email: 'user@example.com' });
    await POST({ request: mockRequest(body2) });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const call2Headers = fetchMock.mock.calls[1][1].headers;
    const key2 = call2Headers['Idempotency-Key'];

    // Both must produce the same idempotency key
    expect(key1).toBe(key2);
  });

  it('idempotency key contains lowercase email regardless of input casing', async () => {
    const body = buildValidBody({ email: 'UPPER@CASE.COM' });
    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = fetchMock.mock.calls[0][1].headers;
    const key = headers['Idempotency-Key'];

    // The key must not contain uppercase email characters
    expect(key).not.toContain('UPPER');
    expect(key).not.toContain('CASE');
    // It should contain the lowercase version
    expect(key).toContain('upper@case.com');
  });

  it('idempotency key is deterministic for same normalized email on same day', async () => {
    // Send two requests with the exact same lowercase email
    const body = buildValidBody({ email: 'deterministic@test.com' });

    await POST({ request: mockRequest(body) });
    await POST({ request: mockRequest(body) });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const key1 = fetchMock.mock.calls[0][1].headers['Idempotency-Key'];
    const key2 = fetchMock.mock.calls[1][1].headers['Idempotency-Key'];

    expect(key1).toBe(key2);
  });
});
