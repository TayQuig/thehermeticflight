# Vercel Reference — Serverless Functions & Cron Jobs

> Research date: 2026-02-28
> Sources: vercel.com/docs/limits, vercel.com/docs/cron-jobs/usage-and-pricing, vercel.com/docs/functions/limitations, docs.astro.build/en/guides/integrations-guide/vercel/

---

## Free Tier (Hobby Plan) — Included Usage

| Resource | Hobby (Free) | Pro ($20/mo) |
|----------|-------------|-------------|
| Function invocations | 1,000,000 | 1,000,000 (then $0.60/million) |
| Active CPU time | 4 CPU-hours | Pay-as-you-go |
| Provisioned memory time | 360 GB-hours | Pay-as-you-go |
| Fast data transfer | 100 GB | 1 TB |
| Build minutes | 6,000 min | Pay-as-you-go |
| Deployments/day | 100 | 6,000 |

Source: https://vercel.com/docs/limits

### Capacity Analysis for This Use Case

**Function invocations:** 1,000,000/month is generous. The pipeline would use:
- Quiz form submissions: ~100-500/month (optimistic)
- Drip cron job executions: 1/day = ~30/month
- Unsubscribe endpoint hits: ~10-50/month
- **Total: well under 1,000 invocations/month**, leaving 999,000+ headroom.

**CPU time:** At 4 CPU-hours/month, each drip send processing 100 subscribers might take 2-5 seconds of CPU time. 30 days x 5s = 150s = 2.5 minutes. Extreme headroom.

## Cron Job Limits

| Metric | Hobby (Free) | Pro ($20/mo) |
|--------|-------------|-------------|
| Cron jobs per project | 100 | 100 |
| **Minimum interval** | **Once per day** | Once per minute |
| Scheduling precision | Hourly (+/- 59 min) | Per-minute |

Source: https://vercel.com/docs/cron-jobs/usage-and-pricing

### CRITICAL CONSTRAINT: Hobby Cron = Once Per Day Only

**This is the most significant limitation for the drip scheduler.**

On the Hobby plan:
1. Cron jobs can only execute **once per day**
2. Expressions that would run more frequently **fail during deployment**
3. Timing is imprecise: a job scheduled for 1:00 AM may execute anywhere between 1:00 AM and 1:59 AM

**Impact on drip scheduling:**
- A once-daily cron is sufficient for daily drip emails (the most common cadence)
- Cannot do hourly, every-6-hours, or sub-daily scheduling
- The timing imprecision means emails arrive in a ~60-minute window, not at an exact time
- For a small creative business, this is acceptable — subscribers won't notice a 30-minute variance

**If sub-daily scheduling is needed later:** Upgrade to Pro ($20/mo) for per-minute precision.

### Cron Job Configuration in Astro

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/drip-scheduler",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs the drip scheduler daily at ~9:00 AM UTC (with Hobby-tier imprecision).

## Serverless Function Limits

| Metric | Hobby (Free) | Pro ($20/mo) |
|--------|-------------|-------------|
| Max execution duration | 300s (5 min) | 800s (13 min) |
| Max memory | 2 GB / 1 vCPU | 4 GB / 2 vCPU |
| Bundle size (compressed) | 250 MB | 250 MB |
| Request/response body | 4.5 MB | 4.5 MB |
| Concurrency | Up to 30,000 | Up to 30,000 |
| File descriptors | 1,024 (shared) | 1,024 (shared) |

Source: https://vercel.com/docs/functions/limitations

### Analysis

**5-minute execution time** is more than enough for:
- Processing a quiz submission and writing to Supabase: ~1-2 seconds
- Running the drip scheduler (query subscribers + send via Resend batch API): ~5-30 seconds for 100 subscribers
- Handling an unsubscribe request: <1 second

**4.5 MB body limit** is relevant if email templates include large inline images (unlikely — best practice is to host images and link to them).

## Astro on Vercel — SSR Configuration

### Adapter Setup
```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  adapter: vercel(),
  output: 'server',  // or use hybrid with per-page opt-in
});
```

### Hybrid Rendering (Recommended for This Project)

Most pages are static (content site). Only API routes need SSR:

```javascript
// astro.config.mjs
export default defineConfig({
  adapter: vercel(),
  // Default is static; opt-in to SSR per page/route
});
```

Then in API routes:
```typescript
// src/pages/api/subscribe.ts
export const prerender = false; // This route is server-rendered

export const POST: APIRoute = async ({ request }) => {
  // Handle quiz submission
};
```

Source: https://docs.astro.build/en/guides/integrations-guide/vercel/

### Known Gotchas

1. **ISR requests strip search params** — not relevant for API routes, but important if using ISR elsewhere
2. **Edge middleware serializes `context.locals` as JSON** — if using edge middleware, locals must be JSON-serializable
3. **Module resolution errors** — some community reports of `dist/server/entry.mjs` not found errors in production. Ensure `@astrojs/vercel` is up to date.
4. **`.vercel/output` directory** — add to `.gitignore`
5. **Node.js version** — verify Vercel project settings match your local Node version

### Environment Variables

Required env vars for the pipeline:
```
RESEND_API_KEY=re_xxxxxxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxx
SUPABASE_ANON_KEY=eyJxxxxxxx
CRON_SECRET=your-secret-to-verify-cron-requests
```

**Security:** The `CRON_SECRET` is used to verify that cron job requests actually come from Vercel, not from external sources hitting your API endpoint directly.

### Vercel Cron Authentication Pattern

```typescript
// src/pages/api/drip-scheduler.ts
export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${import.meta.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... run drip logic
};
```

## Rate Limits (API/Platform)

| Action | Hobby Limit | Duration |
|--------|-------------|----------|
| Deployments/day | 100 | 24 hours |
| Deployments/hour | 100 | 1 hour |
| Builds/hour | 32 | 1 hour |
| Deploy hook triggers/hour | 60 | 1 hour |

Source: https://vercel.com/docs/limits

These are platform management limits, not function execution limits. None of these are relevant to the email pipeline's runtime operation.

## Cost Projection: Hobby vs Pro

| Scenario | Hobby (Free) | Pro ($20/mo) |
|----------|-------------|-------------|
| Drip scheduling | 1x daily (sufficient for most cases) | Per-minute precision |
| Function invocations | 1M included (far more than needed) | 1M + $0.60/million |
| Cron timing | +/- 59 minutes | Exact |

**Recommendation:** Start on Hobby. Upgrade to Pro only if sub-daily drip scheduling or precise timing becomes a business requirement.
