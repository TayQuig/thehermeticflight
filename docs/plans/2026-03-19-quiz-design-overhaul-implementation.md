# Quiz Design Overhaul — Implementation Plan

**Date:** 2026-03-19
**Source:** `docs/plans/2026-03-19-mastermind-quiz-design-overhaul.md` (mastermind report)
**Design spec:** `operations/mastermind-quiz-design-overhaul/scratch/round-3-designer.md`
**Branch:** `feature/quiz-design-overhaul`

## Overview

Rewrite the archetype quiz to resolve 10 interconnected design flaws identified
by the mastermind deliberation. The overhaul replaces 20 questions with 10 scored
(7 normative + 3 forced-pair) + 2 segmentation, rewrites the classifier from a
priority cascade to cosine-similarity centroids, adds an email gate + calculating
interstitial, and implements answer randomization.

**Hard constraint:** 6 archetypes are non-negotiable. Email sequences exist for
all 6.

## Phase Structure

```
Phase 0 (Content)  ──HUMAN GATE──>  Phase 1 (Data Model)
                                         │
                                         ▼
                                    Phase 2 (Classifier)
                                         │
                                         ▼
                                    Phase 3 (Quiz Engine)
                                         │
                                         ▼
                                    Phase 4 (UI — sub-tasks parallelizable)
                                         │
                                         ▼
                                    Phase 5 (API Integration)
                                         │
                                         ▼
                                    Phase 6 (Integration Testing)
                                         │
                                         ▼
                                    Phase 7 (Eval Protocol + Harden)
```

---

## Phase 0: Content Design (Collaborative — HUMAN GATE)

**What:** Claude drafts question content against the mastermind spec. Operator
reviews interactively for voice, desirability matching, and brand fit.

**Deliverable:** A markdown file at
`operations/mastermind-quiz-design-overhaul/approved-questions.md` containing:
- 7 normative scored questions (4 answers each, dimension + weight tier assigned)
- 3 forced-pair questions (2 answers each, +6/+2 scoring, dimension pair assigned)
- 2 segmentation questions (adapted from existing Q2, Q3)
- Variable weight tier assignments (which questions are +3, +4, +6)
- Forced-pair dimension assignments: FP01 = A-D, FP02 = B-C, FP03 = TBD
- Question sequencing (forced pairs interleaved at positions 3, 6, 9)

**Source material:** Existing questions in `src/lib/quiz-data.ts` (Q1, Q4-Q10,
Q12-Q18 are candidates for adaptation). Voice reference: current Q1 text
("You're awake at 2am with something weighing on you. What actually helps?").

**Entry point:** Interactive session with operator. Read existing quiz-data.ts
questions, draft adapted versions, present for review.

**Pass/fail:** Operator says "approved." No engineering begins without this.

**Known risks:**
- Desirability matching on forced pairs is subjective — operator judgment is final
- Variable weight tier assignment affects classification distribution — validated
  in Phase 2's Monte Carlo test, may require content revision

**Failure triage:** If Monte Carlo distribution test (Phase 2) fails with
approved content, return to Phase 0 to adjust weight tiers or swap questions.
Do not adjust centroids first — content is the tuning knob.

---

## Phase 1: Data Model + Scoring Pipeline [SUBAGENT: sonnet, FTF]

**What:** Rewrite `quiz-data.ts` with new question content, add `QuestionFormat`
type and `format` field, add `pair()` helper for forced-pair weights.

### Files

| File | Action | Description |
|------|--------|-------------|
| `src/lib/quiz-data.ts` | Rewrite | New questions, `QuestionFormat` type, `format` field, `pair()` helper, variable weights |
| `tests/quiz-data.test.ts` | Rewrite | New structural assertions for hybrid format |

### FTF Protocol

**Test Author (Opus):** Writes `tests/quiz-data.test.ts` with the following
contracts:
- Total scored questions = 10
- Normative questions (format === 'single_select') count = 7, each has 4 answers
- Forced-pair questions (format === 'forced_pair') count = 3, each has 2 answers
- Each forced-pair answer has exactly 2 scoring weights (one at +6, one at +2)
- Forced-pair dimension coverage: A-D, B-C, and one other pair each appear once
- Variable weights present: at least one +6 weight, at least one +3 weight on
  normative questions
