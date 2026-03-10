# Infrastructure Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address two High-severity deferred findings: (1) migrate Playwright tests to @playwright/test and add CI pipeline, (2) add Content Security Policy headers in report-only mode.

**Architecture:** Playwright migration uses `@playwright/test` runner with `webServer` config for auto-starting preview server. CSP headers deployed via `vercel.json` in report-only mode. GitHub Actions workflow runs E2E tests against Vercel preview deploys.

**Tech Stack:** @playwright/test, GitHub Actions, Vercel, CSP headers

**Research artifacts:**
- `operations/playwright-test-reference.md` — migration guide + config examples
- `operations/vercel-github-actions-reference.md` — CI pipeline + preview URL capture

---

## Codebase Baseline

**Current state confirmed by file inspection (2026-03-09):**

- `tests/quiz-flow.spec.ts` (237 lines): imports `chromium` from raw `playwright` package; custom `pass()`/`fail()` helpers; manual `run()` function with `process.exit(1)`; `BASE_URL = process.env.TEST_URL || 'http://localhost:4321'`; 5 test suites (Homepage OG, Result page OG + share buttons, All 6 result pages, Quiz intro/start, Canonical URL)
- `src/env.d.ts` (9 lines): declares only `LOOPS_API_KEY` in `ImportMetaEnv`
- `package.json`: `playwright` v1.58.2 in `devDependencies`; no `e2e` scripts; scripts: `dev`, `start`, `build`, `preview`, `astro`, `test`, `test:watch`
- No `playwright.config.ts` at project root
- No `.github/workflows/` directory
- No `vercel.json` at project root
- `src/layouts/Layout.astro`: 3 inline `is:inline` script blocks (GTM init, GA4 init, Meta Pixel init); external scripts from `googletagmanager.com`; noscript iframe from `googletagmanager.com`; noscript pixel img from `facebook.com`; fonts from `fonts.googleapis.com` + `fonts.gstatic.com`

**Finding references:**
- **ARCH-03** (Architectural Integrity eval): "Playwright E2E test is a standalone script, not integrated into CI" — High severity, deferred from hardening-2026-03-08
- **ADV-01** (Adversarial Security eval): "No Content Security Policy" — Medium severity (upgraded to High for sprint prioritization), deferred from hardening-2026-03-08

---

## Task 1: Update env.d.ts

**What:** Add all 5 env var declarations so TypeScript knows about every secret the project uses. This is a quick foundational win — do it first.

**File:** `src/env.d.ts`

**TDD steps:**

1. Write failing test — add to `tests/env-declarations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('env.d.ts declarations', () => {
  const envDts = readFileSync(resolve(process.cwd(), 'src/env.d.ts'), 'utf-8');

  it('declares LOOPS_API_KEY', () => {
    expect(envDts).toContain('LOOPS_API_KEY');
  });

  it('declares TALLY_API_KEY', () => {
    expect(envDts).toContain('TALLY_API_KEY');
  });

  it('declares GA4_SERVICE_ACCOUNT_KEY', () => {
    expect(envDts).toContain('GA4_SERVICE_ACCOUNT_KEY');
  });

  it('declares GA4_PROPERTY_ID', () => {
    expect(envDts).toContain('GA4_PROPERTY_ID');
  });

  it('declares SEOBOT_API_SECRET', () => {
    expect(envDts).toContain('SEOBOT_API_SECRET');
  });
});
```

2. Verify fail:
```bash
npx vitest run tests/env-declarations.test.ts --reporter=verbose
```
Expected: 4 tests fail (TALLY_API_KEY, GA4_SERVICE_ACCOUNT_KEY, GA4_PROPERTY_ID, SEOBOT_API_SECRET missing).

