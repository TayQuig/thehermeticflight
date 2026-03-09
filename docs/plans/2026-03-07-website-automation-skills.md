# Website Automation Skills — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 5 Claude Code skills that automate managing The Hermetic Flight website — covering SEO auditing, content publishing, social media amplification, analytics reporting, and Kickstarter launch orchestration.

**Architecture:** Each skill is a self-contained directory in `~/.claude/skills/<name>/` with a `SKILL.md` file (YAML frontmatter + markdown body) and optional supporting scripts. Skills are invoked via the Skill tool and reference existing MCP integrations (Slack, Zapier) and project APIs (Loops.so, GitHub, GA4). All skills follow a semi-autonomous model with approval gates that can be bypassed as trust is built.

**Tech Stack:** Claude Code skills (Markdown), Bash scripts, WebFetch/WebSearch tools, Slack MCP connector, GitHub API (Octokit), Loops.so REST API, Google Analytics Data API v1

**Build Order:** Auditor → Content Pipeline → Social Amplifier → Analytics Reporter → Launch Orchestrator

**Dependencies:** Skills 1-3 can be built now. Skills 4-5 depend on the marketing pipeline (active task) being complete for full functionality but can be scaffolded independently.

---

## Task 1: Create skill directory structure

**Files:**
- Create: `~/.claude/skills/audit-site/SKILL.md`
- Create: `~/.claude/skills/publish-post/SKILL.md`
- Create: `~/.claude/skills/social-blast/SKILL.md`
- Create: `~/.claude/skills/weekly-report/SKILL.md`
- Create: `~/.claude/skills/launch-sequence/SKILL.md`

**Step 1: Create all five skill directories**

```bash
mkdir -p ~/.claude/skills/audit-site
mkdir -p ~/.claude/skills/publish-post
mkdir -p ~/.claude/skills/social-blast
mkdir -p ~/.claude/skills/weekly-report
mkdir -p ~/.claude/skills/launch-sequence
```

**Step 2: Verify directories exist**

Run: `ls -la ~/.claude/skills/ | grep -E "audit-site|publish-post|social-blast|weekly-report|launch-sequence"`
Expected: 5 directories listed

**Step 3: Commit**

No commit — these are outside the repo. Continue to next task.

**Known Risks:**
- None — `mkdir -p` is idempotent. Directories may already exist from a prior partial run.

**If This Fails:**
- If mkdir fails, check permissions: `ls -la ~/.claude/`. Verify the parent directory exists.

---

## Task 2: Build the SEO & Site Health Auditor skill

**Files:**
- Create: `~/.claude/skills/audit-site/SKILL.md`

**Step 1: Write SKILL.md**

Create `~/.claude/skills/audit-site/SKILL.md` with this exact content:

```markdown
---
name: audit-site
description: >
  SEO and site health auditor for Astro static sites. Crawls the live site,
  checks meta tags, structured data, broken links, image alt text, heading
  hierarchy, and canonical URLs. Produces a scored report with prioritized
  fixes. Can auto-fix simple issues directly in the codebase. Use when the
  operator says "audit the site", "check SEO", "run a health check", or
  similar.
---

# SEO & Site Health Auditor

## Purpose

Crawl the live Hermetic Flight site and produce an actionable SEO health
report. Score each page, identify issues, and optionally auto-fix low-risk
problems directly in the source files.

## Required Tools

| Tool | Purpose |
|------|---------|
| `WebFetch` | Fetch live page HTML for analysis |
| `Read` | Read source .astro and .mdx files |
| `Edit` | Auto-fix simple issues (missing alt text, meta descriptions) |
| `Bash` | Run supporting check scripts |
| `Slack (MCP)` | Post summary to #the-hermetic-flight (C0AFSPKQLDU) |

## Site Map

These are the pages to audit (derived from `src/pages/`):

| Page | URL | Source |
|------|-----|--------|
| Homepage | https://www.thehermeticflight.com/ | `src/pages/index.astro` |
| Quiz | https://www.thehermeticflight.com/quiz | `src/pages/quiz.astro` |
| FAQ | https://www.thehermeticflight.com/faq | `src/pages/faq.astro` |
| Blog Index | https://www.thehermeticflight.com/blog | `src/pages/blog.astro` |
| Thank You | https://www.thehermeticflight.com/thank-you | `src/pages/thank-you.astro` |
| Blog Posts | https://www.thehermeticflight.com/blog/[slug] | `src/pages/blog/[...slug].astro` |

## Audit Checklist (Per Page)

For each page, check these items and score pass/warn/fail:

### Meta & SEO
- [ ] `<title>` present, 50-60 chars, includes primary keyword
- [ ] `<meta name="description">` present, 150-160 chars, compelling
- [ ] Canonical URL present and correct (`<link rel="canonical">`)
- [ ] Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`
- [ ] Twitter Card tags: `twitter:card`, `twitter:title`, `twitter:description`
- [ ] No duplicate meta tags

### Structured Data
- [ ] Schema.org JSON-LD present (homepage: Product, blog: Article)
- [ ] JSON-LD validates (no missing required fields)
- [ ] Blog posts have `datePublished`, `author`, `headline`

### Content Quality
- [ ] H1 exists and is unique per page
- [ ] Heading hierarchy is logical (no skipping H2→H4)
- [ ] All images have `alt` attributes
- [ ] No empty links or buttons
- [ ] Word count adequate (blog posts > 300 words)

