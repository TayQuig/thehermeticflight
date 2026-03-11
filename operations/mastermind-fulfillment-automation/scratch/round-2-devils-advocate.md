# Round 2: Devil's Advocate

**Agent:** Devil's Advocate (Adversarial Stress-Test)
**Question:** Automated fulfillment pipeline for The Hermetic Flight tarot deck
**Date:** 2026-03-09
**Round:** 2 (Response to Moderator Directive)

---

## Position Change: BLOCK --> CONDITIONAL

I am withdrawing my BLOCK. The proposal on the table in Round 2 is materially different from what I argued against in Round 1. I will address the moderator's four directives in order, then state the conditions under which I agree.

---

## Directive 1: Is This Still a "Separate Product"?

**Concession: No, it is not.**

My Round 1 BLOCK was against building an Order Management System -- 6 Supabase tables, 12+ API routes, an admin dashboard with SSR pages, a support ticket system, state machines with 7-8 status codes, and a fulfillment skill. That is what the Builder and Designer proposed in Round 1. That *was* a separate product.

What is on the table now is narrower:

| Round 1 Proposal (Builder/Designer) | Round 2 Proposal (Refined) |
|--------------------------------------|----------------------------|
| 6 Supabase tables (`reward_tiers`, `tier_skus`, `backers`, `orders`, `shipments`, `support_tickets`) | Supabase tables coexisting with referral waitlist (scope TBD) |
| 12+ API routes under `/api/fulfill/` | CSV transform script (local, not deployed) |
| SSR admin dashboard with auth | Loops.so transactional email triggers |
| State machine with 3 entity types | Self-service `/track` page (static + client-side fetch) |
| Support ticket system | PledgeBox handles survey/address/support |
| Claude Code fulfillment skill | -- |
| **~800-1200 lines of new code** | **~200-400 lines of new code** |

The Round 2 proposal is closer to the Daydreamer's "Direction 3" -- use a pledge manager for the heavy lifting, build only the thin transform layer. This is not a separate product. This is glue code between existing services. I was wrong to apply the "separate product" label to this version.

---

## Directive 2: PII and GDPR Risk

**Concession: Partially resolved. One condition remains.**

If PledgeBox handles backer survey and address collection, the custom system does NOT need to store mailing addresses. The data footprint in Supabase shrinks to:

| Field | PII? | Already in Loops.so? |
|-------|------|---------------------|
| email | Yes | Yes (quiz pipeline already stores this) |
| reward tier | No | No |
| fulfillment status | No | No |
| tracking number | No | No |
| MPC batch reference | No | No |

This is a meaningful de-risking. Email is already stored in Loops.so from the quiz pipeline, so the incremental PII exposure from adding email + status to Supabase is near zero -- the same email address is already in an external system with the same service_role key access pattern.

**Remaining risk (MEDIUM, downgraded from HIGH):** The Builder's Round 1 schema (`orders` table) stores full shipping addresses -- `address_line_1`, `address_line_2`, `city`, `state_province`, `postal_code`, `country_code`. The Designer's schema stores even more: `shipping_name`, `shipping_address_line1` through `shipping_country`. If anyone builds from those schemas as written, addresses end up in Supabase.

**Condition:** The agreed-upon Supabase schema must explicitly exclude mailing addresses. PledgeBox owns address data. Supabase stores only: `email`, `tier_id`, `status`, `tracking_number`, `carrier`, `mpc_batch_id`, `shipped_at`, `created_at`, `updated_at`. If an address field appears in a migration script, this condition is violated. This should be a bright-line rule documented in the plan, not left to implementer discretion.

---

## Directive 3: PledgeBox Free vs. BackerKit $450-900

**Concession: This changes the calculus.**

My Round 1 recommendation was "use BackerKit, cost is $450-900, still cheaper than building." PledgeBox at $0 base cost (3% only on add-on revenue) makes the buy-side even cheaper. The build-vs-buy comparison now looks like:

| Approach | Cost |
|----------|------|
| PledgeBox (survey, addresses, support) | $0 (no add-ons) to ~$150 (if $5K in add-ons) |
| CSV transform script | 2-4 hours of dev time |
| Loops.so transactional emails | $0 (free tier) to $49/mo for 2-3 months during fulfillment |
| `/track` page | 4-8 hours of dev time |
| Supabase tables (coexist with waitlist) | $0 |
| **Total** | **$0-250 + 6-12 hours dev time** |

Compare to my Round 1 "build nothing" recommendation: PledgeBox ($0) + MPC fulfillment + shared inbox + Loops manual sends. The delta between "build nothing" and "build the thin layer" is roughly 6-12 hours of development time. That is not a meaningful resource expenditure for a system that will serve 500-2000 backers.

I no longer have a cost-based objection to the build.

---

