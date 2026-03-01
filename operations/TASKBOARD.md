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

### Marketing Pipeline Replacement — Implementation

**Brief:** Replace Tally + Zapier + Mailchimp with native Astro quiz + Vercel serverless + Loops.so. Implementation plan: `docs/plans/2026-02-28-marketing-pipeline-implementation.md`.

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Test infrastructure + quiz data model | `pending` | Add vitest, create quiz-data.ts with 20 questions, data integrity tests |
| 2 | Archetype classifier (TDD) + content data | `pending` | Port Python classifier to TypeScript, unit tests, archetype display content |
| 3 | Native multi-step quiz page | `pending` | Replace Tally embed with native UI, client-side scoring + results reveal |
| 4 | Quiz submission API route | `pending` | Vercel serverless function, server-side re-classification, Loops.so integration |
| 5 | Environment, build verification, deploy | `pending` | .env setup, build test, Loops.so dashboard config (manual), migration checklist |

**Handoff Context (2026-02-28):**
Implementation plan written and saved to `docs/plans/2026-02-28-marketing-pipeline-implementation.md`. Plan has 7 granular tasks with full code. Scoring anomaly decisions documented (corrected Q5/Q6, fixed Q8-A/Q9 bugs, preserved Q7-E/Q8-E dual scoring). The "quiz result-before-signup" backlog item is folded into Phase 3 — native quiz shows archetype instantly, then captures email. Pre-implementation blocker: operator should confirm Q5/Q6 corrected scoring intent before Phase 1 begins (plan proceeds with corrected scoring if no response). PO Box still needed before Loops.so sends any emails (CAN-SPAM).

---

## Ideas

- "Living Quiz" — interactive tarot reading experience instead of standard form (Daydreamer Direction 1)
- Email content as Astro MDX collections — version-controlled drip sequences that preview in dev server (Daydreamer Direction 2)
- Progressive archetype reveal — reveal primary dimension immediately, drip nuances over 8 weeks (Daydreamer wild card)
- Shareable archetype cards — OG image per archetype for social sharing / viral growth
- Supabase as headless CRM — store raw quiz scores, engagement data, Kickstarter segmentation (Phase 2 when full self-hosted)
- Always-on agent monitoring — evaluate when/if migrating to full self-hosted stack

---

## Backlog

- ~~**Marketing pipeline replacement**~~ — PROMOTED TO ACTIVE TASK
- ~~**Quiz result-before-signup flow**~~ — FOLDED INTO ACTIVE TASK (Phase 3)
- **Kickstarter launch sequence pipeline** — 4 emails sent 4 weeks before Kickstarter launch (1 per week). These are broadcast emails that go to ALL subscribers regardless of where they are in their archetype nurture drip. Requires: Loops.so broadcast/campaign capability, scheduling logic, content for all 4 emails.
- Clean up stale feature branches (page-quiz-embed, feature/faq-and-blog, feature/seobot-integration, etc.)
- Add README with setup/run instructions
