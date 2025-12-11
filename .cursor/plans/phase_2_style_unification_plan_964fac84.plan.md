---
name: "Phase 2: Style Unification Plan"
overview: Integrate SEOBotAI by setting up a Vercel-hosted webhook that automatically commits new blog posts to the repository.
todos:
  - id: create-branch
    content: Create feature branch feature/seobot-integration
    status: completed
  - id: install-deps
    content: Install @astrojs/vercel, octokit, and slugify
    status: completed
    dependencies:
      - create-branch
  - id: config-astro
    content: Configure Astro for Vercel hybrid output
    status: completed
    dependencies:
      - install-deps
  - id: implement-webhook
    content: Implement webhook endpoint at src/pages/api/webhooks/seobot.ts
    status: completed
    dependencies:
      - config-astro
  - id: test-webhook
    content: Create a test script/instruction for the user to verify
    status: completed
    dependencies:
      - implement-webhook
---

# Phase 4: SEOBot Integration

## Objective

Enable automatic publishing from SEOBotAI to the Astro blog by creating a secure webhook that commits received content directly to the GitHub repository as `.mdx` files.

## 1. Environment Setup

- **Branch**: Create `feature/seobot-integration` from `main`.
- **Dependencies**: Install:
- `@astrojs/vercel`: For server-side hosting on Vercel.
- `@octokit/rest` (or `octokit`): To interact with the GitHub API for file creation.
- `slugify`: To generate clean filenames from titles.

## 2. Configuration Updates

- **Astro Config**: Update `astro.config.mjs`:
- Set `output: 'hybrid'` (allows static pages + dynamic API routes).
- Add `vercel()` adapter.
- **Environment Variables** (User Action Required later):
- `GITHUB_TOKEN`: PAT with repo write access.
- `SEOBOT_API_SECRET`: Secret token for webhook verification.
- `GITHUB_OWNER`: `TayQuig`
- `GITHUB_REPO`: `thehermeticflight`

## 3. Webhook Implementation

- **File**: Create `src/pages/api/webhooks/seobot.ts`
- **Logic**:

1.  **Validate**: Check `Authorization` header against `SEOBOT_API_SECRET`.
2.  **Parse**: valid JSON payload from SEOBot (title, body, description, image, tags).
3.  **Transform**: Convert HTML content to Markdown/MDX (if needed) or wrap plain markdown.
4.  **Commit**: Use Octokit to `createOrUpdateFileContents` at `src/content/blog/[slug].mdx`.
5.  **Respond**: Return 200 OK to SEOBot.

## 4. Testing

- **Local Test**: Use a mock script to POST to the local endpoint.
- **Deployment**: User merges to main and deploys to Vercel.

## 5. Documentation

- Provide instructions on where to paste the webhook URL in SEOBotAI dashboard.