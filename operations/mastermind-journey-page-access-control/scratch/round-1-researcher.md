# Round 1 — Researcher: Journey Page Access Control

## Research Question

Should the journey page (`/archetype/[slug]`) enforce quiz completion as the ONLY path to accessing journey content, or should there be alternative access paths?

---

## 1. SEO Impact of Gating Content Behind Interactions

### Google's Official Stance on Interstitials

Google's documentation ([Interstitials and dialogs](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials)) defines intrusive interstitials as "page elements that obstruct users' view of the content, usually for promotional purposes." The penalty applies to full-page overlays that obscure content, especially on first visit from search.

**Key exception**: Mandatory gates (age verification, legal compliance) are permitted if they use overlays rather than redirects, and Googlebot is allowed to see the content by verifying crawler requests. [Source: Google Search Central - Interstitials](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials)

### Cloaking Policy — What Applies Here

Google defines cloaking as "the practice of presenting different content to users and search engines with the intent to manipulate search rankings and mislead users." Two explicit examples: (1) showing travel pages to crawlers and drug pages to users; (2) inserting keywords only when a search engine requests the page. [Source: Google Spam Policies](https://developers.google.com/search/docs/essentials/spam-policies)

**Critical nuance**: Paywalls and content-gating are **explicitly permitted** if:
- Google can see the full content identical to what paying/authenticated users see
- The site follows "Flexible Sampling" guidelines
[Source: Google Spam Policies](https://developers.google.com/search/docs/essentials/spam-policies)

### Flexible Sampling — The Formal Framework for Gated Content

Google's [Flexible Sampling Guidelines](https://developers.google.com/search/docs/appearance/flexible-sampling) describe two approved gating models:

1. **Metering**: Monthly quota of free content before gate activates (recommended: 6-10 articles/month)
2. **Lead-in**: Show first portion of content above the paywall (a "teaser")

Both require structured data markup to differentiate gated content from cloaking. User satisfaction "starts to degrade significantly when paywalls are shown more than 10% of the time." [Source: Google Flexible Sampling Guidelines](https://developers.google.com/search/docs/appearance/flexible-sampling)

### Structured Data for Paywalled/Gated Content

Google provides a specific JSON-LD schema for marking gated content:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "isAccessibleForFree": false,
  "hasPart": {
    "@type": "WebPageElement",
    "isAccessibleForFree": false,
    "cssSelector": ".paywall"
  }
}
```

Uses `CreativeWork` or subtypes (`Article`, `WebPage`, etc.). The `cssSelector` property references the HTML class wrapping gated content. Only `.class` selectors allowed; no nesting. [Source: Google Structured Data for Paywalled Content](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content)

### Googlebot Does Not Click — Content Must Be in Initial DOM

Google's crawlers render JavaScript but do not interact with the page: "Googlebot doesn't interact like a human -- while it builds the DOM, it doesn't click, type, or trigger hover events, so content that appears only after user interaction may not be seen." [Source: SearchEngineLand - JavaScript SEO](https://searchengineland.com/guide/javascript-seo)

**Implication for current implementation**: The journey page (`[slug].astro`) sets `prerender: false` (SSR). The gated content is wrapped in `<div id="journey-content" style="display:none">` when `isGated` is true. Googlebot will:
1. Receive the SSR-rendered HTML
2. See `style="display:none"` on the journey content
3. **Not** execute the client-side gate unlock logic
4. Therefore **not index** the hidden journey content

This means the current implementation effectively hides journey content from Google when the user hasn't submitted email. Whether this is acceptable depends on the SEO strategy (see Analysis section).

### Astro SSR + Googlebot Behavior

With `prerender: false`, each request hits Vercel serverless. Googlebot gets server-rendered HTML. The cookie `thf_sub` will not be set for Googlebot (it doesn't submit forms), so Googlebot always sees the gated state — hero section visible, journey content hidden via `display:none`. [Source: Astro Docs - On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)]

---

## 2. Marketing Quiz Funnel Best Practices — Result Gating

### Industry Consensus: Email Gate AFTER Showing Value, Not Before

Multiple authoritative sources converge on this recommendation:

**Build Grow Scale** (47-store dataset): "Always ask for email after showing results. Requiring email before results drops completion rates by 40-60%." Post-result email capture achieves "50-70% email capture rates." Quiz completers convert at 3.2x the rate of non-completers (12.8% CVR vs 4.1% site average). [Source: Build Grow Scale - Product Quiz Conversion Guide](https://buildgrowscale.com/product-quiz-conversion-guide)

**Outgrow** (quiz engagement benchmarks): "Asking for email addresses mid-quiz kills momentum. Collect contact info at the end, after people are invested in seeing results." Personality quizzes achieve 60-80% completion rates (the highest category). The "best completion rate isn't always the highest" -- track how quiz-generated leads perform through the entire funnel. [Source: Outgrow - Quiz Engagement Benchmarks](https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates)

**Interact** (1 billion quiz views): 40.1% lifetime lead capture rate across all quizzes. Their pricing is lead-based (not completion-based), implying email capture is core to the value prop. Their help article recommends: "Give people a reason to opt-in: personalized advice based on their result, a discount, a free download, or any sort of incentive that adds to the appeal of seeing your quiz results." [Source: Interact Help - Lead Capture Best Practices](https://help.tryinteract.com/en/articles/4144101-best-practices-for-setting-up-quiz-lead-capture-forms)

### The Standard Quiz Funnel Pattern

The industry-standard pattern across Interact, Typeform, Outgrow, and ScoreApp is:

1. Quiz questions (5-12 questions)
2. Email capture form (BETWEEN questions and results)
3. Result reveal (immediate)
4. Journey/deeper content (either on result page or via CTA to separate page)

The email form sits between completion and results. The user has invested effort and is curious about their result. The form fields are minimal (email, sometimes first name). A skip option is sometimes available but reduces conversions.

**Important distinction**: The result page itself is NOT typically gated behind a separate interaction after showing the result. The journey/deeper content (spreads, prompts, guides) IS the value-add that justifies the email gate.

### The Hermetic Flight's Current Pattern

The current site has a **two-tier gate**:
1. **Quiz result page** (`/quiz/result/[archetype]`) — statically generated, no gate, publicly accessible, includes share buttons
2. **Journey page** (`/archetype/[slug]`) — SSR, email-gated via `thf_sub` cookie

This is actually a well-designed pattern: the result page gives the "reveal" moment (your archetype name, description, element), while the journey page is the deeper value prop (cards, spreads, prompts, reading guides) behind the email gate.

---

## 3. Cookie Expiry Patterns for Pre-Launch Funnels

### Current Implementation

Line 369 of `[slug].astro`:
```javascript
document.cookie = `thf_sub=${encodeURIComponent(currentSlug)};path=/;max-age=2592000;SameSite=Lax`;
```

This sets a 30-day persistent cookie (`2592000` seconds = 30 days), client-side, with `SameSite=Lax` and `path=/`.

### Industry Cookie Duration Standards

| Use Case | Recommended Duration | Source |
|----------|---------------------|--------|
| Functional preferences | 1-7 days | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |
| Login / "Remember Me" | 30-90 days | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |
| Analytics (GA4 `_ga`) | 2 years | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |
| Facebook ad (`_fbp`) | 90 days | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |
| French/Dutch/Lux regulators: max | 6-13 months | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |
| Chrome max (enforced) | 400 days | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |
| Safari ITP (tracking cookies) | ~7 days | [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/) |

### Cookie Classification Under GDPR/ePrivacy

The `thf_sub` cookie stores which archetype journey the user unlocked. Under GDPR/ePrivacy:

- **Strictly necessary** cookies: exempt from consent. These are cookies required for the service the user explicitly requested.
- **Functional** cookies: store user preferences; consent technically required but enforcement varies.
- **Marketing** cookies: consent always required.

The `thf_sub` cookie is arguably **functional** (remembers the user's state after a deliberate action), not strictly necessary. GDPR technically requires consent for it. However, the cookie contains no PII (just a slug string), and it's first-party. Risk level: low for a pre-launch site with modest traffic. [Source: GDPR.eu - Cookies](https://gdpr.eu/cookies/)

### Cookie Security Assessment

Current: `SameSite=Lax; path=/; max-age=2592000` (client-side, no `Secure`, no `HttpOnly`)

| Attribute | Current | Recommended | Reason |
|-----------|---------|-------------|--------|
| SameSite | Lax | Lax | Correct -- allows navigation from external links |
| Secure | Missing | Add if HTTPS | Prevents cookie being sent over HTTP |
| HttpOnly | Not possible | N/A | Cookie is set client-side, so HttpOnly is not available |
| Max-Age | 30 days | 30-90 days | 30 days is reasonable for pre-launch; see analysis below |
| Path | `/` | `/` or `/archetype` | `/` is fine since only one cookie |

[Source: MDN - Using HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)

### Duration Recommendation for Hermetic Flight

The 30-day duration is reasonable but warrants context:
- **Kickstarter launch**: 8/8/2026, approximately 4.5 months away
- Users who take the quiz in March/April need the cookie to persist until at least August
- 30 days means a user who engages in March will lose access by April
- A 90-day cookie covers March-through-June engagers
- A 180-day cookie covers everyone from now through launch
- Safari ITP may reduce this to ~7 days for some tracking cookies, though first-party cookies set via `document.cookie` generally survive ITP if the user has interacted with the site directly

**Practical recommendation**: 90 days minimum for pre-launch, consider 180 days to cover the full runway to Kickstarter.

---

## 4. Shared Link Conversion Patterns

### What Happens When Someone Shares a Gated Result Page

**Current Implementation Analysis**:

The Hermetic Flight has TWO shareable pages:
1. **Result page** (`/quiz/result/[archetype]`) — statically generated, no gate, includes `<ShareButtons>` component
2. **Journey page** (`/archetype/[slug]`) — SSR, email-gated

When someone shares the **result page** link:
- Recipient sees the full result (archetype name, element, description)
- Recipient sees a "Take the Quiz" CTA for themselves
- Recipient sees a "Go Deeper" CTA linking to the journey page
- No friction. Good viral loop potential.

When someone shares the **journey page** link directly:
- Recipient sees the hero section (archetype name, image, extended description)
- Recipient sees the email gate form asking for their email
- Recipient does NOT see affiliated cards, spreads, prompts, or reading guides
- **There is no CTA to take the quiz first** -- the journey gate form is the only path forward

### Industry Pattern: Shared Quiz Results Should Route to Quiz

**Interact's model**: When someone clicks a shared quiz result on Facebook, "they'll be taken to a full-screen page where they can take the quiz" -- they must retake the quiz themselves before seeing results. The shared post text follows the format "I Got [Result] -- [Quiz Title]." This creates a viral loop: share -> click -> take quiz -> see result -> share. [Source: Interact - How Quiz Results Get Shared on Facebook](https://www.tryinteract.com/blog/how-quiz-results-get-shared-on-facebook/)

**BuzzFeed's model**: Similarly, shared quiz links route to the quiz start page, not the result. The curiosity created by seeing a friend's result drives quiz completion. [Source: LeadQuizzes - How to Make a BuzzFeed Quiz That Goes Viral](https://www.leadquizzes.com/blog/the-ultimate-guide-on-how-to-make-a-buzzfeed-quiz-that-goes-viral/)

**Key insight**: The viral loop in quiz funnels depends on shared links routing NEW visitors to the quiz, not to the result/journey directly. The current architecture where the result page is the share target and includes a "Take the Quiz" CTA is correctly aligned with this pattern.

### The Journey Page Shared-Link Gap

If a user shares the journey page URL directly (via copy-paste, not through ShareButtons):
- There's no quiz CTA on the gated journey page
- The only action available is "enter email to unlock"
- A stranger visiting this URL has no context about what archetype means or why they should care
- **This is a conversion dead-end for non-quiz-takers**

---

## Analysis & Synthesis

### The Current Architecture Is Nearly Correct

The two-page model (ungated result page + gated journey page) is sound and aligns with industry best practices:
- Result page = the "reveal" (free, shareable, viral potential)
- Journey page = the "deep value" (gated, justifies email capture)

### Three Specific Issues to Address

**Issue 1: Googlebot SEO Blind Spot**

The journey page content is invisible to Google in the gated state. Options:

| Approach | SEO Benefit | Risk |
|----------|-------------|------|
| A. Show full content to Googlebot (user-agent detection) | Journey content indexed | Borderline cloaking if intent is deceptive; Google says paywalls are OK if structured data present |
| B. Use Flexible Sampling lead-in (show partial content) | Teaser content indexed | Reduced content but fully compliant |
| C. Accept that journey content is not indexed | None | Miss long-tail SEO from journaling prompts, card spreads |
| D. Add `isAccessibleForFree: false` structured data | Content indexed with paywall signal | Officially sanctioned approach; requires content to be in DOM |

**My recommendation**: Option D + partial content exposure. Add the paywalled content structured data schema. Optionally render the first section (Affiliated Cards) or first journaling prompt visibly even in gated state as a "lead-in" teaser. This gives Google something to index, signals the gate is intentional (not cloaking), and gives visitors a taste of the depth behind the gate.

**Issue 2: Journey Page Needs a Quiz CTA for Unrecognized Visitors**

When someone arrives at `/archetype/soul-diver` with no cookie and no quiz context, the only action is "enter email." This page needs a secondary path: "Not sure this is your archetype? Take the quiz to find out." This converts dead-end visits into quiz starts.

**Issue 3: Cookie Duration Too Short for Pre-Launch Timeline**

30 days does not cover the March-to-August runway. A user who engages now will lose journey access before the Kickstarter launches. Extend to 90-180 days.

### Access Path Matrix

| Visitor Type | Result Page | Journey Page (Current) | Journey Page (Recommended) |
|-------------|-------------|----------------------|---------------------------|
| Quiz completer (has cookie) | Full view | Full view | Full view |
| Quiz completer (cookie expired) | Full view | Email gate | Email gate (longer cookie) |
| Direct link from friend | Full view + quiz CTA | Hero + email gate only | Hero + teaser + email gate + quiz CTA |
| Googlebot | Full view (static) | Hero only (display:none hides rest) | Hero + structured data + teaser content |
| Social media click | Full view (OG tags) | Hero + email gate | Hero + teaser + email gate + quiz CTA |

---

## Artifacts on Disk

This document: `operations/mastermind-journey-page-access-control/scratch/round-1-researcher.md`

### Source URLs Referenced

1. [Google - Intrusive Interstitials](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials)
2. [Google - Spam Policies (Cloaking)](https://developers.google.com/search/docs/essentials/spam-policies)
3. [Google - Flexible Sampling Guidelines](https://developers.google.com/search/docs/appearance/flexible-sampling)
4. [Google - Structured Data for Paywalled Content](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content)
5. [SearchEngineLand - JavaScript SEO](https://searchengineland.com/guide/javascript-seo)
6. [Astro Docs - On-demand Rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
7. [Astro Docs - Middleware](https://docs.astro.build/en/guides/middleware/)
8. [Build Grow Scale - Product Quiz Conversion Guide](https://buildgrowscale.com/product-quiz-conversion-guide)
9. [Outgrow - Quiz Engagement Benchmarks](https://outgrow.co/blog/quiz-engagement-benchmarks-completion-rates)
10. [Interact - Lead Capture Best Practices](https://help.tryinteract.com/en/articles/4144101-best-practices-for-setting-up-quiz-lead-capture-forms)
11. [Interact - How Quiz Results Get Shared on Facebook](https://www.tryinteract.com/blog/how-quiz-results-get-shared-on-facebook/)
12. [CookieYes - Cookie Duration](https://www.cookieyes.com/blog/cookie-duration/)
13. [MDN - Using HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
14. [GDPR.eu - Cookies](https://gdpr.eu/cookies/)
15. [Vercel - Astro on Vercel](https://vercel.com/docs/frameworks/frontend/astro)
16. [LeadQuizzes - BuzzFeed Quiz Viral Guide](https://www.leadquizzes.com/blog/the-ultimate-guide-on-how-to-make-a-buzzfeed-quiz-that-goes-viral/)
