# Kickstarter Fulfillment Tools & Backer Management — Reference

> Last updated: 2026-03-09 (Round 2 fact-check update)
> Sources: Kickstarter official docs, BackerKit, PledgeBox, Gamefound, various guides

---

## 1. Kickstarter Native Tools

### Backer Report (CSV Export)
After successful funding, creators can download a CSV backer report containing:
- Profile name, backer number, email address
- Pledge details, shipping country
- Shipping address (if collected via backer survey)
- Reward item preferences
- SKU data

**Export formats available:**
- SKU per Column
- SKU per Line Item (recommended for fulfillment companies)
- SKU and Quantity List (Alphabetical Order)

**Pre-formatted exports for:** Ship Naked, Floship, Easyship, Amazon, GameQuest

Source: https://help.kickstarter.com/hc/en-us/articles/115005135894

### Backer Survey (Upgraded 2024)
- Collect shipping addresses (editable until creator locks them)
- Structured data collection with SKU management
- Auto-generated SKUs based on item variants
- Questions displayed based on each backer's specific pledge
- Add-on support
- Customizable filters, segment creation
- Export compatible with common fulfillment partners

Source: https://updates.kickstarter.com/backer-survey-2024/

### Kickstarter Pledge Manager (Native) — DETAILED (Updated Round 2)

**Availability:** Made available to ALL creators on May 8, 2025.
Previously beta-only. Fully integrated into the creator dashboard.

**Cost:**
- $0 upfront for the tool itself
- 5% platform fee on all funds collected through PM (same as campaign fee)
- Payment processing: Stripe ~3-5% on all transactions
- 5% applies to add-on sales, upgrades, shipping charges
- Taxes excluded from the 5% fee

**Features (confirmed with dates from release notes):**
- Backer surveys — dynamic, per-pledge questions (May 2025)
- Automated SKU management (May 2025)
- Address collection — editable until creator locks (May 2025)
- Phone number required for shipping addresses (July 8, 2025)
- Post-campaign add-ons and upgrades (May 2025)
- Shipping configuration — weight-based or flat-rate (May 2025)
- US sales tax collection and remittance (May 2025)
- EU/UK VAT collection (May 2025)
- Canada tax collection — GST/HST/PST/QST (June 18, 2025)
- Tariff manager for international charges (2025)
- Multiple VAT IDs support (July 2, 2025)
- Backer report with customizable filters and segments (June 23, 2025)
- Exports compatible with common fulfillment partners (June 23, 2025)
- Preview tool — see backer experience before launch (Aug 25, 2025)
- View settings after PM launch (Jan 12, 2026)
- Creator tax reporting (Feb 3, 2026)
- Launch before Pledge Over Time payments complete (June 16, 2025)

**Limitations (per PledgeBox comparison):**
- Basic inventory/SKU management (not full variant pricing)
- Limited shipping models (weight/per-item only)
- CSV-based tracking only (no multi-vendor integration)
- Code/URL-only digital rewards
- No dropped order recovery
- 5% fee on add-ons is higher than PledgeBox (3%) or BackerKit (3.5%)

**Creator testimonial:** "After 4 campaigns using 3rd party Pledge Managers,
I can't think of a single reason to not use the in-house Kickstarter PM
going forward."

Source: https://start.kickstarter.com/pledge-manager
Source: https://start.kickstarter.com/pledge-manager-release-notes
Source: https://updates.kickstarter.com/bringing-the-kickstarter-pledge-manager-to-all-creators/
Source: https://updates.kickstarter.com/kickstarter-pledge-manager-updates-july-2025/
Source: https://www.pledgebox.com/compare

### Kickstarter Backer Report — CSV Column Names (Verified)

Confirmed column headers from actual Kickstarter CSV exports:
- `Shipping Name`
- `Shipping Address 1`
- `Shipping Address 2`
- `Shipping City`
- `Shipping State`
- `Shipping Postal Code`
- `Shipping Country Code`
- `Email`
- Plus: Backer Number, Pledge Amount, Reward Title, SKU data

Source: https://github.com/mrooney/kickstarter-lob (parses real KS exports)

---

## 2. Third-Party Pledge Managers — Comparison

### BackerKit
**Best for:** Larger campaigns with complex reward structures
**Pricing:**
- Campaign Fee: 2% (sliding scale — drops to 1.10% at $2.5M+)
- Transaction Fee: 3.5% on add-on sales, preorders, post-campaign funding
- If campaign launches ON BackerKit: Campaign Fee waived
- Per-backer cap: $5/backer for campaigns with avg pledge >$250

**For Hermetic Flight (~$15K-$50K raise estimate):**
- Campaign Fee: 2.00% = $300-$1,000
- Transaction Fee: 3.5% on any add-on revenue only

**Key features:**
- Backer surveys with pre-filled data
- Post-campaign add-on store
- Fulfillment logistics integrations
- Export formats for major fulfillment houses
- Key/code distribution for digital rewards
- Dedicated support team

**Consideration:** Historically had a high setup fee (barrier for small creators),
but switched to percentage-based model making it more accessible.

