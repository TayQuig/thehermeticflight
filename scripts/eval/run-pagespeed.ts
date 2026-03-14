#!/usr/bin/env npx tsx
/**
 * PageSpeed Insights CLI
 *
 * Queries the PageSpeed Insights API for Core Web Vitals on a given URL.
 * Works unauthenticated (lower quota) or with API key via PAGESPEED_API_KEY env var.
 *
 * Usage:
 *   npx tsx scripts/eval/run-pagespeed.ts --url https://www.thehermeticflight.com/
 *   PAGESPEED_API_KEY=abc123 npx tsx scripts/eval/run-pagespeed.ts --url https://example.com
 */

import { queryCWV } from '../../src/lib/eval/pagespeed';
import { writeSnapshot } from '../../src/lib/eval/storage';

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2);
      result[key] = args[i + 1];
      i++;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = args['url'];

  if (!url) {
    console.error('Error: --url is required');
    console.error('Usage: npx tsx scripts/eval/run-pagespeed.ts --url <url>');
    process.exit(1);
  }

  const apiKey = process.env['PAGESPEED_API_KEY'];

  console.log(`Querying PageSpeed Insights for: ${url}`);
  if (apiKey) {
    console.log('Using API key from PAGESPEED_API_KEY env var');
  } else {
    console.log('No PAGESPEED_API_KEY — using unauthenticated (25 req/day quota)');
  }

  const result = await queryCWV(url, { apiKey });

  console.log('\nCore Web Vitals:');
  console.log(`  LCP:         ${result.lcp} ms`);
  console.log(`  CLS:         ${result.cls}`);
  console.log(`  INP:         ${result.inp !== null ? `${result.inp} ms` : 'no data'}`);
  console.log(`  Performance: ${result.performance}/100`);
  console.log(`  Fetched at:  ${result.fetchedAt}`);

  // Persist snapshots for each metric
  const ts = result.fetchedAt;
  writeSnapshot({ metricId: 'lcp', timestamp: ts, value: result.lcp, metadata: { url } });
  writeSnapshot({ metricId: 'cls', timestamp: ts, value: result.cls, metadata: { url } });
  writeSnapshot({ metricId: 'performance', timestamp: ts, value: result.performance, metadata: { url } });
  if (result.inp !== null) {
    writeSnapshot({ metricId: 'inp', timestamp: ts, value: result.inp, metadata: { url } });
  }

  console.log('\nSnapshots written to data/eval/snapshots.json');
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
