/** A metric query configuration */
export interface MetricQuery {
  /** Unique identifier for this metric (e.g., 'quiz_start_rate') */
  id: string;
  /** Human-readable description */
  label: string;
  /** Source system: 'ga4' | 'pagespeed' */
  source: 'ga4' | 'pagespeed';
}

/** A single metric measurement */
export interface MetricSnapshot {
  metricId: string;
  timestamp: string; // ISO 8601
  value: number;
  metadata?: Record<string, string | number>;
}

/** GA4 query parameters */
export interface GA4QueryConfig {
  propertyId: string;
  metrics: string[];      // e.g., ['eventCount']
  dimensions?: string[];  // e.g., ['eventName']
  dateRange: { startDate: string; endDate: string };
  dimensionFilter?: {
    fieldName: string;
    stringFilter: { matchType: 'EXACT'; value: string };
  };
}

/** GA4 API response row */
export interface GA4Row {
  dimensionValues?: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

/** PageSpeed CWV result */
export interface CWVResult {
  url: string;
  lcp: number;        // Largest Contentful Paint (ms)
  cls: number;        // Cumulative Layout Shift (score)
  inp: number | null; // Interaction to Next Paint (ms), null if no data
  performance: number; // Lighthouse performance score 0-100
  fetchedAt: string;   // ISO 8601
}

/** GA4 client configuration */
export interface GA4ClientConfig {
  serviceAccountEmail: string;
  privateKey: string;   // PEM format
  propertyId: string;
  fetchFn?: typeof fetch; // Injectable for tests
}
