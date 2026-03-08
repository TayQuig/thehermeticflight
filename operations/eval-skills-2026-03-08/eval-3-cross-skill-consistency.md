# Evaluator 3: Cross-Skill Consistency

## Summary

The five skills demonstrate strong foundational consistency in frontmatter format, terminology ("operator" throughout, matching Slack channel ID), and Required Tools table structure. However, there are several structural divergences that will cause friction as the suite matures: the audit-site skill lacks a formal Approval Gates table, procedure section formats vary significantly across skills (flat lists vs. phases vs. named modes), Slack notification templates inconsistently include operator mentions and emojis, and git operation handling is addressed by only two of the five skills despite all five producing persistent file artifacts.

## Findings

### [CS-01]: audit-site lacks a formal Approval Gates table
**Severity:** High
**Skills affected:** audit-site (diverges from publish-post, social-blast, weekly-report, launch-sequence)
**Description:** Four of five skills include an Approval Gates section formatted as a standardized markdown table with `| Action | Requires Approval |` columns. The audit-site skill instead distributes its approval logic across a prose-based "Auto-Fix Rules" section, splitting behavior into two lists ("may auto-fix without approval" and "MUST ask approval before fixing"). While the information is present, the format divergence means an LLM following the suite cannot rely on a predictable location or structure for approval information.
**Evidence:**
- publish-post: `## Approval Gates` followed by `| Action | Requires Approval |` table (7 rows)
- social-blast: `## Approval Gates` followed by `| Action | Requires Approval |` table (4 rows)
- weekly-report: `## Approval Gates` followed by `| Action | Requires Approval |` table (5 rows)
- launch-sequence: `## Approval Gates` followed by `| Action | Requires Approval |` table (6 rows)
- audit-site: `### Auto-Fix Rules` with two prose lists under "Output" section — no `## Approval Gates` heading exists
**Recommendation:** Standardize audit-site to include a `## Approval Gates` section with the same table format. The auto-fix distinction (low-risk auto-fix vs. approval-required fix) can be expressed within the table using a third column or notes, but the section heading and table structure should match the other four skills.

---

### [CS-02]: Procedure section structure varies across all five skills
**Severity:** Medium
**Skills affected:** All five
**Description:** The Procedure section uses three different organizational patterns across the suite. This inconsistency makes it harder for the executing LLM to predict where to find step-specific details, and makes cross-skill maintenance more difficult.
**Evidence:**
- audit-site: Flat numbered list (steps 1-8), section heading `## Procedure`
- publish-post: Four named phases (`### Phase 1: Research & Outline`, etc.) with numbered sub-steps (1-13), section heading `## Procedure`
- social-blast: Flat numbered list (steps 1-6), section heading `## Procedure`
- weekly-report: Flat numbered list (steps 1-8), section heading `## Procedure`
- launch-sequence: Four named modes (`### Status Check Mode`, `### Email Draft Mode`, `### Schedule Mode`, `### Page Update Mode`), each with their own numbered sub-steps, section heading `## Procedure`
**Recommendation:** Decide on a convention: either all skills use flat numbered lists (suitable for single-mode skills), or all skills that have distinct operational modes use named subsections. A reasonable rule: skills with a single invocation path use flat numbered lists; skills with multiple invocation modes (launch-sequence) use named mode subsections. publish-post's "Phase" structure should be reconciled with this convention — its phases represent a single sequential workflow, not separate modes, so a flat numbered list with bold phase headers would align with audit-site, social-blast, and weekly-report.

---

### [CS-03]: Git operations inconsistently addressed in Approval Gates
**Severity:** High
**Skills affected:** social-blast, weekly-report (missing); publish-post, launch-sequence (present)
**Description:** All five skills produce persistent file artifacts (reports, drafts, config files) in the `operations/` directory or `src/content/`. However, only publish-post and launch-sequence include git commit/push in their Approval Gates tables. social-blast and weekly-report save files to `operations/` without any mention of committing those files. audit-site mentions committing reports in the implementation plan's test steps but not in the skill itself. This creates ambiguity: should generated reports and social drafts be committed? If yes, the approval gate is missing. If no, this should be explicitly stated.
**Evidence:**
- publish-post Approval Gates: `| Git commit | Yes (standard) |` and `| Git push | Yes (standard) |`
- launch-sequence Approval Gates: `| Git commit/push | Yes |`
- social-blast Approval Gates: No git-related rows. Procedure ends at step 6 (operator reviews).
- weekly-report Approval Gates: No git-related rows. Procedure ends at step 8 (PDF delivery).
- audit-site: No approval table at all; no git mention in procedure.
**Recommendation:** Every skill that writes files to the project directory should include git commit/push rows in its Approval Gates table. If the intent is that operations/ artifacts are transient and not committed, state this explicitly (e.g., "Saving to operations/ | No (not committed to git)"). The current silence is ambiguous.

---

