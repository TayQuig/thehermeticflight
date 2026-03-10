# @playwright/test Reference Guide

Generated: 2026-03-09
Source: Context7 — /microsoft/playwright.dev (v1.58.2 docs)

---

## 1. Installation

The raw `playwright` package and the `@playwright/test` test runner are separate packages. The test runner is the recommended way to write E2E tests.

```bash
# Install @playwright/test (replaces raw `playwright` in devDependencies)
npm install -D @playwright/test

# Install browser binaries (Chromium, Firefox, WebKit)
npx playwright install

# Install only Chromium
npx playwright install chromium
```

**Difference from raw `playwright`:**

| Aspect | `playwright` (raw) | `@playwright/test` |
|---|---|---|
| Package | `playwright` | `@playwright/test` |
| Entry point | Manual `chromium.launch()` | `test()` / `expect()` fixtures |
| Runner | `npx tsx yourfile.ts` | `npx playwright test` |
| Browser management | Manual open/close per test | Automatic, isolated per test |
| Reporting | `console.log` | Built-in HTML, list, dot reporters |
| Retries, parallelism | Manual | Config-driven |
| Config file | None | `playwright.config.ts` |

> Note: If both `playwright` and `@playwright/test` are installed simultaneously, `npx playwright test` will conflict. Remove the raw `playwright` devDependency when migrating.

---

## 2. Config File: `playwright.config.ts`

Place `playwright.config.ts` at the project root. This is the full recommended config for an Astro project served via `astro preview` on port 4321.

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Directory where test files live (relative to this config)
  testDir: 'tests',

  // Give each test 30 seconds; increase for slow CI environments
  timeout: 30_000,

  // Run all test files in parallel (individual tests within a file are serial)
  fullyParallel: true,

  // Fail the build on CI if test.only() was accidentally committed
  forbidOnly: !!process.env.CI,

  // Retry failed tests twice on CI, never locally
  retries: process.env.CI ? 2 : 0,

  // Run only 1 worker on CI to avoid port conflicts; unlimited locally
  workers: process.env.CI ? 1 : undefined,

  // Default reporter: HTML report (opens in browser after run)
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    // Base URL — lets tests use relative paths: page.goto('/')
    baseURL: 'http://localhost:4321',

    // Collect a Playwright trace on first retry (viewable via `npx playwright show-report`)
    trace: 'on-first-retry',

    // Capture screenshot on test failure
    screenshot: 'only-on-failure',

    // Run headless by default; set headless: false to watch tests locally
    headless: true,
  },

  // Browser projects — add or remove as needed
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Auto-start the preview server before tests, stop it after
  webServer: {
    // For Astro: build first (`npm run build`), then preview the static output
    command: 'npm run preview',
    url: 'http://localhost:4321',
    // 2-minute timeout for the server to become ready
    timeout: 120_000,
    // Reuse an already-running server locally; always start fresh on CI
    reuseExistingServer: !process.env.CI,
  },
});
```

### Key `use` options

| Option | Type | Default | Purpose |
|---|---|---|---|
| `baseURL` | string | — | Prefix for `page.goto('/')` |
| `headless` | boolean | `true` | Show/hide browser UI |
| `trace` | string | `'off'` | `'on'`, `'off'`, `'on-first-retry'`, `'retain-on-failure'` |
| `screenshot` | string | `'off'` | `'on'`, `'off'`, `'only-on-failure'` |
| `video` | string | `'off'` | `'on'`, `'off'`, `'on-first-retry'`, `'retain-on-failure'` |
| `actionTimeout` | number | `0` (none) | Max ms per action (click, fill, etc.) |
| `navigationTimeout` | number | `0` (none) | Max ms for `page.goto()` |
| `bypassCSP` | boolean | `false` | Skip Content-Security-Policy |
| `ignoreHTTPSErrors` | boolean | `false` | Ignore HTTPS cert errors (useful for local preview) |

### `webServer` options

| Option | Type | Purpose |
|---|---|---|
| `command` | string | Shell command to start the server |
| `url` | string | URL Playwright polls until the server is ready |
| `timeout` | number | Max ms to wait for the server (default: 60 000) |
| `reuseExistingServer` | boolean | Skip launch if URL is already responding |
| `stdout` | string | `'pipe'` or `'ignore'` — show server logs in test output |
| `stderr` | string | Same as `stdout` |
| `env` | object | Extra env vars passed to the server process |

---

## 3. Test File Structure

```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test';

