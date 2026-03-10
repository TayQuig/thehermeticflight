# Round 2 -- Researcher Fact-Check Report

## Role: Researcher
## Date: 2026-02-28

---

## Fact-Check Summary Table

| # | Claim | Agent | Verdict | Evidence |
|---|-------|-------|---------|----------|
| 1 | Mailchimp free tier is viable for the hybrid approach | Devil's Advocate | **PARTIALLY FALSE** | Free plan is now 250 contacts / 500 sends/month. Automations (including welcome sequences) are **disabled** on free tier as of June 2025. The hybrid approach does NOT get free drip automation from Mailchimp. |
| 2 | Resend retains email event data for only 1 day on the free tier | Devil's Advocate | **CONFIRMED** | Resend pricing page lists retention as: Free = 1 day, Pro = 3 days, Scale = 7 days, Enterprise = flexible. |
| 3 | Supabase projects auto-pause even with active API calls | Devil's Advocate | **PARTIALLY TRUE** | "Activity" is narrowly defined as database-hitting requests. Storage-only access, static page loads, and non-DB API calls do NOT reset the inactivity timer. A daily cron that queries the database DOES prevent pause. No documented cases of pause despite genuine DB queries. |
| 4 | Mailchimp API works from Vercel serverless functions for adding subscribers with tags | Researcher (R1) | **CONFIRMED** | The Mailchimp Marketing API v3 supports subscriber creation with tags via a standard PUT/POST request. No SDK dependency required -- a fetch call from a Vercel serverless function works identically to the existing Flask implementation. |
| 5 | Loops.so is a viable middle-ground between Mailchimp and Resend | Researcher (R1) | **STRONGER THAN STATED** | Free tier: 1,000 contacts, 4,000 sends/month, ALL features including automations/drip sequences. This is 4x the contacts and 8x the sends of Mailchimp Free, with automations that Mailchimp Free no longer offers. |

---

## Detailed Findings

### 1. Mailchimp Free Tier in 2026: Gutted

