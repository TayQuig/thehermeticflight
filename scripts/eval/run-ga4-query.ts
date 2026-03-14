#!/usr/bin/env npx tsx
/**
 * GA4 Data API CLI
 *
 * Queries the GA4 Data API for event metrics. Requires service account credentials
 * in environment variables (base64-encoded JSON key).
 *
 * Usage:
 *   GA4_SERVICE_ACCOUNT_KEY=<base64> GA4_PROPERTY_ID=514560510 \
 *     npx tsx scripts/eval/run-ga4-query.ts
 *
 * Environment variables:
 *   GA4_SERVICE_ACCOUNT_KEY  — base64-encoded service account JSON
 *   GA4_PROPERTY_ID          — numeric GA4 property ID
 *   GA4_METRIC               — metric name (default: eventCount)
 *   GA4_DIMENSION            — dimension name (default: eventName)
 *   GA4_START_DATE           — start date (default: 7daysAgo)
 *   GA4_END_DATE             — end date (default: today)
 */

import { queryGA4 } from '../../src/lib/eval/ga4-client';
import { writeSnapshot } from '../../src/lib/eval/storage';
import type { GA4QueryConfig } from '../../src/lib/eval/types';

async function main(): Promise<void> {
  const b64Key = process.env['GA4_SERVICE_ACCOUNT_KEY'];
  const propertyId = process.env['GA4_PROPERTY_ID'];

  if (!b64Key || !propertyId) {
    console.error('GA4 credentials not configured.');
    console.error('');
    console.error('Required environment variables:');
    console.error('  GA4_SERVICE_ACCOUNT_KEY  — base64-encoded service account JSON');
    console.error('  GA4_PROPERTY_ID          — numeric GA4 property ID (e.g. 514560510)');
    console.error('');
    console.error('To get credentials:');
    console.error('  1. Go to Google Cloud Console → IAM & Admin → Service Accounts');
    console.error('  2. Create or select a service account with GA4 Viewer role');
    console.error('  3. Download JSON key, then: base64 key.json');
    console.error('  4. Add to .env: GA4_SERVICE_ACCOUNT_KEY=<base64 output>');
    process.exit(1);
  }

  // Decode and parse service account credentials
  let creds: { client_email: string; private_key: string };
  try {
    const json = Buffer.from(b64Key, 'base64').toString('utf8');
    creds = JSON.parse(json) as { client_email: string; private_key: string };
  } catch (err) {
    console.error(`Error: Failed to decode GA4_SERVICE_ACCOUNT_KEY — ${(err as Error).message}`);
    console.error('Ensure the value is valid base64-encoded JSON.');
    process.exit(1);
  }

  if (!creds.client_email || !creds.private_key) {
    console.error('Error: Service account JSON is missing client_email or private_key fields.');
    process.exit(1);
  }

  const metric = process.env['GA4_METRIC'] ?? 'eventCount';
  const dimension = process.env['GA4_DIMENSION'] ?? 'eventName';
  const startDate = process.env['GA4_START_DATE'] ?? '7daysAgo';
  const endDate = process.env['GA4_END_DATE'] ?? 'today';

  const query: GA4QueryConfig = {
    propertyId,
    metrics: [metric],
    dimensions: [dimension],
    dateRange: { startDate, endDate },
  };

  console.log(`Querying GA4 property ${propertyId}`);
  console.log(`  Metric:     ${metric}`);
  console.log(`  Dimension:  ${dimension}`);
  console.log(`  Date range: ${startDate} to ${endDate}`);
  console.log('');

  const rows = await queryGA4(
    {
      serviceAccountEmail: creds.client_email,
      privateKey: creds.private_key,
      propertyId,
    },
    query,
  );

  if (rows.length === 0) {
    console.log('No data returned for the specified query.');
    process.exit(0);
  }

  console.log(`Results (${rows.length} rows):`);
  console.log('');

  const ts = new Date().toISOString();
  for (const row of rows) {
    const dimValue = row.dimensionValues?.[0]?.value ?? '(none)';
    const metricValue = row.metricValues[0]?.value ?? '0';
    console.log(`  ${dimValue.padEnd(40)} ${metricValue}`);

    writeSnapshot({
      metricId: `ga4.${metric}.${dimValue}`,
      timestamp: ts,
      value: Number(metricValue),
      metadata: { propertyId, metric, dimension: dimValue },
    });
  }

  console.log('');
  console.log('Snapshots written to data/eval/snapshots.json');
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