3. Implement — replace contents of `src/env.d.ts`:
```typescript
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string;
  readonly TALLY_API_KEY: string;
  readonly GA4_SERVICE_ACCOUNT_KEY: string;
  readonly GA4_PROPERTY_ID: string;
  readonly SEOBOT_API_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

4. Verify pass:
```bash
npx vitest run tests/env-declarations.test.ts --reporter=verbose
```
Expected: 5 tests pass.

5. Commit:
```bash
git add src/env.d.ts tests/env-declarations.test.ts
git commit -m "feat: declare all project env vars in env.d.ts"
```

---

## Task 2: Install @playwright/test and create config

**What:** Swap out the raw `playwright` package for `@playwright/test`, create `playwright.config.ts` at the project root, and add `e2e` scripts to `package.json`. The test file itself is not migrated yet — that is Task 3.

**Files created/modified:** `playwright.config.ts` (new), `package.json` (scripts + devDependencies)

**TDD steps:**

1. Write failing test — add to `tests/playwright-config.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('playwright.config.ts exists and is valid', () => {
  const configPath = resolve(process.cwd(), 'playwright.config.ts');

  it('playwright.config.ts exists at project root', () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it('config references webServer with npm run preview', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain("command: 'npm run preview'");
  });

  it('config sets baseURL to localhost:4321', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('localhost:4321');
  });

  it('config uses forbidOnly on CI', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('forbidOnly');
    expect(content).toContain('process.env.CI');
  });
});