## Directive 4: Sprint 7 (September 2026) and Scope Creep

**Concession: The timing objection is resolved.**

My Round 1 CRITICAL risk on scope creep was: "Every hour spent on fulfillment automation is an hour not spent on the Kickstarter countdown page, the card gallery, the referral waitlist, or the archetype journey pages." This assumed fulfillment work would compete with the pre-launch roadmap (Sprints 1-6, March-August).

Sprint 7 in September 2026 is post-campaign. The pre-launch features are either shipped or irrelevant by then. Fulfillment work cannot cannibalize pre-launch features if it does not start until after launch. The timeline objection is fully resolved.

**One caveat (LOW risk):** "Sprint 7" is a commitment to future work. Commitments have a way of pulling work forward. If in July someone says "we should start the fulfillment schema now since we're already in Supabase for the waitlist," that is the scope creep I warned about. The mitigation is simple: fulfillment code does not enter the codebase until September 2026. Schema design in a doc is fine. SQL in the repo is not.

---

## Risks That Remain

My Round 1 analysis identified 10 risks. Here is the updated status after Round 2 context:

| # | Risk | Round 1 Severity | Round 2 Status |
|---|------|------------------|----------------|
| 1 | MPC has no API | CRITICAL | **RESOLVED.** The proposal no longer assumes an MPC API. CSV transform + manual upload is the explicit design. |
| 2 | Scope creep consumes pre-launch roadmap | CRITICAL | **RESOLVED.** Sprint 7 (September) is post-campaign. |
| 3 | PII storage creates legal/security liability | HIGH | **DOWNGRADED to MEDIUM.** PledgeBox handles addresses. Condition: no addresses in Supabase. |
| 4 | MPC production/shipping failures | HIGH | **UNCHANGED.** Still HIGH. No proposal addresses this. Budget for 10% issue rate. PledgeBox may help with support tooling. |
| 5 | Customer support automation is a tarpit | HIGH | **RESOLVED.** Help Scout free plan handles support. No one is proposing automated support. |
| 6 | Build vs. buy | HIGH | **RESOLVED.** PledgeBox (free) + thin custom layer is the right hybrid. |
| 7 | Supabase dependency cascading | MEDIUM | **DOWNGRADED to LOW.** With addresses excluded, the fulfillment data is lightweight. A few thousand rows of (email, tier, status, tracking) is negligible on the free tier. |
| 8 | Reward tiers undefined | MEDIUM | **UNCHANGED.** Still MEDIUM. Cannot build tier mapping without tier definitions. Not a blocker for architectural planning, but blocks implementation. |
| 9 | Integration surface area explosion | MEDIUM | **DOWNGRADED to LOW.** The thin proposal integrates with 2 services (Supabase, Loops.so), both already in the stack. Not 5-7 new integrations. |
| 10 | Premature optimization | LOW | **RESOLVED.** Sprint 7 timing is appropriate. |

### New Risk: PledgeBox Vendor Dependency (MEDIUM)

**What breaks:** PledgeBox is free, which is great, but free services have less predictable longevity than paid ones. PledgeBox has been around since ~2017 and has served 8,000+ campaigns, so this is not a fly-by-night concern. However, if PledgeBox experiences issues, changes pricing, or shuts down between campaign end (September 2026) and fulfillment completion (December 2026), the operator loses the survey/address management layer.

**Conditions under which this breaks:** PledgeBox becomes unavailable or unusable during the 3-month post-campaign window.

**Mitigation:** Export backer data from PledgeBox early and often. Keep a local CSV backup after each survey round closes. If PledgeBox fails, fall back to Kickstarter's native backer survey (free, built-in, adequate for single-product campaigns). This is a recoverable failure.

### Surviving Risk: MPC Production/Shipping Failures (HIGH)

**What breaks:** At 500-2000 backers with international shipping, expect 5-10% fulfillment issues (50-100 affected backers). MPC's support is email-only, response times vary, and tracking for non-US/Canada shipments is limited ("recorded delivery" with no real tracking).

**This risk is NOT addressed by any of the proposals.** The CSV transform, the Loops.so triggers, the `/track` page -- none of these help when MPC misprints 200 decks or when 30 international packages are "delivered" but never received.

**Mitigation:** This is an operational risk, not a technical one. The operator should:
1. Budget 10% contingency on total production cost for reprints/re-ships.
2. Ship a small test batch (10-20 decks to beta testers) before the main fulfillment run.
3. Use Help Scout free plan for issue tracking, not a custom system.
4. Accept that some international backers will have bad experiences. This is inherent to shipping from Hong Kong to 50+ countries.

---

## Final Position: CONDITIONAL

I agree to the refined proposal under the following conditions:

### Condition 1: No Addresses in Supabase (Hard Gate)

