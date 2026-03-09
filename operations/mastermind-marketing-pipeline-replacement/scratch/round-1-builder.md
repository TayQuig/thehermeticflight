# Round 1: Builder Analysis

## Role: The Builder (Pragmatic Implementation)

---

## 1. Codebase Audit: What We're Actually Working With

### Astro Project (Verified State)

| Component | Version / Config | Implication |
|-----------|-----------------|-------------|
| Astro | 5.16.4 | Latest stable. Full support for hybrid rendering, server islands, content collections. |
| `@astrojs/vercel` | 9.0.2 | Supports `output: 'static'` with per-route `prerender = false` opt-out. Already proven by `seobot.ts`. |
| `output` mode | `static` (astro.config.mjs:10) | Default is static generation. API routes must explicitly set `export const prerender = false;` to run as serverless functions. The seobot webhook already does this correctly -- we copy this pattern exactly. |
| Tailwind | 3.4.x with `@tailwindcss/typography` | Standard utility setup. Custom theme colors defined in `tailwind.config.mjs` under `hermetic.*`. |
| Existing API route | `src/pages/api/webhooks/seobot.ts` | Exports `prerender = false` + `POST: APIRoute`. Uses `import.meta.env.*` for secrets. This is the template for every serverless function we build. |
| Quiz page | `src/pages/quiz.astro` | Currently an iframe embed pointing to `tally.so/embed/QK7v5Y`. Listens for `Tally.FormSubmit` postMessage, then redirects to `/thank-you`. |
| Thank-you page | `src/pages/thank-you.astro` | Fires `fbq('track', 'Lead')` in the `<head>` slot. Static content about archetype reveal and Kickstarter early access. Currently shows no personalized result. |
| Layout | `src/layouts/Layout.astro` | Includes GTM, GA4, Meta Pixel globally. Has a `<slot name="head" />` for per-page script injection. |

### Prior Python Classifier (Verified State)

The archetype logic from `archetypes.py` is straightforward and fully portable to TypeScript:

- **4 input integers:** A (Air Weaver), B (Embodied Intuitive), C (Ascending Seeker), D (Shadow Dancer)
- **Priority cascade:** (1) Grounded Mystic if A>B, A>C, D>B, D>C; (2) Flow Artist if B>A, B>D, C>A, C>D; (3-6) Single-highest with Ascending Seeker as fallback
- **Output:** archetype key + display name + tag string
- **No external dependencies.** Pure conditional logic. ~30 lines of TypeScript.

The `field_map.py` is irrelevant in the new architecture -- we control the form fields directly, no Tally field ID mapping needed.

The `mailchimp.py` pattern (upsert subscriber, apply tags) maps directly to the Supabase insert + Resend API call pattern.

### Key Observations

1. **No existing TypeScript source files** beyond `seobot.ts` and `config.ts`. The project has zero shared utility code. Every new file we create is net-new.
2. **No existing `.env` file** in the repo (gitignored correctly). Environment variables are managed through Vercel's dashboard, accessed via `import.meta.env.*`.
3. **No `vercel.json`** exists. Vercel cron jobs will require creating one.
4. **The `content/config.ts`** defines blog and FAQ collections. We will add no new collections -- subscriber data lives in Supabase, not in Astro content.
5. **Current quiz flow:** Homepage CTA -> `/quiz` (Tally iframe) -> Tally handles everything -> postMessage fires -> JS redirects to `/thank-you` -> Lead pixel fires. The new flow must preserve the Lead pixel firing at the same point.

---

## 2. File Map: Every Component to Its File

### New Files to Create

```
src/
  lib/
    classifier.ts              # Archetype classification logic (port from Python)
    supabase.ts                # Supabase client initialization
    resend.ts                  # Resend client initialization
    quiz-questions.ts          # Quiz question data + scoring weights
    email-templates/
      archetype-result.ts      # Immediate result email (HTML template)
      drip-week-1.ts           # Week 1 drip email template
      drip-week-2.ts           # Week 2 drip email template
      ...                      # (through week-8.ts)
      drip-week-8.ts           # Week 8 drip email template
  components/
    QuizForm.astro             # Native quiz form component (replaces Tally iframe)
    QuizStep.astro             # Individual question step UI
    ProgressBar.astro          # Visual progress indicator
  pages/
    quiz.astro                 # MODIFY: Replace Tally iframe with native QuizForm
    thank-you.astro            # MODIFY: Accept archetype param, show personalized result
    api/
      quiz/
        submit.ts              # POST: Accept quiz answers, classify, store, send email
      cron/
        drip-sender.ts         # GET: Vercel cron handler -- send due drip emails

vercel.json                    # NEW: Cron job schedule configuration
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/quiz.astro` | Gut Tally iframe. Import and render `QuizForm.astro`. |
| `src/pages/thank-you.astro` | Accept `?archetype=xxx` query param. Show personalized archetype name and description. Keep `fbq('track', 'Lead')` pixel. |
| `package.json` | Add `@supabase/supabase-js`, `resend` dependencies. |
| `.gitignore` | Already handles `.env` -- no change needed. |

