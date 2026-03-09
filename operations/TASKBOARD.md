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

### GA4 Data API Research + Skill Alignment

**Brief:** Scrape the GA4 Data API documentation, produce a comprehensive reference guide (like loops-api-reference.md), build a smoke-test script for the service account JWT auth flow, and align the weekly-report skill against verified specs. Resolves deferred finding F-02.

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Scrape GA4 Data API docs + write reference guide | `pending` | deep-research skill. Target: `operations/ga4-api-reference.md` |
| 2 | Build GA4 auth smoke-test script | `pending` | Node script: JWT construction → OAuth2 token exchange → minimal runReport call. dep: Phase 1 |
| 3 | Align weekly-report skill against verified specs | `pending` | Fix any incorrect GA4 references, add correct auth procedure. dep: Phase 1 |
| 4 | Validate smoke-test with live credentials | `pending` | Run script against operator's GA4 property. dep: Phase 2 |

**Handoff Context:**
Task created 2026-03-08. GA4 credentials already in .env (GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_KEY as base64). Loops.so reference guide complete and aligned — this is the same pattern for the remaining API dependency.

---

## Ideas

[Empty — triaged on 2026-03-07. "Shareable archetype cards" folded into Share CTA backlog item. Remaining 5 ideas (Living Quiz, MDX email collections, progressive reveal, Supabase CRM, always-on monitoring) recorded to memory DB as future directions.]

---

## Backlog

- ~~**Marketing pipeline replacement**~~ — PROMOTED TO ACTIVE TASK
- ~~**Quiz result-before-signup flow**~~ — FOLDED INTO ACTIVE TASK (Phase 3)
- ~~**Kickstarter launch sequence pipeline**~~ — FOLDED INTO website automation skills (launch-sequence skill)
- ~~**Share CTA & OG meta tags (viral loop)**~~ — PROMOTED TO ACTIVE TASK
- ~~**Website automation skills (5 skills)**~~ — PROMOTED TO ACTIVE TASK (Sprint Phase 6-9)
- **Hermes Slack bot bridge (v1)** — LIVES IN SEPARATE REPO (hermes project). Basic Slack App (Socket Mode) + Node.js listener + `claude -p` integration. Enables @Hermes mentions in Slack to trigger Claude Code with subscription auth (no API costs). Expansion path: thread awareness → skill routing → project context detection → always-on monitoring. Blocked by: Slack App creation (operator task).
- **Infrastructure hardening** — Playwright CI integration (ARCH-03): migrate to `@playwright/test`, add `playwright.config.ts`, add `e2e` npm script so E2E tests run in CI. Content Security Policy (ADV-01): add CSP headers via `vercel.json`, start with report-only mode, monitor 2 weeks before enforcing. Both are High-severity deferred findings from hardening-2026-03-08.
- **Quiz code quality refactoring** — Extract quiz.astro script block into modules (ARCH-04): share CTA logic → `src/lib/share-utils.ts`. Reduce `as` casts with null-safe DOM helpers (ARCH-08). Extract shared ShareButtons.astro component (ARCH-09). Add GA4 share event contract tests with gtag mock (TCF-03, High priority). Improve test coverage: slug edge cases (TCF-06), condition-based E2E waits (TCF-07), multi-page canonical checks (TCF-08), all-archetype structural checks (TCF-09), clipboard feedback test (TCF-10). All deferred from hardening-2026-03-08.
- **Skill API integration specs** — ~~Loops.so (F-10): COMPLETED 2026-03-08~~ — reference guide at `operations/loops-api-reference.md`, 3 skills aligned. Remaining: GA4 Data API (F-02) — PROMOTED TO ACTIVE TASK.
- **Skill suite consistency pass** — Standardize conventions across all 5 automation skills. Git operations in approval gates (F-14), failure handling pattern for external deps (F-16), mkdir -p before writes (F-20), procedure structure convention (F-21), emoji usage in Slack templates (F-22), output path conventions (F-23), "(standard)" commit gate wording (F-25), remove local file paths from Slack messages (F-26). 8 Medium findings from eval-skills-2026-03-08.
- **Skill content polish** — Individual skill improvements: add quiz result pages to audit-site site map (F-17), add procedure branches for all 5 content source types in social-blast (F-18), specify launch banner design in launch-sequence Page Update Mode (F-19), cross-reference brand voice between publish-post and social-blast (F-24). 4 Medium findings from eval-skills-2026-03-08.
- Clean up stale feature branches (page-quiz-embed, feature/faq-and-blog, feature/seobot-integration, etc.)
- **Skill outputs dashboard** — Authenticated subdomain (e.g., `ops.thehermeticflight.com`) with login that surfaces outputs from all 5 automation skills: SEO audit scores + history, published blog posts, social media draft queue, weekly report KPIs, and launch sequence checklist/countdown. Allows operator to confirm skill outputs without digging through `operations/` files. Tech TBD (Astro SSR + Vercel auth, or lightweight admin framework).
- Add README with setup/run instructions
