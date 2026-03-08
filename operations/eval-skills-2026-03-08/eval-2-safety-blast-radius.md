# Evaluator 2: Safety & Blast Radius

## Summary

The five skills exhibit a generally sound safety posture for draft-generation and reporting workflows, with well-defined approval gates for the highest-risk actions (email broadcasts, git push, website edits). However, there are critical gaps in credential handling -- particularly weekly-report's instruction to read `.env` contents into LLM context -- and a structural weakness in launch-sequence where the approval gate for email scheduling relies on a file-based status field that the LLM itself can edit, creating a self-approval bypass. Several "low-risk" auto-fix categories in audit-site carry higher blast radius than their classification suggests.

## Findings

### [SB-01]: weekly-report reads credential file contents into LLM context
**Severity:** Critical
**Skill:** weekly-report
**Description:** Procedure step 1 instructs: "Read `.env` for GA4 and Loops credentials. Note which sources are available." The `.env` file contains `GA4_SERVICE_ACCOUNT_KEY` (a base64-encoded service account JSON), `LOOPS_API_KEY`, and `GA4_PROPERTY_ID`. Reading this file with the `Read` tool loads these secrets into the LLM's conversation context. Even if the skill intends only to check for the *existence* of keys, the instruction says "Read `.env`" without specifying to check existence only. The LLM will see the full credential values.
**Attack/Failure Scenario:** The LLM reads `.env`, sees `GA4_SERVICE_ACCOUNT_KEY=eyJhbGci...` in context, and later when generating the Slack dashboard or the markdown report, accidentally includes credential values in the output. The Slack post goes to a channel where other team members or integrations can see it. Even without accidental inclusion in output, the credentials are now in the conversation history, which may be logged or persisted.
**Recommendation:** Replace the "Read `.env`" instruction with a targeted existence check -- for example, a Bash command like `grep -q '^GA4_SERVICE_ACCOUNT_KEY=' .env && echo "GA4 configured" || echo "GA4 not configured"`. The skill should never load credential values into the LLM context. Only the Bash tool (for `curl` commands) should reference credentials via shell variable expansion, never through `Read`.

### [SB-02]: weekly-report Bash curl commands may expose bearer tokens in output
**Severity:** Critical
**Skill:** weekly-report
**Description:** The skill instructs using `Bash` with `curl` and an "OAuth2 bearer token" to call the GA4 Data API. The procedure does not specify how the bearer token should be sourced. If the LLM constructs the curl command by reading the service account key from the conversation context (per SB-01) and embedding it in the command string, the bearer token appears in the Bash tool output, the conversation history, and potentially in the saved report or Slack message.
**Attack/Failure Scenario:** The LLM generates a Bash command like `curl -H "Authorization: Bearer <token>" https://analyticsdata.googleapis.com/...`. This command and its output are visible in the conversation. If the LLM then includes a "how I fetched this data" note in the report or Slack summary, the token is exposed. Even without explicit inclusion, the Bash command itself is logged.
**Recommendation:** The skill should mandate that credential handling happens entirely within a helper script (not inline curl). The script should source `.env` directly, construct the auth header internally, and return only data -- never tokens. The skill text should explicitly state: "Never construct curl commands with inline credentials. Use a helper script that sources `.env` and outputs only analytics data."

### [SB-03]: launch-sequence approval gate is bypassable via file-based status
**Severity:** Critical
**Skill:** launch-sequence
**Description:** Schedule Mode step 1 says: "Verify all 4 emails are in 'approved' status." This check reads `operations/launch-config.json` where each email has a `"status"` field. But the LLM itself writes and edits this file (Email Draft Mode step 5: "On approval, update launch config status to 'approved'"). This creates a circular trust problem: the LLM is both the entity that sets the "approved" flag and the entity that checks it as a gate.
**Attack/Failure Scenario:** The operator says something ambiguous like "looks good, let's move forward with the launch prep." The LLM interprets this as approval for all email drafts, updates all four to "approved" in launch-config.json, then checks the schedule gate -- which now passes because it just set the flags itself. It proceeds to call the Loops.so broadcast API, scheduling four real emails to the entire subscriber list. The operator intended only to approve moving forward with *drafting*, not scheduling.
**Recommendation:** The approval gate for scheduling must not rely solely on a file the LLM can edit. Options: (a) require the operator to type a specific confirmation phrase before scheduling (e.g., "CONFIRM SCHEDULE BROADCAST"), (b) require a separate explicit approval step for scheduling that is distinct from the email content approval, or (c) add a two-person rule where the skill posts a schedule summary to Slack and waits for a reply confirmation before executing API calls.

