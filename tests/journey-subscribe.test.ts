/**
 * Journey Subscribe API Route — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * It defines what the journey-subscribe API route must satisfy.
 * Do NOT modify this file during implementation.
 *
 * Module under test: src/pages/api/journey-subscribe.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Environment setup — must happen before importing module under test.
// ---------------------------------------------------------------------------

import.meta.env.LOOPS_API_KEY = 'test-loops-key-12345';

// Import the handler AFTER setting the env variable.
import { POST } from '../src/pages/api/journey-subscribe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildValidBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'test@example.com',
    firstName: 'Taylor',
    archetype: 'air-weaver',
    ...overrides,
  };
}

function mockRequest(body: unknown): Request {
  return new Request('https://example.com/api/journey-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Global fetch mock setup
// ---------------------------------------------------------------------------

beforeEach(() => {
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
  it('returns 200 with success:true for valid payload', async () => {
    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('sends correct event to Loops.so', async () => {
    await POST({ request: mockRequest(buildValidBody()) });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://app.loops.so/api/v1/events/send');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.eventName).toBe('journey_subscribe');
    expect(body.email).toBe('test@example.com');
    expect(body.firstName).toBe('Taylor');
    expect(body.source).toBe('journey_page');
    // archetype in Loops payload should be the internal slug (underscore), not the URL slug
    expect(body.archetype).toBe('air_weaver');
  });
});

// ===========================================================================
// Email validation
// ===========================================================================

describe('Email validation', () => {
  it('rejects missing email (400)', async () => {
    const body = buildValidBody({ email: undefined });
    delete (body as any).email;
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects invalid email format (400)', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ email: 'not-an-email' })) });
    expect(res.status).toBe(400);
  });

  it('rejects email > 254 chars (400)', async () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const res = await POST({ request: mockRequest(buildValidBody({ email: longEmail })) });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// firstName validation
// ===========================================================================

describe('firstName validation', () => {
  it('accepts missing firstName', async () => {
    const body = buildValidBody();
    delete (body as any).firstName;
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(200);
  });

  it('accepts empty firstName', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: '' })) });
    expect(res.status).toBe(200);
  });

  it('rejects firstName > 100 chars (400)', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ firstName: 'A'.repeat(200) })) });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// Archetype slug validation
// ===========================================================================

describe('Archetype slug validation', () => {
  const validSlugs = [
    'air-weaver',
    'embodied-intuitive',
    'ascending-seeker',
    'shadow-dancer',
    'flow-artist',
    'grounded-mystic',
  ];

  for (const slug of validSlugs) {
    it(`accepts valid URL slug: ${slug}`, async () => {
      const res = await POST({ request: mockRequest(buildValidBody({ archetype: slug })) });
      expect(res.status).toBe(200);
    });
  }

  it('rejects invalid slug (400)', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ archetype: 'not-a-real-archetype' })) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects empty slug (400)', async () => {
    const res = await POST({ request: mockRequest(buildValidBody({ archetype: '' })) });
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// Honeypot
// ===========================================================================

describe('Honeypot', () => {
  it('rejects when website field is non-empty (400)', async () => {
    const body = { ...buildValidBody(), website: 'http://spam.example.com' };
    const res = await POST({ request: mockRequest(body) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });
});

// ===========================================================================
// Rate limiting
// ===========================================================================

describe('Rate limiting', () => {
  it('returns 429 after exceeding global limit', async () => {
    const body = buildValidBody();
    const responses: Response[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await POST({ request: mockRequest(body) });
      responses.push(res);
    }
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('returns 429 after exceeding per-email limit', async () => {
    const body = buildValidBody({ email: 'duplicate@example.com' });
    const responses: Response[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await POST({ request: mockRequest(body) });
      responses.push(res);
    }
    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('rate limit response includes error message', async () => {
    const body = buildValidBody();
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
});

// ===========================================================================
// Loops.so integration
// ===========================================================================

describe('Loops.so integration', () => {
  it('converts URL slug to internal slug in Loops payload', async () => {
    await POST({ request: mockRequest(buildValidBody({ archetype: 'shadow-dancer' })) });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    // URL slug 'shadow-dancer' should become internal slug 'shadow_dancer'
    expect(body.archetype).toBe('shadow_dancer');
  });

  it('includes idempotency key', async () => {
    await POST({ request: mockRequest(buildValidBody()) });

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers;
    expect(headers['Idempotency-Key']).toBeDefined();
    expect(headers['Idempotency-Key']).toMatch(/^journey_/);
  });

  it('handles Loops.so timeout (500)', async () => {
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

    const handlerPromise = POST({ request: mockRequest(buildValidBody()) });
    const timeoutPromise = new Promise<'TIMED_OUT'>((resolve) =>
      setTimeout(() => resolve('TIMED_OUT'), 6_000),
    );

    const result = await Promise.race([handlerPromise, timeoutPromise]);
    clearTimeout(fetchTimerId!);

    if (result === 'TIMED_OUT') {
      expect.fail('Handler did not timeout — no timeout mechanism exists.');
    } else {
      expect(result.status).toBe(500);
      const data = await parseResponse(result);
      expect(data.error).toBeDefined();
    }
  }, 10_000);

  it('handles Loops.so error response (500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: 'Bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await POST({ request: mockRequest(buildValidBody()) });
    expect(res.status).toBe(500);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });
});