describe('package.json has e2e scripts', () => {
  const pkg = JSON.parse(
    readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')
  );

  it('has e2e script', () => {
    expect(pkg.scripts.e2e).toBeDefined();
  });

  it('has e2e:ui script', () => {
    expect(pkg.scripts['e2e:ui']).toBeDefined();
  });

  it('has e2e:headed script', () => {
    expect(pkg.scripts['e2e:headed']).toBeDefined();
  });

  it('devDependencies has @playwright/test not playwright', () => {
    expect(pkg.devDependencies['@playwright/test']).toBeDefined();
    expect(pkg.devDependencies['playwright']).toBeUndefined();
  });
});
```

2. Verify fail:
```bash
npx vitest run tests/playwright-config.test.ts --reporter=verbose
```
Expected: all 8 tests fail.

3. Implement:

**Step 3a — Swap packages:**
```bash
npm uninstall playwright
npm install -D @playwright/test
npx playwright install chromium
```

**Step 3b — Create `playwright.config.ts` at project root:**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

Note: `testMatch: '**/*.spec.ts'` ensures the existing `quiz-flow.spec.ts` is picked up. The `webServer` command is `npm run preview`, which requires `npm run build` to have been run first. On CI, the workflow (Task 5) runs `vercel build` before tests. Locally, run `npm run build` once before `npm run e2e`.

**Step 3c — Update `package.json` scripts:**
Add three new scripts to the `"scripts"` block:
```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui",
"e2e:headed": "playwright test --headed"
```

4. Verify pass:
```bash
npx vitest run tests/playwright-config.test.ts --reporter=verbose
```
Expected: all 8 tests pass.

5. Verify E2E test list is discoverable (does not run tests, just lists them):
```bash
npx playwright test --list
```
Expected: output shows `quiz-flow.spec.ts` with its test names listed.

Note: `npx playwright test` will fail at this point because `quiz-flow.spec.ts` still uses raw playwright API — that is expected and will be fixed in Task 3.

6. Commit:
```bash
git add playwright.config.ts package.json package-lock.json tests/playwright-config.test.ts
git commit -m "feat: install @playwright/test and add playwright.config.ts"
```

---

## Task 3: Migrate quiz-flow.spec.ts

**What:** Rewrite `tests/quiz-flow.spec.ts` from raw Playwright to `@playwright/test` API. All 5 original test suites and every assertion within them must be preserved — no assertion may be weakened or removed. The goal is 1:1 semantic equivalence, not just passing tests.

**File modified:** `tests/quiz-flow.spec.ts`

**Migration map (original function → migrated test):**

| Original function | Migrated `test.describe` + `test()` | Key pattern changes |
|---|---|---|
| `testHomepageOGTags` | `describe('Homepage')` → `test('OG meta tags')` | `$eval` → `locator().getAttribute()`, `if (!x)` → `expect(x).toBeTruthy()` |
| `testResultPageOGAndShareButtons` | `describe('Result page: air-weaver')` → `test('OG tags and share buttons')` | `$$` length-check → `toHaveCount(2)`, `page.$` null-check → `toBeVisible()` |
| `testAll6ResultPagesLoad` | `describe('All result pages')` → loop of `test('loads: <slug>')` | `if (!res || res.status() !== 200)` → `expect(response?.status()).toBe(200)` |
| `testQuizIntroAndStart` | `describe('Quiz page')` → `test('intro screen and start button')` | `page.$` null-check → `toBeVisible()`, `waitForTimeout(400)` → `toHaveClass(/active/)` |
| `testResultPageCanonicalURL` | `describe('Result page: shadow-dancer')` → `test('canonical URL uses www')` | `$eval` → `locator().getAttribute()`, `if (!x?.startsWith...)` → `toHaveAttribute(/www\.thehermeticflight\.com/)` |

**TDD steps:**

1. Record baseline assertions — before touching the file, capture every assertion currently in it. Run this structural check to confirm what exists:
```bash
grep -n "throw new Error\|pass(\|fail(" tests/quiz-flow.spec.ts
```
Expected: 15+ lines covering all 5 test suites. Save this output as the assertion inventory.

2. Implement — complete replacement of `tests/quiz-flow.spec.ts`:
```typescript
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
```

3. Verify pass:
```bash
npm run build && npx playwright test --reporter=list
```
Expected: 11 tests pass (1 + 1 + 6 + 1 + 1 = 11, since the all-pages loop generates 6 individual tests), 0 failed.

4. Verify assertion integrity — confirm every original assertion category is still covered:
```bash
grep -n "expect\|toContain\|toBe\|toHaveCount\|toBeVisible\|toHaveClass\|toHaveAttribute" tests/quiz-flow.spec.ts
```
Expected: matches for all of: ogTitle truthy, ogImage site URL, twitterCard value, h1 text, ogTitle archetype, ogImage filename, share link count (2), copy button, quiz CTA, response status (200), non-empty h1, start button visible, intro active class, Q1 active class, canonical href www.

5. Commit:
```bash
git add tests/quiz-flow.spec.ts
git commit -m "feat: migrate quiz-flow.spec.ts to @playwright/test"
```

---

## Task 4: Create vercel.json with CSP headers

**What:** Create `vercel.json` at the project root with a `Content-Security-Policy-Report-Only` header applied to all routes. Report-only mode means violations are reported to the browser console (and optionally a report endpoint) but never block any resources. This is the safe starting mode — enforcing mode is a separate follow-up after 2 weeks of monitoring.

**File created:** `vercel.json`

**Complete CSP source inventory (verified against Layout.astro on 2026-03-09):**

| Directive | Sources | Rationale |
|---|---|---|
| `default-src` | `'self'` | Baseline: block everything not explicitly allowed |
| `script-src` | `'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net` | `'unsafe-inline'` required for GTM init, GA4 init, Meta Pixel init (all `is:inline`), quiz.astro script block, result page script block — cannot use nonces without GTM nonce config |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | `'unsafe-inline'` required for Tailwind utility classes; Google Fonts CSS |
| `font-src` | `'self' https://fonts.gstatic.com` | Google Fonts binary files served from gstatic CDN |
| `img-src` | `'self' data: https://www.facebook.com https://www.transparenttextures.com` | Facebook 1x1 tracking pixel (noscript); background textures from transparenttextures.com; `data:` for inline image data URIs |
| `frame-src` | `https://www.googletagmanager.com` | GTM noscript iframe (`<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-...">`) |
| `connect-src` | `'self' https://app.loops.so https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://connect.facebook.net` | Loops.so API (quiz-submit serverless); GA4 analytics beacons; GTM; Meta Pixel fetch requests |
| `object-src` | `'none'` | Disallow Flash/plugins entirely |
| `base-uri` | `'self'` | Prevent `<base>` tag injection |
| `form-action` | `'self'` | Forms only submit to same origin |

