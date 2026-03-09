# Round 1 -- Designer Analysis

## System Being Replaced

The current pipeline has three external services in a linear chain:

```
Tally.so (quiz form, iframe on /quiz)
  --> Zapier (webhook receiver, runs Python: scores answers, classifies archetype)
    --> Mailchimp (subscriber store, tag-based drip sequences)
```

Cost: $50-100/mo. Every piece is a black box we do not own.

## Existing Codebase Constraints

Before proposing anything, here is what the project already is and what any design must respect:

| Constraint | Detail |
|---|---|
| **Framework** | Astro 5 (`astro@^5.16.4`), TypeScript, Tailwind 3 |
| **Render mode** | `output: 'static'` with Vercel adapter -- SSG by default, selective SSR via `export const prerender = false` |
| **Adapter** | `@astrojs/vercel` -- serverless functions for API routes |
| **Existing API pattern** | `src/pages/api/webhooks/seobot.ts` -- demonstrates: prerender=false, `APIRoute` export, `import.meta.env` for secrets, JSON request/response, error handling |
| **Env vars** | Stored in Vercel dashboard, accessed via `import.meta.env.*` |
| **Client-side JS** | Minimal. `<script>` and `<script is:inline>` blocks. No React/Vue/Svelte -- pure vanilla JS |
| **Design system** | Hermetic theme: `glass-panel`, `btn-flame`, `reveal-up` animations, Cinzel + Lato fonts, emerald/gold/sulfur/void palette |
| **Tracking** | GTM, Google Analytics, Meta Pixel (FB). Thank-you page fires `fbq('track', 'Lead')` |
| **Content** | Astro Content Collections (`blog`, `faq`) with Zod schemas |
| **No vercel.json** | All config via `astro.config.mjs` and Vercel dashboard |
| **No React** | Zero .tsx/.jsx component files. Everything is `.astro` |

## Existing Business Logic to Port

The Python classifier (`archetypes.py`) implements a priority-based decision tree over 4 dimension scores:

```
Inputs:  A (Air Weaver), B (Embodied Intuitive), C (Ascending Seeker), D (Shadow Dancer)
         Each is an integer score derived from 20 quiz questions (5 per dimension).

Rules (first match wins):
  1. Grounded Mystic    -- A > B AND A > C AND D > B AND D > C
  2. Flow Artist        -- B > A AND B > D AND C > A AND C > D
  3. Air Weaver         -- A >= max(B, C, D)
  4. Embodied Intuitive -- B >= max(A, C, D)
  5. Shadow Dancer      -- D >= max(A, B, C)
  6. Ascending Seeker   -- fallback

Output: archetype key, display name, tag string
```

This is a pure function. No external dependencies. Direct port to TypeScript.

---

## Component Architecture

Seven components, organized in three layers.

### Layer 1: Client (Browser)

#### Component: QuizUI

**Responsibility:** Render 20 questions, collect answers, compute dimension scores client-side, submit results to API.

**Location:** `src/pages/quiz.astro` (replaces current Tally iframe)

**Boundaries:**
- Receives: nothing (static page, quiz data is embedded at build time)
- Produces: HTTP POST to `/api/quiz/submit` with payload

**Interface -- outbound payload:**
```typescript
// POST /api/quiz/submit
interface QuizSubmission {
  email: string;
  firstName: string;  // optional but valuable for email personalization
  answers: Record<string, number>;  // questionId -> selected option value
  scores: {
    airWeaver: number;
    embodiedIntuitive: number;
    ascendingSeeker: number;
    shadowDancer: number;
  };
  archetype: string;  // computed client-side for instant display
  // Client-side archetype is used ONLY for the instant result screen.
  // Server re-computes authoritatively. Never trust client scores for storage.
}
```

**Key design decisions:**
- Quiz questions and scoring weights are defined in a static data file (`src/data/quiz-questions.ts`), imported at build time into the Astro page, and serialized into a `<script>` tag as JSON. This keeps the quiz fast (no API call to load questions) and the data in one canonical location.
- Scoring and archetype classification happen client-side in vanilla JS for instant result display -- the user sees their archetype immediately after the last question. No loading spinner, no round-trip.
- The same classification algorithm exists in both client JS and server TS. The server result is authoritative. The client copy exists solely for UX speed.
- The quiz is a multi-step form (one question per screen or grouped sections) using vanilla JS to manage state. No framework needed -- this is progressive enhancement over a static page.
- On submit, the client simultaneously: (1) displays the archetype result screen and (2) fires the POST to `/api/quiz/submit` in the background. If the API call fails, the user still sees their result. The subscriber just does not get stored -- a recoverable failure.
- The result screen replaces the current redirect to `/thank-you`. Instead, the result is shown inline on `/quiz` with archetype-specific content. The `/thank-you` page can remain as a fallback or be repurposed.

