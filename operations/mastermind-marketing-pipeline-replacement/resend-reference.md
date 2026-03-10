# Resend Reference — Email Delivery Service

> Research date: 2026-02-28
> Sources: resend.com/pricing, resend.com/docs/knowledge-base/account-quotas-and-limits, resend.com/docs/dashboard/domains/dmarc, resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails, resend.com/astro

---

## Free Tier Limits

| Metric | Free Tier | Pro ($20/mo) | Scale ($90/mo) |
|--------|-----------|-------------|----------------|
| Emails/month (transactional) | 3,000 | 50,000 | 100,000 |
| Daily sending limit | **100/day** | No limit | No limit |
| Custom domains | 1 | 10 | 1,000 |
| Data retention | 1 day | 3 days | 7 days |
| Webhook endpoints | 1 | 10 | 10 |
| Team members | 1 | 5 | 100 |
| Marketing contacts | 1,000 | Varies | Varies |
| Marketing sends | Unlimited to contacts | Unlimited | Unlimited |
| Overage rate | N/A (hard cap) | $0.90/1,000 | $0.90/1,000 |
| Overage hard cap | N/A | 5x monthly quota | 5x monthly quota |

Source: https://resend.com/pricing

### Critical Free Tier Constraint: 100 Emails/Day

The daily limit of 100 emails is the binding constraint for this use case. For a drip campaign sending to hundreds of subscribers, a single drip send to 150 subscribers would exceed the daily cap. This means:

- With 100 subscribers: a single daily drip send is fine.
- With 200+ subscribers: daily sends would need to be staggered across multiple days, or the Pro tier ($20/mo) is required.

## API Rate Limits

| Metric | Limit |
|--------|-------|
| API requests per second | 2 per team (shared across all API keys) |
| Burst handling | No burst; 3rd request in same second gets HTTP 429 |
| Batch API | Up to 100 emails per single API call |
| Bounce rate threshold | Must stay under 4% |
| Spam complaint rate threshold | Must stay under 0.08% |

Source: https://resend.com/docs/knowledge-base/account-quotas-and-limits

### Rate Limit Analysis for This Use Case

At 2 requests/second, sending 200 individual emails takes ~100 seconds. Using the batch API (100/request), the same 200 emails take 1 second (2 API calls). The batch API is essential for efficiency.

## Email Authentication (Deliverability)

### What Resend Provides Automatically

When you add and verify a custom domain, Resend automatically handles:
- **SPF record** — authorizes Resend's IPs to send on behalf of your domain
- **DKIM record** — cryptographic signing to verify email integrity

### What You Must Configure Manually

**DMARC record** — you add a TXT record at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:dmarcreports@yourdomain.com;
```

**Recommended deployment sequence:**
1. Start with `p=none` (monitoring only — no email rejection)
2. Monitor DMARC reports using Google Postmaster Tools or similar
3. After confirming all legitimate sources pass, upgrade to `p=quarantine`
4. Eventually move to `p=reject` for full protection

**Key fact:** Messages must pass either SPF or DKIM (not necessarily both) for DMARC compliance.

Source: https://resend.com/docs/dashboard/domains/dmarc

## Unsubscribe Handling

### What Resend Does NOT Do

Resend does NOT automatically add unsubscribe headers or manage opt-out lists for transactional emails. You must implement this yourself.

### What You Must Build

1. **List-Unsubscribe header** — added manually when calling the API:
   ```ts
   headers: {
     'List-Unsubscribe': '<https://yourdomain.com/unsubscribe?token=abc>',
     'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
   }
   ```

2. **Unsubscribe endpoint** — your own serverless function that:
   - Accepts both GET and POST requests
   - Returns HTTP 200/202 for POST (one-click unsubscribe)
   - Displays confirmation page for GET (manual unsubscribe)
   - Marks the subscriber as unsubscribed in your database
   - Stops sending emails within 48 hours

3. **Visible unsubscribe link** in the email body (CAN-SPAM requirement)

4. **Subscriber state management** — your database must track `subscribed` status and the drip scheduler must check it before sending.

Source: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails

### Gmail/Yahoo RFC 8058 Compliance

As of February 2024, bulk senders (5,000+ daily messages to Gmail) must support one-click unsubscribe via `List-Unsubscribe-Post` header. While The Hermetic Flight won't hit 5,000/day, implementing RFC 8058 from the start is best practice and improves deliverability across all providers.

## Astro Integration

Resend provides first-class Astro support via the Node SDK.

### Installation
```bash
npm install resend
```

### API Route Example (Astro SSR)
```typescript
import type { APIRoute } from "astro";
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const { email } = await request.json();
  const { data, error } = await resend.emails.send({
    from: 'The Hermetic Flight <noreply@thehermeticflight.com>',
    to: [email],
    subject: 'Your Quiz Results',
    html: '<strong>Here are your results...</strong>',
  });
  return new Response(JSON.stringify(data));
}
```

### Astro Actions Example (Type-safe)
```typescript
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const server = {
  send: defineAction({
    accept: 'form',
    input: z.object({ email: z.email() }),
    handler: async ({ email }) => {
      const { data, error } = await resend.emails.send({
        from: 'The Hermetic Flight <noreply@thehermeticflight.com>',
        to: [email],
        subject: 'Hello world',
        html: '<strong>It works!</strong>',
      });
      return data;
    },
  }),
};
```

### Requirements
- **SSR adapter required** (Vercel adapter)
- Environment variable: `RESEND_API_KEY`
- React Email compatible for template rendering

Source: https://resend.com/astro

## React Email Template Support

Resend is built by the same team behind React Email. Templates can be:
- Built as React/TSX components
- Previewed locally during development
- Uploaded to Resend's dashboard for team collaboration
- Rendered server-side in Astro API routes using the `@react-email/render` package

This is a significant DX advantage — email templates are version-controlled code, not locked inside a SaaS dashboard.

## Quality Enforcement

Resend enforces sending quality thresholds:
- **Bounce rate must stay under 4%** — exceeding this can trigger account restrictions
- **Spam complaint rate must stay under 0.08%** — roughly 1 complaint per 1,250 emails

For a small list of hundreds of engaged subscribers from a quiz funnel, these thresholds should be easy to maintain. The risk increases with purchased lists or cold outreach (which this project does not involve).
