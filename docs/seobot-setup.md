# SEOBot Integration Setup

This project is configured to receive blog posts from SEOBotAI via a webhook and automatically commit them to the GitHub repository.

## 1. Environment Variables

You must set the following environment variables in your Vercel project settings:

- `SEOBOT_API_SECRET`: A secure random string (e.g., generated via `openssl rand -hex 32`). You will assume this value when configuring SEOBot.
- `GITHUB_TOKEN`: A GitHub Personal Access Token (Classic) with `repo` scope (full control of private repositories).
- `GITHUB_OWNER`: `TayQuig`
- `GITHUB_REPO`: `thehermeticflight`

## 2. SEOBot Configuration

1.  Log in to SEOBotAI.
2.  Navigate to **Integrations** > **Webhook**.
3.  Set the **Webhook URL** to: `https://www.thehermeticflight.com/api/webhooks/seobot`
4.  Set the **Authorization Header** or **Secret** to match your `SEOBOT_API_SECRET`. (Format: `Bearer YOUR_SECRET`).

## 3. Testing Locally

You can test the webhook locally using curl.

1.  Start the dev server:
    ```bash
    npm run dev
    ```

2.  Run this curl command (replace `YOUR_SECRET` with the value in your `.env`):

    ```bash
    curl -X POST http://localhost:4321/api/webhooks/seobot \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_SECRET" \
    -d '{
      "title": "Test Post from API",
      "slug": "test-post-api",
      "description": "This is a test description",
      "content": "## Hello World\n\nThis is a test post created via the SEOBot webhook.",
      "tags": ["test", "api"],
      "image": "https://example.com/image.jpg"
    }'
    ```

3.  If successful, you should see a new file created in `src/content/blog/test-post-api.mdx`.

## 4. Troubleshooting

- **401 Unauthorized**: Check that `SEOBOT_API_SECRET` matches the header.
- **500 Internal Error**: Check Vercel logs. Usually indicates `GITHUB_TOKEN` is invalid or missing permissions.

