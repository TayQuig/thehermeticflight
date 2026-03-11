# Round 1 -- Designer Analysis: Fulfillment Automation Pipeline

## Executive Assessment

The fulfillment pipeline is fundamentally different from everything currently in the Hermetic Flight architecture. The existing system is a **pre-launch marketing engine** -- static site generation with thin serverless glue to Loops.so. Fulfillment is a **post-campaign operational system** that manages money, physical goods, and customer promises. It requires persistent state, multi-step workflows with human gates, and integration with external systems (Kickstarter, MakePlayingCards, shipping carriers) that have no APIs or have severely limited ones.

This analysis maps the structural reality of what fulfillment requires, where it fits into the existing architecture, where it cannot fit, and what new components are needed.

---

## 1. Existing Architecture Inventory

Before designing anything, here is what actually exists today and what is planned:

### Current System (Production)

```
Browser                  Vercel (static + serverless)         External
  |                              |                              |
  |--- GET /quiz ------------>   | (SSG, pre-rendered)          |
  |--- POST /api/quiz-submit --> | (serverless fn)              |
  |                              |--- POST events/send -------> Loops.so
  |--- GET /quiz/result/[x] --> | (SSG, 6 static pages)        |
  |--- POST /api/webhooks/* --> | (serverless fn)              |
  |                              |--- GitHub API --------------> GitHub
```

**Key characteristics:**
- `astro.config.mjs`: `output: 'static'` with Vercel adapter -- pages are pre-rendered at build time, API routes (`prerender = false`) run as Vercel serverless functions
- No database. No user accounts. No authentication. No session management.
- All state lives in Loops.so (email contacts + properties) or external services
- Environment: `LOOPS_API_KEY`, `SEOBOT_API_SECRET`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
- Rate limiting: ephemeral WeakMap-on-fetch (resets each cold start)
- Single-file API routes in `src/pages/api/` -- each route is self-contained

### Planned (Sprint 5 -- Referral Waitlist)

```
Browser                  Vercel serverless              External
  |                              |                        |
  |--- POST /api/waitlist/join ->| --- INSERT ----------> Supabase (waitlist, referrals tables)
  |--- GET /api/waitlist/status->| --- SELECT ----------> Supabase
  |--- POST /api/waitlist/refer->| --- INSERT + RPC ----> Supabase
  |                              |--- POST events/send -> Loops.so
```

**Key new capabilities introduced by Sprint 5:**
- `@supabase/supabase-js` dependency (already planned in `package.json`)
- `src/lib/supabase.ts` -- server-side Supabase client (service_role key)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `src/env.d.ts`
- Two Supabase tables: `waitlist`, `referrals`
- `increment_referral_count` RPC function
- Row Level Security enabled as defense-in-depth

This is the **only planned persistent database** in the entire roadmap. The fulfillment system must build on this Supabase foundation.

---

## 2. Structural Analysis: What Fulfillment Actually Requires

Fulfillment for a physical product Kickstarter is a **state machine with external dependencies, not a request/response pipeline.** Here are the real structural requirements, decomposed:

### 2.1 Data Ingestion: Kickstarter Backer Import

**The constraint that shapes everything:** Kickstarter does not have a real-time API for backer data. After a campaign ends, the creator receives:
- A CSV export from the Kickstarter dashboard (backer report)
- A separate survey system (Kickstarter surveys, or a third-party tool like BackerKit/PledgeManager)

The backer report CSV contains: backer name, email, pledge amount, reward tier, shipping country. It does NOT contain shipping addresses until the creator sends surveys and backers respond.

**Structural implication:** The first stage of fulfillment is a **CSV import pipeline**, not an API integration. The system must:
1. Parse Kickstarter backer CSV
2. Validate and normalize fields (email, country codes, tier mapping)
3. Create or update records in the database
4. Trigger survey emails to collect shipping addresses
5. Track survey response status per backer

### 2.2 Order Placement: MakePlayingCards.com