**Tracking integration:**
- On successful quiz completion (before API call), push to dataLayer for GTM
- Fire `fbq('track', 'Lead')` at the same point the current thank-you page does
- This means tracking fires regardless of API success -- better data than current flow

---

#### Component: QuizData

**Responsibility:** Single source of truth for quiz questions, answer options, scoring weights, and dimension definitions.

**Location:** `src/data/quiz-questions.ts`

**Interface:**
```typescript
interface QuizQuestion {
  id: string;            // stable identifier, e.g., "q01"
  text: string;          // question text displayed to user
  dimension: 'airWeaver' | 'embodiedIntuitive' | 'ascendingSeeker' | 'shadowDancer';
  options: {
    label: string;       // display text
    value: number;       // score contribution (1-5)
  }[];
}

interface ArchetypeDefinition {
  key: string;           // "grounded_mystic"
  displayName: string;   // "The Grounded Mystic"
  tagline: string;       // short one-liner for result screen
  description: string;   // 2-3 sentence description for result screen
  emailTag: string;      // "archetype:grounded_mystic" -- used by drip scheduler
}

// Exports:
export const QUIZ_QUESTIONS: QuizQuestion[];      // 20 questions, 5 per dimension
export const ARCHETYPES: ArchetypeDefinition[];    // 6 archetype definitions
export { classify } from './archetype-classifier'; // re-export for convenience
```

**Why a separate file:**
- Imported by quiz.astro (client display), by api/quiz/submit.ts (server validation), and by api/cron/drip.ts (email content lookup). One source, three consumers.

---

#### Component: ArchetypeClassifier

**Responsibility:** Pure function. Takes 4 dimension scores, returns archetype key.

**Location:** `src/data/archetype-classifier.ts`

**Interface:**
```typescript
interface DimensionScores {
  airWeaver: number;
  embodiedIntuitive: number;
  ascendingSeeker: number;
  shadowDancer: number;
}

export function classify(scores: DimensionScores): string;
// Returns archetype key, e.g., "grounded_mystic"
// Implements the exact priority logic from archetypes.py
```

**Why separate from QuizData:** This function must work in both browser and server contexts without dragging in other dependencies. It is imported by `quiz-questions.ts` (re-exported), by the client-side quiz JS, and by the submit API route. Keeping it standalone ensures no import cycles.

---

### Layer 2: API (Vercel Serverless Functions)

#### Component: QuizSubmitEndpoint

**Responsibility:** Receive quiz submission, validate, re-classify authoritatively, store subscriber in Supabase, send welcome email via Resend, schedule drip sequence.

**Location:** `src/pages/api/quiz/submit.ts`

**Interface -- inbound:**
```typescript
// Matches the QuizSubmission interface above
// Validates: email is present and well-formed, scores are numbers
```

**Interface -- outbound responses:**
```typescript
// 200: { success: true, archetype: string }
// 400: { error: string }  // validation failure
// 500: { error: string }  // internal failure (Supabase/Resend down)
```

**Internal flow:**
```
1. Parse + validate request body
2. Re-compute archetype from raw scores (never trust client)
3. Upsert subscriber to Supabase (email as unique key)
4. Send immediate welcome/archetype-reveal email via Resend
5. Write drip schedule to Supabase (8 rows, one per week, with send_at timestamps)
6. Return 200
```

**Boundary rules:**
- This endpoint does NOT send drip emails. It only writes the schedule.
- Idempotent on email: re-taking the quiz overwrites archetype and resets drip schedule.
- Rate limiting: not needed at current scale (<100 submissions/day). If needed later, add Vercel Edge Middleware.

---

#### Component: DripCronEndpoint

**Responsibility:** Runs on a schedule (daily), queries Supabase for drip emails due today, sends them via Resend.

**Location:** `src/pages/api/cron/drip.ts`

**Interface -- inbound:**
```typescript
// Vercel Cron invocation (GET request with CRON_SECRET header)
export const prerender = false;

// Vercel cron config in vercel.json:
// { "crons": [{ "path": "/api/cron/drip", "schedule": "0 10 * * *" }] }
// Note: this requires adding vercel.json to the project (currently absent)
```

**Interface -- outbound:**
```typescript
// 200: { sent: number, errors: number }
// 401: unauthorized (missing/invalid CRON_SECRET)
```

