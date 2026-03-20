/**
 * Playwright E2E tests — Email Gate Enforcement + Product Research
 *
 * Tests the two-layer soft gate:
 *   Layer 1: Quiz results screen (quiz.astro) — teaser vs full reveal
 *   Layer 2: Journey page (/archetype/[slug]) — cookie-based gating
 *
 * Product research questions (PR01: card backs, PR02: product interest)
 * appear after the archetype reveal, only for email-submitted users.
 *
 * Cookie contract:
 *   Name: thf_sub
 *   Value: archetype slug (kebab-case, e.g. "air-weaver")
 *   Max-age: 30 days
 *   Set by: quiz.astro client-side JS after email submission
 *   Read by: archetype/[slug].astro server-side (Astro.cookies)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers (mirror quiz-v2-e2e.spec.ts conventions)
// ---------------------------------------------------------------------------

const FORCED_PAIR_STEPS = new Set([5, 8, 11]);
const TOTAL_QUESTIONS = 12;

/** Answer all 12 quiz questions (format-aware). */
async function answerAllQuestions(page: Page): Promise<void> {
  for (let step = 1; step <= TOTAL_QUESTIONS; step++) {
    await expect(page.locator(`[data-step="${step}"]`)).toHaveClass(/active/, { timeout: 3000 });
    const stepLocator = page.locator(`[data-step="${step}"]`);
    if (FORCED_PAIR_STEPS.has(step)) {
      await stepLocator.locator('.pair-btn').first().click();
    } else {
      await stepLocator.locator('.answer-btn').first().click();
    }
    if (step < TOTAL_QUESTIONS) {
      await page.waitForTimeout(1100);
    }
  }
  await page.waitForTimeout(1100);
}

/** Navigate from intro through all questions to the email gate. */
async function navigateToEmailGate(page: Page): Promise<void> {
  await page.goto('/quiz');
  await expect(page.locator('#quiz-intro')).toHaveClass(/active/);
  await page.locator('#start-quiz').click();
  await expect(page.locator('[data-step="1"]')).toHaveClass(/active/, { timeout: 3000 });
  await answerAllQuestions(page);
  await expect(page.locator('#email-gate')).toHaveClass(/active/, { timeout: 3000 });
}

/** Handle calculating interstitial + optional self-select. */
async function waitForResults(page: Page): Promise<void> {
  const selfSelect = page.locator('#self-select');
  const quizResults = page.locator('#quiz-results');
  await Promise.race([
    expect(selfSelect).toHaveClass(/active/, { timeout: 6000 }).catch(() => {}),
    expect(quizResults).toHaveClass(/active/, { timeout: 6000 }).catch(() => {}),
  ]);
  const selfSelectActive = await selfSelect.evaluate(
    (el) => el.classList.contains('active')
  ).catch(() => false);
  if (selfSelectActive) {
    await page.locator('.self-select-card').first().click();
  }
  await expect(quizResults).toHaveClass(/active/, { timeout: 3000 });
}

/** Submit email at the email gate, then wait through calculating to results. */
async function submitEmailAndWaitForResults(page: Page): Promise<void> {
  await page.locator('#email-gate-form [name="email"]').fill('test@example.com');
  await page.locator('#email-gate-form').locator('[type="submit"]').click();
  await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });
  await waitForResults(page);
}

/** Skip email at the gate, then wait through calculating to results. */
async function skipEmailAndWaitForResults(page: Page): Promise<void> {
  await page.locator('#email-gate-skip').click();
  await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });
  await waitForResults(page);
}

// ---------------------------------------------------------------------------
// Layer 1: Quiz Results Gating (quiz.astro)
// ---------------------------------------------------------------------------

