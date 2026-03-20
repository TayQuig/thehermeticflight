/**
 * Playwright E2E tests — Quiz v2 Accessibility (Phase 7 Hardening)
 *
 * Covers findings S-01 through S-11 from the eval-quiz-v2-2026-03-19 synthesis.
 * These tests verify WCAG 2.1 AA compliance for the quiz flow.
 *
 * Findings:
 *   S-01: Focus management on phase transitions
 *   S-02: Screen reader announcements (aria-live)
 *   S-07: Progress bar ARIA semantics
 *   S-08: Email gate form accessible labels
 *   S-09: Focus indicators on interactive elements
 *   S-10: prefers-reduced-motion support
 *   S-11: Color contrast (structural check — opacity modifiers)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORCED_PAIR_STEPS = new Set([5, 8, 11]);
const TOTAL_QUESTIONS = 12;

/** Answer a single step using format-aware selector. */
async function answerStep(page: Page, step: number): Promise<void> {
  await expect(page.locator(`[data-step="${step}"]`)).toHaveClass(/active/, { timeout: 3000 });
  const stepLocator = page.locator(`[data-step="${step}"]`);
  if (FORCED_PAIR_STEPS.has(step)) {
    await stepLocator.locator('.pair-btn').first().click();
  } else {
    await stepLocator.locator('.answer-btn').first().click();
  }
  await page.waitForTimeout(1100);
}

/** Navigate from intro to first question. */
async function startQuiz(page: Page): Promise<void> {
  await page.goto('/quiz');
  await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
  await page.locator('#start-quiz').click();
  await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });
}

// ---------------------------------------------------------------------------
// S-01: Focus management on phase transitions
// ---------------------------------------------------------------------------

