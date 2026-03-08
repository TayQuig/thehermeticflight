/**
 * Playwright E2E tests for quiz flow, result pages, and share CTA.
 *
 * Usage:
 *   1. npm run build
 *   2. npm run preview &   (starts on port 4321)
 *   3. npx tsx tests/quiz-flow.spec.ts
 *
 * Uses raw playwright (not @playwright/test) with custom pass/fail helpers.
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_URL || 'http://localhost:4321';
let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(name: string) {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function fail(name: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  failures.push(`${name}: ${msg}`);
  console.log(`  \x1b[31m✗\x1b[0m ${name}: ${msg}`);
}

// ---------------------------------------------------------------------------
// Test: Homepage has OG meta tags
// ---------------------------------------------------------------------------
async function testHomepageOGTags() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/`);

    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle || ogTitle.length === 0) {
      throw new Error(`og:title missing or empty`);
    }

    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogImage?.includes('thehermeticflight.com')) {
      throw new Error(`og:image doesn't contain site URL: ${ogImage}`);
    }

    const twitterCard = await page.$eval(
      'meta[name="twitter:card"]',
      (el) => el.getAttribute('content'),
    );
    if (twitterCard !== 'summary_large_image') {
      throw new Error(`twitter:card should be summary_large_image, got: ${twitterCard}`);
    }

    pass('testHomepageOGTags');
  } catch (err) {
    fail('testHomepageOGTags', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Archetype result page renders OG tags and share buttons
// ---------------------------------------------------------------------------
async function testResultPageOGAndShareButtons() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz/result/air-weaver`);

    // Page loads with correct title
    const h1Text = await page.textContent('h1');
    if (!h1Text?.includes('The Air Weaver')) {
      throw new Error(`Expected h1 to contain "The Air Weaver", got: ${h1Text}`);
    }

    // OG tags present
    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle?.includes('Air Weaver')) {
      throw new Error(`Expected og:title to contain "Air Weaver", got: ${ogTitle}`);
    }

    const ogImage = await page.$eval(
      'meta[property="og:image"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogImage?.includes('air-weaver.png')) {
      throw new Error(`Expected og:image to contain "air-weaver.png", got: ${ogImage}`);
    }

    // Share buttons present
    const shareLinks = await page.$$('#share-buttons a');
    if (shareLinks.length !== 2) {
      throw new Error(`Expected 2 share links (X + Facebook), got: ${shareLinks.length}`);
    }

    const copyBtn = await page.$('#copy-link-btn');
    if (!copyBtn) throw new Error('Copy link button not found');

    // Quiz CTA present
    const quizCta = await page.$('a[href="/quiz"]');
    if (!quizCta) throw new Error('Quiz CTA link not found');

    pass('testResultPageOGAndShareButtons');
  } catch (err) {
    fail('testResultPageOGAndShareButtons', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: All 6 result pages load successfully
// ---------------------------------------------------------------------------
async function testAll6ResultPagesLoad() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const slugs = [
    'air-weaver',
    'embodied-intuitive',
    'ascending-seeker',
    'shadow-dancer',
    'flow-artist',
    'grounded-mystic',
  ];
  try {
    for (const slug of slugs) {
      const res = await page.goto(`${BASE_URL}/quiz/result/${slug}`);
      if (!res || res.status() !== 200) {
        throw new Error(`/quiz/result/${slug} returned status ${res?.status()}`);
      }
      const h1 = await page.textContent('h1');
      if (!h1 || h1.length === 0) {
        throw new Error(`/quiz/result/${slug} has empty h1`);
      }
    }
    pass('testAll6ResultPagesLoad');
  } catch (err) {
    fail('testAll6ResultPagesLoad', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Quiz intro screen loads and start button works
// ---------------------------------------------------------------------------
async function testQuizIntroAndStart() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz`);

    const startBtn = await page.$('#start-quiz');
    if (!startBtn) throw new Error('Start quiz button not found');

    const introActive = await page.$('#quiz-intro.active');
    if (!introActive) throw new Error('Quiz intro should be active on load');

    await startBtn.click();
    await page.waitForTimeout(400);

    // After clicking start, first question should be visible
    const q1 = await page.$('[data-step="1"].active');
    if (!q1) throw new Error('Question 1 should be active after clicking start');

    pass('testQuizIntroAndStart');
  } catch (err) {
    fail('testQuizIntroAndStart', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Result page canonical URL uses www
// ---------------------------------------------------------------------------
async function testResultPageCanonicalURL() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz/result/shadow-dancer`);

    const canonical = await page.$eval(
      'link[rel="canonical"]',
      (el) => el.getAttribute('href'),
    );
    if (!canonical?.startsWith('https://www.thehermeticflight.com')) {
      throw new Error(`Canonical should use www prefix, got: ${canonical}`);
    }

    pass('testResultPageCanonicalURL');
  } catch (err) {
    fail('testResultPageCanonicalURL', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n  Quiz Flow E2E Tests\n');

  await testHomepageOGTags();
  await testResultPageOGAndShareButtons();
  await testAll6ResultPagesLoad();
  await testQuizIntroAndStart();
  await testResultPageCanonicalURL();

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failures.length > 0) {
    console.log('  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
