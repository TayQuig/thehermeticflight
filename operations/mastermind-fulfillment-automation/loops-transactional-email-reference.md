# Loops.so — Transactional Email & Fulfillment Capabilities Reference

> Last updated: 2026-03-09
> Sources: Loops.so official docs, Supabase partner page

---

## Can Loops.so Handle Fulfillment Emails?

**YES.** Loops.so supports both marketing AND transactional emails. Transactional
emails are fully supported via API with dynamic data variables, attachments,
and custom headers.

Relevant fulfillment email types Loops.so CAN send:
- Order confirmation
- Shipping notification (with tracking number)
- Delivery confirmation
- Survey/address collection reminders
- Replacement/return initiated
- General backer updates (campaign-style)

---

## Transactional Email API

### Endpoint
```
POST https://app.loops.so/api/v1/transactional
```

### Authentication
```
Authorization: Bearer YOUR_API_KEY
```
WARNING: API key must NEVER be used client-side. Server-side only.

### Request Body
```json
{
  "email": "backer@example.com",
  "transactionalId": "template_id_here",
  "addToAudience": false,
  "dataVariables": {
    "firstName": "Taylor",
    "trackingNumber": "1Z999AA10123456784",
    "orderStatus": "shipped",
    "estimatedDelivery": "March 20, 2026"
  },
  "attachments": [
    {
      "filename": "receipt.pdf",
      "contentType": "application/pdf",
      "data": "base64_encoded_content"
    }
  ]
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | YES | Recipient email |
| transactionalId | string | YES | Template identifier |
| addToAudience | boolean | No (default: false) | Create contact if doesn't exist |
| dataVariables | object | No | Template variables (string, number, or array of objects) |
| attachments | array | No | File attachments (requires account enablement) |

### Headers (Optional)
| Header | Description |
|--------|-------------|
| Idempotency-Key | UUID to prevent duplicate sends (24hr window, max 100 chars) |

### Dynamic Email Fields
Subject, From, Reply-to, CC, BCC can all be set dynamically via data variables
added to those fields in the template editor.

### Response
```json
// Success (200)
{ "success": true }

// Error (400/404/409)
{ "success": false, "message": "Error description" }
```

### Error Codes
- 400: Bad request (missing fields, invalid data)
- 404: Template not found
- 409: Idempotency key already used in past 24h
- 429: Rate limit exceeded

Source: https://loops.so/docs/api-reference/send-transactional-email

---

## List Transactional Templates

### Endpoint
```
GET https://app.loops.so/api/v1/transactional
```

### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| perPage | string | 20 | 10-50 results per request |
| cursor | string | — | Pagination cursor |

### Response
Returns only published templates. Each includes:
- id, name, lastUpdated, dataVariables

Source: https://loops.so/docs/api-reference/list-transactional-emails

---

## Rate Limits & Pricing

### Rate Limits
- **10 requests/second** per team (baseline)
- Response headers: `x-ratelimit-limit`, `x-ratelimit-remaining`
- 429 response on exceed — use exponential backoff
- Higher limits available by contacting Loops support

### Pricing
| Plan | Contacts | Monthly Sends | Transactional | Price |
|------|----------|---------------|---------------|-------|
| Free | 1,000 | 4,000 total | Included (shares limit) | $0 |
| Starter | varies | varies | **Unlimited** | $49/mo |
| Growth+ | varies | varies | **Unlimited** | $99+/mo |

**Critical detail:** Transactional recipients do NOT count as contacts
(unless also sent marketing emails). On paid plans, transactional sends
are unlimited.

**For Hermetic Flight fulfillment (500-2000 backers):**
- Free plan: 4,000 sends/month could work for initial campaign marketing
- Fulfillment phase: Need paid plan ($49/mo) for unlimited transactional
  sends when sending shipping notifications, confirmations, etc.
- At $49/mo for ~2-3 months of active fulfillment = $98-$147 total

Source: https://loops.so/pricing
Source: https://loops.so/docs/account/free-plan

---

## Loops.so + Supabase Integration

### What Exists
The official integration is for **authentication emails** — routing Supabase Auth
emails (signup confirmation, magic link, password reset) through Loops.so SMTP.

### SMTP Configuration
```
Host: smtp.loops.so
Port: 587
Username: loops
Password: [Loops API key]
```

### What This Means for Fulfillment
The Supabase integration is auth-focused, NOT fulfillment-focused. However,
you CAN build a fulfillment email pipeline using:
1. **Supabase database** — store backer data, order status, tracking numbers
2. **Supabase Edge Functions or Vercel serverless** — trigger on status change
3. **Loops.so Transactional API** — send the actual emails

This is a custom integration, not the pre-built Loops+Supabase one.

Source: https://supabase.com/partners/integrations/loops

---

## Other Relevant API Endpoints

### Contacts
- Create/update/find/delete contacts
- Manage custom properties
- Assign to mailing lists

### Events
- Send events to trigger automated email workflows (Loops campaigns)
- Could trigger "order_shipped" event to start a post-purchase drip

### Contact Properties
- Create custom fields (e.g., "archetype", "orderStatus", "trackingNumber")

### SDK Support
Official: JavaScript, Nuxt, PHP, Ruby
Community: Laravel, Rails

Source: https://loops.so/docs/api-reference

---

## Fulfillment Email Templates Needed

For Hermetic Flight, create these transactional templates in Loops.so:

1. **order_confirmed** — "Your Hermetic Flight deck is being prepared"
   - Data vars: firstName, archetype, orderNumber
2. **address_reminder** — "Please confirm your shipping address"
   - Data vars: firstName, surveyLink, deadline
3. **production_update** — "Your deck is in production"
   - Data vars: firstName, estimatedShipDate
4. **shipped** — "Your Hermetic Flight deck has shipped!"
   - Data vars: firstName, trackingNumber, trackingUrl, carrier
5. **delivered** — "Your deck has arrived"
   - Data vars: firstName, supportEmail
6. **replacement_initiated** — "We're sending a replacement"
   - Data vars: firstName, issueDescription, newTrackingNumber

These templates are created in the Loops.so dashboard (visual editor),
then triggered via the transactional API from Vercel serverless functions
or Supabase Edge Functions.