The Supabase fulfillment schema stores only: `email`, `tier_id`, `status`, `tracking_number`, `carrier`, `mpc_batch_id`, `shipped_at`, `created_at`, `updated_at`. PledgeBox owns all address data. No migration script, no seed file, no API route should accept or store mailing address fields. This is a bright-line rule.

**Why:** A solo creator on Supabase free tier with a service_role key in a `.env` file should not be the custodian of 1000+ home addresses. PledgeBox has a security team. You have a laptop.

### Condition 2: No Code Before September 2026 (Hard Gate)

Schema design documents, architectural plans, Loops.so template drafts -- all fine before September. But no fulfillment-related code (scripts, API routes, pages, database migrations) enters the codebase until after the Kickstarter campaign closes. The pre-launch roadmap (Sprints 1-6) is protected.

**Why:** "We already have the schema, might as well build the import route" is how scope creep starts. The operator's time between March and August must be spent on features that determine whether the Kickstarter succeeds: countdown page, card gallery, referral waitlist, archetype journey pages, daily card draw. Fulfillment features have zero impact on campaign success.

### Condition 3: Test Batch Before Full Fulfillment (Recommended, Not Hard Gate)

Before submitting the full MPC fulfillment spreadsheet for 500-2000 backers, ship a test batch of 10-20 decks to verify: print quality, packaging, shipping timeline, tracking accuracy, and the CSV-to-MPC-spreadsheet transform. Use this batch to validate the entire pipeline end-to-end.

**Why:** Discovering that your CSV column mapping is wrong or that MPC misprints your card backs on 1500 decks is a $5,000-$15,000 mistake. Discovering it on 15 decks is a $150 mistake.

### Condition 4: PledgeBox Data Export Backup (Recommended, Not Hard Gate)

After each survey round closes, export the complete backer dataset from PledgeBox and store it locally (encrypted). Do not rely solely on PledgeBox availability during the fulfillment window.

**Why:** Free services can change terms, experience outages, or sunset features. Having a local backup of backer data (addresses included -- stored encrypted, not in Supabase) ensures you can complete fulfillment even if PledgeBox becomes unavailable.

---

## What I Got Right in Round 1

1. **MPC has no API.** This was the correct foundational observation. The other agents all confirmed it.
2. **Build vs. buy.** The recommendation to use a pledge manager was correct. PledgeBox is a better pick than BackerKit at this scale.
3. **Customer support should not be automated.** Help Scout free plan is the right answer.
4. **Premature optimization warning.** Fulfillment planning in March for a September need was correctly flagged. The Sprint 7 placement resolves this.

## What I Got Wrong in Round 1

1. **I argued against a strawman.** My "separate product" characterization was accurate for the Builder's and Designer's Round 1 proposals (6 tables, 12+ API routes, admin dashboard, support ticket system), but the group has converged on something much lighter. I should have stress-tested the thin version alongside the heavy version instead of only attacking the maximal interpretation.
2. **I overweighted BackerKit cost.** PledgeBox at $0 is a materially different proposition than BackerKit at $450-900. I should have researched PledgeBox pricing in Round 1 instead of defaulting to BackerKit as the only pledge manager option.
3. **I said "build nothing."** The correct recommendation is "build almost nothing" -- the CSV transform and Loops.so triggers are genuine value-adds that take 6-12 hours, not 200+ hours. The difference between zero custom code and a thin orchestration layer is not a matter of principle; it is a matter of proportion.

---

## Summary

The Round 2 proposal -- PledgeBox for survey/addresses, a CSV transform script, Loops.so transactional triggers, a `/track` page, lightweight Supabase tables (no addresses), built in Sprint 7 (September 2026) -- is a reasonable, proportional system for a solo creator's first Kickstarter.

My BLOCK is withdrawn. My position is CONDITIONAL on the four conditions above, of which Conditions 1 and 2 are hard gates and Conditions 3 and 4 are strong recommendations.

The remaining HIGH risk (MPC production/shipping failures) is operational, not technical. No amount of code mitigates it. Budget for it, test before scaling, and accept the inherent variance of international fulfillment from a Hong Kong manufacturer.

---

## Sources

- [PledgeBox Pricing](https://www.pledgebox.com/pricing) -- Free base, 3% on add-ons only
- [MPC Fulfillment Services](https://www.makeplayingcards.com/mpc-fulfillment-services.aspx) -- Manual spreadsheet process, $1/parcel surcharge
- [Loops.so Transactional Email API](https://loops.so/docs/api-reference/send-transactional-email) -- Supports all fulfillment email types
- [Help Scout Free Plan](https://docs.helpscout.com/article/1597-free-plan) -- 5 users, 1 inbox, AI tools, no time limit
- [Kickstarter GDPR Guidance](https://help.kickstarter.com/hc/en-us/articles/360012254254) -- Creator obligations for backer data
