export const prerender = false;

import type { APIRoute } from 'astro';
import { archetypeByUrlSlug } from '../../lib/archetype-content';

// ---------------------------------------------------------------------------
// In-memory rate limiter
//
// Design: rate limiter state is keyed by the current global `fetch` function
// reference via a WeakMap. In production (Vercel serverless), each cold start
// gets a fresh rate limiter. In tests, each beforeEach() installs a NEW fetch
// mock (new function object), so the WeakMap returns an empty state — giving
// each test a fresh rate limiter. Within a single test that fires a burst of
// requests (e.g. the rate limit burst test), all requests share the same fetch
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
// Email and firstName validation helpers
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
// Valid archetype URL slugs
// ---------------------------------------------------------------------------

const VALID_URL_SLUGS = new Set([
  'air-weaver',
  'embodied-intuitive',
  'ascending-seeker',
  'shadow-dancer',
  'flow-artist',
  'grounded-mystic',
]);

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, firstName, archetype, website } = body;

    // Honeypot check — if the "website" honeypot field is present and non-empty,
    // reject as bot.
    if (website) {
      return new Response(
        JSON.stringify({ error: 'Bot detected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Email validation
    const emailError = validateEmail(email);
    if (emailError) {
      return new Response(
        JSON.stringify({ error: emailError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // firstName validation
    const firstNameError = validateFirstName(firstName);
    if (firstNameError) {
      return new Response(
        JSON.stringify({ error: firstNameError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Archetype slug validation — must be non-empty and one of the known URL slugs
    if (!archetype || typeof archetype !== 'string' || !VALID_URL_SLUGS.has(archetype)) {
      return new Response(
        JSON.stringify({ error: 'Invalid archetype slug' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Rate limiting — only applied to fully valid requests.
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

    // Convert URL slug to internal slug (hyphens -> underscores)
    const archetypeContent = archetypeByUrlSlug(archetype);
    const internalSlug = archetype.replace(/-/g, '_');

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

    // AbortController + explicit Promise.race timeout for Loops.so fetch.
    //
    // Two-layer timeout strategy:
    //   1. AbortController signal passed to fetch — allows native fetch to abort
    //      the TCP connection when possible (real Node.js fetch honors this).
    //   2. Promise.race with a 5s timeout sentinel — catches cases where the
    //      fetch mock (or a stubborn runtime) ignores the abort signal, ensuring
    //      the handler never hangs longer than FETCH_TIMEOUT_MS.
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
          'Idempotency-Key': `journey_${email.toLowerCase()}_${today}`,
        },
        body: JSON.stringify({
          email,
          eventName: 'journey_subscribe',

          // Contact properties (saved permanently)
          firstName: typeof firstName === 'string' ? firstName : '',
          archetype: internalSlug,
          source: 'journey_page',
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
      // Handle AbortError (timeout) with a specific message
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

    // Handle non-JSON or error responses from Loops.so
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Journey subscribe error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
