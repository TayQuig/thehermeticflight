# Sprint 3+4 Execution — FTF-Enforced Redo

**Goal:** Execute Sprint 3 (eval harness) and Sprint 4 (quiz refactoring) with
proper frozen-test-file discipline. Track C (skills ×8) is already complete.

**Context:** Previous execution dispatched single agents per track that both
wrote tests and implementation. No SHA256 baselines. No FTF verification.
Track A produced regressions in existing hardening tests. Work was stashed
(`git stash` — reference only, not to be reused directly) and baseline
restored to 474/474 tests passing.

**Baseline:** 474 tests pass, `npx astro build` clean.

**Reference plans:**
- Track A test/implementation specs: `docs/plans/2026-03-09-quiz-refactoring.md`
- Track B test/implementation specs: `docs/plans/2026-03-14-sprint-3-4-parallel.md` (Track B section)

**Tech Stack:** Astro 5, TypeScript, Vitest, Tailwind CSS, Vercel serverless,
GA4 Data API, PageSpeed Insights API

---

## Track Layout

| Track | Sprint | Work | Status |
|-------|--------|------|--------|
| A | 4 | Quiz code quality refactoring (7 tasks) | Redo with FTF |
| B | 3 | Eval harness foundation (4 tasks) | Redo with FTF |
| C | 3+4 | Skill creation ×8 | **DONE** — 8 skills verified |

Tracks A and B are fully parallel (zero shared files). Within each track,
test authoring and implementation are strictly separated.

---

## Phase 0: Worktree Cleanup [PREREQUISITE]

Two worktrees from the prior failed execution exist:
- `agent-a8cd4aeb` (Track A): contains test files AND implementation — FTF-tainted
- `agent-aaecfa55` (Track B): contains test files AND implementation — FTF-tainted

Neither has SHA256 baselines. Reusing them would perpetuate the FTF violation.

**Action:** Destroy both worktrees and create fresh ones for Phase 1.

```bash
cd /Users/tuesday-agent/Projects/quigley-multimedia/thehermeticflight
git worktree remove .claude/worktrees/agent-a8cd4aeb --force
git worktree remove .claude/worktrees/agent-aaecfa55 --force
git branch -D worktree-agent-a8cd4aeb worktree-agent-aaecfa55 2>/dev/null
```

**Pass/fail:** Both worktrees removed, `git worktree list` shows only main.

### Entry Point (Phase 0)
- `git worktree list` — shows 3 entries (main + 2 stale worktrees)

### Pass/Fail Criteria (Phase 0)
- `git worktree list` shows only main
- Stale worktree branches deleted
- 474/474 tests pass on main, build clean

### Known Risks (Phase 0)
- Worktree removal may fail if files are locked. Use `--force`.

### Failure Triage (Phase 0)
- If `git worktree remove` fails: manually delete the directory, then
  `git worktree prune` to clean the worktree registry.

---

## Phase 1: Test Authoring [PARALLEL — Tracks A+B]

Both test author dispatches run in parallel. Each operates in a fresh worktree
created from main HEAD (474/474 baseline).

### Phase 1A: Track A Test Author [SUBAGENT: sonnet]

**Role:** Test Author (FTF protocol). Write test files ONLY. Do NOT write
any implementation code.

**Input:** Read test code from `docs/plans/2026-03-09-quiz-refactoring.md`.
The plan contains complete, inline test code for all 7 tasks.

**Files to create (copy from plan doc verbatim):**
1. `tests/dom-helpers.test.ts` — Task 1 test (10 tests)
2. `tests/share-utils.test.ts` — Task 2 test (18 tests)
3. `tests/share-buttons.test.ts` — Task 3 test (16 tests)
4. `tests/ga4-share-events.test.ts` — Task 4 test (16 tests)
5. `tests/archetype-content.test.ts` — Task 5 test (append edge cases to existing file)

**NOTE:** `tests/quiz-flow.spec.ts` is a Playwright file (`.spec.ts` extension),
NOT a Vitest file. It is excluded from `npx vitest run` counts. Write the
file per the plan doc but do NOT include it in the SHA256 baseline loop or
Vitest pass/fail assertions. Its FTF verification runs under Playwright:
`npx playwright test tests/quiz-flow.spec.ts`.

**CRITICAL constraints:**
- Copy test code EXACTLY as written in the plan doc. Do not modify.
- For `archetype-content.test.ts`: append ONLY the new test blocks — do not
  modify existing test code.
- Do NOT create any implementation files.
- After writing all test files, run: `npx vitest run` — new tests SHOULD
  FAIL (module not found errors for implementation files that don't exist
  yet). Existing 474 tests that don't depend on new modules should still pass.

