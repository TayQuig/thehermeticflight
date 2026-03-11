# Round 2 — Researcher Fact-Check Report

> Role: Researcher (Evidentiary Foundation)
> Round: 2 — Moderator-directed fact-check
> Date: 2026-03-09

---

## Fact-Check 1: BackerKit Actual Pricing for ~$45K Campaign with 1,000 Backers

**DA Claim:** ~$450-900 for BackerKit.

**Verdict: VERIFIED (upper end)**

### Evidence

BackerKit's pledge manager pricing page confirms a **tiered Campaign Fee** structure:

| Funding Level | Rate |
|---|---|
| Up to $50,000 | 2.00% |
| $50K-$100K | 1.85% |
| $100K-$250K | 1.70% |
| $250K-$500K | 1.55% |
| $500K-$1M | 1.40% |
| $1M-$2.5M | 1.25% |
| $2.5M+ | 1.10% |

**For a $45K campaign:** $45,000 x 2.00% = **$900 Campaign Fee**.

Additionally, a **3.5% Transaction Fee** applies to all post-campaign funds raised through BackerKit (add-on sales, preorders, upgrades, shipping fees, taxes, reinstated pledges).

**Per-backer cap:** $5/backer for campaigns with average pledges >$250. At $45/avg pledge, this cap does NOT apply.

**What's included in the Campaign Fee:**
- Backer surveys with pre-filled data from Kickstarter
- Post-campaign add-on store
- Fulfillment logistics integrations (pre-built export templates for Ship Naked, Floship, Easyship, Amazon, GameQuest, PirateShip, Bridge Distribution, Pick & Pack, Aetherworks, Fulfillment Europe)
- Custom export builder (select specific fields)
- Key/code distribution for digital rewards
- Dedicated support team
- 3 export formats: SKU per Column, SKU per Line, SKU and Quantity List

**What's NOT included (additional cost):**
- 3.5% on any add-on revenue
- Payment processing fees (Stripe: ~3% + $0.20/txn)

**Corrected estimate for Hermetic Flight:**
- Campaign Fee: $900 (on $45K raise)
- Transaction Fee: 3.5% on add-on revenue only (if $5K add-ons = $175)
- Total: **$900-$1,075** depending on add-on revenue

Sources:
- https://www.backerkit.com/pricing/pledge_manager
- https://help.backerkit.com/article/288-288
- https://help.backerkit.com/article/583-overview-of-exports
- https://help.backerkit.com/article/871-custom-export-feature

---

## Fact-Check 2: PledgeBox Free Tier

**Researcher Claim (Round 1):** PledgeBox is free for surveys without payment collection.

**Verdict: VERIFIED — with important nuances**

### Evidence

PledgeBox pricing page confirms:
- **$0 campaign fee** on original Kickstarter/Indiegogo funds
- **$0 setup fees**
- **$0 monthly fees**
- **$0 minimum commitments**
- **$0 per-backer fees**
- **3% fee ONLY on add-on/upsell revenue** collected during survey
- **5% fee on pre-order store revenue** (separate storefront feature)

**What's included for free (no add-on sales = $0 total):**
- Shipping address collection and verification
- Product variants and bundles
- Marketing questions
- Gift products
- Digital download delivery
- File uploads from backers
- Survey reports and record locking
- Multiple survey sends
- Shipping notifications
- Shopify integration
- Backer coupons
- Tax/VAT collection
- Invoice generation
- CSV/Excel export for any shipping service
- Built-in email marketing (InBox)

**Limitations of free tier:**
- No limitations found for survey-only usage. The "free" tier IS the full product when you don't collect payments.
- Stripe/PayPal processing fees are billed separately by those providers (not PledgeBox) — standard ~2.9% + $0.30/txn

**Hidden costs:** None found. PledgeBox explicitly states "no setup fees, monthly fees, or minimum commitments." The only monetization is the percentage on add-on/upsell revenue.

**Promotional pricing noted:** PledgeBox offers a 1.5% rate (vs standard 3%) for creators who add a PledgeBox pre-launch link to their campaign page. This is a promotional discount, not a hidden cost.

**Comparison to BackerKit:**
- PledgeBox: $0 campaign fee + 3% on add-ons = dramatically cheaper
- BackerKit: 2% campaign fee ($900 on $45K) + 3.5% on add-ons

Sources:
- https://www.pledgebox.com/pricing
- https://www.pledgebox.com/compare
- https://www.pledgebox.com/faq

---

## Fact-Check 3: PledgeBox/BackerKit CSV Export Compatibility with MPC

