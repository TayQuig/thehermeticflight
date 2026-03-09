# Evaluator 1: Structural Completeness

## Summary

The five skills form a coherent automation suite with well-defined approval gates, consistent Slack notification patterns, and appropriate output artifact conventions. However, two skills suffer from critical specification gaps around external API integrations (GA4 Data API authentication flow in weekly-report, Loops.so broadcast API in launch-sequence) that would prevent their primary functions from executing. Additionally, several skills contain ambiguous procedures that will produce inconsistent results across invocations, and there are systematic gaps in failure handling for external dependencies.

## Findings

### [SC-01]: GA4 Data API authentication procedure is unimplementable
**Severity:** Critical
**Skill:** weekly-report
**Description:** The skill's primary data source (GA4 Data API) requires OAuth2 service account authentication, but the procedure contains no specification of how to actually authenticate. Getting a bearer token from a service account JSON key requires: (1) base64-decoding the key, (2) constructing a JWT with specific claims, (3) signing it with the private key via openssl, (4) exchanging the JWT at Google's OAuth2 token endpoint, (5) extracting the access token from the response. The skill's procedure (Step 2) simply says "Fetch GA4 data for the past 7 days" without specifying curl commands, JWT construction, token exchange endpoint, or GA4 Data API request format.
**Evidence:** Procedure Step 2: "Fetch GA4 data for the past 7 days (and previous 7 for comparison). If API unavailable, ask operator to paste screenshot or key numbers." Setup Requirements section: "Use Bash with curl and a service account bearer token."
**Recommendation:** Either (a) provide a complete, step-by-step bash script that handles JWT creation, OAuth2 token exchange, and GA4 Data API calls, or (b) provide a helper script in the skill directory that abstracts this, or (c) specify a simpler authentication method (e.g., using the `gcloud` CLI if installed). The current specification is a procedure gap, not just missing credentials.

### [SC-02]: Loops.so broadcast API specification is absent
**Severity:** Critical
**Skill:** launch-sequence
**Description:** Schedule Mode Step 3 instructs Claude to "Schedule via Loops.so broadcast API" including creating campaigns, setting scheduled send times, and tagging — but provides zero API specification. No endpoint URL, no request body format, no authentication header name, no response handling. The Loops.so REST API for transactional emails (used in the quiz pipeline) is a different endpoint and flow than broadcast/campaign scheduling. Without specification, Claude cannot execute this step.
**Evidence:** Schedule Mode Step 3: "Schedule via Loops.so broadcast API (requires LOOPS_API_KEY): Create campaign for each email, Set scheduled send time, Tag as 'kickstarter-broadcast'." No API URL, request format, or endpoint documentation provided.
**Recommendation:** Research the Loops.so broadcast/campaign API (if it exists), document the endpoint URLs, request schemas, and authentication format. If Loops.so does not support broadcast scheduling via API, document this limitation and specify an alternative workflow (e.g., draft emails as markdown and instruct operator to schedule manually in the Loops.so dashboard).

### [SC-03]: Scoring formula in audit-site is ambiguous
**Severity:** High
**Skill:** audit-site
**Description:** The audit checklist contains approximately 20 individual checks across 5 categories. The scoring table maps letter grades to numeric ranges (A=90-100, B=75-89, etc.), but the procedure never specifies how to convert individual pass/warn/fail results into a numeric score. Questions left unanswered: How many points is each check worth? Are all checks weighted equally? Does a "warn" score differently than a "fail"? What is the denominator? This means two invocations of the same skill on the same site could produce different scores depending on how Claude interprets the mapping.
**Evidence:** Scoring table defines ranges (A 90-100, B 75-89, etc.) but procedure Step 4 says only: "Score each page against the checklist. Tally overall score."
**Recommendation:** Define an explicit scoring formula: specify point values per check (e.g., 5 points each for 20 checks = 100 total), deduction amounts for warn vs. fail, and whether the score is per-page average or site-wide aggregate. This ensures deterministic, reproducible scoring.

