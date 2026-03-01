# Email Provider Comparison — Resend vs Alternatives

> Research date: 2026-02-28
> Sources: resend.com/pricing, aws.amazon.com/ses/pricing, postmarkapp.com/pricing, loops.so/pricing, various comparison articles cited below

---

## Comparison Matrix

| Feature | Resend | Amazon SES | Postmark | Loops.so |
|---------|--------|-----------|----------|----------|
| **Free tier** | 3,000/mo (100/day) | 3,000/mo (12-mo trial)* | 100/mo (forever) | 4,000/mo to 1,000 contacts |
| **First paid tier** | $20/mo (50K emails) | $0.10/1,000 emails | $15/mo (10K emails) | $49/mo (unlimited sends) |
| **Cost for 3,000 emails/mo** | $0 | ~$0 (free tier) | $15/mo | $0 (if <1K contacts) |
| **Cost for 10,000 emails/mo** | $20/mo | $1.00/mo | $15/mo | $49/mo |
| **Transactional email** | Yes | Yes | Yes (primary focus) | Yes |
| **Marketing/drip email** | Yes (marketing feature) | Manual (no built-in drip) | No automation | Yes (built-in loops) |
| **React Email support** | Native (same team) | No | No | No |
| **Astro SDK** | Official guide | AWS SDK (generic) | HTTP API | HTTP API |
| **Unsubscribe management** | Manual (you build it) | Manual (you build it) | Manual (you build it) | Built-in |
| **Bounce handling** | Webhooks | SNS notifications | Webhooks | Built-in |
| **SPF/DKIM setup** | Automatic on domain verify | Manual (complex) | Automatic | Automatic |
| **DMARC guidance** | Docs provided | Generic AWS docs | Docs provided | Docs provided |
| **Dedicated IP** | $30/mo (Scale plan) | $24.95/mo | Requires 300K/mo volume | Not available |
| **API rate limit** | 2 req/sec (batch: 100/req) | 1 req/sec (sandbox), 14/sec (prod) | Not published | Not published |
| **Developer experience** | Excellent (modern API, TS SDK) | Poor (complex AWS setup) | Good (clean API) | Good (clean UI) |
| **Setup complexity** | Low | High | Low | Lowest |
| **Deliverability reputation** | Good (newer, building) | Varies (shared IPs) | Excellent (strict policies) | Good |

*Amazon SES free tier changed for new accounts after July 2025 — now $200 AWS credits instead of SES-specific allocation.

---

## Detailed Analysis Per Provider

### Resend — Recommended for This Use Case

**Strengths:**
- Best developer experience in the category (modern TypeScript SDK, React Email integration)
- Official Astro integration guide with code examples
- Free tier covers initial scale (3,000 emails/mo)
- Both transactional and marketing email in one platform
- Simple domain verification with automatic SPF/DKIM
- Batch API (100 emails per request) for efficient drip sends
- API-first design aligns with serverless architecture

