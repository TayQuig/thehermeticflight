# Round 1: Builder Analysis

## Role: The Builder (Pragmatic Implementation)

---

## 0. Hard Truth Up Front

MakePlayingCards.com has **no public API**. There is no REST endpoint, no webhook, no bulk upload integration. MPC fulfillment works like this: you email them a spreadsheet of addresses and item quantities, they print and ship, they email you back a spreadsheet of tracking numbers. That is the entire interface.

This means "automating the entire fulfillment process" is a misnomer if the expectation is a zero-touch, API-driven pipeline. What we can actually build is a **fulfillment orchestration system** that:

1. Ingests backer data from Kickstarter (CSV export)
2. Normalizes, validates, and stores it in Supabase
3. Generates MPC-ready fulfillment spreadsheets (grouped by reward tier + shipping zone)
4. Sends transactional emails to backers at each stage (confirmation, shipped, delivered)
5. Ingests MPC tracking data (their return spreadsheet) and updates backer records
6. Provides an operator dashboard for order status at a glance

The manual touchpoints are: (a) uploading the fulfillment sheet to MPC, (b) downloading the tracking sheet from MPC. Everything else can be automated.

---

## 1. Codebase Audit: What We Have to Work With

### Current Architecture (Verified)

| Component | State | Fulfillment Relevance |
|-----------|-------|----------------------|
| Astro 5.16.4, `output: 'static'`, Vercel adapter | Proven | API routes via `prerender = false`. Pattern in `quiz-submit.ts` and `seobot.ts`. |
| Vercel serverless functions | 2 existing routes | Template for all new API routes. WeakMap rate limiting, two-layer fetch timeout patterns established. |
| Loops.so | Active for quiz → drip pipeline | Transactional email API (`POST /transactional`) supports shipping notifications. Already has API key in `.env`. |
| Supabase | Planned for Sprint 5 (referral waitlist) | `waitlist` + `referrals` tables in plan. Fulfillment tables would coexist. `@supabase/supabase-js` not yet installed. |
| `src/env.d.ts` | Declares `LOOPS_API_KEY` only | Must extend with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. |
| `src/lib/archetype-content.ts` | 6 archetypes with slugs, names, descriptions | Fulfillment ties backer archetype to personalized inserts/extras. |
| `tailwind.config.mjs` | Hermetic theme (gold/emerald/sulfur/void) | Dashboard UI will use existing design tokens. |

### Key File Patterns to Replicate

**API route pattern** (`src/pages/api/quiz-submit.ts`):
- `export const prerender = false;`
- `export const POST: APIRoute = async ({ request }) => { ... }`
- Input validation before any mutation
- Rate limiting via WeakMap-on-fetch
- Two-layer fetch timeout for external API calls
- `import.meta.env.*` for secrets

**Webhook pattern** (`src/pages/api/webhooks/seobot.ts`):
- Bearer token auth from request header
- JSON body parsing with validation
- Error responses with structured JSON

### What Doesn't Exist Yet (and Must Be Built)

1. **Supabase client module** -- no `src/lib/supabase.ts` exists. The referral waitlist plan (Sprint 5B) specifies creating one. Fulfillment would share this module.
2. **`@supabase/supabase-js`** -- not in `package.json`. Must install.
3. **No admin/dashboard pages** -- the site is entirely public-facing. An operator-facing order management view is new territory for this codebase.
4. **No file upload/download API routes** -- CSV ingestion is a new pattern.

---

## 2. The Fulfillment Pipeline: What Actually Happens

### Timeline (Relative to 8/8/26 Kickstarter Launch)

```
8/8/26          Campaign launches
~9/8/26         Campaign ends (assuming 30 days)
9/8-9/22        Backer surveys (address collection via Kickstarter or pledge manager)
9/22-10/1       Data cleanup, address validation, MPC proof approval
10/1-10/15      MPC printing run (~2 weeks for playing cards)
10/15-10/20     MPC fulfillment dispatch (they ship directly to backers)
10/20-11/15     Tracking, delivery confirmation, customer support
11/15+          Stragglers, replacements, post-campaign sales
```