### [SC-04]: Launch-sequence checklist has no persistence specification
**Severity:** High
**Skill:** launch-sequence
**Description:** The pre-launch checklist (approximately 20 items across 5 categories) is embedded in the SKILL.md as a template, but the skill never specifies where the stateful checklist should be persisted between invocations. Status Check Mode Step 3 says "Read checklist and count completed vs total items" but does not specify the file path to read from. Is it stored in `operations/launch-config.json`? A separate markdown file? Updated in the SKILL.md itself? Without a defined persistence location, checklist state will be lost between sessions.
**Evidence:** Status Check Mode Step 3: "Read checklist and count completed vs total items." No file path or storage specification provided. The `launch-config.json` schema shown in the skill includes `broadcastSchedule` but not checklist items.
**Recommendation:** Specify a dedicated file path for the checklist (e.g., `operations/launch-checklist.md`) or extend the `launch-config.json` schema to include checklist state. Define the format and specify that the skill must read from and write updates to this file.

### [SC-05]: Timeline alerts describe impossible behavior
**Severity:** High
**Skill:** launch-sequence
**Description:** The Timeline Alerts section specifies that the skill "should proactively alert (via Slack) when: T-30 days, T-14 days, T-7 days, T-3 days, T-1 day, T-0." However, Claude Code skills are invoked on-demand by the operator — they cannot run on a schedule. There is no cron job, GitHub Action, scheduled task, or any other trigger mechanism documented that would cause these alerts to fire automatically. This section describes behavior that is structurally impossible with the current invocation model.
**Evidence:** "The skill should proactively alert (via Slack) when: T-30 days: 'Launch in 30 days — checklist review recommended' ... T-0: 'LAUNCH DAY'"
**Recommendation:** Either (a) remove proactive alerts and make them part of the Status Check Mode output (when invoked, check the date and include relevant alerts), (b) document a cron/scheduling mechanism that invokes the skill on a schedule, or (c) reframe these as "when invoked, if the current date matches a milestone, include the corresponding alert in the Slack message."

### [SC-06]: Archetype data source path missing from social-blast
**Severity:** High
**Skill:** social-blast
**Description:** Content Sources item 2 accepts an archetype name as input, and Procedure Step 2 says "If archetype, load archetype description and traits." However, the skill never specifies where archetype data lives. The project stores archetype content in `src/lib/archetype-content.ts` (per project memory), but this file path is not referenced anywhere in the skill. Claude would have to guess or search for the correct file, which may produce inconsistent results.
**Evidence:** Procedure Step 2: "If archetype, load archetype description and traits." No file path provided. Content Sources item 2 lists archetype names but no source reference.
**Recommendation:** Add an explicit reference: "Archetype data is defined in `src/lib/archetype-content.ts`. Read this file to obtain descriptions, traits, and display names for the specified archetype."

### [SC-07]: Publish-post heroImage format contradicts actual schema
**Severity:** High
**Skill:** publish-post
**Description:** The Content Schema section shows `heroImage: "../../assets/images/blog/[name].png"` as a string path. However, the actual content schema in `src/content/config.ts` defines heroImage using Astro's `image()` validator, which expects an import-style reference resolved at build time, not a raw string path. If Claude follows the skill's template literally, the blog post will fail the build verification in Phase 3 Step 8.
**Evidence:** Skill Content Schema: `heroImage: "../../assets/images/blog/[name].png"`. Actual config.ts line 7: `heroImage: image().optional()`.
**Recommendation:** Update the Content Schema section to document the correct heroImage format required by Astro's `image()` validator, or note that heroImage should be omitted from new posts unless the operator provides a specific image file (since the image must exist at build time).

### [SC-08]: Loops.so API specification incomplete in weekly-report
**Severity:** High
**Skill:** weekly-report
**Description:** Step 3 references the Loops.so contacts endpoint (`https://app.loops.so/api/v1/contacts`) but provides no specification for: (a) the authentication header format (is it `Authorization: Bearer <key>` or a custom header?), (b) query parameters for filtering or pagination, (c) how to filter contacts by the `archetype` custom property, or (d) how to calculate "new subscribers this period" vs. total count.
**Evidence:** Data Sources section 2: "Fetch via Loops REST API (https://app.loops.so/api/v1/contacts): Total subscriber count, New subscribers this period, Subscribers by archetype (custom property: archetype), Unsubscribes this period."
**Recommendation:** Document the complete API call specification including: authentication header format, required query parameters, pagination handling, and how to derive period-based metrics (new subscribers, unsubscribes) from the contacts endpoint. Alternatively, reference Loops.so API documentation via Context7 or a research artifact.

