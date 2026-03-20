# UX + Accessibility Evaluation Report

**Evaluator:** UX + Accessibility (WCAG 2.1 AA)
**Target:** Quiz v2 (quiz-design-overhaul)
**Date:** 2026-03-19

## Findings

### A11Y-01: No Focus Management on Phase Transitions

**Severity:** Critical
**Description:** When the quiz auto-advances between questions (after the 800ms delay), transitions between major phases (intro to questions, questions to email gate, email gate to calculating, calculating to self-select/results), and navigates back via the back button, focus is never programmatically moved. The `transitionTo()` function (quiz.astro lines 394-404) and `showQuestion()` function (lines 407-468) hide all steps and show the target step but never call `.focus()` on any element. The previous step gets `display: none` via the `.quiz-step` CSS class (global.css line 65), which means any focused element within it is destroyed from the accessibility tree. Focus falls to `<body>`, forcing keyboard and screen reader users to tab through the entire page from the top to reach the newly-visible content. This renders the quiz effectively unusable for keyboard-only users after the first question.

**Affected Files:**
- `src/pages/quiz.astro` (lines 394-468, 474-510)
- `src/styles/global.css` (lines 64-86)

**Verification Criteria:** After each phase transition (question advance, back navigation, email gate, calculating, self-select, results), `document.activeElement` should be within the newly-active `.quiz-step` section. Verify with: `await page.evaluate(() => document.activeElement?.closest('.quiz-step.active') !== null)` returning `true` after every transition in a Playwright test.

---

### A11Y-02: No Screen Reader Announcements for Question Changes

**Severity:** Critical
**Description:** There are zero `aria-live` regions, zero `role="status"` attributes, and zero `role="alert"` attributes anywhere in quiz.astro. When the quiz transitions between questions (12 transitions total), a screen reader user receives no announcement that new content has appeared. The CSS animation (`quiz-step-in`, global.css line 71) operates on `display`/`opacity`/`transform` which screen readers cannot detect as a meaningful content change. Combined with A11Y-01 (no focus movement), a screen reader user answering a question will hear silence for 800ms and then have no indication that a new question has loaded. They would need to navigate the entire page to discover the change.

**Affected Files:**
- `src/pages/quiz.astro` (entire quiz container, lines 36-296)

**Verification Criteria:** At minimum, the quiz container or an element within the active step should have `aria-live="polite"` or `aria-live="assertive"`. Verify with: `document.querySelector('[aria-live]')` returning a non-null element within the quiz scope. Additionally, the question text `<h2>` (line 83) within each active step should be announced. A Playwright assertion like `await expect(page.locator('#quiz-container [aria-live]')).toHaveCount(1)` should pass.

---

### A11Y-03: Progress Bar Has No Semantic Role or ARIA Attributes

**Severity:** High
**Description:** The progress bar (quiz.astro lines 26-33) is built from generic `<div>` and `<p>` elements with no ARIA semantics. It lacks `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`. The visual progress fill (line 28) uses inline `width` style transitions, and the text "X of 10" (line 32) is in a `<p>` tag with no semantic connection to the progress indicator. Screen readers cannot convey progress information to users. The progress bar is hidden during segmentation questions (opacity: 0, line 465) but opacity changes do not remove it from the accessibility tree, so a screen reader might still encounter an empty/zero-width progress bar during segmentation phases.

**Affected Files:**
- `src/pages/quiz.astro` (lines 26-33, 456-466)

**Verification Criteria:** The progress bar outer container should have `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="10"`, and a dynamically-updated `aria-valuenow`. During segmentation phases, it should be `aria-hidden="true"`. Verify with: `await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', /\d+/)`.

---

### A11Y-04: Email Gate Form Inputs Lack Accessible Labels

**Severity:** High
**Description:** Both form inputs in the email gate (quiz.astro lines 158-170) rely solely on `placeholder` attributes for identification ("First Name (optional)" and "Email Address"). There are no `<label>` elements, no `aria-label` attributes, and no `aria-labelledby` references. WCAG 2.1 SC 1.3.1 (Info and Relationships) and SC 3.3.2 (Labels or Instructions) require that form inputs have programmatically-associated labels. Placeholder text disappears on input, leaving users with cognitive disabilities unable to recall what the field expects. Additionally, there is no error state handling — no `role="alert"` container, no `aria-describedby` for validation messages, and no visible error text when the email field is left empty and the form is submitted (the script silently returns on line 799 `if (!email) return`).

**Affected Files:**
- `src/pages/quiz.astro` (lines 158-170, 791-814)

