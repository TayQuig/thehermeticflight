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

### Email Gate Enforcement + Post-Results Product Research

**Brief:** Make the email gate actually gate journey content (two-layer soft gate
with cookie), add 2 product research questions (card backs, product interest)
after archetype reveal.

**Plan:** `docs/plans/2026-03-19-email-gate-product-research.md`

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Content Approval (HUMAN GATE) | `pending` | Operator approves PR01/PR02 question text + tone |
| 2 | Quiz Results Gating + Product Research UI [FTF] | `pending` | dep: Phase 1. quiz.astro: split results, email re-capture, product research, cookie. plan: docs/plans/2026-03-19-email-gate-product-research.md |
| 3 | API Update for Product Research [FTF] | `pending` | dep: Phase 2. quiz-submit.ts: productResearch field. Parallel with Phase 4. |
| 4 | Journey Page Gating [FTF] | `pending` | dep: Phase 2. archetype/[slug].astro: cookie-based gating. Parallel with Phase 3. |
| 5 | Integration Testing | `pending` | dep: Phases 3+4. Full E2E flow verification. |
| 6 | Eval Protocol (2 evaluators) | `pending` | dep: Phase 5. UX Funnel + Functional. |

**Handoff Context:** Plan written and reviewed (READY TO BUILD). Phase 1 is a
HUMAN GATE — operator must approve product research question text before build
phases can begin.

**Paused task:** Sprint Roadmap — Pre-Launch (6/8 phases complete). Phases 7-8
externally blocked until May-July. Resume when blockers clear.

**Carried:** CSP violations (report-only), Meta Pixel custom event warnings,
favicon 404s, GitHub CI secrets needed. Journaling prompts are AI-generated
placeholders — review before launch.

---

## Ideas

- **Self-select "choose your path" may cause decision fatigue.** Operator observation — no action for now. Monitor post-launch for drop-off at self-select step vs direct results. If drop-off is significant, consider removing self-select and defaulting to top archetype regardless of confidence.

---

## Backlog

> Organized into 6 sprints per `docs/plans/2026-03-09-sprint-roadmap.md`.
> Items within a sprint are parallelizable (separate worktrees, no file overlap).
> Sprints are ordered by launch leverage. Plan doc status noted per item.

### Sprint 1 — Foundation & Quick Wins (March)

- **Thank-you → Result Page Redirect** — Plan: `docs/plans/2026-03-09-thank-you-redirect.md` (4 tasks). Fix stale thank-you page, link to archetype result page.
- **Infrastructure hardening** — Plan: `docs/plans/2026-03-09-infrastructure-hardening.md` (7 tasks). Playwright CI + CSP headers. Refs: `operations/playwright-test-reference.md`, `operations/vercel-github-actions-reference.md`.
- **Housekeeping** — No plan doc needed. Clean up stale branches + add README.

### Sprint 2 — Growth Features (March–April)

- **Archetype Journey Pages** — Plan: `docs/plans/2026-03-09-archetype-journey-pages.md` (7 tasks). Astro Content Collections, 6 deep-dive pages. Blocked on: archetype report PDFs from operator.
- ~~**Kickstarter Countdown Page**~~ — COMPLETED 2026-03-14. `/launch` page with real tier data, countdown timer, launch-notify API.
- ~~**Daily Card Draw**~~ — COMPLETED 2026-03-14. `/daily` page with 78-card data module, deterministic PRNG, card flip animation.

### Sprint 3 — Operational Visibility (April–May)

- **Email Drip Sequence Testing (6 archetypes)** — Plan doc needed. Operator provides email content → verify each archetype triggers correct Loops.so sequence, emails deliver with correct content/timing, edge cases (resubmission, multiple archetypes) handled. Content source: `src/data/email-sequences.json`. BLOCKED — file not yet created on disk.
- **Autoresearch Eval Harness** — Plan doc needed. Build reusable GA4 metric-pulling scripts (quiz_started rate, journey_subscribe rate, share rate) and Loops.so webhook-based open/click tracking (local SQLite counters, since Loops.so lacks bulk analytics API). Foundation for all optimization loops in Sprint 6+. Ref: `operations/ga4-api-reference.md`.
- **Site Uptime & Deploy Monitoring** — No plan doc (skill authoring). New `site-monitor` skill.
- **Performance Budget / Core Web Vitals** — No plan doc (skill authoring). Ref: `operations/pagespeed-api-reference.md`. Note: CWV scores via PageSpeed API have instant feedback — candidate for autoresearch loop (artifact: page layout/asset config, metric: LCP/CLS/FID, ~100 iterations overnight).
- **Subscriber Funnel Analytics** — No plan doc (skill enhancement). Note: Loops.so has no bulk contact API — needs local counter approach (shared with eval harness above).
- **Accessibility Audit (WCAG)** — No plan doc (skill extension to audit-site).

### Sprint 4 — Code Quality & Skill Hardening (May)

- ~~**Quiz code quality refactoring**~~ — ABSORBED by Quiz Design Overhaul (2026-03-19). Full rewrite eliminates all 10 deferred findings.
- **Skill suite consistency pass + content polish** — No plan doc (skill file edits). 12 deferred findings from eval-skills-2026-03-08.

### Sprint 5 — Externally-Blocked Features (May–July, staggered)