### [SC-09]: No failure handling for external dependencies across all skills
**Severity:** Medium
**Skill:** All five skills
**Description:** All five skills use Slack MCP for notifications as a final step, and several use WebFetch, WebSearch, or external APIs. None of the skills specify what should happen if these external dependencies are unavailable. The weekly-report has a fallback for missing GA4 credentials (ask operator to paste data), but no skill addresses: Slack MCP being down, WebFetch returning errors, or network connectivity issues. This means Claude will either halt with an unhandled error or improvise behavior.
**Evidence:** audit-site Step 7, publish-post Step 13, social-blast Step 5, weekly-report Step 7, launch-sequence Steps 5/5/5 all say "Post to Slack" with no error handling. audit-site Step 1 says "use WebFetch to fetch the live HTML" with no fallback for site unavailability.
**Recommendation:** Add a standard failure handling section to each skill (or create a shared convention in project CLAUDE.md) specifying: (1) if Slack MCP is unavailable, log the notification in the report file and inform the operator, (2) if WebFetch fails, retry once and then note the failure in the report, (3) if an API key is missing, skip that data source and document what was skipped.

### [SC-10]: Audit-site page list is incomplete
**Severity:** Medium
**Skill:** audit-site
**Description:** The site map table lists 6 page routes, but the project now includes `src/pages/quiz/result/[archetype].astro` which generates publicly accessible archetype result pages (6 routes, one per archetype). These pages have OG meta tags (per recent commit history for Phase 1-4 of the native quiz pipeline) and should be included in the SEO audit. The skill would miss these pages entirely.
**Evidence:** Site Map table lists: Homepage, Quiz, FAQ, Blog Index, Thank You, Blog Posts. Missing: `/quiz/result/[archetype]` (confirmed by glob: `src/pages/quiz/result/[archetype].astro` exists).
**Recommendation:** Add archetype result pages to the site map table. Since these are dynamic routes, specify that Claude should enumerate all 6 archetype slugs (from `src/lib/archetype-content.ts`) and audit each result page.

### [SC-11]: Publish-post cross-reference to social-blast lacks invocation specification
**Severity:** Medium
**Skill:** publish-post
**Description:** Phase 4 Step 11 says "If the social-blast skill is available, invoke it with the new post path to generate platform-specific drafts." This does not specify: (a) how to check if the skill is "available" (check for SKILL.md existence? check settings.json?), (b) how to invoke it (via the Skill tool? by following its procedure inline?), or (c) what arguments to pass (the Skill tool accepts a `skill` name and optional `args` string — what format should args take?).
**Evidence:** Procedure Step 11: "If the social-blast skill is available, invoke it with the new post path to generate platform-specific drafts."
**Recommendation:** Specify the exact invocation: "Use the Skill tool with `skill: 'social-blast'` and `args: 'src/content/blog/[slug].mdx'`." Also specify how to check availability (e.g., "check if ~/.claude/skills/social-blast/SKILL.md exists").

### [SC-12]: Social-blast lacks content source routing in procedure
**Severity:** Medium
**Skill:** social-blast
**Description:** The Content Sources section lists 5 input types (blog post path, archetype name, quiz CTA, free text, launch milestone), but the procedure's Step 2 only provides branching logic for two of them ("If blog post, extract... If archetype, load..."). The remaining three content sources (quiz CTA, free text, launch milestone) have no procedural guidance for how to handle them.
**Evidence:** Content Sources lists 5 types. Procedure Step 2: "If blog post, extract: title, key quotes, main argument, CTA. If archetype, load archetype description and traits." No handling for quiz CTA, free text, or launch milestone.
**Recommendation:** Add procedural branches for all 5 content source types in Step 2, or reduce the Content Sources list to only the types with defined procedures.

### [SC-13]: Weekly-report .env reading exposes secrets
**Severity:** Medium
**Skill:** weekly-report
**Description:** Procedure Step 1 instructs "Read .env for GA4 and Loops credentials." Using the Read tool on .env would display the full contents (including API keys) in the conversation. The skill should instead use Bash to check for variable existence without exposing values (e.g., `grep -c GA4_PROPERTY_ID .env`).
**Evidence:** Procedure Step 1: "Check data source availability: Read .env for GA4 and Loops credentials. Note which sources are available."
**Recommendation:** Change Step 1 to use Bash with grep to check for variable presence without reading values: "Use Bash to verify required environment variables exist in .env (e.g., `grep -c 'GA4_PROPERTY_ID' .env`). Do not read or display the full .env file contents."