**The constraint that shapes everything:** MPC does not offer a public API for order placement. Orders are placed through their web interface. For bulk/wholesale orders, communication happens via email or their custom quote system.

**Structural implication:** Order placement with MPC cannot be fully automated through code. The system must:
1. Generate order manifests (quantities per SKU, shipping destinations grouped by region)
2. Track order status manually (operator updates status in the system)
3. Store MPC order reference numbers, tracking information
4. Support multiple orders (different tiers may ship separately, or orders may be split by region)

### 2.3 Shipping Logistics

**Fulfillment models to consider (in order of operator complexity):**

| Model | Operator Effort | Cost | Tracking |
|-------|----------------|------|----------|
| A: MPC ships direct to backers | Lowest | Highest per-unit | MPC provides tracking |
| B: MPC ships bulk to operator, operator ships individually | Highest | Lowest per-unit | Operator manages tracking |
| C: MPC ships bulk to 3PL (third-party logistics), 3PL ships to backers | Medium | Medium | 3PL provides tracking |

For a solo creator operation, Model A (MPC direct-to-backer) or Model C (via 3PL) is most realistic. Model B at scale (hundreds of backers) is operationally crushing for one person.

**Structural implication:** Regardless of model, the system needs:
1. Per-backer fulfillment status tracking
2. Shipping address validation
3. Regional grouping (domestic vs international, customs declarations)
4. Tracking number storage and notification triggers

### 2.4 Reward Tier Fulfillment

From the FAQ data (`src/content/faq/08-kickstarter.json`), the planned tiers are:
- Early Bird Special: Deck + guidebook (limited quantity)
- Standard Pledge: Deck + guidebook
- Deluxe Edition: Premium packaging (gilded edges, fabric pouch, etc.)
- Retail Bundle: Multiple decks at reduced pricing
- Supporter/Collector: Signed editions, original prints, exclusive items

**Structural implication:** Each tier maps to a specific set of **SKUs** (stock-keeping units). Some tiers include items that MPC produces (deck, guidebook, box) and items that MPC does not produce (fabric pouch, signed prints). This means:
1. Tier-to-SKU mapping must be explicit and configurable
2. Some items may ship separately (MPC items vs handmade/sourced items)
3. A backer's fulfillment may require multiple shipments with different tracking numbers

### 2.5 Customer Support

Fulfillment generates predictable support requests:
- "Where is my order?" (status lookup)
- "My address changed" (address update)
- "I received the wrong tier" (order discrepancy)
- "My deck arrived damaged" (replacement request)
- "I never received my package" (lost shipment)

**Structural implication:** The system needs:
1. Backer-facing status page (no login -- email lookup or unique link)
2. Address change request flow (with cutoff date before shipping)
3. Support ticket tracking (at minimum, a status field on the backer record)
4. Replacement/reshipping flag per backer

---

## 3. Component Architecture

### 3.1 System Boundary Diagram

```
                     THE HERMETIC FLIGHT -- FULFILLMENT DOMAIN
 ============================================================================

  EXTERNAL INPUTS              FULFILLMENT CORE              EXTERNAL OUTPUTS
  ---------------              ----------------              ----------------

  Kickstarter CSV  ----+
                       |   +---------------------------+
  Backer surveys   ----+-->| FulfillmentDB (Supabase)  |
  (email replies)  |   |   |                           |
                   |   |   | Tables:                   |
  Operator manual  ----+   |   backers                 |----> Loops.so
  status updates       |   |   orders                  |      (notifications)
                       |   |   shipments               |
  MPC tracking     ----+   |   support_tickets         |----> Backer Status
  numbers              |   |   reward_tiers            |      Page (Astro)
                       |   |   tier_skus               |
                       |   +---------------------------+----> Operator
                       |              |                       Dashboard
                       |              |                       (Astro page)
                       |              |
                       |   +---------------------------+
                       +-->| Fulfillment API Routes    |
                           | (Vercel serverless)       |
                           |                           |
                           | POST /api/fulfill/import  |
                           | POST /api/fulfill/update  |
                           | GET  /api/fulfill/status  |
                           | POST /api/fulfill/notify  |
                           +---------------------------+
```

