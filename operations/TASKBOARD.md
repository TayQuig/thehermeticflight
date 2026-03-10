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

### Sprint Roadmap — Pre-Launch (target: 8/8/26 Kickstarter)

**Brief:** Execute 6 sprints of parallel work across the full backlog, organized by
launch leverage with maximum intra-sprint parallelism. All 8 required plan docs
and 4 API reference guides are written. Ready for execution.

**Roadmap plan:** `docs/plans/2026-03-09-sprint-roadmap.md`

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Write sprint roadmap + organize backlog into 6 sprints | `completed` | `docs/plans/2026-03-09-sprint-roadmap.md` |
| 2 | Scrape API references (PageSpeed, Supabase, Playwright, Vercel GH Actions) | `completed` | 4 guides in `operations/*-reference.md` |
| 3 | Write 8 detailed plan docs with FTF/eval/harden gates | `completed` | All at `docs/plans/2026-03-09-*.md` |
| 4 | Execute Sprint 1: Foundation & Quick Wins (3 parallel tracks) | `completed` | All 3 tracks merged, 381/381 tests pass, build clean |
| 5 | Execute Sprint 2: Growth Features (3 parallel tracks) | `pending` | 2A: journey pages, 2B: countdown, 2C: daily draw |
| 6 | Execute Sprint 3: Operational Visibility (4 parallel tracks) | `pending` | Skills: site-monitor, perf-audit, funnel analytics, WCAG |
| 7 | Execute Sprint 4: Code Quality & Skill Hardening (2 tracks) | `pending` | 4A: quiz refactoring, 4B: skill polish |
| 8 | Execute Sprint 5: Externally-Blocked Features (staggered) | `pending` | 5A: gallery (art ~May), 5B: waitlist (Supabase), 5C: content calendar (~June) |
| 9 | Execute Sprint 6: Platform Expansion | `pending` | Hermes bot (separate repo), skill dashboard (tech TBD) |

**Handoff Context (2026-03-09):** Sprint 1 code complete. 3 tracks merged into
feature/native-quiz-pipeline (381/381 Vitest, build clean). PR #4 open against
main: https://github.com/TayQuig/thehermeticflight/pull/4

**BLOCKER — quiz email submission 500 on Vercel preview.** Vercel function logs
show "LOOPS_API_KEY not configured" despite the key being set in Vercel env
vars (All Environments). Attempted fix: added `process.env.LOOPS_API_KEY`
fallback alongside `import.meta.env.LOOPS_API_KEY` in quiz-submit.ts:267 —
still failing after redeploy. Root cause is likely Astro + Vercel adapter not
passing env vars to the serverless function runtime. Next steps to debug:
1. Check Astro Vercel adapter docs for env var handling in server endpoints
2. Try `process.env` alone (remove `import.meta.env` entirely)
3. Check if `astro.config.mjs` needs env var forwarding config
4. Inspect the built serverless function in `.vercel/output/` to see if the
   env var reference was replaced or preserved

**Operator tasks completed this session:**
- Bizbounce added as collaborator to TayQuig/thehermeticflight repo
- Loops.so: created `quiz_completed` event + contact properties (archetype,
  source, experienceLevel, painPoint, flowState, cardBackPref, productInterest)
- LOOPS_API_KEY already set in Vercel env vars (All Environments)
- Mailchimp launch sequence tagger archived to operations/archive/

**CSP monitoring (report-only, not blocking):** Console shows violations for
`capi-automation.s3.us-east-2.amazonaws.com` (Meta CAPI script-src),
`form-action` for facebook.com/tr/ and googletagmanager.com, additional
connect-src and frame-src gaps. All expected — catalog for CSP update before
enforcing mode.

**Still needed before merge:**
- Fix the LOOPS_API_KEY env var issue (blocker)
- GitHub secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID (for CI)
- Verify full quiz flow end-to-end on preview

Sprint 2 blocked on content provisions. Next unblocked: Sprint 3 (skill
authoring) or Sprint 4 (quiz refactoring, skill polish).

---

## Ideas

[Empty]

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
- **Kickstarter Countdown Page** — Plan: `docs/plans/2026-03-09-kickstarter-countdown.md` (5 tasks). `/launch` page, Loops.so notify CTA. Blocked on: pledge tier content from operator.
- **Daily Card Draw** — Plan: `docs/plans/2026-03-09-daily-card-draw.md` (5 tasks). Client-side deterministic draw. Blocked on: 78-card tarot data from operator.

### Sprint 3 — Operational Visibility (April–May)

- **Site Uptime & Deploy Monitoring** — No plan doc (skill authoring). New `site-monitor` skill.
- **Performance Budget / Core Web Vitals** — No plan doc (skill authoring). Ref: `operations/pagespeed-api-reference.md`.
- **Subscriber Funnel Analytics** — No plan doc (skill enhancement). Note: Loops.so has no bulk contact API — needs local counter approach.
- **Accessibility Audit (WCAG)** — No plan doc (skill extension to audit-site).

### Sprint 4 — Code Quality & Skill Hardening (May)

- **Quiz code quality refactoring** — Plan: `docs/plans/2026-03-09-quiz-refactoring.md` (7 tasks). 10 deferred findings from hardening-2026-03-08.
- **Skill suite consistency pass + content polish** — No plan doc (skill file edits). 12 deferred findings from eval-skills-2026-03-08.

### Sprint 5 — Externally-Blocked Features (May–July, staggered)

- **Card Gallery (Progressive Reveal)** — Plan: `docs/plans/2026-03-09-card-gallery.md` (6 tasks). Date-gated at build time. Blocked on: card art delivery (~late May).
- **Referral Waitlist** — Plan: `docs/plans/2026-03-09-referral-waitlist.md` (7 tasks). Supabase backend. Ref: `operations/supabase-js-reference.md`. Blocked on: Supabase project creation (operator).
- **Content Calendar / Editorial Orchestration** — No plan doc (skill authoring). Needed by ~June 2026.

### Sprint 6 — Platform Expansion (June–July)

- **Hermes Slack bot bridge (v1)** — Separate repo. Blocked on: Slack App creation (operator).
- **Skill outputs dashboard** — Tech TBD. Lowest priority.

### Completed / Absorbed

- ~~**Marketing pipeline replacement**~~ — COMPLETED
- ~~**Quiz result-before-signup flow**~~ — FOLDED INTO marketing pipeline (Phase 3)
- ~~**Kickstarter launch sequence pipeline**~~ — FOLDED INTO website automation skills (launch-sequence skill)
- ~~**Share CTA & OG meta tags (viral loop)**~~ — COMPLETED + HARDENED
- ~~**Website automation skills (5 skills)**~~ — COMPLETED + EVALUATED
- ~~**Skill API integration specs**~~ — Loops.so COMPLETED. GA4 Data API COMPLETED.
- ~~**Sprint planning + plan docs**~~ — COMPLETED 2026-03-09. 8 plans + 4 references.
