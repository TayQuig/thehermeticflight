import { createSign } from 'node:crypto';
import type { GA4ClientConfig, GA4QueryConfig, GA4Row } from './types';

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Obtain an OAuth2 access token using a service account JWT (RS256).
 * Only called when fetchFn is NOT provided (i.e., in production use).
 */
async function getAccessToken(
  serviceAccountEmail: string,
  privateKey: string,
): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: TOKEN_URI,
    iat: now,
    exp: now + 3600,
  };
  const claims = base64url(JSON.stringify(claimSet));
  const sigInput = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(sigInput);
  const signature = signer.sign(privateKey, 'base64url');
  const jwt = `${sigInput}.${signature}`;

  const tokenRes = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
  }

  const data = await tokenRes.json() as { access_token: string };
  return data.access_token;
}

/**
 * Query the GA4 Data API v1beta runReport endpoint.
 *
 * When config.fetchFn is provided, it is used directly (no JWT signing).
 * This allows tests to inject a mock fetch without needing real credentials.
 */
export async function queryGA4(
  config: GA4ClientConfig,
  query: GA4QueryConfig,
): Promise<GA4Row[]> {
  const propertyId = config.propertyId ?? query.propertyId;
  const url = `${GA4_API_BASE}/properties/${propertyId}:runReport`;

  const body = {
    dateRanges: [{ startDate: query.dateRange.startDate, endDate: query.dateRange.endDate }],
    metrics: query.metrics.map(m => ({ name: m })),
    ...(query.dimensions ? { dimensions: query.dimensions.map(d => ({ name: d })) } : {}),
    ...(query.dimensionFilter ? { dimensionFilter: { filter: query.dimensionFilter } } : {}),
  };

  let fetchFn: typeof fetch;
  let authHeader: string;

  if (config.fetchFn) {
    // Test mode: use injected fetch, no auth needed
    fetchFn = config.fetchFn;
    authHeader = 'Bearer mock-token';
  } else {
    // Production mode: obtain real OAuth2 token via JWT
    fetchFn = fetch;
    const accessToken = await getAccessToken(config.serviceAccountEmail, config.privateKey);
    authHeader = `Bearer ${accessToken}`;
  }

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API error: ${res.status} ${res.statusText} — ${text}`);
  }

  const data = await res.json() as { rows?: GA4Row[] };
  return data.rows ?? [];
}
