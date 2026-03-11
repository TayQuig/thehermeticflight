# Round 1: Devil's Advocate

**Agent:** Devil's Advocate (Adversarial Stress-Test)
**Question:** Automated fulfillment pipeline for The Hermetic Flight tarot deck
**Date:** 2026-03-09

---

## Executive Verdict

**BLOCK on "automate the entire fulfillment process" as stated.** The premise contains a fatal assumption: that MakePlayingCards.com exposes a programmatic API for order placement and fulfillment. It does not. MPC's fulfillment service is a manual, spreadsheet-driven workflow. Building custom automation around a vendor with no API, no webhook callbacks, and no programmatic order status is building a house on sand. The proposal should be reconceived as "fulfillment orchestration with manual MPC touchpoints" rather than "automated fulfillment pipeline."

Beyond the MPC API gap, this proposal would inject a major new system (order management, PII storage, customer support tooling) into an already-packed 6-sprint roadmap for a solo creator. The risk/reward ratio is deeply unfavorable at this stage.

---

## Risk Analysis

### RISK 1: MPC Has No API --- Entire Automation Premise is Invalid

**Severity: CRITICAL**

**What breaks:** The core proposal assumes you can programmatically place orders, submit shipping addresses, track production status, and receive shipment notifications from MakePlayingCards.com. None of this exists.

