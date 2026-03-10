# Supabase JavaScript Client Reference Guide

> Compiled from https://supabase.com/docs/reference/javascript/ — 2026-03-09
> Covers: installation, initialization, insert(), select(), upsert(), error handling, TypeScript support

---

## Overview

`@supabase/supabase-js` is an isomorphic JavaScript client for Supabase, supporting
browser, Node.js, and edge/serverless environments. It provides a typed query
builder over your Postgres database via the Supabase REST API (PostgREST), plus
auth, storage, and realtime subscriptions.

**Key constraints:**
- Supabase projects return a maximum of 1,000 rows by default (configurable in
  project API settings).
- The `anon` key is safe for public client-side use when Row Level Security (RLS)
  is correctly configured. The `service_role` key bypasses RLS and must never be
  exposed client-side.
- For Vercel serverless functions, use the `service_role` key server-side only,
  stored in environment variables.

---

## Installation

```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
```

**Deno / JSR:**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
```

**CDN (browser only):**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

---

## Client Initialization

### Basic (anon key, client-side)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xyzcompany.supabase.co',
  process.env.SUPABASE_ANON_KEY
)
```

### Server-side (service role key, bypasses RLS)

```typescript
import { createClient } from '@supabase/supabase-js'

// For Vercel serverless — never expose service_role key client-side
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### With TypeScript types

```typescript
import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### createClient() parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `supabaseUrl` | string | **Yes** | Project URL from the Supabase dashboard |
| `supabaseKey` | string | **Yes** | Anon key (public) or service role key (server-only) |
| `options` | object | No | See options table below |

**options object fields:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `db.schema` | string | `"public"` | Custom database schema |
| `auth.autoRefreshToken` | boolean | `true` | Automatic JWT refresh |
| `auth.persistSession` | boolean | `true` | Persist session across page loads |
| `auth.detectSessionInUrl` | boolean | `true` | Detect session from URL fragment |
| `auth.storage` | object | — | Custom storage adapter (e.g., AsyncStorage for React Native) |
| `global.headers` | object | — | Extra HTTP headers on every request |
| `global.fetch` | function | — | Custom fetch implementation |

---

## insert()

Inserts one or more rows into a table.

### Signature

```typescript
supabase.from('table').insert(values, options?)
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `values` | object \| object[] | **Yes** | Record or array of records to insert |
| `options` | object | No | See options table below |

**options object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `count` | `'exact'` \| `'planned'` \| `'estimated'` | Return row count in response |

### Return type

Returns a `PostgrestResponse<T>`:

```typescript
{
  data: T | null       // Inserted record(s) — only present if .select() is chained
  error: PostgrestError | null
  count: number | null // Only present if count option is set
  status: number       // HTTP status code
  statusText: string
}
```

Note: without chaining `.select()`, `data` is `null` on success. Chain `.select()` to
receive the inserted record(s) back.

### Examples

**Insert a single row (fire-and-forget):**

```typescript
const { error } = await supabase
  .from('referrals')
  .insert({ referral_code: 'ABC123', referrer_email: 'alice@example.com' })

if (error) {
  console.error('Insert failed:', error.message)
}
```

**Insert and return the new record:**

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .insert({ email: 'alice@example.com', referral_code: 'ABC123' })
  .select()

if (error) throw error
console.log('Created waitlist entry:', data)
```

**Bulk insert:**

```typescript
const { error } = await supabase
  .from('referrals')
  .insert([
    { referral_code: 'ABC123', referrer_email: 'alice@example.com', referred_email: 'bob@example.com' },
    { referral_code: 'ABC123', referrer_email: 'alice@example.com', referred_email: 'carol@example.com' },
  ])
```

**Insert and return specific columns only:**

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .insert({ email: 'alice@example.com', referral_code: 'ABC123' })
  .select('email, position, created_at')
```

---

## select()

Fetches rows from a table, with support for column selection, filtering,
ordering, pagination, and related table joins.

### Signature

```typescript
supabase.from('table').select(columns?, options?)
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `columns` | string | No | Comma-separated column names. Omit or use `'*'` for all columns. Supports `alias:column` renaming. |
| `options` | object | No | See options table below |

**options object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `count` | `'exact'` \| `'planned'` \| `'estimated'` | Include row count in response |
| `head` | boolean | Return count only, no data (HEAD request) |

### Return type

```typescript
{
  data: T[] | null
  error: PostgrestError | null
  count: number | null
  status: number
  statusText: string
}
```

### Column selection examples

