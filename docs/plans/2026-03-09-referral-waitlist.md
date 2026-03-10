# Referral Waitlist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **For Task 6:** REQUIRED PROTOCOL: Use frozen-test-file for TDD tasks. Opus writes tests (test author), Sonnet implements (implementer). Run `record-baseline.sh` after test authorship, `verify-frozen.sh` after implementation.
> **Post-implementation:** REQUIRED PROTOCOL: Run `/harden` (evaluation-protocol + frozen-test-file remediation) after Tasks 1-6 complete. See Task 7 below.

**Goal:** Implement viral referral mechanics: unique referral link after quiz completion, `/waitlist` status page showing position and referral count, Supabase backend for tracking, Loops.so event integration.

**Architecture:** Supabase PostgreSQL backend with two tables (waitlist, referrals). Vercel serverless API routes for all mutations (server-side only, service_role key). Client-side waitlist status page reads via API. Referral codes generated as nanoid. Reward tiers deferred — core tracking mechanics first.

**Tech Stack:** Supabase JS client (@supabase/supabase-js), Astro 5, Vercel serverless, Loops.so events/send, Vitest, Playwright

**Research artifacts:**
- `operations/supabase-js-reference.md` — JS client API + table schemas + RLS notes
- `operations/loops-api-reference.md` — events/send endpoint for referral events

---

## Operator Tasks — REQUIRED BEFORE BUILD

Complete all five of these before any implementation begins. None of Tasks 1-6 can be tested end-to-end without them.

**1. Create Supabase project (free tier)**
- Go to https://supabase.com, create a new project
- Free tier: 500 MB database, 50K monthly active users — sufficient for pre-launch
- Note: project URL and service role key from Project Settings → API

**2. Run table DDL — `waitlist` table**

```sql
-- One row per subscriber. referral_code is their unique shareable token.
CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referral_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — all access is via service_role key (bypasses RLS).
-- RLS enabled as defense-in-depth: prevents accidental anon key exposure.
```

**3. Run table DDL — `referrals` table**

```sql
-- One row per successful referral event.
-- referred_email UNIQUE constraint prevents one person being referred twice.
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code TEXT NOT NULL REFERENCES waitlist(referral_code),
  referrer_email TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_email)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — all access is via service_role key.
```

**4. Create `increment_referral_count` RPC function**

```sql
-- Atomic counter increment — avoids read-modify-write race condition.
-- Called via: await supabase.rpc('increment_referral_count', { ref_code })
CREATE OR REPLACE FUNCTION increment_referral_count(ref_code TEXT)
RETURNS void AS $$
  UPDATE waitlist
  SET referral_count = referral_count + 1
  WHERE referral_code = ref_code;
$$ LANGUAGE sql;
```

**5. Add env vars to `.env`**

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # from Project Settings → API → service_role
```

---

## Security Architecture

All Supabase operations run server-side via Vercel serverless functions using `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses RLS. It must **never** be exposed client-side, in Astro frontmatter, or in any import that could end up in the browser bundle.

The `waitlist.astro` status page fetches data by calling the `/api/waitlist/status` route — it never imports or references `SUPABASE_SERVICE_ROLE_KEY` directly.

The `SUPABASE_URL` is technically not a secret but treat it consistently — keep it server-side too, only referenced via `import.meta.env` inside API routes.

---

## Referral Flow

1. User completes quiz → submits email → `quiz-submit.ts` runs server-side classification + Loops.so event
2. `quiz-submit.ts` auto-calls `waitlist/join` → generates nanoid referral code → inserts into `waitlist` table → returns referral code in API response
3. `quiz.astro` receives `{ success: true, archetype, referralCode }` → stores referral code in a JS variable → renders "Your Referral Link" section in `#email-success`
4. User shares link: `https://www.thehermeticflight.com/quiz?ref=XXXX`
5. New visitor arrives via `?ref=XXXX` → `quiz.astro` reads `ref` param on page load → stores in JS state → passes to `quiz-submit` payload
6. `quiz-submit.ts` sees `referralCode` in body → after successful waitlist join for the new user → calls `waitlist/refer` → records referral → increments referrer's count → fires Loops.so events
7. User can visit `/waitlist?email=xxx` at any time to see position and referral count

---

## Task 1: Install @supabase/supabase-js and Create Supabase Client Module

**Files:**
- Run: `npm install @supabase/supabase-js`
- Create: `src/lib/supabase.ts`
- Modify: `src/env.d.ts`

### Step 1.1 — Install dependency

```bash
npm install @supabase/supabase-js
```

Verify `@supabase/supabase-js` appears in `package.json` `dependencies`.

### Step 1.2 — Update `src/env.d.ts`

Current contents of `src/env.d.ts`:
```typescript
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Replace with:
```typescript
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Step 1.3 — Create `src/lib/supabase.ts`

```typescript
// src/lib/supabase.ts
//
// Server-side Supabase client — service_role key only.
//
// SECURITY: This module must ONLY be imported by Vercel serverless API routes
// (src/pages/api/**/*.ts). Never import it from .astro frontmatter, client
// scripts, or any module that could end up in the browser bundle.
//
// The service_role key bypasses RLS. RLS is enabled on both tables as a
// defense-in-depth safety net in case this key is ever accidentally exposed.

import { createClient } from '@supabase/supabase-js';

// createSupabaseClient() creates a fresh client per call.
// In Vercel serverless, this is called once per cold start (effectively cached
// at module scope via the exported singleton below).

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // This error fires at module load time during server-side execution.
  // It will NOT appear in the browser — only in Vercel function logs.
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // Disable auto-refresh and session storage — not needed for server-side
    // service_role usage. Eliminates unnecessary background work.
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

### Step 1.4 — Verify TypeScript compilation

```bash
npx tsc --noEmit
```

Expected: No errors. If `@supabase/supabase-js` types are missing, run `npm install` again.

### Step 1.5 — Commit

```
git add src/lib/supabase.ts src/env.d.ts package.json package-lock.json
git commit -m "feat: add @supabase/supabase-js, server-side client module, env type declarations"
```

---

## Task 2: Create Waitlist API Routes

**Files:**
- Create: `src/pages/api/waitlist/join.ts`
- Create: `src/pages/api/waitlist/status.ts`
- Create: `src/pages/api/waitlist/refer.ts`

All three routes follow the same structural pattern as `src/pages/api/quiz-submit.ts`:
- `export const prerender = false`
- `export const POST: APIRoute` (or `GET: APIRoute` for status)
- WeakMap-on-fetch rate limiting where applicable
- Returns `{ success: true, data }` or `{ error: "message" }`

### Task 2A: `src/pages/api/waitlist/join.ts`

**Purpose:** Add an email to the waitlist. Generates a unique referral code via nanoid. Idempotent — if the email already exists, returns the existing referral code without error.

**TDD Step 1 — Write failing test.** (Test file written in Task 6 — do not implement until tests exist.)

**TDD Step 2 — Verify test fails.**
```bash
npx vitest run tests/waitlist-join.test.ts
```
Expected: test file not found (Task 6 writes it first).

**TDD Step 3 — Implement.**

```typescript
// src/pages/api/waitlist/join.ts

export const prerender = false;

import type { APIRoute } from 'astro';
import { nanoid } from 'nanoid';
import { supabase } from '../../../lib/supabase';

// ---------------------------------------------------------------------------
// Rate limiting (same WeakMap-on-fetch pattern as quiz-submit.ts)
// ---------------------------------------------------------------------------

interface RateLimitEntry { count: number }
interface RateLimiterBuckets {
  global: RateLimitEntry;
  perEmail: Map<string, RateLimitEntry>;
}

