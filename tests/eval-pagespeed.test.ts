/**
 * PageSpeed Query Client — Unit Tests
 *
 * Frozen-test-file protocol: TEST CONTRACT.
 * Module under test: src/lib/eval/pagespeed.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { queryCWV } from '../src/lib/eval/pagespeed';

// Mock PageSpeed API response (matches actual API shape from reference doc)
const mockPsiResponse = {
  lighthouseResult: {
    categories: {
      performance: { score: 0.92 },
    },
    audits: {
      'largest-contentful-paint': { numericValue: 1200 },
      'cumulative-layout-shift': { numericValue: 0.05 },
      'interaction-to-next-paint': { numericValue: 180 },
    },
  },
};

describe('PageSpeed client', () => {
  it('calls the correct API URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPsiResponse),
    });
    await queryCWV('https://www.thehermeticflight.com/', { fetchFn: mockFetch });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('pagespeedonline.googleapis.com');
    expect(url).toContain(encodeURIComponent('https://www.thehermeticflight.com/'));
  });

  it('extracts LCP, CLS, INP, and performance score', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPsiResponse),
    });
    const result = await queryCWV('https://example.com', { fetchFn: mockFetch });
    expect(result.lcp).toBe(1200);
    expect(result.cls).toBe(0.05);
    expect(result.inp).toBe(180);
    expect(result.performance).toBe(92);
  });

  it('handles missing INP (returns null)', async () => {
    const noInp = structuredClone(mockPsiResponse);
    delete (noInp.lighthouseResult.audits as Record<string, unknown>)['interaction-to-next-paint'];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noInp),
    });
    const result = await queryCWV('https://example.com', { fetchFn: mockFetch });
    expect(result.inp).toBeNull();
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('Rate limited'),
    });
    await expect(queryCWV('https://example.com', { fetchFn: mockFetch }))
      .rejects.toThrow(/429/);
  });

  it('includes API key in URL when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPsiResponse),
    });
    await queryCWV('https://example.com', { apiKey: 'test-key', fetchFn: mockFetch });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('key=test-key');
  });
});