- `scored` field true on all 10 scored questions, false on segmentation
- All answer IDs are unique across the entire question set
- `format` field present on all questions
- Segmentation questions have no scoring weights
- Question sequencing: forced pairs at positions 3, 6, 9 within scored questions

Then: `record-baseline.sh tests/quiz-data.test.ts`

**Implementer (Sonnet):** Reads approved questions from Phase 0, implements
`quiz-data.ts` to satisfy all test contracts. Must NOT modify test file.

Then: `verify-frozen.sh tests/quiz-data.test.ts`

### Entry Point

```bash
# Test author writes tests first
vitest run tests/quiz-data.test.ts  # expect all FAIL (no implementation yet)

# Implementer writes quiz-data.ts
vitest run tests/quiz-data.test.ts  # expect all PASS
```

### Pass/Fail Criteria

- All `quiz-data.test.ts` tests pass
- `verify-frozen.sh tests/quiz-data.test.ts` confirms test file unchanged
- `vitest run tests/quiz-submit.test.ts tests/quiz-submit-medium.test.ts` pass
  (auto-adapt validation — these tests build from the questions array dynamically)

### Known Risks

- **quiz-submit.test.ts may have hard-coded question counts.** If structural
  assertions reference "20 questions" or specific Q-IDs, they will fail.
- **SHA256 baselines for existing test files are invalidated.** The quiz-data.test.ts
  rewrite creates a new baseline.

### Failure Triage

- If quiz-submit tests fail: check for hard-coded question IDs or counts in
  `buildValidAnswers()` / `buildValidBody()`. These should auto-adapt but verify.
- If type errors: ensure `QuestionFormat` type is exported and `format` field
  added to the `Question` interface.

---

## Phase 2: Classifier Redesign [SUBAGENT: sonnet, FTF]

**What:** Rewrite `classify()` from priority cascade to cosine-similarity
centroids. Add `ClassificationResult` interface, `CENTROIDS` constant,
`classifyLegacy()` shim. `computeScores()` unchanged.

### Files

| File | Action | Description |
|------|--------|-------------|
| `src/lib/classifier.ts` | Rewrite `classify()` | Cosine similarity, ClassificationResult, CENTROIDS, classifyLegacy() |
| `tests/classifier.test.ts` | Rewrite | Centroid-based tests, Monte Carlo distribution |
| `tests/archetype-distribution.test.ts` | New | Monte Carlo validation (10K random sets) |

### FTF Protocol

**Test Author (Opus):** Writes classifier tests with the following contracts:

`tests/classifier.test.ts` (rewrite `classify()` section, keep `computeScores()`
section with updated question IDs):
- `classify()` returns `ClassificationResult` (not bare `ArchetypeSlug`)
- Each centroid's ideal vector classifies to its archetype (6 test cases)
- All 6 archetypes reachable with realistic score profiles
- Confidence is in [0, 1] range for all test cases
- Memberships sum to 1.0 (±0.001 floating-point tolerance)
- High A + high D input → grounded_mystic
- High B + high C input → flow_artist
- All-equal scores → confidence < 0.15
- Zero vector → confidence 0, uniform memberships
- `classifyLegacy()` returns same primary as `classify().primary`
- `computeScores()` with forced-pair dual-scoring: FP answer gives +6 to winner,
  +2 to loser

`tests/archetype-distribution.test.ts` (new):
- Monte Carlo: 10,000 random answer sets through `computeScores()` + `classify()`
- Random generation method: for each question, uniformly select one answer from
  `question.answers` (index 0..N-1 via `Math.random()`). Use a fixed seed
  (e.g., `seed = 42`) for deterministic reproducibility across runs.
- All 6 archetypes appear at > 5% (500 of 10,000)
- No archetype exceeds 40% (4,000 of 10,000)
- Ascending Seeker appears at > 8% (junk-drawer regression guard)
- Self-select triggers (confidence < 0.15) for < 15% of sets