**Record baseline:**
```bash
for f in tests/dom-helpers.test.ts tests/share-utils.test.ts \
         tests/share-buttons.test.ts tests/ga4-share-events.test.ts \
         tests/archetype-content.test.ts; do
  sha256sum "$f" > "${f%.ts}.sha256"
done
```

**Deliverable:** 5 Vitest test files + 1 Playwright spec + 5 SHA256 baseline
files. All committed to worktree branch.

### Phase 1B: Track B Test Author [SUBAGENT: sonnet]

**Role:** Test Author (FTF protocol). Write test files ONLY.

**Input:** Read test code from `docs/plans/2026-03-14-sprint-3-4-parallel.md`,
Track B section. The plan contains complete TypeScript test code for all
3 test files.

**Files to create (copy from plan doc verbatim):**
1. `tests/eval-storage.test.ts` — 5 tests
2. `tests/eval-ga4-client.test.ts` — 5 tests
3. `tests/eval-pagespeed.test.ts` — 5 tests

**CRITICAL constraints:**
- Copy test code EXACTLY as written in the plan doc.
- Do NOT create any implementation files or directories.
- After writing, tests should fail (modules don't exist yet).

**Record baseline:**
```bash
for f in tests/eval-storage.test.ts tests/eval-ga4-client.test.ts \
         tests/eval-pagespeed.test.ts; do
  sha256sum "$f" > "${f%.ts}.sha256"
done
```

**Deliverable:** 3 test files + 3 SHA256 baseline files. All committed to
worktree branch.

### Entry Point (Phase 1)
- `npx vitest run` — 474/474 baseline (pre-authoring), run from worktree root

### Pass/Fail Criteria (Phase 1)
- All test files exist with correct content matching plan docs
- SHA256 baselines recorded for every Vitest test file (5 for Track A, 3 for Track B)
- No implementation files created
- Existing 474 tests unaffected (those not importing new modules still pass)
- All files committed to worktree branch

### Known Risks (Phase 1)
- Tests that append to existing files (archetype-content.test.ts) must not
  break existing tests in that file. Verify by running:
  `npx vitest run tests/archetype-content.test.ts`
- `quiz-flow.spec.ts` uses `.spec.ts` extension excluded from vitest.config.ts.
  Do not count it in Vitest pass/fail totals. Its verification uses Playwright.

### Failure Triage (Phase 1)
- If appending to existing test files breaks them: the new test blocks have
  import issues or syntax errors. Fix the append, re-record SHA256.
- If SHA256 command fails: ensure `sha256sum` is available (`shasum -a 256`
  on macOS if `sha256sum` is not installed).

---

## Phase 2: Implementation [PARALLEL — Tracks A+B]

Both implementer dispatches run in parallel. Each operates in the SAME
worktree as its corresponding test author from Phase 1 (to pick up the
frozen test files and SHA256 baselines from the committed branch).

**Implementer entry verification (both tracks):**
```bash
cd <worktree-root>
npx vitest run 2>&1 | tail -5
# Expected: new tests FAILING (module not found), existing tests PASSING
ls tests/*.sha256
# Expected: SHA256 files present from Phase 1
```

### Phase 2A: Track A Implementer [SUBAGENT: sonnet]

**Role:** Implementer (FTF protocol). Write implementation code to make
frozen tests pass. Do NOT modify any test file.

**Input:** Read implementation code from `docs/plans/2026-03-09-quiz-refactoring.md`.
Read the frozen test files already in the worktree. Read `tests/hardening-high.test.ts`
and `tests/hardening-medium.test.ts` BEFORE any work to understand existing contracts.

**Implementation order (sequential — each depends on previous):**

1. **Task 1:** Create `src/lib/dom-helpers.ts` → `npx vitest run tests/dom-helpers.test.ts`
2. **Task 2:** Create `src/lib/share-utils.ts` → `npx vitest run tests/share-utils.test.ts`
3. **Task 3:** Create `src/components/ShareButtons.astro` → `npx vitest run tests/share-buttons.test.ts`
4. **Task 4:** (No new implementation — ga4-share-events tests are structural/source-level tests
   against files from Tasks 1-3 + existing quiz pages) → `npx vitest run tests/ga4-share-events.test.ts`
5. **Task 5:** Harden `src/lib/archetype-content.ts` edge cases → `npx vitest run tests/archetype-content.test.ts`
6. **Task 6:** Refactor `src/pages/quiz.astro` and `src/pages/quiz/result/[archetype].astro`
   to import and use the new modules. **CRITICAL:** ALL existing 474 tests must still
   pass after this step. Do not remove HTML structure that existing hardening tests
   verify (share-section id, transition classes, absence of email-success gate).
   Read `tests/hardening-high.test.ts` and `tests/hardening-medium.test.ts` BEFORE
   making changes to understand the contracts they enforce.
7. **Task 7:** Quality gate — `npx vitest run && npx astro build`

**After each task:**
```bash
npx vitest run 2>&1 | tail -5  # All tests pass (existing + new so far)
```

**After all tasks — FTF verification:**
```bash
# Verify frozen test files not modified
for f in tests/dom-helpers.test.ts tests/share-utils.test.ts \
         tests/share-buttons.test.ts tests/ga4-share-events.test.ts \
         tests/archetype-content.test.ts; do
  sha256sum -c "${f%.ts}.sha256"
done
# Must output "OK" for every file
```

**CRITICAL constraints:**
- NEVER modify any file matching `tests/*.test.ts` or `tests/*.spec.ts`.
- If a test fails, fix the IMPLEMENTATION, not the test.
- For Task 6: the quiz.astro refactoring must preserve all HTML contracts
  that existing hardening tests verify:
  - `#share-section` must exist with transition classes (`opacity-0 translate-y-4 transition-all duration-700 delay-[1200ms]`)
  - No `#email-success` wrapper around share section
  - `encodeURIComponent` used for share URLs
  - Share URLs use `www.thehermeticflight.com` domain
  - Clipboard writes wrapped in try/catch
- If ga4-share-events tests check for trackShare/gtag patterns in
  `[archetype].astro`, ensure the refactored page still contains those
  patterns (either via component import or inline).

**Deliverable:** All implementation files, 474+ tests passing, build clean,
SHA256 verification passing. All committed to worktree branch.

### Phase 2B: Track B Implementer [SUBAGENT: sonnet]

**Role:** Implementer (FTF protocol). Write implementation code to make
frozen tests pass. Do NOT modify any test file.

**Input:** Read implementation specs from `docs/plans/2026-03-14-sprint-3-4-parallel.md`,
Track B section. Read frozen test files already in the worktree.

**Implementation order:**

1. **Task B1:** Create `src/lib/eval/types.ts` and `src/lib/eval/storage.ts`
   → `npx vitest run tests/eval-storage.test.ts`
2. **Task B2:** Create `src/lib/eval/ga4-client.ts`
   → `npx vitest run tests/eval-ga4-client.test.ts`
3. **Task B3:** Create `src/lib/eval/pagespeed.ts`
   → `npx vitest run tests/eval-pagespeed.test.ts`
4. **Task B4:** Create `scripts/eval/run-ga4-query.ts` and `scripts/eval/run-pagespeed.ts`
   (CLI wrappers — verify with commands below)
5. Add `data/eval/` to `.gitignore`

**Task B4 verification commands:**
```bash
# PageSpeed (unauthenticated — should produce CWV output):
npx tsx scripts/eval/run-pagespeed.ts --url https://www.thehermeticflight.com/
# Expected: prints lcp/cls/inp/performance values, exits 0

# GA4 (no credentials — should show clear error, not crash):
npx tsx scripts/eval/run-ga4-query.ts
# Expected: "GA4 credentials not configured" or similar, exits non-zero but
# does not throw an uncaught exception
```

**After all tasks — FTF verification:**
```bash
# Verify frozen test files not modified
for f in tests/eval-storage.test.ts tests/eval-ga4-client.test.ts \
         tests/eval-pagespeed.test.ts; do
  sha256sum -c "${f%.ts}.sha256"
done
# Full suite
npx vitest run && npx astro build
```

**Deliverable:** All eval modules, 474+ tests passing, build clean,
SHA256 verification passing. All committed to worktree branch.

### Entry Point (Phase 2)
- Phase 1 worktrees with frozen test files and SHA256 baselines committed
- `npx vitest run` from worktree root — new tests failing (expected), existing 474 passing

### Pass/Fail Criteria (Phase 2)
- ALL tests pass (474 existing + all new)
- `npx astro build` clean
- SHA256 verification passes for every frozen test file
- No test files modified by implementer
- `data/eval/` is present in `.gitignore` (Track B): `grep 'data/eval/' .gitignore` must match
- All implementation committed to worktree branch

### Known Risks (Phase 2)
- **Task 6 (Track A)** is highest risk — modifies quiz.astro and [archetype].astro.
  Existing hardening tests enforce structural contracts on these files.
  The implementer MUST read hardening tests before modifying these pages.
- GA4 client JWT signing uses `crypto.createSign()` (Node-only). Tests mock
  fetch to bypass this. Implementation must skip JWT when fetchFn is provided.
- Dynamic imports in vitest may cache modules. Use `vi.resetModules()` if
  needed.

### Failure Triage (Phase 2)
- If Track A Task 6 breaks hardening tests: the implementer must read the
  failing test, understand the contract, and adjust the IMPLEMENTATION
  (not the test) to satisfy it. If the contract is genuinely incompatible
  with the refactoring goal, flag it for eval-protocol review — do not
  unilaterally modify the test.
- If SHA256 verification fails: FTF violation. Reject the implementation.
  Restore test file from git, re-run implementer.
- If Track B tests fail: compare implementation against plan specs.
  The plan contains complete TypeScript code — the implementation should
  match closely.

---

## Phase 3: Merge + Integration Gate

After both tracks' implementers complete and pass FTF verification:

**Step 0 — Pre-merge status check:**
```bash
cd /Users/tuesday-agent/Projects/quigley-multimedia/thehermeticflight
git status
# Verify only expected files on main (should be clean — 474/474 baseline)
```

**Step 1 — Merge Track B (new files only, zero overlap risk):**
```bash
git merge worktree-track-b --no-ff -m "feat: add eval harness foundation (Sprint 3, Track B)"
```
If merge conflict (unlikely — all new files): resolve, verify, commit.

**Step 2 — Merge Track A (modifies existing files, higher risk):**
```bash
git merge worktree-track-a --no-ff -m "feat: quiz code quality refactoring (Sprint 4, Track A)"
```
If merge conflict: `git status`, resolve conflict in affected files, verify
hardening tests pass, then commit.

**Step 3 — Integration gate:**
```bash
npx vitest run && npx astro build
```
All tests pass + build clean = proceed to Phase 4.

**Step 4 — Verify SHA256 files merged:**
```bash
ls tests/*.sha256
# Expected: dom-helpers.sha256, share-utils.sha256, share-buttons.sha256,
#           ga4-share-events.sha256, archetype-content.sha256,
#           eval-storage.sha256, eval-ga4-client.sha256, eval-pagespeed.sha256
```

### Entry Point (Phase 3)
- Both worktree branches with committed, FTF-verified implementations
- `git worktree list` shows main + 2 worktrees

### Pass/Fail Criteria (Phase 3)
- Full test suite passes (474 existing + all new from both tracks)
- `npx astro build` clean
- No TypeScript errors
- All 8 SHA256 files present in main after merge

### Known Risks (Phase 3)
- Track A and B have zero file overlap, so merge conflicts are not expected.
- The `.gitignore` change from Track B (adding `data/eval/`) is additive only.
- Track A modifies `src/pages/quiz.astro` and `src/pages/quiz/result/[archetype].astro`
  — if main has diverged since worktree creation, conflicts may arise.

### Failure Triage (Phase 3)
- If integration gate fails after merge: identify which track's files cause
  the failure (run tests in isolation per track). Fix in the track's worktree,
  re-verify frozen tests, re-merge.
- If merge conflict in Track A: resolve manually, ensuring hardening test
  contracts are preserved. Run `npx vitest run tests/hardening-high.test.ts`
  after resolution.

---

## Phase 4: Eval-Protocol Review

Deploy evaluation-protocol on the combined Sprint 3+4 output.
**3 evaluators, orthogonal lenses:**

| # | Lens | Focus |
|---|------|-------|
| 1 | **Functional** | Do new modules work correctly? Do refactored pages preserve all behavior? Are eval harness clients making correct API calls? |
| 2 | **Fidelity** | Does the refactoring match the original quiz-refactoring plan specs? Are all 10 findings (ARCH-04 through TCF-10) actually addressed? Do hardening test contracts still hold? |
| 3 | **Quality** | Code quality: dead code, unused imports, type safety, naming conventions, test coverage gaps. Are there new patterns that should have tests but don't? |

**Scope — files to read (evaluators must read ALL before producing findings):**
- `src/lib/dom-helpers.ts`, `src/lib/share-utils.ts`, `src/lib/archetype-content.ts`
- `src/components/ShareButtons.astro`
- `src/pages/quiz.astro`, `src/pages/quiz/result/[archetype].astro`
- `src/lib/eval/types.ts`, `src/lib/eval/storage.ts`, `src/lib/eval/ga4-client.ts`, `src/lib/eval/pagespeed.ts`
- `scripts/eval/run-ga4-query.ts`, `scripts/eval/run-pagespeed.ts`
- All new test files: `tests/dom-helpers.test.ts`, `tests/share-utils.test.ts`,
  `tests/share-buttons.test.ts`, `tests/ga4-share-events.test.ts`,
  `tests/eval-storage.test.ts`, `tests/eval-ga4-client.test.ts`, `tests/eval-pagespeed.test.ts`
- Existing hardening tests: `tests/hardening-high.test.ts`, `tests/hardening-medium.test.ts`

**Evaluator dispatch spec (per subagent-prompt-spec):**
- **Files to read:** All files listed above (full paths from project root)
- **Exact deliverable:** Findings list with severity (Critical/High/Medium/Low),
  file:line reference, and one-sentence description per finding
- **Constraints:** Read-only — do not modify any file; do not execute tests
- **Pass/fail:** Findings list produced covering all scope files; no scope file
  skipped; Critical findings call out broken behavior with specific reproduction path

**Synthesis:** Orchestrator deduplicates, produces immutable synthesis at
`operations/eval-sprint-3-4/synthesis.md`.

### Entry Point (Phase 4)
- Integration gate passed (Phase 3)
- All files from Tracks A+B merged into main

### Pass/Fail Criteria (Phase 4)
- Synthesis report produced with all findings categorized
- No Critical findings remain unaddressed (Critical = broken behavior)
- High findings have remediation plan

### Known Risks (Phase 4)
- Evaluators may flag the existing plan code as suboptimal — that's expected.
  The plan code was written to address specific findings; evaluators may
  identify new concerns.

### Failure Triage (Phase 4)
- Critical findings → immediate FTF remediation cycle (Phase 5)
- High findings → FTF remediation cycle (Phase 5)
- Medium/Low → backlog for future sprint

---

## Phase 5: Remediation [IF NEEDED]

For each Critical or High finding from Phase 4:

1. Test author writes a test capturing the finding
2. Record SHA256 baseline
3. Implementer fixes the issue
4. Verify frozen test, run full suite

Group findings by affected file to minimize remediation cycles.

### Entry Point (Phase 5)
- Eval synthesis from Phase 4 with prioritized findings

### Pass/Fail Criteria (Phase 5)
- All Critical findings remediated with tests
- All High findings remediated with tests
- Full suite passes, build clean
- SHA256 verification passes for all remediation test files

### Known Risks (Phase 5)
- Remediation of one finding may introduce new issues. Run full suite
  after each remediation.

### Failure Triage (Phase 5)
- If a remediation breaks existing tests: revert the fix, re-analyze
  the finding. The finding description may be incorrect or the fix
  approach wrong.

---

## Phase 6: Commit + Taskboard Update

**Step 0 — Pre-staging check:**
```bash
git status
# Verify only expected files are modified/untracked:
#   src/lib/ new files, src/components/ShareButtons.astro,
#   src/pages/quiz.astro, src/pages/quiz/result/[archetype].astro,
#   src/lib/eval/, scripts/eval/, tests/*.test.ts, tests/*.sha256, .gitignore
# NOT expected: node_modules/, .DS_Store, any .env files
```

**Steps:**
1. Stage all new and modified files by name (not `git add -A`)
2. Commit with descriptive message referencing Sprint 3+4
3. Update TASKBOARD.md: mark Sprint 3+4 phase as `completed`
4. Update Handoff Context with summary
5. Commit taskboard update separately

### Entry Point (Phase 6)
- Phase 5 complete (or Phase 3 if no remediation needed)
- All tests pass, build clean

### Pass/Fail Criteria (Phase 6)
- Clean commit(s) with all Sprint 3+4 artifacts
- TASKBOARD.md updated with completion status and handoff context
- No test regressions
- `git status` clean after commits

### Known Risks (Phase 6)
- Stashed prior work (`git stash list`) still exists — do not accidentally
  pop it. It served as reference only.

### Failure Triage (Phase 6)
- If pre-commit hooks fail: fix the issue, create a new commit.

---

## Execution Order Summary

```
Phase 0: Destroy stale worktrees from prior failed execution

Phase 1 (parallel, fresh worktrees):
  ├── 1A: Track A Test Author (sonnet, worktree) — write 5 test files + 1 spec + baselines
  └── 1B: Track B Test Author (sonnet, worktree) — write 3 test files + baselines

Phase 2 (parallel, same worktrees as Phase 1):
  ├── 2A: Track A Implementer (sonnet, same worktree as 1A) — 7 tasks, sequential
  └── 2B: Track B Implementer (sonnet, same worktree as 1B) — 4 tasks

Phase 3: Merge both tracks into main (git merge --no-ff) + integration gate

Phase 4: Eval-protocol (3 evaluators, orthogonal lenses, read-only)

Phase 5: Remediation (FTF cycles for Critical/High findings) [IF NEEDED]

Phase 6: Commit + taskboard update
```