- **Card Gallery (Progressive Reveal)** — Plan: `docs/plans/2026-03-09-card-gallery.md` (6 tasks). Date-gated at build time. Blocked on: card art delivery (~late May).
- **Referral Waitlist** — Plan: `docs/plans/2026-03-09-referral-waitlist.md` (7 tasks). Supabase backend. Ref: `operations/supabase-js-reference.md`. Blocked on: Supabase project creation (operator).
- **Content Calendar / Editorial Orchestration** — No plan doc (skill authoring). Needed by ~June 2026.

### Sprint 6 — Platform Expansion (June–July)

- **Hermes Slack bot bridge (v1)** — Separate repo. Blocked on: Slack App creation (operator).
- **Skill outputs dashboard** — Tech TBD. Needs its own backlog once tech is chosen. Will surface data from all cron-driven workflows below.
- **A/B Creative Testing Pipeline (autoresearch pattern)** — Reframed as Karpathy autoresearch loop. Artifact: `creative-variants.json` (headline, body, image, CTA, target archetype). Eval harness: Meta Marketing API → CTR or cost-per-quiz-start. `creative-program.md` enforces single-variable-per-iteration constraint. Git ratchet → SQLite creative state. Claude + cron + Meta Marketing API. 3 cron jobs: (1) Claude generates creative variants from archetype data → Telegram approval, (2) shell script deploys approved ads via Meta API, (3) daily metrics pull → Claude judges pause/promote → Slack digest. Dashboard integration required. Blocked on: Meta Marketing API access token, dashboard tech decision. Ref: [karpathy/autoresearch](https://github.com/karpathy/autoresearch).
- **Email Subject Line Optimization Loop (autoresearch)** — Per-archetype hill-climbing on drip sequence subject lines + preview text. 6 archetypes = 6 parallel loops. Artifact: subject line config per archetype. Eval: open rate via Loops.so webhook counters (from eval harness). Winning patterns in one archetype become hypotheses for others. ~2-3 iterations/week/archetype. Depends on: eval harness (Sprint 3), email drip sequences live (Sprint 3).
- **Quiz Intro Copy Optimization Loop (autoresearch)** — Hill-climbing on quiz landing page headline, subheadline, CTA button text. Artifact: intro copy section of `/quiz`. Eval: `quiz_started / page_sessions` (GA4). Constraint: modify only intro copy, nothing downstream. Traffic-gated — needs minimum sessions threshold per test window. Depends on: eval harness (Sprint 3).
- **Journey Page CTA Optimization Loop (autoresearch)** — Per-archetype CTA copy testing on `/archetype/[slug]` pages. Artifact: CTA section copy. Eval: `journey_subscribe` conversion rate (GA4). Can run 6 parallel per-archetype variants. Depends on: eval harness (Sprint 3).

### Autoresearch Loops (Future — traffic/data gated)

- **Retargeting campaigns for quiz completers who didn't subscribe.** The `QuizCompleted` custom event (GA4 + Meta pixel) creates an audience of high-intent non-converters. Test alternate offers: deck-forward, content pull, social proof. Per-archetype creative segmentation once audience is large enough.
- **Core Web Vitals autoresearch loop.** PageSpeed API gives instant feedback — the only loop that can run 100+ iterations overnight. Artifact: page layout, asset loading, image config. Metric: LCP/CLS/FID. Could fold into Sprint 3 Performance Budget or run standalone.
- **Daily card draw engagement optimization.** Test share CTA copy, card reveal animation timing, journaling prompt framing on `/daily`. Metric: `share_rate`. Traffic-gated.
- **OG image variant testing.** Test social card images per archetype. Metric: referral traffic. Slow feedback — needs share volume.
- **Blog title / meta description SEO loop.** Metric: organic CTR from Google Search Console API. Low leverage pre-launch, high post-launch.
- **Email send timing optimization.** Day/hour optimization per archetype. Metric: open rate by send time. Needs cohort accumulation.
- **Quiz question wording optimization.** Metric: `quiz_completed / quiz_started`. **Guardrail:** archetype distribution shift > ±5% → auto-discard. Higher risk loop.
- **Archetype result page copy optimization.** Metric: share_rate + journey_subscribe_rate. Medium leverage — funnel conversion-to-advocacy pivot.
- **Kickstarter page copy optimization.** Post-launch only. Metric: pledge conversion rate. High leverage.
- **Journaling prompt quality loop.** Currently AI-generated placeholders. Metric: 7-day return visitor rate. Low leverage pre-launch.

### Completed / Absorbed

- ~~**Marketing pipeline replacement**~~ — COMPLETED
- ~~**Quiz result-before-signup flow**~~ — FOLDED INTO marketing pipeline (Phase 3)
- ~~**Kickstarter launch sequence pipeline**~~ — FOLDED INTO website automation skills (launch-sequence skill)
- ~~**Share CTA & OG meta tags (viral loop)**~~ — COMPLETED + HARDENED
- ~~**Website automation skills (5 skills)**~~ — COMPLETED + EVALUATED
- ~~**Skill API integration specs**~~ — Loops.so COMPLETED. GA4 Data API COMPLETED.
- ~~**Sprint planning + plan docs**~~ — COMPLETED 2026-03-09. 8 plans + 4 references.
