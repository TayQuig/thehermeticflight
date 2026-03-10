# Supabase Reference — Subscriber Storage

> Research date: 2026-02-28
> Sources: supabase.com/pricing, supabase.com/docs/guides/platform/billing-on-supabase, supabase.com/docs/guides/database/postgres/row-level-security

---

## Free Tier Limits

| Resource | Free Tier | Pro ($25/mo) |
|----------|-----------|-------------|
| Database storage | 500 MB | 8 GB (then $0.125/GB) |
| File storage | 1 GB | 100 GB (then $0.021/GB) |
| Auth MAUs | 50,000 | 100,000 (then $0.00325/MAU) |
| Edge function invocations | 500,000 | 2,000,000 (then $2/million) |
| Realtime messages | 2,000,000 | 5,000,000 (then $2.50/million) |
| Realtime peak connections | 200 | 500 (then $10/1000) |
| Data egress | 5 GB | 250 GB (then $0.09/GB) |
| Projects allowed | 2 | Unlimited |

Source: https://supabase.com/docs/guides/platform/billing-on-supabase

### Capacity Analysis for This Use Case

A subscriber table with 1,000 rows, each containing:
- email (varchar): ~30 bytes
- name (varchar): ~50 bytes
- quiz_results (jsonb): ~500 bytes
- drip_position (int): 4 bytes
- subscribed_at (timestamp): 8 bytes
- unsubscribed (boolean): 1 byte
- metadata (jsonb): ~200 bytes

**Per row: ~800 bytes. 1,000 subscribers: ~0.8 MB.**

The 500 MB database limit is approximately 625,000 subscribers. This is not a constraint for this use case.

**Egress analysis:** A cron job querying 50 subscribers per day for drip sends = trivial. Even with 1,000 API calls/day at 1 KB response each, that's 1 MB/day = 30 MB/month. The 5 GB limit is not a concern.

## Critical Constraint: Auto-Pause Policy

**Free tier projects are paused after 7 days of inactivity.**

Source: https://supabase.com/docs/guides/platform/billing-on-supabase (implied via community discussions and the paused project behavior)

### Impact on This Use Case

If the drip scheduler (Vercel Cron) queries Supabase at least once every 7 days, the project stays active. A daily cron job completely prevents pausing. This is not a risk — it's an inherent benefit of the drip scheduler architecture.

### Workarounds (If Needed)

If for some reason the cron job stops running:
1. **GitHub Actions keepalive** — a scheduled workflow that pings the database every 3 days
2. **Manual resume** — paused projects retain data and can be manually resumed in the dashboard
3. **90-day deletion warning** — paused projects are retained for 90 days before data deletion risk

Source: https://github.com/orgs/supabase/discussions/27497, https://github.com/travisvn/supabase-pause-prevention

## Row Level Security (RLS)

Supabase RLS enables Postgres-native row-level authorization.

### Recommended Setup for Subscriber Data

For this use case, the subscriber table is accessed exclusively by serverless functions using the **service role key** (bypasses RLS). Public-facing API access should be locked down:

```sql
-- Enable RLS on the subscribers table
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- No public access policies = no public access
-- Service role key bypasses RLS automatically

-- If admin access is needed via Supabase client:
CREATE POLICY "Admin can read all subscribers"
  ON subscribers
  FOR SELECT
  USING (auth.role() = 'service_role');
```

### Security Best Practices

1. **Never expose the service role key in client-side code** — only use it in serverless functions
2. **Enable RLS on ALL tables** from day one
3. **Use the `anon` key** for client-facing operations (quiz submission form) with restrictive INSERT-only policies
4. **Index columns used in RLS policies** for performance

Source: https://supabase.com/docs/guides/database/postgres/row-level-security

### Recommended RLS Policy for Quiz Submissions

```sql
-- Allow anonymous users to INSERT their own quiz submissions
CREATE POLICY "Anyone can submit quiz"
  ON subscribers
  FOR INSERT
  WITH CHECK (true);  -- Quiz form is public

-- Prevent anonymous reads (subscriber list is private)
-- No SELECT policy for anon = denied by default with RLS enabled
```

## Edge Functions

| Metric | Free Tier Limit |
|--------|----------------|
| Invocations | 500,000/month |
| Max function size (bundled) | 20 MB |
| Max CPU time per request | 2 seconds |

Edge functions could be used as an alternative to Vercel serverless functions for email sending. However, using Vercel functions keeps the stack simpler (one deployment platform).

Source: https://supabase.com/docs/guides/functions/limits

## Postgres Features Available (Free Tier)

The free tier provides full Postgres functionality:
- **JSONB columns** — store quiz results and metadata as structured JSON
- **Full-text search** — available but not needed for this use case
- **Triggers and functions** — can automate subscriber lifecycle events
- **Scheduled functions** — via pg_cron extension (available on Pro only, not free)
- **Extensions** — most Postgres extensions are available

### Relevant Schema Design

```sql
CREATE TABLE subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  quiz_results JSONB,
  quiz_archetype TEXT,          -- computed result for segmentation
  drip_sequence TEXT DEFAULT 'default',
  drip_position INT DEFAULT 0,
  next_drip_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  is_subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for the drip scheduler query
CREATE INDEX idx_subscribers_next_drip
  ON subscribers (next_drip_at)
  WHERE is_subscribed = true;

-- Index for email lookups (unsubscribe endpoint)
CREATE INDEX idx_subscribers_email
  ON subscribers (email);
```

## API Access Patterns

Supabase provides multiple API access methods, all available on the free tier:

1. **REST API** (auto-generated from schema via PostgREST)
2. **JavaScript client** (`@supabase/supabase-js`)
3. **Direct Postgres connection** (connection string)

For serverless functions, the JavaScript client is the recommended approach:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Server-side only
);

// Query subscribers due for drip email
const { data: subscribers } = await supabase
  .from('subscribers')
  .select('*')
  .eq('is_subscribed', true)
  .lte('next_drip_at', new Date().toISOString())
  .order('next_drip_at', { ascending: true })
  .limit(100);
```