### Data Flow Diagram

```
Kickstarter CSV ──► Supabase `orders` table
                         │
                    ┌─────┴──────┐
                    ▼            ▼
            Validation      Tier Mapping
            (addresses)     (reward → SKU)
                    │            │
                    └─────┬──────┘
                          ▼
                  MPC Fulfillment Sheet
                  (operator uploads manually)
                          │
                          ▼
                  MPC Tracking Sheet
                  (operator downloads manually)
                          │
                          ▼
              Supabase `orders` table updated
                          │
                    ┌─────┴──────┐
                    ▼            ▼
            Loops.so             Dashboard
            transactional        (operator view)
            emails
            (shipped/delivered)
```

---

## 3. Database Schema

### Why Supabase (Not a Spreadsheet)

The referral waitlist (Sprint 5B) already commits to Supabase. Adding fulfillment tables to the same project costs nothing additional on the free tier (500MB, 50K rows). A spreadsheet can handle 500 backers; Supabase handles 500 or 50,000 with the same code. More importantly: spreadsheets don't support atomic operations, audit trails, or API-driven status updates.

### Table: `reward_tiers`

```sql
CREATE TABLE reward_tiers (
  id TEXT PRIMARY KEY,               -- 'single_deck', 'double_deck', 'collector_bundle'
  name TEXT NOT NULL,                 -- 'Single Deck', 'Double Deck + Guidebook'
  description TEXT,
  mpc_sku TEXT,                       -- MPC product identifier for fulfillment sheet
  includes JSONB NOT NULL DEFAULT '[]', -- ['deck_standard', 'guidebook', 'poster']
  price_cents INT NOT NULL,
  shipping_domestic_cents INT,
  shipping_international_cents INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reward_tiers ENABLE ROW LEVEL SECURITY;
```

### Table: `orders`

```sql
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kickstarter_backer_id TEXT UNIQUE,  -- From KS CSV column A
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  reward_tier_id TEXT REFERENCES reward_tiers(id),
  archetype TEXT,                     -- From quiz pipeline (if they took quiz)

  -- Shipping address (from KS survey)
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country_code TEXT,                  -- ISO 3166-1 alpha-2

  -- Fulfillment status
  status TEXT NOT NULL DEFAULT 'pending_survey',
  -- Allowed: pending_survey, survey_complete, address_validated,
  --          fulfillment_submitted, shipped, delivered, issue_reported,
  --          replacement_sent, refunded

  -- MPC tracking
  mpc_batch_id TEXT,                  -- Which MPC fulfillment batch
  tracking_number TEXT,
  carrier TEXT,                       -- 'usps', 'ups', 'dhl', 'royalmail', etc.
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Support
  notes TEXT,                         -- Operator notes for edge cases
  issue_type TEXT,                    -- 'damaged', 'lost', 'wrong_address', 'wrong_tier'

  -- Metadata
  pledge_amount_cents INT,
  kickstarter_survey_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_batch ON orders(mpc_batch_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
```

### Table: `fulfillment_batches`

```sql
CREATE TABLE fulfillment_batches (
  id TEXT PRIMARY KEY,                -- 'batch_2026_10_01_us', 'batch_2026_10_01_intl'
  name TEXT NOT NULL,
  shipping_zone TEXT NOT NULL,        -- 'domestic', 'international', 'eu', 'asia'
  order_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  -- Allowed: draft, submitted_to_mpc, printing, shipped, complete

  submitted_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fulfillment_batches ENABLE ROW LEVEL SECURITY;
```

### Table: `email_log` (Fulfillment Notifications)