```typescript
// All columns
const { data } = await supabase.from('waitlist').select()

// Specific columns
const { data } = await supabase.from('waitlist').select('email, referral_count, position')

// Column alias
const { data } = await supabase.from('waitlist').select('email, refCount:referral_count')

// Count only (no row data)
const { count } = await supabase.from('waitlist').select('*', { count: 'exact', head: true })
```

### Filtering

Filters chain directly after `.select()`:

```typescript
// Equality
.eq('column', value)

// Not equal
.neq('column', value)

// Comparison
.gt('column', value)   // greater than
.gte('column', value)  // greater than or equal
.lt('column', value)   // less than
.lte('column', value)  // less than or equal

// Pattern match
.like('column', '%pattern%')
.ilike('column', '%pattern%')  // case-insensitive

// In list
.in('column', ['value1', 'value2'])

// Is null / not null
.is('column', null)
.not('column', 'is', null)

// Range (inclusive)
.range_column('column', [from, to])
```

**Practical filter examples:**

```typescript
// Find waitlist entry by email
const { data, error } = await supabase
  .from('waitlist')
  .select('email, referral_count, position')
  .eq('email', 'alice@example.com')
  .single()

// Find all referrals for a given code
const { data, error } = await supabase
  .from('referrals')
  .select('referred_email, created_at')
  .eq('referral_code', 'ABC123')
  .order('created_at', { ascending: false })
```

### Ordering

```typescript
// Ascending (default)
.order('created_at', { ascending: true })

// Descending
.order('position', { ascending: false })

// Null values last
.order('position', { ascending: true, nullsFirst: false })
```

### Pagination

```typescript
// Limit results
.limit(10)

// Offset-based pagination (0-indexed, inclusive)
.range(0, 9)   // rows 1–10
.range(10, 19) // rows 11–20
```

**Full paginated query example:**

```typescript
const PAGE_SIZE = 20
const page = 0

const { data, count, error } = await supabase
  .from('waitlist')
  .select('email, position, referral_count', { count: 'exact' })
  .order('position', { ascending: true })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

console.log(`Total: ${count}, returned: ${data?.length}`)
```

### Single row shorthand

```typescript
// Returns the row directly (throws if 0 or >1 rows match)
const { data, error } = await supabase
  .from('waitlist')
  .select()
  .eq('email', 'alice@example.com')
  .single()
```

### JSON column access

```typescript
// Arrow notation for JSON fields
.select('metadata->key')      // returns JSON
.select('metadata->>key')     // returns text
```

---

## upsert()

Inserts a row, or updates it if a conflict is detected on a specified column
(typically a primary key or unique constraint).

### Signature

```typescript
supabase.from('table').upsert(values, options?)
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `values` | object \| object[] | **Yes** | Record or array of records. Must include the primary key or conflict column. |
| `options` | object | No | See options table below |

**options object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `onConflict` | string | Column name to check for conflicts. Triggers an UPDATE instead of INSERT when a conflict is found on this column. |
| `ignoreDuplicates` | boolean | If `true`, silently ignores duplicate rows instead of updating. Default: `false`. |
| `count` | `'exact'` \| `'planned'` \| `'estimated'` | Include row count in response. |

### Return type

Same `PostgrestResponse<T>` shape as `insert()`. Chain `.select()` to receive the
upserted record(s) back.

### Examples

**Upsert by primary key (default conflict resolution):**

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .upsert({ email: 'alice@example.com', referral_count: 3 })
  .select()
```

**Upsert on a specific unique column:**

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .upsert(
    { email: 'alice@example.com', referral_count: 3, position: 42 },
    { onConflict: 'email' }
  )
  .select()
```

**Bulk upsert:**

```typescript
const { error } = await supabase
  .from('waitlist')
  .upsert([
    { email: 'alice@example.com', referral_count: 3 },
    { email: 'bob@example.com', referral_count: 1 },
  ], { onConflict: 'email' })
```

**Increment a counter with upsert:**

```typescript
// Pattern: read-increment-upsert (not atomic; use a Postgres function for atomicity)
const { data: existing } = await supabase
  .from('waitlist')
  .select('referral_count')
  .eq('email', referrerEmail)
  .single()

const newCount = (existing?.referral_count ?? 0) + 1

const { error } = await supabase
  .from('waitlist')
  .upsert({ email: referrerEmail, referral_count: newCount }, { onConflict: 'email' })