**Weaknesses:**
- Free tier daily limit (100 emails/day) is restrictive for drip sends to 100+ subscribers
- 1-day data retention on free tier (can't review sent emails after 24 hours)
- Single webhook endpoint on free tier
- Newer company — less proven track record than SES or Postmark
- Unsubscribe management is entirely manual

**Verdict for this project:** Best fit. The DX advantage is significant — React Email templates as code, TypeScript SDK, Astro-native patterns. The daily limit is the main constraint.

Source: https://resend.com/pricing

### Amazon SES — Cheapest at Scale, Worst DX

**Strengths:**
- Lowest cost at volume ($0.10/1,000 emails)
- Massive infrastructure, proven deliverability at scale
- Full AWS ecosystem integration

**Weaknesses:**
- Complex setup (IAM roles, SES sandbox, production access request, SNS for bounces)
- No built-in email analytics, bounce management, or delivery logs
- No React Email integration
- Requires AWS account management (billing alerts, IAM security)
- Production access requires a manual approval process with justification
- Free tier is changing for new accounts (now generic $200 AWS credits)

**Verdict for this project:** Overkill complexity for hundreds of subscribers. The cost savings are negligible ($0 vs $0 on free tiers). The setup burden is disproportionate.

Source: https://aws.amazon.com/ses/pricing/, https://costgoat.com/pricing/amazon-ses

### Postmark — Best Deliverability, No Drip Automation

**Strengths:**
- Industry-leading deliverability (strict sender policies protect shared IP reputation)
- Clean API, good documentation
- Phone support on all plans (even the cheapest)
- Separate message streams for transactional vs. broadcast (protects deliverability)

**Weaknesses:**
- Free tier is only 100 emails/month (development/testing only)
- No drip campaign automation (broadcast only, no sequences)
- First paid tier ($15/mo for 10K emails) is slightly more expensive than Resend
- Would still need to build all drip logic externally
- No React Email integration

**Verdict for this project:** Good deliverability but the 100/mo free tier is unusable in production, and the lack of drip automation means the same build effort as Resend with worse DX. If deliverability becomes a problem with Resend, Postmark is the fallback.

Source: https://postmarkapp.com/pricing

### Loops.so — Most Turnkey, Highest Cost

**Strengths:**
- Built-in drip sequences ("loops") — no cron job or scheduler needed
- Built-in unsubscribe management
- Built-in subscriber management
- 21 pre-built automation templates
- Clean, modern UI
- Free tier: 1,000 contacts, 4,000 sends/month, unlimited automations

**Weaknesses:**
- First paid tier is $49/month (2.5x Resend Pro)
- SaaS-focused design (onboarding flows, product emails) — not ideal for creative/content businesses
- Less developer control (you use their platform, not your own code)
- "Powered by Loops" footer on free tier
- No React Email (uses their own template builder)
- Vendor lock-in: subscriber data lives in their platform

**Verdict for this project:** Loops.so is the "don't build it" option. The free tier (1,000 contacts, 4,000 sends, full automations) provides more headroom than Mailchimp Free (250 contacts, 500 sends, no automations as of June 2025) and eliminates the CAN-SPAM engineering burden of a fully self-hosted Resend approach. The $49/mo paid tier is steep, but the free tier covers the operator's current scale with significant room to grow. *Updated 2026-02-28 Round 2: corrected from original "limited" assessment.*

Source: https://loops.so/pricing

---

## Recommendation Matrix

| Priority | Best Choice | Why |
|----------|------------|-----|
| Lowest cost (free tier) | **Resend** | 3,000 emails/mo free, paired with self-built drip logic |
| Best developer experience | **Resend** | React Email, TypeScript SDK, Astro-native |
| Least build effort | **Loops.so** | Built-in drip sequences, but $49/mo paid tier |
| Best deliverability | **Postmark** | Strictest sender policies, but 100/mo free tier |
| Cheapest at high volume | **Amazon SES** | $0.10/1K emails, but worst DX |
| Best for this specific project | **Resend** | Balances DX, cost, and control |

---

## Cost Comparison: Current vs. Proposed (Updated Round 2)

| Component | Current Stack | Option A: Self-Hosted | Option B: Hybrid (Mailchimp) | Option C: Loops.so |
|-----------|--------------|----------------------|-----------------------------|--------------------|
| Quiz forms | Tally.so ($0-29/mo) | Astro native ($0) | Astro native ($0) | Astro native ($0) |
| Automation | Zapier ($20-49/mo) | Vercel Cron ($0) | Mailchimp ($0-20/mo) | Loops.so ($0) |
| Email sending | Mailchimp ($13-20/mo) | Resend ($0-20/mo) | Mailchimp (included above) | Loops.so (included) |
| Subscriber storage | Mailchimp (included) | Supabase ($0) | Mailchimp (included) | Loops.so (included) |
| CAN-SPAM handling | Mailchimp (included) | Self-built | Mailchimp (included) | Loops.so (included) |
| **Total (free tier)** | **$33-98/mo** | **$0/mo** | **$0/mo (no automation)** | **$0/mo** |
| **Total (with automation)** | **$33-98/mo** | **$0-20/mo** | **$13-20/mo** | **$0/mo (up to 1K contacts)** |
| **Max contacts (free)** | N/A | Unlimited (self-hosted) | 250 | 1,000 |
| **Drip automation (free)** | N/A | Yes (self-built) | **No** | **Yes** |

**Note (updated 2026-02-28):** Mailchimp removed drip automations from the free plan in June 2025. The hybrid approach (Option B) requires Essentials ($13/mo) or Standard ($20/mo) to restore automation. Loops.so (Option C) provides full automation on the free tier up to 1,000 contacts.
