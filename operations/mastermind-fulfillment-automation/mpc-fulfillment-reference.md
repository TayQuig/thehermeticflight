# MakePlayingCards.com — Fulfillment Reference

> Last updated: 2026-03-09
> Sources: MPC official site, BoardGameGeek forums, GitHub (MPC Autofill)

## Overview

MakePlayingCards.com (MPC) is a Hong Kong-based print-on-demand card manufacturer
that handles production AND direct-to-backer fulfillment for Kickstarter campaigns.
They are a one-stop service: print + pack + ship to individual addresses worldwide.

**Key fact: MPC has NO public API.** All ordering is done through their web GUI
(drag-and-drop card upload interface). The only workaround is community-built
browser automation (MPC Autofill — see below).

Source: https://www.makeplayingcards.com/mpc-fulfillment-services.aspx

---

## Fulfillment Service Details

### Pricing
- **$1.00 surcharge per parcel** on top of standard shipping charges
- Covers: address labeling, all packaging materials, and labor
- No setup fees, minimum orders, or contracts required
- Example: 100 parcels to US @ standard shipping ($10.99) + surcharge = $11.99/ea = $1,199 total

Source: https://www.makeplayingcards.com/mpc-fulfillment-services.aspx

### Process (Manual — No API)
1. Place your order on MPC website (upload card images via drag-and-drop GUI)
2. Download their **fulfillment spreadsheet** (Excel template)
3. Fill in: recipient addresses + items per address
4. Send spreadsheet back to MPC
5. MPC provides a **shipping cost quote**
6. Approve and pay
7. MPC manufactures, packs, labels, and ships individual parcels
8. MPC provides **Excel sheet with all tracking numbers**

Alternative: Use the "split shipment" function at checkout to ship to multiple addresses.

### Tracking
- US/Canada: individual tracking number per parcel
- International: recorded delivery records
- All tracking data delivered in an Excel spreadsheet

### Packaging
- Robust, insulated packaging designed to "withstand normal bumps during transit"
- Custom packaging options available

### Customs/Taxes
- MPC is **NOT liable** for sales taxes, import duty, VAT, or other taxes
- International backers are responsible for their own customs fees
- Creator should communicate this clearly to backers

Source: https://www.makeplayingcards.com/mpc-fulfillment-services.aspx

---

## Bulk Pricing (Tarot-Relevant)

MPC offers 14 quantity tiers: 1+, 6+, 30+, 50+, 100+, 250+, 500+, 1,000+, 2,500+,
5,000+, 7,500+, 10,000+, 12,500+, 15,000+

### Tarot Deck Specifics
- Card size: 2.75" x 4.75" (standard tarot)
- Standard deck: 78 cards
- Base price (1 deck): ~$26.10
- Bulk discount curves are significant (example: bridge-size promotional stock
  drops from $13.50/deck at 1+ to $0.89/deck at 15,000+)

### Box Options for Tarot
| Box Type | Starting Price |
|----------|---------------|
| Custom tuck box | $14.20/deck |
| Plain rigid box | varies |
| Custom rigid box | varies |
| Tin box | varies |
| Magnetic book box | $26.85/box |
| Wooden box (UV print) | $26.10/box |

**To get exact pricing for 500-2000 tarot decks with custom box:**
Contact MPC directly for a custom quote. The website says:
"if you need help... please contact us."

Source: https://www.makeplayingcards.com/low-price-for-bulk.aspx
Source: https://www.makeplayingcards.com/promotional/personalized-tarot-cards.html

---

## Production Times

- Standard production: **2-3 working days** (quantity-dependent)
- MPC claims "probably the fastest in the industry for whatever quantity"
- Shipping options: Standard, Express, Bulk-Economy (UPS or sea freight), Priority Express
- Sea freight available for sufficiently large orders (cost-efficient for bulk)
- Remote areas: add 3-5 days on top of normal transit time

**WARNING:** Annual factory holidays (Chinese New Year, typically Jan/Feb) cause
extended production times. Plan around this.

Source: https://www.makeplayingcards.com/delivery.aspx
Source: https://www.makeplayingcards.com/shipping.aspx

---

## MPC Autofill (Community Automation Tool)

Since MPC has no API, the community built **MPC Autofill** — an open-source browser
automation tool that uses Selenium to control the MPC website.

### Repository
https://github.com/chilli-axe/mpc-autofill

### What It Does
- Automates the drag-and-drop card upload process on MPC's website
- Downloads card images from Google Drive repositories
- Controls browser via Selenium to fill in the MPC order form
- Can combine multiple projects into fewer orders (optimization)
- Supports double-faced cards

### Three Components
1. **Web Backend** — indexes images from connected Google Drives
2. **Web Frontend** — project editor for selecting card art
3. **Desktop Tool** — browser automation for order placement

### Relevance to Hermetic Flight
MPC Autofill is designed for the Magic: The Gathering proxy community and is
**not directly useful for Kickstarter fulfillment**. It automates card image
upload but does NOT automate:
- Fulfillment spreadsheet generation
- Address management
- Bulk order placement with multiple shipping addresses
- Payment processing

**Bottom line:** For Hermetic Flight fulfillment, the manual spreadsheet process
is the correct workflow. MPC Autofill solves a different problem (uploading
card images, not fulfillment logistics).

Source: https://github.com/chilli-axe/mpc-autofill/wiki/Overview

---

## Practical Workflow for Hermetic Flight (500-2000 decks)

### Pre-Campaign
1. Upload final card artwork to MPC (one time, manual, via their GUI)
2. Order proof/sample deck for approval
3. Get bulk quote from MPC for target quantity range (500/1000/1500/2000)
4. Factor in: deck cost + box cost + $1/parcel fulfillment + shipping per region

### Post-Campaign Fulfillment
1. Export backer addresses from Kickstarter/pledge manager (CSV)
2. Transform CSV into MPC's fulfillment spreadsheet format
3. Submit spreadsheet to MPC
4. Receive shipping quote, approve/pay
5. MPC prints, packs, ships to individual backers
6. Receive tracking Excel from MPC
7. Import tracking numbers into your system, send shipping notifications to backers

### What Can Be Automated (in our stack)
- CSV transformation (Kickstarter format -> MPC spreadsheet format): **Vercel serverless function or local script**
- Tracking number import + shipping notification emails: **Supabase + Loops.so transactional email**
- Backer status tracking: **Supabase database**

### What Cannot Be Automated
- Placing the order on MPC (manual web GUI)
- Approving the shipping quote (manual)
- Uploading card artwork (manual, one-time)