### Technical
- [ ] No broken internal links (check all `href` and `src` attributes)
- [ ] robots.txt exists and is valid
- [ ] sitemap.xml exists and lists all public pages
- [ ] All pages return 200 status
- [ ] No mixed content (HTTP resources on HTTPS page)
- [ ] Canonical URL matches actual URL (no trailing slash mismatch)

### Performance Signals
- [ ] Images are optimized (using Astro Image component, not raw `<img>`)
- [ ] No render-blocking scripts in `<head>` (GTM is expected, flag others)
- [ ] Fonts loaded with `display: swap`

## Scoring

| Rating | Criteria |
|--------|----------|
| A (90-100) | All checks pass, structured data complete |
| B (75-89) | Minor warnings (missing OG tags, short descriptions) |
| C (60-74) | Significant issues (broken links, missing structured data) |
| D (40-59) | Multiple critical issues |
| F (< 40) | Fundamental SEO problems |

## Output

### Report Format

Save report to: `operations/audit-YYYY-MM-DD-seo.md`

```
# SEO Audit Report — YYYY-MM-DD

**Overall Score:** [A-F] ([numeric]/100)
**Pages Audited:** [N]
**Issues Found:** [critical] critical, [warn] warnings, [info] info

## Summary
[2-3 sentence overview of site health]

## Page Scores
| Page | Score | Critical | Warnings |
|------|-------|----------|----------|
| ... | ... | ... | ... |

## Critical Issues (Fix Now)
1. [Issue description + exact file:line + fix]

## Warnings (Fix Soon)
1. [Issue description + recommendation]

## Passed Checks
[List of things that look good — positive reinforcement]
```

### Auto-Fix Rules

The skill may auto-fix these LOW-RISK issues without approval:

1. **Missing image alt text** — Add descriptive alt based on filename/context
2. **Trailing slash mismatches** — Normalize canonical URLs

The skill MUST ask approval before fixing:

1. **Missing/rewriting meta descriptions** — Content judgment required
2. **Restructuring headings** — May affect visual layout
3. **Adding structured data** — Schema choices need review

### Slack Notification

After report is saved, post summary to #the-hermetic-flight:

```
SEO Audit Complete — Score: [A-F] ([N]/100)
[critical] critical issues, [warn] warnings
Report: operations/audit-YYYY-MM-DD-seo.md
[Top 3 action items as bullet points]
```

## Procedure

1. Read the site map table above. For each page URL, use `WebFetch` to fetch
   the live HTML. Extract: title, meta description, canonical, OG/Twitter
   tags, JSON-LD, heading structure, image alt attributes, internal links.

2. For each source file (`src/pages/*.astro`, `src/content/blog/*.mdx`), use
   `Read` to check: heading hierarchy, image alt text, content length.

3. Use `WebFetch` on `/sitemap.xml` and `/robots.txt` to verify existence
   and completeness.

4. Score each page against the checklist. Tally overall score.

5. Generate the report markdown. Save to `operations/`.

6. If auto-fixable issues found, apply low-risk fixes via `Edit`. Show
   diff summary to operator for higher-risk fixes.

7. Post Slack notification via `slack_send_message` to C0AFSPKQLDU.

8. If overall score < B, recommend running audit again after fixes are deployed.
```

**Step 2: Verify the skill file is well-formed**

Run: `head -5 ~/.claude/skills/audit-site/SKILL.md`
Expected: YAML frontmatter with `name: audit-site`

**Step 3: Test the skill by invoking it**

In a Claude Code session in the thehermeticflight project directory, invoke:
```
Skill tool: skill: "audit-site"
```

Verify:
- Skill loads without errors
- Claude follows the procedure (fetches pages, runs checks)
- Report is saved to `operations/audit-YYYY-MM-DD-seo.md`
- Slack notification posts to #the-hermetic-flight

**Step 4: Commit the report (not the skill — it's outside the repo)**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add operations/audit-*.md
git commit -m "docs: add first SEO audit report from audit-site skill"
```

**Known Risks:**
- WebFetch on the live site requires the site to be deployed and accessible. Slack MCP must be running and authenticated.

**If This Fails:**
- If skill doesn't load, verify `~/.claude/settings.json` includes the skills directory path. If WebFetch returns errors, verify the site is live at thehermeticflight.com. If Slack post fails, check MCP server status.

---

## Task 3: Build the Content Pipeline skill

**Files:**
- Create: `~/.claude/skills/publish-post/SKILL.md`

**Step 1: Write SKILL.md**

Create `~/.claude/skills/publish-post/SKILL.md` with this exact content:

