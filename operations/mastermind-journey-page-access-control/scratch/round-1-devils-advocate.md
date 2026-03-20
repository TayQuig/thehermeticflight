# Devil's Advocate — Round 1: Journey Page Access Control

**Question:** Should the journey page enforce quiz completion (cookie) as the ONLY
path to journey content, closing the email-form side door?

**Verdict:** CONDITIONAL PROCEED with mandatory mitigations for risks R-01, R-02,
R-03, and R-05. The proposal is architecturally sound for a marketing soft gate
but has four exploitable weaknesses that would cause real user-facing breakage
if shipped unaddressed.

---

## Risk Register

### R-01 — Safari ITP Caps Client-Set Cookies to 7 Days (CRITICAL)

**What breaks:** The entire access-control model. The proposal calls for a 30-day
`max-age` cookie set via `document.cookie` (client-side JS). Safari's Intelligent
Tracking Prevention (ITP) caps all JavaScript-set first-party cookies to a
**maximum 7-day lifespan**, regardless of the `max-age` value. This has been in
effect since Safari 12.1 (2019) and remains current policy.

**Under what conditions:** Every Safari user (desktop and iOS). Safari holds
~18-20% global browser share, higher in the US, and significantly higher on
mobile in the tarot/wellness demographic. On iOS specifically, *all* browsers
(Chrome, Firefox, etc.) use WebKit under the hood, so the 7-day cap applies to
every browser on iPhone and iPad.

**Quantified impact:** A user who takes the quiz on Safari/iOS, visits the
journey page on day 8, and finds themselves locked out. With a 4.5-month
pre-launch window (March to August 8), this means Safari users would be locked
out **~19 times** before launch if they tried to revisit monthly. The journey
page becomes ephemeral content for ~40-50% of the audience (iOS users).

**What mitigates it:**
1. Set the cookie **server-side** via `Set-Cookie` header from the API response
   (`/api/quiz-submit` or `/api/journey-subscribe`). Server-set first-party
   cookies get the full `max-age` on Safari, unless Safari detects an IP mismatch
   between the cookie-setting server and the site domain (Safari 16.4+). On
   Vercel, the serverless function and the site share the same domain, so this
   should pass the ITP check.
2. Alternatively, use `localStorage` as a fallback (not subject to the 7-day
   cap if the user revisits within 7 days, which resets the clock). But
   `localStorage` is not readable server-side, so the SSR gate on `[slug].astro`
   would need a client-side hydration step, adding flash-of-gated-content.
3. Extend `max-age` to 180 days (already noted in eval N-2) and combine with
   server-side setting.

**Severity: CRITICAL.** The cookie is the *only* access mechanism. If it silently
expires after 7 days on the dominant mobile platform, the gate locks out
legitimate users with no explanation and no recovery path except re-entering
their email (which they already provided). This is not a theoretical edge case;
it is the default behavior for the largest mobile browser engine.

