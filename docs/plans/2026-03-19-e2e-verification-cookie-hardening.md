# E2E Verification — Close Side Door + Cookie Hardening

**Date:** 2026-03-19
**Branch:** `feature/quiz-design-overhaul`
**Prerequisite:** All 5 implementation phases of Close Side Door + Cookie Hardening completed. 639/639 unit tests pass, build clean. E2E specs updated but never run against a live server.

## Problem Statement

The Playwright E2E suite and raw Playwright journey-pages tests have been updated for the side-door closure (gate form → quiz CTA, multi-slug cookie, 180-day Max-Age) but never executed against the live preview server. Run the full suite, remediate any failures via FTF discipline, then harden and evaluate the live cookie behavior.

## Phases

### Phase 1: FTF Baseline on E2E Specs

**Brief:** Freeze the 6 E2E spec files as test contracts. Any remediation in Phase 3 must fix source, not tests.

**Entry point:** All E2E specs committed and up to date.

**Steps:**
1. Run `bash ~/.claude/skills/frozen-test-file/record-baseline.sh tests/` to capture baseline on all test files.
2. Verify baseline recorded: check `.frozen-test-baseline` and `.frozen-test-manifest` exist.

**Pass/fail:** Baseline file created. Tag exists in git.

**Known risks:** None — recording only, no code changes.

**Failure triage:** If record-baseline.sh errors, check git status for uncommitted changes in tests/.

---

### Phase 2: Build + Full E2E Suite [SUBAGENT: sonnet]

**Brief:** Build the site and run all E2E tests against the live preview server.

**Entry point:** Phase 1 complete (baselines recorded).

**Steps:**
1. Run `npm run build` — must succeed (already verified, but confirm).
2. Run `npx playwright test` — this auto-starts the preview server per `playwright.config.ts` webServer config. Captures results for 5 @playwright/test files:
   - `quiz-gate-e2e.spec.ts` — Layer 1 (quiz results gating) + Layer 2 (journey page gating)
   - `quiz-v2-e2e.spec.ts` — Quiz v2 full flow (frozen — must not fail)
   - `quiz-flow.spec.ts` — Legacy quiz flow
   - `quiz-a11y.spec.ts` — Accessibility
   - `thank-you-redirect.spec.ts` — Thank-you page redirect
3. After Playwright completes, run raw Playwright test separately:
   - Start preview: `npm run preview &`
   - Wait for server: `sleep 3`
   - Run: `npx tsx tests/journey-pages.spec.ts`
   - Kill server: `kill %1`
4. Report all results: test counts, pass/fail per file, any failure details.

**Pass/fail:** All E2E tests pass across all 6 files. If failures exist, document them for Phase 3.

**Known risks:**
- Port 4321 may be occupied from a previous run. Kill any stale processes first: `lsof -ti:4321 | xargs kill 2>/dev/null || true`.
- `quiz-v2-e2e.spec.ts` is frozen from the quiz overhaul — if it fails, something in Phase 3 of the side-door changes broke quiz behavior. Investigate before touching any source.
- `journey-pages.spec.ts` uses raw `chromium.launch()` — needs Playwright browsers installed (`npx playwright install chromium`).
- Playwright config timeout is 30s per test; quiz flow tests with 12 questions + animations may need up to 25s.

**Failure triage:**
- If build fails: check for uncommitted type errors.
- If preview server doesn't start: check port 4321, check build output exists in `dist/`.
- If E2E tests timeout: increase Playwright config timeout or check for missing UI elements.
- If specific assertions fail: read the error, identify which selector/element is wrong, document for Phase 3.

---

### Phase 3: Remediation via FTF [SUBAGENT: sonnet]

**Brief:** Fix any E2E failures by modifying source code only. E2E specs are frozen contracts — do not modify them. Skip this phase if Phase 2 is all-green.

**Entry point:** Phase 2 complete with documented failures.

**Steps:**
1. For each failing test, identify the root cause:
   - Missing DOM element (selector mismatch) → fix the Astro template
   - Cookie value mismatch → fix cookie-helpers or setThfSubCookie
   - Timing issue → fix animation/transition timing in source
   - Server error → fix API endpoint