```

---

## Error Handling

Every query returns `{ data, error }`. Always check `error` before using `data`.

### Error object shape

```typescript
interface PostgrestError {
  message: string   // Human-readable description
  details: string   // Additional context
  hint: string      // Suggested fix
  code: string      // Postgres error code (e.g., "23505" for unique violation)
}
```

### Common Postgres error codes

| Code | Name | Cause |
|------|------|-------|
| `23505` | unique_violation | Insert/update violates unique constraint |
| `23503` | foreign_key_violation | Referenced row does not exist |
| `23502` | not_null_violation | Required column is null |
| `42P01` | undefined_table | Table does not exist |
| `PGRST116` | PostgREST — single row expected | `.single()` matched 0 or >1 rows |

### Standard error handling pattern

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .insert({ email, referral_code })
  .select()

if (error) {
  if (error.code === '23505') {
    // Unique constraint — email already exists
    return { status: 409, body: { error: 'Email already on waitlist' } }
  }
  console.error('Supabase error:', error.message, error.code)
  return { status: 500, body: { error: 'Database error' } }
}

return { status: 200, body: { data } }
```

### Vercel serverless function pattern

```typescript
// src/pages/api/waitlist-join.ts
import type { APIRoute } from 'astro'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

export const POST: APIRoute = async ({ request }) => {
  const { email, referralCode } = await request.json()

  const { data, error } = await supabase
    .from('waitlist')
    .insert({ email, referral_code: referralCode })
    .select('email, position')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    return new Response(JSON.stringify({ error: error.message }), { status })
  }

  return new Response(JSON.stringify({ data }), { status: 200 })
}
```

---

## TypeScript Support

### Generate types from your database schema

Install the Supabase CLI, then run:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

This introspects your live Postgres schema and outputs a `Database` interface
covering all tables, views, functions, and enums.

### Generated type structure

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      waitlist: {
        Row: {           // Shape returned by select()
          id: number
          email: string
          referral_code: string | null
          referral_count: number
          position: number
          created_at: string
        }
        Insert: {        // Shape accepted by insert() — generated columns optional
          id?: never
          email: string
          referral_code?: string | null
          referral_count?: number
          position?: number
          created_at?: string
        }
        Update: {        // Shape accepted by update()/upsert() — all fields optional
          id?: never
          email?: string
          referral_code?: string | null
          referral_count?: number
          position?: number
          created_at?: string
        }
      }
    }
  }
}
```

### Use generated types with createClient

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabase = createClient<Database>(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
)

// Now queries are fully typed — data is inferred automatically
const { data } = await supabase.from('waitlist').select('email, position')
// data: Array<{ email: string; position: number }> | null
```

### Override inferred types

```typescript
const { data } = await supabase
  .from('waitlist')
  .select()
  .overrideTypes<Array<{ email: string; position: number }>>()
```

### Convenience type aliases

```typescript
type WaitlistRow = Database['public']['Tables']['waitlist']['Row']
type WaitlistInsert = Database['public']['Tables']['waitlist']['Insert']
```

---

## Hermetic Flight Integration Notes

This section describes how Supabase would support the referral waitlist feature
for The Hermetic Flight Kickstarter pre-launch campaign.

### Use Case Overview

The referral waitlist allows quiz takers to join a pre-launch waitlist, receive
a unique referral link, and climb the waitlist position by referring others.
Supabase handles all persistence: storing referral codes, recording referral
relationships, and tracking position.

All database access runs from Vercel serverless functions (`src/pages/api/`),
not client-side. The `service_role` key is used server-side so Row Level Security
is bypassed from the API layer, and public API routes apply their own validation.

### Suggested Table: `waitlist`

Primary table — one row per subscriber.

```sql
CREATE TABLE waitlist (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  email         text          NOT NULL UNIQUE,
  referral_code text          NOT NULL UNIQUE,
  referral_count integer      NOT NULL DEFAULT 0,
  position      integer       GENERATED ALWAYS AS IDENTITY,
  created_at    timestamptz   NOT NULL DEFAULT now()
);
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, auto-generated |
| `email` | text | Unique — one entry per subscriber |
| `referral_code` | text | Unique short code (e.g., `ABC123`) assigned on join |
| `referral_count` | integer | Number of successful referrals; drives position movement |
| `position` | integer | Auto-incrementing join order; re-ranked by `referral_count` in application layer |
| `created_at` | timestamptz | Join timestamp |

### Suggested Table: `referrals`

Junction table — one row per referral relationship.

```sql
CREATE TABLE referrals (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code   text          NOT NULL,
  referrer_email  text          NOT NULL,
  referred_email  text          NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (referral_code, referred_email)
);
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, auto-generated |
| `referral_code` | text | The code used when referred_email joined |
| `referrer_email` | text | Who sent the referral link |
| `referred_email` | text | Who clicked it and joined |
| `created_at` | timestamptz | When the referral was recorded |

