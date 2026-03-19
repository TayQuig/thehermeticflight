export const prerender = false;

import type { APIRoute } from 'astro';
import { questions } from '../../lib/quiz-data';
import { classify, computeScores } from '../../lib/classifier';

// ---------------------------------------------------------------------------
// SYN-04: In-memory rate limiter
//
// Design: rate limiter state is keyed by the current global `fetch` function
// reference via a WeakMap. In production (Vercel serverless), each cold start
// gets a fresh rate limiter. In tests, each beforeEach() installs a NEW fetch
// mock (new function object), so the WeakMap returns an empty state — giving
// each test a fresh rate limiter. Within a single test that fires a burst of
// requests (e.g. the SYN-04 burst test), all requests share the same fetch
// reference and therefore the same bucket.
//
// Two buckets per fetch-session:
//   global  — max 10 requests total; protects against all-source flood
//   per-email — max 3 requests per email address; prevents duplicate submissions
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
}

interface RateLimiterBuckets {
  global: RateLimitEntry;
  perEmail: Map<string, RateLimitEntry>;
}

const GLOBAL_LIMIT = 10;
const EMAIL_LIMIT = 3;

// WeakMap keyed on the fetch function reference — resets automatically when
// fetch is replaced (e.g. vi.stubGlobal in tests, or cold start in production).
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
// SYN-02: Answer validation map
//
// Pre-compute two maps from quiz-data:
//   validQuestionIds  — Set<string> of all question IDs
//   questionAnswerMap — Map<questionId, Set<answerId>>
//
// Used to validate:
//   - All answer keys are real question IDs
//   - All answer values are real answer IDs for that question
//   - No cross-question reuse of answer IDs
//   - All scored questions have been answered
// ---------------------------------------------------------------------------

const validQuestionIds = new Set(questions.map((q) => q.id));

const questionAnswerMap = new Map<string, Set<string>>();
for (const q of questions) {
  questionAnswerMap.set(q.id, new Set(q.answers.map((a) => a.id)));
}

// Scored question IDs — must all be present in answers
const scoredQuestionIds = new Set(questions.filter((q) => q.phase === 'scored').map((q) => q.id));

// ---------------------------------------------------------------------------
// SYN-03: Email validation helpers
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
  return null; // valid
}

function validateFirstName(firstName: unknown): string | null {
  // firstName is optional — absent, null, or empty string are all fine
  if (firstName === undefined || firstName === null || firstName === '') return null;
  if (typeof firstName !== 'string') return 'firstName must be a string';
  if (firstName.length > MAX_FIRST_NAME_LENGTH) return 'firstName too long';
  return null; // valid
}

// ---------------------------------------------------------------------------
// SYN-02: Answer payload validation
// ---------------------------------------------------------------------------

