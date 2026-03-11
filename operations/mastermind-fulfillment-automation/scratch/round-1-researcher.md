# Round 1 — Researcher Analysis

## Fulfillment Automation for The Hermetic Flight Tarot Deck

> Agent: Researcher
> Date: 2026-03-09
> Round: 1 (Initial Analysis)

---

## Executive Summary

The Hermetic Flight fulfillment pipeline is fundamentally constrained by one fact: **MakePlayingCards.com has no API.** All ordering happens through a manual web GUI. This means full end-to-end automation is impossible — the pipeline will be semi-automated, with manual MPC touchpoints bookended by automated backer management and notification systems.

The good news: MPC's fulfillment service is purpose-built for Kickstarter campaigns and handles the hardest part (individual packing + worldwide shipping) for just $1/parcel. The architecture that makes sense is: **Kickstarter/PledgeBox (backer data) -> manual MPC order (print + fulfill) -> Supabase (tracking/status) -> Loops.so (notifications) -> Help Scout (support)**.

---

## Finding 1: MPC Fulfillment is Manual but Purpose-Built

### Evidence
MPC offers a one-stop print-and-fulfill service specifically for Kickstarter creators. The process is:
1. Upload card art via web GUI (one-time, manual)
2. Download fulfillment spreadsheet template
3. Fill in backer addresses + items
4. Submit to MPC for shipping quote
5. Approve and pay
6. MPC prints, packs, labels, ships to individual addresses
7. MPC returns Excel with all tracking numbers

**Pricing:** $1.00/parcel surcharge + standard shipping. No setup fees, no minimums.

**Critical constraint:** There is NO public API. The only community workaround (MPC Autofill) automates card image upload via Selenium browser automation, but does NOT handle fulfillment logistics, address management, or bulk order placement. It's designed for Magic: The Gathering proxy printing, not Kickstarter fulfillment.

### Implications
- The MPC order placement step will always be manual
- Automation opportunity lies in: (a) transforming backer CSV to MPC spreadsheet format, (b) importing tracking numbers from MPC's Excel output, (c) triggering notification emails
- For 500-2000 decks, this manual step is a one-time (or few-time) task — manageable for a solo creator

### Sources
- https://www.makeplayingcards.com/mpc-fulfillment-services.aspx
- https://www.makeplayingcards.com/low-price-for-bulk.aspx
- https://github.com/chilli-axe/mpc-autofill/wiki/Overview
- Artifact: `operations/mastermind-fulfillment-automation/mpc-fulfillment-reference.md`

---

## Finding 2: Backer Data Pipeline — PledgeBox is the Right Choice

### Evidence
Three pledge managers were evaluated: BackerKit, PledgeBox, and Gamefound.

**BackerKit:** 2% campaign fee + 3.5% transaction fee on add-ons. For a ~$30K raise, that's ~$600 in campaign fees alone. Historically had high setup fees (now removed). Best-in-class features but expensive for small creators.

**PledgeBox:** Free for surveys without payment collection. Only 3% on add-on sales. No upfront fees, no per-backer fees, no campaign fees. 8,000+ creators have used it. Includes pre-launch pages, analytics, email marketing, backer surveys, CSV export.

**Gamefound:** 5% on add-ons + $0.20/transaction. Designed for board game community. Audience mismatch for tarot.

**Kickstarter Native:** Now offers its own backer survey (upgraded 2024) with SKU management, address collection, and CSV export compatible with fulfillment partners. This may be sufficient without any third-party tool.

### Implications
- **Minimum viable path:** Use Kickstarter's native backer survey + CSV export. Zero cost.
- **Recommended path:** PledgeBox (free tier) for better survey UX, add-on upselling, and email marketing. The add-on capability could meaningfully increase revenue (guidebook, extra cards, art prints).
- **Skip:** BackerKit (too expensive for this scale) and Gamefound (wrong audience)

### Sources
- https://www.pledgebox.com/pricing
- https://www.backerkit.com/pricing/pledge_manager
- https://updates.kickstarter.com/backer-survey-2024/
- https://help.kickstarter.com/hc/en-us/articles/115005135894
- Artifact: `operations/mastermind-fulfillment-automation/kickstarter-fulfillment-tools.md`

---

## Finding 3: Loops.so CAN Handle Fulfillment Emails