The unique constraint on `(referral_code, referred_email)` prevents the same
person being credited twice for the same referral.

### Core Query Patterns

**Join the waitlist (new subscriber):**

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .insert({ email, referral_code: generateCode() })
  .select('email, referral_code, position')
  .single()
```

**Record a referral and increment referrer's count:**

```typescript
// 1. Record the referral relationship
const { error: refError } = await supabase
  .from('referrals')
  .insert({ referral_code, referrer_email, referred_email })

// 2. Increment referrer's count (use a Postgres function for atomicity in production)
const { data: referrer } = await supabase
  .from('waitlist')
  .select('referral_count')
  .eq('referral_code', referral_code)
  .single()

await supabase
  .from('waitlist')
  .upsert(
    { email: referrer_email, referral_count: (referrer?.referral_count ?? 0) + 1 },
    { onConflict: 'email' }
  )
```

**Look up waitlist position by email:**

```typescript
const { data, error } = await supabase
  .from('waitlist')
  .select('email, referral_code, referral_count, position')
  .eq('email', email)
  .single()

if (error?.code === 'PGRST116') {
  return { status: 404, body: { error: 'Not on waitlist' } }
}
```

**Count referrals for a given code:**

```typescript
const { count, error } = await supabase
  .from('referrals')
  .select('*', { count: 'exact', head: true })
  .eq('referral_code', referralCode)
```

**Leaderboard — top 10 by referral count:**

```typescript
const { data } = await supabase
  .from('waitlist')
  .select('email, referral_count, position')
  .order('referral_count', { ascending: false })
  .limit(10)
```

### Row Level Security (RLS) Considerations

Because all database access runs from Vercel serverless functions using the
`service_role` key, the service role bypasses RLS entirely. This is intentional
and safe as long as:

1. The `service_role` key is stored only in Vercel environment variables
   (`SUPABASE_SERVICE_ROLE_KEY`) and never exposed client-side.
2. All input validation (email format, rate limiting, referral code existence)
   is enforced in the API route before calling Supabase.
3. RLS policies are still enabled on the tables (best practice), with `anon`
   role having no SELECT/INSERT/UPDATE access. This prevents accidental exposure
   if someone ever initializes a client with the anon key.

**Recommended RLS setup:**

```sql
-- Enable RLS on both tables
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- No public access (service_role bypasses these policies automatically)
-- These policies exist as a safety net, not primary enforcement.
CREATE POLICY "No anon access to waitlist"
  ON waitlist FOR ALL TO anon USING (false);

CREATE POLICY "No anon access to referrals"
  ON referrals FOR ALL TO anon USING (false);
```

### Environment Variables (add to .env and Vercel dashboard)

```bash
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_ANON_KEY=eyJ...        # safe for client-side if RLS is configured
SUPABASE_SERVICE_ROLE_KEY=eyJ... # server-side only — never expose
```

Declare in `src/env.d.ts` alongside the existing `LOOPS_API_KEY` declaration:

```typescript
interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string
  readonly SUPABASE_URL: string
  readonly SUPABASE_ANON_KEY: string
  readonly SUPABASE_SERVICE_ROLE_KEY: string
}
```

### Atomic Counter Update (Production Recommendation)

The read-increment-write pattern for `referral_count` has a race condition under
concurrent requests. For production, use a Postgres function:

```sql
CREATE OR REPLACE FUNCTION increment_referral_count(p_email text)
RETURNS void AS $$
  UPDATE waitlist
  SET referral_count = referral_count + 1
  WHERE email = p_email;
$$ LANGUAGE sql;
```

Call from the serverless function:

```typescript
const { error } = await supabase.rpc('increment_referral_count', {
  p_email: referrerEmail
})
```

---

## Quick Reference

| Operation | Method | Returns data? |
|-----------|--------|---------------|
| Insert one row | `.insert(obj)` | Only with `.select()` |
| Insert many rows | `.insert([...])` | Only with `.select()` |
| Insert or update | `.upsert(obj, { onConflict })` | Only with `.select()` |
| Fetch all rows | `.select()` | Yes |
| Fetch filtered | `.select().eq('col', val)` | Yes |
| Fetch one row | `.select().eq(...).single()` | Yes (throws on mismatch) |
| Count rows | `.select('*', { count: 'exact', head: true })` | count only |
| Paginate | `.select().order().range(from, to)` | Yes |
| Call Postgres fn | `.rpc('function_name', args)` | Yes |