```markdown
---
name: publish-post
description: >
  End-to-end blog content pipeline for The Hermetic Flight. Takes a topic,
  outline, or draft and produces a publish-ready MDX blog post: SEO-optimized
  content, complete frontmatter, committed to git, and optionally triggers
  email broadcast and social post drafts. Use when the operator says "write
  a blog post", "publish a post about X", "draft a post", or similar.
---

# Content Pipeline — Blog Post Publisher

## Purpose

Automate the full blog post lifecycle: ideation → writing → SEO optimization →
MDX formatting → git commit → optional email broadcast → social media drafts.

## Required Tools

| Tool | Purpose |
|------|---------|
| `WebSearch` | Research topic for accuracy and SEO keywords |
| `Read` | Read existing blog posts for voice/style matching |
| `Write` | Create new MDX file in `src/content/blog/` |
| `Bash` | Run astro build to verify, git commit |
| `Slack (MCP)` | Post completion notification to #the-hermetic-flight |

## Content Schema

Blog posts live in `src/content/blog/` as MDX files with this frontmatter
(defined in `src/content/config.ts`):

```yaml
---
title: "string"           # Required. 50-70 chars for SEO
description: "string"     # Required. 150-160 chars, compelling meta description
pubDate: "YYYY-MM-DD"     # Required. Publication date
tags: ["tag1", "tag2"]    # Optional. 3-5 relevant tags
heroImage: "../../assets/images/blog/[name].png"  # Optional
heroImageAlt: "string"    # Optional. Descriptive alt text
author: "string"          # Default: "The Hermetic Flight Team"
draft: false              # Set true for unpublished drafts
pinned: false             # Set true to pin to top of blog
hideDate: false           # Set true to hide publication date
---
```

## Voice & Style Guide

The Hermetic Flight writes in a distinctive voice. Before writing, read at
least 2 existing posts to internalize the style:

- `src/content/blog/welcome-to-the-flight.mdx` — flagship voice reference
- `src/content/blog/scary-cards.mdx` — approachable tone reference

Key traits:
- **Warm but authoritative** — not preachy, not overly casual
- **Embodiment-focused** — connects tarot concepts to physical/somatic experience
- **Inclusive** — "we" language, no gatekeeping, welcomes beginners
- **Poetic but grounded** — metaphors drawn from aerial arts, gravity, flight
- **Anti-memorization** — always favors intuition over rote learning
- No emojis in blog content. Em dashes over parentheticals. Short paragraphs.

## Procedure

### Phase 1: Research & Outline (requires approval)

1. **Receive topic** from operator. Can be:
   - A topic keyword ("court cards", "shadow work")
   - A rough outline or bullet points
   - A full draft to polish
   - "Write something about X"

2. **Research** the topic using `WebSearch`. Gather:
   - Top 5 ranking articles for the target keyword
   - Related long-tail keywords (3-5)
   - Questions people ask about this topic
   - Any factual claims that need verification

3. **Read existing posts** to check for overlap. Do not duplicate topics
   already covered in `src/content/blog/`.

4. **Present outline** to operator:
   ```
   Proposed: "[Title]"
   Target keyword: [primary]
   Related keywords: [list]
   Structure:
   - Intro hook (The Hermetic Flight angle)
   - Section 1: [topic]
   - Section 2: [topic]
   - Section 3: [topic]
   - CTA (quiz, newsletter, or Kickstarter)
   Word count target: [800-1500]
   ```
   WAIT for operator approval before writing.

### Phase 2: Write & Optimize

5. **Write the post** in MDX format. Include:
   - H2 headings for each section (SEO: include keywords naturally)
   - Internal links to other blog posts where relevant
   - CTA section at the end (link to /quiz for archetype discovery)
   - No filler, no fluff. Every paragraph earns its place.

6. **Generate frontmatter** with:
   - SEO-optimized title (50-70 chars, keyword near front)
   - Compelling meta description (150-160 chars, includes CTA verb)
   - 3-5 tags matching existing tag taxonomy
   - Today's date as pubDate
   - `draft: true` initially

7. **Write the file** to `src/content/blog/[slug].mdx` using `Write` tool.
   Slug format: lowercase, hyphens, no special chars.

### Phase 3: Verify & Publish (requires approval)

8. **Run build** to verify the post compiles:
   ```bash
   cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
   npm run build 2>&1 | tail -20
   ```
   Expected: Build succeeds with no errors.

9. **Show preview** to operator: display the frontmatter and first 200 words.
   Ask: "Ready to publish? (This will set draft: false and commit.)"

10. **On approval**, flip `draft: false` and commit:
    ```bash
    git add src/content/blog/[slug].mdx
    git commit -m "content: add blog post — [title]"
    ```

### Phase 4: Amplify (optional, semi-autonomous)

11. **Trigger social drafts**: If the `social-blast` skill is available,
    invoke it with the new post path to generate platform-specific drafts.

12. **Trigger email broadcast**: If Loops.so is configured and the operator
    approves, draft a broadcast email with the post summary + link.
    (Requires: marketing pipeline Phase 4 complete, LOOPS_API_KEY in .env)

13. **Post Slack notification** to #the-hermetic-flight (C0AFSPKQLDU):
    ```
    Blog Post Published: "[title]"
    URL: https://www.thehermeticflight.com/blog/[slug]
    Tags: [tags]
    [Next steps: social drafts ready / email broadcast queued / etc.]
    ```

## Approval Gates

| Action | Requires Approval |
|--------|-------------------|
| Outline / topic selection | Yes |
| Writing the draft | No (auto) |
| Publishing (draft → live) | Yes |
| Social media drafts | No (drafts only) |
| Email broadcast | Yes |
| Git commit | Yes (standard) |
| Git push | Yes (standard) |
```

**Step 2: Verify**

Run: `head -5 ~/.claude/skills/publish-post/SKILL.md`
Expected: YAML frontmatter with `name: publish-post`

**Step 3: Test the skill**

Invoke in a Claude Code session:
```
Skill tool: skill: "publish-post"
```
Test with prompt: "Draft a blog post about the meaning of reversed tarot cards"

Verify:
- Skill researches the topic
- Presents outline for approval
- Writes MDX with correct frontmatter schema
- Build succeeds
- Asks before publishing

