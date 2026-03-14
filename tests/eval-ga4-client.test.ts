/**
 * GA4 Query Client — Unit Tests
 *
 * Frozen-test-file protocol: TEST CONTRACT.
 * Module under test: src/lib/eval/ga4-client.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { queryGA4 } from '../src/lib/eval/ga4-client';
import type { GA4ClientConfig, GA4QueryConfig } from '../src/lib/eval/types';

const mockConfig: GA4ClientConfig = {
  serviceAccountEmail: 'test@test.iam.gserviceaccount.com',
  privateKey: 'MOCK_KEY',
  propertyId: '514560510',
  fetchFn: vi.fn(),
};

const mockQuery: GA4QueryConfig = {
  propertyId: '514560510',
  metrics: ['eventCount'],
  dimensions: ['eventName'],
  dateRange: { startDate: '2026-03-01', endDate: '2026-03-14' },
};

describe('GA4 client', () => {
  it('calls the correct API endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    });
    await queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery);
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('analyticsdata.googleapis.com');
    expect(url).toContain('514560510');
  });

  it('parses rows from a successful response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [
          { dimensionValues: [{ value: 'quiz_started' }], metricValues: [{ value: '150' }] },
          { dimensionValues: [{ value: 'share' }], metricValues: [{ value: '42' }] },
        ],
      }),
    });
    const rows = await queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery);
    expect(rows).toHaveLength(2);
    expect(rows[0].metricValues[0].value).toBe('150');
  });

  it('returns empty array when response has no rows', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const rows = await queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery);
    expect(rows).toEqual([]);
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Access denied'),
    });
    await expect(queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery))
      .rejects.toThrow(/403/);
  });

  it('throws on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery))
      .rejects.toThrow('Network error');
  });
});
