/**
 * Launch Notify API Route — Contract Tests
 *
 * Module under test: src/pages/api/launch-notify.ts
 *
 * Test groups:
 *   LCN-01: Input validation
 *   LCN-02: Loops.so integration
 *   LCN-03: Honeypot and timing
 *   LCN-04: Rate limiting
 *   LCN-05: Structural checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Environment setup — must happen before importing module under test.
//
// The API route reads `import.meta.env.LOOPS_API_KEY` at call time.
// In Vitest, import.meta.env is shared across modules in the same worker,
// so setting it here makes it available to the handler.
// ---------------------------------------------------------------------------

import.meta.env.LOOPS_API_KEY = 'test-loops-key-12345';

// Import the handler AFTER setting the env variable.
import { POST } from '../src/pages/api/launch-notify';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock Request object that mimics what Astro passes to the handler.
 */
function mockRequest(body: unknown, method = 'POST'): Request {
  return new Request('https://example.com/api/launch-notify', {
    method,
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
// LCN-01: Input validation
// ===========================================================================

describe('LCN-01: Input validation', () => {
  it('rejects missing email (400)', async () => {
    const res = await POST({ request: mockRequest({ firstName: 'Taylor' }) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects invalid email format (400) — "not-an-email"', async () => {
    const res = await POST({ request: mockRequest({ email: 'not-an-email' }) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('rejects missing body / empty object (400)', async () => {
    const res = await POST({ request: mockRequest({}) });
    expect(res.status).toBe(400);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('accepts valid email with optional firstName', async () => {
    const res = await POST({
      request: mockRequest({ email: 'test@example.com', firstName: 'Taylor' }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('accepts valid email without firstName', async () => {
    const res = await POST({
      request: mockRequest({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('rejects non-POST methods (405 Method Not Allowed)', async () => {
    const getReq = new Request('https://example.com/api/launch-notify', {
      method: 'GET',
    });
    const res = await POST({ request: getReq });
    expect(res.status).toBe(405);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });
});

// ===========================================================================
// LCN-02: Loops.so integration
// ===========================================================================

describe('LCN-02: Loops.so integration', () => {
  it('sends correct event payload to Loops.so on success (200)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST({
      request: mockRequest({ email: 'user@example.com', firstName: 'Alex' }),
    });
    expect(res.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];

    // Correct endpoint
    expect(url).toBe('https://app.loops.so/api/v1/events/send');

    // Authorization header uses env key
    expect(options.headers['Authorization']).toBe('Bearer test-loops-key-12345');

    // Content-Type is application/json
    expect(options.headers['Content-Type']).toBe('application/json');

    // Idempotency key format: launch_${email.toLowerCase()}_${YYYY-MM-DD}
    const today = new Date().toISOString().split('T')[0];
    expect(options.headers['Idempotency-Key']).toBe(
      `launch_user@example.com_${today}`,
    );

    // Verify body
    const body = JSON.parse(options.body);
    expect(body.eventName).toBe('launch_notify');
    expect(body.email).toBe('user@example.com');

    // contactProperties contains firstName and source
    expect(body.contactProperties.firstName).toBe('Alex');
    expect(body.contactProperties.source).toBe('launch_page');

    // eventProperties is present (may be empty object)
    expect(body.eventProperties).toBeDefined();
    expect(typeof body.eventProperties).toBe('object');
  });

  it('sends empty string for firstName when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await POST({ request: mockRequest({ email: 'user@example.com' }) });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.contactProperties.firstName).toBe('');
  });

  it('returns 200 with { success: true } on Loops.so 200', async () => {
    const res = await POST({
      request: mockRequest({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('returns 502 when Loops.so returns non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: 'Bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const res = await POST({
      request: mockRequest({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(502);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });

  it('returns 502 when Loops.so fetch throws (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error: connection refused')),
    );

    const res = await POST({
      request: mockRequest({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(502);
    const data = await parseResponse(res);
    expect(data.error).toBeDefined();
  });
});

// ===========================================================================
// LCN-03: Honeypot and timing
// ===========================================================================

describe('LCN-03: Honeypot and timing', () => {
  it('silently rejects when honeypot field "website" is filled (200 with success:true)', async () => {
    const res = await POST({
      request: mockRequest({
        email: 'test@example.com',
        website: 'http://spam.example.com',
      }),
    });
    // Silent reject — return fake success so bots don't know they were caught
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('accepts when honeypot field "website" is empty string', async () => {
    const res = await POST({
      request: mockRequest({
        email: 'test@example.com',
        website: '',
      }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('accepts when honeypot field "website" is absent', async () => {
    const res = await POST({
      request: mockRequest({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('silently rejects when form submitted in under 2 seconds (200 with success:true)', async () => {
    const res = await POST({
      request: mockRequest({
        email: 'test@example.com',
        startTime: Date.now(), // submitted instantly — less than 2 seconds
      }),
    });
    // Silent reject — return fake success so bots don't know they were caught
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('accepts when startTime is more than 2 seconds ago', async () => {
    const res = await POST({
      request: mockRequest({
        email: 'test@example.com',
        startTime: Date.now() - 3_000, // 3 seconds ago — passes timing check
      }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });

  it('accepts when startTime is absent (timing check skipped)', async () => {
    const res = await POST({
      request: mockRequest({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
  });
});

// ===========================================================================
// LCN-04: Rate limiting
// ===========================================================================

describe('LCN-04: Rate limiting', () => {
  it('returns 429 after exceeding per-email limit (3 requests for same email)', async () => {
    const body = { email: 'rate-test@example.com' };
    const responses: Response[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await POST({ request: mockRequest(body) });
      responses.push(res);
    }

    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);

    // Error message must be present
    const limitedRes = rateLimited[0];
    const data = await parseResponse(limitedRes);
    expect(data.error).toBeDefined();
  });

  it('returns 429 after exceeding global limit (10 requests total)', async () => {
    const responses: Response[] = [];

    // Use different emails to avoid per-email limit, hit global limit
    for (let i = 0; i < 15; i++) {
      const res = await POST({
        request: mockRequest({ email: `user${i}@example.com` }),
      });
      responses.push(res);
    }

    const rateLimited = responses.filter((r) => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);

    // Error message must be present
    const limitedRes = rateLimited[0];
    const data = await parseResponse(limitedRes);
    expect(data.error).toBeDefined();
  });
});

// ===========================================================================
// LCN-05: Structural checks
// ===========================================================================

describe('LCN-05: Structural checks', () => {
  it('source file at src/pages/api/launch-notify.ts exists', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const sourcePath = path.resolve(
      __dirname,
      '../src/pages/api/launch-notify.ts',
    );
    expect(fs.existsSync(sourcePath)).toBe(true);
  });

  it('source contains "export const prerender = false"', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/api/launch-notify.ts'),
      'utf-8',
    );
    expect(source).toContain('export const prerender = false');
  });

  it('source contains "launch_notify" event name', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/api/launch-notify.ts'),
      'utf-8',
    );
    expect(source).toContain('launch_notify');
  });
});
