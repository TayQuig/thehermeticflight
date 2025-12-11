export const prerender = false; // Enable server-side rendering for this endpoint

import type { APIRoute } from 'astro';
import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  const secret = import.meta.env.SEOBOT_API_SECRET;

  // 1. Security Check
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, content, tags, image, slug: providedSlug } = body;

    // 2. Validation
    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Missing title or content' }), { status: 400 });
    }

    // 3. Format Content
    const slug = providedSlug || slugify(title, { lower: true, strict: true });
    const date = new Date().toISOString().split('T')[0];
    const safeTags = Array.isArray(tags) ? tags : [];
    
    // Construct MDX Frontmatter
    const mdxContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${(description || '').replace(/"/g, '\\"')}"
pubDate: "${date}"
tags: ${JSON.stringify(safeTags)}
heroImage: "${image || ''}"
draft: false
---

${content}
`;

    // 4. Commit to GitHub
    const octokit = new Octokit({ auth: import.meta.env.GITHUB_TOKEN });
    const owner = import.meta.env.GITHUB_OWNER || 'TayQuig'; // Fallback or env
    const repo = import.meta.env.GITHUB_REPO || 'thehermeticflight'; // Fallback or env
    const path = `src/content/blog/${slug}.mdx`;
    const message = `SEOBot: Add post "${title}"`;

    // Check if file exists to get sha (for update) or null (for create)
    let sha;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path });
      if (!Array.isArray(data)) {
        sha = data.sha;
      }
    } catch (e) {
      // File doesn't exist, which is fine for creation
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(mdxContent).toString('base64'),
      sha, // Include sha if updating
      branch: 'main' // Always commit to main to trigger deploy
    });

    return new Response(JSON.stringify({ success: true, slug }), { status: 200 });

  } catch (error) {
    console.error('SEOBot Webhook Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
};