### Files Left Untouched

Everything else: `index.astro`, `Layout.astro`, `Header/Footer.astro`, `global.css`, `tailwind.config.mjs`, `astro.config.mjs`, all blog/FAQ content.

---

## 3. Dependencies

| Package | Version | Purpose | Free Tier |
|---------|---------|---------|-----------|
| `@supabase/supabase-js` | `^2.49.x` | Supabase client for subscriber CRUD | 500MB DB, 50K rows, 2GB transfer |
| `resend` | `^4.1.x` | Email delivery API client | 3,000 emails/month, 100/day |
| *(no additional Astro packages)* | -- | Astro + Vercel adapter already installed | -- |

**That's it.** Two npm packages. The entire pipeline runs on Astro's built-in API route system + Vercel's existing infrastructure.

**External accounts to create:**
- Supabase project (free tier) -- for the subscriber database
- Resend account (free tier) -- for email delivery
- Domain DNS verification for Resend (SPF/DKIM records on thehermeticflight.com)

---

## 4. Database Schema (Supabase)

### Table: `subscribers`

```sql
CREATE TABLE subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  first_name    TEXT,
  archetype     TEXT NOT NULL,
  scores        JSONB NOT NULL,          -- { air_weaver: 12, embodied_intuitive: 8, ... }
  drip_position INT DEFAULT 0,           -- 0 = welcome sent, 1 = week 1 sent, etc.
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for cron job queries
CREATE INDEX idx_subscribers_drip ON subscribers (drip_position, unsubscribed, subscribed_at)
  WHERE unsubscribed = false;
```

**Why this shape:**
- `drip_position` is the key scheduling field. The cron job queries: "give me all subscribers where `drip_position < 8` AND `subscribed_at + (drip_position + 1) * 7 days <= now()` AND `unsubscribed = false`."
- `scores` as JSONB preserves the raw dimension data for future segmentation without schema migrations.
- `UNIQUE` on email handles re-submissions gracefully -- upsert on conflict.

### Table: `email_log`

```sql
CREATE TABLE email_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID REFERENCES subscribers(id),
  email_type    TEXT NOT NULL,            -- 'archetype_result' | 'drip_week_1' | ... | 'drip_week_8'
  resend_id     TEXT,                     -- Resend's message ID for tracking
  sent_at       TIMESTAMPTZ DEFAULT now()
);
```

**Why:** Audit trail. Know exactly what was sent and when. Debug delivery issues without guessing.

---

## 5. Build Order (Phases)

### Phase 1: Foundation (MVP -- Quiz + Classify + Store)

**Goal:** Replace Tally form with native form. Quiz submission stores data in Supabase. No emails yet.

**Files:**
1. `src/lib/quiz-questions.ts` -- Define the 20 questions with answer-to-dimension scoring weights
2. `src/lib/classifier.ts` -- Port the Python classify() function to TypeScript
3. `src/lib/supabase.ts` -- Initialize Supabase client from `import.meta.env.SUPABASE_URL` + `SUPABASE_ANON_KEY`
4. `src/components/ProgressBar.astro` -- Visual step indicator
5. `src/components/QuizStep.astro` -- Single question display with answer options
6. `src/components/QuizForm.astro` -- Multi-step form container with client-side navigation, final submit
7. `src/pages/quiz.astro` -- Replace Tally iframe with QuizForm component
8. `src/pages/api/quiz/submit.ts` -- API route: receive answers, classify, insert to Supabase, return archetype
9. `src/pages/thank-you.astro` -- Modify to read `?archetype=` param, show personalized result