### 3.2 Component Definitions

#### Component 1: `FulfillmentDB` -- Supabase Tables

**Responsibility:** Single source of truth for all fulfillment state. Every backer, every order, every shipment, every support interaction is a row.

**Integration point:** Extends the existing Supabase project planned in Sprint 5. Uses the same `src/lib/supabase.ts` client module (service_role key, server-side only).

**Tables:**

```sql
-- Reward tier definitions (seeded once by operator, updated if stretch goals unlock)
CREATE TABLE reward_tiers (
  id TEXT PRIMARY KEY,                    -- e.g., 'early_bird', 'standard', 'deluxe', 'retail_bundle', 'collector'
  name TEXT NOT NULL,                     -- Human-readable: "Early Bird Special"
  description TEXT,
  pledge_amount_cents INT NOT NULL,       -- Price in cents (avoids float math)
  quantity_limit INT,                     -- NULL = unlimited
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SKUs that compose each tier (a tier may have multiple SKUs)
CREATE TABLE tier_skus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id TEXT NOT NULL REFERENCES reward_tiers(id),
  sku_code TEXT NOT NULL,                 -- e.g., 'DECK_STANDARD', 'GUIDEBOOK', 'POUCH_SILK', 'PRINT_SIGNED'
  sku_name TEXT NOT NULL,                 -- "Standard Tarot Deck"
  producer TEXT NOT NULL,                 -- 'mpc' | 'operator' | 'third_party'
  quantity INT DEFAULT 1,                 -- How many of this SKU per tier unit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per Kickstarter backer
CREATE TABLE backers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kickstarter_id TEXT UNIQUE,             -- From KS backer report CSV
  email TEXT NOT NULL,                    -- Normalized to lowercase
  name TEXT NOT NULL,
  tier_id TEXT NOT NULL REFERENCES reward_tiers(id),
  pledge_amount_cents INT NOT NULL,

  -- Shipping (NULL until survey response received)
  shipping_name TEXT,
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,                  -- ISO 3166-1 alpha-2

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'imported',
  -- Valid statuses: imported -> surveyed -> address_confirmed ->
  --   order_placed -> shipped -> delivered -> issue_reported
  survey_sent_at TIMESTAMPTZ,
  survey_responded_at TIMESTAMPTZ,
  address_confirmed_at TIMESTAMPTZ,

  -- Loops.so linkage
  loops_contact_id TEXT,                  -- If backer is also a quiz subscriber

  -- Support
  notes TEXT,                             -- Operator notes (free text)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bulk orders placed with MPC (or other producers)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producer TEXT NOT NULL,                 -- 'mpc' | 'operator' | 'third_party'
  order_reference TEXT,                   -- MPC order number, PO number, etc.
  status TEXT NOT NULL DEFAULT 'draft',
  -- Valid statuses: draft -> submitted -> confirmed -> in_production ->
  --   shipped_to_warehouse -> received -> fulfilling -> complete

  -- Quantities
  total_units INT NOT NULL,
  region TEXT,                            -- 'domestic' | 'international' | 'all' | specific country group

  -- Tracking (for bulk shipment to operator/3PL)
  tracking_number TEXT,
  carrier TEXT,                           -- 'ups' | 'fedex' | 'usps' | 'dhl' | etc.

  -- Financials
  total_cost_cents INT,

  notes TEXT,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual shipments to backers
CREATE TABLE shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backer_id UUID NOT NULL REFERENCES backers(id),
  order_id UUID REFERENCES orders(id),   -- NULL if shipped independently (e.g., replacement)

  status TEXT NOT NULL DEFAULT 'pending',
  -- Valid statuses: pending -> label_created -> shipped -> in_transit ->
  --   delivered -> returned -> lost

  tracking_number TEXT,
  carrier TEXT,
  shipping_cost_cents INT,

  -- What was shipped (may be partial -- e.g., deck ships first, prints ship later)
  sku_codes TEXT[],                       -- Array of SKU codes included in this shipment
  is_replacement BOOLEAN DEFAULT false,

  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support interactions per backer
CREATE TABLE support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backer_id UUID NOT NULL REFERENCES backers(id),

  type TEXT NOT NULL,                     -- 'address_change' | 'status_inquiry' | 'damaged' | 'missing' | 'wrong_tier' | 'other'
  status TEXT NOT NULL DEFAULT 'open',    -- 'open' | 'in_progress' | 'resolved' | 'closed'

  description TEXT NOT NULL,
  resolution TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS on all tables (defense-in-depth, all access via service_role)
ALTER TABLE reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE backers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
```