### [SC-14]: Launch-sequence Page Update Mode is underspecified
**Severity:** Medium
**Skill:** launch-sequence
**Description:** Page Update Mode Step 2 says "Add/update launch banner with countdown and CTA" but provides no specification for: what the banner should look like, what HTML/Astro component to use, where in index.astro to insert it, whether it's a new component file or inline markup, or what the countdown mechanism should be (client-side JS? static date?). This is too vague for consistent execution.
**Evidence:** Page Update Mode Step 2: "Add/update launch banner with countdown and CTA." Step 3: "Run build to verify." No design specification, component reference, or insertion point.
**Recommendation:** Either provide a banner component template (HTML structure, Tailwind classes matching the Hermetic theme), or specify that this mode should generate a draft for operator review with specific questions about desired appearance.

### [SC-15]: Output directory existence not verified before writes
**Severity:** Medium
**Skill:** social-blast, weekly-report, launch-sequence
**Description:** Multiple skills write output files to subdirectories of `operations/` without first verifying the directories exist. While these directories currently exist in the project, a fresh clone or new contributor setup would not have them: `operations/social/` (social-blast Step 4), `operations/reports/` (weekly-report Step 6), `operations/launch-emails/` (launch-sequence Email Draft Mode Step 4).
**Evidence:** social-blast Step 4: "Save drafts to operations/social/YYYY-MM-DD-[topic-slug].md". weekly-report Step 6: "Save to operations/reports/". launch-sequence Email Draft Mode Step 4: "Save draft to operations/launch-emails/week-N-[slug].md." None include mkdir -p or existence checks.
**Recommendation:** Add a pre-write step to each skill: "Ensure the output directory exists (use Bash: `mkdir -p operations/<subdir>/`)." Alternatively, add a standard preamble convention shared across all skills.

## Passed Checks

1. **Slack channel ID consistency** — All five skills correctly reference #the-hermetic-flight with channel ID C0AFSPKQLDU. Verified consistent across all skills.

2. **Approval gates are well-defined** — Every skill includes a clear approval gate table distinguishing autonomous actions from those requiring operator approval. The launch-sequence skill appropriately gates email scheduling (the highest-risk action). The publish-post skill correctly gates both outline approval and publish approval as separate gates.

3. **Output artifact naming conventions** — All skills follow consistent date-stamped naming: `audit-YYYY-MM-DD-seo.md`, `weekly-YYYY-MM-DD.md`, `YYYY-MM-DD-[slug].md`. This enables chronological sorting and prevents overwrites.

4. **YAML frontmatter and description triggers** — All five skills have well-written `description` fields in their YAML frontmatter with clear trigger phrases that would enable Claude to correctly identify when to invoke each skill.

5. **Required Tools tables** — Each skill declares its tool dependencies upfront, which helps Claude understand what capabilities are needed before beginning execution.

6. **Publish-post voice reference files exist** — Both referenced style guide files (`welcome-to-the-flight.mdx` and `scary-cards.mdx`) exist in the codebase at the specified paths.

7. **Launch-sequence launch-config.json fallback** — The skill correctly handles the case where `operations/launch-config.json` doesn't exist by prompting the operator to create it. This is the right pattern for first-run initialization.

8. **Weekly-report GA4 credential fallback** — The skill correctly specifies a manual fallback when GA4 API credentials are unavailable: "ask operator to paste screenshot or key numbers." This degrades gracefully rather than failing.

9. **Publish-post content schema aligns with config.ts** — Apart from the heroImage format issue (SC-07), the frontmatter fields (title, description, pubDate, tags, author, draft, pinned, hideDate) match the actual Zod schema in `src/content/config.ts`.

10. **Launch-sequence safety gate for broadcast emails** — The skill explicitly warns "Never call the Loops.so broadcast API in test mode against the production list" and specifies that the approval gate on scheduling is the last safety check. This is appropriate safety-tier awareness.

11. **Social-blast brand voice differentiation** — The skill correctly specifies distinct voice guidelines per platform rather than a one-size-fits-all approach, with appropriate detail about character limits, emoji usage, and hashtag conventions per platform.

12. **Cross-skill dependency awareness** — The publish-post skill's reference to social-blast (Phase 4 Step 11) and weekly-report's reference to pdf-deliver (Step 8) demonstrate intentional ecosystem design, even though the invocation specifications need improvement (SC-11).