**Verification Criteria:** Each input must have either a visible `<label>` with matching `for`/`id` attributes, or an `aria-label` attribute. Verify with: `await expect(page.locator('#email-gate-form input[name="firstName"]')).toHaveAttribute('aria-label')` and `await expect(page.locator('#email-gate-form input[name="email"]')).toHaveAttribute('aria-label')`. Error states should produce an element with `role="alert"` when validation fails.

---

### A11Y-05: Focus Indicator Suppressed on Email Form Inputs

**Severity:** High
**Description:** Both email gate form inputs use the Tailwind class `focus:outline-none` (quiz.astro lines 162, 169), which removes the browser's native focus outline. While there is a `focus:border-hermetic-gold/50` border color change as a replacement indicator, the border change is from `rgba(197,160,89,0.08)` (border-hermetic-gold/10 on the `<div>` parent, but the input itself has border-hermetic-gold/20) to `rgba(197,160,89,0.5)` — a subtle opacity shift on an already-thin border. This fails WCAG 2.1 SC 2.4.7 (Focus Visible) for users who depend on clear focus indicators. The answer buttons (`.answer-btn`, `.pair-btn`) and other buttons in the quiz do not appear to have any custom focus styles at all — they would rely on browser defaults, which vary by browser and are often suppressed in dark themes.

**Affected Files:**
- `src/pages/quiz.astro` (lines 162, 169)
- `src/styles/global.css` (no focus styles defined for `.answer-btn`, `.pair-btn`, `.back-btn`, `.self-select-card`)

**Verification Criteria:** No `focus:outline-none` without a visible replacement that meets the 3:1 contrast ratio for focus indicators. All interactive elements (answer buttons, pair buttons, back buttons, self-select cards, share buttons, form inputs) must have a visible focus indicator. Verify: `grep -c 'focus:outline-none' src/pages/quiz.astro` should return 0, or each instance should be accompanied by a high-contrast focus ring (e.g., `focus:ring-2 focus:ring-hermetic-gold`).

---

### A11Y-06: No prefers-reduced-motion Respect

**Severity:** High
**Description:** A search of the entire `src/` directory for `prefers-reduced-motion` returns zero matches. The quiz uses multiple animations: quiz step transitions (quiz-step-in: 400ms, quiz-step-out: 250ms in global.css), calculating interstitial pulsing circles (`animate-pulse` at quiz.astro line 193), phrase cycling (800ms interval at quiz.astro line 528), progress bar shimmer (infinite loop, global.css line 99-105), background star animation (100s infinite, global.css line 10), fog pulsing (10s infinite, global.css line 19), and the results page staggered reveal animations (multiple 700ms transitions, quiz.astro lines 241-251). WCAG 2.1 SC 2.3.3 recommends respecting the user's motion preferences, and SC 2.2.2 (Pause, Stop, Hide) requires that auto-updating content (the calculating phrase cycle) can be paused. The calculating interstitial auto-advances after 2.5 seconds with no user control.

**Affected Files:**
- `src/styles/global.css` (all animation keyframes and animation classes)
- `src/pages/quiz.astro` (lines 193-194, 334-342, 516-546)

**Verification Criteria:** A `@media (prefers-reduced-motion: reduce)` block should exist in global.css that sets `animation: none` or `animation-duration: 0.01ms` for all quiz animations. The calculating interstitial should respect this preference. Verify with: `grep -c 'prefers-reduced-motion' src/styles/global.css` returning at least 1.

---

### A11Y-07: Auto-Advance Timing (800ms) Not Configurable or Disableable

**Severity:** High
**Description:** After selecting an answer, the quiz auto-advances to the next question after a hardcoded 800ms delay (quiz.astro line 763). There is no mechanism to: (a) disable auto-advance and use an explicit "Next" button, (b) extend the delay, or (c) cancel the advance. While the back button provides recovery, users with motor disabilities may accidentally trigger answers and be auto-advanced before they can course-correct. Users with cognitive disabilities may need more than 800ms to confirm their selection visually before the content changes. WCAG 2.1 SC 2.2.1 (Timing Adjustable) requires that timing can be turned off, adjusted, or extended. The current implementation provides none of these options.

**Affected Files:**
- `src/pages/quiz.astro` (lines 762-767)

**Verification Criteria:** Either: (a) the auto-advance delay is user-configurable, (b) there is a "Next" button visible alongside auto-advance so users who need more time can proceed manually, or (c) `prefers-reduced-motion: reduce` disables auto-advance and shows an explicit "Next" button. Test: with `prefers-reduced-motion: reduce` enabled, verify that clicking an answer does NOT auto-advance, and a "Next" button appears.