**RPC functions:**

```sql
-- Batch status update for backers (e.g., after survey blast)
CREATE OR REPLACE FUNCTION batch_update_backer_status(
  backer_ids UUID[],
  new_status TEXT
) RETURNS INT AS $$
  UPDATE backers
  SET status = new_status, updated_at = NOW()
  WHERE id = ANY(backer_ids)
  AND status != new_status;
  GET DIAGNOSTICS result = ROW_COUNT;
  RETURN result;
$$ LANGUAGE plpgsql;

-- Dashboard summary stats
CREATE OR REPLACE FUNCTION fulfillment_summary()
RETURNS TABLE(
  total_backers BIGINT,
  by_status JSONB,
  by_tier JSONB,
  total_shipped BIGINT,
  total_delivered BIGINT,
  open_tickets BIGINT
) AS $$
SELECT
  (SELECT COUNT(*) FROM backers),
  (SELECT jsonb_object_agg(status, cnt) FROM (SELECT status, COUNT(*) as cnt FROM backers GROUP BY status) s),
  (SELECT jsonb_object_agg(tier_id, cnt) FROM (SELECT tier_id, COUNT(*) as cnt FROM backers GROUP BY tier_id) t),
  (SELECT COUNT(*) FROM shipments WHERE status IN ('shipped', 'in_transit', 'delivered')),
  (SELECT COUNT(*) FROM shipments WHERE status = 'delivered'),
  (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress'));
$$ LANGUAGE sql;
```

#### Component 2: `FulfillmentLib` -- Shared Business Logic

**Responsibility:** Pure functions for data transformation, validation, and state machine transitions. No I/O. Testable in isolation.

**Files:**

```
src/lib/fulfillment/
  types.ts           -- TypeScript interfaces for all fulfillment entities
  csv-parser.ts      -- Kickstarter CSV parsing + validation + normalization
  tier-mapper.ts     -- Maps KS pledge amount/reward name to tier_id
  status-machine.ts  -- Validates state transitions (backer, order, shipment)
  address-validator.ts -- Basic address completeness checks + country code normalization
  manifest-builder.ts -- Generates order manifests from backer data (grouped by tier + region)
  notification-templates.ts -- Loops.so event payloads for each fulfillment milestone
```

**Key interfaces (`types.ts`):**

```typescript
// src/lib/fulfillment/types.ts

// -- Backer status state machine --
export type BackerStatus =
  | 'imported'
  | 'surveyed'
  | 'address_confirmed'
  | 'order_placed'
  | 'shipped'
  | 'delivered'
  | 'issue_reported';

// -- Order status state machine --
export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'in_production'
  | 'shipped_to_warehouse'
  | 'received'
  | 'fulfilling'
  | 'complete';

// -- Shipment status state machine --
export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'lost';

// -- Support ticket types --
export type TicketType =
  | 'address_change'
  | 'status_inquiry'
  | 'damaged'
  | 'missing'
  | 'wrong_tier'
  | 'other';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

// -- Data shapes --
export interface KickstarterCSVRow {
  backerNumber: string;
  backerName: string;
  email: string;
  pledgeAmount: number;       // Dollars (from CSV, converted to cents at import)
  rewardTitle: string;        // Free text from KS -- needs mapping
  shippingCountry: string;    // May be empty
  surveyResponse: boolean;
}

export interface BackerRecord {
  id: string;
  kickstarterId: string;
  email: string;
  name: string;
  tierId: string;
  pledgeAmountCents: number;
  status: BackerStatus;
  shippingAddress: ShippingAddress | null;
  loopsContactId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;            // ISO 3166-1 alpha-2
}

export interface OrderManifest {
  tierId: string;
  region: string;
  skus: { skuCode: string; totalQuantity: number }[];
  backerIds: string[];
  estimatedUnitCount: number;
}

export interface FulfillmentNotification {
  eventName: string;          // Loops.so event name
  recipientEmail: string;
  eventProperties: Record<string, string | number>;
}
```