test.describe('Email gate — quiz results gating', () => {

  test('skip-path: teaser visible, full content hidden', async ({ page }) => {
    await navigateToEmailGate(page);
    await skipEmailAndWaitForResults(page);

    // Teaser elements are visible (archetype name + element tag)
    await expect(page.locator('#result-title')).toBeVisible();
    await expect(page.locator('#result-element')).toBeVisible();

    // Full content is NOT visible for skip-path users
    await expect(page.locator('#result-full')).not.toBeVisible();

    // Journey CTA is NOT visible (it's inside #result-full)
    await expect(page.locator('#journey-cta')).not.toBeVisible();
  });

  test('skip-path: shows email re-capture form', async ({ page }) => {
    await navigateToEmailGate(page);
    await skipEmailAndWaitForResults(page);

    // Email re-capture form is visible
    const recapture = page.locator('#result-email-capture');
    await expect(recapture).toBeVisible();

    // Re-capture form has email input and submit button
    await expect(recapture.locator('input[name="email"]')).toBeVisible();
    await expect(recapture.locator('[type="submit"]')).toBeVisible();
  });

  test('email-submit path: full reveal + product research visible', async ({ page }) => {
    await navigateToEmailGate(page);
    await submitEmailAndWaitForResults(page);

    // Full content is visible for email-submitted users
    await expect(page.locator('#result-full')).toBeVisible();

    // Product research section is visible
    await expect(page.locator('#product-research')).toBeVisible();

    // PR01: card backs (radio group)
    await expect(page.locator('#pr-card-backs')).toBeVisible();
    const cardBackOptions = page.locator('#pr-card-backs input[type="radio"]');
    await expect(cardBackOptions).toHaveCount(3);

    // PR02: product interest (checkbox group)
    await expect(page.locator('#pr-product-interest')).toBeVisible();
    const productOptions = page.locator('#pr-product-interest input[type="checkbox"]');
    await expect(productOptions).toHaveCount(6);
  });

  test('email re-capture: submitting reveals full content', async ({ page }) => {
    await navigateToEmailGate(page);
    await skipEmailAndWaitForResults(page);

    // Initially gated
    await expect(page.locator('#result-full')).not.toBeVisible();

    // Fill and submit re-capture form
    await page.locator('#result-email-capture input[name="email"]').fill('recapture@example.com');
    await page.locator('#result-email-capture [type="submit"]').click();

    // Full content now visible
    await expect(page.locator('#result-full')).toBeVisible({ timeout: 3000 });

    // Product research visible
    await expect(page.locator('#product-research')).toBeVisible();

    // Re-capture form hidden
    await expect(page.locator('#result-email-capture')).not.toBeVisible();
  });

  test('thf_sub cookie is set after email submission', async ({ page, context }) => {
    await navigateToEmailGate(page);
    await submitEmailAndWaitForResults(page);

    // Check that thf_sub cookie was set
    const cookies = await context.cookies();
    const thfCookie = cookies.find(c => c.name === 'thf_sub');
    expect(thfCookie).toBeDefined();
    expect(thfCookie!.value).toMatch(/^[a-z]+-[a-z]+$/); // kebab-case slug
    expect(thfCookie!.path).toBe('/');
  });

  test('thf_sub cookie is set after email re-capture', async ({ page, context }) => {
    await navigateToEmailGate(page);
    await skipEmailAndWaitForResults(page);

    // No cookie before re-capture
    let cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'thf_sub')).toBeUndefined();

    // Submit re-capture
    await page.locator('#result-email-capture input[name="email"]').fill('recapture@example.com');
    await page.locator('#result-email-capture [type="submit"]').click();
    await expect(page.locator('#result-full')).toBeVisible({ timeout: 3000 });

    // Cookie now set
    cookies = await context.cookies();
    const thfCookie = cookies.find(c => c.name === 'thf_sub');
    expect(thfCookie).toBeDefined();
    expect(thfCookie!.value).toMatch(/^[a-z]+-[a-z]+$/);
  });

  test('product research: skip link allows bypassing questions', async ({ page }) => {
    await navigateToEmailGate(page);
    await submitEmailAndWaitForResults(page);

    // Product research is visible
    await expect(page.locator('#product-research')).toBeVisible();

    // Skip link exists and is clickable
    const skipLink = page.locator('#product-research-skip');
    await expect(skipLink).toBeVisible();
    await skipLink.click();

    // Journey CTA is now visible (product research section collapsed or scrolled past)
    await expect(page.locator('#journey-cta')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Layer 1b: Product Research API payload
// ---------------------------------------------------------------------------

test.describe('Product research — API payload', () => {

  test('product research answers included in quiz-submit payload', async ({ page }) => {
    // Intercept the API call
    let capturedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/quiz-submit', async (route) => {
      const request = route.request();
      capturedPayload = JSON.parse(request.postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, archetype: 'air_weaver', quizVersion: 'v2' }),
      });
    });

    await navigateToEmailGate(page);
    await page.locator('#email-gate-form [name="email"]').fill('test@example.com');
    await page.locator('#email-gate-form').locator('[type="submit"]').click();
    await expect(page.locator('#quiz-calculating')).toHaveClass(/active/, { timeout: 3000 });
    await waitForResults(page);

    // Answer product research questions
    await page.locator('#pr-card-backs input[value="reversible"]').click();
    await page.locator('#pr-product-interest input[value="guidebook"]').click();
    await page.locator('#pr-product-interest input[value="live_performance"]').click();

    // Click continue to submit product research
    await page.locator('#product-research-continue').click();

    // Wait for the API call to be captured
    await page.waitForTimeout(1500);

    // Verify product research in payload
    expect(capturedPayload).not.toBeNull();
    const pr = (capturedPayload as Record<string, unknown>).productResearch as Record<string, unknown>;
    expect(pr).toBeDefined();
    expect(pr.cardBacks).toBe('reversible');
    expect(pr.productInterest).toEqual(expect.arrayContaining(['guidebook', 'live_performance']));
  });
});