### [CS-04]: Slack notification templates lack operator mention tag
**Severity:** High
**Skills affected:** All five
**Description:** The existing slack-notify skill (reference pattern) requires every Slack notification to begin with `<@U0AEKD062V6>` so the operator receives a notification sound. None of the five new skills include this mention tag in their Slack notification templates. This means notifications from these skills will post silently to the channel without pinging the operator, defeating the purpose of the notification.
**Evidence:**
- slack-notify SKILL.md: "Every message MUST begin with a mention of `<@U0AEKD062V6>` so Taylor & Deirdre receive a notification sound."
- audit-site Slack template begins: `SEO Audit Complete — Score: [A-F]...`
- publish-post Slack template begins: `Blog Post Published: "[title]"...`
- social-blast Slack template begins: `Social Drafts Ready: [topic]...`
- weekly-report Slack template begins: `[chart emoji] Weekly Report — [date range]...`
- launch-sequence Slack template begins: `[rocket emoji] Launch Sequence — T-[N] days...`
- None include `<@U0AEKD062V6>` prefix.
**Recommendation:** All five skills should either (a) include the `<@U0AEKD062V6>` mention in their Slack templates, or (b) explicitly state they delegate notification to the slack-notify skill and their Slack posts are informational-only (no ping). Option (a) is more robust since these skills are invoked independently and cannot assume slack-notify is co-loaded.

---

### [CS-05]: Emoji usage inconsistency across Slack templates
**Severity:** Medium
**Skills affected:** weekly-report, launch-sequence (use emojis); audit-site, publish-post, social-blast (do not)
**Description:** Two of five skills embed emoji characters in their Slack notification templates, while three do not. Global CLAUDE.md states "Only use emojis if the user explicitly requests it." The emojis improve scannability in Slack and were likely intentional, but the inconsistency means some notifications will have visual markers and others will not. This also creates a low-level tension with the global directive.
**Evidence:**
- weekly-report Slack template: Begins with a chart emoji
- launch-sequence Slack template: Begins with a rocket emoji; Timeline Alerts T-0: "LAUNCH DAY" with rocket emoji
- audit-site Slack template: No emoji (begins with "SEO Audit Complete")
- publish-post Slack template: No emoji (begins with "Blog Post Published")
- social-blast Slack template: No emoji (begins with "Social Drafts Ready")
**Recommendation:** Standardize: either all skill Slack notifications use a leading emoji as a visual category marker (recommended for scannability), or none do. If using emojis, assign a consistent icon to each skill (e.g., magnifying glass for audit, pencil for publish, megaphone for social, chart for weekly, rocket for launch). Document this as a suite-wide convention.

---

### [CS-06]: Output file path conventions lack a common pattern within operations/
**Severity:** Medium
**Skills affected:** audit-site (flat), social-blast, weekly-report, launch-sequence (subdirectories)
**Description:** Skills write output to different organizational patterns within `operations/`. audit-site writes flat to `operations/audit-YYYY-MM-DD-seo.md`, while others use subdirectories (`operations/social/`, `operations/reports/`, `operations/launch-emails/`). This isn't necessarily wrong (subdirectories prevent clutter), but audit-site is the outlier.
**Evidence:**
- audit-site: `operations/audit-YYYY-MM-DD-seo.md` (flat)
- social-blast: `operations/social/YYYY-MM-DD-[topic-slug].md` (subdirectory)
- weekly-report: `operations/reports/weekly-YYYY-MM-DD.md` (subdirectory)
- launch-sequence: `operations/launch-emails/week-N-[slug].md` and `operations/launch-config.json` (subdirectory + flat config)
- publish-post: `src/content/blog/[slug].mdx` (content directory, appropriately different)
**Recommendation:** Standardize audit-site to use `operations/audits/audit-YYYY-MM-DD-seo.md` (subdirectory) for consistency with the other skills' subdirectory pattern. Alternatively, document the convention: skills that produce recurring reports use subdirectories; one-off artifacts go flat. Either way, make the pattern explicit as a suite-wide rule.

---

### [CS-07]: Graceful degradation for missing dependencies is ad-hoc
**Severity:** Medium
**Skills affected:** weekly-report, launch-sequence, publish-post (handle dependencies); audit-site, social-blast (no external dependencies)
**Description:** Three skills depend on external APIs (Loops.so, GA4) and each handles unavailability differently. weekly-report specifies two distinct fallback patterns (skip with message for Loops, manual data entry for GA4). launch-sequence describes reduced capability. publish-post uses an implicit conditional ("If Loops.so is configured"). There is no standardized pattern for how a skill should declare its dependencies, check for them, or degrade when they are missing.
**Evidence:**
- weekly-report (Loops): "If not present, skip subscriber metrics and note 'Email data unavailable -- configure LOOPS_API_KEY'."
- weekly-report (GA4): "If GA4 API is not configured, the skill falls back to manual data entry: prompt the operator to paste key metrics."
- launch-sequence: "Without it, the skill can still manage the checklist, page content, and social cadence -- but email scheduling requires Loops.so integration."
- publish-post: "If Loops.so is configured and the operator approves..." (no explicit fallback behavior described)
**Recommendation:** Define a standard dependency declaration pattern for all skills. Suggested format: a `## Dependencies` section (launch-sequence already has this) listing each external dependency with three fields: name, env variable, and fallback behavior. This would make dependency handling predictable and auditable across the suite.