**TDD steps:**

This task uses the Frozen Test File protocol: Task 6 writes the CSP tests first. Because Task 6 must precede Task 4 in the frozen-test-file cycle, tests are written in Task 6 and then Task 4 implements against them. However, to preserve logical reading order in this plan, the structural test is documented here and implemented in Task 6 first.

**For verifying this task after implementation:**

1. Build and serve:
```bash
npm run build && npm run preview
```

2. Check response headers (in a second terminal):
```bash
curl -sI http://localhost:4321/ | grep -i content-security
```
Expected: `Content-Security-Policy-Report-Only` header present in response.

Note: `astro preview` does not apply Vercel response headers — headers from `vercel.json` only take effect on Vercel deployments. To verify locally, use the `vercel dev` command after running `vercel link` and `vercel pull`. The unit test in Task 6 validates the `vercel.json` structure without needing a live server.

3. Implement — create `vercel.json` at project root:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy-Report-Only",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://www.facebook.com https://www.transparenttextures.com; frame-src https://www.googletagmanager.com; connect-src 'self' https://app.loops.so https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://connect.facebook.net; object-src 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

4. Verify build still succeeds:
```bash
npm run build
```
Expected: build completes with no errors. `vercel.json` has no build-time effect — it is a Vercel deployment config file only.

5. Verify frozen tests pass (after Task 6 is written and this task implements):
```bash
npx vitest run tests/csp-headers.test.ts --reporter=verbose
```
Expected: all structural tests pass.

6. Commit:
```bash
git add vercel.json
git commit -m "feat: add Content-Security-Policy-Report-Only header via vercel.json"
```

**Important:** Do NOT switch this to `Content-Security-Policy` (enforcing mode) until after 2 weeks of monitoring the report-only violations in browser consoles and/or a CSP report endpoint. Premature enforcement will break GA4 or Meta Pixel tracking if any sources are missing from the inventory.

---

## Task 5: Create GitHub Actions workflow

**What:** Create `.github/workflows/preview-e2e.yaml`. On every push to a non-main branch, this workflow: deploys a Vercel preview using the Vercel CLI prebuilt pattern, captures the preview URL, installs Playwright browsers, and runs the E2E suite against the live preview. This closes the CI gap (ARCH-03).

**File created:** `.github/workflows/preview-e2e.yaml`

**Operator prerequisite tasks (must be done before workflow succeeds):**

1. Run `vercel link` from the project root to generate `.vercel/project.json`
2. Run `cat .vercel/project.json` to read `orgId` and `projectId`
3. Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret
4. Add three secrets:
   - `VERCEL_TOKEN` — from Vercel dashboard → Account Settings → Tokens
   - `VERCEL_ORG_ID` — the `orgId` value from `.vercel/project.json`
   - `VERCEL_PROJECT_ID` — the `projectId` value from `.vercel/project.json`
5. Commit `.vercel/project.json` to source control (it contains no secrets — only IDs)

**TDD steps:**

1. Write failing test — add to `tests/ci-workflow.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('.github/workflows/preview-e2e.yaml exists and is valid', () => {
  const workflowPath = resolve(process.cwd(), '.github/workflows/preview-e2e.yaml');

  it('workflow file exists', () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it('workflow triggers on push to non-main branches', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('branches-ignore');
    expect(content).toContain('main');
  });

  it('workflow references VERCEL_TOKEN secret', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('VERCEL_TOKEN');
  });

  it('workflow references VERCEL_ORG_ID secret', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('VERCEL_ORG_ID');
  });

  it('workflow references VERCEL_PROJECT_ID secret', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('VERCEL_PROJECT_ID');
  });

  it('workflow runs playwright test with TEST_URL', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('playwright test');
    expect(content).toContain('TEST_URL');
  });

  it('workflow uploads playwright report as artifact', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('upload-artifact');
    expect(content).toContain('playwright-report');
  });
});
```

2. Verify fail:
```bash
npx vitest run tests/ci-workflow.test.ts --reporter=verbose
```
Expected: all 7 tests fail (file does not exist yet).