### Evidence
Loops.so supports transactional email via a REST API:
- Endpoint: `POST https://app.loops.so/api/v1/transactional`
- Dynamic data variables (strings, numbers, arrays)
- Attachment support
- Idempotency keys to prevent duplicate sends
- Dynamic Subject/From/Reply-to/CC/BCC

**Rate limit:** 10 requests/second (sufficient for batch of 2000 emails in ~3.5 minutes).

**Pricing for fulfillment:**
- Free plan: 4,000 sends/month (shared marketing + transactional)
- $49/month plan: Unlimited transactional sends; transactional recipients don't count as contacts

**Supabase integration exists** but is auth-focused (SMTP relay for signup/magic link emails). A custom integration for fulfillment would use Supabase DB + Vercel serverless + Loops.so transactional API.

### Implications
- Loops.so is suitable for ALL fulfillment email types (confirmation, shipping, tracking, support)
- During active fulfillment, the $49/mo plan is needed (2-3 months = ~$100-150 total)
- The existing Hermetic Flight Loops.so setup (quiz pipeline) extends naturally to fulfillment
- No need for a separate transactional email provider

### Sources
- https://loops.so/docs/api-reference/send-transactional-email
- https://loops.so/docs/account/free-plan
- https://loops.so/pricing
- https://supabase.com/partners/integrations/loops
- Artifact: `operations/mastermind-fulfillment-automation/loops-transactional-email-reference.md`

---

## Finding 4: Fulfillment Timeline is Faster Than Average

### Evidence
Typical Kickstarter fulfillment takes 12-15 months. But MPC's direct-fulfillment model eliminates the freight/warehouse phases that consume most of that time:

| Phase | Standard KS | MPC Direct |
|-------|-------------|------------|
| Funds clearing | 2-4 weeks | 2-4 weeks |
| Survey/addresses | 2-4 weeks | 2-4 weeks |
| Manufacturing | 8-16 weeks | 2-3 weeks (MPC is fast) |
| Freight to warehouse | 4-8 weeks | N/A (MPC ships direct) |
| Warehouse receiving | 1-3 weeks | N/A |
| Pick/pack/ship | 1-4 weeks | Included in MPC fulfillment |
| Domestic delivery | 1-2 weeks | 1-2 weeks |
| International delivery | 2-4 weeks | 2-4 weeks |
| **TOTAL** | **12-15 months** | **2-4 months** |

**WARNING:** Chinese New Year (Jan/Feb) shuts down MPC production for 3-4 weeks. With an August 2026 Kickstarter, fulfillment should target Oct-Dec 2026 to avoid this.

### Implications
- Hermetic Flight can promise and deliver on an aggressive 3-4 month fulfillment timeline
- This is a major competitive advantage vs. typical Kickstarter card/game projects
- Target: Campaign ends ~Sep 2026, fulfillment complete by Dec 2026 (before CNY)

### Sources
- https://updates.kickstarter.com/post-campaign-fulfillment-timeline-what-creators-need-to-know/
- https://www.makeplayingcards.com/delivery.aspx

---

## Finding 5: Customer Support — Help Scout Free Plan is Sufficient

### Evidence
At 500-2000 backers, expected support volume is 25-300 tickets over the fulfillment period. Evaluated options:

**Help Scout (Recommended):**
- Free plan: 5 users, 1 inbox, 1 knowledge base, AI tools (Drafts, Answers, Assist, Summarize)
- No time limit on free plan
- Contact-based billing if upgrade needed

**Freshdesk:**
- Free for 6 months (2 agents), then paid
- Good features but time-limited

**FreeScout:**
- Free, self-hosted, unlimited everything
- Requires server maintenance — overhead for solo creator

### Implications
- Help Scout free plan covers the entire fulfillment period and beyond
- AI tools meaningfully reduce response time for a solo creator
- Knowledge base reduces repeat "where's my order" tickets
- Set up toward end of campaign, populate FAQ before shipping begins

### Sources
- https://www.helpscout.com/pricing/
- https://docs.helpscout.com/article/1597-free-plan
- https://support.freshdesk.com/support/solutions/articles/50000010099
- Artifact: `operations/mastermind-fulfillment-automation/customer-support-reference.md`

---

## Finding 6: Architecture — How It All Connects

### Proposed Data Flow

