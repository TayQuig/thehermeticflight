/**
 * Playwright E2E tests for Archetype Journey Pages.
 *
 * Usage:
 *   1. npm run build
 *   2. npm run preview &   (starts on port 4321)
 *   3. npx tsx tests/journey-pages.spec.ts
 *
 * Uses raw playwright (not @playwright/test) with custom pass/fail helpers,
 * matching the pattern established in tests/quiz-flow.spec.ts.
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
// Test: All 6 journey pages load with status 200
// ---------------------------------------------------------------------------
async function testAll6JourneyPagesLoad() {
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
      const res = await page.goto(`${BASE_URL}/archetype/${slug}`);
      if (!res || res.status() !== 200) {
        throw new Error(`/archetype/${slug} returned status ${res?.status()}`);
      }
      const h1 = await page.textContent('h1');
      if (!h1 || h1.length === 0) {
        throw new Error(`/archetype/${slug} has empty h1`);
      }
    }
    pass('testAll6JourneyPagesLoad');
  } catch (err) {
    fail('testAll6JourneyPagesLoad', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Air Weaver journey page has correct h1 and sections
// ---------------------------------------------------------------------------
async function testAirWeaverJourneyPageContent() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/archetype/air-weaver`);

    // Correct h1
    const h1 = await page.textContent('h1');
    if (!h1?.includes('The Air Weaver')) {
      throw new Error(`Expected h1 to contain "The Air Weaver", got: ${h1}`);
    }

    // Affiliated Cards section present
    const affiliatedSection = await page.$('section[aria-label="Affiliated tarot cards"]');
    if (!affiliatedSection) throw new Error('Affiliated cards section not found');

    // Spreads section present
    const spreadsSection = await page.$('section[aria-label="Recommended tarot spreads"]');
    if (!spreadsSection) throw new Error('Recommended spreads section not found');

    // Journaling Prompts section present
    const promptsSection = await page.$('section[aria-label="Journaling prompts"]');
    if (!promptsSection) throw new Error('Journaling prompts section not found');

    // At least 3 journaling prompt list items
    const prompts = await page.$$('section[aria-label="Journaling prompts"] ol li');
    if (prompts.length < 3) {
      throw new Error(`Expected at least 3 journaling prompts, found: ${prompts.length}`);
    }

    pass('testAirWeaverJourneyPageContent');
  } catch (err) {
    fail('testAirWeaverJourneyPageContent', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Journey page SEO — title, description, OG tags, canonical, JSON-LD
// ---------------------------------------------------------------------------
async function testJourneyPageSEO() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/archetype/shadow-dancer`);

    // Page title contains archetype name and site name
    const title = await page.title();
    if (!title.includes('Shadow Dancer') || !title.includes('The Hermetic Flight')) {
      throw new Error(`Page title missing expected content: ${title}`);
    }

    // OG title present
    const ogTitle = await page.$eval(
      'meta[property="og:title"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogTitle?.includes('Shadow Dancer')) {
      throw new Error(`og:title missing "Shadow Dancer": ${ogTitle}`);
    }

    // OG description present
    const ogDesc = await page.$eval(
      'meta[property="og:description"]',
      (el) => el.getAttribute('content'),
    );
    if (!ogDesc || ogDesc.length < 20) {
      throw new Error(`og:description missing or too short: ${ogDesc}`);
    }

    // Canonical URL uses www and correct path
    const canonical = await page.$eval(
      'link[rel="canonical"]',
      (el) => el.getAttribute('href'),
    );
    if (!canonical?.includes('thehermeticflight.com/archetype/shadow-dancer')) {
      throw new Error(`Canonical URL incorrect: ${canonical}`);
    }

    // JSON-LD FAQPage present
    const jsonLd = await page.$eval(
      'script[type="application/ld+json"]',
      (el) => el.textContent,
    );
    if (!jsonLd?.includes('FAQPage')) {
      throw new Error(`JSON-LD FAQPage schema not found. Got: ${jsonLd?.slice(0, 100)}`);
    }

    pass('testJourneyPageSEO');
  } catch (err) {
    fail('testJourneyPageSEO', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Result page links to journey page
// ---------------------------------------------------------------------------
async function testResultPageLinksToJourney() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz/result/grounded-mystic`);

    // Journey CTA link must be present with correct href
    const journeyLink = await page.$('a[href="/archetype/grounded-mystic"]');
    if (!journeyLink) {
      throw new Error('Journey page link not found on result page');
    }

    // Link text should contain "Go Deeper" or similar journey language
    const linkText = await journeyLink.textContent();
    if (!linkText?.trim()) {
      throw new Error('Journey link has no text content');
    }

    // Quiz link still present (regression check)
    const quizLink = await page.$('a[href="/quiz"]');
    if (!quizLink) {
      throw new Error('Quiz CTA link missing from result page after modification');
    }

    pass('testResultPageLinksToJourney');
  } catch (err) {
    fail('testResultPageLinksToJourney', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: Journey page "Your Result" link points back to the correct result page
// ---------------------------------------------------------------------------
async function testJourneyPageBackLink() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Set cookie so the page renders in ungated mode (footer CTA visible)
  await context.addCookies([{
    name: 'thf_sub',
    value: 'flow-artist',
    domain: 'localhost',
    path: '/',
  }]);
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/archetype/flow-artist`);

    const backLink = await page.$('a[href="/quiz/result/flow-artist"]');
    if (!backLink) {
      throw new Error('"Your Result" back-link not found on journey page');
    }

    pass('testJourneyPageBackLink');
  } catch (err) {
    fail('testJourneyPageBackLink', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n  Archetype Journey Pages E2E Tests\n');

  await testAll6JourneyPagesLoad();
  await testAirWeaverJourneyPageContent();
  await testJourneyPageSEO();
  await testResultPageLinksToJourney();
  await testJourneyPageBackLink();

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
