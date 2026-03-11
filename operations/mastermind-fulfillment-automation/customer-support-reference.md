# Customer Support Tools for Solo Creators — Reference

> Last updated: 2026-03-09
> Sources: Help Scout, Freshdesk, FreeScout official sites

---

## Scale Context

Hermetic Flight: ~500-2000 backers, solo creator (Taylor Quigley).
Support volume estimate: 5-15% of backers contact support = 25-300 tickets
over the fulfillment period (2-4 months).

Peak periods:
- Post-survey (address issues)
- Post-shipment (tracking questions, delivery issues)
- 2-4 weeks after delivery (damage claims, missing orders)

---

## Recommended Options (Ranked)

### 1. Help Scout — FREE Plan (Recommended)
**Why:** Purpose-built for small teams, no time limit on free plan, AI tools included.

**Free plan includes:**
- Up to 5 users (1 is sufficient for solo creator)
- 1 shared inbox
- 1 Docs site (knowledge base / FAQ)
- AI tools: AI Answers, AI Drafts, AI Assist, AI Summarize
- Contact-based billing (not per-seat) on paid plans
- "Fair Billing Policy" — averages contacts over 3 months

**Pricing model (if upgrade needed):**
Contact-based pricing (charged by # of contacts helped/month).
Unlimited users on all plans — cost scales with support volume, not team size.

**Fit for Hermetic Flight:** Excellent. Free plan handles the expected volume.
AI tools help a solo creator respond faster. Knowledge base reduces repeat questions.

Source: https://www.helpscout.com/pricing/
Source: https://docs.helpscout.com/article/1597-free-plan

### 2. Freshdesk — Free Plan (Alternative)
**Why:** Full-featured, specifically designed for small businesses and startups.

**Free plan includes:**
- Up to 2 agents
- Integrated ticketing (email + social)
- Ticket dispatch (auto-assignment)
- Knowledge base
- Ticket trend reports
- Basic analytics and reporting
- Team collaboration (private notes, shared ownership)

**Limitation:** Free plan is available for **6 months only**, then requires paid plan.
Paid starts at ~$15/agent/month.

**Fit for Hermetic Flight:** Good for short-term fulfillment period. The 6-month
limit may actually align well with the fulfillment window (Oct 2026 - Feb 2027).

Source: https://support.freshdesk.com/support/solutions/articles/50000010099
Source: https://www.freshworks.com/freshdesk/pricing/

### 3. FreeScout — Self-Hosted (Budget Option)
**Why:** Completely free, unlimited agents/tickets/mailboxes. Open source.

**Features:**
- Self-hosted (requires PHP/Laravel server)
- Clone of Help Scout
- Unlimited everything
- Community plugins

**Limitation:** Requires hosting and maintenance. Solo creator may not want
the DevOps overhead.

**Fit for Hermetic Flight:** Only if Taylor already has server infrastructure.
Otherwise, Help Scout free plan is simpler.

Source: https://freescout.net/
Source: https://github.com/freescout-help-desk/freescout

---

## What NOT to Use

### Zendesk
- Expensive, complex, designed for enterprise
- Overkill for 500-2000 backers
- Setup requires technical support

### Intercom
- Expensive ($39+/seat/month)
- Designed for SaaS, not physical product fulfillment

### Dedicated email (Gmail/Outlook)
- No ticket tracking, no knowledge base, no analytics
- Emails get lost, no collaboration features
- Acceptable only if <50 total support requests expected

---

## Recommended Approach for Hermetic Flight

### Pre-Launch (Now - Aug 2026)
- No helpdesk needed. Use personal email for pre-launch inquiries.

### Campaign Period (Aug - Sep 2026)
- Kickstarter messaging handles most backer communication.
- Set up Help Scout free plan toward end of campaign.

### Fulfillment Period (Sep 2026 - Feb 2027)
- Help Scout free plan as primary support channel
- Create FAQ/knowledge base covering:
  - "Where is my order?" (tracking lookup)
  - "How do I update my address?"
  - "My deck arrived damaged"
  - "I haven't received my survey"
  - "International customs/duties"
- Use AI Drafts to speed up responses
- Provide support email in all Loops.so transactional emails

### Post-Fulfillment (Mar 2027+)
- Evaluate whether to keep Help Scout or downgrade to email
- Support volume should drop to near-zero

---

## Integration with Current Stack

Help Scout integrates via:
- **Email forwarding** — point support@hermeticflight.com to Help Scout inbox
- **API** — Help Scout has a REST API for programmatic ticket creation
- **Zapier/Make** — webhook integrations if needed

**With Loops.so:** Include Help Scout support email in all transactional email
templates. No direct integration needed — email-based routing is sufficient.

**With Supabase:** Could log support tickets or link backer records, but likely
overkill for this scale. Manual lookup is fine for 500-2000 backers.