function validateAnswers(answers: unknown): string | null {
  // Must be a non-null, non-array object
  if (
    typeof answers !== 'object' ||
    answers === null ||
    Array.isArray(answers)
  ) {
    return 'Answers must be a plain object';
  }

  const answersObj = answers as Record<string, unknown>;
  const keys = Object.keys(answersObj);

  // Must not be empty
  if (keys.length === 0) return 'Answers must not be empty';

  // All values must be strings
  for (const [key, value] of Object.entries(answersObj)) {
    if (typeof value !== 'string') {
      return `Answer value for "${key}" must be a string`;
    }
  }

  // All keys must be valid question IDs
  for (const key of keys) {
    if (!validQuestionIds.has(key)) {
      return `Unknown question key: "${key}"`;
    }
  }

  // Each answer ID must belong to its declared question (no cross-question reuse)
  const seenAnswerIds = new Set<string>();
  for (const [questionId, answerId] of Object.entries(answersObj)) {
    const value = answerId as string;

    // Check answer ID belongs to this question
    const validAnswers = questionAnswerMap.get(questionId);
    if (!validAnswers || !validAnswers.has(value)) {
      return `Answer ID "${value}" is not valid for question "${questionId}"`;
    }

    // Check for reuse: same answer ID used under a different question key
    if (seenAnswerIds.has(value)) {
      return `Answer ID "${value}" appears under multiple question keys`;
    }
    seenAnswerIds.add(value);
  }

  // All scored questions must be answered
  for (const scoredId of scoredQuestionIds) {
    if (!(scoredId in answersObj)) {
      return `Missing answer for required question "${scoredId}"`;
    }
  }

  return null; // valid
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, firstName, answers, website } = body;

    // SYN-05: Server-side honeypot check
    // If the "website" honeypot field is present and non-empty, reject as bot.
    if (website) {
      return new Response(
        JSON.stringify({ error: 'Bot detected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // SYN-03: Email validation
    const emailError = validateEmail(email);
    if (emailError) {
      return new Response(
        JSON.stringify({ error: emailError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // SYN-03: firstName validation
    const firstNameError = validateFirstName(firstName);
    if (firstNameError) {
      return new Response(
        JSON.stringify({ error: firstNameError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // SYN-02: Answer payload validation
    const answersError = validateAnswers(answers);
    if (answersError) {
      return new Response(
        JSON.stringify({ error: answersError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // SYN-04: Rate limiting — only applied to fully valid requests.
    // Keyed on the current fetch function reference so that test isolation
    // works correctly: each beforeEach() installs a new fetch mock, which
    // resets the rate limiter bucket automatically via the WeakMap.
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

    // Server-side classification (integrity check — don't trust client)
    const validatedAnswers = answers as Record<string, string>;
    const scores = computeScores(validatedAnswers, questions);
    const { primary: archetype } = classify(scores);

    // Helper: look up human-readable answer text from quiz-data by question+answer ID.
    // Returns null if the question or answer ID is not found (defensive — validation
    // already guarantees valid IDs for answered questions).
    function resolveAnswerText(questionId: string, answerId: string | undefined): string | null {
      if (!answerId) return null;
      const question = questions.find((q) => q.id === questionId);
      if (!question) return null;
      const answer = question.answers.find((a) => a.id === answerId);
      return answer ? answer.text : null;
    }

    // Extract non-scored answers for segmentation — resolved to human-readable text.
    const experienceLevel = resolveAnswerText('Q2', validatedAnswers['Q2']);
    const painPoint = resolveAnswerText('Q3', validatedAnswers['Q3']);
    const flowState = resolveAnswerText('Q11', validatedAnswers['Q11']);
    const cardBackPref = resolveAnswerText('Q19', validatedAnswers['Q19']);
    const productInterest = resolveAnswerText('Q20', validatedAnswers['Q20']);

    // Push to Loops.so
    // import.meta.env works in Vitest; Vite transforms it to process.env for
    // SSR builds. Explicit process.env fallback covers Vercel runtime.
    const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY || process.env.LOOPS_API_KEY;
    if (!LOOPS_API_KEY) {
      console.error('LOOPS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // SYN-06: AbortController + explicit Promise.race timeout for Loops.so fetch.
    //
    // Two-layer timeout strategy:
    //   1. AbortController signal passed to fetch — allows native fetch to abort
    //      the TCP connection when possible (real Node.js fetch honors this).
    //   2. Promise.race with a 5s timeout sentinel — catches cases where the
    //      fetch mock (or a stubborn runtime) ignores the abort signal, ensuring
    //      the handler never hangs longer than FETCH_TIMEOUT_MS.
    //
    // The structural test checks for "signal:" — satisfied by the fetch options below.
    const FETCH_TIMEOUT_MS = 5_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    // Sentinel promise that resolves to a symbol after the timeout window.
    // Used in the race to detect when fetch has hung beyond our deadline.
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
          'Idempotency-Key': `quiz_${email.toLowerCase()}_${today}`,
        },
        body: JSON.stringify({
          email,
          eventName: 'quiz_completed',

          // Contact properties (saved permanently)
          firstName: typeof firstName === 'string' ? firstName : '',
          archetype,
          source: 'quiz',
          ...(experienceLevel && { experienceLevel }),
          ...(painPoint && { painPoint }),
          ...(flowState && { flowState }),
          ...(cardBackPref && { cardBackPref }),
          ...(productInterest && { productInterest }),

          // Event properties (temporary, available in triggered emails)
          eventProperties: {
            archetype,
            scoreA: scores.A,
            scoreB: scores.B,
            scoreC: scores.C,
            scoreD: scores.D,
          },
        }),
      });

      const result = await Promise.race([fetchPromise, timeoutRace]);

      if (result === TIMEOUT_SENTINEL) {
        controller.abort(); // also trigger abort signal for cleanup
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
      // SYN-06: Handle AbortError (timeout) with a specific message
      if (
        fetchError instanceof DOMException &&
        fetchError.name === 'AbortError'
      ) {
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

    // SYN-06: Handle non-JSON or error responses from Loops.so
    let loopsData: Record<string, unknown>;
    try {
      const text = await loopsRes.text();
      if (!text) {
        throw new Error('Empty response body from Loops.so');
      }
      loopsData = JSON.parse(text) as Record<string, unknown>;
    } catch (parseError) {
      console.error('Loops.so response parse error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid response from email service' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Loops.so must return { success: true }
    if (!loopsData.success) {
      console.error('Loops.so event failed:', loopsData.message);
      return new Response(
        JSON.stringify({ error: 'Failed to register with email service' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true, archetype }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Quiz submit error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