Then: `record-baseline.sh tests/classifier.test.ts tests/archetype-distribution.test.ts`

**Implementer (Sonnet):** Implements cosine-similarity classifier. Must NOT
modify test files.

Then: `verify-frozen.sh tests/classifier.test.ts tests/archetype-distribution.test.ts`

### Caller Migration (same PR)

Two one-line changes:
- `src/pages/quiz.astro`: `classify(scores)` → `classify(scores).primary`
- `src/pages/api/quiz-submit.ts`: `const archetype = classify(scores)` →
  `const { primary: archetype } = classify(scores)`

### Entry Point

```bash
vitest run tests/classifier.test.ts tests/archetype-distribution.test.ts
```

### Pass/Fail Criteria

- All classifier and distribution tests pass
- Monte Carlo distribution: all 6 archetypes > 5%, none > 40%, AS > 8%
- Self-select trigger rate < 15%
- `verify-frozen.sh` confirms test files unchanged
- Build compiles with no type errors (`npx astro check` or `tsc --noEmit`)

### Known Risks

- **Centroid positions may produce unbalanced distribution.** The draft centroids
  [0.90, 0.15, 0.15, 0.15] for primaries are plausible but untested. If Monte
  Carlo fails, centroids need tuning.
- **Floating-point precision** in cosine similarity may create edge cases with
  identical similarity scores.

### Failure Triage

- If distribution test fails: adjust centroid positions. Move composite centroids
  closer to/further from primary centroids. Do NOT change the algorithm.
- If floating-point ties occur: add a deterministic tiebreaker (e.g., alphabetical
  archetype slug order). Document in code comment.
- If caller migration breaks: search for `classify(` across codebase — there
  should be exactly 2 call sites (quiz.astro, quiz-submit.ts).

---

## Phase 3: Quiz Engine [SUBAGENT: sonnet, FTF]

**What:** Extract the quiz state machine from inline `quiz.astro` script into a
testable `quiz-engine.ts` module. 7-phase state machine with conditional
self-select.

### Files

| File | Action | Description |
|------|--------|-------------|
| `src/lib/quiz-engine.ts` | New | State machine: QuizPhase, QuizState, QuizEngine, createQuizEngine() |
| `tests/quiz-engine.test.ts` | New | Phase transitions, shuffle, progress, self-select |

### FTF Protocol

**Test Author (Opus):** Writes `tests/quiz-engine.test.ts`:
- Phase flow: intro → segmentation → scored-questions → email-gate → calculating → results
- Self-select phase triggers when classification confidence < 0.15
- Self-select phase does NOT trigger when confidence >= 0.15
- `answerQuestion()` records answer in state
- `goBack()` returns to previous question, preserves answer
- `getProgress()` counts only scored questions (denominator = 10)
- Segmentation questions do not appear in progress count
- `getShuffledAnswerIndices()` returns consistent order for same questionId
  within a session (seeded PRNG)
- `getShuffledAnswerIndices()` returns [0,1] or [1,0] for forced-pair questions
- `getShuffledAnswerIndices()` returns a permutation of [0,1,2,3] for normative
- `selectArchetype()` records selection in state during self-select phase
- `submitEmail()` records email in state
- `skipEmail()` transitions to calculating without email

Then: `record-baseline.sh tests/quiz-engine.test.ts`

**Implementer (Sonnet):** Implements `quiz-engine.ts`.

Then: `verify-frozen.sh tests/quiz-engine.test.ts`

### Entry Point

```bash
vitest run tests/quiz-engine.test.ts
```

### Pass/Fail Criteria

- All quiz-engine tests pass
- `verify-frozen.sh` confirms test file unchanged
- No circular dependencies in import graph

### Known Risks

- **Seeded PRNG implementation.** Need a deterministic PRNG that works in both
  Node (tests) and browser. Use a simple mulberry32 or xoshiro128 — no npm
  dependency needed.
