# Mastermind Report: Journey Page Access Control

**Date:** 2026-03-19
**Rounds:** 2
**Consensus:** Conditional

## The Idea

Should the journey page (/archetype/[slug]) enforce quiz completion as the ONLY path to accessing journey content, or should there be alternative access paths?

## Consensus Summary

The panel unanimously agrees: close the side door. The journey page's email gate form should be removed and replaced with a "Take the Quiz" CTA. The quiz is the only path to journey content. This aligns with the product's thematic identity (Hermeticism is an initiatory tradition — the quiz is the initiation), the industry-standard quiz funnel pattern (email captured between questions and results, not as a separate side door), and the operator's instinct.

The critical discovery of the deliberation was Safari ITP's 7-day cap on client-side cookies. The `thf_sub` cookie — currently set exclusively via `document.cookie` — silently expires after 7 days of user inactivity on all WebKit browsers (Safari desktop + every iOS browser, regardless of which browser app is used). This affects approximately 40-50% of the mobile audience. The fix is straightforward: set the cookie server-side via `Set-Cookie` header from `/api/quiz-submit`, which bypasses the ITP cap because Vercel serves both the site and the API from the same edge infrastructure. The client-side cookie is retained as an immediate fallback.

The second key improvement is a multi-slug cookie format (`thf_sub=air-weaver,shadow-dancer`) that prevents retaking the quiz from destroying access to previous archetype journeys. Combined with extending the cookie duration from 30 days to 180 days, these three changes (server-side setting, multi-slug, 180-day expiry) transform a fragile 7-day client-side token into a robust 180-day server-hardened access credential that survives retakes, device changes (via email drip links), and the full pre-launch runway through the August 8 Kickstarter.

## Agent Contributions

### Daydreamer
Proposed five alternative architectures — from hard-gate Hermetic Initiation to fully open Anti-Gate — that reframed the binary question into a spectrum. The most valuable insight was identifying two distinct user populations (quiz-takers vs. share-recipients) with different optimal access strategies. Recommended instrumenting side-door conversion quality before committing, and proposed progressive revelation as a post-launch evolution.

### Designer
Produced a precise structural analysis showing this is a single-file change to `[slug].astro` (~90 lines removed, ~20 added for quiz CTA). Identified four open design questions (return URL parameter, multi-archetype cookie, cookie max-age, footer CTA visibility) and recommended the simplest resolution for each. The component boundary diagram (before/after) clearly showed the system becomes simpler.

### Researcher
Verified three critical claims via primary sources. Safari ITP 7-day cap: VERIFIED per WebKit's official blog (ITP 2.1, 2019, still current). Server-side Set-Cookie bypass: VERIFIED with the condition that Vercel's same-domain architecture satisfies Safari 16.4's IP-matching requirement. Astro `cookies.set()` feasibility: VERIFIED with implementation guidance and a warning about Astro Issue #15076 (don't mix `cookies.set()` with manual `Set-Cookie` headers). Also provided Google Flexible Sampling evidence supporting the gated-content SEO pattern.

### Builder
Delivered a revised 4-phase implementation plan incorporating server-side cookies, multi-slug format, and 180-day expiry. Created a `cookie-helpers.ts` shared module with `parseCookieValue()` and `appendSlug()` pure functions. Identified the fire-and-forget timing consideration (server Set-Cookie arrives after client-side cookie) and confirmed this is safe because browsers process Set-Cookie from any fetch response. Net +100 lines — a reasonable investment for Safari ITP compliance.

### Devil's Advocate
Identified the Safari ITP vulnerability that would have broken the access model for ~40% of users. Lifted the BLOCK after server-side mitigation was confirmed feasible. Caught the server-client cookie race condition (R-10) in the multi-slug scenario — the server must read the existing cookie from the request's Cookie header and merge, not blindly overwrite. Downgraded SEO risk (R-02) from HIGH to MEDIUM after Researcher's structured data evidence. Final position: conditional agree with clear, implementable conditions.

## Conditions

**Must-have (from Devil's Advocate):**
- Server-side `Set-Cookie` on `/api/quiz-submit` success response with `Path=/; Max-Age=15552000; SameSite=Lax; Secure` (no `HttpOnly` — cookie must remain JS-readable)
- Multi-slug append-merge on server: read existing `thf_sub` from request Cookie header, parse slugs, append new, deduplicate, write merged value
- Client-side `setThfSubCookie()` retained as immediate fallback with same read-append-dedup logic
- 180-day `Max-Age` in all cookie-setting locations (server and client)

**Should-have:**
- Cookie renewal on journey page visit (re-set Max-Age on valid cookie read)
- Defensive multi-slug parsing: `.split(',').filter(Boolean)` everywhere; encode slugs individually, not the entire comma-separated string
- `isAccessibleForFree: false` structured data on journey pages for SEO clarity
- Safari iOS smoke test confirming server-set cookie persists beyond 7 days

## Research Artifacts

- `operations/mastermind-journey-page-access-control/scratch/round-1-researcher.md` — SEO analysis (Google Flexible Sampling, interstitials policy, cloaking policy), quiz funnel best practices, cookie duration standards, shared link patterns
- `operations/mastermind-journey-page-access-control/scratch/round-2-researcher.md` — Safari ITP fact-check (VERIFIED), Vercel Set-Cookie feasibility (VERIFIED), Astro cookies API implementation guidance

## Next Steps

- **Implement cookie infrastructure:** Create `src/lib/cookie-helpers.ts` with `parseCookieValue()` and `appendSlug()` pure functions + unit tests
- **Add server-side Set-Cookie to `/api/quiz-submit`:** Read existing cookie from request, append new archetype slug, set merged value via Set-Cookie header with 180-day Max-Age
- **Add server-side Set-Cookie to `/api/journey-subscribe`:** Same pattern for the email series form path
- **Update client-side cookie logic:** Modify `setThfSubCookie()` in `quiz.astro` and inline cookie set in `[slug].astro` to read-append-dedup with 180-day max-age
- **Update journey page gate check:** Change `[slug].astro` line 36 from `cookie.value !== urlSlug` to `!cookie.value.split(',').includes(urlSlug)`
- **Replace gate form with quiz CTA:** Remove email gate form from `[slug].astro`, add "Take the Quiz" CTA section, conditionally hide email series form and footer CTAs for gated visitors
- **Add `isAccessibleForFree: false` structured data** to journey page `<head>` for SEO compliance
- **Update E2E tests:** Rewrite `quiz-gate-e2e.spec.ts` Layer 2 tests for new gate behavior (quiz CTA instead of email form), add multi-slug cookie tests
- **Cookie renewal on visit:** Add `Astro.cookies.set()` in `[slug].astro` SSR path when valid cookie is read, refreshing Max-Age to 180 days
- **Safari smoke test:** Deploy to Vercel preview, verify on Safari iOS that server-set cookie survives >7 days