2. Apply targeted fixes to source files only.
3. Re-run the specific failing test file to confirm the fix: `npx playwright test tests/<file>.spec.ts`
4. Run `bash ~/.claude/skills/frozen-test-file/verify-frozen.sh` to confirm no test files were modified.
5. Run `npx vitest run` to confirm unit tests still pass (no regression).

**Pass/fail:** All previously failing tests now pass. `verify-frozen.sh` passes (all 6 checks). Unit tests still 639/639.

**Known risks:**
- A fix for one E2E test could break another. Always re-run the full suite after fixes, not just the failing file.
- If `quiz-v2-e2e.spec.ts` fails, the issue is likely in quiz.astro or quiz-submit.ts — not in the cookie changes. Investigate carefully before changing anything.

**Failure triage:**
- If verify-frozen.sh fails: the implementer touched a test file. Revert and re-do.
- If the fix causes unit test regression: the fix is wrong. Revert and try a different approach.
- If the root cause is ambiguous: escalate to operator with failing test output and source context.

---

### Phase 4: Harden — Live Cookie Verification [SUBAGENT: sonnet] x2

**Brief:** Verify the cookie infrastructure works correctly in the live preview environment. Two parallel subagents with orthogonal lenses.

**Entry point:** Phase 2 (or Phase 3 if remediation was needed) complete — all E2E tests pass.

**Subagent A — Cookie Header Audit:**
1. Start preview server: `npm run build && npm run preview &`
2. Wait for server ready.
3. Test quiz-submit Set-Cookie:
   ```bash
   curl -s -D - -X POST http://localhost:4321/api/quiz-submit \
     -H 'Content-Type: application/json' \
     -H 'Cookie: thf_sub=shadow-dancer' \
     -d '{"email":"test@test.com","firstName":"Test","answers":{...}}' \
     2>&1 | grep -i 'set-cookie'
   ```
   Verify: `thf_sub=` present, `Path=/`, `Max-Age=15552000`, `SameSite=Lax`, `Secure`, NO `HttpOnly`.
4. Test journey-subscribe Set-Cookie:
   ```bash
   curl -s -D - -X POST http://localhost:4321/api/journey-subscribe \
     -H 'Content-Type: application/json' \
     -H 'Cookie: thf_sub=air-weaver' \
     -d '{"email":"test@test.com","firstName":"Test","archetype":"shadow-dancer"}' \
     2>&1 | grep -i 'set-cookie'
   ```
   Verify: same attributes + multi-slug merge (value contains both `air-weaver` and `shadow-dancer`).
5. Test cookie renewal on journey page:
   ```bash
   curl -s -D - http://localhost:4321/archetype/air-weaver \
     -H 'Cookie: thf_sub=air-weaver' \
     2>&1 | grep -i 'set-cookie'
   ```
   Verify: `Set-Cookie` header present with refreshed Max-Age.
6. Kill server.
7. Write results to `operations/harden-cookie-headers.md`.

**Subagent B — Cookie Injection + Gate Bypass Audit:**
1. Start preview server (or reuse from A if sequential).
2. Test gate bypass with forged cookie:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/archetype/air-weaver \
     -H 'Cookie: thf_sub=INJECTED'
   ```
   Verify: returns 200 but content is gated (check for `#journey-quiz-cta` in HTML).
3. Test multi-slug gate bypass:
   ```bash
   curl -s http://localhost:4321/archetype/air-weaver \
     -H 'Cookie: thf_sub=shadow-dancer' | grep -c 'journey-quiz-cta'
   ```
   Verify: quiz CTA present (wrong archetype = gated).
4. Test correct multi-slug access:
   ```bash
   curl -s http://localhost:4321/archetype/air-weaver \
     -H 'Cookie: thf_sub=shadow-dancer%2Cair-weaver' | grep -c 'journey-content'
   ```
   Verify: journey content visible (correct archetype in multi-slug).