### [SB-04]: launch-sequence safety instruction is non-actionable
**Severity:** High
**Skill:** launch-sequence
**Description:** The Schedule Mode safety note states: "Never call the Loops.so broadcast API in test mode against the production list. When testing Schedule Mode, use a test audience segment or dry-run flag." However, the Loops.so broadcast API does not have a documented "dry-run flag," and the skill does not define what a "test audience segment" is, how to create one, or how to target it. This safety instruction sounds protective but provides no mechanism for compliance.
**Attack/Failure Scenario:** A developer or the LLM attempts to "test" the scheduling flow, sees the safety note, has no way to create a test segment or use a dry-run flag, and either (a) skips testing entirely (leaving the real flow untested) or (b) tests against the production list anyway because there is no alternative.
**Recommendation:** Either define a concrete test segment in Loops.so (e.g., tag a single test email address as "test-segment" and document how to target only that segment), or replace the safety note with a concrete mechanism: "Before scheduling, always present the full send list size and target audience to the operator and require explicit confirmation of the recipient count."

### [SB-05]: audit-site auto-fix of canonical URLs can cause SEO damage
**Severity:** High
**Skill:** audit-site
**Description:** The auto-fix rules list "Trailing slash mismatches -- Normalize canonical URLs" as a LOW-RISK fix that may be applied without approval. However, canonical URL normalization is not a cosmetic change. If the site's Astro `trailingSlash` configuration is set to `"always"` and the skill normalizes canonicals to remove trailing slashes (or vice versa), this creates a canonical URL that does not match the actual resolved URL. Search engines may interpret this as a signal to de-index the page or split link equity.
**Attack/Failure Scenario:** The audit crawls the live site at `thehermeticflight.com/blog/` (trailing slash), finds the canonical tag says `thehermeticflight.com/blog` (no slash), and "fixes" the source to add a trailing slash. But the Astro build outputs the canonical without a trailing slash by design. On next build, the fix is overridden, or worse, it creates a mismatch between the canonical and the resolved URL, confusing search engine indexing for that page.
**Recommendation:** Move canonical URL normalization from the "auto-fix without approval" category to the "requires approval" category. Canonical URL changes should always be reviewed because they interact with the site's routing configuration.

### [SB-06]: audit-site auto-generated alt text may be inaccurate
**Severity:** High
**Skill:** audit-site
**Description:** The auto-fix rule for missing image alt text says: "Add descriptive alt based on filename/context." The LLM generates alt text by inferring from the filename (e.g., `tower.png` becomes `alt="tower"`) and surrounding context. For a tarot deck project, images carry specific symbolic meaning that a filename cannot convey. Auto-generated alt text may be factually wrong, semantically misleading, or fail accessibility standards that require alt text to describe the *function* of the image, not just its filename.
**Attack/Failure Scenario:** An image `src/assets/images/cards/the-tower.png` gets auto-fixed with `alt="the tower"`. But the image shows an aerialist in a specific pose representing the Tower card, and the correct alt text should describe the visual content for screen reader users. The auto-fix introduces inaccessible content that passes automated checks but fails human review.
**Recommendation:** Move image alt text generation from the "auto-fix without approval" category to the "requires approval" category, or restrict auto-fix to only adding a placeholder like `alt="[NEEDS DESCRIPTION]"` that flags the issue for human review without guessing at content.

### [SB-07]: publish-post git commit approval gate is ambiguously defined
**Severity:** Medium
**Skill:** publish-post
**Description:** The approval gates table lists "Git commit: Yes (standard)" and "Git push: Yes (standard)". The "(standard)" qualifier defers to Global CLAUDE.md, which says "Never push to remote without operator confirmation" but says nothing about requiring confirmation for local commits. This means the LLM could interpret "standard" as allowing local commits without explicit approval, while the skill's Phase 3 step 10 says "On approval, flip draft: false and commit" -- implying the commit is part of the publish approval, not a separate gate.
**Attack/Failure Scenario:** The operator approves the blog post content (Phase 3, step 9), and the LLM interprets this as blanket approval for both the draft:false change AND the git commit. This is probably the intended behavior, but the ambiguity of "(standard)" leaves room for the commit to happen in edge cases where the operator approved something else (like the outline in Phase 1) and the LLM proceeds through remaining phases without re-confirming.
**Recommendation:** Replace "(standard)" with an explicit statement: "Requires operator confirmation as part of the publish approval (step 9). The commit is executed only after the operator explicitly approves publishing." Remove the ambiguous deferral to a global rule that doesn't cover commits.

