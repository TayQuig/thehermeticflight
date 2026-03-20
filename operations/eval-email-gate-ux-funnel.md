# UX Funnel Evaluation: Email Gate + Product Research

**Evaluator lens:** UX Funnel (friction, conversion path, drop-off risk)
**Date:** 2026-03-19
**Files evaluated:**
- `src/pages/quiz.astro` (email gate, product research, re-capture, results)
- `src/pages/archetype/[slug].astro` (journey page cookie-based gate)
- `src/pages/api/quiz-submit.ts` (API handler for quiz + product research)

---

## Category Scores

| # | Category | Score | Notes |
|---|----------|-------|-------|
| 1 | Gate Friction vs. Value Exchange | 4 | Strong gate positioning, solid skip path; re-capture slightly weakened by missing firstName field |
| 2 | Product Research UX | 3 | Tone is good; placement creates a wall between user and their share/journey CTA |
| 3 | Journey Page Gate | 4 | Hero section is compelling teaser; optimistic reveal is well-designed; minor concerns on cookie narrowness |
| 4 | Cookie/State Management | 2 | Fundamental single-archetype cookie limitation; no handling for returning quiz-takers |
| 5 | Conversion Path Integrity | 3 | Skip-path users hit a dead end if API fails; share section visibility depends on a chain that can break |

**Overall Score: 3.2 / 5**

---

## Findings

### Critical

**C-1: Skip-path users who complete re-capture get a fire-and-forget API call with no error feedback**

In `quiz.astro` lines 964-977, the re-capture form handler fires the API call as fire-and-forget (`.catch()` silently logs) and immediately calls `revealResultFull()`. If the API call fails (network error, 500, rate limit), the user sees full content locally but:
- Their email is never registered with Loops.so
- They believe they subscribed
- The `thf_sub` cookie is set (line 980), so the journey page also unlocks, but no email drip will arrive

This creates a silent funnel break where the user perceives completion but the backend has no record.