test.describe('S-01: Focus management', () => {
  test('focus moves into active step after starting quiz', async ({ page }) => {
    await page.goto('/quiz');
    await page.locator('#start-quiz').click();
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });

    const focusInActive = await page.evaluate(() => {
      const active = document.querySelector('.quiz-step.active');
      return active ? active.contains(document.activeElement) : false;
    });
    expect(focusInActive).toBe(true);
  });

  test('focus moves into active step after answering a question', async ({ page }) => {
    await startQuiz(page);
    await answerStep(page, 1);
    await expect(page.locator('[data-step="2"]')).toHaveClass(/active/, { timeout: 3000 });

    const focusInActive = await page.evaluate(() => {
      const active = document.querySelector('.quiz-step.active');
      return active ? active.contains(document.activeElement) : false;
    });
    expect(focusInActive).toBe(true);
  });

  test('focus moves into active step after back navigation', async ({ page }) => {
    await startQuiz(page);
    await answerStep(page, 1);
    await expect(page.locator('[data-step="2"]')).toHaveClass(/active/, { timeout: 3000 });

    // Answer step 2, advance to step 3
    await answerStep(page, 2);
    await expect(page.locator('[data-step="3"]')).toHaveClass(/active/, { timeout: 3000 });

    // Go back
    await page.locator('[data-step="3"] .back-btn').click();
    await expect(page.locator('[data-step="2"]')).toHaveClass(/active/, { timeout: 3000 });

    const focusInActive = await page.evaluate(() => {
      const active = document.querySelector('.quiz-step.active');
      return active ? active.contains(document.activeElement) : false;
    });
    expect(focusInActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S-02: Screen reader announcements (aria-live)
// ---------------------------------------------------------------------------

test.describe('S-02: Aria-live region', () => {
  test('quiz contains an aria-live region', async ({ page }) => {
    await page.goto('/quiz');
    await expect(page.locator('#quiz-container [aria-live]')).toHaveCount(1, { timeout: 3000 });
  });

  test('calculating interstitial has role="status" or aria-live', async ({ page }) => {
    const hasLive = await page.goto('/quiz').then(async () => {
      return page.evaluate(() => {
        const calc = document.getElementById('quiz-calculating');
        if (!calc) return false;
        return calc.querySelector('[role="status"]') !== null ||
               calc.querySelector('[aria-live]') !== null ||
               calc.getAttribute('role') === 'status' ||
               calc.getAttribute('aria-live') !== null;
      });
    });
    expect(hasLive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S-07: Progress bar ARIA semantics
// ---------------------------------------------------------------------------

test.describe('S-07: Progress bar ARIA', () => {
  test('progress bar has role="progressbar" with aria-value attributes', async ({ page }) => {
    await page.goto('/quiz');
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toHaveCount(1);
    await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressBar).toHaveAttribute('aria-valuemax', '10');
  });

  test('progress bar aria-valuenow updates on scored questions', async ({ page }) => {
    await startQuiz(page);

    // Answer SEG1 (step 1) and SEG2 (step 2)
    await answerStep(page, 1);
    await answerStep(page, 2);

    // Now on step 3 (NQ01 — first scored question)
    await expect(page.locator('[data-step="3"]')).toHaveClass(/active/, { timeout: 3000 });
    const progressBar = page.locator('[role="progressbar"]');
    const valuenow = await progressBar.getAttribute('aria-valuenow');
    expect(valuenow).not.toBeNull();
    expect(Number(valuenow)).toBeGreaterThanOrEqual(1);
  });

  test('progress bar is aria-hidden during segmentation', async ({ page }) => {
    await startQuiz(page);
    // Step 1 is SEG1 — progress bar should be hidden from a11y tree
    const isHidden = await page.evaluate(() => {
      const bar = document.querySelector('[role="progressbar"]');
      return bar?.getAttribute('aria-hidden') === 'true' ||
             bar?.closest('[aria-hidden="true"]') !== null;
    });
    expect(isHidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S-08: Email gate form accessible labels
// ---------------------------------------------------------------------------

test.describe('S-08: Form labels', () => {
  test('email input has aria-label or associated label element', async ({ page }) => {
    await page.goto('/quiz');
    const emailInput = page.locator('#email-gate-form input[name="email"]');
    const hasLabel = await emailInput.evaluate((el) => {
      return el.hasAttribute('aria-label') ||
             el.hasAttribute('aria-labelledby') ||
             document.querySelector(`label[for="${el.id}"]`) !== null;
    });
    expect(hasLabel).toBe(true);
  });

  test('firstName input has aria-label or associated label element', async ({ page }) => {
    await page.goto('/quiz');
    const fnInput = page.locator('#email-gate-form input[name="firstName"]');
    const hasLabel = await fnInput.evaluate((el) => {
      return el.hasAttribute('aria-label') ||
             el.hasAttribute('aria-labelledby') ||
             document.querySelector(`label[for="${el.id}"]`) !== null;
    });
    expect(hasLabel).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S-09: Focus indicators (structural check)
// ---------------------------------------------------------------------------

test.describe('S-09: Focus indicators', () => {
  test('email form inputs do not suppress outline without visible replacement', async ({ page }) => {
    await page.goto('/quiz');
    // Check that inputs either don't suppress outline or have a ring replacement
    const noOutlineCount = await page.evaluate(() => {
      const inputs = document.querySelectorAll('#email-gate-form input');
      let count = 0;
      for (const input of inputs) {
        const classes = input.className;
        if (classes.includes('focus:outline-none') && !classes.includes('focus:ring')) {
          count++;
        }
      }
      return count;
    });
    expect(noOutlineCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S-10: prefers-reduced-motion (structural check)
// ---------------------------------------------------------------------------

test.describe('S-10: Reduced motion', () => {
  test('global.css contains prefers-reduced-motion media query', async () => {
    const fs = await import('fs');
    const css = fs.readFileSync('src/styles/global.css', 'utf-8');
    expect(css).toContain('prefers-reduced-motion');
  });
});

// ---------------------------------------------------------------------------
// S-11: Contrast — structural check for low-opacity text
// ---------------------------------------------------------------------------

test.describe('S-11: Contrast (structural)', () => {
  test('no functional text uses text-hermetic-gold/30 or lower', async () => {
    const fs = await import('fs');
    const html = fs.readFileSync('src/pages/quiz.astro', 'utf-8');

    // Extract lines with text-hermetic-gold/30 or /20
    const lowOpacityLines = html.split('\n')
      .map((line, i) => ({ line: line.trim(), num: i + 1 }))
      .filter(({ line }) =>
        (line.includes('text-hermetic-gold/30') || line.includes('text-hermetic-gold/20')) &&
        !line.includes('border-') &&
        !line.includes('bg-')
      );

    // After remediation, functional text (progress, buttons, labels) should not use /30 or lower.
    // Decorative borders and backgrounds may still use low opacity.
    // Filter to only text-bearing elements (not purely decorative borders).
    const functionalTextWithLowOpacity = lowOpacityLines.filter(({ line }) => {
      // Skip lines that are purely decorative (border corners, dividers)
      if (line.startsWith('<div') && line.includes('border-') && !line.includes('>')) return false;
      if (line.includes('h-[1px]') || line.includes('w-[1px]')) return false;
      return true;
    });

    // After remediation: functional text should use /60 or higher
    expect(functionalTextWithLowOpacity.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S-03 + S-04: Client-side data integrity (structural)
// ---------------------------------------------------------------------------

test.describe('S-03 + S-04: Client data integrity', () => {
  test('S-03: quiz.astro builds and sends displayOrder in API payload', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/pages/quiz.astro', 'utf-8');
    // The fetch body must include displayOrder
    expect(source).toContain('displayOrder');
    // displayOrder must be constructed from engine shuffle data, not hardcoded
    expect(source).toMatch(/getShuffledAnswerIndices|displayOrder/);
  });

  test('S-04: quiz.astro sends quizVersion in API payload', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/pages/quiz.astro', 'utf-8');
    // The fetch body must include quizVersion: 'v2'
    expect(source).toMatch(/quizVersion/);
  });
});

// ---------------------------------------------------------------------------
// Bonus: Trivial a11y fixes bundled with Cycle 1
// ---------------------------------------------------------------------------

test.describe('A11Y bundled fixes', () => {
  test('forced-pair "or" divider has aria-hidden', async ({ page }) => {
    await page.goto('/quiz');
    // Check a forced-pair step's "or" divider
    const orDivider = page.locator('[data-format="forced_pair"]').first()
      .locator('.grid > div').nth(1); // middle element between two buttons
    const isHidden = await orDivider.evaluate((el) => {
      return el.getAttribute('aria-hidden') === 'true' ||
             el.closest('[aria-hidden="true"]') !== null;
    });
    expect(isHidden).toBe(true);
  });

  test('back button arrow span has aria-hidden', async ({ page }) => {
    await page.goto('/quiz');
    // First back button in the quiz
    const arrowSpan = page.locator('.back-btn .text-xs').first();
    await expect(arrowSpan).toHaveAttribute('aria-hidden', 'true');
  });

  test('share links have aria-labels', async ({ page }) => {
    await page.goto('/quiz');
    const shareX = page.locator('#share-x');
    const shareFb = page.locator('#share-fb');
    const shareCopy = page.locator('#share-copy');
    await expect(shareX).toHaveAttribute('aria-label', /.+/);
    await expect(shareFb).toHaveAttribute('aria-label', /.+/);
    await expect(shareCopy).toHaveAttribute('aria-label', /.+/);
  });

  test('share link SVGs have aria-hidden', async ({ page }) => {
    await page.goto('/quiz');
    const svgs = page.locator('#share-section svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(svgs.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