**State machine transitions (`status-machine.ts`):**

```typescript
// src/lib/fulfillment/status-machine.ts

import type { BackerStatus, OrderStatus, ShipmentStatus } from './types';

const BACKER_TRANSITIONS: Record<BackerStatus, BackerStatus[]> = {
  imported:          ['surveyed'],
  surveyed:          ['address_confirmed', 'imported'],   // 'imported' = survey bounced
  address_confirmed: ['order_placed'],
  order_placed:      ['shipped'],
  shipped:           ['delivered', 'issue_reported'],
  delivered:         ['issue_reported'],                    // Post-delivery issue
  issue_reported:    ['shipped', 'delivered'],              // Re-ship or confirm resolved
};

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft:                ['submitted'],
  submitted:            ['confirmed', 'draft'],             // 'draft' = MPC rejects
  confirmed:            ['in_production'],
  in_production:        ['shipped_to_warehouse'],
  shipped_to_warehouse: ['received'],
  received:             ['fulfilling'],
  fulfilling:           ['complete'],
  complete:             [],
};

const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending:       ['label_created'],
  label_created: ['shipped'],
  shipped:       ['in_transit', 'returned'],
  in_transit:    ['delivered', 'returned', 'lost'],
  delivered:     [],
  returned:      ['pending'],                               // Re-ship
  lost:          ['pending'],                               // Re-ship
};

export function canTransitionBacker(from: BackerStatus, to: BackerStatus): boolean {
  return BACKER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
}
```

#### Component 3: `FulfillmentAPI` -- Vercel Serverless Routes

**Responsibility:** HTTP interface for all fulfillment mutations and queries. All routes server-side only. Follows the exact pattern established in `src/pages/api/quiz-submit.ts`.

**Files:**

```
src/pages/api/fulfill/
  import.ts          -- POST: Parse + import Kickstarter CSV
  backers.ts         -- GET: List/search backers (with filters)
  backer/[id].ts     -- GET: Single backer detail. PATCH: Update status/address.
  orders.ts          -- GET: List orders. POST: Create new order.
  order/[id].ts      -- GET: Order detail. PATCH: Update status/tracking.
  shipments.ts       -- POST: Create shipment records (batch or single)
  shipment/[id].ts   -- PATCH: Update shipment status/tracking
  notify.ts          -- POST: Send Loops.so notification for a fulfillment event
  status.ts          -- GET: Public backer status lookup (by email + backer number)
  summary.ts         -- GET: Dashboard summary stats (operator only)
  tickets.ts         -- GET: List tickets. POST: Create ticket.
  ticket/[id].ts     -- PATCH: Update ticket status/resolution.
```

**Authentication boundary:**

This is a critical design decision. The existing codebase has NO authentication. The quiz-submit endpoint is public. The waitlist endpoints are public. But fulfillment endpoints manage PII (names, addresses, emails) and financial data (pledge amounts).

**Proposed approach -- two tiers:**

| Tier | Endpoints | Auth Method |
|------|-----------|-------------|
| Public | `GET /api/fulfill/status` | Email + kickstarter_id (knowledge-based, no login) |
| Operator | Everything else | `FULFILL_ADMIN_KEY` environment variable, passed as `Authorization: Bearer <key>` |

