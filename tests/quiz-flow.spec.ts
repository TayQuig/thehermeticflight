/**
 * Playwright E2E tests for quiz flow, result pages, and share CTA.
 *
 * Runner: npx playwright test (uses playwright.config.ts)
 * Local setup: npm run build && npm run e2e
 * CI: runs against Vercel preview URL via TEST_URL env var
 *
 * Migrated from raw playwright to @playwright/test on 2026-03-09.
 * All 5 original test suites preserved with 1:1 assertion equivalence.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Suite 1: Homepage OG meta tags
// ---------------------------------------------------------------------------
test.describe('Homepage', () => {
  test('OG meta tags', async ({ page }) => {
    await page.goto('/');

    // og:title must be present and non-empty
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    // og:image must contain the production site URL
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toContain('thehermeticflight.com');

    // twitter:card must be summary_large_image
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Archetype result page renders OG tags and share buttons
// ---------------------------------------------------------------------------
test.describe('Result page: air-weaver', () => {
  test('OG tags and share buttons', async ({ page }) => {
    await page.goto('/quiz/result/air-weaver');

    // Page loads with correct h1
    await expect(page.locator('h1')).toContainText('The Air Weaver');

    // og:title contains archetype name
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('Air Weaver');

    // og:image references the correct archetype OG image
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toContain('air-weaver.png');

    // Exactly 2 share links (X + Facebook)
    await expect(page.locator('#share-buttons a')).toHaveCount(2);

    // Copy link button is present
    await expect(page.locator('#copy-link-btn')).toBeVisible();

    // Quiz CTA link is present
    await expect(page.locator('a[href="/quiz"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: All 6 result pages load successfully
// ---------------------------------------------------------------------------
test.describe('All result pages', () => {
  const slugs = [
    'air-weaver',
    'embodied-intuitive',
    'ascending-seeker',
    'shadow-dancer',
    'flow-artist',
    'grounded-mystic',
  ];

  for (const slug of slugs) {
    test(`loads: ${slug}`, async ({ page }) => {
      const response = await page.goto(`/quiz/result/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).not.toBeEmpty();
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 4: Quiz intro screen loads and start button works
// ---------------------------------------------------------------------------
test.describe('Quiz page', () => {
  test('intro screen and start button', async ({ page }) => {
    await page.goto('/quiz');

    // Start button exists
    await expect(page.locator('#start-quiz')).toBeVisible();

    // Quiz intro is active on load
    await expect(page.locator('#quiz-intro')).toHaveClass(/active/);

    // Click start — question 1 becomes active (replaces waitForTimeout(400))
    await page.locator('#start-quiz').click();
    await expect(page.locator('[data-step="1"]')).toHaveClass(/active/);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Result page canonical URL uses www
// ---------------------------------------------------------------------------
test.describe('Result page: shadow-dancer', () => {
  test('canonical URL uses www', async ({ page }) => {
    await page.goto('/quiz/result/shadow-dancer');

    await expect(page.locator('link[rel="canonical"]'))
      .toHaveAttribute('href', /www\.thehermeticflight\.com/);
  });
});
