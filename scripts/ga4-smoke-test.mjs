#!/usr/bin/env node
/**
 * GA4 Data API — Auth Smoke Test
 *
 * Validates the full authentication flow:
 *   1. Base64 decode service account key from .env
 *   2. Construct JWT (RS256)
 *   3. Exchange JWT for OAuth2 access token
 *   4. Make a minimal runReport call
 *   5. Report results or diagnostic errors
 *
 * Zero external dependencies — uses only Node.js built-in modules.
 *
 * Usage:
 *   node scripts/ga4-smoke-test.mjs
 *
 * Reads from .env:
 *   GA4_SERVICE_ACCOUNT_KEY  — base64-encoded service account JSON
 *   GA4_PROPERTY_ID          — numeric GA4 property ID (e.g. 123456789)
 */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Helpers ───────────────────────────────────────────────────────────────

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function loadEnvVar(envContent, name) {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function step(label) {
  process.stdout.write(`  ${label}... `);
}

function ok(detail = '') {
  console.log(`✓${detail ? ' ' + detail : ''}`);
}

function fail(detail) {
  console.log(`✗ ${detail}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

console.log('\n🔬 GA4 Data API — Auth Smoke Test\n');

// Step 1: Load .env
step('Loading .env');
let envContent;
try {
  envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  ok();
} catch (err) {
  fail('.env file not found');
  process.exit(1);
}

// Step 2: Extract variables
step('Reading GA4_SERVICE_ACCOUNT_KEY');
const b64Key = loadEnvVar(envContent, 'GA4_SERVICE_ACCOUNT_KEY');
if (!b64Key) {
  fail('not found in .env');
  process.exit(1);
}
ok(`(${b64Key.length} chars)`);

step('Reading GA4_PROPERTY_ID');
const propertyId = loadEnvVar(envContent, 'GA4_PROPERTY_ID');
if (!propertyId) {
  fail('not found in .env');
  process.exit(1);
}
if (propertyId.length > 12) {
  fail(`value "${propertyId}" looks wrong — GA4 property IDs are typically 9 digits. This might be a client_id.`);
  console.log('    Fix: Go to Analytics UI → Admin → Property Settings → copy the numeric PROPERTY ID');
  console.log('    Then update GA4_PROPERTY_ID in .env\n');
  // Continue anyway to test auth flow
}
ok(propertyId);

// Step 3: Decode service account key
step('Base64 decoding service account key');
let creds;
try {
  const json = Buffer.from(b64Key, 'base64').toString('utf8');
  creds = JSON.parse(json);
  ok();
} catch (err) {
  fail(`decode/parse error: ${err.message}`);
  process.exit(1);
}

// Step 4: Validate key structure
step('Validating key structure');
const requiredFields = ['type', 'project_id', 'private_key', 'client_email', 'token_uri'];
const missing = requiredFields.filter(f => !creds[f]);
if (missing.length > 0) {
  fail(`missing fields: ${missing.join(', ')}`);
  process.exit(1);
}
if (creds.type !== 'service_account') {
  fail(`type is "${creds.type}", expected "service_account"`);
  process.exit(1);
}
ok(`project=${creds.project_id}, email=${creds.client_email}`);

// Step 5: Construct JWT
step('Constructing JWT');
const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const now = Math.floor(Date.now() / 1000);
const claimSet = {
  iss: creds.client_email,
  scope: 'https://www.googleapis.com/auth/analytics.readonly',
  aud: creds.token_uri || 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
};
const claims = base64url(JSON.stringify(claimSet));
ok();

// Step 6: Sign JWT
step('Signing JWT (RS256)');
let jwt;
try {
  const sigInput = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(sigInput);
  const signature = signer.sign(creds.private_key, 'base64url');
  jwt = `${sigInput}.${signature}`;
  ok(`(${jwt.length} chars)`);
} catch (err) {
  fail(`signing error: ${err.message}`);
  console.log('    This usually means the private_key in the service account JSON is malformed.');
  process.exit(1);
}

// Step 7: Exchange JWT for access token
step('Exchanging JWT for access token');
const tokenUrl = creds.token_uri || 'https://oauth2.googleapis.com/token';
let accessToken;
try {
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    fail(`HTTP ${tokenRes.status}`);
    console.log(`    Error: ${tokenData.error} — ${tokenData.error_description}`);
    if (tokenData.error === 'invalid_grant') {
      console.log('    Common causes: clock skew, expired key, or wrong private key.');
    }
    process.exit(1);
  }

  accessToken = tokenData.access_token;
  ok(`expires_in=${tokenData.expires_in}s`);
} catch (err) {
  fail(`network error: ${err.message}`);
  process.exit(1);
}

// Step 8: Make a minimal runReport call
step(`Calling runReport on properties/${propertyId}`);
try {
  const reportRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 5,
        returnPropertyQuota: true,
      }),
    }
  );

  const reportData = await reportRes.json();

  if (!reportRes.ok) {
    fail(`HTTP ${reportRes.status}`);
    console.log(`    Error: ${JSON.stringify(reportData.error?.message || reportData.error || reportData, null, 2)}`);

    if (reportRes.status === 403) {
      console.log('    Fix: Add the service account email to your GA4 property:');
      console.log(`         ${creds.client_email}`);
      console.log('         Analytics UI → Admin → Property → Property Access Management → Add users → Viewer role');
    } else if (reportRes.status === 400) {
      console.log('    Fix: Check GA4_PROPERTY_ID — it must be the numeric property ID from Analytics UI.');
    }
    process.exit(1);
  }

  ok();

  // Step 9: Display results
  console.log('\n  📊 Report Results:\n');
  console.log(`     Rows returned: ${reportData.rows?.length ?? 0}`);
  console.log(`     Total rows:    ${reportData.rowCount ?? 'N/A'}`);

  if (reportData.rows?.length > 0) {
    console.log('\n     Country              Active Users');
    console.log('     ───────────────────  ────────────');
    for (const row of reportData.rows) {
      const country = row.dimensionValues[0].value.padEnd(19);
      const users = row.metricValues[0].value;
      console.log(`     ${country}  ${users}`);
    }
  }

  if (reportData.propertyQuota) {
    const q = reportData.propertyQuota;
    console.log('\n  📉 Quota Status:');
    console.log(`     Tokens/day:  ${q.tokensPerDay?.remaining ?? '?'} remaining`);
    console.log(`     Tokens/hour: ${q.tokensPerHour?.remaining ?? '?'} remaining`);
    console.log(`     Concurrent:  ${q.concurrentRequests?.remaining ?? '?'} remaining`);
  }

  if (reportData.metadata) {
    const m = reportData.metadata;
    console.log(`\n  🌐 Property: timezone=${m.timeZone}, currency=${m.currencyCode}`);
  }

} catch (err) {
  fail(`network error: ${err.message}`);
  process.exit(1);
}

console.log('\n  ✅ All checks passed — GA4 Data API auth is working.\n');
