# Mastermind Report: Fulfillment Automation for The Hermetic Flight Tarot Deck

**Date:** 2026-03-09
**Rounds:** 2
**Consensus:** Conditional

## The Idea
How to automate the entire fulfillment process for the Hermetic Flight tarot deck — from placing orders through makeplayingcards.com, to shipping/receiving for each eligible Kickstarter backer and rewards program participant, to handling customer support. How does this plug into our current Astro/Vercel/Loops.so/Supabase architecture?

## Consensus Summary

The group converged on a clear answer: **do not build a fulfillment application.** Build a single Claude Code skill that bridges the gaps between off-the-shelf services.

The central finding — confirmed independently by all five agents — is that MakePlayingCards.com has no API. Order placement, production tracking, and shipping dispatch are manual, spreadsheet-driven processes. This eliminates the premise of "automating the entire fulfillment process" and reframes the question as: *what is the thinnest possible glue layer between the services that do exist?*

The group's answer: use a free pledge manager (Kickstarter's native PM or PledgeBox) for backer surveys and address collection, MPC's fulfillment service ($1/parcel) for printing and direct-to-backer shipping, Help Scout (free plan) for customer support, and Loops.so (already in the stack) for shipping notification emails. The only custom code is a `fulfillment-ops` Claude Code skill with three commands: CSV format transform, tracking number import with email trigger, and backer lookup. Six files, seven hours of implementation, built in September 2026 after the campaign closes — not during the pre-launch sprint roadmap.

The Devil's Advocate initially blocked, arguing the proposal was a separate product that would consume the pre-launch development budget. After Round 2 revealed the actual scope (6 files vs. the 12-file, 4-phase OMS proposed in Round 1), the block was withdrawn with two hard conditions: no backer mailing addresses stored in any cloud database, and no fulfillment code in the codebase until September 2026. Both conditions were accepted by the group.

The deliberation also surfaced a significant finding from the Researcher: Kickstarter's native pledge manager, made available to all creators in May 2025, is now comprehensive enough to handle address collection, SKU management, tax/VAT, and CSV export at zero cost. For a single-product campaign with 2-3 tiers and no add-on store, it eliminates the need for any third-party pledge management tool.

## Agent Contributions

### Daydreamer
Proposed five directions ranging from "MPC is the only backend" to "digital twin stretch goal." The key contribution was Direction 3 (pledge manager does the heavy lifting, custom code is just CSV transforms) and the insight that Claude Code itself is the admin dashboard — no web UI needed for a solo operator. Also surfaced the "fulfillment as content" concept: narrative-themed waiting emails and a post-delivery guided first-reading sequence, which is a content design opportunity worth pursuing through Loops.so drip sequences.

### Designer
Provided the most thorough architectural decomposition: 6 components, full Supabase schema, state machines, interface contracts, and integration maps. While the group converged on something much lighter than this architecture, the Designer's structural analysis was foundational — particularly the observation that fulfillment is "a post-campaign operational system fundamentally different from the pre-launch marketing engine." The Phase 0 concept (pure functions testable without infrastructure) influenced the Builder's revised approach.

### Researcher
Produced 4 research artifacts covering MPC fulfillment, pledge management tools, Loops.so transactional email capabilities, and customer support options. The critical fact-checks in Round 2 — verifying PledgeBox's free tier ($0 for surveys), BackerKit's actual cost ($900-1,075 for a $45K campaign), and Kickstarter's native PM capabilities — resolved the build-vs-buy debate. The MPC fulfillment timeline finding (2-4 months vs. 12-15 month KS average, thanks to MPC's direct-to-backer model) is valuable for campaign messaging.

### Builder
Underwent the most dramatic scope revision of any agent. Round 1 proposed 12 files, 2 npm packages, 4 Supabase tables, 6 API routes, 4 Astro pages, and 100-200 hours. Round 2 cut to 6 files, 0 packages, 0 tables, 0 routes, 0 pages, and 7 hours. The key insight: tracking data is ephemeral (exists for 2-3 months during fulfillment) and belongs in a local gitignored JSON file, not a cloud database. The skill-based approach (CSV in, CSV out, emails out) is the minimum viable automation that eliminates the manual spreadsheet wrangling between PledgeBox, MPC, and Loops.so.

### Devil's Advocate
Identified 10 risks across two rounds, with the two critical risks (MPC has no API; scope creep consuming pre-launch roadmap) shaping the entire discussion. The GDPR/PII concern drove the group to exclude mailing addresses from any custom storage. The "build vs. buy" analysis — comparing $450-900 for BackerKit against 200+ hours of custom development — was the forcing function that compressed scope. The DA's self-correction in Round 2 (acknowledging the strawman of arguing against a 6-file skill as if it were a separate product) demonstrated intellectual honesty and allowed consensus.

## Conditions

- **Hard Gate 1:** No backer mailing addresses stored in Supabase or any cloud database. PledgeBox (or Kickstarter native PM) owns address data. The custom system stores only: email, tier, status, tracking number, carrier.
- **Hard Gate 2:** No fulfillment code enters the codebase until September 2026 (post-campaign). Schema design documents and architectural plans are fine. Code is not. The pre-launch roadmap (Sprints 1-6) is protected.
- **Recommendation 3:** Ship a test batch of 10-20 decks (to beta testers or friends) before submitting the full MPC fulfillment spreadsheet. Validates print quality, packaging, shipping timeline, tracking accuracy, and the CSV transform pipeline end-to-end.
- **Recommendation 4:** After each PledgeBox survey round, export and back up the complete backer dataset locally (encrypted). Do not rely solely on PledgeBox availability during the fulfillment window.

## Research Artifacts