- **quiz.astro coupling.** The engine must be usable from quiz.astro's inline
  script. All state management moves to the engine; the Astro script becomes
  a thin rendering layer.

### Failure Triage

- If PRNG produces inconsistent results across environments: use a well-known
  algorithm (mulberry32) with the same seed derivation.
- If import cycle detected: quiz-engine imports from classifier and quiz-data
  only (both are leaf modules). Verify no backward imports.

---

## Phase 4: UI Implementation [SUBAGENT: sonnet]

**What:** Rewrite `quiz.astro` to consume the quiz engine, render two question
formats, add email gate + calculating interstitial + self-select phase, implement
answer shuffle and 800ms auto-advance.

### Sub-tasks (parallelizable within a single agent session)

**4a. Format-conditional rendering.** Branch on `question.format`:
- `single_select`: 4 stacked buttons (existing style, improved spacing)
- `forced_pair`: 2 large buttons with "or" divider, `pair-btn` CSS class
- Progress bar counts scored questions only (N of 10)
- Segmentation questions rendered without progress bar

**4b. Email gate.** New `<section id="email-gate">` after last scored question.
HTML template from Builder's Round 2 output (Section 4a). Form: email (required),
firstName (optional), honeypot (hidden). Submit handler: POST to `/api/quiz-submit`.
Skip button: bypasses API, proceeds to results. GA4 events: `email_captured` and
`email_skipped`.

**4c. Calculating interstitial.** New `<section id="quiz-calculating">` between
email gate and results. CSS-only pulsing animation. Rotating text: "Reading the
pattern of your choices..." / "Consulting the four elements..." / "Your archetype
emerges..." Auto-advance to results (or self-select) after 2.5s.

**4d. Answer shuffle + auto-advance.** Fisher-Yates via quiz engine's
`getShuffledAnswerIndices()`. Render answers in shuffled order. Log display order
in state for submission payload. Auto-advance delay: 800ms (change from 500ms).

**4e. Self-select phase.** New `<section id="self-select">` before results.
Triggered by quiz engine when confidence < 0.15. Shows two archetype cards
(name + glyph + tagline). User clicks one. Records selection via
`engine.selectArchetype()`.

**4f. Confidence-based result messaging.** Update result reveal:
- High confidence (≥0.4): "You are The [Primary]."
- Medium (0.15-0.4): "You are The [Primary] with [Secondary] undertones."
- Low (<0.15): handled by self-select phase before reaching results.

### Files

| File | Action | Description |
|------|--------|-------------|
| `src/pages/quiz.astro` | Major rewrite | Consume quiz engine, two renderers, email gate, interstitial, self-select, shuffle, auto-advance |

### Entry Point

```bash
npx astro build   # must succeed — no build errors
npx astro dev     # manual smoke test of full flow
```

### Pass/Fail Criteria

- `npx astro build` succeeds with no errors
- Manual smoke test: intro → segmentation (2 Qs) → scored (10 Qs, mixed format)
  → email gate → calculating → results
- Skip path works (skip email → calculating → results)
- Self-select appears when low-confidence profile is manually constructed
- Answer order differs between sessions (randomization working)
- Back button preserves previous answer and answer order
- Progress bar shows "N of 10" during scored questions only

### Known Risks

- **quiz.astro is 384 lines** of mixed Astro template + inline script. The
  rewrite is substantial. Working from the quiz engine reduces inline script
  complexity but the template grows (new sections for email gate, interstitial,
  self-select).
- **Mobile responsive layout** for forced-pair 2-column grid. Use
  `grid-cols-1 md:grid-cols-2` (stacked on mobile, side-by-side on desktop).

### Failure Triage

- If build fails with type errors: check quiz-engine.ts exports match what
  quiz.astro imports.
- If animations are broken: the existing CSS classes (`quiz-step`, `active`,
  `exiting`) must be preserved. New sections need the same class pattern.
- If email gate submit fails: verify `/api/quiz-submit` endpoint accepts the
  payload format. Test with curl first.

---

## Phase 5: API Integration [SUBAGENT: sonnet]