**Verification:**
- [ ] Fill out quiz locally, submit, check Supabase dashboard for row
- [ ] Archetype shown on thank-you page matches expected classification
- [ ] `fbq('track', 'Lead')` still fires on thank-you page
- [ ] Deploy to Vercel preview, test end-to-end

**Environment variables needed (Vercel dashboard):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` for server-side inserts)

### Phase 2: Immediate Email (Archetype Result)

**Goal:** After quiz submission, subscriber receives their archetype result email via Resend.

**Files:**
1. `src/lib/resend.ts` -- Initialize Resend client from `import.meta.env.RESEND_API_KEY`
2. `src/lib/email-templates/archetype-result.ts` -- HTML email template function that takes archetype data and returns formatted HTML
3. `src/pages/api/quiz/submit.ts` -- MODIFY: After Supabase insert, call Resend to send result email

**Verification:**
- [ ] Submit quiz, receive email in inbox within 30 seconds
- [ ] Email renders correctly in Gmail, Apple Mail, Outlook
- [ ] Check Resend dashboard for delivery confirmation
- [ ] From address: `readings@thehermeticflight.com` (requires DNS verification)

**Environment variables added:**
- `RESEND_API_KEY`

**DNS records needed (one-time setup):**
- Resend SPF record
- Resend DKIM record(s)
- Verify domain in Resend dashboard

### Phase 3: Drip Sequence Engine

**Goal:** Automated weekly emails based on subscriber's archetype, sent via Vercel cron.

**Files:**
1. `src/lib/email-templates/drip-week-1.ts` through `drip-week-8.ts` -- Template functions, each taking archetype data
2. `src/pages/api/cron/drip-sender.ts` -- Cron handler: query due subscribers, send appropriate drip email, increment `drip_position`
3. `vercel.json` -- Configure cron schedule

**Cron handler logic (`drip-sender.ts`):**
```
1. Verify cron secret (CRON_SECRET header from Vercel)
2. Query Supabase: subscribers WHERE unsubscribed = false
   AND drip_position < 8
   AND subscribed_at + (drip_position + 1) * 7 days <= now()
3. For each due subscriber:
   a. Select template by drip_position + 1
   b. Send via Resend with archetype personalization
   c. Increment drip_position
   d. Log to email_log