**Source:** [Safari ITP — Stape](https://stape.io/blog/safari-itp),
[Jentis ITP Bypass Guide](https://www.jentis.com/blog/how-to-work-with-safari-itp-limitations),
[Simo Ahava — WebKit Cookie Caps](https://www.simoahava.com/privacy/first-party-cookies-webkit-revisited/),
[Seresa — Server-Side Cookies Safari](https://seresa.io/blog/data-loss/server-side-cookie-setting-in-2026-why-your-server-can-set-cookies-safari-cannot-kill)

---

### R-02 — SEO Content Burial: Rich Content Invisible to Crawlers (HIGH)

**What breaks:** Organic search visibility for the highest-value content on the
site. The journey pages contain FAQ schema (JSON-LD), affiliated card meanings,
spread descriptions, and journaling prompts — exactly the kind of long-tail,
high-intent content that ranks for queries like "air element tarot spread" or
"shadow work journaling prompts tarot."

**Under what conditions:** Always, as currently architected. The page uses
`export const prerender = false` (SSR on every request). Googlebot does not send
cookies. When Googlebot hits `/archetype/air-weaver`, the server evaluates
`Astro.cookies.get('thf_sub')` and gets `null`, so `isGated = true`. The server
returns HTML where `#journey-content` has `style="display:none"`. Googlebot sees:

- Hero section (archetype name, element, description) — **indexable**
- Gate form HTML — **indexable but useless**
- Journey content sections — **present in HTML but `display:none`**
- JSON-LD FAQ schema — **present and indexable** (it's in `<head>`)

The nuance: Google *can* index `display:none` content, but it weights it lower
and may flag it as hidden text if it detects a pattern of showing different content
to users vs. crawlers. The FAQ schema in `<head>` is indexable regardless, but
Google may reject FAQ rich results if the corresponding visible content is hidden
from the user at page load (Google's FAQ structured data guidelines require that
FAQ content be "visible to the user on the page").

**Quantified impact:** Six journey pages, each with 3+ affiliated cards, 2+
spreads, 5+ journaling prompts, and blog links. This is approximately 60-80
pieces of unique long-tail content that become invisible or de-weighted. For a
pre-launch site building SEO authority, this is significant lost indexing surface.

**What mitigates it:**
1. **Render journey content unconditionally in HTML, gate with JS only.** Serve
   all content in the initial HTML (no `display:none` from SSR). Use client-side
   JS to collapse/blur content for non-cookie users. Googlebot will index the
   full content. Real users without cookies see the blur/gate. This is the
   standard paywall pattern (Google indexes paywalled content if it is in the
   source HTML behind a flexible sampling / metered access model).
2. **Use `data-nosnippet` on gated sections** if the operator wants to prevent
   snippet preview but allow indexing.
3. **Alternatively:** Keep SSR gating but detect Googlebot via user-agent and
   serve full content to crawlers. This is a cloaking gray area — Google
   tolerates it for paywalled content under their [structured data guidelines
   for paywalled content](https://developers.google.com/search/docs/appearance/structured-data/paywalled-content),
   but only with proper `isAccessibleForFree` markup.

**Severity: HIGH.** Not a functional break, but a strategic one. The entire
funnel assumes journey pages will attract organic traffic (card-related search
queries). If that content is invisible to crawlers, the quiz becomes the *only*
entry point, which is a single-channel dependency (see R-06).

---

### R-03 — Single-Archetype Cookie: Retake Kills Previous Access (HIGH)

**What breaks:** Multi-visit user experience. The cookie stores a single slug.
Taking the quiz again and getting a different archetype overwrites the cookie.
The user loses access to their first journey page. There is no indication this
will happen, no warning, and no recovery.

**Under what conditions:** Any user who retakes the quiz (the page has a
prominent "Retake the Quiz" button at the bottom of the journey page itself,
line 320). The quiz encourages exploration ("What's Your Aerial Tarot Archetype?"
implies discovery, not finality). Users in the tarot/wellness space are
particularly likely to retake personality-style quizzes.

**Quantified impact:** The "Retake the Quiz" CTA is literally on the journey
page. The design actively encourages the behavior that causes the break. The
result is a confused user who bookmarked their Air Weaver journey, retook the
quiz out of curiosity, got Shadow Dancer, and now finds their Air Weaver bookmark
shows a gate form asking for their email — which they already provided.

**What mitigates it:**
1. **Multi-slug cookie.** Store `thf_sub=air-weaver,shadow-dancer` (comma-
   separated). Check with `cookie.value.split(',').includes(urlSlug)`. Cookie
   size limit is 4096 bytes; 6 slugs at ~15 chars each = ~95 bytes. No risk.
2. **Per-archetype cookies.** `thf_air-weaver=1`, `thf_shadow-dancer=1`. More
   cookies but no parsing needed. Server-side check: `Astro.cookies.get('thf_' + urlSlug)`.
3. **Accept the limitation but remove the "Retake" CTA from the journey page.**
   If single-archetype is intentional, don't invite the behavior that breaks it.

**Severity: HIGH.** Already flagged as M-1 in the UX eval and noted in the
backlog as "Post-Launch Monitoring & Polish." I am escalating it because the
journey page *literally has a retake button*. Shipping a UX that encourages users
to break their own access is not a post-launch concern; it is a pre-ship defect.

---

### R-04 — Shared Link Dead End (MEDIUM)

**What breaks:** Viral loop. User A takes the quiz, gets Air Weaver, shares the
journey page URL (`/archetype/air-weaver`) to a friend. Friend clicks the link,
sees hero + "Take the Quiz" CTA. Friend must complete a 12-question quiz to see
the content that was shared with them. Conversion probability from shared link to
quiz completion: realistically 10-20%. The rest bounce.

**Under what conditions:** Every shared journey page link. The result page
(`/quiz/result/[archetype]`) already has share buttons. The journey page footer
has a "Your Result" link pointing to the result page. But if someone shares the
journey URL directly (copy/paste from browser bar, which is the most common
sharing mechanism), the recipient hits the gate.

**What mitigates it:**
1. **This is arguably the intended design.** The gate forces every user through
   the quiz (email capture funnel). If the operator values email capture over
   share virality, this is correct behavior. The question is which metric matters
   more pre-launch: email list size or content reach.
2. **Compromise: show a meaningful preview.** The hero section already shows the
   archetype name, element, image, short description, and extended description.
   That is actually a decent amount of content. The gate only hides cards,
   spreads, and prompts. This may be sufficient to pique interest and drive quiz
   starts.
3. **Alternative compromise: time-delayed gate.** Show full content for 60
   seconds, then overlay the gate. This lets shared-link recipients see the
   content, increasing share value, while still gating return visits.

**Severity: MEDIUM.** This is a product decision, not a defect. But the operator
should make this tradeoff consciously. The current hero content is actually
generous enough to work as a landing page for shared links.

---

### R-05 — 30-Day Cookie vs. 4.5-Month Pre-Launch Window (HIGH)

**What breaks:** Returning user access. Even ignoring Safari ITP (R-01), the
30-day `max-age` means any user who takes the quiz in March loses access by late
April. The Kickstarter launches August 8. That is a 4.5-month window where
early adopters — the highest-intent users — get locked out of the content
designed to nurture them toward backing.

**Under what conditions:** Every user who does not revisit within 30 days. This
is especially likely during the "quiet months" (April-June) before launch
marketing ramps up. The email drip series is 8 weeks (2 months). A user who
completes the quiz in March and reads all 8 emails finishes by mid-May. If they
return to their journey page in July after a Kickstarter reminder email, the
cookie is expired.

**What mitigates it:**
1. **Extend to 180 days** (already in backlog as N-2, but should be done at
   implementation time, not deferred).
2. **Cookie renewal on visit.** Each time the user visits the journey page with
   a valid cookie, reset `max-age` to 180 days. This is trivially implementable
   server-side with `Set-Cookie`.
3. **Email-based re-entry.** The 8-week email drip links back to the journey
   page. If those links include a signed token (`?t=<hmac>`) that re-sets the
   cookie server-side, returning users from email never experience lockout. This
   also solves the "new device" problem.

**Severity: HIGH.** Deferring this to "Post-Launch Monitoring & Polish" means
shipping a known time bomb. The fix is trivial (change one number), the risk is
real (losing the warmest leads), and the backlog explicitly acknowledges it. Ship
the 180-day value from day one.

---

### R-06 — Quiz as Single Point of Failure for the Entire Funnel (MEDIUM)

**What breaks:** All journey content access. If the quiz page has a bug, the
quiz engine has a regression, or the calculating/self-select flow breaks, no new
users can access any journey content. Currently there are two entry paths: quiz
completion (cookie) and the journey page email form (side door). Closing the side
door makes the quiz the only path.

**Under what conditions:** Any quiz-breaking bug. The quiz is a 1100-line Astro
page with a 7-phase state machine, client-side classification, Monte Carlo-
calibrated scoring, PRNG-based answer shuffling, and product research questions.
It is the most complex page on the site. The quiz engine alone has 54 unit tests,
which is evidence of its complexity.

**Quantified impact:** Quiz downtime = 100% of new journey page access blocked.
Currently, the journey page side door means a broken quiz still allows direct
visitors to trade email for content. Removing the side door removes the fallback.

**What mitigates it:**
1. **The quiz is heavily tested** (54 unit tests + E2E suite). The risk of
   undetected breakage is low.
2. **Vercel deployment is atomic** — a broken deploy can be instantly rolled
   back.
3. **Keep a minimal fallback.** If the operator insists on closing the email
   form side door, consider keeping it as a hidden fallback that activates only
   if the quiz page returns an error (e.g., a URL parameter `?fallback=1` that
   the journey page checks). This is defense-in-depth, not a side door.
4. **Monitoring.** The eval harness (Sprint 3 backlog) should track
   `quiz_started` and `quiz_completed` rates. A sudden drop in
   `quiz_completed` with stable `quiz_started` signals a mid-quiz break.

**Severity: MEDIUM.** The quiz's test coverage and Vercel's rollback capability
reduce this to an acceptable risk. The bigger concern is the *conceptual* single
point of failure, which matters more as traffic scales.

---

### R-07 — Cookie Forgery Is Trivial (LOW)

**What breaks:** The "gate" as a content protection mechanism. Any user can open
browser DevTools, type `document.cookie = "thf_sub=air-weaver;path=/;max-age=2592000"`,
and bypass the gate entirely. Or install a cookie editor extension. Or use curl
with a `Cookie` header.

**Under what conditions:** Any technically literate user. This is about 5-10% of
the audience, lower in the tarot/wellness demographic.

**What mitigates it:**
1. **This is a soft gate, not content DRM.** The plan document explicitly states:
   "Cookie-based soft gating is standard for lead-gen quizzes. The goal is
   conversion optimization, not content DRM." The forgery risk is acknowledged
   and accepted.
2. **The content has no monetary value behind the gate.** It is marketing
   content designed to nurture toward Kickstarter backing. Users who bypass the
   gate and read the content are still being marketed to.
3. **The only loss is the email address.** If someone forges the cookie, they
   skip the email capture. But they also self-selected as someone uninterested
   in providing their email, making them a low-quality lead anyway.

**Severity: LOW.** Correctly scoped as a marketing optimization, not security.
No mitigation needed beyond the existing design rationale.

---

### R-08 — Incognito / Private Browsing / Cookie-Blocking Users (LOW)

**What breaks:** Post-quiz journey access for privacy-conscious users. In
incognito mode, cookies are cleared when the session ends. Users who take the
quiz in incognito, close the browser, and return to the journey page will be
gated. Additionally, users with aggressive cookie-blocking extensions (uBlock
Origin in strict mode, Privacy Badger) may block the cookie entirely.

**Under what conditions:** ~5-15% of web traffic uses incognito mode. Cookie-
blocking extensions affect ~10-15% of technically engaged users. Overlap with
the tarot/wellness audience is likely lower.

**What mitigates it:**
1. This is inherent to cookie-based systems and is the same as every other
   marketing gate on the internet.
2. The journey page gate form provides the re-entry path (if it remains as the
   proposal specifies — hero + "Take the Quiz" CTA). These users can retake
   the quiz.
3. For the "quiz-only" variant: these users are simply asked to retake the quiz.
   Mild friction, not a blocker.

**Severity: LOW.** Standard web platform limitation. No special mitigation
needed.

---

### R-09 — E2E Test Breakage from Closing the Side Door (MEDIUM)

**What breaks:** The existing E2E test suite. The current `quiz-gate-e2e.spec.ts`
(lines 261-328) tests the journey page gate with the email form side door:
- `test('submitting email on gated page sets cookie and reveals content')` — line 308
- `test('without cookie: shows gated view')` — line 263, expects `#journey-gate-form` visible
- `test('with correct cookie: shows full content')` — line 274

If the email form is removed from the journey page and replaced with a "Take the
Quiz" CTA, all three tests that interact with `#journey-gate-form` will fail.
The test at line 308 specifically tests the form submission flow that is being
removed.

**Under what conditions:** Immediately upon implementation.

**What mitigates it:**
1. These tests must be rewritten to match the new behavior. The "without cookie"
   test should expect a "Take the Quiz" CTA instead of a form. The "submitting
   email" test should be deleted or replaced with a test that verifies the quiz
   flow sets the cookie correctly.
2. The cookie-setting tests at lines 163-193 (quiz results page) remain valid
   and unchanged.
3. This is a known cost of the change, not a surprise.

**Severity: MEDIUM.** Straightforward test maintenance, but must be planned into
the implementation phase. Do not ship with broken E2E tests.

---

## Summary: Risk Priority Matrix

| Risk | Severity | Effort to Mitigate | Recommendation |
|------|----------|---------------------|----------------|
| R-01 Safari ITP 7-day cap | CRITICAL | Medium (server-side cookie setting) | BLOCK if unaddressed. Must set cookie server-side. |
| R-02 SEO content burial | HIGH | Low-Medium (client-side gating instead of SSR gating) | Mitigate before ship. Render content in HTML, gate with JS. |
| R-03 Single-archetype cookie | HIGH | Low (multi-slug cookie) | Mitigate before ship. Trivial code change. |
| R-05 30-day expiry too short | HIGH | Trivial (change one number) | Mitigate before ship. No reason to defer. |
| R-04 Shared link dead end | MEDIUM | None (product decision) | Acknowledge and decide. Current hero is adequate preview. |
| R-06 Quiz as SPOF | MEDIUM | Low (monitoring, fallback CTA) | Accept with monitoring. Test coverage is sufficient. |
| R-09 E2E test breakage | MEDIUM | Low (test rewrite) | Plan into implementation phase. |
| R-07 Cookie forgery | LOW | None | Accept. Correctly scoped as soft gate. |
| R-08 Incognito/blockers | LOW | None | Accept. Standard platform limitation. |

## BLOCK Conditions

I will vote **BLOCK** if R-01 (Safari ITP) is not addressed in the implementation
plan. A client-side-only cookie with an effective 7-day lifespan on the dominant
mobile platform is not a viable access-control mechanism for a 4.5-month funnel.
Server-side cookie setting is mandatory.

All other risks are addressable without blocking and should be mitigated at
implementation time, not deferred to the backlog.
