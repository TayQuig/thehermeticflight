# Evaluation Report: Architectural Quality & Maintainability

**Evaluator lens:** Architectural Quality & Maintainability
**Date:** 2026-03-07
**Scope:** Quiz pipeline — data, classifier, content, UI, API, tests, configuration

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 5     |
| Medium   | 7     |

**Overall assessment:** The codebase has excellent separation of concerns between data,
logic, display, and API layers. The shared classifier between client and server is the
correct architectural choice. TypeScript is used well in the library modules. However,
the client-side UI layer has several type safety gaps, the API route lacks sufficient
input validation, and a genuine race condition exists in the auto-advance mechanism.
Test infrastructure is solid for unit tests but the browser test is disconnected from
the test runner.

---

## Findings

### [A-01]: Auto-advance race condition allows double-step skipping
**Severity:** Critical
**Affected files:** `src/pages/quiz.astro` (lines 286-306)
**Description:** When a user clicks an answer, a 500ms `setTimeout` fires to advance
to the next step. If the user clicks a different answer during that 500ms window (e.g.,
changing their mind quickly, or via double-click on a touch device), the first timeout
still fires `showStep(state.currentStep + 1)`. The second click then queues another
timeout that fires `showStep(state.currentStep + 1)` again using the *already-incremented*
`currentStep`. The result is that the quiz skips an entire question, which the user may
never see. On a touch device with accidental double-taps this is realistic, not just
theoretical.
**Evidence:**
```typescript
// quiz.astro lines 298-305
state.answers[questionId] = answerId;

// Auto-advance after selection animation
setTimeout(() => {
  const nextStep = state.currentStep + 1;
  showStep(nextStep <= TOTAL_QUESTIONS ? nextStep : TOTAL_QUESTIONS + 1);
}, 500);
```
No guard prevents multiple pending timeouts. The fix requires either (a) storing and
clearing a `pendingAdvanceTimeout` ID, or (b) capturing `state.currentStep` at click
time and checking it hasn't changed when the timeout fires.

---

### [A-02]: API route performs no validation on answer payload structure
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts` (lines 19-24)
**Description:** The API validates `answers` exists and is an object, but does not
verify that the keys are valid question IDs or that the values are valid answer IDs.
An attacker could submit `{"answers": {"FAKE": "FAKE-A"}}` and the server would
compute scores of `{A:0, B:0, C:0, D:0}`, classify as `air_weaver`, and push that
to Loops.so. This pollutes the subscriber list with garbage data. More importantly,
answer values are passed directly to Loops.so as `experienceLevel`, `painPoint`,
`cardBackPref`, `productInterest` without any allowlist check, meaning arbitrary
strings flow into the CRM.
**Evidence:**
```typescript
// quiz-submit.ts lines 31-34 — raw answers forwarded to Loops.so
const experienceLevel = answers['Q2'] || null;
const painPoint = answers['Q3'] || null;
const cardBackPref = answers['Q19'] || null;
const productInterest = answers['Q20'] || null;
```
No validation that these values match `Q2-A`, `Q2-B`, `Q2-C` etc.

---

### [A-03]: Email validation is trivially bypassable
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts` (line 13)
**Description:** The email validation is `!email.includes('@')`, which accepts
strings like `"@@"`, `"@"`, `"a@b"`, `"<script>@x"`, etc. While Loops.so likely
performs its own validation, the API should not rely on downstream services for
input validation. Malformed emails that pass this check but fail at Loops.so will
cause silent data loss (the 500 error path only says "Failed to register" with no
specifics returned to the user).
**Evidence:**
```typescript
if (!email || typeof email !== 'string' || !email.includes('@')) {
```
A regex like `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` would be a minimal improvement.

---

### [A-04]: `(window as any)` used for cross-function state sharing
**Severity:** High
**Affected files:** `src/pages/quiz.astro` (lines 257-258, 353)
**Description:** The `revealResults()` function stores the archetype and scores on
`(window as any).__quizArchetype` and `(window as any).__quizScores`, then the email
form submit handler reads `(window as any).__quizArchetype` for the analytics event.
This is unnecessary because both functions exist in the same `<script>` module scope.
A simple module-level variable would work. The `as any` casts bypass TypeScript's type
system entirely and create invisible coupling between two parts of the code. If
`revealResults()` is ever refactored to not set these globals, the analytics event
silently sends `undefined` as the archetype value.
**Evidence:**
```typescript
// Line 257-258 (revealResults)
(window as any).__quizArchetype = archetype;
(window as any).__quizScores = scores;

// Line 353 (form submit handler)
archetype: (window as any).__quizArchetype,
```
Fix: replace with `let computedArchetype: ArchetypeSlug | null = null;` at module scope.

