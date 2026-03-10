# Pre-Launch Sprint Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Organize the 17-item backlog into 6 time-ordered sprints with maximum intra-sprint parallelism, targeting the 8/8/26 Kickstarter launch.

**Architecture:** Each sprint contains 2–4 independent parallel tracks. Tracks within a sprint share no files, so they can run in separate worktrees simultaneously. Cross-sprint dependencies are soft (earlier sprints improve the foundation but don't hard-block later ones unless noted). Each track that involves code will need its own detailed plan doc (`docs/plans/YYYY-MM-DD-<name>.md`) before Build phases begin — this roadmap is the orchestration layer above those.

**Tech Stack:** Astro 5 SSG, Tailwind CSS 3.4, Vercel serverless, Loops.so, GA4, Playwright, Claude Code skills (`~/.claude/skills/`)

---

## Sprint Overview

| Sprint | Theme | Tracks | Est. Scope | Target Window |
|--------|-------|--------|-----------|---------------|
| 1 | Foundation & Quick Wins | 3 | Small | Now (March) |
| 2 | Growth Features | 3 | Large | March–April |
| 3 | Operational Visibility | 4 | Medium | April–May |
| 4 | Code Quality & Skill Hardening | 2 | Medium | May |
| 5 | Externally-Blocked Features | 3 | Large | May–July (staggered) |
| 6 | Platform Expansion | 2 | Large | June–July |

---

## Sprint 1: Foundation & Quick Wins

**Goal:** Capture the easiest conversion win, harden infrastructure before traffic surge, clear workspace noise.

**Parallel tracks: 3 — zero cross-track file overlap.**

### Track A: Thank-you → Result Page Redirect

**Backlog item:** Thank-you → Result Page Redirect

**Scope:** Small (1 file modify, 1 test file). Highest ROI-per-effort item in the backlog.

**Problem:** `src/pages/thank-you.astro` shows "COMING SOON" for the revelation date and doesn't link to the user's archetype result page. The viral loop (share buttons, OG tags) only exists on `/quiz/result/[archetype]` — quiz completers who stop at thank-you never see the share CTA.

**Approach:**
1. Pass archetype slug as a query parameter from the quiz submission flow
2. On `thank-you.astro`, read the query param and render a prominent CTA linking to `/quiz/result/[archetype-slug]`
3. Fallback: if no archetype param, show generic "View Your Result" messaging
4. Remove stale "COMING SOON" revelation date content

**Files:**
- Modify: `src/pages/thank-you.astro` (add query param read + result page CTA)
- Modify: `src/pages/quiz.astro` (pass archetype to thank-you redirect)
- Modify: `src/pages/api/quiz-submit.ts` (if redirect happens server-side)
- Test: `tests/` (thank-you redirect behavior, fallback when no archetype)

**Needs plan doc:** Yes — small but touches the quiz submission flow.

---

### Track B: Infrastructure Hardening

**Backlog item:** Infrastructure hardening

**Scope:** Medium (config files + test migration). Two high-severity deferred findings from hardening-2026-03-08.

**Sub-item 1: Playwright CI Integration (ARCH-03)**
- Migrate existing Playwright tests to `@playwright/test` runner
- Add `playwright.config.ts`
- Add `e2e` npm script
- Goal: E2E tests runnable in CI (GitHub Actions or Vercel build)

**Sub-item 2: Content Security Policy (ADV-01)**
- Add CSP headers via `vercel.json` (or Vercel middleware)
- Start with `Content-Security-Policy-Report-Only` mode
- Must account for: GA4 (`gtag.js`), Facebook Pixel (`fbq`), inline scripts in quiz.astro
- Monitor for 2 weeks before switching to enforcing mode

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json` (add `e2e` script)
- Create or Modify: `vercel.json` (CSP headers)
- Modify: existing test files under `tests/` or `e2e/`

**Needs plan doc:** Yes — CSP directive crafting requires careful audit of all script sources.

---

### Track C: Housekeeping

**Backlog items:** Clean up stale feature branches + Add README

**Scope:** Trivial. No code changes, no tests needed.

**Tasks:**
1. Delete stale local + remote branches: `page-quiz-embed`, `feature/faq-and-blog`, `feature/seobot-integration`, and any others confirmed stale
2. Write `README.md` with: project description, prerequisites (Node, pnpm/npm), setup steps (`npm install`, env vars), dev server (`npm run dev`), test commands, deployment notes

**Files:**
- Create: `README.md`
- Delete: stale git branches (operator confirmation required per safety rules)

**Needs plan doc:** No — documentation/configuration only.

---

### Sprint 1 Dependency Map

```
Track A (Thank-you redirect)  ──┐
Track B (Infra hardening)      ──┼──▶  Sprint 1 Complete
Track C (Housekeeping)         ──┘
         (all parallel, no cross-deps)
```

---

## Sprint 2: Growth Features

**Goal:** Three major new pages that expand the site's surface area for engagement, SEO, and marketing.

**Parallel tracks: 3 — different URL paths, different data sources, no shared components.**

**Soft dep on Sprint 1:** CSP headers from Track B should cover new pages. Not a hard blocker — can add CSP directives for new pages retroactively.

### Track A: Archetype Journey Pages

**Backlog item:** Archetype Journey Pages

**Scope:** Large. 6 new pages (one per archetype) with rich content.

**Approach:**
- New dynamic route: `src/pages/archetype/[slug].astro`
- Content source: operator's archetype description documents
- Page sections: affiliated cards, recommended spreads, journaling prompts, curated blog post links, archetype population stats (if available from Loops.so)
- Link from quiz result pages (`/quiz/result/[archetype]`) → journey page
- SEO: unique meta descriptions per archetype, structured data (FAQ schema for journaling prompts)

**Data model extension:**
- Extend `ArchetypeContent` in `src/lib/archetype-content.ts` with journey fields, OR
- Create separate `src/content/archetypes/` collection (Astro Content Collections)

**Files:**
- Create: `src/pages/archetype/[slug].astro`
- Create: content files for each archetype (6 files or 1 data file)
- Modify: `src/lib/archetype-content.ts` (extend or cross-reference)
- Modify: `src/pages/quiz/result/[archetype].astro` (add journey page link)
- Test: route generation, content rendering, SEO meta tags

**Needs plan doc:** Yes — data model decision (Content Collections vs extended TS) needs research.

---

### Track B: Kickstarter Countdown Page

**Backlog item:** Kickstarter Countdown Page

**Scope:** Medium-Large. New `/launch` page, Loops.so integration.

**Approach:**
- New page: `src/pages/launch.astro`
- Animated countdown timer to 8/8/26 (client-side JS, no server dependency)
- Pledge tier previews (static content, operator-provided)
- Social proof strip: list size (static or Loops.so API), quiz completions
- "Notify Me" CTA → Loops.so `launch_notify` event (similar pattern to quiz-submit API)
- KS-specific FAQ excerpt
- Canonical URL for all pre-launch marketing links

**Files:**
- Create: `src/pages/launch.astro`
- Create: `src/pages/api/launch-notify.ts` (Vercel serverless → Loops.so)
- Test: countdown timer logic, CTA submission, responsive layout

**Needs plan doc:** Yes — Loops.so event schema + pledge tier content needed from operator.

---

### Track C: Daily Card Draw

**Backlog item:** Daily Card Draw

**Scope:** Medium. Entirely client-side, no backend.

**Approach:**
- New page: `src/pages/daily.astro`
- Date-seeded deterministic draw: `seed = YYYY-MM-DD` → deterministic card index (everyone sees same card each day)
- Card data: name, meaning, aerial connection, journaling prompt
- Pre-reveal mode (before art delivery): card back image + text interpretation only
- Post-reveal mode: full card art
- Card-flip animation (CSS `transform: rotateY`)
- Share button (reuse pattern from result pages)

**Data model:**
- Create: `src/lib/card-data.ts` (78 cards — name, meaning, aerial connection, journaling prompt)
- Pre-reveal: flag or date gate controls art visibility

**Files:**
- Create: `src/pages/daily.astro`
- Create: `src/lib/card-data.ts`
- Create: `src/lib/daily-draw.ts` (deterministic seed logic)
- Test: deterministic draw reproducibility, date boundary behavior, pre/post reveal toggle

**Needs plan doc:** Yes — card data schema + 78-card content needed from operator.

---

### Sprint 2 Dependency Map

```
Track A (Archetype Journey) ──┐
Track B (Countdown Page)    ──┼──▶  Sprint 2 Complete
Track C (Daily Card Draw)   ──┘
       (all parallel, no cross-deps)
```

---

## Sprint 3: Operational Visibility

**Goal:** Monitoring, performance, and analytics tooling. Must be operational before Kickstarter traffic surge.

**Parallel tracks: 4 — mostly independent. Note: Tracks B and D both extend `audit-site` skill — if touching the same file, sequence B before D.**

**Soft dep on Sprint 2:** More pages to monitor/audit after growth features ship.

### Track A: Site Uptime & Deploy Monitoring

**Backlog item:** Site Uptime & Deploy Monitoring

**Scope:** Medium. New skill.

**Approach:**
- New skill: `~/.claude/skills/site-monitor/SKILL.md`
- Probes key endpoints via fetch: homepage, `/quiz`, `/api/quiz-submit`, all 6 result pages, plus any new pages from Sprint 2
- Checks: HTTP status code, response time threshold
- Optional: Vercel deployment status via API (if Vercel token available)
- Alerts: Slack `#the-hermetic-flight` on failure or degradation
- No new credentials needed for public endpoint checks

**Files:**
- Create: `~/.claude/skills/site-monitor/SKILL.md`
- Test: manual invocation against live site

**Needs plan doc:** No — skill authoring, not implementation code.

---

### Track B: Performance Budget / Core Web Vitals

**Backlog item:** Performance Budget / Core Web Vitals

**Scope:** Medium. New skill or extension to `audit-site`.

**Approach:**
- Hit PageSpeed Insights API (free, no auth required) for each page
- Track: LCP, CLS, INP scores across mobile + desktop
- Save historical scores to `operations/perf/` (JSON, append per run)
- Flag regressions vs previous run
- Check OG image sizes (7 placeholder PNGs at 1200x630 — may be unoptimized)
- Output: Slack summary + `operations/perf/YYYY-MM-DD.json`

**Files:**
- Create: `~/.claude/skills/perf-audit/SKILL.md` OR extend `audit-site/SKILL.md`
- Create: `operations/perf/` directory
- Test: manual invocation, verify JSON output

**Needs plan doc:** No — skill authoring.

---

### Track C: Subscriber Funnel Analytics

**Backlog item:** Subscriber Funnel Analytics

**Scope:** Medium. Enhancement to `weekly-report` skill.

**Approach:**
- Query Loops.so Contacts API for: segment counts by archetype, growth rate WoW, engagement metrics
- Surface: total subscribers, archetype distribution, unsubscribe/bounce rate, drip sequence performance
- Reference: `operations/loops-api-reference.md`
- Depends on Loops.so API capabilities (some metrics may not be available)

**Files:**
- Modify: `~/.claude/skills/weekly-report/SKILL.md` (add subscriber funnel section)
- Test: manual invocation with live Loops.so credentials

**Needs plan doc:** No — skill enhancement. Research artifact (`operations/loops-api-reference.md`) already exists.

**Blocker:** Requires `LOOPS_API_KEY` configured in `.env` (operator task).

---

### Track D: Accessibility Audit (WCAG)

**Backlog item:** Accessibility Audit (WCAG)

**Scope:** Medium. Extension to `audit-site` skill.

**Approach:**
- Check color contrast against Hermetic dark theme (gold-on-void, emerald-on-void)
- ARIA labels on quiz auto-advance interactions
- Keyboard navigation through multi-step quiz flow
- Screen reader compatibility
- Focus management on archetype reveal animation
- Can fold into existing `audit-site` crawl loop as a new audit mode

**Files:**
- Modify: `~/.claude/skills/audit-site/SKILL.md` (add WCAG mode/section)
- Test: manual invocation against live site

**Needs plan doc:** No — skill extension.

**Sequence note:** If Track B also modifies `audit-site`, complete B first, then D modifies the updated file.

---

### Sprint 3 Dependency Map

```
Track A (Site Monitor)        ──┐
Track B (Perf Budget)         ──┼──▶  Sprint 3 Complete
Track C (Funnel Analytics)    ──┤
Track D (Accessibility Audit) ──┘
    B ──▶ D (if both touch audit-site)
    C blocked by LOOPS_API_KEY
```

---

## Sprint 4: Code Quality & Skill Hardening

**Goal:** Address deferred hardening findings. Reduce tech debt before launch traffic.

**Parallel tracks: 2 — Track A touches `src/`, Track B touches `~/.claude/skills/`. Zero overlap.**

### Track A: Quiz Code Quality Refactoring

**Backlog item:** Quiz code quality refactoring

**Scope:** Medium. Refactoring + test additions. All deferred from hardening-2026-03-08.

**Tasks (by finding ID):**

| ID | Task | Severity |
|----|------|----------|
| ARCH-04 | Extract `quiz.astro` script block into modules | Medium |
| ARCH-08 | Reduce `as` casts with null-safe DOM helpers | Medium |
| ARCH-09 | Extract shared `ShareButtons.astro` component | Medium |
| TCF-03 | Add GA4 share event contract tests with gtag mock | Medium |
| TCF-06 | Add slug edge case tests | Low |
| TCF-07 | Replace `waitForTimeout` with condition-based E2E waits | Low |
| TCF-08 | Multi-page canonical URL checks | Low |
| TCF-09 | All-archetype structural checks (not just 1) | Low |
| TCF-10 | Clipboard copy feedback test | Low |

**Files:**
- Modify: `src/pages/quiz.astro` (extract script block)
- Create: `src/lib/share-utils.ts` (share CTA logic)
- Create: `src/components/ShareButtons.astro` (shared component)
- Create: `src/lib/dom-helpers.ts` (null-safe DOM utilities)
- Modify: `src/pages/quiz/result/[archetype].astro` (use ShareButtons component)
- Create/Modify: test files for GA4 mock, slug edge cases, E2E improvements

**Needs plan doc:** Yes — refactoring touches the quiz submission flow, needs careful ordering.

---

### Track B: Skill Suite Polish

**Backlog items:** Skill suite consistency pass + Skill content polish (sequential within track)

**Scope:** Medium. 12 deferred findings from eval-skills-2026-03-08.

**Phase 1 — Consistency pass (8 findings):**

| ID | Fix | Skills Affected |
|----|-----|-----------------|
| F-14 | Standardize git operations in approval gates | All 5 |
| F-16 | Add failure handling pattern for external deps | All 5 |
| F-20 | Add `mkdir -p` before writes | All 5 |
| F-21 | Standardize procedure structure convention | All 5 |
| F-22 | Standardize emoji usage in Slack templates | All 5 |
| F-23 | Standardize output path conventions | All 5 |
| F-25 | Clarify "(standard)" commit gate wording | All 5 |
| F-26 | Remove local file paths from Slack messages | All 5 |

**Phase 2 — Content polish (4 findings):**

| ID | Fix | Skill |
|----|-----|-------|
| F-17 | Add quiz result pages to audit-site site map | audit-site |
| F-18 | Add procedure branches for all 5 content source types | social-blast |
| F-19 | Specify launch banner design in Page Update Mode | launch-sequence |
| F-24 | Cross-reference brand voice between skills | publish-post, social-blast |

**Files:**
- Modify: `~/.claude/skills/audit-site/SKILL.md`
- Modify: `~/.claude/skills/publish-post/SKILL.md`
- Modify: `~/.claude/skills/social-blast/SKILL.md`
- Modify: `~/.claude/skills/weekly-report/SKILL.md`
- Modify: `~/.claude/skills/launch-sequence/SKILL.md`

**Needs plan doc:** No — skill file edits, no implementation code.

---

### Sprint 4 Dependency Map

```
Track A (Quiz refactoring)    ──┐
                                ├──▶  Sprint 4 Complete
Track B (Skill polish)        ──┘
  Phase 1 (consistency) ──▶ Phase 2 (content)
       (A and B fully parallel)
```

---

## Sprint 5: Externally-Blocked Features

**Goal:** Features with external dependencies. Schedule around asset/decision delivery.

**Not a true parallel sprint — items are staggered by blocker resolution.**

### Item A: Card Gallery (Progressive Reveal)

**Backlog item:** Card Gallery (Progressive Reveal)

**Scope:** Large. Needs art assets.

**Blocker:** Card art delivery schedule (operator-controlled, target ~late May)

**Approach:**
- New page: `src/pages/gallery.astro`
- Starts empty, populates on scheduled cadence through launch
- Filterable grid: card name, meaning, aerial connection
- Individual card OG images for social sharing
- Full gallery unlocked on launch day (8/8/26)

**Can pre-plan:** Data model, page layout, filter logic, reveal scheduling mechanism. Build stub with placeholder data.

**Needs plan doc:** Yes.

---

### Item B: Referral Waitlist

**Backlog item:** Referral Waitlist

**Scope:** Large. Requires backend.

**Blocker:** Backend technology decision (Supabase vs Vercel KV) + operator approval

**Approach:**
- Unique referral link generated after quiz completion
- `/waitlist` status page (position, referral count, tier)
- Integration with Loops.so referral events
- Reward tiers deferred — core referral tracking mechanics first

**Can pre-plan:** Referral link generation, Loops.so event schema, UI design. Backend choice blocks implementation.

**Needs plan doc:** Yes — backend architecture decision required.

---

### Item C: Content Calendar / Editorial Orchestration

**Backlog item:** Content Calendar / Editorial Orchestration

**Scope:** Medium. New skill.

**Blocker:** Not urgent until ~June 2026 (4-week launch countdown)

**Approach:**
- New skill: `~/.claude/skills/content-calendar/SKILL.md`
- Schedule in `operations/content-calendar.json`
- Coordinates: publish-post → social-blast → email draft with proper spacing
- Tracks planned vs published content
- "This week's content" summary to Slack

**Can pre-plan:** Schema design, skill structure. Build when launch countdown approaches.

**Needs plan doc:** No — skill authoring.

---

## Sprint 6: Platform Expansion

**Goal:** Cross-project capabilities. Lowest launch-critical priority.

### Item A: Hermes Slack Bot Bridge (v1)

**Blocker:** Lives in separate repo. Blocked by Slack App creation (operator task).

**Scope:** Large (separate project). Socket Mode Slack App + Node.js + `claude -p` integration.

**Not tracked in this roadmap** — belongs in Hermes project taskboard.

---

### Item B: Skill Outputs Dashboard

**Blocker:** Tech stack TBD. Significant scope (authenticated subdomain).

**Scope:** Large. Astro SSR + Vercel auth or lightweight admin framework.

**Lowest priority** — operator can use `operations/` files directly until launch traffic justifies a dashboard.

---

## Plan Docs Required Before Build

Summary of items that need their own detailed implementation plan (`docs/plans/YYYY-MM-DD-<name>.md`):

| Sprint | Item | Plan Doc Needed |
|--------|------|:---:|
| 1A | Thank-you → Result Page Redirect | Yes |
| 1B | Infrastructure Hardening (Playwright CI + CSP) | Yes |
| 1C | Housekeeping | No |
| 2A | Archetype Journey Pages | Yes |
| 2B | Kickstarter Countdown Page | Yes |
| 2C | Daily Card Draw | Yes |
| 3A–D | All operational skills | No (skill authoring) |
| 4A | Quiz Code Quality Refactoring | Yes |
| 4B | Skill Suite Polish | No (skill edits) |
| 5A | Card Gallery | Yes |
| 5B | Referral Waitlist | Yes |
| 5C | Content Calendar | No (skill authoring) |

**8 plan docs required** before their respective Build phases begin.

---

## Execution Strategy

### For each sprint:

1. **Dispatch parallel worktrees** — one per track (e.g., `sprint-1a-thank-you`, `sprint-1b-infra-hardening`, `sprint-1c-housekeeping`)
2. **Write plan doc** for code-track items (if not yet written)
3. **Execute via subagent-driven-development** — fresh subagent per task within each track
4. **Integration phase** — merge all tracks to main, run full test suite, verify no conflicts
5. **Ship** — deploy, verify in production, archive sprint in taskboard

### Estimated timeline to Kickstarter (8/8/26):

```
March     ████████  Sprint 1 (Foundation)
April     ████████  Sprint 2 (Growth Features)
May       ████████  Sprint 3 (Ops Visibility) + Sprint 4 (Code Quality)
June      ████████  Sprint 5 (Gallery, Waitlist, Calendar)
July      ████████  Sprint 6 (Platform) + Launch prep
August    ██        LAUNCH 8/8/26
```

Sprints 3 and 4 can overlap since they touch entirely different file sets (`src/` vs `~/.claude/skills/` vs new skills).
