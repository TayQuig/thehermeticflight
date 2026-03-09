# Evaluation Synthesis — Website Automation Skills

**Sprint:** eval-skills-2026-03-08
**Target:** 5 SKILL.md files (audit-site, publish-post, social-blast, weekly-report, launch-sequence)
**Evaluators:** 3 (structural completeness, safety/blast radius, cross-skill consistency)
**Raw findings:** 35 (15 + 10 + 10)
**Deduplicated:** 26
**Remediate now:** 12
**Defer:** 14

---

## 1. Finding IDs + Calibrated Severity

| ID | Title | Severity | Skill(s) |
|----|-------|----------|----------|
| F-01 | Credential exposure via .env Read | Critical | weekly-report |
| F-03 | Loops.so broadcast API spec absent + non-actionable safety note | Critical | launch-sequence |
| F-04 | Self-approval bypass in email scheduling | Critical | launch-sequence |
| F-05 | Scoring formula ambiguous — no weights or point values | High | audit-site |
| F-06 | Checklist persistence location undefined | High | launch-sequence |
| F-07 | Timeline alerts describe impossible on-demand behavior | High | launch-sequence |
| F-08 | Archetype data source path missing | High | social-blast |
| F-09 | heroImage format contradicts Astro image() validator | High | publish-post |
| F-11 | Auto-fix rules too broad — canonical URLs + alt text | High | audit-site |
| F-12 | Slack templates missing operator @mention tag | High | all 5 |
| F-13 | audit-site lacks Approval Gates table | High | audit-site |
| F-15 | Inter-skill invocation underspecified + cascading ungated actions | High | publish-post, social-blast |

## 2. Convergence Matrix

| ID | Eval 1 (Structural) | Eval 2 (Safety) | Eval 3 (Consistency) | Confidence |
|----|---------------------|-----------------|----------------------|------------|
| F-01 | SC-13 | SB-01, SB-02 | — | 2/3 (67%) |
| F-03 | SC-02 | SB-04 | — | 2/3 (67%) |
| F-04 | — | SB-03 | — | 1/3 (33%) |
| F-05 | SC-03 | — | — | 1/3 (33%) |
| F-06 | SC-04 | — | — | 1/3 (33%) |
| F-07 | SC-05 | SB-10 | — | 2/3 (67%) |
| F-08 | SC-06 | — | — | 1/3 (33%) |
| F-09 | SC-07 | — | — | 1/3 (33%) |
| F-11 | — | SB-05, SB-06 | — | 1/3 (33%) |
| F-12 | — | — | CS-04 | 1/3 (33%) |
| F-13 | — | — | CS-01, CS-09 | 1/3 (33%) |
| F-15 | SC-11 | SB-08 | CS-10 | 3/3 (100%) |

**Convergence summary:** 3 findings at 67% confidence, 1 finding at 100% confidence, 8 findings at 33%. The highest-convergence finding (F-15: inter-skill invocation) was independently flagged by all 3 evaluators from structural, safety, and consistency perspectives.

## 3. Affected Files Inventory

| File | Action | Findings |
|------|--------|----------|
| `~/.claude/skills/weekly-report/SKILL.md` | Modify | F-01, F-12 |
| `~/.claude/skills/launch-sequence/SKILL.md` | Modify | F-03, F-04, F-06, F-07, F-12 |
| `~/.claude/skills/audit-site/SKILL.md` | Modify | F-05, F-11, F-12, F-13 |
| `~/.claude/skills/social-blast/SKILL.md` | Modify | F-08, F-12, F-15 |
| `~/.claude/skills/publish-post/SKILL.md` | Modify | F-09, F-12, F-15 |

All modifications are to SKILL.md files outside the git repo. No in-repo files affected.

## 4. Sprint Phase Assignments

These are non-code artifacts, so remediation uses the contract/checklist path (no frozen-test-file).

| Phase | Severity Group | Findings | Effort |
|-------|---------------|----------|--------|
| Phase A | Critical | F-01, F-03, F-04 | Medium |
| Phase B | High — safety | F-11, F-15 | Small |
| Phase C | High — completeness | F-05, F-06, F-07, F-08, F-09, F-12, F-13 | Medium |

## 5. Deferred Findings

| ID | Title | Severity | Rationale |
|----|-------|----------|-----------|
| F-02 | GA4 auth procedure unimplementable | Critical | Has manual fallback. Requires GA4 API research. Defer until operator configures GA4 credentials. |
| F-10 | Loops.so contacts API spec incomplete | High | Has fallback. Requires Loops.so API research. Defer until operator configures LOOPS_API_KEY. |
| F-14 | Git operations inconsistent in approval gates | High | Functional without fix. Lower impact than other High findings. |
| F-16 | No failure handling / degradation pattern | Medium | Convention improvement. Low urgency. |
| F-17 | Page list missing quiz result pages | Medium | Audit will still work; just incomplete coverage. |
| F-18 | Content source routing incomplete in social-blast | Medium | 3 of 5 content types have no procedure branch. Low urgency. |
| F-19 | Page Update Mode underspecified | Medium | Premature to over-specify before launch date is set. |
| F-20 | Output directory existence not verified | Medium | Directories currently exist. Edge case on fresh clone. |
| F-21 | Procedure structure varies across skills | Medium | Style preference. Does not affect functionality. |
| F-22 | Emoji usage inconsistent in Slack templates | Medium | Cosmetic. |
| F-23 | Output path conventions mixed (flat vs subdirectory) | Medium | Functional. Cosmetic inconsistency. |
| F-24 | Brand voice guidance split without cross-reference | Medium | Both definitions are correct. Cross-ref is a nice-to-have. |
| F-25 | Git commit approval gate "(standard)" is ambiguous | Medium | Functional — Claude still asks for confirmation in practice. |
| F-26 | Slack posts include local file paths | Medium | Internal channel. Low risk. |