---

### [CS-08]: Brand voice guidance is split without cross-reference
**Severity:** Medium
**Skills affected:** publish-post, social-blast
**Description:** Brand voice is defined in two places: publish-post's "Voice & Style Guide" covers blog content voice, and social-blast's "Brand Voice (Social)" covers platform-specific social media voice. Neither skill cross-references the other. social-blast doesn't acknowledge that its social voice is a derivative of the blog voice. publish-post doesn't mention that social media has a different register. If voice guidelines evolve in one skill, the other won't reflect the change.
**Evidence:**
- publish-post: "No emojis in blog content. Em dashes over parentheticals. Short paragraphs."
- social-blast: "Instagram: Emoji sparingly (1-2 per post, sparkle/moon/cards only)"
- social-blast X/Twitter thread template: Includes thread emoji in "A thread [thread emoji]"
- Neither skill references the other's voice guidance section.
**Recommendation:** social-blast should include a cross-reference: "Base brand voice is defined in the publish-post skill's Voice & Style Guide. Social media voice adapts these principles for each platform as follows..." This creates a single source of truth (publish-post) with documented deviations (social-blast), rather than two independent voice definitions that could drift.

---

### [CS-09]: Approval gate for "Posting to Slack" is inconsistent
**Severity:** Medium
**Skills affected:** social-blast, weekly-report (Slack = No approval); publish-post (Slack notification listed but no explicit gate row); audit-site (no table); launch-sequence (no explicit Slack row)
**Description:** social-blast and weekly-report explicitly list "Posting to Slack | No" in their Approval Gates. publish-post and launch-sequence send Slack notifications in their procedures but don't include a corresponding Approval Gates row for it. audit-site has no approval table. Since all five skills post to Slack, this action should be consistently represented.
**Evidence:**
- social-blast: `| Posting to Slack | No |`
- weekly-report: `| Posting to Slack | No |`
- publish-post: Step 13 posts to Slack, but Approval Gates table has no "Posting to Slack" row
- launch-sequence: Status Check step 5 posts to Slack, but Approval Gates table has no "Posting to Slack" row (closest: "Status check | No")
- audit-site: Procedure step 7 posts to Slack, but no Approval Gates table exists
**Recommendation:** All five skills should include a "Posting to Slack | No" row in their Approval Gates table for completeness and predictability. Even if the answer is always "No," explicitly stating it documents the decision.

---

### [CS-10]: publish-post references social-blast invocation but interface contract is informal
**Severity:** Medium
**Skills affected:** publish-post, social-blast
**Description:** publish-post Phase 4 step 11 says: "If the `social-blast` skill is available, invoke it with the new post path to generate platform-specific drafts." social-blast's Content Sources section lists "Blog post path: `src/content/blog/[slug].mdx`" as input type 1. While these are compatible in principle, the interface is informal. There is no specification for what arguments publish-post passes to social-blast (just the file path? the title? the tags?), and social-blast's procedure step 1 says "Receive content source from operator" — implying human input, not skill-to-skill invocation.
**Evidence:**
- publish-post step 11: "invoke it with the new post path to generate platform-specific drafts"
- social-blast procedure step 1: "Receive content source from operator (blog path, archetype, topic, or free text)"
- social-blast does not describe how it receives input from another skill vs. from the operator
**Recommendation:** social-blast should document how it accepts input when invoked programmatically by another skill (e.g., "When invoked by publish-post, the blog post path is passed as the content source argument"). Alternatively, define a standard inter-skill invocation contract that all skills follow when calling each other.

## Consistency Strengths

1. **Frontmatter format is identical across all five skills.** YAML delimiters, `name` field (lowercase hyphenated), `description` field (multiline via `>`), all consistent.

2. **Slack channel identity is consistent.** All five skills reference the same channel name (`#the-hermetic-flight`) and ID (`C0AFSPKQLDU`). No skill uses a different channel or misspells the name.

3. **Required Tools table format is uniform.** All five skills use `| Tool | Purpose |` with matching column separator formatting. Tool names use consistent backtick formatting.

4. **Terminology is standardized.** All skills use "operator" (never "user") to refer to the human. All skills that mention approval use consistent phrasing ("requires approval," "WAIT for operator approval").

5. **Purpose section is consistently placed and formatted.** Every skill has a `## Purpose` section immediately after the H1 title, containing a 1-2 sentence description of the skill's role.

6. **Loops.so dependency is consistently referenced.** All three skills that reference Loops.so (publish-post, weekly-report, launch-sequence) use the same env variable name (`LOOPS_API_KEY`) and acknowledge it as optional/conditional.

7. **The Approval Gates table format (where present) is uniform.** The four skills that have this table all use identical column headers (`| Action | Requires Approval |`) and Yes/No values with parenthetical notes.

8. **Content awareness is aligned.** publish-post defines the blog frontmatter schema, audit-site checks the rendered output for those same fields (structured data), and social-blast reads the MDX files. The content model is consistent across all three content-touching skills.
