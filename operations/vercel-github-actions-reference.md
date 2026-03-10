# Vercel + GitHub Actions Reference Guide

> Compiled from https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel — 2026-03-09

## Overview

GitHub Actions can replace Vercel's built-in Git integration as a CI/CD
provider. This is most useful when you need to run tests, lint, or other
checks against a Vercel preview deploy before merging — something Vercel's
native integration does not support without external tooling.

**Key constraints:**
- Vercel's native Git integration must be disabled (or its auto-deploy
  ignored) when using this pattern, or you will get double deploys.
- The `vercel deploy --prebuilt` approach builds locally in the GitHub
  Actions runner, then uploads artifacts to Vercel — the build does NOT
  happen on Vercel's servers.
- All three secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
  are required. The deploy will fail silently without them.

---

## Required Secrets

Add all three to your GitHub repository under **Settings → Secrets and
variables → Actions**.

| Secret | Where to get it |
|--------|----------------|
| `VERCEL_TOKEN` | Vercel dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after running `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after running `vercel link` |

### How to get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`

```bash
# Install Vercel CLI
npm install --global vercel@latest

# Log in
vercel login

# Link the project (run from the repo root)
vercel link

# Read the generated file
cat .vercel/project.json
```

The output looks like:

```json
{
  "orgId": "team_abc123...",
  "projectId": "prj_xyz789..."
}
```

`orgId` → `VERCEL_ORG_ID`, `projectId` → `VERCEL_PROJECT_ID`.

> **Note:** `.vercel/project.json` should be committed to source control
> (it contains no secrets), but the token must stay in GitHub Secrets.

---

## Vercel CLI Commands

| Command | What it does |
|---------|-------------|
| `vercel pull --yes --environment=preview --token=TOKEN` | Downloads Vercel environment config (`.vercel/output` metadata, env vars) for the preview environment |
| `vercel pull --yes --environment=production --token=TOKEN` | Same, for the production environment |
| `vercel build --token=TOKEN` | Builds the project locally using the Vercel Build Output API; produces `.vercel/output/` |
| `vercel build --prod --token=TOKEN` | Builds with production environment variables |
| `vercel deploy --prebuilt --token=TOKEN` | Uploads the pre-built `.vercel/output/` to Vercel; returns the deployment URL |
| `vercel deploy --prebuilt --prod --token=TOKEN` | Same, targeting the production alias |

The `--prebuilt` flag tells Vercel to skip its own build step and use the
artifacts produced by `vercel build` in the runner. This is what makes
the two-step pattern (build locally → deploy artifacts) work.

---

## Workflow: Preview Deployments

Triggers on every push to any branch except `main`. Each push receives
a unique preview URL.

**File: `.github/workflows/preview.yaml`**

```yaml
name: Vercel Preview Deployment
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
on:
  push:
    branches-ignore:
      - main
jobs:
  Deploy-Preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
      - name: Build Project Artifacts
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
```

---

## Workflow: Production Deployments

Triggers when code merges to `main`. Deploys to the production alias.

**File: `.github/workflows/production.yaml`**

```yaml
name: Vercel Production Deployment
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
on:
  push:
    branches:
      - main
jobs:
  Deploy-Production:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - name: Build Project Artifacts
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## Capturing the Preview URL

`vercel deploy --prebuilt` prints the deployment URL to stdout. Capture it
with `id: deploy` and `$()` command substitution, then expose it as a step
output for downstream steps.

```yaml
- name: Deploy Project Artifacts to Vercel
  id: deploy
  run: |
    PREVIEW_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
    echo "url=$PREVIEW_URL" >> $GITHUB_OUTPUT
```

Reference the URL in a later step:

```yaml
- name: Use Preview URL
  run: echo "Deployed to ${{ steps.deploy.outputs.url }}"
```

The URL format is: `https://<project>-<hash>-<team>.vercel.app`

---

## Deployment Trigger Summary