**Step 4: Commit any test artifacts**

```bash
git add src/content/blog/*.mdx
git commit -m "content: add blog post from publish-post skill test"
```

**Known Risks:**
- WebSearch for keyword research requires internet access. Blog build may fail if frontmatter doesn't match `src/content/config.ts` schema.

**If This Fails:**
- If build fails after writing MDX, check frontmatter against config.ts schema. Common issues: missing required fields (title, description, pubDate), invalid date format. If Slack fails, check MCP server.

---

## Task 4: Build the Social Media Amplifier skill

**Files:**
- Create: `~/.claude/skills/social-blast/SKILL.md`

**Step 1: Write SKILL.md**

Create `~/.claude/skills/social-blast/SKILL.md` with this exact content:

```markdown
---
name: social-blast
description: >
  Social media content amplifier for The Hermetic Flight. Takes a blog post,
  archetype description, quiz CTA, or free-form topic and generates
  platform-specific posts for X/Twitter, Instagram, Facebook, and Pinterest.
  Outputs drafts in a structured format for copy-paste or future API posting.
  Use when the operator says "create social posts", "social blast", "promote
  this post", "generate social content", or similar.
---

# Social Media Amplifier

## Purpose

Transform Hermetic Flight content into platform-optimized social media posts.
Generate drafts for X/Twitter, Instagram, Facebook, and Pinterest from a
single content source.

## Required Tools

| Tool | Purpose |
|------|---------|
| `Read` | Read source content (blog posts, archetype data) |
| `Write` | Save drafts to `operations/social/` |
| `Slack (MCP)` | Post drafts to #the-hermetic-flight for review |

## Brand Voice (Social)

Social media voice differs slightly from blog voice:

- **X/Twitter**: Mystical + punchy. Short sentences. Strategic line breaks.
  Questions that provoke reflection. No hashtag spam (2-3 max).
- **Instagram**: Warmer, more personal. Longer captions OK (up to 2200 chars).
  Emoji sparingly (1-2 per post, ✨ 🌙 🃏 only). Hashtag block at end (15-20).
- **Facebook**: Conversational, community-building. Ask questions. Encourage
  sharing. Link in post body (not "link in bio").
- **Pinterest**: Keyword-rich description. Actionable ("Discover your aerial
  tarot archetype"). 2-3 sentences max.

## Content Sources

The skill accepts any of these inputs:

1. **Blog post path**: `src/content/blog/[slug].mdx` — read and extract key
   points, quotes, and CTA
2. **Archetype name**: One of the 6 archetypes (Air Weaver, Embodied
   Intuitive, Ascending Seeker, Shadow Dancer, Liminal Voyager, Grounded
   Mystic) — generate archetype-specific content
3. **Quiz CTA**: Generate posts that drive traffic to the archetype quiz
4. **Free text**: Operator provides topic or angle directly
5. **Launch milestone**: Kickstarter countdown, behind-the-scenes, etc.

## Platform Templates

### X/Twitter (280 chars per tweet, thread for longer)

**Single tweet format:**
```
[Hook — question or provocative statement]

[1-2 sentences of value]

[CTA with link]

#AerialTarot #TheHermeticFlight
```

**Thread format (for blog amplification):**
```
Tweet 1: [Hook + "A thread 🧵"]
Tweet 2-4: [Key insights from the post, one per tweet]
Tweet 5: [CTA — link to full post or quiz]
```

### Instagram Caption

```
[Opening hook — first line must grab attention before "...more"]

[2-3 paragraphs of value, each 2-3 sentences]

[CTA — "Take the quiz", "Read the full post", "Save this for later"]

.
.
.
#AerialTarot #TheHermeticFlight #TarotCommunity #TarotDeck
#AerialArts #TarotReading #DivinelyGuided #SpiritualPractice
#TarotOfInstagram #MysticArts #EmbodiedSpirituality
#KickstarterComingSoon #TarotDivination #IntuitiveTarot
#ModernTarot #HolisticLiving
```

### Facebook Post

```
[Conversational opening — address the community]

[2-3 paragraphs of value]

[Question to encourage comments]

[Link to blog/quiz]
```

### Pinterest Pin Description

```
[Keyword-rich title phrase] | [Secondary keyword phrase]. [1-2 sentences
describing what the reader will discover]. Learn more at
thehermeticflight.com.
```

## Procedure

1. **Receive content source** from operator (blog path, archetype, topic,
   or free text).

2. **Read source material**. If blog post, extract: title, key quotes,
   main argument, CTA. If archetype, load archetype description and traits.

3. **Generate 4 platform drafts** following the templates above. Each draft
   should be unique — not just reformatted versions of the same text.
   Adapt the angle to each platform's audience expectations.

4. **Save drafts** to `operations/social/YYYY-MM-DD-[topic-slug].md`:
   ```markdown
   # Social Drafts — [Topic]
   Generated: YYYY-MM-DD
   Source: [blog post / archetype / topic]

   ## X/Twitter
   [draft]

   ## Instagram
   [draft]

   ## Facebook
   [draft]

   ## Pinterest
   [draft]
   ```

5. **Post drafts to Slack** (#the-hermetic-flight, C0AFSPKQLDU):
   ```
   Social Drafts Ready: [topic]
   Platforms: X, Instagram, Facebook, Pinterest
   File: operations/social/YYYY-MM-DD-[slug].md
   [Show X/Twitter draft inline as preview]
   ```

6. **Operator reviews** and copies to scheduling tool (Later, Buffer, or
   native platform). Future enhancement: direct API posting to X.

## Approval Gates

| Action | Requires Approval |
|--------|-------------------|
| Generating drafts | No |
| Saving to operations/ | No |
| Posting to Slack | No |
| Direct API posting (future) | Yes |
```