The operator-tier auth is a shared secret, not a full auth system. This is appropriate because:
1. The operator is a single person (Taylor Quigley)
2. The fulfillment dashboard will be an Astro page that makes fetch calls with the key
3. The key never reaches the browser -- it is stored in Vercel env vars and used only in server-side API routes
4. A full auth system (Supabase Auth, NextAuth, etc.) is over-engineered for a single operator

**New env var:**

```typescript
// Addition to src/env.d.ts
interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly FULFILL_ADMIN_KEY: string;     // NEW: Shared secret for operator fulfillment API
}
```

**Example route pattern (`import.ts`):**

```typescript
// src/pages/api/fulfill/import.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { parseKickstarterCSV } from '../../../lib/fulfillment/csv-parser';
import { mapTier } from '../../../lib/fulfillment/tier-mapper';

function authenticateOperator(request: Request): boolean {
  const adminKey = import.meta.env.FULFILL_ADMIN_KEY;
  if (!adminKey) return false;
  const authHeader = request.headers.get('Authorization');
  return authHeader === `Bearer ${adminKey}`;
}

export const POST: APIRoute = async ({ request }) => {
  if (!authenticateOperator(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ... parse CSV from multipart/form-data body
  // ... validate rows
  // ... upsert into backers table
  // ... return { imported: N, updated: N, errors: [...] }
};
```

#### Component 4: `FulfillmentPages` -- Astro UI

**Responsibility:** Visual interfaces for both the operator (dashboard) and backers (status page).

**Files:**

```
src/pages/fulfill/
  index.astro         -- Operator dashboard: summary stats, recent activity, action buttons
  backers.astro       -- Operator: backer list with search/filter/sort
  backer/[id].astro   -- Operator: single backer detail + action buttons (update status, etc.)
  orders.astro        -- Operator: order list
  import.astro        -- Operator: CSV upload form + import results

src/pages/order-status.astro  -- PUBLIC: Backer-facing order status lookup
```

**Rendering model:**

The operator dashboard pages should be `prerender = false` (server-rendered on request) because they display live data from Supabase. They follow the Astro hybrid rendering pattern -- the page frontmatter fetches data from Supabase, then renders the template.

However, this introduces a problem: the existing `astro.config.mjs` has `output: 'static'`. Pages that need server rendering use `export const prerender = false` -- this works for API routes but for `.astro` pages, it means each page is a Vercel serverless function. This is fine for the operator dashboard (low traffic, single user) but the public `order-status.astro` page could see backer traffic.

**The public status page should be a static page with client-side fetching** -- it renders a form (email + backer number), then calls `GET /api/fulfill/status` via client-side `fetch()`, and displays results in the DOM. No server rendering needed. This matches the pattern already used in `quiz.astro` (static page with client-side JS for interactivity).

#### Component 5: `FulfillmentNotifier` -- Loops.so Integration

**Responsibility:** Send email notifications at each fulfillment milestone.

**Integration point:** Extends the existing Loops.so integration pattern from `src/pages/api/quiz-submit.ts`. Same `LOOPS_API_KEY`, same two-layer timeout, same fire-and-forget pattern.

**Loops.so events to create:**

| Event Name | Trigger | Data Sent |
|-----------|---------|-----------|
| `survey_sent` | Operator sends address survey | backerName, surveyUrl |
| `address_confirmed` | Backer confirms address | backerName |
| `order_placed` | MPC order submitted | backerName, estimatedShipDate |
| `order_shipped` | Individual shipment created | backerName, trackingNumber, carrier, trackingUrl |
| `order_delivered` | Shipment marked delivered | backerName |
| `support_ticket_opened` | Ticket auto-created | backerName, ticketType |
| `support_ticket_resolved` | Ticket resolved | backerName, resolution |

**File:** `src/lib/fulfillment/notification-templates.ts`