---

### [A-05]: Non-null assertions (`!`) on all DOM element queries with no fallback
**Severity:** High
**Affected files:** `src/pages/quiz.astro` (lines 189-202)
**Description:** Fourteen DOM element references are obtained via
`document.getElementById()!` and `document.querySelector()!` with non-null assertions.
If any element ID is renamed in the template without updating the script, the code
crashes at runtime with no meaningful error message. Since this is a marketing quiz,
a runtime crash means a lost lead. The non-null assertion suppresses the TypeScript
warning that would otherwise flag the potential null.
**Evidence:**
```typescript
const progressBar = document.getElementById('progress-bar')!;
const progressFill = document.getElementById('progress-fill')!;
// ... 12 more with !
```
At minimum, a runtime guard at initialization (`if (!progressBar) throw new Error(...)`)
would provide a clear diagnostic.

---

### [A-06]: No fetch timeout for Loops.so API call
**Severity:** High
**Affected files:** `src/pages/api/quiz-submit.ts` (lines 47-76)
**Description:** The `fetch()` call to `https://app.loops.so/api/v1/events/send` has
no timeout. If Loops.so is slow or unresponsive, the Vercel serverless function hangs
until the Vercel function timeout (default 10s for hobby, 60s for pro). During that
time, the user sees "Sending..." with no feedback. Additionally, `loopsRes.json()` on
line 78 will throw if Loops.so returns a non-JSON response (e.g., HTML error page or
empty body), and this throw is caught by the outer try/catch — but the error message
("Internal server error") gives no indication that the upstream service failed.
**Evidence:**
```typescript
const loopsRes = await fetch('https://app.loops.so/api/v1/events/send', {
  method: 'POST',
  // no AbortController, no timeout
  ...
});
const loopsData = await loopsRes.json(); // can throw on non-JSON
```

---

### [A-07]: Missing `src/env.d.ts` for Astro environment type declarations
**Severity:** Medium
**Affected files:** Project root (missing `src/env.d.ts`), `src/pages/api/quiz-submit.ts`
**Description:** Astro projects use `src/env.d.ts` to declare `ImportMetaEnv` types so
that `import.meta.env.LOOPS_API_KEY` has type information. Without this file,
`import.meta.env.LOOPS_API_KEY` is typed as `any`, meaning typos in environment variable
names (e.g., `LOOP_API_KEY` vs `LOOPS_API_KEY`) are not caught at compile time. The
project has no `tsconfig.json` at the root either, relying entirely on Astro's defaults.
**Evidence:** `Glob('src/env.d.ts')` returns no files. `Glob('tsconfig.json')` returns
no project-root file (only files inside `node_modules/`).

---

### [A-08]: Browser test is disconnected from test runner
**Severity:** Medium
**Affected files:** `tests/quiz-browser.test.mjs`, `vitest.config.ts`, `package.json`
**Description:** The vitest config includes only `tests/**/*.test.ts`, which excludes
`quiz-browser.test.mjs` (wrong extension). The browser test is a standalone Playwright
script that must be run manually with `node tests/quiz-browser.test.mjs` against a
running dev server on port 4322. There is no `test:browser` script in `package.json`,
no CI integration, and no documentation on how to run it. This means browser tests
may be forgotten or broken without anyone noticing.
**Evidence:**
```typescript
// vitest.config.ts
test: {
  include: ['tests/**/*.test.ts'],  // excludes .mjs files
}
```
```json
// package.json scripts — no test:browser
"test": "vitest run",
"test:watch": "vitest"
```

---

### [A-09]: Duplicate type definition in classifier.ts
**Severity:** Medium
**Affected files:** `src/lib/classifier.ts` (line 91)
**Description:** The `answerScoringMap` in `computeScores()` has an inline type
annotation `{ dimension: 'A' | 'B' | 'C' | 'D'; points: number }[]` which is a
structural duplicate of the already-exported `ScoringWeight` type from `quiz-data.ts`.
This creates a maintenance burden: if `ScoringWeight` changes (e.g., adding a
`multiplier` field), the inline type in `classifier.ts` would not get updated,
potentially causing silent type mismatches.
**Evidence:**
```typescript
// classifier.ts line 91
const answerScoringMap = new Map<string, { dimension: 'A' | 'B' | 'C' | 'D'; points: number }[]>();

// quiz-data.ts lines 19-22 (the type this should import)
export interface ScoringWeight {
  dimension: Dimension;
  points: number;
}
```