---

### A11Y-08: Forced-Pair "or" Divider Not aria-hidden

**Severity:** Medium
**Description:** The "or" divider between forced-pair options (quiz.astro lines 111-114) consists of two `<span>` elements — one for mobile ("--- or ---") and one for desktop ("or"), toggled via `md:hidden` / `hidden md:block`. Neither span has `aria-hidden="true"`. Screen readers will announce "dash dash dash or dash dash dash" or "or" between the two option buttons, which is redundant and potentially confusing. The divider is purely decorative — the two buttons are semantically self-contained options. The containing `<div>` (line 111) also has `flex items-center justify-center` making it a visual-only layout element that a screen reader user does not need announced.

**Affected Files:**
- `src/pages/quiz.astro` (lines 111-114)

**Verification Criteria:** Both `<span>` elements inside the "or" divider `<div>` (or the parent `<div>` itself) should have `aria-hidden="true"`. Verify with: `await expect(page.locator('[data-step="5"] .grid > div').nth(1)).toHaveAttribute('aria-hidden', 'true')` for forced-pair step 5 (FP01).

---

### A11Y-09: No Skip-to-Content Link

**Severity:** Medium
**Description:** Neither the global Layout.astro nor quiz.astro provides a skip-to-content/skip navigation link. The quiz page includes a header (quiz.astro lines 18-23) with a logo link, and the Layout.astro includes background decoration layers (lines 99-103), GTM noscript iframe (lines 95-97), and other non-interactive elements before the page slot. Keyboard users must tab through all of these before reaching the quiz's "Begin the Reading" button. This violates WCAG 2.1 SC 2.4.1 (Bypass Blocks). While the quiz header is minimal, the pattern should be established site-wide, and the Layout.astro structure has multiple non-interactive elements before `<slot />`.

**Affected Files:**
- `src/layouts/Layout.astro` (lines 93-106)
- `src/pages/quiz.astro` (lines 15-23)

**Verification Criteria:** A visually-hidden skip link should be the first focusable element on the page, targeting `#quiz-container` or equivalent. Verify with: `await expect(page.locator('a[href="#quiz-container"]')).toBeAttached()` or `await page.keyboard.press('Tab'); await expect(page.locator(':focus')).toHaveText(/skip/i)`.

---

### A11Y-10: Calculating Interstitial Inaccessible to Screen Readers

**Severity:** High
**Description:** The calculating interstitial (quiz.astro lines 185-204) auto-advances after 2.5 seconds (line 538) and cycles through three phrases at 800ms intervals (lines 516-546). The phrase element (`#calculating-phrase`, line 198) is a `<p>` with no `aria-live` attribute and no `role="status"`. Screen reader users entering this phase will: (a) not know they are on a loading/calculating screen, (b) not hear the cycling phrases, (c) not know when results are ready. The pulsing circles (lines 193-194) are purely decorative but have no `aria-hidden="true"` — though as empty `<div>` elements they may not be announced, the `animate-pulse` creates visual distraction without informational content. The 2.5s auto-advance (line 538) cannot be paused, extended, or controlled by the user.

**Affected Files:**
- `src/pages/quiz.astro` (lines 185-204, 516-546)

**Verification Criteria:** The calculating section should have `role="status"` or an `aria-live="polite"` region wrapping the phrase text. The decorative circles should have `aria-hidden="true"`. Verify with: `await expect(page.locator('#quiz-calculating [role="status"]')).toBeAttached()` or `await expect(page.locator('#calculating-phrase')).toHaveAttribute('aria-live', 'polite')`.

---

### A11Y-11: Self-Select Cards Lack Accessible Names and Group Semantics

**Severity:** High
**Description:** The self-select cards are dynamically created as `<button>` elements (quiz.astro line 572) with `innerHTML` containing nested `<div>`, `<h3>`, `<p>`, and `<span>` elements but no `aria-label`. The accessible name for each button will be computed from all inner text content concatenated, resulting in something like "Element of Air The Air Weaver Patterns are never coincidental... Choose this path" — a long, unstructured string that is difficult for screen reader users to parse. The card container (`#self-select-cards`, line 223) has no `role="radiogroup"` or equivalent grouping semantics, and the heading text "Which speaks to you more deeply?" (line 220) is not programmatically associated with the cards via `aria-labelledby`. Users have no way to know this is a binary choice between two archetypes.

**Affected Files:**
- `src/pages/quiz.astro` (lines 207-227, 552-592)