// test.describe() groups related tests (optional but recommended)
test.describe('Homepage', () => {

  // Each test() gets a fresh `page` fixture — isolated browser context
  test('has correct OG title', async ({ page }) => {
    // baseURL from config is automatically prepended
    await page.goto('/');

    const ogTitle = await page.locator('meta[property="og:title"]')
      .getAttribute('content');

    // Web-first assertion — automatically retries until passing or timeout
    await expect(page).toHaveTitle(/The Hermetic Flight/);
    expect(ogTitle).toBeTruthy();
  });

  test('navigation link works', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Take the Quiz' }).click();
    await expect(page).toHaveURL('/quiz');
  });
});
```

### Core fixtures injected into `test()` callbacks

| Fixture | Type | Description |
|---|---|---|
| `page` | `Page` | A new browser page per test |
| `context` | `BrowserContext` | The browser context (cookies, storage) |
| `browser` | `Browser` | The browser instance (shared across tests in a worker) |
| `request` | `APIRequestContext` | For making API requests without a page |

### Common `expect()` matchers

```typescript
// Page-level
await expect(page).toHaveURL('/quiz/result/air-weaver');
await expect(page).toHaveTitle(/Air Weaver/);

// Element visibility
await expect(page.locator('h1')).toBeVisible();
await expect(page.locator('#copy-link-btn')).toBeVisible();
await expect(page.locator('.hidden-thing')).toBeHidden();

// Text content
await expect(page.locator('h1')).toContainText('The Air Weaver');
await expect(page.locator('h1')).toHaveText('The Air Weaver');

// Attribute
await expect(page.locator('link[rel="canonical"]'))
  .toHaveAttribute('href', /www\.thehermeticflight\.com/);

// Count
await expect(page.locator('#share-buttons a')).toHaveCount(2);

// HTTP response (via page.goto return value)
const response = await page.goto('/quiz/result/shadow-dancer');
expect(response?.status()).toBe(200);
```

---

## 4. Migration Guide: Raw Playwright → @playwright/test

### Pattern 1: Browser lifecycle

```typescript
// BEFORE (raw playwright) — manual browser open/close in every test function
import { chromium } from 'playwright';

async function testSomething() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:4321/');
    // ... assertions ...
  } finally {
    await browser.close();    // must not forget this
  }
}

// AFTER (@playwright/test) — page fixture is managed automatically
import { test, expect } from '@playwright/test';

test('something', async ({ page }) => {
  await page.goto('/');      // baseURL prepended automatically
  // ... assertions ...
  // browser closes automatically after test
});
```

### Pattern 2: Pass/fail tracking

```typescript
// BEFORE — custom pass/fail counters + process.exit
let passed = 0;
let failed = 0;

function pass(name: string) { passed++; console.log(`✓ ${name}`); }
function fail(name: string, err: unknown) { failed++; /* ... */ }

async function testHomepageOGTags() {
  try {
    // ... test code ...
    pass('testHomepageOGTags');
  } catch (err) {
    fail('testHomepageOGTags', err);
  }
}

// AFTER — throw / expect directly; runner handles pass/fail
test('homepage OG tags', async ({ page }) => {
  await page.goto('/');
  const ogTitle = await page.locator('meta[property="og:title"]')
    .getAttribute('content');
  expect(ogTitle).toBeTruthy();
  // Any uncaught throw or failed expect() = test failure — no try/catch needed
});
```

### Pattern 3: `$eval` → locator `.getAttribute()`

```typescript
// BEFORE
const ogTitle = await page.$eval(
  'meta[property="og:title"]',
  (el) => el.getAttribute('content'),
);