```
BACKER DATA COLLECTION
Kickstarter Campaign -> PledgeBox (survey + addresses + add-ons) -> CSV Export

ORDER PLACEMENT (MANUAL)
CSV -> Transform script -> MPC Fulfillment Spreadsheet -> Manual MPC submission

TRACKING & NOTIFICATIONS (AUTOMATED)
MPC Tracking Excel -> Import script -> Supabase (backer_orders table)
Supabase status change -> Vercel serverless function -> Loops.so transactional API -> Backer email

CUSTOMER SUPPORT
Help Scout inbox <- Backer replies to Loops.so emails
Help Scout knowledge base <- Self-service FAQ
```

### What Needs to Be Built

| Component | Effort | Stack |
|-----------|--------|-------|
| CSV transform (PledgeBox -> MPC format) | Small | Node script or Vercel function |
| Supabase schema (backers, orders, tracking) | Medium | Supabase SQL |
| Tracking import script (MPC Excel -> Supabase) | Small | Node script |
| Loops.so transactional templates (6 types) | Medium | Loops.so dashboard |
| Notification trigger (status change -> email) | Medium | Vercel serverless or Supabase Edge Function |
| Help Scout setup + FAQ | Small | Help Scout dashboard |
| Backer status dashboard (optional) | Large | Astro page + Supabase |

### What Already Exists in the Stack
- Loops.so account and API key (from quiz pipeline)
- Vercel serverless function pattern (from quiz-submit.ts)
- Astro site infrastructure
- Planned Supabase backend (from sprint roadmap)

---

## Gaps and Limitations

### Research Gaps
1. **MPC exact pricing for 78-card tarot at 500-2000 quantity** — Requires direct quote request. Bulk pricing page shows tiers but not exact per-unit cost for tarot-size + custom box at specific quantities.
2. **MPC fulfillment spreadsheet format** — Could not access the actual template. Need to download from MPC account to understand exact column structure.
3. **PledgeBox CSV export format** — Could not verify exact column structure. Need to compare with MPC spreadsheet requirements.
4. **Kickstarter backer survey API access** — No evidence of a programmatic API for backer data. CSV export appears to be the only method.
5. **BoardGameGeek user experience thread** — 403 blocked on fetch. Community experiences with MPC fulfillment quality could not be fully verified.
6. **VAT/customs collection** — PledgeBox can help collect estimated VAT for UK/EU backers. Exact process and capabilities not fully documented.

### Quality Notes
- MPC fulfillment information comes from official MPC pages (high confidence)
- Loops.so API docs are from official documentation (high confidence)
- Pricing information for all tools is from official pricing pages (high confidence)
- Fulfillment timeline estimates are from Kickstarter official guidance + creator experience (medium-high confidence)
- Help Scout free plan details from official docs (high confidence)

---

## Key Recommendations

1. **Do NOT try to fully automate MPC ordering.** The manual step is unavoidable and manageable at this scale. Focus automation on the surrounding pipeline (data transform, tracking import, notifications).

2. **Request a bulk quote from MPC NOW** for 500/1000/1500/2000 tarot decks with your preferred box type. This is critical for accurate Kickstarter pricing.

3. **Use PledgeBox (free tier)** for post-campaign management. It's free, sufficient, and the add-on capability can increase revenue.

4. **Plan fulfillment for Oct-Dec 2026** to avoid Chinese New Year production delays.

5. **Budget $49/mo for Loops.so** during the 2-3 month fulfillment window for unlimited transactional emails.

6. **Set up Help Scout free plan** before fulfillment begins. Populate the knowledge base with anticipated FAQs.

7. **Design the Supabase schema** as part of Sprint 3 or 4 (per existing roadmap) to include backer/order/tracking tables alongside other planned features.

---

## Research Artifacts on Disk

| File | Contents |
|------|----------|
| `operations/mastermind-fulfillment-automation/mpc-fulfillment-reference.md` | MPC pricing, process, bulk rates, MPC Autofill analysis, practical workflow |
| `operations/mastermind-fulfillment-automation/kickstarter-fulfillment-tools.md` | Pledge manager comparison, backer survey details, fulfillment timeline, best practices |
| `operations/mastermind-fulfillment-automation/loops-transactional-email-reference.md` | Loops.so API docs, rate limits, pricing, Supabase integration, template specs |
| `operations/mastermind-fulfillment-automation/customer-support-reference.md` | Help Scout/Freshdesk/FreeScout comparison, recommended approach, integration notes |