- `operations/mastermind-fulfillment-automation/mpc-fulfillment-reference.md` — MPC pricing, fulfillment process, bulk rates, MPC Autofill analysis
- `operations/mastermind-fulfillment-automation/kickstarter-fulfillment-tools.md` — Pledge manager comparison (BackerKit vs PledgeBox vs Kickstarter native), backer survey details, fulfillment timeline, updated with Round 2 KS native PM findings
- `operations/mastermind-fulfillment-automation/loops-transactional-email-reference.md` — Loops.so transactional API docs, rate limits, pricing, template specs
- `operations/mastermind-fulfillment-automation/customer-support-reference.md` — Help Scout/Freshdesk/FreeScout comparison, recommended approach
- `operations/mastermind-fulfillment-automation/scratch/` — Full deliberation audit trail (Round 1 × 5 agents, Round 2 × 3 agents, consensus vote)

## The Fulfillment Stack

| Layer | Tool | Cost | Custom Code? |
|-------|------|------|:---:|
| Pledge management & address collection | Kickstarter native PM or PledgeBox | $0 | No |
| Printing & direct-to-backer shipping | MPC fulfillment service | $1/parcel + shipping | No |
| CSV format transform (pledge mgr → MPC) | `fulfillment-ops` skill | $0 | Yes (1 script) |
| Tracking import + shipping emails | `fulfillment-ops` skill + Loops.so | $49/mo × 2-3 months | Yes (2 scripts) |
| Backer lookup (for support tickets) | `fulfillment-ops` skill | $0 | Yes (1 command) |
| Customer support | Help Scout free plan | $0 | No |
| **Total custom code** | **6 files, 7 hours** | **$0** | |
| **Total external tool cost** | | **~$100-150 + MPC printing/shipping** | |

## How It Plugs Into Current Architecture

The fulfillment system is **operationally adjacent to, not architecturally coupled with** the existing Hermetic Flight site.

- **No changes to the Astro site.** No new pages, no new API routes, no modified components.
- **No changes to `src/`.** The skill lives in `~/.claude/skills/fulfillment-ops/` and utility scripts live in `scripts/fulfillment/`.
- **No new npm packages.** CSV parsing uses a simple custom parser; no `papaparse` needed for well-formed exports.
- **No Supabase tables for fulfillment.** Supabase remains reserved for the referral waitlist (Sprint 5B). Tracking data is ephemeral and stored locally.
- **Loops.so reuse.** The same `LOOPS_API_KEY` and transactional email API pattern from `quiz-submit.ts` powers shipping notifications.
- **Slack integration via existing `slack-notify` convention.** Fulfillment status summaries post to `#the-hermetic-flight`.

The fulfillment skill is the 6th entry in the Claude Code skills suite, following `audit-site`, `publish-post`, `social-blast`, `weekly-report`, and `launch-sequence`.

## Timeline

```
March-August 2026    Sprints 1-6 (pre-launch roadmap — DO NOT touch)
August 8, 2026       Kickstarter launches
~September 8, 2026   Campaign ends
September 8-15       Export backer CSV, download MPC template, define column mappings
September 15-17      Build fulfillment-ops skill (7 hours)
September 17-20      Test with real data, ship 10-20 deck test batch
October 1-15         Submit full MPC fulfillment spreadsheet, production run
October 15-20        MPC ships, returns tracking Excel
October 20           Run /fulfillment-ops import-tracking → 500+ shipping emails
October-December     Support tickets via Help Scout, lookups via /fulfillment-ops lookup
December 2026        Fulfillment complete (before Chinese New Year shutdown)
```

## Operator Action Items (Pre-Campaign)

These can be done now — they are research/planning tasks, not code:

1. **Download MPC's fulfillment spreadsheet template** from https://www.makeplayingcards.com/mpc-fulfillment-services.aspx — confirms exact column format and eliminates the biggest remaining unknown.
2. **Request a bulk quote from MPC** for 500/1000/1500/2000 tarot decks with preferred box type — critical for accurate Kickstarter pledge pricing.
3. **Decide pledge manager:** Kickstarter native PM (free, simplest) vs PledgeBox (free, adds email marketing + add-on store). Decision can be deferred until campaign setup.
4. **Define reward tiers.** Every piece of fulfillment architecture depends on knowing what's being fulfilled. Keep tiers simple: all physical items should be things MPC can produce (decks, guidebooks, boxes). Each non-card physical item doubles fulfillment complexity.
5. **Plan fulfillment for October-December 2026** to avoid Chinese New Year production shutdown (January-February).

## Next Steps

- [ ] **Immediate:** Download MPC fulfillment template + request bulk pricing quote
- [ ] **Immediate:** Define reward tiers (blocked by operator content decisions)
- [ ] **Pre-campaign (July 2026):** Choose pledge manager (KS native vs PledgeBox)
- [ ] **Pre-campaign (July 2026):** Set up Help Scout free plan, populate knowledge base with fulfillment FAQs
- [ ] **Pre-campaign (July 2026):** Design Loops.so transactional email templates for fulfillment milestones (shipped, delivered, etc.)
- [ ] **Post-campaign (September 2026):** Build `fulfillment-ops` Claude Code skill (7 hours)
- [ ] **Post-campaign (September 2026):** Ship 10-20 deck test batch to validate pipeline end-to-end
- [ ] **Post-campaign (October 2026):** Execute fulfillment via the skill
- [ ] **Optional:** Design narrative-themed fulfillment emails (Daydreamer's Direction 4 — "fulfillment as content") for the Loops.so drip sequences
- [ ] **Deferred:** Digital companion / activation code concept (Daydreamer's Direction 5 — potential stretch goal)