**Internal flow:**
```
1. Verify CRON_SECRET header (Vercel sends this automatically)
2. Query Supabase: SELECT * FROM drip_emails WHERE send_at <= NOW() AND sent = false
3. For each row:
   a. Look up subscriber's archetype from subscribers table
   b. Load email template for (archetype, week_number) combination
   c. Send via Resend
   d. Mark row as sent = true in Supabase
4. Return summary
```

**Failure handling:**
- Individual email failures do not abort the batch. Each send is independent.
- Failed sends remain `sent = false` and will be retried on next cron run.
- After 3 failed attempts (tracked via `attempts` column), mark as `failed` and skip.

---

### Layer 3: External Services

#### Component: SupabaseStore

**Responsibility:** Persistent subscriber and drip schedule storage.

**Not a code component** -- this is configuration and schema. No wrapper library needed. Use `@supabase/supabase-js` directly in API routes.

**Location of client initialization:** `src/lib/supabase.ts`

**Interface:**
```typescript
// Thin init file, not a wrapper class
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_KEY  // service role key for server-side ops
);
```

**Schema:**

```sql
-- subscribers: one row per email
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  archetype TEXT NOT NULL,
  scores JSONB NOT NULL,         -- { airWeaver: N, embodiedIntuitive: N, ... }
  raw_answers JSONB,             -- full answer set for future analysis
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,   -- NULL = active
  source TEXT DEFAULT 'quiz'     -- future-proofing for other entry points
);

-- drip_emails: one row per scheduled email per subscriber
CREATE TABLE drip_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  week_number INT NOT NULL,      -- 1-8
  send_at TIMESTAMPTZ NOT NULL,  -- subscriber's subscribed_at + (week_number * 7 days)
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  failed BOOLEAN DEFAULT FALSE,
  resend_message_id TEXT,        -- for tracking/debugging
  UNIQUE (subscriber_id, week_number)
);

-- Index for the cron query
CREATE INDEX idx_drip_pending ON drip_emails (send_at) WHERE sent = FALSE AND failed = FALSE;
```

**Why not just use Resend's scheduled send?** Resend supports `scheduledAt` for up to 72 hours in the future. An 8-week drip sequence spans 56 days. We need our own schedule table.

**Supabase free tier boundaries:**
- 500 MB database, 50,000 rows -- more than sufficient for years at this scale
- 2 GB bandwidth -- API calls from serverless functions are tiny payloads
- Unlimited API requests -- no concern at current volume

---

#### Component: ResendMailer

**Responsibility:** Send transactional emails. That is all. No subscriber management, no scheduling, no template storage.

**Location:** `src/lib/resend.ts`

**Interface:**
```typescript
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;  // defaults to configured sender
}): Promise<{ id: string }>;
```

**Email templates** are NOT stored in Resend. They are TypeScript functions that return HTML strings:

**Location:** `src/data/email-templates/`

```
src/data/email-templates/
  welcome.ts          -- immediate archetype reveal email
  drip-week-1.ts      -- week 1 content (per archetype)
  drip-week-2.ts      -- week 2 content
  ...
  drip-week-8.ts      -- week 8 content (Kickstarter CTA)
```

Each template file exports:
```typescript
export function render(params: {
  firstName: string;
  archetype: ArchetypeDefinition;
  unsubscribeUrl: string;
}): { subject: string; html: string };
```

**Why templates in code, not in Resend:**
- Version controlled alongside the site
- Type-safe -- compiler catches missing variables
- Archetype-specific branching is cleaner in TS than in a template GUI
- No vendor lock-in -- switching from Resend to SES or Postmark means changing only `src/lib/resend.ts`

**Resend free tier boundaries:**
- 3,000 emails/month, 100 emails/day
- At current scale: ~10-30 quiz takers/week = ~10-30 welcome emails + ~10-30 drip emails/week
- Worst case monthly: 30/week * 4 = 120 welcome + 120 * 8 = 960 drip = ~1,080 emails/month
- Headroom: ~1,900 emails/month before hitting the cap
- If growth exceeds free tier, Resend Pro is $20/mo for 50k emails -- still cheaper than Mailchimp

---

#### Component: UnsubscribeEndpoint

**Responsibility:** CAN-SPAM compliance. Handle one-click unsubscribe.

**Location:** `src/pages/api/email/unsubscribe.ts`

**Interface:**
```typescript
// GET /api/email/unsubscribe?token=<signed-token>
// Sets unsubscribed_at on the subscriber record
// Marks all pending drip_emails as sent=true (cancel remaining)
// Returns a simple HTML page confirming unsubscription
```

**Token design:** HMAC-SHA256 of the subscriber's email, signed with a server-side secret. This prevents URL guessing without requiring database lookups for token validation.