**Verification Criteria:** Each self-select card `<button>` should have an `aria-label` with a concise name (e.g., "Choose The Air Weaver"). The container should have `role="radiogroup"` with `aria-labelledby` pointing to the heading. Verify with: `await expect(page.locator('.self-select-card').first()).toHaveAttribute('aria-label')`.

---

### A11Y-12: Share Button Icons Lack Accessible Names

**Severity:** Medium
**Description:** The share links for X (lines 258-262) and Facebook (lines 263-267) contain SVG icons followed by short text ("Post" and "Share"). While the text provides some accessible name, "Post" and "Share" are ambiguous without the icon context — a screen reader user hearing "link: Post" and "link: Share" cannot distinguish the platforms. The SVG elements have no `aria-hidden="true"` and no `role="img"` with `<title>`, so screen readers may attempt to describe the SVG path data. The copy link button (lines 268-272) has clearer text ("Copy Link") but its SVG also lacks `aria-hidden`. None of the share links have `aria-label` attributes like "Share on X (Twitter)" or "Share on Facebook".

**Affected Files:**
- `src/pages/quiz.astro` (lines 258-272)

**Verification Criteria:** Each SVG icon should have `aria-hidden="true"`, and each share link/button should have an `aria-label` (e.g., `aria-label="Share on X"`, `aria-label="Share on Facebook"`, `aria-label="Copy result link"`). Verify with: `await expect(page.locator('#share-x')).toHaveAttribute('aria-label')` and `await expect(page.locator('#share-x svg')).toHaveAttribute('aria-hidden', 'true')`.

---

### A11Y-13: Color Contrast Failures on Low-Opacity Text

**Severity:** High
**Description:** Multiple text elements use Tailwind opacity modifiers that produce extremely low contrast against the dark backgrounds. Specific instances:

1. **`text-hermetic-gold/30`** (quiz.astro lines 32, 65, 112, 126): Computes to `rgba(197,160,89,0.3)` on the glass-panel background (~`rgba(1,53,41,0.4)` over `#000`). The effective text color is approximately `#3d3422` against the effective background of approximately `#05231a`. This yields a contrast ratio well below the 4.5:1 AA requirement for normal text. Used for: progress bar text, "No account needed" text, "or" divider, back button text.

2. **`text-hermetic-gold/40`** (quiz.astro lines 177, 32): Used for the "Skip for now" button and progress text. Similarly fails AA contrast.

3. **`text-hermetic-gold/50`** (quiz.astro line 78): Used for the question phase label ("Before We Begin" / "Question X of 10"). Borderline fail for small text.

4. **`text-gray-500`** (placeholder text on form inputs, lines 162, 169): Tailwind `gray-500` is `#6b7280`. Against the input background (`bg-hermetic-void/80` = `rgba(10,10,10,0.8)` over dark), this likely passes for large text but fails for the small placeholder text size.

5. **`text-gray-400`** (quiz.astro line 220, self-select description): `#9ca3af` on dark glass panel — borderline.

**Affected Files:**
- `src/pages/quiz.astro` (lines 32, 65, 78, 112, 126, 162, 169, 177, 220)

**Verification Criteria:** All text elements must meet WCAG 2.1 AA contrast ratios: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold). Run an automated contrast check (e.g., axe-core) against each quiz phase. Specific check: the "Skip for now" button text (`#email-gate-skip`) should have a computed contrast ratio >= 4.5:1 against its background.

---

### A11Y-14: Back Button Accessible Name Contains Arrow Entity

**Severity:** Medium
**Description:** The back button (quiz.astro lines 126-128) renders as `<button class="back-btn">` with inner content `<span class="text-xs">&larr;</span> Previous`. Screen readers may announce this as "leftwards arrow Previous" or "left arrow Previous" depending on the reader. The arrow character (Unicode U+2190) is decorative and should be hidden from the accessible name. Additionally, the back button has no `aria-label` providing clearer context like "Go to previous question". The button is only present on questions after the first (line 125: `i > 0`), which is correct, but when going back from the email gate, the engine handles this via the `goBack()` method, not a visible back button on the email gate screen — there is no way to navigate back from the email gate via the UI.

**Affected Files:**
- `src/pages/quiz.astro` (lines 125-129)

**Verification Criteria:** The arrow `<span>` should have `aria-hidden="true"`, and the button should have `aria-label="Go to previous question"`. Verify with: `await expect(page.locator('.back-btn .text-xs').first()).toHaveAttribute('aria-hidden', 'true')` and `await expect(page.locator('.back-btn').first()).toHaveAttribute('aria-label', 'Go to previous question')`.

