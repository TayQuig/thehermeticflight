# Round 1 — Researcher Analysis

## Role: Researcher
## Date: 2026-02-28

---

## Executive Summary

The proposed self-hosted marketing pipeline (Astro native form -> Vercel serverless -> Supabase -> Resend -> Vercel Cron) is **technically viable** at the target scale of hundreds of subscribers. Every component's free tier provides sufficient headroom. However, three constraints require explicit design decisions, and one compliance area requires non-trivial engineering work.

---

## Key Findings

### 1. Resend Is the Right Choice, But the Free Tier Has a Binding Daily Limit

**Finding:** Resend's free tier provides 3,000 emails/month but caps at **100 emails per day**. For a drip campaign serving 100+ subscribers on the same daily cadence, this daily cap becomes the binding constraint before the monthly cap is reached.

**Evidence:** Resend pricing page (https://resend.com/pricing) — "Free: 100 emails/day, 3,000 emails/month." API rate limit is 2 requests/second with batch API supporting 100 emails per request (https://resend.com/docs/knowledge-base/account-quotas-and-limits).

**Implication:** With 100 subscribers, a single daily drip send is fine. At 150+ subscribers needing the same drip email on the same day, the daily cap is exceeded. Mitigation options: (a) stagger drip sends across multiple days using subscriber cohorts, (b) upgrade to Resend Pro ($20/mo) when subscriber count exceeds ~100 active drip recipients.

**Artifact:** `/operations/mastermind-marketing-pipeline-replacement/resend-reference.md`

### 2. Vercel Hobby Cron Jobs Run Once Per Day Only

**Finding:** Vercel's Hobby (free) plan restricts cron jobs to **once-daily execution** with **hourly precision** (a job scheduled for 9:00 AM may execute between 9:00 AM and 9:59 AM). Expressions that would run more frequently fail during deployment.

**Evidence:** Vercel cron documentation (https://vercel.com/docs/cron-jobs/usage-and-pricing) — "Hobby accounts are limited to daily cron jobs." and "Hobby: Once per day, Hourly (+/- 59 min)."

**Implication:** A once-daily drip scheduler is the standard pattern for email drip campaigns, so this constraint is acceptable for the initial use case. The timing imprecision means subscribers receive emails within a ~60-minute window rather than at an exact time. For a small creative business, this is a non-issue. If sub-daily scheduling is needed later (e.g., time-sensitive triggered emails), the Pro plan ($20/mo) enables per-minute precision.

**Artifact:** `/operations/mastermind-marketing-pipeline-replacement/vercel-reference.md`

### 3. CAN-SPAM Compliance Requires Meaningful Engineering Work

**Finding:** Mailchimp automatically handles 8+ compliance features that a self-managed system must implement manually: unsubscribe link generation, unsubscribe processing, one-click unsubscribe headers (RFC 8058), physical address insertion, bounce handling, spam complaint handling, suppression list management, and double opt-in flows.

**Evidence:** FTC CAN-SPAM guide (via https://termly.io/resources/articles/can-spam-act/), Resend unsubscribe docs (https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails), Mailchimp compliance docs (https://mailchimp.com/help/anti-spam-requirements-for-email/).

**Implication:** This is not a "nice to have" — CAN-SPAM violations carry fines up to $51,744 per email. The Builder must implement: (a) unsubscribe endpoint accepting GET and POST, (b) `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every email, (c) visible unsubscribe link in email body, (d) physical address in email footer, (e) bounce/complaint webhook handlers, (f) subscriber status checks before every send. This is the largest engineering surface area in the project.

**Artifact:** `/operations/mastermind-marketing-pipeline-replacement/canspam-compliance-reference.md`

### 4. Supabase Free Tier Is More Than Sufficient

**Finding:** Supabase's free tier provides 500 MB database, 5 GB egress, 50,000 auth MAUs, and 500,000 edge function invocations. A subscriber table with 1,000 rows uses approximately 0.8 MB. The daily drip scheduler query generates negligible egress.

**Evidence:** Supabase billing docs (https://supabase.com/docs/guides/platform/billing-on-supabase) — "500 MB per project" database, "5 GB" egress. Row-level storage calculation: ~800 bytes per subscriber record.

**Auto-pause note:** Free projects pause after 7 days of inactivity. However, the daily cron job hitting the Supabase API prevents this automatically. This is a non-issue for this architecture.

**Implication:** No capacity concerns at all. The free tier could handle hundreds of thousands of subscribers (the 500 MB limit accommodates ~625,000 rows at 800 bytes each). Row Level Security is available and should be enabled from day one to protect subscriber data.

**Artifact:** `/operations/mastermind-marketing-pipeline-replacement/supabase-reference.md`

### 5. Resend Outperforms Alternatives for This Specific Use Case

**Finding:** After comparing Resend, Amazon SES, Postmark, and Loops.so: Resend offers the best combination of developer experience, free tier capacity, and Astro integration for a self-hosted drip pipeline at small scale.

- **Amazon SES:** Cheapest at volume but terrible DX, complex AWS setup, no built-in analytics. Overkill for hundreds of subscribers.
- **Postmark:** Best deliverability but only 100 emails/month free tier (development-only), no drip automation, more expensive than Resend.
- **Loops.so:** Most turnkey (built-in drip sequences) but $49/month paid tier, which defeats the cost-reduction goal. Free tier viable at <1,000 contacts but includes branding footer.

**Evidence:** See comparison matrix in artifact.

**Artifact:** `/operations/mastermind-marketing-pipeline-replacement/email-provider-comparison.md`

---

## Viability Assessment

### Can this stack handle the workload at small scale?

**Yes.** At hundreds of subscribers with daily drip emails:

| Component | Required Capacity | Free Tier Provides | Headroom |
|-----------|------------------|--------------------| ---------|
| Resend emails | ~100-300/day | 100/day, 3,000/mo | **Tight at 100+ subscribers** |
| Supabase storage | <1 MB | 500 MB | 500x+ |
| Supabase egress | <100 MB/mo | 5 GB/mo | 50x+ |
| Vercel invocations | <1,000/mo | 1,000,000/mo | 1,000x+ |
| Vercel cron | 1 daily job | 100 daily jobs | 100x |

The only tight constraint is Resend's 100/day free tier limit.

### Cost comparison: Current vs. Proposed

| | Current | Proposed (Free) | Proposed (Upgraded) |
|---|---------|----------------|---------------------|
| Monthly cost | $33-98 | $0 | $20 (Resend Pro only) |
| Annual cost | $396-1,176 | $0 | $240 |

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Resend daily cap exceeded | Medium | Stagger drip cohorts; upgrade to Pro at ~100 active drip subscribers |
| CAN-SPAM non-compliance | High (legal) | Implement full compliance checklist before first production send |
| Supabase auto-pause | Low | Daily cron prevents this; GitHub Actions keepalive as backup |
| Resend deliverability issues | Low | SPF/DKIM automatic; implement DMARC; monitor via Postmaster Tools |
| Vercel cron timing imprecision | Low | Acceptable for daily drips; upgrade to Pro if precision needed |
| Bounce/complaint rate spikes | Low | Implement webhook handlers; clean list proactively |
| Vendor dependency (Resend is newer company) | Low | API is simple; migration to Postmark/SES would be straightforward |

---

## Research Artifacts Produced

1. **`resend-reference.md`** — Complete Resend API reference: free tier limits, rate limits, authentication setup, unsubscribe handling, Astro integration code examples
2. **`supabase-reference.md`** — Supabase free tier analysis, RLS configuration, schema design, API access patterns
3. **`vercel-reference.md`** — Vercel Hobby plan limits, cron job constraints, serverless function limits, Astro SSR configuration, authentication patterns
4. **`canspam-compliance-reference.md`** — Full CAN-SPAM requirements, Mailchimp-to-self-hosted feature gap analysis, implementation checklist
5. **`email-provider-comparison.md`** — Resend vs SES vs Postmark vs Loops.so comparison matrix with cost projections

---

## Open Questions for the Table

1. **Physical address for CAN-SPAM:** Does the operator have a PO Box or virtual mailbox service, or does one need to be set up? This is a legal requirement before the first email can be sent.

2. **Subscriber volume timeline:** How quickly does the operator expect to grow past 100 active drip subscribers? This determines whether to start on Resend Free or go directly to Pro ($20/mo).

3. **Double opt-in:** Should the system implement double opt-in (confirmation email before adding to drip sequence)? Not legally required by CAN-SPAM, but recommended for list quality and required by some jurisdictions (GDPR for EU subscribers).

4. **Drip sequence complexity:** How many distinct drip sequences are planned? A single linear sequence (everyone gets the same emails) is simpler than segmented sequences based on quiz results. The architecture handles both, but the Builder needs to know the scope.

5. **Email template ownership:** Will templates be built as React Email components (version-controlled, developer-managed) or does the operator need a visual editor? React Email is code-only — there's no drag-and-drop editor in the self-hosted stack.