---

### [A-10]: Redundant Octokit dependencies
**Severity:** Medium
**Affected files:** `package.json`
**Description:** Both `@octokit/rest` (^22.0.1) and `octokit` (^5.0.5) are listed as
dependencies. The `octokit` package is a superset that includes `@octokit/rest`. Only
one should be needed. While this does not affect the quiz pipeline directly, it increases
`node_modules` size and potential dependency conflicts. Neither is used by the quiz
pipeline — they belong to the SEObot webhook route.
**Evidence:**
```json
"@octokit/rest": "^22.0.1",
"octokit": "^5.0.5",
```

---

### [A-11]: No `test:browser` script and hardcoded dev server port
**Severity:** Medium
**Affected files:** `tests/quiz-browser.test.mjs` (line 11), `package.json`
**Description:** The browser test hardcodes `http://localhost:4322/quiz` as the test
URL. If the dev server runs on a different port (Astro defaults to 4321, not 4322),
the test fails with a connection error that does not clearly indicate the root cause.
There is no documentation, npm script, or automation to start the dev server before
the browser test runs.
**Evidence:**
```javascript
await page.goto('http://localhost:4322/quiz', { waitUntil: 'networkidle' });
```

---

### [A-12]: Classifier scalability requires careful priority management
**Severity:** Medium
**Affected files:** `src/lib/classifier.ts` (lines 43-73)
**Description:** The priority-cascade classifier uses a hardcoded if/else chain with
6 priority levels. Adding a new combination archetype (e.g., one that detects B+C
co-dominance differently from Flow Artist) requires inserting a new condition at the
correct priority position and understanding how it interacts with all existing conditions.
The cascade is well-documented with comments, but there is no validation that the
priority rules are exhaustive or non-overlapping (the tests cover this empirically,
not structurally). For the current 6 archetypes this is manageable, but at 8+ archetypes
the combinatorial complexity of the priority interactions becomes error-prone.
**Evidence:** The classify function is a linear chain of 6 conditions. Each new
combination archetype added requires reasoning about interactions with all existing
conditions. The test suite covers many boundary cases but cannot cover all possible
score distributions.

---

### [A-13]: Progress bar percentage off by one on first question
**Severity:** Medium
**Affected files:** `src/pages/quiz.astro` (line 234)
**Description:** When the user is on step 1 (first question), the progress bar
calculates `(step - 1) / TOTAL_QUESTIONS * 100 = 0%`. This means the user sees
a completely empty progress bar on the first question, which could feel like the
quiz hasn't started. This is a UX micro-issue rather than a bug — some implementations
prefer to show a small amount of progress immediately to provide feedback. The counter
text correctly shows "1 of 20", so the user has some indication.
**Evidence:**
```typescript
const pct = ((step - 1) / TOTAL_QUESTIONS) * 100;
progressFill.style.width = `${pct}%`;
progressText.textContent = `${step} of ${TOTAL_QUESTIONS}`;
```

---

## Positive Observations

These aspects of the architecture are well-executed and should be preserved:

1. **Clean layer separation:** Data, logic, display content, and API are in separate
   files with clear interfaces. No circular dependencies.

2. **Shared classifier avoids duplication:** Both client (quiz.astro) and server
   (quiz-submit.ts) import the same `classifier.ts`. The server does not trust client
   classification — it re-computes. This is correct defensive architecture.

3. **Pure functions in the logic layer:** `classify()` and `computeScores()` are pure
   functions with no side effects, making them trivially testable and deterministic.

4. **Build-time rendering of questions:** The Astro template renders all 20 questions
   at build time (SSG), so the client-side JS only handles show/hide transitions. No
   runtime data fetching needed for quiz content.

5. **Correct SSG/SSR boundary:** Only the API route (`quiz-submit.ts`) is server-rendered
   (`prerender = false`). Everything else is static. This minimizes serverless function
   invocations and costs.

6. **Comprehensive test coverage:** The unit tests for quiz-data and classifier are
   thorough, covering structural integrity, scoring corrections, boundary conditions,
   tie-breaking, and integration (computeScores -> classify). The frozen-test-file
   protocol ensures test independence.

7. **Minimal dependencies:** The quiz pipeline adds only `vitest` and `playwright` as
   devDependencies. No unnecessary framework libraries for the client-side quiz logic.

8. **Bot protection in the form:** Honeypot field and timing check (< 10s = bot) are
   lightweight, non-intrusive anti-spam measures.
