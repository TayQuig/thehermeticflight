/**
 * Thank-you redirect — E2E tests.
 * Frozen-test-file protocol: do NOT modify this file during implementation.
 *
 * Uses @playwright/test format.
 * Requires a running dev server at http://localhost:4321.
 */
import { test, expect } from '@playwright/test';

test.describe('thank-you page — archetype CTA', () => {
  test('valid slug: shows archetype CTA, hides fallback, has correct result link href, shows archetype name', async ({ page }) => {
    await page.goto('/thank-you?archetype=air-weaver');

    // Archetype CTA should be visible (JS removes "hidden" class)
    const archetypeCta = page.locator('#archetype-cta');
    await expect(archetypeCta).toBeVisible();

    // Fallback CTA should be hidden
    const fallbackCta = page.locator('#fallback-cta');
    await expect(fallbackCta).toBeHidden();

    // Archetype name should be populated
    const archetypeName = page.locator('#archetype-name');
    await expect(archetypeName).toHaveText('The Air Weaver');

    // Result link should point to the correct result page
    const resultLink = page.locator('#archetype-result-link');
    await expect(resultLink).toHaveAttribute('href', '/quiz/result/air-weaver');
  });

  test('no param: shows fallback CTA, hides archetype CTA, fallback links to /quiz', async ({ page }) => {
    await page.goto('/thank-you');

    // Fallback CTA should be visible
    const fallbackCta = page.locator('#fallback-cta');
    await expect(fallbackCta).toBeVisible();

    // Archetype CTA should remain hidden
    const archetypeCta = page.locator('#archetype-cta');
    await expect(archetypeCta).toBeHidden();

    // Fallback link should point to /quiz
    const quizLink = fallbackCta.locator('a[href="/quiz"]');
    await expect(quizLink).toBeVisible();
  });

  test('invalid slug: shows fallback (invalid slug rejected)', async ({ page }) => {
    await page.goto('/thank-you?archetype=not-a-real-archetype');

    // Fallback CTA should be visible (invalid slug rejected)
    const fallbackCta = page.locator('#fallback-cta');
    await expect(fallbackCta).toBeVisible();

    // Archetype CTA should remain hidden
    const archetypeCta = page.locator('#archetype-cta');
    await expect(archetypeCta).toBeHidden();
  });

  test('XSS slug: shows fallback (javascript: slug rejected)', async ({ page }) => {
    await page.goto('/thank-you?archetype=javascript%3Aalert%281%29');

    // Fallback CTA should be visible (XSS slug rejected)
    const fallbackCta = page.locator('#fallback-cta');
    await expect(fallbackCta).toBeVisible();

    // Archetype CTA should remain hidden
    const archetypeCta = page.locator('#archetype-cta');
    await expect(archetypeCta).toBeHidden();
  });
});

test.describe('quiz page — result profile link', () => {
  test('#result-profile-link element exists with default href /quiz', async ({ page }) => {
    await page.goto('/quiz');

    // The profile link should exist (it starts hidden inside the email-success section)
    const profileLink = page.locator('#result-profile-link');
    await expect(profileLink).toBeAttached();

    // Default href should be /quiz before archetype is known
    await expect(profileLink).toHaveAttribute('href', '/quiz');
  });
});
