# Verification Playbook — eval-skills-2026-03-08

## Prerequisites
- Bash shell
- Access to `~/.claude/skills/` directory
- grep, wc, head commands

## Per-Finding Checks

### F-01: Credential exposure via .env Read
**Command:**
```bash
grep -c "Never use the Read tool on" ~/.claude/skills/weekly-report/SKILL.md && grep "grep -q" ~/.claude/skills/weekly-report/SKILL.md | head -2
```
**Expected:** Count = 1. Two grep -q examples shown (GA4_PROPERTY_ID, LOOPS_API_KEY).

### F-03: Loops.so broadcast API spec → manual workflow
**Command:**
```bash
grep -c "operator to create and schedule campaigns manually" ~/.claude/skills/launch-sequence/SKILL.md && ! grep -q "dry-run flag" ~/.claude/skills/launch-sequence/SKILL.md && echo "dry-run removed"
```
**Expected:** Count = 1. "dry-run removed" printed.

### F-04: Self-approval bypass → CONFIRM SCHEDULE
**Command:**
```bash
grep -c "CONFIRM SCHEDULE" ~/.claude/skills/launch-sequence/SKILL.md
```
**Expected:** Count >= 2 (once in procedure, once in approval gates table).

### F-05: Scoring formula defined
**Command:**
```bash
grep "5 points" ~/.claude/skills/audit-site/SKILL.md
```
**Expected:** Line containing "Each check scores 5 points" with Pass/Warn/Fail values.

### F-06: Checklist persistence defined
**Command:**
```bash
grep -c "launch-checklist.md" ~/.claude/skills/launch-sequence/SKILL.md
```
**Expected:** Count >= 2 (persistence block + Status Check Mode step).

### F-07: Timeline alerts reframed as conditional
**Command:**
```bash
grep "When invoked, check the current date" ~/.claude/skills/launch-sequence/SKILL.md
```
**Expected:** One match showing conditional invocation-time behavior.

### F-08: Archetype data path present
**Command:**
```bash
grep "archetype-content.ts" ~/.claude/skills/social-blast/SKILL.md
```
**Expected:** Line referencing `src/lib/archetype-content.ts` with field names.

### F-09: heroImage uses image() not string path
**Command:**
```bash
grep "heroImage" ~/.claude/skills/publish-post/SKILL.md
```
**Expected:** Shows `image()` validator reference, not a string path like `../../assets/`.

### F-11: No auto-fixes without approval
**Command:**
```bash
grep "No auto-fixes are applied" ~/.claude/skills/audit-site/SKILL.md
```
**Expected:** One match confirming all fixes require operator review.

### F-12: Slack @mention in all 5 skills
**Command:**
```bash
grep -l "U0AEKD062V6" ~/.claude/skills/*/SKILL.md | wc -l
```
**Expected:** 5 (all five skill files contain the mention tag).

### F-13: audit-site has Approval Gates table
**Command:**
```bash
grep -c "Approval Gates" ~/.claude/skills/audit-site/SKILL.md
```
**Expected:** Count >= 1.

### F-15: Inter-skill invocation specified with approval gate
**Command:**
```bash
grep -c "Social media draft generation" ~/.claude/skills/publish-post/SKILL.md && grep -c "invoked programmatically" ~/.claude/skills/social-blast/SKILL.md
```
**Expected:** Both counts = 1.

## Aggregate Check
```bash
#!/bin/bash
PASS=0; FAIL=0
check() { if eval "$1" > /dev/null 2>&1; then echo "PASS: $2"; ((PASS++)); else echo "FAIL: $2"; ((FAIL++)); fi; }
check 'grep -q "Never use the Read tool on" ~/.claude/skills/weekly-report/SKILL.md' "F-01"
check 'grep -q "operator to create and schedule campaigns manually" ~/.claude/skills/launch-sequence/SKILL.md' "F-03"
check '[ $(grep -c "CONFIRM SCHEDULE" ~/.claude/skills/launch-sequence/SKILL.md) -ge 2 ]' "F-04"
check 'grep -q "5 points" ~/.claude/skills/audit-site/SKILL.md' "F-05"
check '[ $(grep -c "launch-checklist.md" ~/.claude/skills/launch-sequence/SKILL.md) -ge 2 ]' "F-06"
check 'grep -q "When invoked, check the current date" ~/.claude/skills/launch-sequence/SKILL.md' "F-07"
check 'grep -q "archetype-content.ts" ~/.claude/skills/social-blast/SKILL.md' "F-08"
check 'grep -q "image()" ~/.claude/skills/publish-post/SKILL.md' "F-09"
check 'grep -q "No auto-fixes are applied" ~/.claude/skills/audit-site/SKILL.md' "F-11"
check '[ $(grep -rl "U0AEKD062V6" ~/.claude/skills/*/SKILL.md | wc -l) -ge 5 ]' "F-12"
check 'grep -q "Approval Gates" ~/.claude/skills/audit-site/SKILL.md' "F-13"
check 'grep -q "Social media draft generation" ~/.claude/skills/publish-post/SKILL.md' "F-15"
echo "---"
echo "Results: $PASS passed, $FAIL failed out of 12"
```
**Expected:** 12 passed, 0 failed.