const GLOBAL_LIMIT = 20;
const EMAIL_LIMIT = 5;
const rateLimiterRegistry = new WeakMap<Function, RateLimiterBuckets>();

function getBuckets(fetchFn: Function): RateLimiterBuckets {
  if (!rateLimiterRegistry.has(fetchFn)) {
    rateLimiterRegistry.set(fetchFn, {
      global: { count: 0 },
      perEmail: new Map(),
    });
  }
  return rateLimiterRegistry.get(fetchFn)!;
}

function checkGlobalRateLimit(buckets: RateLimiterBuckets): boolean {
  buckets.global.count += 1;
  return buckets.global.count > GLOBAL_LIMIT;
}

function checkEmailRateLimit(buckets: RateLimiterBuckets, email: string): boolean {
  const entry = buckets.perEmail.get(email);
  if (!entry) {
    buckets.perEmail.set(email, { count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > EMAIL_LIMIT;
}

// ---------------------------------------------------------------------------
// Email validation (mirrors quiz-submit.ts)
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOUBLE_DOT_REGEX = /\.\./;
const MULTIPLE_AT_REGEX = /@.*@/;
const MAX_EMAIL_LENGTH = 254;

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string') return 'Valid email required';
  if (email.length > MAX_EMAIL_LENGTH) return 'Email too long';
  if (MULTIPLE_AT_REGEX.test(email)) return 'Invalid email format';
  if (DOUBLE_DOT_REGEX.test(email)) return 'Invalid email format';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email format';
  return null;
}

// ---------------------------------------------------------------------------
// Loops.so helper — fire-and-forget waitlist_joined event
// ---------------------------------------------------------------------------

async function sendLoopsWaitlistJoined(email: string, referralCode: string): Promise<void> {
  const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
  if (!LOOPS_API_KEY) return;

  const today = new Date().toISOString().split('T')[0];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `waitlist_joined_${email.toLowerCase()}_${today}`,
      },
      body: JSON.stringify({
        email,
        eventName: 'waitlist_joined',
        eventProperties: { referralCode },
      }),
    });
  } catch {
    // Fire-and-forget: Loops.so failure must not block the join response
    console.error('Loops.so waitlist_joined event failed for', email);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    const emailError = validateEmail(email);
    if (emailError) {
      return new Response(
        JSON.stringify({ error: emailError }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const currentFetch = globalThis.fetch as unknown as Function;
    const buckets = getBuckets(currentFetch);

    if (checkGlobalRateLimit(buckets)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests — please try again later' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (checkEmailRateLimit(buckets, email)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests from this email — please try again later' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Check if email already on waitlist — idempotent join
    const { data: existing } = await supabase
      .from('waitlist')
      .select('referral_code')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, referralCode: existing.referral_code, isNew: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // New subscriber — generate referral code and insert
    // nanoid(10): 10 chars from URL-safe alphabet, ~1 billion combinations.
    // Collision probability is negligible at pre-launch scale (<10K users).
    const referralCode = nanoid(10);

    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({ email: email.toLowerCase(), referral_code: referralCode });

    if (insertError) {
      // Unique constraint violation on email — race condition, treat as idempotent
      if (insertError.code === '23505') {
        const { data: retryExisting } = await supabase
          .from('waitlist')
          .select('referral_code')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        if (retryExisting) {
          return new Response(
            JSON.stringify({ success: true, referralCode: retryExisting.referral_code, isNew: false }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
      console.error('Supabase insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to join waitlist' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Fire Loops.so event (non-blocking)
    void sendLoopsWaitlistJoined(email, referralCode);

    return new Response(
      JSON.stringify({ success: true, referralCode, isNew: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('waitlist/join error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
```

### Task 2B: `src/pages/api/waitlist/status.ts`

**Purpose:** GET endpoint. Lookup by email or referral code. Returns referral_code, referral_count, and position (rank in waitlist by `created_at`).

**Position calculation:** `SELECT COUNT(*) FROM waitlist WHERE created_at < $user_created_at` gives zero-based rank. Add 1 for 1-based display. Returns position 1 for the first person ever.

```typescript
// src/pages/api/waitlist/status.ts

export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFERRAL_CODE_REGEX = /^[A-Za-z0-9_-]{10}$/; // nanoid(10) URL-safe alphabet

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const refCode = url.searchParams.get('ref');

    // Must supply exactly one lookup key
    if (!email && !refCode) {
      return new Response(
        JSON.stringify({ error: 'Provide email or ref query parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate whichever param was provided
    if (email && !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (refCode && !REFERRAL_CODE_REGEX.test(refCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral code format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Look up the waitlist entry
    let query = supabase
      .from('waitlist')
      .select('email, referral_code, referral_count, created_at');

    if (email) {
      query = query.eq('email', email.toLowerCase());
    } else {
      query = query.eq('referral_code', refCode!);
    }

    const { data: entry, error: lookupError } = await query.maybeSingle();

    if (lookupError) {
      console.error('Supabase status lookup error:', lookupError);
      return new Response(
        JSON.stringify({ error: 'Lookup failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!entry) {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Calculate position: COUNT of entries with earlier created_at + 1
    const { count: precedingCount, error: countError } = await supabase
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', entry.created_at);

    if (countError) {
      console.error('Supabase position count error:', countError);
      return new Response(
        JSON.stringify({ error: 'Position calculation failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const position = (precedingCount ?? 0) + 1;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          email: entry.email,
          referralCode: entry.referral_code,
          referralCount: entry.referral_count,
          position,
          referralLink: `https://www.thehermeticflight.com/quiz?ref=${entry.referral_code}`,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('waitlist/status error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
```

### Task 2C: `src/pages/api/waitlist/refer.ts`

**Purpose:** POST endpoint. Called internally by `quiz-submit.ts` when a new quiz completer arrived via a referral link. Records the referral and atomically increments the referrer's count.

**Security invariants enforced here:**
- Referral code must exist (FK constraint + explicit check)
- Self-referral rejected: `referrer_email !== referred_email`
- Duplicate referral rejected: `UNIQUE(referred_email)` on referrals table + graceful handling
- Both emails must pass format validation

```typescript
// src/pages/api/waitlist/refer.ts

export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFERRAL_CODE_REGEX = /^[A-Za-z0-9_-]{10}$/;
const MAX_EMAIL_LENGTH = 254;

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string') return 'Valid email required';
  if (email.length > MAX_EMAIL_LENGTH) return 'Email too long';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email format';
  return null;
}

// ---------------------------------------------------------------------------
// Loops.so helpers — referral events
// ---------------------------------------------------------------------------

async function sendLoopsReferralEvent(
  email: string,
  eventName: string,
  eventProperties: Record<string, unknown>,
  idempotencyKey: string,
): Promise<void> {
  const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
  if (!LOOPS_API_KEY) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    await fetch('https://app.loops.so/api/v1/events/send', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ email, eventName, eventProperties }),
    });
  } catch {
    console.error(`Loops.so ${eventName} event failed for`, email);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { referralCode, referredEmail } = body;

    // Validate referral code format
    if (typeof referralCode !== 'string' || !REFERRAL_CODE_REGEX.test(referralCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const referredEmailError = validateEmail(referredEmail);
    if (referredEmailError) {
      return new Response(
        JSON.stringify({ error: `referred_email: ${referredEmailError}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Look up the referrer by referral code
    const { data: referrer, error: referrerLookupError } = await supabase
      .from('waitlist')
      .select('email, referral_code')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (referrerLookupError) {
      console.error('Supabase referrer lookup error:', referrerLookupError);
      return new Response(
        JSON.stringify({ error: 'Referral lookup failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!referrer) {
      return new Response(
        JSON.stringify({ error: 'Referral code not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Self-referral prevention
    if (referrer.email === referredEmail.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Cannot refer yourself' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Insert referral record
    // UNIQUE(referred_email) constraint on the table prevents duplicate referrals.
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referral_code: referralCode,
        referrer_email: referrer.email,
        referred_email: referredEmail.toLowerCase(),
      });

    if (insertError) {
      // 23505 = unique_violation — this person was already referred (by anyone)
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ success: true, alreadyReferred: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      console.error('Supabase referral insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record referral' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Atomic counter increment via RPC — no read-modify-write race condition
    const { error: rpcError } = await supabase.rpc('increment_referral_count', {
      ref_code: referralCode,
    });

    if (rpcError) {
      // Non-fatal: referral was recorded, count increment failed.
      // Log for investigation but return success to avoid blocking the user.
      console.error('increment_referral_count RPC error:', rpcError);
    }

    const today = new Date().toISOString().split('T')[0];

    // Fire Loops.so events for both parties (non-blocking, fire-and-forget)
    void sendLoopsReferralEvent(
      referrer.email,
      'referral_made',
      { referredEmail: referredEmail.toLowerCase(), referralCode },
      `referral_made_${referrer.email}_${referredEmail.toLowerCase()}_${today}`,
    );
    void sendLoopsReferralEvent(
      referredEmail.toLowerCase(),
      'referred_signup',
      { referrerEmail: referrer.email, referralCode },
      `referred_signup_${referredEmail.toLowerCase()}_${today}`,
    );

    return new Response(
      JSON.stringify({ success: true, alreadyReferred: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('waitlist/refer error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
```

### Step 2.4 — Commit

```bash
git add src/pages/api/waitlist/
git commit -m "feat: add waitlist API routes — join, status, refer"
```

---

## Task 3: Modify Quiz Submission Flow for Referrals

**Files:**
- Modify: `src/pages/quiz.astro`
- Modify: `src/pages/api/quiz-submit.ts`

### Step 3.1 — Read `?ref` param on quiz page load and pass to API

In `src/pages/quiz.astro`, in the `<script>` block, locate the `state` object definition (around line 209):

```typescript
const state = {
  currentStep: 0,
  answers: {} as Record<string, string>,
  startTime: Date.now(),
};
```

Replace with:

```typescript
// Read referral code from URL on page load (e.g. /quiz?ref=XXXXXXXXXX)
// Stored in state so it survives multi-step navigation and is sent with the
// email form submission. Referral attribution is server-side only.
const refParam = new URLSearchParams(window.location.search).get('ref') ?? '';

const state = {
  currentStep: 0,
  answers: {} as Record<string, string>,
  startTime: Date.now(),
  referralCode: refParam,
};
```

### Step 3.2 — Pass `referralCode` in the fetch body

In `src/pages/quiz.astro`, locate the `fetch('/api/quiz-submit', ...)` call (around line 378). The current body JSON is:

```typescript
body: JSON.stringify({
  email,
  firstName,
  answers: state.answers,
}),
```

Replace with:

```typescript
body: JSON.stringify({
  email,
  firstName,
  answers: state.answers,
  ...(state.referralCode ? { referralCode: state.referralCode } : {}),
}),
```

### Step 3.3 — Store referral code from API response in quiz.astro

The `quiz-submit` API will now return `referralCode` in its response. In the `if (res.ok)` block (around line 388), after the existing `const data = ...` (or after `res.ok` is confirmed), parse the response data and store `referralCode`:

Locate:
```typescript
if (res.ok) {
  emailSection.style.display = 'none';
  emailSuccess.classList.remove('hidden');
```

Replace with:
```typescript
if (res.ok) {
  const data = await res.json() as { success: boolean; archetype: string; referralCode?: string };
  emailSection.style.display = 'none';
  emailSuccess.classList.remove('hidden');

  // Store referral code returned by the API for the referral link display below
  const myReferralCode = data.referralCode ?? '';
```

Then after the existing share-link population block (after the `shareCopy.addEventListener` and tracking code, around line 430), add the referral link section population:

```typescript
  // Populate referral link section (only if we have a code)
  const referralLinkSection = document.getElementById('referral-link-section');
  const referralLinkInput = document.getElementById('referral-link-input') as HTMLInputElement | null;
  const referralLinkCopyBtn = document.getElementById('referral-link-copy-btn');
  const referralLinkCopyText = document.getElementById('referral-link-copy-text');

  if (referralLinkSection && myReferralCode) {
    const fullReferralLink = `https://www.thehermeticflight.com/quiz?ref=${myReferralCode}`;
    if (referralLinkInput) referralLinkInput.value = fullReferralLink;
    referralLinkSection.classList.remove('hidden');

    referralLinkCopyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(fullReferralLink);
        if (referralLinkCopyText) referralLinkCopyText.textContent = 'Copied!';
      } catch {
        if (referralLinkCopyText) referralLinkCopyText.textContent = 'Copy failed';
      }
      setTimeout(() => {
        if (referralLinkCopyText) referralLinkCopyText.textContent = 'Copy Link';
      }, 2000);
    });
  }
```

### Step 3.4 — Add referral link HTML section to `#email-success`

In `src/pages/quiz.astro`, locate `#email-success` div. After the closing `</div>` of `#share-section` (around line 184), before the "Return Home" anchor, add:

```html
<!-- Referral Link (hidden until API returns a code) -->
<div id="referral-link-section" class="hidden border-t border-hermetic-gold/20 pt-6 mt-6">
  <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2">Your Referral Link</p>
  <p class="text-gray-400 font-sans text-sm mb-4">Share this link — every person who joins through it moves you up the waitlist.</p>
  <div class="flex items-center gap-2 max-w-sm mx-auto">
    <input
      id="referral-link-input"
      type="text"
      readonly
      class="flex-1 p-2 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-gold/80 font-sans text-xs focus:outline-none truncate"
    />
    <button
      id="referral-link-copy-btn"
      class="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-xs font-sans"
    >
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      <span id="referral-link-copy-text">Copy Link</span>
    </button>
  </div>
  <a href="/waitlist" class="block mt-3 text-hermetic-gold/40 hover:text-hermetic-gold/70 text-xs font-sans tracking-wider transition-colors">
    Check your waitlist position →
  </a>
</div>
```

### Step 3.5 — Modify `quiz-submit.ts` to call `waitlist/join` and optionally `waitlist/refer`

In `src/pages/api/quiz-submit.ts`, after the successful Loops.so event (after the `if (!loopsData.success)` check, before the final `return new Response`), add the waitlist integration block:

Locate the existing final return (line 394):
```typescript
return new Response(JSON.stringify({ success: true, archetype }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});
```

Replace with:
```typescript
    // ---------------------------------------------------------------------------
    // Waitlist integration — auto-join and optional referral recording
    //
    // Both operations are fire-and-forget from the user's perspective:
    //   - waitlist/join is always called (idempotent — safe to re-call on retry)
    //   - waitlist/refer is called only when a referralCode was provided
    //
    // Internal fetch uses the same serverless host to avoid external network hop.
    // We await join() to get the referralCode for the success response, but
    // refer() is non-blocking.
    // ---------------------------------------------------------------------------

    const { referralCode: incomingReferralCode } = body as { referralCode?: string };
    let outgoingReferralCode: string | undefined;

    try {
      const joinRes = await fetch(new URL('/api/waitlist/join', request.url).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (joinRes.ok) {
        const joinData = await joinRes.json() as { success: boolean; referralCode?: string };
        outgoingReferralCode = joinData.referralCode;
      }
    } catch (joinError) {
      // Non-fatal — waitlist join failure must not block quiz submission success
      console.error('waitlist/join internal call failed:', joinError);
    }

    // If a referral code was supplied in the quiz payload, record the referral
    if (incomingReferralCode && typeof incomingReferralCode === 'string') {
      // Fire-and-forget — do not await, do not let failure affect response
      fetch(new URL('/api/waitlist/refer', request.url).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: incomingReferralCode,
          referredEmail: email,
        }),
      }).catch((err) => console.error('waitlist/refer internal call failed:', err));
    }

    return new Response(
      JSON.stringify({ success: true, archetype, ...(outgoingReferralCode ? { referralCode: outgoingReferralCode } : {}) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
```

### Step 3.6 — Commit

```bash
git add src/pages/quiz.astro src/pages/api/quiz-submit.ts
git commit -m "feat: integrate referral flow into quiz submission — pass ref param, auto-join waitlist, record referral"
```

---

## Task 4: Create Waitlist Status Page

**File:** Create `src/pages/waitlist.astro`

**Purpose:** User-facing page at `/waitlist`. Accepts `?email=` query parameter from the URL or from a manual lookup form. Displays referral code, referral link (copyable), referral count, and waitlist position.

**Important:** This page is Astro SSG (`prerender` defaults to true for pages). All data fetching happens client-side via a fetch to `/api/waitlist/status`. No server-side Supabase access from the page itself.

```astro
---
// src/pages/waitlist.astro
// Static page — all data loaded client-side via /api/waitlist/status
import Layout from '../layouts/Layout.astro';
---

<Layout
  title="Your Waitlist Position | The Hermetic Flight"
  description="Check your waitlist position and referral count for The Hermetic Flight Kickstarter."
>
  <main class="w-full min-h-screen flex flex-col items-center relative z-10 pt-6 pb-12 px-4">

    <!-- Header -->
    <header class="w-full py-4 flex justify-center mb-4">
      <a href="/" class="group flex items-center gap-3">
        <img src="/images/logo.png" alt="The Hermetic Flight" class="w-10 h-10 rounded-full opacity-80 group-hover:opacity-100 transition-opacity" />
        <span class="font-serif text-hermetic-gold/60 text-sm tracking-[0.2em] uppercase group-hover:text-hermetic-gold transition-colors">The Hermetic Flight</span>
      </a>
    </header>

    <div class="w-full max-w-lg">

      <!-- Lookup Form (shown initially or when no email param) -->
      <div id="lookup-section" class="glass-panel p-8 rounded-lg">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2 text-center">Waitlist Status</p>
        <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>
        <h1 class="font-serif text-2xl text-hermetic-white mb-2 text-center">Check Your Position</h1>
        <p class="text-gray-400 font-sans text-sm mb-6 text-center">Enter the email you used to complete the archetype quiz.</p>
        <form id="lookup-form" class="space-y-3">
          <input
            id="lookup-email"
            type="email"
            placeholder="Email Address"
            required
            class="w-full p-3 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-white font-sans placeholder:text-gray-500 focus:border-hermetic-gold/50 focus:outline-none transition-colors"
          />
          <button type="submit" id="lookup-btn" class="btn-flame w-full py-3 text-white font-sans font-bold text-sm tracking-widest uppercase">
            Look Up My Position
          </button>
          <p id="lookup-error" class="hidden text-red-400 text-sm font-sans text-center"></p>
        </form>
      </div>

      <!-- Status Display (hidden until data loads) -->
      <div id="status-section" class="hidden glass-panel p-8 rounded-lg">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div>

        <p class="text-hermetic-gold text-xs tracking-[0.3em] uppercase font-sans mb-2 text-center">Your Waitlist Position</p>
        <div class="w-16 h-[1px] bg-gradient-to-r from-transparent via-hermetic-gold/60 to-transparent mx-auto mb-6"></div>

        <!-- Position Display -->
        <div class="text-center mb-8">
          <p class="text-gray-400 font-sans text-sm mb-1">Position</p>
          <p id="status-position" class="font-serif text-5xl text-hermetic-gold mb-1">#—</p>
          <p class="text-gray-500 font-sans text-xs">on the Kickstarter early access list</p>
        </div>

        <!-- Referral Count -->
        <div class="text-center mb-8 border-t border-hermetic-gold/20 pt-6">
          <p class="text-gray-400 font-sans text-sm mb-1">Referrals</p>
          <p id="status-referral-count" class="font-serif text-3xl text-hermetic-white mb-1">0</p>
          <p class="text-gray-500 font-sans text-xs">people you've brought to the flight</p>
        </div>

        <!-- Referral Link -->
        <div class="border-t border-hermetic-gold/20 pt-6">
          <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-2 text-center">Your Referral Link</p>
          <p class="text-gray-400 font-sans text-sm mb-4 text-center">Share this link — every signup through it moves you up.</p>
          <div class="flex items-center gap-2">
            <input
              id="status-referral-link"
              type="text"
              readonly
              class="flex-1 p-2 bg-hermetic-void/80 border border-hermetic-gold/20 rounded-lg text-hermetic-gold/80 font-sans text-xs focus:outline-none truncate"
            />
            <button
              id="status-copy-btn"
              class="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-xs font-sans"
            >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span id="status-copy-text">Copy</span>
            </button>
          </div>

          <!-- Social Share for Referral Link -->
          <div class="flex justify-center gap-3 mt-4 flex-wrap">
            <a id="status-share-x" href="#" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Post
            </a>
            <a id="status-share-fb" href="#" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Share
            </a>
          </div>
        </div>

        <!-- Lookup another -->
        <div class="text-center mt-6">
          <button id="lookup-another-btn" class="text-hermetic-gold/40 hover:text-hermetic-gold/70 text-xs font-sans tracking-wider transition-colors">
            Look up a different email
          </button>
        </div>
      </div>

    </div>
  </main>

  <script>
    const lookupSection = document.getElementById('lookup-section')!;
    const statusSection = document.getElementById('status-section')!;
    const lookupForm = document.getElementById('lookup-form') as HTMLFormElement;
    const lookupEmailInput = document.getElementById('lookup-email') as HTMLInputElement;
    const lookupBtn = document.getElementById('lookup-btn')!;
    const lookupError = document.getElementById('lookup-error')!;
    const statusPosition = document.getElementById('status-position')!;
    const statusReferralCount = document.getElementById('status-referral-count')!;
    const statusReferralLink = document.getElementById('status-referral-link') as HTMLInputElement;
    const statusCopyBtn = document.getElementById('status-copy-btn')!;
    const statusCopyText = document.getElementById('status-copy-text')!;
    const statusShareX = document.getElementById('status-share-x') as HTMLAnchorElement;
    const statusShareFb = document.getElementById('status-share-fb') as HTMLAnchorElement;
    const lookupAnotherBtn = document.getElementById('lookup-another-btn')!;

    async function lookupStatus(email: string): Promise<void> {
      lookupBtn.textContent = 'Looking up...';
      lookupBtn.setAttribute('disabled', 'true');
      lookupError.classList.add('hidden');

      try {
        const res = await fetch(`/api/waitlist/status?email=${encodeURIComponent(email)}`);
        const data = await res.json() as {
          success?: boolean;
          error?: string;
          data?: {
            position: number;
            referralCount: number;
            referralCode: string;
            referralLink: string;
          };
        };

        if (!res.ok || !data.success || !data.data) {
          const msg = data.error === 'Not found'
            ? 'No waitlist entry found for that email. Have you completed the quiz?'
            : (data.error ?? 'Lookup failed — please try again.');
          lookupError.textContent = msg;
          lookupError.classList.remove('hidden');
          lookupBtn.textContent = 'Look Up My Position';
          lookupBtn.removeAttribute('disabled');
          return;
        }

        const { position, referralCount, referralLink } = data.data;

        statusPosition.textContent = `#${position}`;
        statusReferralCount.textContent = String(referralCount);
        statusReferralLink.value = referralLink;

        const shareText = 'Join me on the waitlist for The Hermetic Flight — an aerial tarot deck launching on Kickstarter:';
        statusShareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`;
        statusShareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;

        statusCopyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(referralLink);
            statusCopyText.textContent = 'Copied!';
          } catch {
            statusCopyText.textContent = 'Failed';
          }
          setTimeout(() => { statusCopyText.textContent = 'Copy'; }, 2000);
        });

        lookupSection.classList.add('hidden');
        statusSection.classList.remove('hidden');
      } catch {
        lookupError.textContent = 'Network error — please try again.';
        lookupError.classList.remove('hidden');
        lookupBtn.textContent = 'Look Up My Position';
        lookupBtn.removeAttribute('disabled');
      }
    }

    // Auto-lookup if ?email= is in the URL
    const urlEmail = new URLSearchParams(window.location.search).get('email');
    if (urlEmail) {
      lookupEmailInput.value = urlEmail;
      lookupStatus(urlEmail);
    }

    lookupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = lookupEmailInput.value.trim();
      if (email) lookupStatus(email);
    });

    lookupAnotherBtn.addEventListener('click', () => {
      statusSection.classList.add('hidden');
      lookupSection.classList.remove('hidden');
      lookupBtn.textContent = 'Look Up My Position';
      lookupBtn.removeAttribute('disabled');
      lookupEmailInput.value = '';
    });
  </script>
</Layout>
```

### Step 4.1 — Commit

```bash
git add src/pages/waitlist.astro
git commit -m "feat: add /waitlist status page — position, referral count, shareable link"
```

---

## Task 5: Add Referral Link to Result Pages

**File:** Modify `src/pages/quiz/result/[archetype].astro`

**Purpose:** When a visitor lands on a static result page directly (e.g., via a friend's share), they can optionally check their own referral link. This is a secondary surface — the primary one is `quiz.astro`'s `#email-success` section.

Result pages are static (SSG). They cannot know the visitor's referral code at build time. The approach: show a "Check your referral link" section that links to `/waitlist` with a prompt to enter their email.

### Step 5.1 — Add referral CTA section to result page

In `src/pages/quiz/result/[archetype].astro`, locate the "CTA for new visitors" section (around line 87). After the closing `</div>` of that section (before the outer `</div>` closing the relative z-10 container), add:

```astro
          <!-- Referral Waitlist CTA -->
          <div class="border-t border-hermetic-gold/20 pt-8 mt-8">
            <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-2">Already on the waitlist?</p>
            <p class="text-gray-400 font-sans text-sm mb-4">Check your position and share your referral link to move up.</p>
            <a href="/waitlist"
              class="inline-flex items-center gap-2 px-6 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans">
              Check My Position
            </a>
          </div>
```

### Step 5.2 — Commit

```bash
git add src/pages/quiz/result/
git commit -m "feat: add referral waitlist CTA to archetype result pages"
```

---

## Task 6: Write Tests (Frozen-Test-File Protocol)

> **CRITICAL:** Task 6 is the TEST AUTHOR step. The agent that writes these tests must NOT be the agent that implements Tasks 1-5.
> - Run `record-baseline.sh` after this task completes.
> - Run `verify-frozen.sh` after Tasks 1-5 implementation.
> - Do NOT modify these test files during implementation.

**Files to create:**
- `tests/waitlist-join.test.ts`
- `tests/waitlist-status.test.ts`
- `tests/waitlist-refer.test.ts`
- `tests/waitlist-quiz-integration.test.ts`
- `tests/waitlist-e2e.spec.ts` (Playwright — in `tests/` per vitest.config.ts exclude pattern or separate runner)

**Note on Playwright:** The existing `vitest.config.ts` includes `tests/**/*.test.ts` but excludes `.spec.ts` files. The existing E2E test is `tests/quiz-flow.spec.ts` (run separately). Add `waitlist-e2e.spec.ts` to the same pattern.

### TDD Step 1 — Write all test files

**`tests/waitlist-join.test.ts`**

```typescript
/**
 * waitlist/join API Route — Contract Tests
 *
 * Frozen-test-file protocol: Do NOT modify during implementation.
 *
 * Module under test: src/pages/api/waitlist/join.ts
 *
 * Coverage:
 *   WJ-01: Valid new email creates waitlist entry and returns referral code
 *   WJ-02: Duplicate email returns existing referral code without error
 *   WJ-03: Invalid email returns 400
 *   WJ-04: Missing email returns 400
 *   WJ-05: Referral code is 10 chars, URL-safe alphabet only
 *   WJ-06: Rate limit — global limit enforced
 *   WJ-07: Rate limit — per-email limit enforced
 *   WJ-08: Supabase failure returns 500
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import.meta.env.LOOPS_API_KEY = 'test-loops-key';
import.meta.env.SUPABASE_URL = 'https://test.supabase.co';
import.meta.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Mock @supabase/supabase-js before importing the module under test
vi.mock('@supabase/supabase-js', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
    })),
  };
});

import { POST } from '../src/pages/api/waitlist/join';
import { createClient } from '@supabase/supabase-js';

function mockRequest(body: unknown): Request {
  return new Request('https://example.com/api/waitlist/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json();
}

const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{10}$/;

describe('WJ-01: Valid new email creates entry and returns referral code', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ));

    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
    }
  });

  it('returns 200 with success: true and a referralCode', async () => {
    const res = await POST({ request: mockRequest({ email: 'new@example.com' }) } as any);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
    expect(typeof data.referralCode).toBe('string');
  });

  it('referralCode matches URL-safe nanoid(10) format', async () => {
    const res = await POST({ request: mockRequest({ email: 'nano@example.com' }) } as any);
    const data = await parseResponse(res);
    expect(REFERRAL_CODE_PATTERN.test(data.referralCode as string)).toBe(true);
  });

  it('sets isNew: true for a new email', async () => {
    const res = await POST({ request: mockRequest({ email: 'brand@example.com' }) } as any);
    const data = await parseResponse(res);
    expect(data.isNew).toBe(true);
  });
});

describe('WJ-02: Duplicate email returns existing referral code', () => {
  it('returns 200 with existing code and isNew: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ));

    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { referral_code: 'EXISTINGCODE' },
          error: null,
        }),
      });
    }

    const res = await POST({ request: mockRequest({ email: 'existing@example.com' }) } as any);
    expect(res.status).toBe(200);
    const data = await parseResponse(res);
    expect(data.success).toBe(true);
    expect(data.referralCode).toBe('EXISTINGCODE');
    expect(data.isNew).toBe(false);
  });
});

describe('WJ-03 / WJ-04: Invalid input returns 400', () => {
  it('rejects invalid email format', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await POST({ request: mockRequest({ email: 'not-an-email' }) } as any);
    expect(res.status).toBe(400);
  });

  it('rejects missing email', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await POST({ request: mockRequest({}) } as any);
    expect(res.status).toBe(400);
  });

  it('rejects email over 254 chars', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const longEmail = 'a'.repeat(250) + '@x.co';
    const res = await POST({ request: mockRequest({ email: longEmail }) } as any);
    expect(res.status).toBe(400);
  });
});

describe('WJ-05: Referral code uniqueness', () => {
  it('two different emails receive different referral codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ));

    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
    }

    const res1 = await POST({ request: mockRequest({ email: 'user1@example.com' }) } as any);
    const res2 = await POST({ request: mockRequest({ email: 'user2@example.com' }) } as any);
    const d1 = await parseResponse(res1);
    const d2 = await parseResponse(res2);
    expect(d1.referralCode).not.toBe(d2.referralCode);
  });
});

describe('WJ-08: Supabase failure returns 500', () => {
  it('returns 500 when insert fails with unexpected error', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: { code: '99999', message: 'unexpected' } }),
      });
    }

    const res = await POST({ request: mockRequest({ email: 'fail@example.com' }) } as any);
    expect(res.status).toBe(500);
  });
});
```

**`tests/waitlist-status.test.ts`**

```typescript
/**
 * waitlist/status API Route — Contract Tests
 *
 * Frozen-test-file protocol: Do NOT modify during implementation.
 *
 * Module under test: src/pages/api/waitlist/status.ts
 *
 * Coverage:
 *   WS-01: Email lookup returns position, count, referralLink
 *   WS-02: Referral code lookup returns same data
 *   WS-03: Unknown email returns 404
 *   WS-04: Missing both params returns 400
 *   WS-05: Invalid email format returns 400
 *   WS-06: Invalid ref format returns 400
 *   WS-07: Position = 1 for first subscriber (no preceding entries)
 *   WS-08: Position = N for subscriber with N-1 preceding entries
 *   WS-09: referralLink uses correct base URL
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import.meta.env.SUPABASE_URL = 'https://test.supabase.co';
import.meta.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

vi.mock('@supabase/supabase-js', () => {
  const mockFrom = vi.fn();
  return {
    createClient: vi.fn(() => ({ from: mockFrom })),
  };
});

import { GET } from '../src/pages/api/waitlist/status';
import { createClient } from '@supabase/supabase-js';

function mockGetRequest(params: Record<string, string>): Request {
  const url = new URL('https://example.com/api/waitlist/status');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), { method: 'GET' });
}

const FAKE_ENTRY = {
  email: 'test@example.com',
  referral_code: 'ABCDE12345',
  referral_count: 3,
  created_at: '2026-03-01T10:00:00Z',
};

function setupSupabaseMock(entry: typeof FAKE_ENTRY | null, precedingCount: number) {
  const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
  if (!mockClient) return;

  mockClient.from.mockImplementation((table: string) => {
    if (table === 'waitlist') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: entry, error: null }),
        // for the count query (uses { count: 'exact', head: true })
        then: undefined,
        // second call for count
      };
    }
    return {};
  });

  // We need to handle two separate from('waitlist') calls.
  // First call: lookup by email/ref. Second call: count preceding.
  let callCount = 0;
  mockClient.from.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: entry, error: null }),
      };
    }
    // Second call: count query
    return {
      select: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      then: undefined,
      // The count result
      count: precedingCount,
      error: null,
      // Supabase count queries resolve to { count, error }
      maybeSingle: undefined,
    };
  });
}

describe('WS-01: Email lookup returns position, count, referralLink', () => {
  beforeEach(() => {
    setupSupabaseMock(FAKE_ENTRY, 4); // position = 5
  });

  it('returns 200 with full status data', async () => {
    const res = await GET({ request: mockGetRequest({ email: 'test@example.com' }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('referralLink contains the referral code', async () => {
    const res = await GET({ request: mockGetRequest({ email: 'test@example.com' }) } as any);
    const body = await res.json() as any;
    expect(body.data.referralLink).toContain('ABCDE12345');
  });

  it('referralLink uses the correct base domain', async () => {
    const res = await GET({ request: mockGetRequest({ email: 'test@example.com' }) } as any);
    const body = await res.json() as any;
    expect(body.data.referralLink).toContain('https://www.thehermeticflight.com');
  });
});

describe('WS-03: Unknown email returns 404', () => {
  beforeEach(() => {
    setupSupabaseMock(null, 0);
  });

  it('returns 404', async () => {
    const res = await GET({ request: mockGetRequest({ email: 'nobody@example.com' }) } as any);
    expect(res.status).toBe(404);
  });
});

describe('WS-04 / WS-05 / WS-06: Input validation', () => {
  it('returns 400 when no params provided', async () => {
    const res = await GET({ request: mockGetRequest({}) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await GET({ request: mockGetRequest({ email: 'notanemail' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid ref code format (too short)', async () => {
    const res = await GET({ request: mockGetRequest({ ref: 'SHORT' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid ref code format (invalid chars)', async () => {
    const res = await GET({ request: mockGetRequest({ ref: 'INVALID!!!!' }) } as any);
    expect(res.status).toBe(400);
  });
});

describe('WS-07 / WS-08: Position calculation', () => {
  it('returns position 1 for first subscriber (0 preceding)', async () => {
    setupSupabaseMock(FAKE_ENTRY, 0);
    const res = await GET({ request: mockGetRequest({ email: 'test@example.com' }) } as any);
    const body = await res.json() as any;
    expect(body.data.position).toBe(1);
  });

  it('returns position 5 for subscriber with 4 preceding', async () => {
    setupSupabaseMock(FAKE_ENTRY, 4);
    const res = await GET({ request: mockGetRequest({ email: 'test@example.com' }) } as any);
    const body = await res.json() as any;
    expect(body.data.position).toBe(5);
  });
});
```

**`tests/waitlist-refer.test.ts`**

```typescript
/**
 * waitlist/refer API Route — Contract Tests
 *
 * Frozen-test-file protocol: Do NOT modify during implementation.
 *
 * Module under test: src/pages/api/waitlist/refer.ts
 *
 * Coverage:
 *   WR-01: Valid referral records entry and increments count
 *   WR-02: Self-referral rejected (referrer_email === referred_email)
 *   WR-03: Duplicate referral (referred_email already referred) returns 200 with alreadyReferred: true
 *   WR-04: Unknown referral code returns 404
 *   WR-05: Invalid referral code format returns 400
 *   WR-06: Invalid referred email returns 400
 *   WR-07: Missing fields return 400
 *   WR-08: Loops.so events fired for both parties on success
 *   WR-09: RPC failure is non-fatal (still returns success)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import.meta.env.LOOPS_API_KEY = 'test-loops-key';
import.meta.env.SUPABASE_URL = 'https://test.supabase.co';
import.meta.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

vi.mock('@supabase/supabase-js', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    createClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
  };
});

import { POST } from '../src/pages/api/waitlist/refer';
import { createClient } from '@supabase/supabase-js';

function mockRequest(body: unknown): Request {
  return new Request('https://example.com/api/waitlist/refer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_CODE = 'ABCDE12345';
const REFERRER_EMAIL = 'referrer@example.com';
const REFERRED_EMAIL = 'referred@example.com';

function setupHappyPath() {
  const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
  if (!mockClient) return;

  mockClient.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { email: REFERRER_EMAIL, referral_code: VALID_CODE },
      error: null,
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
  mockClient.rpc.mockResolvedValue({ error: null });
}

describe('WR-01: Valid referral records entry and increments count', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ));
    setupHappyPath();
  });

  it('returns 200 with success: true and alreadyReferred: false', async () => {
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: REFERRED_EMAIL }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.alreadyReferred).toBe(false);
  });
});

describe('WR-02: Self-referral rejected', () => {
  beforeEach(() => {
    setupHappyPath();
  });

  it('returns 400 when referrer and referred email are the same', async () => {
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: REFERRER_EMAIL }) } as any);
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.error).toContain('yourself');
  });
});

describe('WR-03: Duplicate referral treated as idempotent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { email: REFERRER_EMAIL, referral_code: VALID_CODE },
          error: null,
        }),
        insert: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'unique_violation' } }),
      });
    }
  });

  it('returns 200 with alreadyReferred: true', async () => {
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: REFERRED_EMAIL }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.alreadyReferred).toBe(true);
  });
});

describe('WR-04: Unknown referral code returns 404', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
    }
  });

  it('returns 404', async () => {
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: REFERRED_EMAIL }) } as any);
    expect(res.status).toBe(404);
  });
});

describe('WR-05 / WR-06 / WR-07: Input validation', () => {
  it('returns 400 for invalid referral code format', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await POST({ request: mockRequest({ referralCode: 'BAD!', referredEmail: REFERRED_EMAIL }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid referred email', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: 'notanemail' }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when referralCode is missing', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await POST({ request: mockRequest({ referredEmail: REFERRED_EMAIL }) } as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when referredEmail is missing', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE }) } as any);
    expect(res.status).toBe(400);
  });
});

describe('WR-08: Loops.so events fired for both parties', () => {
  it('fires two fetch calls to Loops.so on successful referral', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    setupHappyPath();

    await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: REFERRED_EMAIL }) } as any);

    // Allow fire-and-forget promises to settle
    await new Promise((r) => setTimeout(r, 50));

    const loopsCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => String(url).includes('loops.so'),
    );
    expect(loopsCalls.length).toBe(2);

    const eventNames = loopsCalls.map(([, opts]: [string, RequestInit]) => {
      const body = JSON.parse(opts.body as string);
      return body.eventName;
    });
    expect(eventNames).toContain('referral_made');
    expect(eventNames).toContain('referred_signup');
  });
});

describe('WR-09: RPC failure is non-fatal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    ));
    const mockClient = (createClient as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    if (mockClient) {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { email: REFERRER_EMAIL, referral_code: VALID_CODE },
          error: null,
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
      mockClient.rpc.mockResolvedValue({ error: { message: 'RPC failed' } });
    }
  });

  it('still returns 200 success even when RPC increment fails', async () => {
    const res = await POST({ request: mockRequest({ referralCode: VALID_CODE, referredEmail: REFERRED_EMAIL }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
  });
});
```

**`tests/waitlist-quiz-integration.test.ts`**

```typescript
/**
 * Quiz Submit + Waitlist Integration Tests
 *
 * Frozen-test-file protocol: Do NOT modify during implementation.
 *
 * Verifies that quiz-submit.ts correctly integrates with the waitlist flow:
 *   WQI-01: Successful quiz submit includes referralCode in response
 *   WQI-02: Quiz submit with referralCode in body triggers refer call
 *   WQI-03: Waitlist join failure does not block quiz submit success
 *   WQI-04: Refer failure does not block quiz submit success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { questions } from '../src/lib/quiz-data';

import.meta.env.LOOPS_API_KEY = 'test-loops-key';
import.meta.env.SUPABASE_URL = 'https://test.supabase.co';
import.meta.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
  })),
}));

import { POST } from '../src/pages/api/quiz-submit';

function buildValidAnswers(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of questions) { answers[q.id] = q.answers[0].id; }
  return answers;
}

function mockRequest(body: unknown): Request {
  return new Request('https://example.com/api/quiz-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildLoopsOkFetch(overrideReferralCode?: string) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes('loops.so')) {
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    }
    if (urlStr.includes('waitlist/join')) {
      return Promise.resolve(new Response(
        JSON.stringify({ success: true, referralCode: overrideReferralCode ?? 'TESTCODE123' }),
        { status: 200 },
      ));
    }
    if (urlStr.includes('waitlist/refer')) {
      return Promise.resolve(new Response(
        JSON.stringify({ success: true, alreadyReferred: false }),
        { status: 200 },
      ));
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });
}

describe('WQI-01: Successful quiz submit includes referralCode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', buildLoopsOkFetch('MYCODE12345'));
  });

  it('response contains referralCode from waitlist/join', async () => {
    const res = await POST({ request: mockRequest({
      email: 'quiz@example.com',
      answers: buildValidAnswers(),
    }) } as any);

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.referralCode).toBe('MYCODE12345');
  });
});

describe('WQI-02: referralCode in body triggers refer call', () => {
  it('makes a fetch call to waitlist/refer when referralCode is present', async () => {
    const fetchMock = buildLoopsOkFetch();
    vi.stubGlobal('fetch', fetchMock);

    await POST({ request: mockRequest({
      email: 'referred@example.com',
      answers: buildValidAnswers(),
      referralCode: 'REFERRER123',
    }) } as any);

    await new Promise((r) => setTimeout(r, 50));

    const referCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => String(url).includes('waitlist/refer'),
    );
    expect(referCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('WQI-03: Waitlist join failure does not block quiz success', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('loops.so')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }
      if (urlStr.includes('waitlist/join')) {
        return Promise.reject(new Error('Supabase down'));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    }));
  });

  it('still returns 200 with success: true', async () => {
    const res = await POST({ request: mockRequest({
      email: 'resilient@example.com',
      answers: buildValidAnswers(),
    }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
  });
});

describe('WQI-04: Refer failure does not block quiz success', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('loops.so')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }
      if (urlStr.includes('waitlist/join')) {
        return Promise.resolve(new Response(
          JSON.stringify({ success: true, referralCode: 'TESTCODE123' }),
          { status: 200 },
        ));
      }
      if (urlStr.includes('waitlist/refer')) {
        return Promise.reject(new Error('refer exploded'));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    }));
  });

  it('still returns 200 with success: true even when refer fails', async () => {
    const res = await POST({ request: mockRequest({
      email: 'referfail@example.com',
      answers: buildValidAnswers(),
      referralCode: 'SOMEREFCODE1',
    }) } as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
  });
});
```

**`tests/waitlist-e2e.spec.ts`** (Playwright — run separately with existing `quiz-flow.spec.ts` pattern)

```typescript
/**
 * Waitlist E2E Tests — Playwright
 *
 * Frozen-test-file protocol: Do NOT modify during implementation.
 *
 * Requires a running dev server at http://localhost:4321
 * Run: npx playwright test tests/waitlist-e2e.spec.ts
 *
 * Coverage:
 *   WE2E-01: /waitlist page loads without errors
 *   WE2E-02: Lookup form is visible and accepts input
 *   WE2E-03: Invalid email shows error (client-side form validation)
 *   WE2E-04: Valid lookup that returns 404 shows helpful error message
 */

import { test, expect } from '@playwright/test';

test.describe('WE2E-01: /waitlist page loads', () => {
  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('http://localhost:4321/waitlist');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('page title contains "Waitlist"', async ({ page }) => {
    await page.goto('http://localhost:4321/waitlist');
    await expect(page).toHaveTitle(/waitlist/i);
  });
});

test.describe('WE2E-02: Lookup form is present', () => {
  test('email input is visible', async ({ page }) => {
    await page.goto('http://localhost:4321/waitlist');
    await expect(page.locator('#lookup-email')).toBeVisible();
  });

  test('submit button is visible', async ({ page }) => {
    await page.goto('http://localhost:4321/waitlist');
    await expect(page.locator('#lookup-btn')).toBeVisible();
  });

  test('can type in email field', async ({ page }) => {
    await page.goto('http://localhost:4321/waitlist');
    await page.fill('#lookup-email', 'test@example.com');
    await expect(page.locator('#lookup-email')).toHaveValue('test@example.com');
  });
});

test.describe('WE2E-03: ?email= param auto-triggers lookup', () => {
  test('pre-populates email input from URL param', async ({ page }) => {
    await page.goto('http://localhost:4321/waitlist?email=test@example.com');
    await page.waitForLoadState('networkidle');
    // Email input should be filled from the URL param
    await expect(page.locator('#lookup-email')).toHaveValue('test@example.com');
  });
});

test.describe('WE2E-04: 404 response shows helpful error', () => {
  test('shows "No waitlist entry found" for unknown email', async ({ page }) => {
    await page.goto('http://localhost:4321/waitlist');
    await page.fill('#lookup-email', 'nobody-registered-this@example.com');
    await page.click('#lookup-btn');
    await expect(page.locator('#lookup-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#lookup-error')).toContainText(/quiz/i);
  });
});
```

### TDD Step 2 — Verify all tests fail (or file-not-found)

Run each file individually before any implementation:

```bash
npx vitest run tests/waitlist-join.test.ts
npx vitest run tests/waitlist-status.test.ts
npx vitest run tests/waitlist-refer.test.ts
npx vitest run tests/waitlist-quiz-integration.test.ts
```

Expected: Tests fail because the API route files don't exist yet (import errors or missing exports).

### TDD Step 3 — Record baseline

```bash
bash ~/.claude/hooks/record-baseline.sh
```

### Step 6.4 — Commit test files

```bash
git add tests/waitlist-join.test.ts tests/waitlist-status.test.ts tests/waitlist-refer.test.ts tests/waitlist-quiz-integration.test.ts tests/waitlist-e2e.spec.ts
git commit -m "test: add frozen waitlist test suite — join, status, refer, quiz integration, E2E"
```

### TDD Step 4 (post-implementation) — Verify all tests pass

After Tasks 1-5 are implemented:

```bash
npx vitest run tests/waitlist-join.test.ts tests/waitlist-status.test.ts tests/waitlist-refer.test.ts tests/waitlist-quiz-integration.test.ts
```

Expected: All tests pass. Zero failures.

### TDD Step 5 — Verify frozen files unchanged

```bash
bash ~/.claude/hooks/verify-frozen.sh
```

Expected: No drift detected.

### TDD Step 6 — Full test suite regression

```bash
npx vitest run
```

Expected: All existing tests (quiz-data, classifier, quiz-submit, archetype-content, hardening) continue to pass. No regressions.

---

## Task 7: Quality Gates

### Quality Gate 1: TypeScript compilation

```bash
npx tsc --noEmit
```

Expected: Zero errors. The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` fields in `ImportMetaEnv` must be in scope.

### Quality Gate 2: Security checklist (manual)

Verify each item before evaluation:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` never appears in any `.astro` frontmatter or client `<script>` block
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never appears in `src/lib/supabase.ts` outside of `import.meta.env` access
- [ ] `src/pages/waitlist.astro` has no import of `supabase.ts`
- [ ] `src/pages/quiz/result/[archetype].astro` has no import of `supabase.ts`
- [ ] All three API routes have `export const prerender = false`
- [ ] RLS is enabled on both Supabase tables (DDL includes `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Self-referral prevented in `refer.ts`
- [ ] Duplicate referral handled gracefully in `refer.ts` (unique constraint + 23505 code check)

### Quality Gate 3: Frozen-test-file verification

```bash
bash ~/.claude/hooks/verify-frozen.sh
```

Expected: No drift from baseline recorded after Task 6.

### Quality Gate 4: Evaluation Protocol

Run `/harden` with the following four evaluator lens assignments. This feature introduces a new backend (Supabase) and handles user data — it warrants the full 4-evaluator protocol.

**Evaluator 1 — Security lens**
- No client-side `service_role` key exposure (grep `SUPABASE_SERVICE_ROLE_KEY` in all `.astro` and client scripts)
- RLS enabled on both tables
- All inputs validated (email format, referral code format, length)
- Parameterized queries via Supabase JS client (no raw SQL string interpolation in API routes)
- Self-referral prevention
- Rate limiting on `join.ts` (same WeakMap-on-fetch pattern)

**Evaluator 2 — Data integrity lens**
- Atomic counter increments via `increment_referral_count` RPC (no read-modify-write)
- `UNIQUE(referred_email)` constraint prevents a person being referred twice
- `UNIQUE(email)` on `waitlist` prevents duplicate waitlist entries
- `REFERENCES waitlist(referral_code)` FK prevents orphaned referral records
- Race condition handling in `join.ts` (23505 code on concurrent inserts)
- `increment_referral_count` RPC failure is non-fatal and logged

**Evaluator 3 — API design lens**
- Rate limiting on `join.ts` consistent with `quiz-submit.ts` WeakMap pattern
- Error responses follow `{ error: "message" }` pattern throughout
- Success responses follow `{ success: true, data }` pattern
- Idempotency: `join` is safe to call multiple times (returns existing code)
- Internal fetches from `quiz-submit.ts` to waitlist routes are non-blocking for the main flow
- Loops.so events are fire-and-forget (failure does not block user-facing response)
- `waitlist/refer` idempotency via `alreadyReferred: true` response

**Evaluator 4 — UX lens**
- Referral link is copyable from `#email-success` in `quiz.astro` immediately after submit
- Referral link input is `readonly` (no accidental editing)
- Copy button provides feedback ("Copied!" state with 2s reset)
- `/waitlist` page auto-populates from `?email=` URL param
- "Not found" error message is actionable (points user back to quiz)
- Waitlist position is 1-based (not 0-based)
- Mobile: referral link input truncates gracefully (`truncate` class)
- `/waitlist` page links to the referral waitlist section on result pages

### Quality Gate 5: Harden

After evaluation synthesis, apply all high/medium severity findings via frozen-test-file remediation cycles:

1. Write regression test for finding
2. Verify test fails
3. Implement fix
4. Verify test passes
5. Verify frozen files unchanged
6. Commit

---

## Commit Sequence Summary

```
feat: add @supabase/supabase-js, server-side client module, env type declarations
feat: add waitlist API routes — join, status, refer
feat: integrate referral flow into quiz submission — pass ref param, auto-join waitlist, record referral
feat: add /waitlist status page — position, referral count, shareable link
feat: add referral waitlist CTA to archetype result pages
test: add frozen waitlist test suite — join, status, refer, quiz integration, E2E
```

---

## File Manifest

| File | Action |
|------|--------|
| `src/lib/supabase.ts` | Create |
| `src/env.d.ts` | Modify — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `src/pages/api/waitlist/join.ts` | Create |
| `src/pages/api/waitlist/status.ts` | Create |
| `src/pages/api/waitlist/refer.ts` | Create |
| `src/pages/quiz.astro` | Modify — read `?ref` param, pass to API, show referral link section |
| `src/pages/api/quiz-submit.ts` | Modify — call waitlist/join + refer, return referralCode |
| `src/pages/waitlist.astro` | Create |
| `src/pages/quiz/result/[archetype].astro` | Modify — add referral waitlist CTA |
| `tests/waitlist-join.test.ts` | Create (frozen) |
| `tests/waitlist-status.test.ts` | Create (frozen) |
| `tests/waitlist-refer.test.ts` | Create (frozen) |
| `tests/waitlist-quiz-integration.test.ts` | Create (frozen) |
| `tests/waitlist-e2e.spec.ts` | Create (frozen) |
| `package.json` | Modify — add `@supabase/supabase-js` |

---

## Deferred (Out of Scope for This Sprint)

- **Reward tiers** — no tier logic, thresholds, or tier-based messaging. `referral_count` is tracked, tier evaluation is not.
- **Admin view** — no operator-facing dashboard. Use Supabase Table Editor directly.
- **Referral link on static result pages** — Task 5 adds only a "Check My Position" link to `/waitlist`. Dynamic referral codes on static pages would require client-side fetch + state, which adds complexity. Deferred to Sprint 4 refactoring (Task ARCH-04 extract pattern).
- **Waitlist email drip** — Loops.so `waitlist_joined` and `referral_made` events fire but no drip sequence is configured in this sprint. Operator configures drip in Loops.so dashboard.
- **Referral fraud detection** — IP-based deduplication, email domain blocking, velocity checks. Deferred until launch-scale traffic warrants it.