```typescript
// src/lib/fulfillment/notification-templates.ts

import type { FulfillmentNotification } from './types';

export function buildSurveyNotification(email: string, name: string, surveyUrl: string): FulfillmentNotification {
  return {
    eventName: 'survey_sent',
    recipientEmail: email,
    eventProperties: { backerName: name, surveyUrl },
  };
}

export function buildShippedNotification(
  email: string,
  name: string,
  trackingNumber: string,
  carrier: string,
): FulfillmentNotification {
  const trackingUrl = resolveTrackingUrl(carrier, trackingNumber);
  return {
    eventName: 'order_shipped',
    recipientEmail: email,
    eventProperties: { backerName: name, trackingNumber, carrier, trackingUrl },
  };
}

function resolveTrackingUrl(carrier: string, trackingNumber: string): string {
  const urls: Record<string, string> = {
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
  };
  return urls[carrier.toLowerCase()] || '';
}
```

#### Component 6: `FulfillmentSkill` -- Claude Code Skill

**Responsibility:** Operational automation that the operator invokes through Claude Code sessions. This is the orchestration layer for tasks that are too complex or infrequent to justify a dedicated UI.

**File:** `~/.claude/skills/fulfillment/SKILL.md`

**Commands the skill would handle:**
- "Import backers" -- upload CSV, call import API, report results
- "Send surveys" -- trigger batch survey emails via Loops.so
- "Generate order manifest" -- query backers by tier + region, produce MPC-ready order summary
- "Update shipping" -- batch update tracking numbers from a spreadsheet
- "Fulfillment status" -- call summary API, format for Slack
- "Check open tickets" -- list unresolved support tickets

This skill follows the existing pattern of `audit-site`, `weekly-report`, etc. -- it is a Claude Code workflow document that orchestrates tool calls (Read, Write, Bash, Slack MCP) to accomplish operational tasks.

---

## 4. Integration Map: How Fulfillment Connects to Existing Systems

```
EXISTING SYSTEM                    INTEGRATION POINT                 FULFILLMENT COMPONENT
---------------------              -----------------                 ---------------------
Loops.so contacts                  Email address match               Backer notification
(quiz subscribers)                 backers.email = loops contact     (bidirectional: quiz
                                   email. Store loops_contact_id     archetype informs
                                   on backer record.                 email personalization)

Supabase (Sprint 5                 Same Supabase project.            6 new tables in same
waitlist tables)                   Same supabase.ts client.          DB. Shared client.
                                   No cross-table FKs needed.        Independent schema.

Vercel serverless                  Same deployment. New routes       12+ new API routes in
(quiz-submit, waitlist)            under /api/fulfill/*.             src/pages/api/fulfill/

Astro SSG pages                    New pages under /fulfill/         Operator dashboard
                                   and /order-status.                (SSR) + public status
                                                                     (static + client JS)

src/env.d.ts                       Add FULFILL_ADMIN_KEY.            Single new env var.

launch-sequence skill              Post-campaign transition:         fulfillment skill
                                   launch-sequence hands off         picks up after
                                   to fulfillment skill when         campaign ends.
                                   KS campaign completes.

weekly-report skill                Add fulfillment stats             fulfillment_summary()
                                   section to weekly report.         RPC provides data.
```

---

## 5. What Does NOT Belong in This System

Drawing clear boundaries on what the fulfillment system should NOT attempt:

1. **Payment processing.** Kickstarter handles all payment collection. The fulfillment system only tracks pledge amounts for tier mapping, never processes payments.

2. **Full user authentication.** A shared secret for the operator is sufficient. Do not add Supabase Auth, OAuth, sessions, or JWTs. The operator is one person.

3. **Real-time MPC integration.** MPC has no API. Do not attempt to scrape their site or build a browser automation layer. Order placement is a manual operator action with the system providing data.

4. **Inventory management.** The system tracks what was ordered and what was shipped, but does not manage warehouse inventory counts, reorder points, or stock levels. That complexity belongs to a 3PL or spreadsheet.

5. **Financial accounting.** Track costs for reference but do not attempt profit/loss calculations, tax reporting, or accounting integration. That is the operator's bookkeeper's domain.