**Step 2: Create the operations/social directory**

```bash
mkdir -p /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/operations/social
```

**Step 3: Verify**

Run: `head -5 ~/.claude/skills/social-blast/SKILL.md`
Expected: YAML frontmatter with `name: social-blast`

**Step 4: Test the skill**

Invoke in a Claude Code session:
```
Skill tool: skill: "social-blast"
```
Test with: "Create social posts promoting the archetype quiz"

Verify:
- Reads relevant content (quiz page, archetype descriptions)
- Generates 4 platform-specific drafts
- Saves to `operations/social/`
- Posts preview to Slack

**Step 5: Commit test artifacts**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add operations/social/
git commit -m "docs: add social media drafts from social-blast skill test"
```

**Known Risks:**
- Slack MCP dependency for posting drafts. The skill reads archetype data from `src/lib/archetype-content.ts` — if this file's exports change, the skill may not find archetype descriptions.

**If This Fails:**
- If skill can't find archetype data, verify `src/lib/archetype-content.ts` exports `archetypes` object. If Slack post fails, the drafts are still saved to `operations/social/` — post manually.

---

## Task 5: Build the Analytics Reporter skill

**Files:**
- Create: `~/.claude/skills/weekly-report/SKILL.md`

**Step 1: Write SKILL.md**

Create `~/.claude/skills/weekly-report/SKILL.md` with this exact content:

```markdown
---
name: weekly-report
description: >
  Analytics reporter for The Hermetic Flight. Fetches traffic data, quiz
  conversion metrics, and email subscriber stats. Produces a KPI dashboard
  report and posts summary to Slack. Use when the operator says "weekly
  report", "how's the site doing", "show me analytics", "run the numbers",
  or similar.
---

# Analytics Reporter — Weekly KPI Dashboard

## Purpose

Produce a data-driven performance report for The Hermetic Flight: traffic
trends, content performance, quiz conversion funnel, and email subscriber
growth. Delivered as a markdown report + Slack summary.

## Required Tools

| Tool | Purpose |
|------|---------|
| `Bash` | Fetch GA4 Data API via `curl` with OAuth2 bearer token |
| `WebSearch` | Look up current site indexing status |
| `WebFetch` | Fetch non-authenticated web resources (Search Console embeds, etc.) |
| `Read` | Read previous reports for trend comparison |
| `Write` | Save report to `operations/reports/` |
| `Slack (MCP)` | Post dashboard to #the-hermetic-flight |

## Data Sources

### 1. Google Analytics (GA4 Measurement ID: G-R24GW4SCEY (for gtag). Data API requires numeric Property ID — see Setup Requirements.)

Collect via GA4 Data API (requires service account — see Setup below):

| Metric | GA4 Dimension/Metric |
|--------|---------------------|
| Total sessions | `sessions` |
| Unique users | `totalUsers` |
| Page views | `screenPageViews` |
| Top pages by views | `pagePath` × `screenPageViews` |
| Traffic sources | `sessionSource` / `sessionMedium` |
| Bounce rate | `bounceRate` |
| Avg session duration | `averageSessionDuration` |

Key pages to track individually:
- `/` — Homepage (awareness)
- `/quiz` — Quiz page (interest)
- `/thank-you` — Thank you (conversion)
- `/blog` — Blog index (engagement)
- `/blog/*` — Individual posts (content performance)

### 2. Loops.so Subscriber Data

**Dependency:** Requires marketing pipeline Phase 4 complete + LOOPS_API_KEY.

Fetch via Loops REST API (`https://app.loops.so/api/v1/contacts`):
- Total subscriber count
- New subscribers this period
- Subscribers by archetype (custom property: `archetype`)
- Unsubscribes this period

### 3. Quiz Completion (derived metrics)

Calculate from GA4 page view data:
- **Quiz start rate** = `/quiz` page views ÷ total sessions
- **Quiz completion rate** = `/thank-you` views ÷ `/quiz` views
- **Email capture rate** = new Loops subscribers ÷ `/thank-you` views

### 4. Search Console (optional, manual)

If Google Search Console API access is configured:
- Total impressions
- Total clicks
- Average position
- Top queries driving traffic

## Report Format

Save to: `operations/reports/weekly-YYYY-MM-DD.md`

```markdown
# Weekly Performance Report — [date range]

## KPI Summary

| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Sessions | N | N | +/-% |
| Unique Users | N | N | +/-% |
| Quiz Starts | N | N | +/-% |
| Quiz Completions | N | N | +/-% |
| New Subscribers | N | N | +/-% |
| Total Subscribers | N | — | — |

## Conversion Funnel

```
Homepage visits: [N]
    └→ Quiz page: [N] ([%] of homepage)
        └→ Quiz complete: [N] ([%] of quiz starts)
            └→ Email signup: [N] ([%] of completions)
```

## Top Content

| Page | Views | Avg Time |
|------|-------|----------|
| [page] | N | Ns |

## Traffic Sources

| Source | Sessions | % of Total |
|--------|----------|-----------|
| [source] | N | N% |

## Trends & Insights
[2-3 observations about what's working, what's not, and recommended actions]

## Recommendations
1. [Specific action item based on data]
2. [Specific action item]
3. [Specific action item]
```