**Recommended fix:** Show a subtle toast or inline note if the API call fails: "Your results are ready, but we couldn't save your email. Try again below." Keep the content revealed (don't punish the user), but surface the error so they can retry.

---

**C-2: Product research creates a second API call that can be rate-limited, silently failing**

In `quiz.astro` lines 837-855, clicking "Continue to Your Journey" fires a *second* `POST /api/quiz-submit` with the same email+answers plus the `productResearch` payload. The rate limiter in `quiz-submit.ts` allows only 3 requests per email. The first call fires on result reveal (line 922). If the user reaches product research and submits, that is call #2. But if the user retook the quiz or encountered any retry, they may already be at the limit. The product research data silently disappears.

**Recommended fix:** Either (a) defer the initial API call until after product research is resolved (single submission), or (b) make the product research submission a PATCH/update operation against an existing contact rather than a full re-submission through the same endpoint.

---

### Major

**M-1: `thf_sub` cookie stores only ONE archetype slug -- revisiting for a different archetype wipes access to the first**

The journey page gate (`[slug].astro` line 36-37) checks `cookie.value !== urlSlug`. The cookie stores a single kebab-case slug. If a user takes the quiz, gets "air-weaver", visits that journey page (cookie set to "air-weaver"), then shares the link with a friend who takes the quiz and gets "shadow-dancer" on the same machine -- the first user loses access to their air-weaver journey page on the next visit. More realistically, a user who retakes the quiz and gets a different result will lose access to their original journey.

**Recommended fix:** Store a comma-separated list or JSON array of archetype slugs in the cookie. Check with `cookie.value.includes(urlSlug)` or parse as array. Alternatively, use one cookie per archetype (`thf_sub_air-weaver=1`).

---

**M-2: share-section is visible by default inside result-full -- product research does not initially hide it**

The `share-section` div (line 370) is inside `result-full` (line 289) with no `hidden` class. When `revealResultFull()` removes `hidden` from `result-full`, both the product research section AND the share section become visible simultaneously. The `showJourneyCta()` function hides product research and "shows" share-section (line 783-789), but share-section was never hidden in the first place.

This means when a user completes the email gate and sees their full results, they see: tagline, description, product research questions, AND the share/journey CTAs all at once. The product research is supposed to be a gateway to the share section, but both are visible from the start, undermining the intended flow.

**Recommended fix:** Add `class="hidden"` to the `share-section` div initially (line 370), or add `opacity-0 translate-y-4` to match the stagger pattern. Then `showJourneyCta()` already handles revealing it.

---

**M-3: Re-capture form on results page is email-only -- no firstName field**

The email gate form (line 158-182) collects both firstName (optional) and email. The re-capture form on the results page (line 268-285) only has an email field. The `capturedFirstName` variable remains empty string for skip-path users who later re-capture. This means skip-path users who convert via re-capture get a degraded Loops.so contact record (no firstName), which impacts email personalization for the entire 8-week drip series.

**Recommended fix:** Add an optional firstName field to the re-capture form, matching the email gate form pattern.

---

**M-4: Journey page gate form does not collect firstName**

The gate form on `[slug].astro` (lines 137-155) only collects email. The `/api/journey-subscribe` endpoint accepts `firstName` but the form never sends it. Users who arrive at the journey page directly (e.g., shared link) and subscribe through the gate get no firstName in their Loops.so contact, degrading personalization.

**Recommended fix:** Add an optional firstName field to the journey gate form.

---

### Minor

**m-1: Journey page has TWO email forms visible simultaneously for gated users**

When `isGated` is true, the user sees the gate form (line 123-161) AND the "Continue the Path" email series signup form (line 263-303) at the bottom. The gate form says "Reveal My Journey" while the bottom form says "Begin the Series." A confused user might fill out the bottom form first, which subscribes them to the email series but does NOT set the `thf_sub` cookie or unlock the journey content.

**Recommended fix:** When gated, either hide the bottom email series form or have the bottom form also set the cookie and reveal content. Alternatively, merge the forms so any email submission on the page both unlocks content and subscribes to the series.

---

**m-2: Journey gate uses fire-and-forget for API call -- if it fails, cookie is already set**

The journey page gate handler (line 366-396) sets the cookie and reveals content *before* the API call (optimistic reveal). If the API call to `/api/journey-subscribe` fails silently, the user has a cookie granting access but no email was actually collected. On subsequent visits, the page appears unlocked and the gate form is gone (server-side check on line 36-37), so there is no opportunity to re-capture.

**Recommended fix:** This is an acceptable tradeoff (don't punish the user), but add a small persistent banner or retry mechanism for the case where the API fails: "We couldn't save your email -- click here to try again."

---

**m-3: No loading/disabled state on re-capture form submit button**

The email gate form (line 179) and journey gate form (line 149-154) both disable their submit buttons and show loading text during submission. The re-capture form on the results page (lines 268-285) has no loading state -- the button stays enabled and unchanged during submission. Rapid clicks could fire multiple API calls.

**Recommended fix:** Add disable/loading text to the re-capture form submit handler, matching the pattern used in the other forms.

---

**m-4: Product research "Continue" button fires even with no selections**

The `product-research-continue` button (line 358) fires the API call regardless of whether the user selected any radio or checkbox options. If the user clicks "Continue" without answering either question, the API receives `productResearch: {}` (empty object). This is validated to `{ cardBacks: null, productInterest: null }` in the API, which then sends null values to Loops.so. Not harmful, but it means the product research data is indistinguishable from "user skipped" -- you lose the signal of "user engaged but chose nothing" vs. "user didn't engage."

**Recommended fix:** Either (a) treat "Continue with no selections" the same as "Skip" (no API call), or (b) add a visual nudge ("You haven't selected anything -- skip or choose") before firing.

---

**m-5: Question counter shows incorrect numbers for segmentation questions**

In quiz.astro line 81: `{q.phase === 'segmentation' ? 'Before We Begin' : \`Question ${i > 1 ? i - 1 : i + 1} of 10\`}`. The ternary `i > 1 ? i - 1 : i + 1` produces correct "Before We Begin" for seg questions (indices 0, 1), but for the first scored question (index 2) it shows "Question 1 of 10" (2 - 1 = 1), which is correct. However, this arithmetic is fragile and tightly coupled to the assumption that exactly 2 segmentation questions come first. If question order changes, it breaks silently.

**Recommended fix:** Compute the scored question number directly from the data rather than relying on index arithmetic.

---

### Notes

**N-1: Analytics fires `generate_lead` for skip-path users on the results page**

In `quiz.astro` lines 990-994, the `generate_lead` GA4 event fires unconditionally in `revealResults()`, including for skip-path users who have NOT provided an email. This inflates lead counts. The `email_captured` event (line 1085) correctly fires only when email is provided, but `generate_lead` is the standard GA4 event for lead tracking and its over-counting could mislead conversion analysis.

**Recommended fix:** Gate the `generate_lead` event behind `if (state.email)`.

---

**N-2: Cookie `max-age` is 30 days -- may be too short for a pre-Kickstarter funnel**

The `thf_sub` cookie has `max-age=2592000` (30 days). The Kickstarter launch is August 8, 2026 -- roughly 4.5 months away. Users who take the quiz now will lose journey page access before launch. They would need to re-enter their email, but the journey page gate form does not pre-fill or recognize existing Loops.so subscribers.

**Recommended fix:** Extend `max-age` to at least 180 days (15552000), or match it to the Kickstarter launch timeline.

---

**N-3: The calculating interstitial serves a purpose beyond theater**

The 2.5-second calculating phase (lines 660-683) is well-calibrated. It is long enough to create anticipation without frustrating impatient users. The three rotating phrases maintain the mystical tone. This is a UX strength -- it makes the result feel earned.

---

**N-4: Product research tone is well-matched to the mystical context**

"Shape the Deck" and "Two questions to guide the creation" (lines 297-300) read naturally in the mystical voice. "What speaks to you for the card backs?" is an excellent question phrasing that avoids breaking the fourth wall into market research language. The "I trust the artist's vision" option is a smart default for users who don't have a strong preference. This is a UX strength.

---

## Summary

The email gate is well-positioned in the emotional arc (after questions, before reveal), and the skip path with re-capture is a thoughtful design that respects user autonomy while maintaining a second conversion opportunity. The journey page's optimistic reveal pattern is good UX -- it prioritizes content access over API success.

The most significant issues are structural: the single-archetype cookie (`thf_sub`) creates a lossy state model that will cause real user confusion as the funnel scales; the share-section visibility bug means the product research flow does not actually gate access to the share/journey CTAs, defeating its intended purpose; and the double API call pattern (initial submission + product research re-submission) is fragile against the rate limiter. The silent failure of fire-and-forget API calls on the re-capture path creates an invisible funnel leak where users believe they have subscribed but no record exists.

Fix M-2 (share-section visibility) first -- it is the simplest change with the highest impact on the product research completion rate. Then address C-1 (re-capture silent failure) and M-1 (single-archetype cookie) to close the most significant funnel leaks.
