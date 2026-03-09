# Verification Playbook — Hardening Sprint 2026-03-07

## Prerequisites
- Node.js 18+
- Working checkout of `feature/native-quiz-pipeline` branch
- `npm install` completed

## Per-Finding Checks

### SYN-01: Auto-advance race condition
**Command:**
```bash
grep -c 'clearTimeout' src/pages/quiz.astro
```
**Expected:** At least 2 (one in answer handler, one in back handler)

### SYN-02: Answer payload validation
**Command:**
```bash
npx vitest run tests/quiz-submit.test.ts -t "SYN-02"
```
**Expected:** 12 tests pass, exit code 0

### SYN-03: Email validation
**Command:**
```bash
npx vitest run tests/quiz-submit.test.ts -t "SYN-03"
```
**Expected:** 15 tests pass, exit code 0

### SYN-04: Rate limiting
**Command:**
```bash
npx vitest run tests/quiz-submit.test.ts -t "SYN-04"
```
**Expected:** 3 tests pass, exit code 0

### SYN-05: Server-side bot detection
**Command:**
```bash
npx vitest run tests/quiz-submit.test.ts -t "SYN-05"
```
**Expected:** 5 tests pass, exit code 0

### SYN-06: Loops.so fetch timeout
**Command:**
```bash
npx vitest run tests/quiz-submit.test.ts -t "SYN-06"
```
**Expected:** 7 tests pass, exit code 0

### SYN-07: Non-scored answers as human-readable text
**Command:**
```bash
npx vitest run tests/quiz-submit-medium.test.ts -t "SYN-07"
```
**Expected:** 5 tests pass, exit code 0

### SYN-08: API route test coverage
**Command:**
```bash
npx vitest run tests/quiz-submit.test.ts tests/quiz-submit-medium.test.ts --reporter=verbose 2>&1 | tail -5
```
**Expected:** 68 tests pass across 2 files

### SYN-09: Back-button structural verification
**Command:**
```bash
npx vitest run tests/quiz-submit-medium.test.ts -t "SYN-09"
```
**Expected:** 3 tests pass, exit code 0

### SYN-10: Archetype content coverage
**Command:**
```bash
npx vitest run tests/archetype-content.test.ts
```
**Expected:** 47 tests pass, exit code 0

### SYN-11: Q11 flow state extraction
**Command:**
```bash
npx vitest run tests/quiz-submit-medium.test.ts -t "SYN-11"
```
**Expected:** 4 tests pass, exit code 0

### SYN-12: Type safety in quiz.astro
**Command:**
```bash
grep -c '(window as any)' src/pages/quiz.astro
```
**Expected:** 0

### SYN-13: Idempotency key normalization
**Command:**
```bash
npx vitest run tests/quiz-submit-medium.test.ts -t "SYN-13"
```
**Expected:** 3 tests pass, exit code 0

### SYN-14: Environment type declarations
**Command:**
```bash
test -f src/env.d.ts && grep -q 'LOOPS_API_KEY' src/env.d.ts && echo "PASS" || echo "FAIL"
```
**Expected:** PASS

## Aggregate Check
```bash
npx vitest run && npx astro build && echo "ALL CHECKS PASS"
```
**Expected:** 253 tests pass, build completes, "ALL CHECKS PASS" printed. Exit code 0.