// ---------------------------------------------------------------------------
// Layer 2: Journey Page Gating (/archetype/[slug])
// ---------------------------------------------------------------------------

test.describe('Journey page — cookie-based gating', () => {

  test('without cookie: shows gated view', async ({ page }) => {
    await page.goto('/archetype/air-weaver');

    // Gated view: hero visible, journey content hidden
    await expect(page.locator('#journey-hero')).toBeVisible();
    await expect(page.locator('#journey-gate-form')).toBeVisible();

    // Deep content not visible
    await expect(page.locator('#journey-content')).not.toBeVisible();
  });

  test('with correct cookie: shows full content', async ({ page, context }) => {
    // Set the cookie before navigating
    await context.addCookies([{
      name: 'thf_sub',
      value: 'air-weaver',
      domain: 'localhost',
      path: '/',
    }]);

    await page.goto('/archetype/air-weaver');

    // Full content visible
    await expect(page.locator('#journey-content')).toBeVisible();

    // Gate form not visible
    await expect(page.locator('#journey-gate-form')).not.toBeVisible();
  });

  test('with wrong archetype cookie: shows gated view', async ({ page, context }) => {
    // Set cookie for a different archetype
    await context.addCookies([{
      name: 'thf_sub',
      value: 'shadow-dancer',
      domain: 'localhost',
      path: '/',
    }]);

    await page.goto('/archetype/air-weaver');

    // Still gated — cookie doesn't match this archetype
    await expect(page.locator('#journey-gate-form')).toBeVisible();
    await expect(page.locator('#journey-content')).not.toBeVisible();
  });

  test('submitting email on gated page sets cookie and reveals content', async ({ page, context }) => {
    await page.goto('/archetype/air-weaver');

    // Initially gated
    await expect(page.locator('#journey-gate-form')).toBeVisible();
    await expect(page.locator('#journey-content')).not.toBeVisible();

    // Submit email on the gate form
    await page.locator('#journey-gate-form input[name="email"]').fill('gate@example.com');
    await page.locator('#journey-gate-form [type="submit"]').click();

    // Content revealed (page reloads or JS reveals)
    await expect(page.locator('#journey-content')).toBeVisible({ timeout: 5000 });

    // Cookie now set
    const cookies = await context.cookies();
    const thfCookie = cookies.find(c => c.name === 'thf_sub');
    expect(thfCookie).toBeDefined();
    expect(thfCookie!.value).toBe('air-weaver');
  });
});