---

### A11Y-15: Results Screen Content Not Announced on Reveal

**Severity:** High
**Description:** The results screen (quiz.astro lines 230-294) uses a staggered animation reveal pattern where all text elements start with `opacity-0` and `translate-y-4`, then are animated to visible via JavaScript `requestAnimationFrame` (lines 638-650). The result title, element, tagline, and description are all initially invisible to screen readers (opacity: 0 content is still in the accessibility tree, but no focus is moved to it). There is no `aria-live` region wrapping the result content, no focus is moved to the result heading (`#result-title`), and the share section reveals after a 1200ms delay (line 255). A screen reader user transitioning from the calculating interstitial to results will receive no announcement that their archetype has been determined. The `<h2 id="result-title">` (line 245) is empty until JavaScript populates it (line 632), meaning even if focus were moved there, it might be empty at the moment of focus if timing is off.

**Affected Files:**
- `src/pages/quiz.astro` (lines 230-294, 598-720)

**Verification Criteria:** After results are revealed, focus should be on `#result-title` or a container with `aria-live="assertive"`. The result content should be populated before focus is moved. Verify with: after reaching results, `await expect(page.locator('#result-title')).toBeFocused()` or `await expect(page.locator('#quiz-results [aria-live]')).toContainText(/.+/)`.

---

### A11Y-16: Zero Accessibility Test Coverage

**Severity:** High
**Description:** The E2E test file `tests/quiz-v2-e2e.spec.ts` (408 lines) contains zero assertions related to accessibility. There are no keyboard navigation tests (no `page.keyboard.press('Tab')` or `page.keyboard.press('Enter')` calls), no focus management assertions, no ARIA attribute checks, no contrast ratio tests, and no axe-core integration (`@axe-core/playwright`). The 7-test matrix covers functional correctness only. Given the 15 findings above, the lack of accessibility test coverage means regressions in any accessibility fix would not be caught by CI.

**Affected Files:**
- `tests/quiz-v2-e2e.spec.ts`

**Verification Criteria:** The test file should include: (a) at least one test using `@axe-core/playwright` to run automated WCAG 2.1 AA checks on each quiz phase, (b) a keyboard-only navigation test that completes the full quiz flow using only Tab/Enter/Space, (c) focus management assertions after each phase transition. Verify with: `grep -c 'axe\|keyboard\|focus\|aria' tests/quiz-v2-e2e.spec.ts` returning a non-zero count.

---

### A11Y-17: Question Sections Lack Landmark or Heading Hierarchy

**Severity:** Medium
**Description:** Each question step is a `<section>` element (quiz.astro line 71) without an `aria-label` or `aria-labelledby` attribute, making these anonymous landmarks that screen readers may skip or announce unhelpfully. The question text uses `<h2>` (line 83), which is correct as a heading level under the page `<h1>` in the intro. However, the intro `<h1>` (line 51) disappears when questions begin (it is inside `#quiz-intro` which gets `display: none`), leaving the page with no visible `<h1>`. The results screen has an `<h2>` for the result title (line 245) but the "Your Archetype Revealed" label (line 241) is a `<p>`, not a heading. The self-select screen's "Two paths resonate" text (line 218) is an `<h2>`, which is consistent. The overall heading structure is acceptable within each phase but collapses across the single-page application pattern.

**Affected Files:**
- `src/pages/quiz.astro` (lines 51, 71, 83, 218, 241, 245)

**Verification Criteria:** Each `<section>` with a question should have `aria-labelledby` pointing to its `<h2>`, or an `aria-label` with the question number. Verify with: `await expect(page.locator('section.quiz-step.active')).toHaveAttribute('aria-labelledby')`.

---

## Summary

- Total findings: 17
- By severity: Critical: 2, High: 9, Medium: 6
- Key themes: The quiz v2 was built with strong functional correctness (the engine state machine, classifier, and E2E tests are thorough) but accessibility was not addressed at any layer. The two critical findings -- no focus management on phase transitions and no screen reader announcements -- together render the quiz functionally unusable for keyboard-only and screen reader users. The high-severity findings cluster around three themes: (1) missing ARIA semantics throughout (progress bar, form labels, self-select cards, calculating interstitial, results reveal), (2) no `prefers-reduced-motion` support despite pervasive animation, and (3) systematic color contrast failures from the decorative low-opacity gold text pattern. Zero accessibility test coverage means these issues would not be caught in CI even after remediation.