## Slack Dashboard

Post to #the-hermetic-flight (C0AFSPKQLDU):

```
📊 Weekly Report — [date range]
Sessions: [N] ([+/-]% vs last week)
Quiz completions: [N] ([+/-]%)
New subscribers: [N] (total: [N])
Funnel: [homepage]→[quiz]→[complete]→[signup]
Top post: "[title]" ([N] views)
Full report: operations/reports/weekly-YYYY-MM-DD.md
```

## Setup Requirements

### GA4 Data API Access

The GA4 Data API requires authenticated requests. Use `Bash` with `curl` and a service account bearer token — `WebFetch` cannot make authenticated API calls.

Note: G-R24GW4SCEY is the Measurement ID (for the gtag snippet). The GA4 Data API requires a numeric Property ID (e.g., `123456789`). Store the numeric Property ID in `.env` as `GA4_PROPERTY_ID`.

Before first run, the operator must:

1. Enable the Google Analytics Data API in Google Cloud Console
2. Create a service account with Viewer role on the GA4 property
3. Download the service account key JSON
4. Save to `.env` as `GA4_SERVICE_ACCOUNT_KEY` (base64-encoded JSON)
5. Add GA4 numeric property ID to `.env` as `GA4_PROPERTY_ID`

If GA4 API is not configured, the skill falls back to manual data entry:
prompt the operator to paste key metrics from the GA4 dashboard.

### Loops.so API

Requires `LOOPS_API_KEY` in `.env`. If not present, skip subscriber
metrics and note "Email data unavailable — configure LOOPS_API_KEY".

## Procedure

1. **Check data source availability**: Read `.env` for GA4 and Loops
   credentials. Note which sources are available.

2. **Fetch GA4 data** for the past 7 days (and previous 7 for comparison).
   If API unavailable, ask operator to paste screenshot or key numbers.

3. **Fetch Loops subscriber data** if API key available. Calculate archetype
   distribution.

4. **Read previous report** from `operations/reports/` for trend comparison.
   If no previous report exists, skip week-over-week comparisons.

5. **Calculate derived metrics**: conversion rates, funnel percentages,
   week-over-week changes.

6. **Generate report markdown**. Save to `operations/reports/`.

7. **Post Slack summary** to #the-hermetic-flight.

8. **Deliver PDF** via pdf-deliver skill if operator requests it.

## Approval Gates

| Action | Requires Approval |
|--------|-------------------|
| Fetching analytics data | No |
| Generating report | No |
| Posting to Slack | No |
| Recommendations / action items | No (advisory only) |
| Acting on recommendations | Yes |
```

**Step 2: Create the reports directory**

```bash
mkdir -p /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/operations/reports
```

**Step 3: Verify**

Run: `head -5 ~/.claude/skills/weekly-report/SKILL.md`
Expected: YAML frontmatter with `name: weekly-report`

**Step 4: Test the skill (manual fallback mode)**

Invoke in a Claude Code session:
```
Skill tool: skill: "weekly-report"
```

Since GA4 API won't be configured yet, verify:
- Skill detects missing credentials gracefully
- Prompts for manual data entry
- Generates report structure correctly
- Posts to Slack

**Step 5: Commit report artifacts**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add operations/reports/
git commit -m "docs: add first weekly report from weekly-report skill"
```

**Known Risks:**
- GA4 Data API requires OAuth2 service account credentials (not yet configured). Loops.so API requires LOOPS_API_KEY. Both have graceful fallbacks documented in the SKILL.md.

**If This Fails:**
- If skill fails to detect credentials, verify `.env` exists and contains placeholder keys. If Slack fails, check MCP server. If the skill loads but produces empty metrics, verify the fallback 'manual data entry' prompt appears.

---

## Task 6: Build the Kickstarter Launch Orchestrator skill

**Files:**
- Create: `~/.claude/skills/launch-sequence/SKILL.md`

**Step 1: Write SKILL.md**

Create `~/.claude/skills/launch-sequence/SKILL.md` with this exact content:

