/**
 * Playwright E2E tests — Quiz v2 (Phase 6 test matrix)
 *
 * Covers the 7-test matrix for the v2 quiz rewrite:
 *   1. Happy path (full flow with email submit)
 *   2. Skip path (skip email gate)
 *   3. Self-select path (low-confidence trigger)
 *   4. Back navigation (answer persistence)
 *   5. Forced-pair rendering
 *   6. Progress bar behavior
 *   7. API integration (route interception)
 *
 * Question order (from quiz-data.ts):
 *   Step 1:  SEG1 — segmentation, single_select
 *   Step 2:  SEG2 — segmentation, single_select
 *   Step 3:  NQ01 — scored, single_select
 *   Step 4:  NQ02 — scored, single_select
 *   Step 5:  FP01 — scored, forced_pair
 *   Step 6:  NQ03 — scored, single_select
 *   Step 7:  NQ04 — scored, single_select
 *   Step 8:  FP02 — scored, forced_pair
 *   Step 9:  NQ05 — scored, single_select
 *   Step 10: NQ06 — scored, single_select
 *   Step 11: FP03 — scored, forced_pair
 *   Step 12: NQ07 — scored, single_select
 *
 * Timing:
 *   - Auto-advance: 800ms after answer click
 *   - Transition animation: 250ms
 *   - Calculating interstitial: 2.5s auto-advance
 */

import { test, expect, type Page } from '@playwright/test';

// Forced-pair steps (1-indexed) — determined by quiz-data.ts question order
const FORCED_PAIR_STEPS = new Set([5, 8, 11]);
const TOTAL_QUESTIONS = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Click through all 12 questions using the format-aware button selector.
 *
 * @param page     Playwright page object
 * @param strategy Optional per-step answer index overrides (1-indexed step -> 0-indexed answer).
 *                 Defaults to index 0 for all steps.
 */
async function answerAllQuestions(
  page: Page,
  strategy: Record<number, number> = {}
): Promise<void> {
  for (let step = 1; step <= TOTAL_QUESTIONS; step++) {
    await expect(page.locator(`[data-step="${step}"]`)).toHaveClass(/active/, { timeout: 3000 });

    const stepLocator = page.locator(`[data-step="${step}"]`);
    const answerIndex = strategy[step] ?? 0;

    if (FORCED_PAIR_STEPS.has(step)) {
      await stepLocator.locator('.pair-btn').nth(answerIndex).click();
    } else {
      await stepLocator.locator('.answer-btn').nth(answerIndex).click();
    }

    // Wait past the 800ms auto-advance + 250ms transition
    if (step < TOTAL_QUESTIONS) {
      await page.waitForTimeout(1100);
    }
  }

  // After the last question, wait for auto-advance
  await page.waitForTimeout(1100);
}

/**
 * Navigate to the quiz, click "Begin the Reading", and answer all 12 questions.
 * Leaves the page at the email gate screen.
 */
async function navigateToEmailGate(page: Page): Promise<void> {
  await page.goto('/quiz');
  await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
  await page.locator('#start-quiz').click();
  await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });
  await answerAllQuestions(page);
  await expect(page.locator('#email-gate')).toHaveClass(/active/, { timeout: 3000 });
}

/**
 * After calculating interstitial, handle either self-select or direct results.
 * Answer shuffling + PRNG seed makes the confidence non-deterministic,
 * so any full-flow test must handle both branches.
 */
async function waitForResults(page: Page): Promise<void> {
  const selfSelect = page.locator('#self-select');
  const quizResults = page.locator('#quiz-results');

  // Wait for either self-select or results to become active
  await Promise.race([
    expect(selfSelect).toHaveClass(/active/, { timeout: 6000 }).catch(() => {}),
    expect(quizResults).toHaveClass(/active/, { timeout: 6000 }).catch(() => {}),
  ]);

  // If self-select appeared, click the first card
  const selfSelectActive = await selfSelect.evaluate(
    (el) => el.classList.contains('active')
  ).catch(() => false);

  if (selfSelectActive) {
    await page.locator('.self-select-card').first().click();
  }

  await expect(quizResults).toHaveClass(/active/, { timeout: 3000 });
}