5. Test cookie injection via comma-separated malicious value:
   ```bash
   curl -s http://localhost:4321/archetype/air-weaver \
     -H 'Cookie: thf_sub=air-weaver%2C../../etc/passwd' | grep -c 'journey-content'
   ```
   Verify: content shows (path traversal in cookie value doesn't cause errors).
6. Test SEO structured data presence:
   ```bash
   curl -s http://localhost:4321/archetype/air-weaver | grep -c 'isAccessibleForFree'
   ```
   Verify: count >= 1.
7. Kill server.
8. Write results to `operations/harden-cookie-injection.md`.

**Pass/fail:** All curl assertions pass. Both hardening reports written. No cookie injection bypasses.

**Known risks:**
- LOOPS_API_KEY not set in preview — quiz-submit will fail at Loops.so step. Use `--max-time 5` on curl and check only the Set-Cookie header (it may be set before the Loops.so call fails, or the response may be a 500 with Set-Cookie if the header is set early). If the Set-Cookie is only added on the success path (after Loops.so), the curl test will need a mock or the LOOPS_API_KEY env var.
- The preview server runs on HTTP (localhost), but Set-Cookie includes `Secure`. Most modern browsers accept Secure cookies on localhost, but `curl` doesn't care about Secure — it just reads the header.

**Failure triage:**
- If Set-Cookie is missing on quiz-submit: the success response path wasn't reached (Loops.so failed). Either set LOOPS_API_KEY or test journey-subscribe instead (which has simpler validation).
- If injection test reveals unexpected behavior: document and escalate.

---

### Phase 5: Eval Protocol — 2 Evaluators

**Brief:** Two independent evaluators assess the live-verified implementation. The implementation was already evaluated post-unit-tests (Security 4.1/5.0, UX 3.9/5.0). This is a delta eval focused on live behavior.

**Entry point:** Phase 4 complete — hardening reports on disk.

**Evaluator 1 — Live Functional Integrity [SUBAGENT: sonnet]:**
- Read E2E test results from Phase 2
- Read hardening reports from Phase 4
- Read `operations/eval-close-side-door-ux.md` (previous eval)
- Assess: Do E2E tests cover all user paths? Are there gaps between unit test coverage and E2E coverage? Does the live server behavior match expected behavior from the plan?
- Score: 1.0-5.0 with findings
- Write to `operations/eval-e2e-functional.md`

**Evaluator 2 — Live Security Integrity [SUBAGENT: sonnet]:**
- Read hardening reports from Phase 4 (cookie headers + injection)
- Read `operations/eval-close-side-door-security.md` (previous eval)
- Assess: Are Set-Cookie attributes correct in live responses? Does the multi-slug merge work correctly in live curl tests? Are there any injection vectors not covered by the hardening audit?
- Score: 1.0-5.0 with findings
- Write to `operations/eval-e2e-security.md`

**Pass/fail:** Both evaluators score >= 3.5/5.0. Critical findings (severity >= HIGH) must be remediated.

**Known risks:** False positives from the quiz-submit curl test if LOOPS_API_KEY is not set.

**Failure triage:** Remediate any HIGH findings via targeted fixes + re-run affected tests.

---

### Phase 6: Memory + Commit

**Brief:** Record learnings from E2E verification, commit all artifacts.

**Steps:**
1. Update project memory (`MEMORY.md`) with:
   - E2E test results (pass counts per file)
   - Any failures found and how they were fixed
   - Hardening findings
   - Eval scores
2. Commit all Phase 4-5 artifacts (hardening reports, eval reports).
3. Update TASKBOARD.md handoff context if the active task changed.

**Pass/fail:** Memory updated. Artifacts committed. No uncommitted changes.

---

## Dependencies

```
Phase 1 (FTF baseline) ──→ Phase 2 (E2E suite) ──→ Phase 3 (remediation, if needed)
                                                          ↓
                                                     Phase 4A (cookie headers)  } parallel
                                                     Phase 4B (cookie injection) }
                                                          ↓
                                                     Phase 5A (functional eval)  } parallel
                                                     Phase 5B (security eval)    }
                                                          ↓
                                                     Phase 6 (memory + commit)
```

Phase 3 is conditional — skip if Phase 2 is all-green.
Phases 4A and 4B are parallel.
Phases 5A and 5B are parallel.

## Hard Constraints

- E2E spec files are frozen contracts — do not modify during remediation
- `quiz-v2-e2e.spec.ts` must not be modified under any circumstances
- FTF verification (`verify-frozen.sh`) must pass after any remediation
- Unit tests must remain 639/639 after any source changes
- Build must remain clean
- LOOPS_API_KEY may not be available in preview — plan curl tests accordingly
