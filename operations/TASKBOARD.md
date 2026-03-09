# TASKBOARD

## Protocol

This file tracks task continuity across sessions. It has three sections
below: Active Task (one at a time), Ideas (scratch pad cleared on task
completion), and Backlog (persistent future work). The taskboard skill reads
this file at session start and reports current state to the operator.

### Rules

1. **One active task.** If a new task arrives while one is in progress, finish
   or explicitly pause the current task first.

2. **Phase granularity.** Each phase should be completable in a single session.
   3-7 phases is the sweet spot.

3. **Update in real time.** Mark phases in_progress when starting, completed
   when done. Update Handoff Context at end of every session.

4. **Blocked phases.** Mark as blocked and note why. Next session checks
   whether the blocker has resolved.

5. **Ideas stay in Ideas.** Don't expand the active task to accommodate new
   thoughts. Capture them in the Ideas section and triage on task completion.

6. **Completion flow.** When all phases are completed: triage Ideas with the
   operator, append task summary to task-archive.md, clear Active Task and
   Ideas sections, leave Backlog intact.

7. **Archive format:**
   ```
   ---
   ## [Task name]
   **Completed:** [Date]
   **Phases:** [Count completed / count total]
   **Summary:** [2-3 sentences on what was accomplished and key decisions.]
   **Files touched:** [List of files created or modified]
   ---
   ```

8. **Empty board.** No Active Task section means the previous task was
   completed. Check Ideas and Backlog, then ask the operator what's next.

9. **Backlog persists.** The Backlog section is never cleared automatically.
   Items leave only when promoted to Active Task or explicitly removed by
   the operator.

---

## Active Task

[Empty — no task in progress.]

---

## Ideas

[Empty]

---

## Backlog

> Ordered by leverage toward 8/8/26 Kickstarter launch. Growth features first,
> infrastructure mid-pack, internal polish and housekeeping at the tail.