3. Implement — create `.github/workflows/preview-e2e.yaml`:

First, create the directory:
```bash
mkdir -p .github/workflows
```

Then create the file with this exact content:
```yaml
name: Preview Deploy + E2E Tests

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

on:
  push:
    branches-ignore:
      - main

jobs:
  deploy-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel environment config
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build project artifacts
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel (preview)
        id: deploy
        run: |
          PREVIEW_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "url=$PREVIEW_URL" >> $GITHUB_OUTPUT

      - name: Wait for preview to become ready
        run: sleep 5

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests against preview URL
        env:
          TEST_URL: ${{ steps.deploy.outputs.url }}
          CI: true
        run: npm run e2e

      - name: Upload Playwright HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload Playwright traces on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: test-results/
          retention-days: 7
```

**Workflow notes:**
- `sleep 5` after deploy absorbs the brief window between upload-complete and HTTP-ready. If tests fail with connection errors on cold starts, increase to `sleep 15`.
- `CI: true` enables single-worker mode and retries (via `playwright.config.ts`).
- `TEST_URL` overrides `baseURL` in the config — the E2E tests hit the live Vercel preview, not a local server.
- The `webServer` in `playwright.config.ts` is skipped when `TEST_URL` is set because `baseURL` takes precedence for navigation calls, and no local server is started.
- Vercel's native Git integration will also trigger on each push if still active. This causes a double deploy (wasteful but not harmful). To prevent it, disable auto-deploys for non-main branches in the Vercel project settings dashboard.
- The `LOOPS_API_KEY` must be set in the Vercel preview environment (Vercel dashboard → Project → Settings → Environment Variables) for quiz submission tests to exercise the full API path.

4. Verify pass:
```bash
npx vitest run tests/ci-workflow.test.ts --reporter=verbose
```
Expected: all 7 tests pass.

5. Commit:
```bash
git add .github/workflows/preview-e2e.yaml tests/ci-workflow.test.ts
git commit -m "feat: add GitHub Actions preview deploy + E2E workflow"
```

---

## Task 6: Tests for CSP (Frozen Test File)

**What:** Write structural and unit tests for the CSP implementation. This task uses the Frozen Test File protocol: tests are written and baselined here; Task 4 is the implementing task. If running in implementation order, Task 6 is authored before Task 4 is executed.

**File created:** `tests/csp-headers.test.ts`

**Three test categories:**

1. **Structural unit test:** verifies `vercel.json` has the CSP header key and all required source domains
2. **Source inventory test:** scans `src/layouts/Layout.astro` for external script/style/connect sources and verifies each is present in the CSP
3. **Header presence note:** an E2E check that `Content-Security-Policy-Report-Only` is present in HTTP responses is only meaningful against a Vercel deployment (not `astro preview`). This is noted in the test file as a manual verification step, not automated.

**TDD steps:**