Source: https://www.backerkit.com/pricing/pledge_manager
Source: https://help.backerkit.com/article/288-288

### PledgeBox
**Best for:** Small-to-medium creators, budget-conscious projects
**Pricing:**
- **Free** for surveys without payment collection
- 3% on add-on sales collected through surveys
- 5% on pre-order store sales
- No upfront fees, no per-backer fees, no campaign fees

**For Hermetic Flight:** Potentially $0 if no add-ons collected through PledgeBox

**Key features:**
- Pre-launch landing pages (drag & drop editor)
- Campaign analytics (rank tracking, traffic sources, pledge velocity)
- Backer surveys
- Add-on upselling
- CSV/Excel export for any shipping service
- Stripe and PayPal integration
- Built-in email marketing (InBox)
- Meta + Google Ads tracking integration
- Mailchimp integration
- Custom domain branding

**Used by:** 8,000+ creators, $50M+ campaigns managed

Source: https://www.pledgebox.com/pricing
Source: https://www.pledgebox.com/

### Gamefound
**Best for:** Board game / tabletop game creators
**Pricing:**
- 5% platform fee on add-ons
- $0.20 per-transaction fee
- Separate crowdfunding platform (can also run campaign on Gamefound)

**Key features:**
- Purpose-built for tabletop/board game community
- "Stretch Pay" — backer installment payments
- Engaged tabletop audience
- Pledge management

**Consideration:** More oriented toward board game campaigns. Tarot deck is
adjacent but not core audience. Growing rapidly ($84.5M raised in 2024).

Source: https://www.launchboom.com/crowdfunding-guides/kickstarter-vs-gamefound-vs-backerkit/

---

## 3. Recommendation for Hermetic Flight (Updated Round 2)

**Primary: Kickstarter Native PM** (free, sufficient for single-product campaign)
**Alternative: PledgeBox** (free tier + built-in email marketing if needed)
**Avoid: BackerKit** ($900+ minimum — overkill for this campaign)
**Avoid: Gamefound** (audience mismatch — tabletop games, not tarot)

### Cost Comparison ($45K campaign, 1,000 backers)

| Scenario | KS Native PM | PledgeBox | BackerKit |
|----------|-------------|-----------|-----------|
| No add-ons | **$0** | **$0** | **$900** |
| $5K add-on revenue | **$250** | **$150** | **$1,075** |

### Feature Comparison for Hermetic Flight's Needs

| Need | KS Native PM | PledgeBox | BackerKit |
|------|-------------|-----------|-----------|
| Address collection | Yes | Yes | Yes |
| SKU management | Basic (sufficient) | Full | Full |
| CSV/Excel export | Yes (5 formats) | Yes | Yes (10+ templates) |
| Tax collection | US+EU+UK+Canada | Yes | Yes |
| Post-campaign add-ons | Yes | Yes | Yes |
| Free for surveys-only | Yes | Yes | No ($900) |
| Learning curve | Lowest | Low | Moderate |
| Late backer import | Unknown | Yes | Yes |
| Built-in email marketing | No | Yes (InBox) | No |

### Decision Tree
1. **If no add-ons planned:** Use Kickstarter Native PM. Cost: $0.
2. **If add-ons + email marketing desired:** Use PledgeBox. Cost: 3% of add-ons.
3. **If complex multi-product fulfillment:** Use BackerKit. Cost: $900+. Overkill here.

---

## 4. Fulfillment Timeline (Post-Campaign)

Based on Kickstarter's official guidance and creator experience:

| Phase | Duration | Activities |
|-------|----------|------------|
| Funds clearing | 2-4 weeks | Credit card processing, failed payment recovery |
| Survey/addresses | 2-4 weeks | Send backer survey, collect addresses (~85% respond in 1 week) |
| Manufacturing | 2-12 weeks | For cards via MPC: ~2-3 weeks production |
| Freight (if applicable) | N/A | MPC ships direct — no separate freight phase |
| Fulfillment/shipping | 2-6 weeks | MPC packs + ships to individual backers |
| Stragglers | 2-4 weeks | Late address submissions, replacements, failed deliveries |

**Total estimated for Hermetic Flight (MPC direct fulfillment): 2-4 months**
This is significantly faster than the 12-15 month average because MPC handles
manufacturing AND fulfillment, eliminating the separate freight/warehouse phases.

Source: https://updates.kickstarter.com/post-campaign-fulfillment-timeline-what-creators-need-to-know/

---

## 5. Backer Communication Best Practices

- Update backers every 2-3 weeks minimum during fulfillment
- Be honest about delays — backers prefer transparency over optimism
- Send survey within 1-2 weeks of campaign end
- Lock addresses ~1 week before submitting to MPC
- ~85% of backers respond to surveys within first week
- Provide tracking numbers as soon as available
- Have a clear returns/replacement policy (recommend "smile policy" for low-cost items)

Source: https://redstagfulfillment.com/how-to-fulfill-a-kickstarter-campaign/
Source: https://updates.kickstarter.com/post-campaign-fulfillment-timeline-what-creators-need-to-know/