6. **Automated address correction.** Basic validation (completeness, country code) is in scope. USPS/international address verification APIs are out of scope for v1.

---

## 6. Phasing Recommendation

This is a large system. It should not be built all at once. Here is the structural phasing based on when each component is needed relative to the Kickstarter timeline:

### Phase 1: Schema + Import (Week after campaign ends, ~August 2026)
- Supabase table creation (DDL)
- `reward_tiers` + `tier_skus` seeding
- CSV parser + tier mapper
- Import API route
- Basic backer list page

### Phase 2: Survey + Address Collection (Weeks 2-3 post-campaign)
- Survey notification template + send route
- Backer status update route
- Address collection form (or integration with external survey tool)
- Backer detail page

### Phase 3: Order Manifest + Tracking (Weeks 4-8, production period)
- Manifest builder
- Order creation + status tracking routes
- Shipment creation + tracking routes
- Operator dashboard with summary stats

### Phase 4: Notifications + Public Status (Ship week)
- All Loops.so notification templates
- Batch notification sending
- Public order status page
- Shipping notification emails

### Phase 5: Support (Post-shipping, ongoing)
- Support ticket routes
- Ticket management in dashboard
- Replacement shipment flow

### Phase 0 (Pre-campaign, can build now):
- Type definitions (`src/lib/fulfillment/types.ts`)
- Status machine logic + tests (`src/lib/fulfillment/status-machine.ts`)
- CSV parser + tests (using sample/mock KS data)
- Tier mapper + tests (using planned tier structure from FAQ)
- Notification templates + tests
- Fulfillment skill skeleton

Phase 0 items are pure functions with no external dependencies. They can be built and tested now, validated against mock data, and ready to integrate when Supabase tables exist.

---

## 7. Critical Constraints and Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| MPC has no API | Order placement, tracking import, and status updates are all manual operator actions | Build the system to accept manual input gracefully. Provide CSV/batch import for tracking numbers. |
| Solo operator | Every manual step is a bottleneck | Automate every step that CAN be automated (notifications, status transitions, manifest generation). Make manual steps as low-friction as possible (upload a CSV, click a button). |
| Kickstarter backer data format may change | CSV column names/format not guaranteed stable | CSV parser should be configurable (column mapping), not hardcoded. |
| International shipping complexity | Customs declarations, duties, varying carrier options | Group backers by region in manifest. Provide per-region shipping notes. Defer customs automation to 3PL. |
| Supabase free tier limits | 500 MB database, 2 GB bandwidth | A few hundred backers with address data is well within limits. Monitor. |
| No Vercel cron jobs on hobby plan | Cannot auto-poll for tracking updates | Tracking updates are operator-initiated (manual or via fulfillment skill). |
| Address changes after shipping cutoff | Late address changes can cause failed deliveries | Hard cutoff date in system config. After cutoff, address changes create support tickets instead of direct updates. |

---

## 8. Open Questions for Other Agents

1. **Fulfillment model decision:** MPC direct-to-backer vs bulk-to-operator vs 3PL. This fundamentally shapes the shipment tracking architecture. The system as designed supports all three, but the operator workflow and cost structure differ dramatically.

2. **Survey tool:** Kickstarter's built-in survey vs BackerKit vs custom form. Custom form (Astro page + Supabase) is the cheapest but requires building address collection UI. BackerKit costs money but handles address collection, add-ons, and late pledges.

3. **Operator dashboard hosting:** The current site is at `thehermeticflight.com`. Should the operator dashboard be at `/fulfill/` (same domain, protected by admin key) or a separate deployment? Same domain is simpler but mixes public and internal surfaces.

4. **Timeline tension:** The Kickstarter launches 8/8/26. The current sprint roadmap has 6 sprints filling March through August. Fulfillment is a Sprint 7+ concern. But Phase 0 (pure logic) can be built now, and the schema/API work should be ready before the campaign ends. When does this enter the roadmap?