**What:** Update `quiz-submit.ts` for v2 payloads: destructure
`ClassificationResult`, add `quizVersion: 'v2'`, add optional `selfSelected`
and `displayOrder` fields, forward memberships to Loops.so.

**FTF exemption:** This phase modifies existing test files with small additive
assertions (v2 payload fields). FTF is not applied because: (1) changes are
<20 lines per test file, (2) quiz-submit tests auto-adapt validation from the
questions array, and (3) the implementation change is similarly small (~15 lines
in quiz-submit.ts). The existing test suite already covers rate limiting,
honeypot, and validation — those are unchanged.

### Files

| File | Action | Description |
|------|--------|-------------|
| `src/pages/api/quiz-submit.ts` | Update | Destructure classify result, add v2 fields, forward memberships |
| `tests/quiz-submit.test.ts` | Update | Verify v2 payload handling, selfSelected field |
| `tests/quiz-submit-medium.test.ts` | Verify | Auto-adapt confirmation |

### Entry Point

```bash
vitest run tests/quiz-submit.test.ts tests/quiz-submit-medium.test.ts
```

### Pass/Fail Criteria

- All quiz-submit tests pass
- Payload includes `quizVersion: 'v2'`
- Loops.so payload includes archetype from `ClassificationResult.primary`
- Optional `selfSelected` field handled gracefully (present or absent)
- `displayOrder` field accepted and forwarded
- Rate limiting, honeypot, and validation unchanged

### Known Risks

- **Loops.so event properties** may have field name constraints. Verify
  `memberships` object structure is accepted.

### Failure Triage

- If Loops.so rejects memberships: flatten to individual fields
  (`membership_air_weaver: 0.35`, etc.) instead of nested object.
- If validation rejects v2 payloads: check `scoredQuestionIds` set is built
  from new question IDs (it should auto-adapt from the questions array).

---

## Phase 6: Integration Testing [SUBAGENT: sonnet]

**What:** Full-flow E2E tests, cross-module integration verification.

### Files

| File | Action | Description |
|------|--------|-------------|
| `tests/quiz-browser.test.mjs` | Rewrite | E2E flow with new question count and formats |
| (E2E playwright tests) | Update | If any quiz-flow specs exist |

### Test Matrix

1. **Happy path:** Intro → 2 seg → 10 scored (verify mixed formats render) →
   email gate (submit) → calculating → results (archetype shown)
2. **Skip path:** Same but skip email → verify results still show
3. **Self-select path:** Construct answers that produce low confidence → verify
   self-select appears → pick archetype → results show chosen
4. **Back navigation:** Answer Q3, go back to Q2, verify Q2's answer preserved
   and answer order unchanged
5. **Forced-pair rendering:** Verify FP questions show 2 buttons with "or"
   divider, normative show 4 buttons
6. **Progress bar:** Verify "N of 10" during scored, hidden during segmentation
7. **API integration:** Submit with email → verify POST to `/api/quiz-submit`
   includes `quizVersion: 'v2'` and all required fields

### Entry Point

```bash
vitest run           # all unit tests
npx playwright test  # E2E tests
npx astro build      # production build succeeds
```

### Pass/Fail Criteria

- All unit tests pass (target: 562+ existing + new quiz engine + distribution)
- E2E tests pass
- Production build succeeds
- No console errors in dev server during manual flow testing

### Known Risks

- **E2E tests may be flaky** with animation timers (auto-advance, interstitial).
  Use `waitForSelector` with appropriate timeouts, not fixed sleeps.

### Failure Triage

- If E2E times out on interstitial: increase Playwright timeout or reduce
  interstitial duration in test environment.
- If unit test count drops: audit which existing tests were removed vs. replaced.
  Net test count should increase.

---

## Phase 7: Eval Protocol + Harden

**What:** Deploy 3 independent evaluators with orthogonal lenses to stress-test
the completed quiz v2. Remediate findings via FTF cycles.

### Evaluator Configuration