**Question:** Can PledgeBox or BackerKit export backer data in a format compatible with MPC's fulfillment spreadsheet?

**Verdict: PARTIALLY VERIFIED — high compatibility likely, but exact MPC format is proprietary**

### Evidence

**Kickstarter Native Backer Report CSV columns** (confirmed from source code parsing a real export):
- `Shipping Name`
- `Shipping Address 1`
- `Shipping Address 2`
- `Shipping City`
- `Shipping State`
- `Shipping Postal Code`
- `Shipping Country Code`
- `Email`
- Plus: Backer Number, Pledge Amount, Reward Title, SKU data

Source: https://github.com/mrooney/kickstarter-lob (parses actual Kickstarter CSV exports)

**BackerKit export capabilities:**
- 3 fulfillment export formats (SKU per Column, SKU per Line, SKU & Quantity List)
- Custom export builder: select specific fields including address, SKU, order info
- Pre-built templates for 10+ fulfillment partners
- Confirmed fields: Backer ID, name, email, state, country, SKU, quantity, shipping info, tracking numbers, order info
- Full address fields available but exact column names not publicly documented

Source: https://help.backerkit.com/article/583-overview-of-exports, https://help.backerkit.com/article/871-custom-export-feature

**PledgeBox export capabilities:**
- Download Center with CSV/Excel export
- Two report formats:
  1. "Report by Products (SKUs) with Product Questions" — SKU, variants, product attributes
  2. "Report by Orders (Backers) with Reward Questions" — reward name, SKU, backer info
- Includes: order status, survey status, address, reward, email
- Filterable by source, survey status, dispute status
- Segment functionality for saved filter combinations
- Record locking post-download

Source: https://www.pledgebox.com/post/download-center-for-fulfillment-plan-ahead-to-stay-ahead

**MPC fulfillment spreadsheet format:**
- Excel (.xls) template downloaded from MPC's fulfillment services page
- Required data: recipient addresses + items per address
- Exact column names/format: **NOT publicly documented**
- MPC says: "Download our fulfillment sheet and fill in the addresses and the items to be sent to each address"
- Must be sent to MPC for a shipping cost quote
- MPC also supports CSV import via address book upload template

Source: https://www.makeplayingcards.com/mpc-fulfillment-services.aspx

**Analysis:**
The CSV transform step is likely trivial regardless of which tool exports the data. All three tools (Kickstarter native, BackerKit, PledgeBox) export standard address fields (Name, Address 1, Address 2, City, State, Zip, Country). MPC's spreadsheet requires the same basic address data plus item quantities. A simple column rename/reorder script (or even manual copy-paste for 1,000 rows) would bridge any format gap.

**Critical finding:** The operator should download MPC's actual fulfillment spreadsheet template BEFORE choosing a pledge manager. This would confirm exact column requirements and determine whether a transform script is needed at all. MPC's template is freely downloadable from their fulfillment services page.

---

## Fact-Check 4: Kickstarter's Native Pledge Manager

**Question:** What does Kickstarter's upgraded pledge manager do? Can it handle address collection, SKU management, and CSV export? Is it free? Would it suffice for a single-product campaign with 2-3 tiers?

**Verdict: VERIFIED — It is a serious contender, with important caveats**

### Evidence

**Availability:** Made available to ALL creators on **May 8, 2025** (previously beta-only). Fully integrated into the creator dashboard.

Source: https://updates.kickstarter.com/bringing-the-kickstarter-pledge-manager-to-all-creators/

**Cost:**
- **No additional upfront cost** for the pledge manager tool itself
- **5% platform fee** on all funds collected through the pledge manager (same as campaign fee)
- **Payment processing:** Stripe ~3-5% on all transactions
- This 5% applies to add-on sales, upgrades, shipping charges, and all pledge manager transactions
- Taxes are excluded from the 5% fee

Source: https://start.kickstarter.com/pledge-manager, https://www.pledgebox.com/compare

**Features confirmed (with dates from release notes):**

| Feature | Status | Date |
|---|---|---|
| Backer surveys (dynamic, per-pledge) | Available | May 2025 |
| Automated SKU management | Available | May 2025 |
| Address collection (editable until lock) | Available | May 2025 |
| Phone number required for shipping | Available | July 8, 2025 |
| Post-campaign add-ons & upgrades | Available | May 2025 |
| Shipping configuration (weight/flat-rate) | Available | May 2025 |
| US sales tax collection | Available | May 2025 |
| EU/UK VAT collection | Available | May 2025 |
| Canada tax collection (GST/HST/PST/QST) | Available | June 18, 2025 |
| Tariff manager | Available | 2025 |
| Multiple VAT IDs | Available | July 2, 2025 |
| Backer report with filters & segments | Available | June 23, 2025 |
| Exports compatible with fulfillment partners | Available | June 23, 2025 |
| Preview tool (see backer experience) | Available | Aug 25, 2025 |
| View settings after launch | Available | Jan 12, 2026 |
| Creator tax reporting | Available | Feb 3, 2026 |
| Launch before Pledge Over Time completes | Available | June 16, 2025 |