```markdown
---
name: launch-sequence
description: >
  Kickstarter pre-launch campaign orchestrator for The Hermetic Flight. Manages
  the countdown sequence: broadcast email scheduling, campaign page updates,
  social media cadence, and pre-launch checklist tracking. Use when the
  operator says "launch sequence", "Kickstarter prep", "countdown status",
  "schedule launch emails", or similar.
---

# Kickstarter Launch Sequence Orchestrator

## Purpose

Manage the 4-week pre-launch countdown for The Hermetic Flight Kickstarter
campaign. Orchestrates broadcast emails, campaign page content, social media
cadence, and a pre-launch checklist — all synchronized to a target launch date.

## Required Tools

| Tool | Purpose |
|------|---------|
| `Read` | Read launch config, email templates, page content |
| `Write` | Write/update email drafts, campaign page, checklist |
| `Edit` | Update countdown components, schedule adjustments |
| `WebFetch` | Check Kickstarter pre-launch page status |
| `Bash` | Build verification, git operations |
| `Slack (MCP)` | Status updates to #the-hermetic-flight |

## Dependencies

This skill requires the marketing pipeline to be complete (TASKBOARD active
task Phases 1-5) for email broadcast capability. Without it, the skill can
still manage the checklist, page content, and social cadence — but email
scheduling requires Loops.so integration.

## Launch Configuration

The operator must set these values before first run. Store in
`operations/launch-config.json`:

```json
{
  "launchDate": "YYYY-MM-DD",
  "kickstarterUrl": "https://www.kickstarter.com/projects/...",
  "prelaunchUrl": "https://www.kickstarter.com/projects/.../preview",
  "fundingGoal": 15000,
  "earlyBirdPrice": 55,
  "retailPrice": 65,
  "emailListSize": null,
  "broadcastSchedule": [
    { "week": -4, "subject": "The countdown begins", "status": "draft" },
    { "week": -3, "subject": "Behind the scenes", "status": "draft" },
    { "week": -2, "subject": "Early bird preview", "status": "draft" },
    { "week": -1, "subject": "Tomorrow we fly", "status": "draft" }
  ]
}
```

## 4-Week Email Broadcast Schedule

These are BROADCAST emails sent to ALL subscribers regardless of their
archetype drip sequence position (per TASKBOARD backlog item).

### Week -4: "The Countdown Begins"
- **Angle**: Announcement + origin story
- **Content**: Why this deck exists, the aerial arts connection, what to expect
- **CTA**: Follow on Kickstarter pre-launch page
- **Subject line A/B**: "The Hermetic Flight launches in 4 weeks" vs
  "Your aerial tarot journey begins [date]"

### Week -3: "Behind the Scenes"
- **Angle**: Process + authenticity
- **Content**: Behind-the-scenes of the shoot, meet the aerialists, card
  previews (3-4 cards)
- **CTA**: Share with a friend who'd love this
- **Subject line A/B**: "21 aerialists. 78 cards. One flight." vs
  "Meet the artists behind your cards"

### Week -2: "Early Bird Preview"
- **Angle**: Exclusivity + value
- **Content**: Reward tiers revealed, early bird pricing ($55 vs $65),
  exclusive add-ons for email subscribers
- **CTA**: Mark your calendar for [launch date]
- **Subject line A/B**: "Your exclusive early bird preview" vs
  "Save $10 — subscriber-only pricing"

### Week -1: "Tomorrow We Fly"
- **Angle**: Urgency + gratitude
- **Content**: Final countdown, thank the community, launch day details,
  what to expect in the first 48 hours
- **CTA**: Set a reminder — link to Kickstarter notify button
- **Subject line A/B**: "Tomorrow we take flight" vs
  "In 24 hours, everything changes"

## Pre-Launch Checklist

Track completion status of all launch prerequisites:

```markdown
## Pre-Launch Checklist

### Legal & Compliance
- [ ] PO Box acquired (CAN-SPAM requirement)
- [ ] Kickstarter project page approved
- [ ] Trademark/copyright review complete
- [ ] Terms of service / refund policy drafted

### Product
- [ ] Final card designs approved (all 78)
- [ ] Printing quotes finalized
- [ ] Shipping cost calculator ready
- [ ] Reward tiers defined and priced

### Marketing
- [ ] Email list size: [N] subscribers
- [ ] All 4 broadcast emails drafted and approved
- [ ] Social media content calendar (4 weeks) created
- [ ] Press kit / media assets prepared
- [ ] Influencer outreach list compiled
- [ ] Kickstarter video produced

### Technical
- [ ] Kickstarter page content finalized
- [ ] Website updated with launch banner/countdown
- [ ] Quiz → email pipeline tested end-to-end
- [ ] Analytics tracking verified (GA4 + Meta Pixel)
- [ ] Loops.so broadcast capability tested

### Community
- [ ] Kickstarter pre-launch followers: [N]
- [ ] Social media followers: [N across platforms]
- [ ] Beta readers / ambassadors identified
```

## Procedure

### Status Check Mode (default invocation)

1. **Read launch config** from `operations/launch-config.json`.
   If file doesn't exist, prompt operator to set launch date and create it.

2. **Calculate timeline**: days until launch, current week number (T-N).

3. **Read checklist** and count completed vs total items.

4. **Check broadcast status**: which emails are drafted, approved, scheduled.

5. **Post status to Slack** (#the-hermetic-flight, C0AFSPKQLDU):
   ```
   🚀 Launch Sequence — T-[N] days ([date])
   Checklist: [completed]/[total] items complete
   Emails: [N]/4 drafted, [N]/4 scheduled
   Next action: [most urgent incomplete item]
   Blockers: [any blocked items]
   ```

### Email Draft Mode (invoked with "draft email [week]")

1. **Read launch config** for the target week's email spec.

2. **Read subscriber archetype distribution** (from Loops.so if available)
   to personalize broadcast content.

3. **Draft email** following the week's template above. Output as markdown
   with subject line, preview text, body, and CTA button text.

4. **Save draft** to `operations/launch-emails/week-N-[slug].md`.

5. **Present to operator** for approval. On approval, update launch config
   status to "approved".

### Schedule Mode (invoked with "schedule emails")

**SAFETY: Never call the Loops.so broadcast API in test mode against the production list.** When testing Schedule Mode, use a test audience segment or dry-run flag. The approval gate on 'Scheduling email sends' is the last safety check before real emails are sent.

1. **Verify** all 4 emails are in "approved" status.

2. **Calculate send dates** from launch date (each Monday at 10am ET,
   or operator-specified times).

3. **Schedule via Loops.so** broadcast API (requires LOOPS_API_KEY):
   - Create campaign for each email
   - Set scheduled send time
   - Tag as "kickstarter-broadcast"

4. **Update launch config** with scheduled timestamps.

5. **Confirm** to operator with exact send schedule.

### Page Update Mode (invoked with "update campaign page")

1. **Read current homepage** (`src/pages/index.astro`).

2. **Add/update launch banner** with countdown and CTA.

3. **Run build** to verify.

4. **Present diff** to operator for approval before committing.

## Approval Gates

| Action | Requires Approval |
|--------|-------------------|
| Status check | No |
| Drafting emails | No |
| Approving email content | Yes |
| Scheduling email sends | Yes |
| Updating website pages | Yes |
| Git commit/push | Yes |

## Timeline Alerts

The skill should proactively alert (via Slack) when:
- T-30 days: "Launch in 30 days — checklist review recommended"
- T-14 days: "2 weeks out — all emails should be drafted"
- T-7 days: "1 week out — all emails should be scheduled"
- T-3 days: "3 days — final checklist review"
- T-1 day: "Tomorrow — verify all systems go"
- T-0: "LAUNCH DAY 🚀"
```