4. Return count of emails sent
```

**`vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/drip-sender",
      "schedule": "0 14 * * *"
    }
  ]
}
```
(Runs daily at 2pm UTC / 9am ET. Only sends to subscribers whose 7-day window has elapsed.)

**Verification:**
- [ ] Manually trigger cron endpoint with test subscriber who is "due"
- [ ] Correct drip email received with correct archetype personalization
- [ ] `drip_position` incremented in Supabase
- [ ] `email_log` row created
- [ ] Subscriber who already received all 8 is not queried

**Environment variables added:**
- `CRON_SECRET` (Vercel auto-sets this for cron endpoints)

### Phase 4: Unsubscribe + Compliance

**Goal:** CAN-SPAM compliant unsubscribe mechanism.

**Files:**
1. `src/pages/api/unsubscribe.ts` -- GET endpoint: `?token=xxx` sets `unsubscribed = true`
2. All email templates -- MODIFY: Add unsubscribe link footer with subscriber-specific token
3. `src/lib/email-templates/` -- Add shared footer partial with physical address + unsubscribe link

**Token strategy:** Base64-encode `subscriber_id:email` with HMAC signature. No JWT library needed -- `crypto.subtle.sign()` works in Vercel's edge/serverless runtime.

**Verification:**
- [ ] Click unsubscribe link in email -> subscriber marked unsubscribed in Supabase
- [ ] Unsubscribed subscriber receives no further drip emails
- [ ] All emails include physical mailing address (CAN-SPAM requirement)
- [ ] Unsubscribe page shows confirmation message

---

## 6. Critical Architecture Decisions

### Decision 1: Client-side multi-step form vs. server-rendered steps

**Recommendation: Client-side with vanilla JS.**

The quiz is 20 questions. Rendering all 20 as hidden divs on initial page load, then toggling visibility with vanilla JS, avoids:
- 20 server round-trips for step navigation
- React/Preact/Solid dependency for a single interactive component
- Hydration complexity

The final submit is the only network call: a single `fetch('/api/quiz/submit', { method: 'POST', body: JSON.stringify(answers) })`.

**Trade-off:** The initial HTML payload is larger (~20 questions rendered). For 20 questions with 4 options each, this is roughly 15-20KB of HTML -- negligible on any connection.

### Decision 2: Score calculation -- client-side vs. server-side

**Recommendation: Server-side only.**

The scoring weights and classification logic live exclusively in `src/lib/classifier.ts`, executed inside the `/api/quiz/submit` serverless function. The client sends raw answer selections (e.g., `{ q1: "a", q2: "c", ... }`), and the server maps answers to dimension scores and classifies.

**Why:** Prevents score manipulation. Users can't inspect the scoring algorithm in devtools. The archetype result is authoritative because the server computed it.

### Decision 3: Supabase anon key vs. service role key

**Recommendation: Use `SUPABASE_SERVICE_ROLE_KEY` in serverless functions.**

The quiz submit and cron endpoints run server-side. They need to INSERT subscribers and UPDATE drip positions without Row Level Security constraints. The service role key bypasses RLS entirely. Since these keys never reach the client (they're only in Vercel's server environment), this is secure.

**Do NOT** use the anon key for server-side writes -- it would require configuring RLS policies that allow anonymous inserts, which is a wider attack surface.

### Decision 4: Email template approach

**Recommendation: TypeScript functions returning HTML strings.**

No template engine (Handlebars, MJML, etc.). Each template is a function:

```typescript
export function archetypeResultEmail(data: {
  firstName: string;
  archetype: string;
  archetypeDescription: string;
  unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html><html>...${data.firstName}...${data.archetype}...</html>`;
}
```

**Why:** Zero dependencies. Full TypeScript type safety on template variables. Easy to test -- call the function, check the output string. Email HTML is inherently limited (table-based layout), so a template engine adds complexity without meaningful benefit.

### Decision 5: Quiz data structure

**Recommendation: Question data as a typed constant array.**

```typescript
// src/lib/quiz-questions.ts
export interface QuizQuestion {
  id: string;           // "q1", "q2", ...
  text: string;         // The question text
  options: {
    label: string;      // Display text
    value: string;      // "a", "b", "c", "d"
    scores: {           // Which dimensions this answer adds to
      air_weaver: number;
      embodied_intuitive: number;
      ascending_seeker: number;
      shadow_dancer: number;
    };
  }[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ... 20 questions
];
```

The operator will need to populate the actual question text and scoring weights. This is the one piece that requires domain knowledge from the existing Tally form -- we need the exact questions and which dimension each answer maps to.

---

## 7. Complexity Risks & Mitigations

### Risk 1: Email Deliverability (HIGH)

**Problem:** Self-managed email is the single most likely failure point. Emails landing in spam kills the entire pipeline.

**Mitigation:**
- Use Resend (built by the Vercel team, optimized for transactional email)
- Verify domain with SPF + DKIM before sending anything
- Start with a low-volume warm-up period
- Send from a subdomain (`mail.thehermeticflight.com`) to protect the root domain reputation
- Monitor Resend's deliverability dashboard actively for the first 30 days

**Escape hatch:** If deliverability is unacceptable, swap Resend client for Amazon SES or keep Mailchimp for delivery only (still cheaper than Mailchimp + Tally + Zapier).

### Risk 2: Quiz Question Data Migration (MEDIUM)

**Problem:** The 20 Tally questions and their dimension-scoring logic exist only inside the Tally form builder. There's no export.

**Mitigation:** The operator needs to manually extract or recall the question text and scoring from Tally's editor before we can build `quiz-questions.ts`. This is a hard dependency for Phase 1 -- flag it early.

**Action item:** Before build begins, operator exports/screenshots all 20 Tally quiz questions with their scoring mappings.

### Risk 3: Vercel Cron Free Tier Limits (MEDIUM)

**Problem:** Vercel Hobby plan allows 2 cron jobs, with a maximum frequency of once per day. Serverless function timeout is 10 seconds on Hobby.

**Mitigation:**
- We only need 1 cron job (the drip sender). This fits the 2-job limit.
- Daily execution is sufficient for a weekly drip cadence.
- 10-second timeout: If the subscriber list grows large, we batch. Query subscribers in pages of 50, send emails per batch. Resend's batch API can send up to 100 emails per API call.

**Escalation point:** If the list exceeds ~500 active drip subscribers, the 10-second timeout may become tight. At that scale, the operator is generating enough revenue to justify Vercel Pro ($20/mo, 300s timeout).

### Risk 4: Resend Free Tier Cap (LOW for now)

**Problem:** Resend free tier = 3,000 emails/month, 100/day.

**Math:** If 10 new subscribers/day, each gets 1 immediate email = 10/day. Plus drip emails for existing subscribers. With 200 active subscribers in various drip stages, worst case ~30 drip emails/day. Total: ~40/day, well within 100/day limit. Monthly: ~1,200, within 3,000.

**Break point:** ~60 new subscribers/day sustained. At that point, upgrade to Resend's $20/mo plan (50K emails/month).

### Risk 5: Form UX Regression (MEDIUM)

**Problem:** Tally's multi-step form UX is polished. Our native replacement needs to feel equally smooth or the conversion rate drops.

**Mitigation:**
- Match Tally's visual pattern: one question per screen, progress bar, smooth transitions
- Use the existing site's design language (glass-panel, hermetic colors, Cinzel/Lato fonts)
- Add CSS transitions between steps (`opacity` + `transform` transitions, no JS animation library)
- Test on mobile first -- quiz traffic is likely 60%+ mobile

---

## 8. What the Operator Needs to Provide

Before build begins, the operator must supply:

1. **The 20 quiz questions** with their full text and answer options, plus which dimension(s) each answer scores for and by how much. Export or screenshot from Tally.
2. **Archetype descriptions** -- the full text shown in result emails and on the thank-you page for each of the 6 archetypes (The Air Weaver, The Embodied Intuitive, The Ascending Seeker, The Shadow Dancer, The Flow Artist, The Grounded Mystic).
3. **Drip email content** -- the actual email body text for weeks 1-8 of each archetype track (this can come in phases; we can launch with just the immediate result email and add drip content later).
4. **Physical mailing address** for CAN-SPAM footer.
5. **Supabase account** created (free tier).
6. **Resend account** created (free tier).

Items 1-2 are hard blockers for Phase 1. Items 3-4 are blockers for Phases 2-4 but can be developed with placeholder content. Items 5-6 are blockers for deployment but not for local development (we can mock in dev).

---

## 9. Cost Comparison

| Component | Current Monthly Cost | New Monthly Cost |
|-----------|---------------------|------------------|
| Tally.so (form builder) | $0-29 | $0 (native Astro form) |
| Zapier (automation + Python) | $20-70 | $0 (Vercel serverless) |
| Mailchimp (email delivery + drip) | $13-20 | $0 (Resend free tier up to 3K/mo) |
| **Total** | **$50-100/mo** | **$0/mo** |

Break-even on paid tiers (if scale demands it): Resend $20/mo at ~60 new subs/day. Vercel Pro $20/mo at ~500 active drip subscribers. Both thresholds indicate meaningful traction -- the kind of problem you want to have.

---

## 10. Proposed Build Sequence (Session-Level)

| Session | Phase | Deliverable | Verification |
|---------|-------|-------------|--------------|
| 1 | Foundation prep | `classifier.ts`, `quiz-questions.ts` (structure + test data), `supabase.ts` client, Supabase tables created | Unit test classifier against known Python outputs |
| 2 | Quiz UI | `QuizForm.astro`, `QuizStep.astro`, `ProgressBar.astro`, modified `quiz.astro` | Visual review in dev server, multi-step navigation works |
| 3 | Submit flow | `api/quiz/submit.ts`, modified `thank-you.astro` | End-to-end: quiz -> API -> Supabase row -> personalized thank-you |
| 4 | Email integration | `resend.ts`, `archetype-result.ts` template, DNS verification | Submit quiz -> email in inbox |
| 5 | Drip engine | `drip-sender.ts` cron, `vercel.json`, 2 template stubs | Manual cron trigger -> drip email sent -> position incremented |
| 6 | Compliance | `unsubscribe.ts`, email footer partial, remaining drip templates | Full lifecycle test: subscribe -> receive drips -> unsubscribe -> silence |
| 7 | Migration | Swap Tally iframe to native form on production, monitor | A/B compare conversion rates for 1 week before killing Tally |

---

## 11. What I Would Type First

Assuming Phase 1 approval and quiz data in hand:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm install @supabase/supabase-js resend
mkdir -p src/lib/email-templates src/components src/pages/api/quiz src/pages/api/cron
```

Then create `src/lib/classifier.ts` -- the smallest, most testable piece with zero external dependencies. Verify it matches the Python output. Everything else builds on top of it.
