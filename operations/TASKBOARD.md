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

### Share CTA & OG Meta Tags (Viral Loop)

**Brief:** Add shareable archetype result pages with OG previews + share buttons on quiz completion. Turns the quiz pipeline into a viral acquisition engine. Plan: `docs/plans/2026-03-07-share-cta-og-tags.md`.

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | OG meta tag infrastructure + Layout.astro | `completed` | OG/Twitter Card meta tags added. Canonical URL fixed to www. 261 tests pass. `grep -c 'og:title' dist/index.html` = 1. `toUrlSlug` + `archetypeByUrlSlug` utilities added. |
| 2 | Static archetype result pages + share CTA | `completed` | 6 result pages at `/quiz/result/[archetype]` with share buttons (X/Facebook/copy). quiz.astro success message now shows share CTA. 261 tests pass. |
| 3 | OG images + share event tracking | `in_progress` | Create 7 placeholder OG images (1200x630), add GA4 share events. Plan Tasks 5-6. Entry: `public/images/og/`. Pass: 7 PNGs exist, build succeeds. dep: Phase 2. |
| 4 | Build verification + Playwright tests | `pending` | Add result page + share CTA Playwright tests, full build verification, sitemap check. Plan Tasks 7-8. Entry: `tests/quiz-flow.spec.ts`. Pass: all unit + Playwright tests pass, 6 result pages in sitemap. dep: Phase 3. |
| 5 | Harden — evaluation + remediation | `pending` | Hardening sprint on new share/OG code. dep: Phase 4. |

**Handoff Context:**
Auto-promoted from backlog on 2026-03-07. Plan document reviewed and updated — 5 critical bugs fixed (stale `window.__quizArchetype` ref, file overwrite, Playwright framework mismatch, port mismatch, domain inconsistency). Known risks and failure triage added to all tasks. Hardening dependency (marketing pipeline Phase 6) is complete. Plan is READY TO BUILD.

---

## Ideas

[Empty — triaged on 2026-03-07. "Shareable archetype cards" folded into Share CTA backlog item. Remaining 5 ideas (Living Quiz, MDX email collections, progressive reveal, Supabase CRM, always-on monitoring) recorded to memory DB as future directions.]

---

## Backlog

- ~~**Marketing pipeline replacement**~~ — PROMOTED TO ACTIVE TASK
- ~~**Quiz result-before-signup flow**~~ — FOLDED INTO ACTIVE TASK (Phase 3)
- ~~**Kickstarter launch sequence pipeline**~~ — FOLDED INTO website automation skills (launch-sequence skill)
- ~~**Share CTA & OG meta tags (viral loop)**~~ — PROMOTED TO ACTIVE TASK
- **Website automation skills (5 skills)** — Build Claude Code skills to automate site management: audit-site (SEO/health), publish-post (content pipeline), social-blast (social media), weekly-report (analytics), launch-sequence (Kickstarter orchestration). Plan: `docs/plans/2026-03-07-website-automation-skills.md`. Deps: Skills 1-3 independent; Skills 4-5 benefit from marketing pipeline completion. Kickstarter launch sequence is now a mode within the launch-sequence skill. Note: Hermes Slack bot bridge (separate infra project) will enable Slack-triggered invocation of these skills via `claude -p`. No Zapier dependency — all native.
- **Hermes Slack bot bridge (v1)** — LIVES IN SEPARATE REPO (hermes project). Basic Slack App (Socket Mode) + Node.js listener + `claude -p` integration. Enables @Hermes mentions in Slack to trigger Claude Code with subscription auth (no API costs). Expansion path: thread awareness → skill routing → project context detection → always-on monitoring. Blocked by: Slack App creation (operator task).
- Clean up stale feature branches (page-quiz-embed, feature/faq-and-blog, feature/seobot-integration, etc.)
- Add README with setup/run instructions