**Evidence:**
- MPC's fulfillment service works via a downloadable Excel spreadsheet ("fulfillment sheet") where the creator fills in backer addresses and items, emails it back, and receives a shipping cost quote manually. ([MPC Fulfillment Services](https://www.makeplayingcards.com/mpc-fulfillment-services.aspx))
- MPC's Kickstarter FAQ confirms the process: "Just provide us your backer list and information... our fulfillment center will then ship them off accordingly." No API mentioned. ([MPC Kickstarter FAQ](https://www.makeplayingcards.com/faq-kickstarter.aspx))
- The only "automation" that exists is [mpc-autofill](https://github.com/chilli-axe/mpc-autofill), a Selenium browser automation tool for uploading card images --- not for placing or managing orders. This is a fragile screen-scraper for the card design step, not a fulfillment API.
- MPC has no documented developer portal, no REST API, no webhook system, no OAuth, no CSV upload endpoint. The "API" does not exist.

**Conditions:** This breaks the moment you try to build any of it. You cannot automate a manual email-and-spreadsheet process without building brittle screen-scraping infrastructure that MPC can break at any time by changing their website.

**Mitigation:** Accept that MPC fulfillment has exactly two manual touchpoints that cannot be automated: (1) submitting the fulfillment spreadsheet, and (2) receiving the shipping quote and approving it. Design the system around these constraints rather than pretending they don't exist.

---

### RISK 2: Scope Creep Will Consume the Pre-Launch Roadmap

**Severity: CRITICAL**

**What breaks:** The existing 6-sprint roadmap (March through August 2026) is already ambitious for a solo creator. Adding "fulfillment automation" means building:
- An order management system (backer data ingestion, reward tier mapping, order status tracking)
- A customer database with PII (names, addresses, emails --- beyond what Loops.so stores)
- A customer support system (wrong address handling, damage claims, refund processing, international customs issues)
- Integration with Kickstarter's backer survey/export system
- Integration with a pledge manager (BackerKit/PledgeBox/Kickstarter native)
- Shipping notification and tracking integration
- A dashboard for the operator to manage all of this

This is not a feature. This is a separate product.

**Evidence from the current roadmap:**
- Sprint 1 (March): Foundation & Quick Wins --- 3 parallel tracks
- Sprint 2 (March-April): Growth Features --- 3 large tracks
- Sprint 3 (April-May): Operational Visibility --- 4 tracks
- Sprint 4 (May): Code Quality --- 2 tracks
- Sprint 5 (May-July): Externally-Blocked Features --- 3 large tracks (including Supabase waitlist, which isn't even provisioned yet)
- Sprint 6 (June-July): Platform Expansion --- 2 large tracks

There is no Sprint 7. There is no slack in this schedule. Supabase itself is Sprint 5, months away. Fulfillment automation would need Supabase as a prerequisite (for the order/backer database), plus its own multi-sprint implementation cycle.

**Conditions:** This breaks the moment development time is allocated to it. Every hour spent on fulfillment automation is an hour not spent on the Kickstarter countdown page, the card gallery, the referral waitlist, or the archetype journey pages --- all of which directly drive campaign success. Fulfillment is a post-campaign problem being solved pre-campaign.

**Mitigation:** Defer all fulfillment work until after the Kickstarter campaign closes (late August / September 2026). Use an established pledge manager (see Risk 6) for the manual parts. Fulfillment does not need to exist on launch day.

---

### RISK 3: PII Storage Creates Legal and Security Liability

**Severity: HIGH**

**What breaks:** Storing backer PII (full names, mailing addresses, emails, reward tier selections) in a self-managed Supabase instance creates legal obligations under GDPR (EU backers), CCPA/CPRA (California backers), and Kickstarter's own Terms of Use.

**Specific obligations:**
- **GDPR Article 15-17:** Right to access, rectify, and delete personal data on request. You must build tooling to respond to these requests within 30 days. ([Kickstarter GDPR guidance](https://help.kickstarter.com/hc/en-us/articles/360012254254-As-a-Kickstarter-creator-how-can-I-comply-with-data-privacy-rules))
- **Data minimization:** You must collect only what's necessary and retain it only as long as needed. Storing addresses indefinitely in Supabase violates this principle.
- **Breach notification:** GDPR requires notification within 72 hours of a data breach. A solo creator with a Supabase free-tier instance has no security monitoring, no incident response plan, and no cyber liability insurance.
- **Kickstarter ToS:** Backer information must be kept "confidential, except as strictly necessary to communicate with backers directly and fulfill rewards." Storing it in a custom system expands the attack surface beyond what Kickstarter intended.

**What goes wrong at 3 AM:**
- Supabase service_role key leaks (it's already planned for `.env` per the referral waitlist plan). A single key compromise exposes every backer's home address.
- The referral waitlist plan already uses `service_role` key with no RLS policies ("all access is via service_role key"). This is defense-in-depth, but the `service_role` key bypasses all RLS. One leaked key = full database access.
- No encryption at rest for address fields. Supabase free tier uses shared infrastructure.

**Conditions:** This becomes a liability the moment you store the first backer's mailing address. The risk compounds with international backers (GDPR) and scales linearly with backer count.

**Mitigation:** Do not store backer PII in your own database. Let BackerKit or Kickstarter's native pledge manager handle address collection and storage. They have dedicated security teams, compliance programs, and insurance. You have a `.env` file on a laptop. The risk asymmetry is overwhelming.

---

### RISK 4: MPC Production and Shipping Failures Have No Programmatic Fallback

**Severity: HIGH**

**What breaks:** When fulfillment goes wrong --- and at 500-2000 backers, it will --- there is no automated recovery path.

**Documented MPC failure modes (from [Trustpilot reviews](https://www.trustpilot.com/review/makeplayingcards.com)):**
- Orders stuck in "pending payment" status despite payment being made
- Orders marked "Delivered" but never received
- Cards printed wrong (wrong images, wrong order)
- Booklets arriving with marks/damage
- Paid for express shipping, received slower than standard
- Customer service becomes unresponsive mid-resolution

**International shipping complications ([MPC Shipping FAQ](https://www.makeplayingcards.com/shipping.aspx)):**
- MPC ships from Hong Kong. Customs clearance is the recipient's responsibility.
- "Undeliverable orders due to failed customs payment cannot be replaced or refunded" --- the creator eats the cost.
- Tracking numbers only provided for US/Canada. Other countries get "recorded delivery" with limited tracking.
- Delivery dates are "for reference only and are not guaranteed."

**What goes wrong at 3 AM:**
- 50 international backers report non-delivery. You have no tracking numbers. MPC says "delivered." Backers say "not received." You have no way to verify either claim.
- MPC misprints 200 decks. You've already shipped the fulfillment spreadsheet. Reprinting takes 2-4 weeks. Backers are angry. You have no inventory buffer.
- A backer moves between survey and shipment. Their address in your system is wrong. MPC already shipped to the old address. The package is undeliverable. MPC charges you again for re-shipment.

**Conditions:** These are not edge cases. At 1000+ backers with international shipping, expect 5-10% to encounter issues (50-100 support tickets). A solo creator handling 50-100 support tickets while also running a business is a recipe for burnout.

**Mitigation:** Budget for a 10% fulfillment issue rate. Build a simple support tracking spreadsheet (not an automated system). Consider using MPC's fulfillment service but with a US-based intermediary for international orders. Most importantly: do not automate customer support. A form email with a tracking link and a human doing triage is more effective than any system you could build.

---

### RISK 5: The "Automate Customer Support" Dimension is a Tarpit

**Severity: HIGH**

**What breaks:** The proposal includes "handling customer support." Automating customer support for physical product fulfillment is one of the hardest problems in software. The failure modes are:

1. **Address correction requests** --- backers move, make typos, or provide incomplete addresses. Each requires manual verification and potentially a new MPC shipment.
2. **Damage claims** --- require photos, MPC liaison, and re-shipment decisions. No automation possible.
3. **Customs/duties disputes** --- backers expect you to cover import duties. This is a policy decision, not a code problem.
4. **Missing package investigations** --- require coordination between MPC, the carrier, and the backer. Multi-party communication cannot be automated.
5. **Reward tier disputes** --- "I pledged for the deluxe edition but received standard." Requires checking Kickstarter records against MPC fulfillment records. Manual reconciliation.

**Conditions:** This becomes a problem immediately upon first shipment. The support volume for a 1000-backer campaign typically peaks at 2-4 weeks post-shipment and can last months for international orders.

**Mitigation:** Do not attempt to automate customer support. Use a simple shared inbox (Gmail label, or a free Freshdesk/Zendesk tier) with templated responses. The volume (50-100 tickets) does not justify building a system. BackerKit includes backer support tooling if you use their platform.

---

### RISK 6: Build vs. Buy --- Established Platforms Solve This Already

**Severity: HIGH**

**What breaks:** The proposal reinvents what BackerKit, PledgeBox, and Kickstarter's native pledge manager already do, but worse, because a custom solution will lack:

- Address validation (USPS/international format verification)
- Shipping rate calculation across carriers
- Backer survey management
- Late-pledge and add-on sales
- Tax calculation and remittance
- GDPR-compliant data handling with dedicated security teams
- Backer-facing self-service portal (update address, check status)

**Cost comparison:**

| Approach | Estimated Cost (1000 backers, ~$45 average pledge) |
|----------|---------------------------------------------------|
| **BackerKit Pledge Manager** | ~2% campaign fee ($900) + 3.5% transaction fee on post-campaign ($varies) + $0 activation. Includes surveys, address management, backer support, GDPR compliance. ([BackerKit Pricing](https://www.backerkit.com/pricing)) |
| **Kickstarter Native Pledge Manager** | Free (included with Kickstarter). Basic but adequate for single-product campaigns. |
| **Custom Build** | 100-200+ dev hours of a solo creator's time (opportunity cost: $5,000-$15,000+ at any reasonable rate), plus ongoing maintenance, plus security liability, plus no address validation, plus no backer self-service, plus GDPR compliance burden on the creator personally. |

**The math:** BackerKit costs ~$900 for a $45,000 campaign. Building a custom system costs months of dev time that should be spent on the campaign itself. The custom system will be worse in every dimension except "I built it myself."

**Conditions:** This cost disparity exists regardless of backer count. At 500 backers it's even more stark (BackerKit: ~$450; custom build: same 100-200 hours).

**Mitigation:** Use BackerKit or Kickstarter's native pledge manager. Multiple tarot deck Kickstarters have successfully used BackerKit: [iN2IT Tarot](https://in2itarot.backerkit.com/), [The Gentle Tarot](https://gentle-tarot.backerkit.com/), [Conjunction Tarot](https://conjunction-tarot.backerkit.com/). This is a solved problem for this exact product category.

---

### RISK 7: Supabase Dependency Cascading

**Severity: MEDIUM**

**What breaks:** The proposal assumes Supabase as the database for order/backer management. Supabase is not yet provisioned (planned for Sprint 5, May-July). Adding fulfillment data to the same Supabase instance that handles the referral waitlist creates:

1. **Schema coupling** --- waitlist tables and fulfillment tables in the same database. Migration complexity grows non-linearly.
2. **Free tier limits** --- Supabase free tier: 500 MB database, 50K monthly active users, 2 GB bandwidth. A fulfillment database with 1000+ backer records, addresses, order history, support tickets, and audit logs will consume significant space, especially with GDPR audit trail requirements.
3. **Single point of failure** --- if Supabase has an outage during fulfillment, both the referral waitlist and the order management system go down.
4. **Vendor lock-in** --- the referral waitlist plan already uses Supabase-specific features (RPC functions, service_role key bypass). Adding fulfillment deepens the lock-in before the platform has been validated in production.

**Conditions:** This becomes a problem when Supabase is provisioned and fulfillment tables are added alongside waitlist tables. The free tier bandwidth limit is the most likely constraint to hit during fulfillment (lots of address lookups and updates).

**Mitigation:** If Supabase is used, keep fulfillment in a separate Supabase project (still free tier). But more importantly, see Risk 6 --- let BackerKit handle this data entirely.

---

### RISK 8: Reward Tiers Are Not Yet Defined

**Severity: MEDIUM**

**What breaks:** The operator has not finalized reward tiers. Building any fulfillment automation requires knowing exactly what is being fulfilled. Different reward tiers mean:
- Different items per shipment (deck only, deck + guidebook, deck + art prints, etc.)
- Different weights and shipping costs
- Different packaging requirements
- Different MPC product configurations

You cannot build an order management system without a fixed data model. The data model depends on reward tiers. Reward tiers are undefined.

**Conditions:** This blocks design of the fulfillment data model, which blocks implementation, which blocks everything.

**Mitigation:** Define reward tiers before any fulfillment planning. This is a business decision, not a technical one. See the Kickstarter countdown page plan (`docs/plans/2026-03-09-kickstarter-countdown.md`), which also notes it's "blocked on: pledge tier content from operator."

---

### RISK 9: Integration Surface Area Explosion

**Severity: MEDIUM**

**What breaks:** The current architecture has exactly two external service integrations: Loops.so (email) and GA4 (analytics). The quiz-submit API route is 405 lines of carefully hardened code with rate limiting, validation, timeout handling, and error recovery --- and it talks to exactly one external service.

Adding fulfillment automation would require integrating with:
1. Kickstarter's backer export (CSV/API)
2. A pledge manager (BackerKit API or Kickstarter Pledge Manager)
3. MPC (manual, but needs data formatting)
4. Shipping carrier tracking APIs (USPS, UPS, DHL, Royal Mail, etc.)
5. Supabase (order database)
6. Loops.so (shipping notification emails)
7. Potentially Stripe (for post-campaign charges, add-ons, replacement shipping fees)

Each integration is another 200-400 lines of hardened code with its own failure modes, rate limits, authentication, and timeout handling. The existing quiz-submit route took 341 tests and a 4-evaluator convergence analysis to harden. Multiply that by 5-7 new integrations.

**Conditions:** This complexity surfaces during implementation and becomes a maintenance burden indefinitely. Every vendor API change requires updates. Every vendor outage requires error handling.

**Mitigation:** Minimize the integration surface. Use a pledge manager that handles most of these integrations natively. The only custom integration that might make sense is Loops.so shipping notifications --- and even that could be done manually for 1000 backers.

---

### RISK 10: Post-Campaign Timing Creates False Urgency

**Severity: LOW**

**What breaks:** Nothing --- yet. But there's a cognitive trap in the question itself. Fulfillment doesn't need to be automated before Kickstarter launch (8/8/26). It doesn't even need to be designed before launch. Most Kickstarter campaigns ship 3-9 months after the campaign ends. That puts fulfillment in November 2026 through May 2027.

Building fulfillment automation now (March 2026) for a need that arises in November 2026 is premature optimization. The landscape of tools, MPC's capabilities, and even the operator's circumstances may change significantly in 8 months.

**Conditions:** This becomes a waste if any of the following change: MPC adds an API, the operator decides to use a different printer, BackerKit adds MPC integration, or the Kickstarter campaign doesn't reach its funding goal.

**Mitigation:** Plan fulfillment during the campaign (August-September 2026), build it after the campaign closes, ship it before physical fulfillment begins (November-December 2026). The current roadmap has zero slack for this work before launch.

---

## Summary Table

| # | Risk | Severity | Verdict |
|---|------|----------|---------|
| 1 | MPC has no API --- automation premise is invalid | CRITICAL | BLOCK |
| 2 | Scope creep will consume pre-launch roadmap | CRITICAL | BLOCK |
| 3 | PII storage creates legal/security liability | HIGH | Mitigate: use BackerKit |
| 4 | MPC production/shipping failures have no programmatic fallback | HIGH | Accept: budget for 10% issue rate |
| 5 | Customer support automation is a tarpit | HIGH | Mitigate: don't automate, use templates |
| 6 | Build vs. buy --- established platforms solve this | HIGH | Mitigate: use BackerKit |
| 7 | Supabase dependency cascading | MEDIUM | Mitigate: separate projects |
| 8 | Reward tiers undefined | MEDIUM | Block: define tiers first |
| 9 | Integration surface area explosion | MEDIUM | Mitigate: minimize integrations |
| 10 | Premature optimization | LOW | Defer to post-campaign |

---

## Recommended Alternative

Instead of "automate the entire fulfillment process," the realistic approach for a solo creator at this scale (500-2000 backers, single product with tier variants) is:

1. **Use BackerKit Pledge Manager** (~$450-900 for the campaign). Handles: backer surveys, address collection/validation, late pledges, add-ons, GDPR compliance, backer self-service portal.
2. **Use MPC's fulfillment service** ($1/parcel + shipping). Process: export addresses from BackerKit, format into MPC's fulfillment spreadsheet, submit manually. This is a 2-hour task, not a 200-hour automation project.
3. **Use a shared inbox** (Gmail label or free Freshdesk tier) for the 50-100 support tickets that will arise.
4. **Use Loops.so** for batch shipping notifications (compose in Loops dashboard, trigger manually when MPC confirms shipment).
5. **Build nothing.** The entire fulfillment "pipeline" is: BackerKit survey -> Excel export -> MPC spreadsheet -> manual submit -> wait -> Loops.so email. Total custom code: zero lines.

The 200+ hours saved should be spent on the features that determine whether the Kickstarter succeeds in the first place: the countdown page, the card gallery, the referral waitlist, and the archetype journey pages.

---

## Sources

- [MPC Order Fulfillment Services](https://www.makeplayingcards.com/mpc-fulfillment-services.aspx)
- [MPC Kickstarter FAQ](https://www.makeplayingcards.com/faq-kickstarter.aspx)
- [MPC Worldwide Shipping Costs](https://www.makeplayingcards.com/shipping.aspx)
- [MPC Trustpilot Reviews](https://www.trustpilot.com/review/makeplayingcards.com)
- [MPC Autofill (GitHub)](https://github.com/chilli-axe/mpc-autofill)
- [BGG: Has anyone used MPC fulfillment service?](https://boardgamegeek.com/thread/3163515/has-anyone-used-make-playing-cards-mpc-fulfillment)
- [BackerKit Pricing](https://www.backerkit.com/pricing)
- [Kickstarter GDPR Compliance](https://help.kickstarter.com/hc/en-us/articles/360012254254-As-a-Kickstarter-creator-how-can-I-comply-with-data-privacy-rules)
- [Kickstarter vs BackerKit vs Gamefound (2026)](https://www.launchboom.com/crowdfunding-guides/kickstarter-vs-gamefound-vs-backerkit/)
- [Top 15 Kickstarter Fulfillment Services (2026)](https://www.efulfillmentservice.com/2025/12/the-top-15-kickstarter-crowdfunding-fulfillment-services-in-2026/)
- [PledgeBox: Creator's Guide to Kickstarter Tarot Decks](https://pledgebox.com/post/kickstarter-tarot-decks)
- [iN2IT Tarot (BackerKit)](https://in2itarot.backerkit.com/)
- [The Gentle Tarot (BackerKit)](https://gentle-tarot.backerkit.com/)
- [Conjunction Tarot (BackerKit)](https://conjunction-tarot.backerkit.com/)