1. Write tests — create `tests/csp-headers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Structural: vercel.json has the CSP header with all required sources
// ---------------------------------------------------------------------------
describe('vercel.json CSP header structure', () => {
  const vercelJsonPath = resolve(process.cwd(), 'vercel.json');

  it('vercel.json exists', () => {
    expect(existsSync(vercelJsonPath)).toBe(true);
  });

  it('has a headers array', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    expect(Array.isArray(config.headers)).toBe(true);
    expect(config.headers.length).toBeGreaterThan(0);
  });

  it('applies headers to all routes via /(.*)', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const sources = config.headers.map((h: { source: string }) => h.source);
    expect(sources).toContain('/(.*)');
  });

  it('has Content-Security-Policy-Report-Only header (not enforcing)', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const cspHeader = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    expect(cspHeader).toBeDefined();
    // Must NOT be enforcing mode — report-only only
    const enforcing = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy'
    );
    expect(enforcing).toBeUndefined();
  });

  it('CSP script-src includes googletagmanager.com', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const csp = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    expect(csp.value).toContain('https://www.googletagmanager.com');
  });

  it('CSP script-src includes connect.facebook.net', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const csp = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    expect(csp.value).toContain('https://connect.facebook.net');
  });

  it('CSP font-src includes fonts.gstatic.com', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const csp = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    expect(csp.value).toContain('https://fonts.gstatic.com');
  });

  it('CSP connect-src includes app.loops.so', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const csp = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    expect(csp.value).toContain('https://app.loops.so');
  });

  it('CSP includes object-src none', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const csp = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    expect(csp.value).toContain("object-src 'none'");
  });
});

// ---------------------------------------------------------------------------
// Source inventory: Layout.astro external origins match CSP allowlist
// ---------------------------------------------------------------------------
describe('Layout.astro external sources are all in CSP', () => {
  const layoutPath = resolve(process.cwd(), 'src/layouts/Layout.astro');
  const vercelJsonPath = resolve(process.cwd(), 'vercel.json');

  function getCspValue(): string {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const csp = allHeaders.find(
      (h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only'
    );
    return csp?.value ?? '';
  }

  it('Layout.astro googletagmanager.com script is in CSP script-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('googletagmanager.com');
    expect(getCspValue()).toContain('https://www.googletagmanager.com');
  });

  it('Layout.astro fonts.googleapis.com is in CSP style-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('fonts.googleapis.com');
    expect(getCspValue()).toContain('https://fonts.googleapis.com');
  });

  it('Layout.astro fonts.gstatic.com preconnect is in CSP font-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('fonts.gstatic.com');
    expect(getCspValue()).toContain('https://fonts.gstatic.com');
  });

  it('Layout.astro connect.facebook.net script is in CSP script-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('connect.facebook.net');
    expect(getCspValue()).toContain('https://connect.facebook.net');
  });

  it('Layout.astro facebook.com noscript img is in CSP img-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('www.facebook.com');
    expect(getCspValue()).toContain('https://www.facebook.com');
  });

  it('Layout.astro GTM noscript iframe is in CSP frame-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('googletagmanager.com/ns.html');
    expect(getCspValue()).toContain('frame-src');
    expect(getCspValue()).toContain('https://www.googletagmanager.com');
  });
});

// ---------------------------------------------------------------------------
// Manual verification note (not automated — requires live Vercel deployment)
// ---------------------------------------------------------------------------
// To verify the CSP header is served on Vercel:
//   curl -sI https://www.thehermeticflight.com/ | grep -i content-security
// Expected: Content-Security-Policy-Report-Only: default-src 'self'; ...
//
// To verify no violations, open browser DevTools → Console on the deployed site.
// CSP violations appear as "Refused to load..." messages in the console.
// Monitor for 2 weeks before switching to enforcing mode.
```

2. Verify fail (before Task 4 creates vercel.json):
```bash
npx vitest run tests/csp-headers.test.ts --reporter=verbose
```
Expected: tests that check `existsSync(vercelJsonPath)` fail; all others fail or error.

3. Record frozen baseline — run `record-baseline.sh` if the frozen-test-file skill is configured. Otherwise, manually note the failing test count as the pre-implementation baseline.

4. Task 4 implements `vercel.json` — then run:
```bash
npx vitest run tests/csp-headers.test.ts --reporter=verbose
```
Expected: all structural and inventory tests pass.

5. Verify frozen — run `verify-frozen.sh` if configured. Otherwise, confirm test file content hash has not changed since authorship.

6. Commit:
```bash
git add tests/csp-headers.test.ts
git commit -m "test: add CSP header structural and inventory tests"
```

---

## Task 7: Quality Gates

### Aggregate test suite check

After all tasks are complete, run the full test suite:

```bash
npx vitest run --reporter=verbose
```
Expected: all existing 341 tests pass plus the new tests from Tasks 1, 2, 5, 6 (env-declarations, playwright-config, ci-workflow, csp-headers). Zero failures.

```bash
npm run build && npx playwright test --reporter=list
```
Expected: 11 E2E tests pass (1 homepage + 1 result page OG/share + 6 result pages load + 1 quiz intro/start + 1 canonical URL). Zero failures.