```typescript
// Token generation (used when constructing email links):
function generateUnsubToken(email: string): string {
  return hmacSha256(import.meta.env.UNSUB_SECRET, email);
}

// Token verification:
function verifyUnsubToken(email: string, token: string): boolean {
  return timingSafeEqual(generateUnsubToken(email), token);
}
```

**CAN-SPAM requirements this component satisfies:**
- Every email includes unsubscribe link (template-level enforcement)
- One-click unsubscribe (no login, no confirmation form)
- Honored within 10 business days (ours is instant)
- Physical mailing address in email footer (template-level)

---

## File Tree (New/Modified Files)

```
src/
  data/
    quiz-questions.ts              # NEW - question bank + archetype defs
    archetype-classifier.ts        # NEW - pure classification function
    email-templates/
      welcome.ts                   # NEW - archetype reveal email
      drip-week-1.ts               # NEW
      drip-week-2.ts               # NEW
      drip-week-3.ts               # NEW
      drip-week-4.ts               # NEW
      drip-week-5.ts               # NEW
      drip-week-6.ts               # NEW
      drip-week-7.ts               # NEW
      drip-week-8.ts               # NEW
      _layout.ts                   # NEW - shared email HTML wrapper
      _footer.ts                   # NEW - CAN-SPAM footer (address + unsub)
  lib/
    supabase.ts                    # NEW - Supabase client init
    resend.ts                      # NEW - Resend client + sendEmail wrapper
  pages/
    quiz.astro                     # MODIFIED - replace Tally iframe with native quiz
    thank-you.astro                # MODIFIED - may redirect to /quiz result or be simplified
    api/
      quiz/
        submit.ts                  # NEW - quiz submission handler
      cron/
        drip.ts                    # NEW - daily drip email processor
      email/
        unsubscribe.ts             # NEW - one-click unsubscribe handler

vercel.json                        # NEW - cron schedule config (minimal)
```

**Files NOT changed:** `index.astro` (CTA already links to `/quiz`), `Layout.astro`, `Header.astro`, `Footer.astro`, `astro.config.mjs` (no config changes needed), `tailwind.config.mjs`, `global.css`, all blog/FAQ content.

---

## Data Flow Diagram

```
                  BROWSER                          VERCEL FUNCTIONS                    EXTERNAL
                  ------                           ----------------                    --------

  User answers    +-------------+     POST          +------------------+
  20 questions -> | quiz.astro  | ----------------> | api/quiz/submit  |
  (vanilla JS     | (client JS) |     QuizSubmission|                  |
   scores +       +------+------+                   +--------+---------+
   classifies)           |                                   |
                         |                                   |--- 1. Validate + re-classify
                    Shows result                             |
                    inline (instant)                          |--- 2. Upsert subscriber ----> [Supabase]
                                                             |
                    Fires GTM +                              |--- 3. Send welcome email ---> [Resend] --> inbox
                    Meta Pixel                                |
                                                             |--- 4. Write 8 drip rows ----> [Supabase]
                                                             |
                                                             v
                                                        Return 200


  Daily at 10am   +------------------+
  (Vercel Cron)   | api/cron/drip    |
                  |                  |--- 1. Query pending drips ------> [Supabase]
                  |                  |--- 2. Render email template
                  |                  |--- 3. Send via Resend ----------> [Resend] --> inbox
                  |                  |--- 4. Mark sent ----------------> [Supabase]
                  +------------------+


  User clicks     +----------------------+
  unsubscribe     | api/email/unsubscribe|
                  |                      |--- 1. Verify HMAC token
                  |                      |--- 2. Set unsubscribed_at --> [Supabase]
                  |                      |--- 3. Cancel pending drips -> [Supabase]
                  +----------------------+
                         |
                    Returns HTML
                    "You've been
                     unsubscribed"
```

---

## Integration Points with Existing System

| Touch Point | Current State | Change Required |
|---|---|---|
| `/quiz` page | Tally iframe + embed script + redirect script | Replace entire page body. Keep Layout import, header style, same URL. |
| `/thank-you` page | Standalone confirmation with FB pixel | Either: (a) remove redirect and show result inline on `/quiz`, moving `fbq('track','Lead')` to the quiz page's result step, or (b) keep the page but change it to accept archetype as query param for personalized content. Option (a) is cleaner. |
| Homepage CTA | `<a href="/quiz">` | No change. Link target unchanged. |
| Meta Pixel | `fbq('track', 'Lead')` on thank-you page load | Move to quiz completion event in client JS. Same pixel, same event, earlier trigger. |
| GTM/GA | Pageview tracking via Layout.astro | Add custom event push on quiz completion: `dataLayer.push({event: 'quiz_complete', archetype: '...'})` |
| `astro.config.mjs` | `output: 'static'`, Vercel adapter | No change. API routes opt out of prerender individually via `export const prerender = false`. |
| `package.json` | Current deps | Add: `@supabase/supabase-js`, `resend` |
| Vercel env vars | SEOBOT_API_SECRET, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO | Add: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, UNSUB_SECRET, CRON_SECRET |