**Source:** [Mailchimp Pricing](https://mailchimp.com/pricing/marketing/), [Mailchimp Help: About Pricing Plans](https://mailchimp.com/help/about-mailchimp-pricing-plans/), [GroupMail: Mailchimp Free Plan Changes 2026](https://blog.groupmail.io/mailchimp-free-plan-changes-2026/)

The Mailchimp free plan has been systematically reduced since the Intuit acquisition:

- **Contacts:** 250 max (down from 2,000 in prior years; includes unsubscribed/unconfirmed in the count)
- **Sends:** 500/month, 250/day max
- **Audiences:** 1
- **Seats:** 1 (Owner only)
- **Automations:** Effectively **none**. The Classic Automation Builder was retired in June 2025. The replacement (Customer Journey Builder) requires a paid plan (Essentials at $13/mo minimum). The free plan includes only a single auto-welcome email and abandoned cart email -- no multi-step drip sequences, no journey flows.
- **Branding:** Mandatory Mailchimp footer on all emails

**Impact on the hybrid approach:** The Devil's Advocate proposed keeping Mailchimp for email delivery to avoid CAN-SPAM engineering. This still works for *sending* -- the Mailchimp API can add subscribers and send campaigns from a serverless function. But the operator would lose all automation at the free tier. To get drip sequences back, the Essentials plan starts at $13/month (500 contacts, 5,000 sends). The Standard plan is $20/month (500 contacts, 6,000 sends, full automation). This significantly narrows the cost savings of the hybrid approach.

**Bottom line:** Mailchimp Free is now a contact-collection and manual-blast tool. It is no longer a free automation platform.

---

### 2. Resend Free Tier Data Retention: 1 Day Confirmed

**Source:** [Resend Pricing](https://resend.com/pricing)

The Devil's Advocate's claim is accurate. Resend's data retention by tier:

| Tier | Retention | Price |
|------|-----------|-------|
| Free | 1 day | $0 |
| Pro | 3 days | $20/mo |
| Scale | 7 days | $90/mo |
| Enterprise | Custom | Custom |

**What this means practically:** On the free tier, delivery status, bounce notifications, open tracking, and click tracking data are available for only 24 hours. After that, the data is gone. If the system needs to check whether a specific email was delivered (e.g., for drip sequence progression logic), it must capture webhook events in real-time and store them in Supabase. The Builder cannot rely on polling Resend's API for historical delivery data.

**Mitigation is straightforward:** Resend supports webhooks for delivery/bounce/open/click events. The system should write these events to a Supabase table as they arrive. This is already implied in the Round 1 architecture -- the DA's concern is valid but solvable within the existing design.

---

### 3. Supabase Auto-Pause: Nuanced, But Manageable

**Source:** [supabase-pause-prevention GitHub](https://github.com/travisvn/supabase-pause-prevention), [Supabase Billing Docs](https://supabase.com/docs/guides/platform/billing-on-supabase), community reports on [AnswerOverflow](https://www.answeroverflow.com/m/1469240005099786290)

The DA raised a real concern, but the nuance matters:

- **Pause trigger:** Free-tier projects pause after 7 days of inactivity.
- **What counts as "activity":** Only requests that hit the Postgres database count. This means REST API calls that query tables, RPC calls, and direct database connections. Storage-only access, static asset downloads, and authentication-only calls reportedly do NOT reset the timer.
- **What does NOT count:** Visiting the Supabase dashboard, accessing public storage buckets, or hitting endpoints that don't touch the database.
- **Community reports:** There are Discord threads from users reporting paused projects despite believing they had activity. In every documented case, the "activity" turned out to be non-DB requests (storage access, auth-only calls). No confirmed reports exist of projects pausing despite genuine, regular database queries.

**For this architecture:** The daily cron job queries the subscriber table to determine who gets drip emails today. This is a genuine database query and will definitively reset the inactivity timer. The DA's concern is valid in the abstract but is a non-issue for this specific design, which inherently queries the database daily.

**One caveat:** If the cron job fails silently for 7+ consecutive days (e.g., Vercel deployment issue, function timeout), the project could pause. A GitHub Actions keepalive as a backup (as noted in Round 1) is cheap insurance.

---

### 4. Mailchimp API: Confirmed Compatible with Vercel Serverless

**Source:** [Mailchimp API: Add/Remove Member Tags](https://mailchimp.com/developer/marketing/api/list-member-tags/add-or-remove-member-tags/), [Mailchimp Subscriber API Tutorial](https://rudrastyh.com/mailchimp-api/subscription.html), [Mailchimp Tags Guide](https://mailchimp.com/developer/marketing/guides/organize-contacts-with-tags/)

The Mailchimp Marketing API v3 for adding subscribers with tags:

- **Endpoint:** `PUT https://{dc}.api.mailchimp.com/3.0/lists/{list_id}/members/{subscriber_hash}`
- **Authentication:** Basic Auth with API key (no OAuth required for server-to-server)
- **Subscriber hash:** MD5 of the lowercase email address
- **Request body (JSON):**
  ```json
  {
    "email_address": "user@example.com",
    "status": "subscribed",
    "merge_fields": { "FNAME": "Name" },
    "tags": ["quiz-result-tower", "drip-sequence-1"]
  }
  ```
- **Tags behavior:** Passing a tag name that doesn't exist auto-creates it

This is a single HTTP request with Basic Auth -- trivially implementable in a Vercel serverless function using `fetch()`. No SDK needed. The operator's existing Flask app already does this same call, so the migration is a direct port.

**If the hybrid approach is chosen:** The Vercel serverless function replaces both Tally webhooks and Zapier by: (1) receiving the form submission, (2) calling the Mailchimp API to add the subscriber with quiz-result tags. This eliminates Zapier ($33-49/mo) while keeping Mailchimp for delivery and compliance. Total cost: Mailchimp Essentials $13/mo (for automation) or Free $0 (manual blasts only).

---

### 5. Loops.so: The Strongest Middle-Ground Option

**Source:** [Loops.so Pricing](https://loops.so/pricing), [Loops.so Free Plan Docs](https://loops.so/docs/account/free-plan), [Loops.so Transactional Email Update](https://loops.so/updates/transactional-email-is-now-free)

Loops.so's free tier is significantly more generous than both Mailchimp Free and Resend Free for this use case:

| Feature | Mailchimp Free | Resend Free | Loops.so Free |
|---------|---------------|-------------|---------------|
| Contacts | 250 | N/A (transactional) | 1,000 |
| Monthly sends | 500 | 3,000 | 4,000 |
| Daily cap | 250 | 100 | Not specified |
| Automations/Drips | **No** (removed June 2025) | **No** (API only) | **Yes** (full access) |
| Transactional email | No | Yes | Yes |
| Built-in compliance | Yes | Partial | Yes |
| Branding footer | Yes | No | Yes ("Powered by Loops") |
| Paid tier starts at | $13/mo (Essentials) | $20/mo (Pro) | $49/mo |

**Key advantages of Loops.so for this project:**

1. **Built-in drip sequences on the free tier.** This is the killer feature. Loops provides automation flows with no feature gating -- the only limits are contact count and send volume. Mailchimp removed this from their free plan entirely.

2. **1,000 contacts vs. 250.** Four times the headroom before a paid upgrade is needed.

3. **Both marketing and transactional emails.** Can handle the drip campaign AND confirmation emails from a single platform.

4. **Compliance built in.** Unsubscribe handling, CAN-SPAM headers, and bounce management are handled by the platform -- eliminating the largest engineering risk from the fully self-hosted approach.

**The trade-off:** The paid tier jump is steep ($49/mo vs. Mailchimp's $13/mo Essentials). If the list grows past 1,000 contacts, Loops becomes more expensive than Mailchimp. However, at 1,000 contacts on Mailchimp, you'd be on Standard ($20/mo) anyway, and Loops' $49/mo includes unlimited sends while Mailchimp's Standard caps at 6,000 sends for 500 contacts.

**API integration:** Loops has a straightforward REST API for adding contacts with properties and triggering events. A Vercel serverless function can add a subscriber to Loops with a single `fetch()` call, similar to Mailchimp.

---

## Revised Option Matrix

Based on these findings, the three approaches now look like this:

### Option A: Fully Self-Hosted (Resend + Supabase + Vercel)
- **Cost:** $0/mo (free tiers)
- **Engineering:** High (CAN-SPAM compliance, drip scheduler, webhook handlers, bounce management)
- **Risk:** Medium (1-day data retention, 100/day send cap)
- **Scale ceiling:** ~100 active drip subscribers before Resend Pro ($20/mo) needed

### Option B: Hybrid with Mailchimp
- **Cost:** $0/mo (free, no automations) or $13-20/mo (Essentials/Standard for drip)
- **Engineering:** Low (just the form handler serverless function)
- **Risk:** Low (Mailchimp handles compliance)
- **Scale ceiling:** 250 contacts free, then $13/mo; automation requires paid plan
- **Savings vs. current:** Eliminates Zapier ($33-49/mo), keeps Mailchimp cost same or lower

### Option C: Loops.so + Vercel (NEW RECOMMENDATION)
- **Cost:** $0/mo up to 1,000 contacts
- **Engineering:** Low-Medium (form handler + Loops API integration; compliance is handled)
- **Risk:** Low (platform handles deliverability, compliance, drip sequences)
- **Scale ceiling:** 1,000 contacts free, then $49/mo
- **Savings vs. current:** Eliminates Zapier AND Mailchimp entirely; $0/mo until 1,000 contacts

---

## Correction to Round 1 Position

My Round 1 analysis understated Loops.so by noting its "$49/month paid tier defeats the cost-reduction goal." This was inaccurate framing -- the FREE tier at 1,000 contacts with full automation is the relevant comparison point, not the paid tier. At the operator's current scale (small list, early growth), Loops.so Free provides more headroom than either Mailchimp Free or Resend Free while eliminating the CAN-SPAM engineering burden that I flagged as the highest-risk item.

---

## Recommendation to the Table

The fact-checks meaningfully shift the picture. Mailchimp Free is no longer the compliance safety net the DA assumed -- it's been gutted of automations. Loops.so emerges as the strongest middle-ground: it provides the drip automation that Resend lacks, the compliance handling that self-hosted requires engineering for, and 4x the contact headroom of Mailchimp Free.

I recommend the table seriously evaluate **Option C (Loops.so + Vercel serverless)** as the primary approach. It captures the cost savings (eliminates both Zapier and Mailchimp), provides a clear migration path, and defers the hardest engineering work (CAN-SPAM compliance) to a platform that handles it natively.