### Migration integrity check (ARCH-03 closure)

Confirm the migrated test file preserves all original assertions:

```bash
grep -c "expect(" tests/quiz-flow.spec.ts
```
Expected: at minimum 15 `expect()` calls covering the full assertion inventory from the original `testHomepageOGTags` (3), `testResultPageOGAndShareButtons` (5), `testAll6ResultPagesLoad` (2×6=12, or expressed as per-slug), `testQuizIntroAndStart` (3), `testResultPageCanonicalURL` (1).

Confirm raw playwright is fully removed:
```bash
grep "from 'playwright'" tests/quiz-flow.spec.ts
```
Expected: zero matches.

Confirm no custom pass/fail helpers remain:
```bash
grep "function pass\|function fail\|process.exit" tests/quiz-flow.spec.ts
```
Expected: zero matches.

### CSP report-only confirmation

Confirm vercel.json uses report-only, not enforcing:
```bash
grep "Content-Security-Policy" vercel.json
```
Expected: only `Content-Security-Policy-Report-Only` present. `Content-Security-Policy` (enforcing) must not appear.

### Evaluation Protocol

After all tasks complete and the branch is ready for review, deploy a preview and run 3 independent evaluators with orthogonal lenses:

**Evaluator 1 — Security lens:**
- Verify CSP directive completeness: every external origin in Layout.astro appears in the CSP allowlist
- Verify report-only mode: `Content-Security-Policy-Report-Only` not `Content-Security-Policy`
- Verify no unnecessary `'unsafe-eval'` was added
- Verify `object-src 'none'` and `base-uri 'self'` are present
- Check for any sources in Layout.astro that may have been missed in the inventory

**Evaluator 2 — CI reliability lens:**
- Verify workflow triggers correctly on non-main branch pushes
- Verify `TEST_URL` is passed from the deploy step output to the test step env
- Verify `sleep 5` is sufficient for Vercel cold start (if flaky, recommend `sleep 15`)
- Verify playwright report is uploaded even on failure (`if: always()`)
- Verify `CI: true` env var is set in the test step (enables retries and single worker)

**Evaluator 3 — Migration integrity lens:**
- Verify all 5 original test suites are represented in the migrated file
- Verify no assertion was weakened (e.g., `toBeTruthy()` standing in for a more specific check that was originally there)
- Verify `waitForTimeout(400)` was replaced with a condition wait, not just removed
- Verify the 6-slug loop produces 6 discrete test entries in the runner output
- Verify `@playwright/test` `expect()` matchers are used consistently (no raw `if (!x) throw` patterns remaining)

Synthesize evaluator findings. Remediate any issues via new commits. If remediations require code changes, use the frozen-test-file cycle: fix → test → harden → record.

---

## After Sprint 1 Integration

After Sprint 1 tracks 1A (archetype, quiz, infrastructure) are merged via PR into `main`, run `harden` across the integrated result to catch any regressions introduced by combining changes from multiple branches. Follow the evaluation-protocol skill for the post-merge hardening pass.

---

## Operator Tasks Checklist

- [ ] Run `vercel link` from project root to generate `.vercel/project.json`
- [ ] Add `VERCEL_TOKEN` to GitHub repo secrets (Vercel dashboard → Account Settings → Tokens)
- [ ] Add `VERCEL_ORG_ID` to GitHub repo secrets (value from `.vercel/project.json`)
- [ ] Add `VERCEL_PROJECT_ID` to GitHub repo secrets (value from `.vercel/project.json`)
- [ ] Commit `.vercel/project.json` to source control
- [ ] (Optional) Disable Vercel native auto-deploys for non-main branches to avoid double deploys
- [ ] After first preview deploy with vercel.json: open browser DevTools → Console, check for CSP violations
- [ ] Monitor CSP violations for 2 weeks before switching to enforcing mode
- [ ] Set `LOOPS_API_KEY` in Vercel preview environment variables (for quiz submission E2E path)