## 6. Verification Criteria

| ID | Verification |
|----|-------------|
| F-01 | Procedure Step 1 uses Bash grep to check .env variable existence; no Read tool on .env. No credential values appear in any skill text. |
| F-03 | Schedule Mode documents manual workflow via Loops.so dashboard. Non-actionable "dry-run flag" text removed. |
| F-04 | Schedule Mode requires explicit operator confirmation phrase (not file-based status check) before API calls. |
| F-05 | Scoring section includes explicit point formula: points per check, deduction values for warn/fail, denominator. |
| F-06 | Checklist has a defined persistence file path. Status Check Mode Step 3 references that path. |
| F-07 | Timeline alerts reframed as conditional output during Status Check Mode invocation, not proactive. |
| F-08 | Procedure Step 2 includes explicit file path to `src/lib/archetype-content.ts`. |
| F-09 | heroImage field documentation matches Astro `image()` validator behavior, or notes it should be omitted. |
| F-11 | Both auto-fix categories (canonical URLs, alt text) moved to "requires approval". |
| F-12 | All 5 Slack templates begin with `<@U0AEKD062V6>`. |
| F-13 | audit-site has `## Approval Gates` section with `| Action | Requires Approval |` table. |
| F-15 | publish-post specifies exact Skill tool invocation for social-blast. social-blast documents programmatic invocation. publish-post Phase 4 has an approval gate before triggering social-blast. |

## 7. Stripped Finding Descriptions (for remediation agents)

### F-01: Credential exposure via .env Read
weekly-report Procedure Step 1 instructs reading `.env` with the Read tool, which loads credential values into LLM context. Replace with Bash grep that checks variable existence without exposing values. Also ensure no procedure step constructs curl commands with inline credentials — use shell variable expansion within scripts only.

### F-03: Loops.so broadcast API spec absent
launch-sequence Schedule Mode references a Loops.so broadcast API that has no specification (endpoint, request format, auth). Research indicates Loops.so does not support broadcast scheduling via REST API — campaigns are managed through the dashboard. Replace Schedule Mode's API-based workflow with a manual workflow: draft emails as markdown, present schedule to operator, instruct operator to create campaigns in the Loops.so dashboard. Remove the non-actionable "use a test segment or dry-run flag" safety note.

### F-04: Self-approval bypass in email scheduling
launch-sequence Schedule Mode's approval gate reads a `"status"` field from `launch-config.json` that the LLM itself sets. This is a circular trust problem. Add a hard approval gate that requires the operator to provide an explicit confirmation phrase before any scheduling actions proceed, independent of the file-based status.

### F-05: Scoring formula ambiguous
audit-site Scoring section maps letter grades to numeric ranges but provides no formula for converting pass/warn/fail check results into a numeric score. Define explicit point values, deduction amounts, and the denominator.

### F-06: Checklist persistence undefined
launch-sequence pre-launch checklist has no defined storage location between invocations. Define a file path and specify that the skill reads from and writes updates to this file.

### F-07: Timeline alerts impossible
launch-sequence Timeline Alerts describe proactive scheduled behavior, but skills are invoked on-demand. Reframe alerts as conditional: when invoked, check the current date against the launch date and include relevant milestone alerts in the status output.

### F-08: Archetype data path missing
social-blast Procedure Step 2 says "load archetype description and traits" but provides no file path. Add explicit reference to `src/lib/archetype-content.ts`.

### F-09: heroImage format contradiction
publish-post Content Schema shows heroImage as a string path, but `src/content/config.ts` uses Astro's `image()` validator. Update the schema documentation to reflect the actual validator behavior or note that heroImage should be omitted unless an image file is prepared.

### F-11: Auto-fix rules too broad
audit-site classifies canonical URL normalization and image alt text generation as "low-risk auto-fix without approval." Both carry higher blast radius than classified: canonical changes affect SEO indexing; auto-generated alt text for a tarot deck project may be semantically wrong. Move both to "requires approval."

### F-12: Slack templates missing operator @mention
All 5 skills' Slack notification templates lack the `<@U0AEKD062V6>` mention tag required by the slack-notify convention. Add the mention tag to the beginning of every Slack template.

### F-13: audit-site lacks Approval Gates table
audit-site distributes approval logic across prose Auto-Fix Rules. Add a standardized `## Approval Gates` section with `| Action | Requires Approval |` table matching the format used by the other 4 skills.

### F-15: Inter-skill invocation underspecified
publish-post Phase 4 Step 11 references social-blast with no invocation specification. social-blast's procedure assumes operator input, not programmatic invocation. Define: (a) exact Skill tool invocation syntax in publish-post, (b) programmatic input handling in social-blast, (c) an approval gate in publish-post before triggering social-blast amplification.