### [SB-08]: publish-post can trigger cascading ungated actions via social-blast
**Severity:** Medium
**Skill:** publish-post
**Description:** Phase 4 step 11 says: "If the `social-blast` skill is available, invoke it with the new post path to generate platform-specific drafts." social-blast's approval gates show that generating drafts, saving to operations/, and posting to Slack all require no approval. This means publish-post can trigger a chain of actions -- writing files and posting to Slack -- without any explicit approval gate for the amplification phase.
**Attack/Failure Scenario:** The operator approves publishing a blog post. The LLM commits the post, then automatically invokes social-blast, which generates four social media drafts and posts the X/Twitter draft to #the-hermetic-flight Slack channel -- all without the operator expecting or approving social content. If the generated social content is off-brand, embarrassing, or premature, it's already been posted to Slack where other team members may see it.
**Recommendation:** Add an approval gate between publish-post invoking social-blast and social-blast executing. Either make the publish-post Phase 4 trigger require explicit approval ("Generate social drafts? Y/N"), or add an approval gate in social-blast for when it is invoked programmatically by another skill (as opposed to direct operator invocation).

### [SB-09]: weekly-report Slack posting can leak internal file paths
**Severity:** Medium
**Skill:** weekly-report
**Description:** The Slack dashboard template includes "Full report: operations/reports/weekly-YYYY-MM-DD.md" -- a local filesystem path. While this is an internal Slack channel and the path itself is not sensitive, it establishes a pattern where internal project structure is exposed in Slack messages. The audit-site skill similarly posts "Report: operations/audit-YYYY-MM-DD-seo.md" to Slack.
**Attack/Failure Scenario:** If the Slack channel is ever shared externally (Slack Connect), or if messages are forwarded, internal file paths reveal the project's directory structure. More importantly, this pattern makes it more likely that a future skill modification accidentally includes sensitive paths (like `.env` location or credential file paths) in Slack messages.
**Recommendation:** All Slack notifications should reference reports by name/date only, not by filesystem path. If a link is needed, it should point to a URL (e.g., a GitHub link to the file in the repository) rather than a local path.

### [SB-10]: launch-sequence timeline alerts fire without operator invocation
**Severity:** Medium
**Skill:** launch-sequence
**Description:** The "Timeline Alerts" section says the skill "should proactively alert (via Slack)" at various milestones (T-30, T-14, T-7, T-3, T-1, T-0). But skills are invoked by the operator -- there is no cron or background scheduling mechanism. This instruction implies that every time the skill is invoked for any reason, it should check the timeline and fire alerts. If the operator runs a status check daily, they could receive repetitive timeline alerts they did not request.
**Attack/Failure Scenario:** The operator runs "launch sequence status" at T-7 and gets the normal status report PLUS an unsolicited alert posted to Slack: "1 week out -- all emails should be scheduled." The next day they run it again and get the same alert. Team members in the Slack channel see repeated countdown alerts and become desensitized to them, potentially missing a genuine urgent notification.
**Recommendation:** Timeline alerts should either (a) track which alerts have already been sent (via a "lastAlertSent" field in launch-config.json) and avoid duplicates, or (b) only fire when the operator explicitly requests a status check that includes alerts, not on every invocation.

## Passed Safety Checks

1. **publish-post email broadcast gate**: Email broadcasts to real subscribers require explicit operator approval. This is correctly gated and clearly documented.

2. **publish-post draft-first workflow**: Posts are created with `draft: true` initially and require explicit approval to flip to `draft: false`. This prevents accidental publication of unfinished content.

3. **social-blast is draft-only**: The skill generates local files and Slack messages only. No direct API posting to social media platforms. The future API posting feature is pre-marked as requiring approval.

4. **launch-sequence email scheduling gate**: Despite the file-based bypass risk (SB-03), the approval gates table correctly identifies "Scheduling email sends" as requiring approval. The intent is right; the mechanism needs hardening.

5. **No skill deletes files**: None of the five skills include file deletion operations. This complies with Global CLAUDE.md's "Never delete files, branches, or data without confirmation."

6. **No skill pushes to remote without approval**: All skills that involve git operations list "Git push: Yes" in their approval gates, consistent with Global CLAUDE.md's safety tier.

7. **No skill commits .env**: None of the skills include `.env` in their git add commands. publish-post explicitly stages only the MDX file (`git add src/content/blog/[slug].mdx`).

8. **audit-site higher-risk fixes require approval**: Meta description rewrites, heading restructuring, and structured data additions are correctly categorized as requiring operator approval.

9. **launch-sequence page updates require approval**: Website campaign page modifications go through a diff-review-approve cycle before committing.

10. **weekly-report is read-only for external systems**: The skill only fetches data from GA4 and Loops.so -- it does not write to or modify any external service state.