Source: https://start.kickstarter.com/pledge-manager-release-notes

**Backer report export formats confirmed:**
- SKU per Column
- SKU per Line Item
- SKU and Quantity List (Alphabetical Order)
- Pre-formatted exports for: Ship Naked, Floship, Easyship, Amazon, GameQuest

Source: Round 1 research (https://help.kickstarter.com/hc/en-us/articles/115005135894)

**Limitations (from PledgeBox comparison and release notes):**
- Basic inventory/SKU management (not full variant pricing like BackerKit/PledgeBox)
- Limited shipping models (weight/per-item only — no complex zone-based)
- CSV-based tracking only (no multi-vendor integration)
- Code/URL-only digital rewards
- No dropped order recovery
- One survey send (per PledgeBox comparison — may be outdated)
- 5% fee on add-ons is higher than PledgeBox (3%) or BackerKit (3.5%)

**Would it suffice for Hermetic Flight?**
For a single-product campaign (tarot deck) with 2-3 tiers and no complex variants, Kickstarter's native PM appears sufficient. The limitations (basic inventory, limited shipping models) are irrelevant for a simple product line. The key advantages:
- Zero additional tool cost
- No third-party onboarding
- Backer data stays in one place
- Export formats already match common fulfillment partners
- Tax collection handled automatically

The main drawback is the 5% fee on add-on revenue (vs PledgeBox's 3%). For a campaign with minimal add-ons, this difference is negligible.

**Creator testimonial:** "After 4 campaigns using 3rd party Pledge Managers, I can't think of a single reason to not use the in-house Kickstarter PM going forward."

Source: https://updates.kickstarter.com/kickstarter-pledge-manager-updates-july-2025/

---

## Fact-Check 5: MPC Fulfillment Spreadsheet Format

**Question:** What columns does MPC's fulfillment template require? Can you find any creator who has shared the format publicly?

**Verdict: UNVERIFIED — MPC's template is not publicly documented**

### Evidence

**What we know:**
- MPC provides a downloadable Excel (.xls) fulfillment spreadsheet from their fulfillment services page
- The template requires: recipient addresses + items to be sent to each address
- MPC also has a "CSV address book upload" function for bulk address import
- After submission, MPC provides a shipping cost quote
- After fulfillment, MPC returns an Excel sheet with tracking numbers

**What we do NOT know (not publicly documented):**
- Exact column headers in the fulfillment spreadsheet
- Whether address fields are split (Address 1/Address 2/City/State/Zip) or combined
- Whether phone number is required per row
- What item/quantity format is expected
- Whether different products in the same order are separate rows or columns

**Creator experiences (from BoardGameGeek thread):**
The BGG thread "Has anyone used Make Playing Cards (MPC) fulfillment service?" exists but returned a 403 error, so creator-reported details could not be extracted.

**Reasonable inference:**
Given that MPC is a Hong Kong-based fulfillment company serving international Kickstarter creators, their spreadsheet almost certainly uses standard fulfillment fields: Name, Address Line 1, Address Line 2, City, State/Province, Postal Code, Country, Item/Quantity. This is the universal format for international shipping manifests. But this is inference, not verified fact.

**Recommendation:**
The operator should **download MPC's fulfillment template now** (before the campaign launches) from https://www.makeplayingcards.com/mpc-fulfillment-services.aspx to confirm exact requirements. This eliminates the entire "CSV transform" question and takes 5 minutes.

Sources:
- https://www.makeplayingcards.com/mpc-fulfillment-services.aspx
- https://www.makeplayingcards.com/faq-kickstarter.aspx
- https://boardgamegeek.com/thread/3163515/has-anyone-used-make-playing-cards-mpc-fulfillment

---

## New Finding: The Kickstarter Native PM Changes the Calculus

This fact-check revealed something that shifts the build-vs-buy debate significantly. When I did Round 1 research, Kickstarter's native pledge manager was mentioned but not deeply evaluated. The evidence now shows it is a **far more capable tool** than previously understood:

### Cost Comparison (for $45K campaign, 1,000 backers, $5K add-on revenue)

| Tool | Campaign Fee | Add-on Fee | Total Cost |
|---|---|---|---|
| **Kickstarter Native PM** | $0 | 5% = $250 | **$250** |
| **PledgeBox** | $0 | 3% = $150 | **$150** |
| **BackerKit** | 2% = $900 | 3.5% = $175 | **$1,075** |

**With NO add-on sales:**

| Tool | Total Cost |
|---|---|
| **Kickstarter Native PM** | **$0** |
| **PledgeBox** | **$0** |
| **BackerKit** | **$900** |

**Key insight:** Kickstarter's native PM is free if you don't sell add-ons through it. For a simple tarot deck campaign with 2-3 tiers and no post-campaign add-on store, Kickstarter's native PM costs nothing. PledgeBox also costs nothing. BackerKit costs $900 minimum.

### Feature Comparison for Hermetic Flight's Needs

| Need | KS Native PM | PledgeBox | BackerKit |
|---|---|---|---|
| Address collection | Yes | Yes | Yes |
| SKU management | Basic (sufficient) | Full | Full |
| CSV/Excel export | Yes (5 formats) | Yes | Yes (10+ partner templates) |
| Tax collection | US + EU + UK + Canada | Yes | Yes |
| Post-campaign add-ons | Yes | Yes | Yes |
| Free for surveys-only | Yes | Yes | No ($900) |
| Learning curve | Lowest (already in KS) | Low | Moderate |
| Late backer import | Unknown | Yes | Yes |
| Custom survey domains | No | Yes | No |
| Built-in email marketing | No | Yes (InBox) | No |

### Recommendation Update

For Hermetic Flight's specific use case (single product, 2-3 tiers, ~1,000 backers, MPC fulfillment), the decision tree is:

1. **If no add-ons planned:** Use Kickstarter's native PM. Cost: $0. It handles everything needed.
2. **If add-ons planned + want email marketing:** Use PledgeBox. Cost: 3% of add-on revenue. Adds InBox email tool.
3. **If complex multi-product fulfillment:** Use BackerKit. Cost: $900+. Overkill for this campaign.

The "build a custom orchestration layer" option from Round 1 is looking increasingly unnecessary for the pledge management + address collection phase. The custom work is only needed for the MPC fulfillment spreadsheet transform and tracking notification pipeline — and even that may be a simple column rename operation.

---

## Sources Index

All claims above are sourced. Key references:

1. BackerKit Pricing: https://www.backerkit.com/pricing/pledge_manager
2. BackerKit Help (fees): https://help.backerkit.com/article/288-288
3. BackerKit Exports Overview: https://help.backerkit.com/article/583-overview-of-exports
4. BackerKit Custom Export: https://help.backerkit.com/article/871-custom-export-feature
5. BackerKit Fulfillment Exports: https://help.backerkit.com/article/694-exports-fulfillment-exports
6. PledgeBox Pricing: https://www.pledgebox.com/pricing
7. PledgeBox Comparison: https://www.pledgebox.com/compare
8. PledgeBox FAQ: https://www.pledgebox.com/faq
9. PledgeBox Download Center: https://www.pledgebox.com/post/download-center-for-fulfillment-plan-ahead-to-stay-ahead
10. PledgeBox vs KS PM: https://www.pledgebox.com/post/pledgebox-vs-kickstarter-pledge-manager-whats-the-difference
11. Kickstarter PM Landing: https://start.kickstarter.com/pledge-manager
12. Kickstarter PM Release Notes: https://start.kickstarter.com/pledge-manager-release-notes
13. Kickstarter PM July 2025 Updates: https://updates.kickstarter.com/kickstarter-pledge-manager-updates-july-2025/
14. Kickstarter PM Available to All: https://updates.kickstarter.com/bringing-the-kickstarter-pledge-manager-to-all-creators/
15. Kickstarter 2025 Roadmap: https://updates.kickstarter.com/kickstarters-2025-product-roadmap/
16. Kickstarter Backer Report: https://help.kickstarter.com/hc/en-us/articles/115005135894
17. Kickstarter Fees Guide: https://updates.kickstarter.com/kickstarter-fees-a-comprehensive-guide-for-creators/
18. Kickstarter CSV Column Names (verified): https://github.com/mrooney/kickstarter-lob
19. MPC Fulfillment Services: https://www.makeplayingcards.com/mpc-fulfillment-services.aspx
20. MPC Kickstarter FAQ: https://www.makeplayingcards.com/faq-kickstarter.aspx