| # | Lens | Focus |
|---|------|-------|
| 1 | Functional | All 6 archetypes reachable with realistic answer patterns. Email gate captures and submits correctly. Self-select triggers at correct threshold. Back navigation preserves state. Display order logged. |
| 2 | Security + Data Integrity | Honeypot still works. Rate limiting unchanged. Server-side classification matches client-side. No XSS vectors in email form. No PII in display order logs. quizVersion field prevents v1/v2 confusion in Loops.so. |
| 3 | UX + Accessibility | Keyboard navigation through both question formats. Focus management on phase transitions. Screen reader announces question changes. Forced-pair "or" divider is decorative (aria-hidden). Skip link is discoverable. Mobile layout works (forced-pair stacking). Color contrast on new elements. |

### Entry Point

```bash
# Evaluators read the codebase and produce findings
# Findings written to operations/eval-quiz-v2-YYYY-MM-DD/
```

### Pass/Fail Criteria

- No CRITICAL findings remain unresolved
- All HIGH findings either resolved or documented with accepted-risk rationale
- Verification playbook produced and executed
- All SHA256 baselines verified after remediation

### Known Risks

- **Eval findings may require Phase 0 content changes** (e.g., accessibility
  evaluator finds answer text too long for mobile). Route content changes back
  through operator approval.

### Failure Triage

- CRITICAL findings: immediate FTF remediation cycle. Test Author writes
  regression test, Implementer fixes, verify-frozen.sh confirms.
- HIGH findings: assess blast radius. If fix is isolated (1 file), remediate
  in-place. If systemic, create a follow-up backlog item.

---

## File Manifest (Complete)

| File | Phase | Change Type |
|------|-------|-------------|
| `operations/mastermind-quiz-design-overhaul/approved-questions.md` | 0 | New — approved question content |
| `src/lib/quiz-data.ts` | 1 | Rewrite — new questions, format field, pair() helper |
| `tests/quiz-data.test.ts` | 1 | Rewrite — hybrid format assertions |
| `src/lib/classifier.ts` | 2 | Rewrite classify(), add ClassificationResult, CENTROIDS |
| `tests/classifier.test.ts` | 2 | Rewrite — centroid classification tests |
| `tests/archetype-distribution.test.ts` | 2 | New — Monte Carlo validation |
| `src/lib/quiz-engine.ts` | 3 | New — 7-phase state machine |
| `tests/quiz-engine.test.ts` | 3 | New — engine contract tests |
| `src/pages/quiz.astro` | 4 | Major rewrite — renderers, email gate, interstitial, self-select |
| `src/pages/api/quiz-submit.ts` | 5 | Update — v2 fields, ClassificationResult destructure |
| `tests/quiz-submit.test.ts` | 5 | Update — v2 payload tests |
| `tests/quiz-submit-medium.test.ts` | 5 | Verify auto-adapt |
| `tests/quiz-browser.test.mjs` | 6 | Rewrite — new flow E2E |

## Effort Estimates

| Phase | Effort | Blocker |
|-------|--------|---------|
| 0 — Content Design | 1 collaborative session | Operator availability |
| 1 — Data Model | 0.5 day | Phase 0 approved |
| 2 — Classifier | 1 day | Phase 1 complete |
| 3 — Quiz Engine | 1 day | Phase 2 complete |
| 4 — UI | 1.5 days | Phase 3 complete |
| 5 — API Integration | 0.5 day | Phase 2 complete (parallel with 3-4) |
| 6 — Integration Testing | 0.5 day | Phases 1-5 complete |
| 7 — Eval + Harden | 1 day | Phase 6 complete |

**Total:** ~6 days engineering + 1 collaborative content session
**Critical path:** Phase 0 (content) → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 6 → Phase 7
**Parallelizable:** Phase 5 can run alongside Phases 3-4 (different files, shared dependency on Phase 2)

## Backlog Impact

This plan **supersedes** the Sprint 4 backlog item "Quiz code quality
refactoring" (`docs/plans/2026-03-09-quiz-refactoring.md`, 7 tasks, 10
deferred findings). The full quiz rewrite addresses all 10 deferred findings
by eliminating the code they applied to. On taskboard update, that backlog
item should be marked as absorbed.