// ---------------------------------------------------------------------------
// Suite 1: Happy path — full flow with email submit
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — Happy path (email submit)', () => {
  test('completes full flow from intro through results via email submit', async ({ page }) => {
    await page.goto('/quiz');

    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
    await page.locator('#start-quiz').click();
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });

    await answerAllQuestions(page);

    // Email gate appears
    await expect(page.locator('#email-gate')).toHaveClass(/active/, { timeout: 3000 });

    // Fill and submit email form
    await page.locator('#email-gate-form [name="email"]').fill('test@example.com');
    await page.locator('#email-gate-form').locator('[type="submit"]').click();

    // Calculating interstitial appears
    await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });

    // Handle self-select or direct results (non-deterministic due to shuffle)
    await waitForResults(page);

    // Result title is populated
    const resultTitle = page.locator('#result-title');
    await expect(resultTitle).not.toBeEmpty();

    // Share section is visible
    await expect(page.locator('#share-section')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Skip path — skip email gate
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — Skip path (skip email)', () => {
  test('completes flow when email gate is skipped', async ({ page }) => {
    await navigateToEmailGate(page);

    await page.locator('#email-gate-skip').click();

    await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });

    // Handle self-select or direct results (non-deterministic due to shuffle)
    await waitForResults(page);

    const resultTitle = page.locator('#result-title');
    await expect(resultTitle).not.toBeEmpty();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Self-select path
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — Self-select path (low-confidence trigger)', () => {
  test('flow completes via self-select or direct results when confidence is low', async ({ page }) => {
    await page.goto('/quiz');

    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
    await page.locator('#start-quiz').click();
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });

    // Spread scores across all 4 dimensions to minimize confidence.
    // Steps 1-2 are SEG (not scored) — any answer.
    // NQ steps: rotate through A/B/C/D answer indices.
    // FP steps: click index 0.
    const lowConfidenceStrategy: Record<number, number> = {
      1: 0,  // SEG1
      2: 0,  // SEG2
      3: 0,  // NQ01 → A (index 0)
      4: 1,  // NQ02 → B (index 1)
      5: 0,  // FP01 (forced pair, A vs D)
      6: 2,  // NQ03 → C (index 2)
      7: 3,  // NQ04 → D (index 3)
      8: 1,  // FP02 (forced pair, B vs C) — pick C
      9: 0,  // NQ05 → A (index 0)
      10: 1, // NQ06 → B (index 1)
      11: 1, // FP03 (forced pair, B vs D) — pick D
      12: 2, // NQ07 → C (index 2)
    };

    await answerAllQuestions(page, lowConfidenceStrategy);

    // Email gate — skip it
    await expect(page.locator('#email-gate')).toHaveClass(/active/, { timeout: 3000 });
    await page.locator('#email-gate-skip').click();

    // Calculating appears
    await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });

    // Wait for EITHER self-select OR results to become active.
    // Self-select triggering depends on exact classifier confidence.
    const selfSelect = page.locator('#self-select');
    const quizResults = page.locator('#quiz-results');

    await Promise.race([
      expect(selfSelect).toHaveClass(/active/, { timeout: 5000 }).catch(() => {}),
      expect(quizResults).toHaveClass(/active/, { timeout: 5000 }).catch(() => {}),
    ]);

    const selfSelectActive = await selfSelect.evaluate(
      (el) => el.classList.contains('active')
    ).catch(() => false);

    if (selfSelectActive) {
      await page.locator('.self-select-card').first().click();
      await expect(quizResults).toHaveClass(/active/, { timeout: 3000 });
    }

    // Results must be visible in either branch
    await expect(quizResults).toHaveClass(/active/, { timeout: 3000 });
    await expect(page.locator('#result-title')).not.toBeEmpty();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Back navigation
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — Back navigation', () => {
  test('back button returns to previous question with answer preserved', async ({ page }) => {
    await page.goto('/quiz');

    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
    await page.locator('#start-quiz').click();

    // Step 1 (SEG1) — answer
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });
    await page.locator('[data-step="1"]').locator('.answer-btn').first().click();
    await page.waitForTimeout(1100);

    // Step 2 (SEG2) — answer
    await expect(page.locator('[data-step="2"]')).toHaveClass(/active/, { timeout: 3000 });
    await page.locator('[data-step="2"]').locator('.answer-btn').first().click();
    await page.waitForTimeout(1100);

    // Step 3 (NQ01) — click back to step 2
    await expect(page.locator('[data-step="3"]')).toHaveClass(/active/, { timeout: 3000 });
    await page.locator('[data-step="3"]').locator('.back-btn').click();

    // Step 2 should be active again
    await expect(page.locator('[data-step="2"]')).toHaveClass(/active/, { timeout: 3000 });

    // Previous answer should still have .selected
    const selectedAnswer = page.locator('[data-step="2"] .answer-btn.selected');
    await expect(selectedAnswer).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Forced-pair rendering
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — Forced-pair rendering', () => {
  test('FP01 (step 5) renders with exactly 2 pair buttons, no answer buttons, and "or" divider', async ({ page }) => {
    await page.goto('/quiz');

    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
    await page.locator('#start-quiz').click();
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });

    // Answer steps 1-4 to reach FP01 at step 5
    for (let step = 1; step <= 4; step++) {
      await expect(page.locator(`[data-step="${step}"]`)).toHaveClass(/active/, { timeout: 3000 });
      await page.locator(`[data-step="${step}"]`).locator('.answer-btn').first().click();
      await page.waitForTimeout(1100);
    }

    // Step 5 (FP01) should now be active
    await expect(page.locator('[data-step="5"]')).toHaveClass(/active/, { timeout: 3000 });

    const fp01 = page.locator('[data-step="5"]');

    // Must have data-format="forced_pair"
    await expect(fp01).toHaveAttribute('data-format', 'forced_pair');

    // Must have exactly 2 .pair-btn elements
    await expect(fp01.locator('.pair-btn')).toHaveCount(2);

    // Must have NO .answer-btn elements
    await expect(fp01.locator('.answer-btn')).toHaveCount(0);

    // Must have an "or" divider text
    const orDivider = fp01.getByText(/^(or|— or —)$/i);
    await expect(orDivider.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Progress bar behavior
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — Progress bar behavior', () => {
  test('progress bar hidden on segmentation, visible on scored questions', async ({ page }) => {
    await page.goto('/quiz');

    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
    await page.locator('#start-quiz').click();

    // Step 1 (SEG1 — segmentation): progress bar opacity 0
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });
    const progressBar = page.locator('#progress-bar');
    await expect(progressBar).toHaveCSS('opacity', '0');

    // Answer SEG1, advance to SEG2
    await page.locator('[data-step="1"]').locator('.answer-btn').first().click();
    await page.waitForTimeout(1100);

    // Step 2 (SEG2 — segmentation): progress bar still hidden
    await expect(page.locator('[data-step="2"]')).toHaveClass(/active/, { timeout: 3000 });
    await expect(progressBar).toHaveCSS('opacity', '0');

    // Answer SEG2, advance to NQ01 (step 3, first scored question)
    await page.locator('[data-step="2"]').locator('.answer-btn').first().click();
    await page.waitForTimeout(1100);

    // Step 3 (NQ01 — scored): progress bar visible
    await expect(page.locator('[data-step="3"]')).toHaveClass(/active/, { timeout: 3000 });
    // Wait for opacity transition (duration-500 = 500ms CSS transition)
    await expect(progressBar).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Progress text should show "of 10"
    await expect(page.locator('#progress-text')).toContainText('of 10');
  });
});

