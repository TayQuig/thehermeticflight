import type { CWVResult } from './types';

const PSI_API_BASE = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';

export interface PageSpeedConfig {
  apiKey?: string;   // Optional — unauthenticated requests have lower quota
  fetchFn?: typeof fetch;
}

/**
 * Query the PageSpeed Insights API for Core Web Vitals data.
 *
 * Uses the Lighthouse audit results embedded in the PSI response.
 * INP is returned as null if no data is available.
 */
export async function queryCWV(
  url: string,
  config?: PageSpeedConfig,
): Promise<CWVResult> {
  const params = new URLSearchParams({
    url,
    strategy: 'mobile',
    category: 'performance',
  });

  if (config?.apiKey) {
    params.set('key', config.apiKey);
  }

  const apiUrl = `${PSI_API_BASE}?${params.toString()}`;
  const fetchFn = config?.fetchFn ?? fetch;

  const res = await fetchFn(apiUrl);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed API error: ${res.status} ${res.statusText} — ${text}`);
  }

  const data = await res.json() as {
    lighthouseResult: {
      categories: {
        performance: { score: number };
      };
      audits: {
        'largest-contentful-paint'?: { numericValue: number };
        'cumulative-layout-shift'?: { numericValue: number };
        'interaction-to-next-paint'?: { numericValue: number };
      };
    };
  };

  const audits = data.lighthouseResult.audits;
  const perfScore = data.lighthouseResult.categories.performance.score;

  const inpAudit = audits['interaction-to-next-paint'];

  return {
    url,
    lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
    cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
    inp: inpAudit !== undefined ? inpAudit.numericValue : null,
    performance: Math.round(perfScore * 100),
    fetchedAt: new Date().toISOString(),
  };
}