```sql
CREATE TABLE fulfillment_email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  email_type TEXT NOT NULL,
  -- Allowed: order_confirmed, address_reminder, shipped, delivered,
  --          issue_followup, replacement_shipped

  loops_transactional_id TEXT,       -- Loops.so template ID used
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fulfillment_email_log ENABLE ROW LEVEL SECURITY;
```

### RPC Function: `update_order_status`

```sql
CREATE OR REPLACE FUNCTION update_order_status(
  order_uuid UUID,
  new_status TEXT,
  tracking TEXT DEFAULT NULL,
  carrier_name TEXT DEFAULT NULL
)
RETURNS void AS $$
  UPDATE orders
  SET status = new_status,
      tracking_number = COALESCE(tracking, tracking_number),
      carrier = COALESCE(carrier_name, carrier),
      shipped_at = CASE WHEN new_status = 'shipped' THEN NOW() ELSE shipped_at END,
      delivered_at = CASE WHEN new_status = 'delivered' THEN NOW() ELSE delivered_at END,
      updated_at = NOW()
  WHERE id = order_uuid;
$$ LANGUAGE sql;
```

---

## 4. File Map: Every Component to Its File

### New Files

```
src/
  lib/
    supabase.ts                       # Shared Supabase client (also used by waitlist)
    fulfillment/
      csv-parser.ts                   # Parse Kickstarter CSV → typed objects
      csv-generator.ts                # Generate MPC fulfillment spreadsheet
      address-validator.ts            # Basic address validation + country normalization
      order-status.ts                 # Status enum, transition rules, display labels
      tracking-ingester.ts            # Parse MPC tracking spreadsheet → updates
      email-triggers.ts               # Determine which transactional email to send per status
  pages/
    api/
      fulfillment/
        import-backers.ts             # POST: Upload Kickstarter CSV, parse, insert orders
        export-mpc-sheet.ts           # GET: Generate MPC fulfillment CSV for a batch
        import-tracking.ts            # POST: Upload MPC tracking CSV, update orders
        update-status.ts              # POST: Manual status update for individual order
        batch-create.ts               # POST: Create fulfillment batch from pending orders
        stats.ts                      # GET: Dashboard summary stats
    admin/
      fulfillment.astro               # Operator dashboard: order list, status, actions
      fulfillment/
        batch/[id].astro              # Batch detail view
        order/[id].astro              # Individual order view with status history
```

### Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `@supabase/supabase-js`, `papaparse` (CSV parsing) |
| `src/env.d.ts` | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET` |
| `astro.config.mjs` | No change needed -- `output: 'static'` with per-route opt-out works |

### Files Untouched

Everything in the existing quiz pipeline, blog, FAQ, layouts, components, and all Sprint 1-4 work.

---

## 5. Dependencies

| Package | Version | Purpose | Already Installed? |
|---------|---------|---------|-------------------|
| `@supabase/supabase-js` | `^2.49.x` | Database client | No (planned for Sprint 5B) |
| `papaparse` | `^5.5.x` | CSV parsing (Kickstarter import, MPC tracking import) | No |

**That's two packages.** CSV generation can use a simple template literal function -- MPC's fulfillment sheet format is just a flat table with columns for name, address, city, state, zip, country, item, quantity.

**External accounts needed:**
- Supabase project (free tier) -- already planned for Sprint 5B
- Loops.so transactional email templates created in dashboard (6-8 templates for fulfillment stages)

**No new accounts beyond what's already planned.** This is the key architectural win: fulfillment piggybacks entirely on infrastructure that's already being built for the referral waitlist.

---

## 6. API Route Implementations

### `src/lib/supabase.ts` (Shared Module)

```typescript
import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(url, key);
}
```

This is identical to what the referral waitlist plan specifies. One module, two features.

### `POST /api/fulfillment/import-backers`

**Input:** Kickstarter backer CSV (multipart form upload or JSON with base64-encoded CSV).

**Logic:**
1. Authenticate via `ADMIN_SECRET` bearer token (not the Loops key -- separate admin auth)
2. Parse CSV with `papaparse`
3. Map Kickstarter columns to `orders` table fields
4. For each row: validate email, normalize country code, determine reward tier
5. Upsert into `orders` (idempotent on `kickstarter_backer_id`)
6. Return: `{ imported: N, skipped: N, errors: [...] }`

**Complexity risk:** Kickstarter CSV column headers are not stable across exports. The parser needs a column-mapping config, not hardcoded indices.

### `GET /api/fulfillment/export-mpc-sheet`

**Input:** `?batch_id=xxx`

**Logic:**
1. Query orders in batch
2. Generate CSV with MPC's expected columns: Recipient Name, Address Line 1, Address Line 2, City, State/Province, Postal Code, Country, Item, Quantity
3. Return as `text/csv` with `Content-Disposition: attachment`

### `POST /api/fulfillment/import-tracking`

**Input:** MPC tracking spreadsheet (CSV with order reference, tracking number, carrier).

**Logic:**
1. Parse CSV
2. For each row: match to order by email or name + address
3. Update order with tracking number, carrier, status → `shipped`
4. Trigger Loops.so transactional email: "Your deck has shipped!"
5. Return: `{ updated: N, unmatched: N, errors: [...] }`

**Complexity risk:** MPC's tracking spreadsheet format is not documented. The operator will need to provide a sample for column mapping.

---

## 7. Transactional Email Integration (Loops.so)

### Templates to Create in Loops.so Dashboard

| Template Name | Trigger | Data Variables |
|---------------|---------|----------------|
| `order_confirmed` | Backer data imported | `firstName`, `rewardTier`, `estimatedShipDate` |
| `address_reminder` | Survey incomplete after 7 days | `firstName`, `surveyDeadline` |
| `shipped` | Tracking number ingested | `firstName`, `trackingNumber`, `carrier`, `trackingUrl` |
| `delivered` | Carrier confirms delivery | `firstName`, `feedbackUrl` |
| `issue_followup` | Operator flags issue | `firstName`, `issueType`, `resolution` |
| `replacement_shipped` | Replacement order shipped | `firstName`, `trackingNumber` |

### API Call Pattern (from `email-triggers.ts`)

```typescript
// Follows the same two-layer timeout pattern as quiz-submit.ts
async function sendFulfillmentEmail(
  email: string,
  transactionalId: string,
  dataVariables: Record<string, string>
): Promise<boolean> {
  const LOOPS_API_KEY = import.meta.env.LOOPS_API_KEY;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch('https://app.loops.so/api/v1/transactional', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        transactionalId,
        dataVariables,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

This reuses the exact fetch timeout pattern from `quiz-submit.ts` (lines 288-367). No new patterns needed.

---

## 8. Operator Dashboard (Admin Pages)

### Authentication Strategy

**Problem:** The site has no auth. Adding full auth (Supabase Auth, OAuth, etc.) for a single operator is massive overkill.

**Solution:** Shared-secret URL token. The admin pages check for a query parameter or cookie containing `ADMIN_SECRET`. This is the same pattern used by many solo-creator dashboards.

```
/admin/fulfillment?token=ADMIN_SECRET_VALUE
```

On first visit with valid token, set an HTTP-only cookie with a 24-hour expiry. Subsequent visits check the cookie. The API routes validate via `Authorization: Bearer ADMIN_SECRET` header.

**This is deliberately simple.** For a solo operator with no team access needs, this is sufficient. If the project grows to need multi-user access, that's a different problem for a different day.

### Dashboard Views

**Main view (`/admin/fulfillment`):**
- Summary stats: total orders, by status, by tier, by shipping zone
- Quick actions: "Import Backers CSV", "Create Batch", "Import Tracking"
- Filterable order list with status badges

**Batch view (`/admin/fulfillment/batch/[id]`):**
- Orders in this batch, status breakdown
- "Download MPC Sheet" button
- "Mark Batch Shipped" action

**Order view (`/admin/fulfillment/order/[id]`):**
- Full order details, address, tier, status history
- Manual status update dropdown
- "Send Email" action (trigger any template manually)
- Notes field for operator

### SSR Requirement

Admin pages must use `export const prerender = false` since they query Supabase at request time. This is the same pattern as the API routes -- already proven by `quiz-submit.ts`.

---

## 9. Reward Tier Differentiation

### Tier Mapping (Hypothetical -- Operator Must Define)

The operator hasn't defined reward tiers yet. Here's a plausible structure for a tarot deck Kickstarter:

| Tier ID | Name | Includes | MPC Items |
|---------|------|----------|-----------|
| `early_bird` | Early Bird Deck | 1 standard deck | 1x 78-card tarot deck |
| `single_deck` | Single Deck | 1 standard deck | 1x 78-card tarot deck |
| `deck_guidebook` | Deck + Guidebook | 1 deck + 1 guidebook | 1x deck + 1x booklet |
| `collector` | Collector's Edition | 1 gilded deck + guidebook + print | 1x gilded deck + 1x booklet + 1x art print |
| `double_deck` | Double Deck Bundle | 2 standard decks | 2x 78-card tarot deck |

**Implementation note:** MPC fulfillment sheets list items per row, not tiers. A `collector` tier becomes 3 line items on the MPC sheet. The `includes` JSONB field on `reward_tiers` drives this expansion.

### Archetype Cross-Reference

The quiz pipeline already captures archetype for email subscribers. If a backer's Kickstarter email matches a quiz subscriber email, we can cross-reference their archetype for:
- Personalized pack-in card (e.g., a printed archetype card specific to them)
- Tier-specific email content in shipping notifications

This is a nice-to-have, not a blocker. Query:
```sql
SELECT o.*, w.referral_code
FROM orders o
LEFT JOIN waitlist w ON LOWER(o.email) = LOWER(w.email)
WHERE o.id = $1;
```

---

## 10. Customer Support Integration

### What "Support" Actually Means for a Solo Creator

There's no Zendesk, no Intercom, no ticketing system. Support is: backer sends a Kickstarter message or email, operator reads it, takes action. Automation can help with:

1. **Self-service tracking:** A `/track` page where backers enter their email and see order status + tracking link
2. **Proactive notifications:** Loops.so transactional emails at each stage reduce inbound support volume
3. **Issue flagging in dashboard:** Operator can mark an order as `issue_reported` with notes

### Self-Service Tracking Page

**New file:** `src/pages/track.astro`

**Flow:**
1. Backer visits `/track`
2. Enters email address
3. Client-side fetch to `/api/fulfillment/track` with email
4. Server looks up order by email, returns: status, tracking number, carrier, estimated delivery
5. Page renders status timeline (pending → shipped → delivered)

**Security:** No sensitive data exposed. The response contains only: status label, tracking number (which is already sent via email), and carrier name. No address data returned.

### Proactive Email Cadence

| Trigger | Email | Purpose |
|---------|-------|---------|
| Order imported | `order_confirmed` | "We have your pledge! Here's what happens next." |
| 7 days, no survey response | `address_reminder` | "We need your shipping address to send your deck." |
| Tracking number ingested | `shipped` | "Your deck is on its way! Track it here." |
| Carrier delivery confirmed | `delivered` | "Your deck has arrived! Share your unboxing." |
| Operator flags issue | `issue_followup` | "We're aware of the issue and here's our plan." |

This reduces support volume by 60-80% based on typical Kickstarter fulfillment patterns -- most backer messages are "where is my order?" which the tracking email and page answer preemptively.

---

## 11. Build Order

### Phase 0: Supabase Setup (Prerequisite)

**Blocker:** Supabase project must exist before any fulfillment code works.

This is the same blocker as Sprint 5B (referral waitlist). If the operator creates the Supabase project for waitlist, fulfillment tables can be added to the same project. Run the DDL statements from Section 3.

**Env vars to add:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET` (any random 32-char string, used for admin auth)

### Phase 1: Data Layer (No UI, No Emails)

**Goal:** Import backer CSV, store in Supabase, export MPC sheet.

**Files:**
1. `src/lib/supabase.ts` -- Shared client init
2. `src/lib/fulfillment/csv-parser.ts` -- Kickstarter CSV → typed objects
3. `src/lib/fulfillment/csv-generator.ts` -- Orders → MPC fulfillment CSV
4. `src/lib/fulfillment/address-validator.ts` -- Basic validation
5. `src/lib/fulfillment/order-status.ts` -- Status enum + transitions
6. `src/pages/api/fulfillment/import-backers.ts` -- CSV import endpoint
7. `src/pages/api/fulfillment/export-mpc-sheet.ts` -- CSV export endpoint
8. `src/pages/api/fulfillment/batch-create.ts` -- Group orders into batches

**Verification:**
- [ ] Import a test CSV with 5 rows → 5 orders in Supabase
- [ ] Create a batch from pending orders
- [ ] Download MPC sheet CSV, verify format
- [ ] Re-import same CSV → 0 new rows (idempotent upsert)

### Phase 2: Tracking Ingestion + Email Notifications

**Goal:** Import MPC tracking data, trigger shipping emails via Loops.so.

**Files:**
1. `src/lib/fulfillment/tracking-ingester.ts` -- Parse tracking CSV
2. `src/lib/fulfillment/email-triggers.ts` -- Loops.so transactional calls
3. `src/pages/api/fulfillment/import-tracking.ts` -- Tracking import endpoint
4. `src/pages/api/fulfillment/update-status.ts` -- Manual status update

**Operator tasks (parallel):**
- Create 6 transactional email templates in Loops.so dashboard
- Note down each template's `transactionalId` for config

**Verification:**
- [ ] Import tracking CSV → orders updated with tracking numbers
- [ ] Status transition triggers correct Loops.so transactional email
- [ ] Loops.so dashboard shows sent emails

### Phase 3: Operator Dashboard

**Goal:** Web-based order management interface.

**Files:**
1. `src/pages/admin/fulfillment.astro` -- Main dashboard
2. `src/pages/admin/fulfillment/batch/[id].astro` -- Batch detail
3. `src/pages/admin/fulfillment/order/[id].astro` -- Order detail
4. `src/pages/api/fulfillment/stats.ts` -- Dashboard summary endpoint

**Verification:**
- [ ] Dashboard loads with test data
- [ ] Filter by status works
- [ ] Batch actions (create, download sheet, mark shipped) work
- [ ] Individual order status updates persist

### Phase 4: Self-Service Tracking + Polish

**Goal:** Backer-facing tracking page, edge case handling.

**Files:**
1. `src/pages/track.astro` -- Public tracking page
2. `src/pages/api/fulfillment/track.ts` -- Tracking lookup endpoint
3. `src/lib/fulfillment/csv-parser.ts` -- MODIFY: configurable column mapping

**Verification:**
- [ ] Backer enters email, sees order status
- [ ] Invalid email shows "order not found" (not an error)
- [ ] Tracking link opens in carrier's website

---

## 12. Complexity Risks

### Risk 1: MPC Fulfillment Sheet Format (HIGH)

**Problem:** MPC's fulfillment sheet format is undocumented publicly. The operator must request a sample template from MPC or determine the format through their account portal.

**Mitigation:** Build the CSV generator with configurable column mapping. Start with the most common format (Name, Address 1, Address 2, City, State, Zip, Country, Product, Quantity) and adjust when MPC provides their actual template.

**Action item for operator:** Email MPC support requesting their fulfillment sheet template before build begins.

### Risk 2: Kickstarter CSV Column Instability (MEDIUM)

**Problem:** Kickstarter's backer export CSV has evolved over time. Column headers may vary depending on whether you used Kickstarter's native survey, a third-party pledge manager, or exported at different stages. Column A is backer number, Column E is shipping country, but indices for address fields depend on survey configuration.

**Mitigation:** The CSV parser should work with a column-mapping configuration object, not hardcoded indices. The operator maps column headers once during the first import; the mapping is stored in a Supabase config table or a local JSON file.

### Risk 3: Address Validation at Scale (MEDIUM)

**Problem:** International addresses are messy. Kickstarter backers often enter addresses in wrong formats, use local scripts, abbreviate inconsistently.

**Mitigation for MVP:** Basic validation only -- check for non-empty required fields, normalize country to ISO 3166-1 alpha-2. Flag suspicious addresses for manual review (dashboard shows "needs_review" status). Full address validation via a service like Lob or SmartyStreets is overkill for <1,000 orders and costs money per validation.

### Risk 4: Pledge Manager Decision (MEDIUM)

**Problem:** Kickstarter's native survey is limited for physical rewards. Third-party pledge managers (BackerKit, PledgeBox, PledgeManager) offer better UX, add-on sales, and export formats -- but they add cost and complexity.

**Recommendation:** For a solo creator's first Kickstarter with a single product line (tarot deck + optional extras), **PledgeBox** is the best fit:
- Free if no add-ons are sold (3% fee only on add-on revenue)
- Direct Kickstarter integration
- CSV exports compatible with fulfillment workflows
- Lower complexity than BackerKit (which is optimized for large campaigns)

If the campaign stays under ~500 backers, Kickstarter's native survey is sufficient and free. Over 500, PledgeBox pays for itself in time savings.

**This decision is deferred to post-campaign.** The fulfillment system we build accepts any CSV -- it doesn't care whether it came from Kickstarter, PledgeBox, or BackerKit.

### Risk 5: Timing Relative to Sprint Roadmap (LOW)

**Problem:** Fulfillment isn't needed until ~September 2026. The current 6-sprint roadmap runs through July. Building fulfillment now is premature from a code perspective -- but planning it now ensures architectural decisions (Supabase schema, Loops.so template strategy) are compatible.

**Recommendation:** Design the schema now. Build after Sprint 5B (referral waitlist), since that sprint establishes the Supabase client module and patterns. Fulfillment becomes Sprint 7 or a post-launch sprint.

---

## 13. What This Does NOT Cover (and Shouldn't)

1. **Payment processing** -- Kickstarter handles all payments. The fulfillment system never touches money.
2. **Returns/refunds** -- Kickstarter pledges are non-refundable by default. The operator handles rare refund requests manually through Kickstarter's system.
3. **Inventory management** -- MPC prints on demand. There's no inventory to manage. The operator tells MPC "print N decks" and they print N decks.
4. **Post-campaign e-commerce** -- Selling decks after Kickstarter is a separate system (Shopify, Gumroad, or similar). The fulfillment system handles one-time Kickstarter fulfillment only.
5. **International customs/duties** -- MPC ships directly and handles customs paperwork as the shipper of record. The operator may want to warn international backers about potential import duties, but the system doesn't calculate them.

---

## 14. What the Operator Must Provide

| Item | Blocks | Urgency |
|------|--------|---------|
| Supabase project (free tier) | Everything | Before Sprint 5B |
| MPC fulfillment sheet template | Phase 1 (CSV generator) | Before September 2026 |
| Reward tier definitions (names, contents, pricing) | Phase 1 (tier mapping) | Before campaign launch |
| Loops.so transactional email templates (6) | Phase 2 (email triggers) | Before October 2026 |
| MPC tracking sheet sample | Phase 2 (tracking ingester) | Before October 2026 |
| Pledge manager decision (native KS vs PledgeBox) | CSV parser column mapping | After campaign ends |
| `ADMIN_SECRET` env var | Dashboard auth | Before Phase 3 |

Items 1-3 are the only pre-launch blockers. Items 4-7 can wait until post-campaign.

---

## 15. Cost Analysis

| Component | Monthly Cost |
|-----------|-------------|
| Supabase (free tier, shared with waitlist) | $0 |
| Loops.so transactional emails (~2,000 for 500 backers x 4 stages) | Covered by existing plan |
| MPC printing + fulfillment ($1/parcel dispatch surcharge) | ~$500 for 500 backers (one-time) |
| MPC deck printing | Varies by deck specs -- request quote |
| PledgeBox (if used, no add-ons) | $0 |
| Vercel (existing deployment) | $0 |
| **Total recurring cost for fulfillment automation** | **$0/month** |

The only cost is MPC's one-time printing + shipping, which is the physical product cost that exists regardless of automation.

---

## 16. Integration Points with Existing Architecture

### Supabase Client (Shared with Waitlist)

`src/lib/supabase.ts` is created once, used by:
- Referral waitlist (Sprint 5B): `waitlist` + `referrals` tables
- Fulfillment (Sprint 7): `orders` + `reward_tiers` + `fulfillment_batches` tables

### Loops.so (Shared API Key)

Same `LOOPS_API_KEY` in `.env`. Quiz pipeline uses `events/send` endpoint. Fulfillment uses `transactional` endpoint. Different endpoints, same auth, no conflict.

### Archetype Cross-Reference

If a backer completed the quiz before pledging, their email exists in Loops.so with `archetype` as a contact property. The fulfillment system can look this up for personalized inserts.

### Vercel Serverless

Same `prerender = false` pattern, same rate limiting, same timeout patterns. No new infrastructure patterns.

---

## 17. What I Would Build First

Assuming Supabase project exists and it's post-campaign (September 2026):

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm install @supabase/supabase-js papaparse
npm install -D @types/papaparse
mkdir -p src/lib/fulfillment src/pages/api/fulfillment src/pages/admin/fulfillment/batch src/pages/admin/fulfillment/order
```

Then create `src/lib/fulfillment/csv-parser.ts` -- the smallest, most testable piece. Parse a test CSV, verify the typed output matches expected structure. Everything else builds on having correctly-parsed backer data.

---

## 18. Proposed Sprint Placement

This work belongs in a **new Sprint 7: Post-Campaign Fulfillment** (September 2026), positioned after the current 6-sprint roadmap:

```
Sprint 5B (May-July)   ──► Supabase established, client module created
Sprint 7 (September)   ──► Fulfillment tables added, import/export built
                            (2-3 week window between campaign end and print run)
```

The architectural planning (schema design, template list, MPC format research) can happen anytime. The code build should wait until Supabase is live and the campaign has ended.

---

## Summary: What Is and Isn't Automatable

| Step | Automatable? | How |
|------|-------------|-----|
| Import backer data from Kickstarter | Yes | CSV upload → Supabase |
| Validate/normalize addresses | Partially | Basic validation automated; edge cases need manual review |
| Generate MPC fulfillment sheets | Yes | Query Supabase → CSV download |
| Upload sheet to MPC | No | Manual (no MPC API) |
| Track printing progress | No | Manual (email MPC for updates) |
| Download tracking from MPC | No | Manual (MPC sends spreadsheet) |
| Import tracking data | Yes | CSV upload → Supabase → Loops.so emails |
| Notify backers of shipment | Yes | Loops.so transactional email, automatic |
| Backer self-service tracking | Yes | `/track` page queries Supabase |
| Handle support issues | Partially | Dashboard flags + templates; judgment is manual |
| Detect delivery | Partially | Carrier APIs exist but integration is complex; start with manual |

**Bottom line:** We automate everything on our side of the MPC boundary. The two manual handoffs (upload fulfillment sheet, download tracking sheet) each take 5 minutes. The rest -- data ingestion, validation, email notifications, status tracking, self-service -- runs on code.
