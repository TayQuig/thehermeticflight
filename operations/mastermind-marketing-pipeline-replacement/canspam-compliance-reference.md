# CAN-SPAM Compliance Reference — Self-Managed Email Systems

> Research date: 2026-02-28
> Sources: ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business (accessed via termly.io summary), termly.io/resources/articles/can-spam-act/, mailchimp.com/help/anti-spam-requirements-for-email/, resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails

---

## The 7 CAN-SPAM Requirements

Every commercial email sent from The Hermetic Flight must comply with all seven:

### 1. Accurate Header Information
- "From," "To," and routing information must be accurate
- The sending domain must be legitimately owned/controlled by the sender
- **Implementation:** Use a verified custom domain in Resend (e.g., `noreply@thehermeticflight.com`)

### 2. Non-Deceptive Subject Lines
- Subject line must accurately reflect the content of the message
- No misleading or clickbait subject lines that misrepresent content
- **Implementation:** Builder must ensure drip email subject lines match content

### 3. Identify the Message as an Ad
- Commercial messages must be "clearly and conspicuously labeled" as advertisements
- The law gives flexibility in how to do this — no specific format required
- **Implementation:** Include a small disclaimer in the email footer: "You're receiving this because you took our quiz at thehermeticflight.com"

### 4. Physical Address
- Every commercial email must include the sender's valid physical postal address
- Acceptable formats:
  - Current street address
  - PO Box registered with USPS
  - Private mailbox registered with a commercial mail receiving agency (e.g., UPS Store, virtual mailbox services)
- **Implementation:** Include physical address in the email footer template

### 5. Opt-Out Mechanism
- Every email must include a clear, conspicuous way to opt out
- Must be an "easy Internet-based way" — typically an unsubscribe link
- The opt-out mechanism must remain functional for at least **30 days** after the email is sent
- Cannot require the recipient to provide additional information beyond their email address
- Cannot charge a fee to unsubscribe
- **Implementation:** Unsubscribe link in every email footer + `List-Unsubscribe` header

### 6. Honor Opt-Outs Within 10 Business Days
- Once someone opts out, you must stop sending within **10 business days**
- Cannot sell or transfer opted-out email addresses to another entity
- **Implementation:** The unsubscribe endpoint must immediately mark the subscriber as unsubscribed in Supabase, and the drip scheduler must check subscription status before every send

### 7. Monitor Third-Party Compliance
- If you hire someone to handle email marketing, you're still responsible for compliance
- Both the company whose product is promoted AND the company that sends the message can be held liable
- **Implementation:** Since this is self-managed, this applies to the operator directly

Source: https://termly.io/resources/articles/can-spam-act/

## Penalties for Non-Compliance

| Violation Type | Penalty |
|---------------|---------|
| Per-violation fine | Up to **$51,744** per email |
| Aggravated violations | ISP injunctions, damages, attorney fees |
| Criminal penalties (deceptive headers, harvested addresses) | Up to **5 years imprisonment** |

Source: https://termly.io/resources/articles/can-spam-act/

**Risk assessment:** For a small creative business sending to quiz opt-ins, the risk is extremely low — CAN-SPAM enforcement targets spammers and deceptive senders. But compliance is still legally required and straightforward to implement.

## Commercial vs. Transactional Email Distinction

### Transactional Emails (Largely Exempt from CAN-SPAM)
- Transaction confirmations
- Account notifications
- Warranty/recall information
- Subscription status changes
- Delivery of purchased goods/services

### Commercial Emails (Full CAN-SPAM Compliance Required)
- Marketing messages
- Promotional content
- **Drip sequences** (even educational/content-based ones that promote a business)
- Newsletter content that promotes products/services

**For The Hermetic Flight:** Quiz result emails and drip sequences are **commercial emails** because they promote The Hermetic Flight's services/offerings, even if the content is educational. Full CAN-SPAM compliance is required.

## What Mailchimp Handles Automatically (That You Must Build)

| Feature | Mailchimp (Automatic) | Self-Hosted (You Build It) |
|---------|----------------------|--------------------------|
| Unsubscribe link in emails | Auto-generated, auto-placed | Must add to every email template |
| Unsubscribe processing | Automatically removes from lists | Must build endpoint + update database |
| One-click unsubscribe header | Auto-added to bulk emails | Must add `List-Unsubscribe` + `List-Unsubscribe-Post` headers |
| Physical address in footer | Auto-inserted from account settings | Must hardcode in email template |
| Bounce handling | Auto-removes hard bounces | Must handle Resend webhook for bounce events |
| Spam complaint handling | Auto-removes complainants | Must handle Resend webhook for complaint events |
| Double opt-in | Built-in toggle | Must implement confirmation email flow |
| Suppression list | Automatic cross-campaign suppression | Must maintain unsubscribed/bounced list and check before every send |
| GDPR consent tracking | Built-in consent management | Must track consent timestamp and method yourself |

Source: https://mailchimp.com/help/anti-spam-requirements-for-email/

## Implementation Checklist for the Builder

### Email Template Requirements
- [ ] Unsubscribe link — visible, in footer, one-click process
- [ ] Physical address — in footer of every email
- [ ] Ad disclosure — brief note explaining why they're receiving the email
- [ ] Accurate "From" name and address

### Backend Requirements
- [ ] Unsubscribe endpoint (GET for page, POST for one-click)
- [ ] `List-Unsubscribe` header on every outgoing email
- [ ] `List-Unsubscribe-Post` header (RFC 8058)
- [ ] Subscriber status check before every send
- [ ] Bounce webhook handler — marks hard bounces as unsubscribed
- [ ] Spam complaint webhook handler — marks complainants as unsubscribed
- [ ] Opt-out honored within 10 business days (implement immediately for best practice)
- [ ] Unsubscribe mechanism functional for 30 days after email sent

### Database Requirements
- [ ] `is_subscribed` boolean field on subscriber record
- [ ] `unsubscribed_at` timestamp
- [ ] `bounce_count` or `hard_bounced` flag
- [ ] `spam_complaint` flag

### Operational Requirements
- [ ] Physical mailing address decided (PO Box or virtual mailbox is fine)
- [ ] Domain verified in Resend with SPF/DKIM/DMARC
- [ ] Email templates reviewed for honest subject lines

## Gmail/Yahoo Bulk Sender Requirements (2024+)

Even though these apply to senders of 5,000+ daily emails (which this project won't reach), implementing them improves deliverability:

1. **SPF and DKIM authentication** — Resend handles this
2. **DMARC policy** — must configure manually
3. **One-click unsubscribe (RFC 8058)** — must implement manually
4. **Spam rate below 0.3%** — monitored via Google Postmaster Tools
5. **Valid forward and reverse DNS** — Resend handles this

Source: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