---

## Environment Variables (New)

| Variable | Purpose | Where Set |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Vercel dashboard |
| `SUPABASE_SERVICE_KEY` | Service role key (server-only, bypasses RLS) | Vercel dashboard |
| `RESEND_API_KEY` | Resend API key | Vercel dashboard |
| `RESEND_FROM_EMAIL` | Verified sender address, e.g., `The Hermetic Flight <hello@thehermeticflight.com>` | Vercel dashboard |
| `UNSUB_SECRET` | HMAC key for unsubscribe token generation | Vercel dashboard |
| `CRON_SECRET` | Vercel cron authorization secret | Vercel dashboard (auto-generated) |

---

## Risk Surface

| Risk | Severity | Mitigation |
|---|---|---|
| **Resend free tier exceeded** | Medium | Monitor monthly send count. At 80% threshold, alert. Upgrade path is $20/mo -- still saves $30-80/mo vs Mailchimp. |
| **Supabase cold start** | Low | Supabase free tier pauses after 1 week of inactivity. Quiz submissions will keep it active. If somehow idle, first request takes ~5s. Add a keep-alive ping if needed. |
| **Client-side archetype tampering** | None | Server re-classifies from raw scores. Client result is for display only. |
| **Email deliverability** | Medium | Resend handles SPF/DKIM/DMARC setup. Requires DNS records on thehermeticflight.com domain. Must verify domain before sending. |
| **CAN-SPAM compliance gap** | High if missed | Template-level enforcement: every email MUST include physical address and unsubscribe link. The `_footer.ts` template partial makes this impossible to forget. |
| **Cron reliability** | Low | Vercel cron is best-effort on free/hobby tier but reliable in practice. Failed sends auto-retry on next run. |
| **Data migration from Mailchimp** | Low | Existing Mailchimp subscribers (if any) need a one-time export/import to Supabase. Build a migration script, run once, verify, done. |
| **Quiz question data loss** | None | Questions defined in version-controlled TypeScript file. No database dependency for quiz content. |

---

## What This Design Does NOT Cover (Explicitly)

1. **Quiz question content.** The 20 questions, their options, and scoring weights need to be extracted from the current Tally form. This is a data-gathering task, not a design task.
2. **Email copy.** The 9 email templates (1 welcome + 8 drip) need to be written. The design provides the container; the content is a separate workstream.
3. **Email HTML design.** The `_layout.ts` template needs visual design decisions. Should match the site's aesthetic (dark, gold, emerald) but email clients have severe CSS constraints.
4. **Mailchimp migration.** If there are existing subscribers, they need a migration plan. This is an operational task.
5. **A/B testing infrastructure.** Not in scope for v1. Can be added later via the `source` field on subscribers.
6. **Double opt-in.** Current Tally flow does not use double opt-in. This design matches that behavior. Adding it later is straightforward (add a `confirmed` boolean and a confirmation email step).

---

## Dependency Map (Build Order)

```
Phase 1 (no dependencies):
  [A] quiz-questions.ts + archetype-classifier.ts  (data + pure logic)
  [B] Supabase project setup + schema migration     (infra)
  [C] Resend account setup + domain verification     (infra)

Phase 2 (depends on A):
  [D] quiz.astro rewrite                             (depends on A)
  [E] email templates                                (depends on A for archetype defs)

Phase 3 (depends on A, B, C):
  [F] src/lib/supabase.ts + src/lib/resend.ts        (depends on B, C)
  [G] api/quiz/submit.ts                             (depends on A, F)
  [H] api/email/unsubscribe.ts                       (depends on F)

Phase 4 (depends on E, F, G):
  [I] api/cron/drip.ts + vercel.json                 (depends on E, F)

Phase 5 (integration):
  [J] End-to-end testing                             (depends on D, G, I, H)
  [K] Tracking verification (GTM, Meta Pixel)        (depends on D)
  [L] Mailchimp subscriber migration (if needed)     (depends on B)
```

Phases 1A/1B/1C are fully parallel. Phases 2D/2E are parallel. This is a natural two-sprint structure: Sprint 1 = Phases 1-3 (plumbing), Sprint 2 = Phases 4-5 (orchestration + QA).
