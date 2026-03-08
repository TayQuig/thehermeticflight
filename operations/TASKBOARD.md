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

### Sprint: Harden + Website Automation — 2 Items

**Brief:** Parallel sprint. (A) Complete hardening on the share/OG viral loop code. (B) Build 5 website automation skills (audit-site, publish-post, social-blast, weekly-report, launch-sequence). Zero shared state — hardening touches repo quiz code; skills live in `~/.claude/skills/`.

| # | Phase | Source | Status | Notes |
|---|-------|--------|--------|-------|
| 1 | OG meta tag infrastructure + Layout.astro | Share CTA | `completed` | OG/Twitter Card meta tags added. Canonical URL fixed to www. 261 tests pass. `toUrlSlug` + `archetypeByUrlSlug` utilities added. |
| 2 | Static archetype result pages + share CTA | Share CTA | `completed` | 6 result pages at `/quiz/result/[archetype]` with share buttons (X/Facebook/copy). quiz.astro success message now shows share CTA. 261 tests pass. |
| 3 | OG images + share event tracking | Share CTA | `completed` | 7 placeholder OG PNGs (1200x630) created. GA4 share events on quiz.astro and result pages. Build succeeds, 261 tests pass. |
| 4 | Build verification + Playwright tests | Share CTA | `completed` | 5 Playwright E2E tests pass (OG tags, result pages, share buttons, quiz flow, canonical URL). 261 unit tests pass. 6 result pages in sitemap. Build succeeds. |
| 5 | Harden — evaluation + remediation | Share CTA | `completed` | 4 evaluators, 9 findings (3 High, 6 Medium), 11 deferred. All 9 remediated. 341 tests pass. Verification playbook at operations/hardening-2026-03-08/. |
| 6 | Scaffold skill directories + build audit-site | Automation | `completed` | 5 dirs created. audit-site SKILL.md written (166 lines). Verified frontmatter. |
| 7 | Build publish-post + social-blast skills | Automation | `completed` | publish-post (161 lines) + social-blast (164 lines) written. operations/social/ dir created. |
| 8 | Build weekly-report + launch-sequence skills | Automation | `completed` | weekly-report (195 lines) + launch-sequence (220 lines) written. operations/reports/ + launch-emails/ dirs created. |
| 9 | Validate all 5 skills end-to-end | Automation | `pending` | Dry-run each skill, fix issues. dep: Phases 6-8. |

**Plans:**
- Share CTA: `docs/plans/2026-03-07-share-cta-og-tags.md`
- Automation: `docs/plans/2026-03-07-website-automation-skills.md`

**Handoff Context:**
Sprint created 2026-03-07. Phases 1-5 (Share CTA) and 6-8 (skill builds) completed. Skills evaluated via 3-evaluator convergence analysis (eval-skills-2026-03-08): 35 raw findings → 12 remediated, 14 deferred. All 12 verified PASS by independent verifier. Key safety fixes: no .env Read (grep only), Loops.so broadcast → manual dashboard workflow, CONFIRM SCHEDULE gate for email scheduling, all audit-site fixes require approval, @mention tag in all Slack templates. Phase 9 (validation dry-run) is the only remaining phase.

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
- **Skill API integration specs** — Research and document GA4 Data API auth flow (F-02: JWT construction, OAuth2 token exchange, curl commands) and Loops.so contacts API (F-10: auth header, query params, filtering by archetype, period-based metrics). Both are Critical/High but deferred because they have manual fallbacks. Do when operator configures credentials. Deferred from eval-skills-2026-03-08.
- **Skill suite consistency pass** — Standardize conventions across all 5 automation skills. Git operations in approval gates (F-14), failure handling pattern for external deps (F-16), mkdir -p before writes (F-20), procedure structure convention (F-21), emoji usage in Slack templates (F-22), output path conventions (F-23), "(standard)" commit gate wording (F-25), remove local file paths from Slack messages (F-26). 8 Medium findings from eval-skills-2026-03-08.
- **Skill content polish** — Individual skill improvements: add quiz result pages to audit-site site map (F-17), add procedure branches for all 5 content source types in social-blast (F-18), specify launch banner design in launch-sequence Page Update Mode (F-19), cross-reference brand voice between publish-post and social-blast (F-24). 4 Medium findings from eval-skills-2026-03-08.
- Clean up stale feature branches (page-quiz-embed, feature/faq-and-blog, feature/seobot-integration, etc.)
- Add README with setup/run instructions