// ---------------------------------------------------------------------------
// Suite 7: API integration (route interception)
// ---------------------------------------------------------------------------
test.describe('Quiz v2 — API integration (route interception)', () => {
  test('quiz-submit receives correct payload with email and all answer IDs', async ({ page }) => {
    let capturedPayload: Record<string, unknown> | null = null;

    // Intercept the quiz-submit API route
    await page.route('**/api/quiz-submit', async (route) => {
      const bodyText = route.request().postData();
      if (bodyText) {
        try {
          capturedPayload = JSON.parse(bodyText) as Record<string, unknown>;
        } catch {
          capturedPayload = null;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          archetype: 'air_weaver',
          quizVersion: 'v2',
        }),
      });
    });

    await page.goto('/quiz');
    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
    await page.locator('#start-quiz').click();
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });

    await answerAllQuestions(page);

    // Email gate — fill and submit
    await expect(page.locator('#email-gate')).toHaveClass(/active/, { timeout: 3000 });
    await page.locator('#email-gate-form [name="email"]').fill('test@example.com');
    await page.locator('#email-gate-form').locator('[type="submit"]').click();

    // Handle self-select or direct results (API call fires during revealResults)
    await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });
    await waitForResults(page);

    // Give the fire-and-forget fetch a moment to complete
    await page.waitForTimeout(500);

    // Verify captured payload
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload!['email']).toBe('test@example.com');

    const answers = capturedPayload!['answers'] as Record<string, string> | undefined;
    expect(answers).toBeDefined();

    const expectedQuestionIds = [
      'SEG1', 'SEG2',
      'NQ01', 'NQ02', 'NQ03', 'NQ04', 'NQ05', 'NQ06', 'NQ07',
      'FP01', 'FP02', 'FP03',
    ];

    for (const qId of expectedQuestionIds) {
      expect(answers).toHaveProperty(qId);
    }
  });
});