// AFTER — locator API (auto-waits for element)
const ogTitle = await page.locator('meta[property="og:title"]')
  .getAttribute('content');
```

### Pattern 4: `page.$` / `page.$$` → locators

```typescript
// BEFORE — element handles, no auto-wait
const startBtn = await page.$('#start-quiz');
if (!startBtn) throw new Error('Start quiz button not found');
await startBtn.click();

const shareLinks = await page.$$('#share-buttons a');
if (shareLinks.length !== 2) throw new Error(`Expected 2, got ${shareLinks.length}`);

// AFTER — locators auto-wait; count assertion retries until passing
await page.locator('#start-quiz').click();               // auto-waits for element
await expect(page.locator('#share-buttons a')).toHaveCount(2);
```

### Pattern 5: Manual timeout → auto-wait

```typescript
// BEFORE — arbitrary sleep after interaction
await startBtn.click();
await page.waitForTimeout(400);
const q1 = await page.$('[data-step="1"].active');

// AFTER — locator assertion retries until element matches or timeout
await page.locator('#start-quiz').click();
await expect(page.locator('[data-step="1"]')).toHaveClass(/active/);
```

### Pattern 6: Iterating multiple pages

```typescript
// BEFORE — single browser, sequential goto, manual check
for (const slug of slugs) {
  const res = await page.goto(`${BASE_URL}/quiz/result/${slug}`);
  if (!res || res.status() !== 200) throw new Error(`...`);
}

// AFTER — same structure, cleaner assertions
const slugs = ['air-weaver', 'embodied-intuitive', 'ascending-seeker',
                'shadow-dancer', 'flow-artist', 'grounded-mystic'];