- **Archetype Journey Pages** — Expand each quiz result archetype into a rich deep-dive page: affiliated cards, recommended spreads, journaling prompts, curated blog posts, archetype population stats. Operator has description docs ready as content source. Deepens engagement for every quiz-taker, strong long-tail SEO potential. No card art dependency.
- **Kickstarter Countdown Page** — Dedicated `/launch` page: animated countdown timer to 8/8/26, pledge tier previews, stretch goal teaser, social proof strip (list size, quiz completions), "Notify Me" CTA → Loops.so `launch_notify` event, KS-specific FAQ excerpt. Canonical URL for all pre-launch marketing.
- **Thank-you → Result Page Redirect** — `thank-you.astro` is stale: shows "COMING SOON" for revelation date, doesn't link to the user's archetype result page. The viral loop (share buttons) only lives on `/quiz/result/[archetype]` — every quiz completer who stops at thank-you never sees the share CTA. Fix: pass archetype via query param or session, redirect or deep-link to result page. Small scope, high conversion impact.
- **Daily Card Draw** — Interactive `/daily` page: card-flip animation, date-seeded deterministic draw (everyone sees the same card each day), interpretation + journaling prompt, share button. Pre-reveal mode shows card back + text only; post-reveal shows art. Drives repeat visits and daily CTA impressions. Entirely client-side, no backend.
- **Infrastructure hardening** — Playwright CI integration (ARCH-03): migrate to `@playwright/test`, add `playwright.config.ts`, add `e2e` npm script so E2E tests run in CI. Content Security Policy (ADV-01): add CSP headers via `vercel.json`, start with report-only mode, monitor 2 weeks before enforcing. Both are High-severity deferred findings from hardening-2026-03-08. Needed before traffic surge from growth features.
- **Site Uptime & Deploy Monitoring** — New `site-monitor` skill. Probes key endpoints (homepage, `/quiz`, `/api/quiz-submit`, all 6 result pages) via fetch, checks HTTP status + response time. Optionally checks Vercel deployment status via API. Alerts to Slack `#the-hermetic-flight` on any failure or degradation. No new credentials needed (public endpoint checks). Critical gap: zero operational visibility currently — a broken quiz during Kickstarter traffic surge would go undetected. Pairs with infrastructure hardening.
- **Performance Budget / Core Web Vitals** — New `perf-audit` skill or extension to `audit-site`. Hits PageSpeed Insights API (free, no auth) for each page. Tracks LCP, CLS, INP scores across mobile + desktop. Saves historical scores to `operations/perf/`. Flags regressions. Directly impacts SEO ranking (CWV is a Google ranking signal) and quiz completion rates on mobile. Check OG image sizes (7 placeholder PNGs at 1200x630 may be unoptimized).
- **Card Gallery (Progressive Reveal)** — `/gallery` page that starts empty and populates on a scheduled cadence (~late May through launch). Each reveal = filterable grid entry with card name, meaning, aerial connection. Individual card OG images for social sharing. Full gallery unlocked on launch day. Needs art assets delivered on schedule.
- **Referral Waitlist** — Viral growth mechanics: unique referral link after quiz completion, `/waitlist` status page (position, referrals, tier). Integration with Loops.so referral events. Requires small backend (Supabase/Vercel KV) for referral tracking. Reward tiers deferred — core referral mechanics first.
- **Subscriber Funnel Analytics** — New `list-health` skill or enhancement to `weekly-report`. Queries Loops.so Contacts API for segment counts by archetype, growth rate week-over-week, and engagement metrics (open/click rates on drip sequences). Surfaces: total subscribers, archetype distribution, unsubscribe/bounce rate, drip sequence performance. Answers "is the funnel actually working end-to-end?" Depends on Loops.so API capabilities (reference guide at `operations/loops-api-reference.md`).
- **Content Calendar / Editorial Orchestration** — New `content-calendar` skill. Maintains schedule in `operations/content-calendar.json`. Coordinates the publish-post → social-blast → email draft sequence with proper spacing. Tracks planned vs. published content. Presents "this week's content" summary to Slack. Becomes critical during 4-week launch countdown when blog posts, social blasts, and email broadcasts interleave. Not urgent now; must be ready by ~June 2026.
- **Accessibility Audit (WCAG)** — Extension to `audit-site` or standalone `a11y-audit` mode. Checks color contrast against Hermetic dark theme (gold-on-void, emerald-on-void), ARIA labels on quiz auto-advance interactions, keyboard navigation through multi-step flow, screen reader compatibility, focus management on archetype reveal. Legal importance (ADA compliance) and UX importance (inclusive design). Can fold into existing audit-site crawl loop.
- **Quiz code quality refactoring** — Extract quiz.astro script block into modules (ARCH-04): share CTA logic → `src/lib/share-utils.ts`. Reduce `as` casts with null-safe DOM helpers (ARCH-08). Extract shared ShareButtons.astro component (ARCH-09). Add GA4 share event contract tests with gtag mock (TCF-03, High priority). Improve test coverage: slug edge cases (TCF-06), condition-based E2E waits (TCF-07), multi-page canonical checks (TCF-08), all-archetype structural checks (TCF-09), clipboard feedback test (TCF-10). All deferred from hardening-2026-03-08.
- **Skill suite consistency pass** — Standardize conventions across all 5 automation skills. Git operations in approval gates (F-14), failure handling pattern for external deps (F-16), mkdir -p before writes (F-20), procedure structure convention (F-21), emoji usage in Slack templates (F-22), output path conventions (F-23), "(standard)" commit gate wording (F-25), remove local file paths from Slack messages (F-26). 8 Medium findings from eval-skills-2026-03-08.
- **Skill content polish** — Individual skill improvements: add quiz result pages to audit-site site map (F-17), add procedure branches for all 5 content source types in social-blast (F-18), specify launch banner design in launch-sequence Page Update Mode (F-19), cross-reference brand voice between publish-post and social-blast (F-24). 4 Medium findings from eval-skills-2026-03-08.
- **Hermes Slack bot bridge (v1)** — LIVES IN SEPARATE REPO (hermes project). Basic Slack App (Socket Mode) + Node.js listener + `claude -p` integration. Enables @Hermes mentions in Slack to trigger Claude Code with subscription auth (no API costs). Expansion path: thread awareness → skill routing → project context detection → always-on monitoring. Blocked by: Slack App creation (operator task).
- **Skill outputs dashboard** — Authenticated subdomain (e.g., `ops.thehermeticflight.com`) with login that surfaces outputs from all 5 automation skills: SEO audit scores + history, published blog posts, social media draft queue, weekly report KPIs, and launch sequence checklist/countdown. Allows operator to confirm skill outputs without digging through `operations/` files. Tech TBD (Astro SSR + Vercel auth, or lightweight admin framework).
- Clean up stale feature branches (page-quiz-embed, feature/faq-and-blog, feature/seobot-integration, etc.)
- Add README with setup/run instructions

### Completed / Absorbed

- ~~**Marketing pipeline replacement**~~ — PROMOTED TO ACTIVE TASK
- ~~**Quiz result-before-signup flow**~~ — FOLDED INTO ACTIVE TASK (Phase 3)
- ~~**Kickstarter launch sequence pipeline**~~ — FOLDED INTO website automation skills (launch-sequence skill)
- ~~**Share CTA & OG meta tags (viral loop)**~~ — PROMOTED TO ACTIVE TASK
- ~~**Website automation skills (5 skills)**~~ — PROMOTED TO ACTIVE TASK (Sprint Phase 6-9)
- ~~**Skill API integration specs**~~ — Loops.so COMPLETED 2026-03-08. GA4 Data API PROMOTED TO ACTIVE TASK.