**Step 2: Create supporting directories**

```bash
mkdir -p /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/operations/launch-emails
```

**Step 3: Verify**

Run: `head -5 ~/.claude/skills/launch-sequence/SKILL.md`
Expected: YAML frontmatter with `name: launch-sequence`

**Step 4: Test the skill (setup mode)**

Invoke in a Claude Code session:
```
Skill tool: skill: "launch-sequence"
```

Since no launch-config.json exists, verify:
- Skill detects missing config
- Prompts operator to set a launch date
- Creates `operations/launch-config.json` with defaults
- Posts initial status to Slack

**Step 5: Commit supporting files**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add operations/launch-config.json operations/launch-emails/
git commit -m "docs: add launch sequence config from launch-sequence skill setup"
```

**Known Risks:**
- Schedule Mode calls Loops.so broadcast API which sends real emails — never test against production list without approval. Page Update Mode modifies index.astro which could break the build.

**If This Fails:**
- If launch-config.json fails to create, check write permissions on `operations/`. If the skill tries to schedule emails during testing, cancel immediately — only test in Status Check Mode (the default). To rollback skill: `rm -rf ~/.claude/skills/launch-sequence/`.

---

## Task 7: Integration test — invoke all 5 skills

**Step 1: Invoke audit-site and verify end-to-end**

```
Skill tool: skill: "audit-site"
```
Expected: Report in `operations/audit-*.md`, Slack notification

**Step 2: Invoke publish-post with a test topic**

```
Skill tool: skill: "publish-post"
```
Provide: "Write a draft about the symbolism of The Tower card in aerial arts"
Expected: Outline presented, MDX draft created (as draft: true)

**Step 3: Invoke social-blast with the draft post**

```
Skill tool: skill: "social-blast"
```
Provide: path to the blog post from step 2
Expected: 4 platform drafts in `operations/social/`

**Step 4: Invoke weekly-report**

```
Skill tool: skill: "weekly-report"
```
Expected: Report in `operations/reports/`, Slack summary (manual data mode)

**Step 5: Invoke launch-sequence**

```
Skill tool: skill: "launch-sequence"
```
Expected: Status check, launch config created, Slack status

**Step 6: Commit all integration test artifacts**

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add operations/
git commit -m "docs: add artifacts from 5-skill integration test"
```

**Known Risks:**
- Running all 5 skills in sequence means a failure in one can block the rest. Step 3 (social-blast) depends on Step 2 (publish-post) output. Multiple Slack posts will fire during testing.

**If This Fails:**
- Skills are independent except Step 3 depends on Step 2 output. If a skill fails, debug that skill individually (see its task), then retry. If Slack is rate-limited, space invocations 30+ seconds apart.

---

## Task 8: Update TASKBOARD.md backlog

**Files:**
- Modify: `operations/TASKBOARD.md`

**Step 1: Add website automation skills to backlog**

Add these items to the Backlog section of `operations/TASKBOARD.md`:

```markdown
- **Website automation skills (5)** — audit-site, publish-post, social-blast, weekly-report, launch-sequence. Skills built and tested. Ongoing: refine based on usage, add GA4 API integration for weekly-report, add direct X API posting for social-blast.
```

**Step 2: Move related Ideas items**

If any Ideas items are now covered by the skills (e.g., "Shareable archetype
OG images" → covered by social-blast archetype content mode), note the
coverage in the Ideas section.

Note: Ideas section was triaged on 2026-03-07 and is currently empty. This step is a no-op unless new Ideas have been added since.

**Step 3: Commit**

```bash
git add operations/TASKBOARD.md
git commit -m "docs: update taskboard with website automation skills status"
```

**Verification:** Run `grep 'Website automation skills' operations/TASKBOARD.md` — expected: returns the new backlog item text.

**Known Risks:**
- None — purely local TASKBOARD edit.

**If This Fails:**
- If the backlog item doesn't appear, verify TASKBOARD.md wasn't overwritten. Check `git diff operations/TASKBOARD.md`.

---
## Rollback

Skill files live outside the git repo at `~/.claude/skills/`. To remove a skill:
```bash
rm -rf ~/.claude/skills/<skill-name>/
```
In-repo artifacts (reports, social drafts, blog posts) can be reverted with `git checkout`.