for (const slug of slugs) {
  test(`result page loads: ${slug}`, async ({ page }) => {
    const response = await page.goto(`/quiz/result/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).not.toBeEmpty();
  });
}
```

### Pattern 7: Selecting elements that may not exist

```typescript
// BEFORE
const copyBtn = await page.$('#copy-link-btn');
if (!copyBtn) throw new Error('Copy link button not found');

// AFTER — toBeVisible() asserts existence and visibility in one step
await expect(page.locator('#copy-link-btn')).toBeVisible();
```

---

## 5. CLI Commands

```bash
# Run all tests (uses playwright.config.ts)
npx playwright test

# Run a specific file
npx playwright test tests/quiz-flow.spec.ts

# Run only tests matching a name pattern
npx playwright test --grep "OG tags"

# Run only the chromium project
npx playwright test --project chromium

# Run tests in headed mode (watch the browser)
npx playwright test --headed

# Run with a specific reporter
npx playwright test --reporter=list
npx playwright test --reporter=dot
npx playwright test --reporter=html      # opens HTML report after run

# Open interactive UI mode (time-travel debugger)
npx playwright test --ui

# Open Playwright Inspector (step through tests)
npx playwright test --debug

# Show the last HTML report without re-running
npx playwright show-report

# View a trace file
npx playwright show-trace trace.zip

# Enable trace for all tests (large output — use for debugging only)
npx playwright test --trace on
```

---

## 6. CI Configuration

### GitHub Actions example

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build site
        run: npm run build

      - name: Run E2E tests
        run: npm run e2e
        env:
          CI: true

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7
```

### CI behavior controlled by config

The `playwright.config.ts` already handles CI-specific behavior via `process.env.CI`:

- `retries: process.env.CI ? 2 : 0` — retries on CI, not locally
- `workers: process.env.CI ? 1 : undefined` — single worker on CI avoids port conflicts
- `reuseExistingServer: !process.env.CI` — always spawns a fresh server on CI
- `reporter: process.env.CI ? 'github' : 'html'` — GitHub annotations on CI

### Artifact output paths

| Path | Contents |
|---|---|
| `playwright-report/` | HTML report (screenshots, videos, traces) |
| `test-results/` | Raw trace files, screenshots, videos per test |

---

## 7. Hermetic Flight Integration Notes

### Current state

- Package: `playwright` v1.58.2 (raw, in `devDependencies`)
- Test file: `tests/quiz-flow.spec.ts`
- Runner: `npx tsx tests/quiz-flow.spec.ts` (manual, requires server running first)
- Pattern: `chromium.launch()` + custom `pass()`/`fail()` helpers + `process.exit(1)`
- No `playwright.config.ts`, no `webServer` automation

### Migration path

**Step 1 — Swap packages:**

```bash
npm uninstall playwright
npm install -D @playwright/test
npx playwright install chromium
```

**Step 2 — Add `playwright.config.ts`** at project root (use the config in Section 2 above). Key settings for this project:

```typescript
webServer: {
  command: 'npm run preview',   // requires `npm run build` to have been run first
  url: 'http://localhost:4321',
  timeout: 120_000,
  reuseExistingServer: !process.env.CI,
},
use: {
  baseURL: 'http://localhost:4321',
},
```

Note: `astro preview` serves a pre-built static site. On CI, the workflow must run `npm run build` before `npx playwright test`. Locally, run `npm run build && npm run preview` once; subsequent test runs can reuse the server with `reuseExistingServer: true`.

**Step 3 — Add `e2e` script to `package.json`:**

```json
"scripts": {
  "dev": "astro dev",
  "start": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "astro": "astro",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "e2e:headed": "playwright test --headed"
}
```

**Step 4 — Rewrite `tests/quiz-flow.spec.ts`** using the migration patterns in Section 4.

### Existing test coverage (5 tests)

| Current function | Migrated test name | What it checks |
|---|---|---|
| `testHomepageOGTags` | `homepage OG tags` | `og:title` present, `og:image` contains site URL, `twitter:card` = `summary_large_image` |
| `testResultPageOGAndShareButtons` | `result page: OG tags and share buttons` | h1 text, `og:title`, `og:image` filename, 2 share links, copy button, quiz CTA link |
| `testAll6ResultPagesLoad` | `result pages load: <slug>` (×6) | HTTP 200, non-empty h1 for all 6 archetypes |
| `testQuizIntroAndStart` | `quiz intro and start button` | `#start-quiz` exists, `#quiz-intro.active` on load, Q1 active after click |
| `testResultPageCanonicalURL` | `result page canonical URL` | `link[rel="canonical"]` starts with `https://www.thehermeticflight.com` |

### Key migration notes for existing tests

- Replace all `chromium.launch()` / `browser.close()` with the `page` fixture — the runner manages this automatically.
- Replace `page.$eval('meta[...]', el => el.getAttribute(...))` with `page.locator('meta[...]').getAttribute('content')`.
- Replace `page.$('#el')` null-checks with `await expect(page.locator('#el')).toBeVisible()`.
- Replace `page.$$('#share-buttons a')` length-check with `await expect(page.locator('#share-buttons a')).toHaveCount(2)`.
- Remove `page.waitForTimeout(400)` after the start-button click; replace with `await expect(page.locator('[data-step="1"]')).toHaveClass(/active/)`.
- The `BASE_URL` constant and `process.env.TEST_URL` fallback are no longer needed — `baseURL` in config covers this.
- The `pass()` / `fail()` helpers, the `passed`/`failed` counters, and the `run()` function are all removed. The runner handles reporting.

### Incremental migration option

If you want to keep the old test file working during the transition, `@playwright/test` exports the raw browser APIs too:

```typescript
import { chromium } from '@playwright/test';  // same API, different package
```

This lets you install `@playwright/test` and run the old file via `npx tsx` without rewriting it first.