| Event | Workflow | Vercel environment |
|-------|----------|--------------------|
| Push to any non-`main` branch | `preview.yaml` | Preview |
| Push / merge to `main` | `production.yaml` | Production |
| Pull request (source branch push) | `preview.yaml` (indirectly) | Preview |

Pull requests do not get their own trigger — the preview workflow fires on
the source branch push that backs the PR.

---

## Multi-Project Deployments

To deploy the same commit to multiple Vercel projects, create per-project
secrets with distinct names and reference them in separate workflow steps:

```yaml
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID_1 }}
```

Repeat the pull/build/deploy steps with `VERCEL_PROJECT_ID_2`, etc.

---

## Hermetic Flight Integration Notes

### Context

The Hermetic Flight project currently has **no CI/CD pipeline**. The
codebase is deployed via Vercel's native Git integration (push to `main`
→ auto-deploy). There are zero GitHub Actions workflows in the repository.

### Use Case

Run the existing Playwright E2E suite (`tests/quiz-flow.spec.ts`) against
a Vercel preview deploy before any branch is merged to `main`. This catches
regressions in the quiz flow, result pages, share CTAs, and API route
behavior against the real Vercel runtime — not just a local dev server.

### Existing Test Hook

The E2E test suite already supports remote URLs via environment variable:

```typescript
// tests/quiz-flow.spec.ts, line 14
const BASE_URL = process.env.TEST_URL || 'http://localhost:4321';
```

No test changes are required. Pass `TEST_URL` as an environment variable
to the test runner step and it will hit the preview deploy automatically.

### Suggested Workflow

**File: `.github/workflows/preview-e2e.yaml`**

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
      - uses: actions/checkout@v2

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel (Preview)
        id: deploy
        run: |
          PREVIEW_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
          echo "url=$PREVIEW_URL" >> $GITHUB_OUTPUT

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests against preview URL
        env:
          TEST_URL: ${{ steps.deploy.outputs.url }}
        run: npx tsx tests/quiz-flow.spec.ts
```

### Workflow Step Breakdown

| Step | Purpose |
|------|---------|
| `actions/checkout@v2` | Check out branch source |
| `actions/setup-node@v4` | Pin Node 20 (matches Vercel runtime) |
| `npm ci` | Install project deps (needed for `vercel build`) |
| `vercel pull` | Download Vercel env config for the preview environment |
| `vercel build` | Build Astro SSG output locally in the runner |
| `vercel deploy --prebuilt` | Upload artifacts; capture URL as step output |
| `playwright install chromium` | Install browser binary for the test runner |
| `npx tsx tests/quiz-flow.spec.ts` | Run E2E suite with `TEST_URL` set to the preview URL |

### Important Caveats

- **`LOOPS_API_KEY`**: The quiz submit API route (`src/pages/api/quiz-submit.ts`)
  reads `LOOPS_API_KEY` from Vercel environment variables. For E2E tests against
  preview deploys to exercise the full submission path, the preview environment
  must have `LOOPS_API_KEY` configured in the Vercel dashboard. If it is absent,
  the API route will return an error and submission tests will fail. Consider
  using a test-mode API key for preview environments.

- **Wait for deploy readiness**: `vercel deploy --prebuilt` returns the URL
  as soon as the upload completes, but the deployment may need a few seconds
  before it responds to HTTP requests. The `quiz-flow.spec.ts` runner has
  built-in navigation waits via Playwright, which should absorb this, but
  if tests fail with connection errors, add a short `sleep 5` between the
  deploy step and the test step.

- **No `@playwright/test` config**: The E2E suite uses raw `playwright`
  (not `@playwright/test`) with a custom pass/fail reporter. There is no
  `playwright.config.ts`. The test exits with a non-zero code on failure,
  which GitHub Actions will correctly interpret as a workflow failure.

- **Disabling native Vercel deploys**: If Vercel's native Git integration
  is still active, every push will trigger both a Vercel-native deploy and
  the GitHub Actions deploy. This is wasteful but not harmful. To avoid it,
  disable auto-deploys for the branch in the Vercel project settings, or
  ignore deployments not created by the Actions workflow.
