# Weekly Report Skill — Dry-Run Validation Log

**Date:** 2026-03-08
**Purpose:** Verify data source accessibility before first live weekly report run.
**Scope:** Credential presence, API reachability, GA4 auth flow assessment.

---

## 1. Credential Presence Check

Checked via `grep -q` (no file contents exposed):

| Variable | Present in .env | Non-empty after source |
|---|---|---|
| `GA4_PROPERTY_ID` | yes | yes |
| `GA4_SERVICE_ACCOUNT_KEY` | yes | yes |
| `LOOPS_API_KEY` | yes | yes |

All three required variables are declared and non-empty.

---

## 2. Loops.so API Connectivity

**Endpoint tested (initial):** `https://app.loops.so/api/v1/contacts?limit=1`
**Result:** HTTP 404 — endpoint does not exist (returns Loops.so web app 404 page)

**Endpoint tested (corrected):** `https://app.loops.so/api/v1/api-key`
**Auth method:** `Authorization: Bearer $LOOPS_API_KEY`
**Result:** HTTP 200 — `{"success":true,"teamName":"The Hermetic Flight"}`

**Diagnosis:** API key is VALID. The initial 401/404 was caused by testing against a
non-existent `/contacts` endpoint. The `/api/v1/api-key` validation endpoint confirms
the key authenticates successfully for "The Hermetic Flight" team.

**Note:** The `/api/v1/contacts` endpoint referenced in the weekly-report skill does not
exist. This confirms deferred finding F-10 (Loops.so contacts API spec incomplete). The
skill needs corrected endpoint paths — see backlog item "Skill API integration specs".

---

## 3. GA4 API Connectivity

**Result:** Not tested with a live request.

**Reason:** GA4 Data API requires a JWT auth flow:
1. Load the service account JSON from `GA4_SERVICE_ACCOUNT_KEY`.
2. Sign a JWT with RS256 using the private key.
3. POST to `https://oauth2.googleapis.com/token` to exchange for a bearer token.
4. Use that bearer token against `https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport`.

This is not curl-testable in a single step. A proper GA4 connectivity test requires a script
(Python/Node) that handles the full OAuth2 service-account flow. The dry-run validates
that `GA4_PROPERTY_ID` and `GA4_SERVICE_ACCOUNT_KEY` are present and non-empty — that is
as far as shell-level verification can go.

**To add a real GA4 smoke test in a future iteration:**
- Write a Node script (`scripts/ga4-smoke-test.js`) that sources the env, constructs the JWT,
  exchanges for a token, and runs a minimal 1-day report. Exit 0 on success, 1 on failure.
- Call that script from the weekly-report skill's validation step.

---

## 4. Procedure Assessment

The weekly-report skill's dry-run procedure is **sound in structure** with one gap:

| Step | Assessment |
|---|---|
| Credential presence via `grep -q` | Correct — no secrets exposed |
| Loops.so curl test | Correct — straightforward and actionable |
| GA4 connectivity test | Gap — shell-level verification cannot complete the OAuth2 flow; a dedicated script is needed |
| Validation log write to `operations/reports/` | Correct |

**Overall readiness:** Blocked on two operator actions before first live run:
1. Replace `LOOPS_API_KEY` with a real Loops.so API key.
2. Confirm `GA4_SERVICE_ACCOUNT_KEY` contains a valid service account JSON string
   (or file path to one), and build/run a GA4 smoke-test script before trusting GA4 data pull.

---

## 5. Summary

- **Loops.so:** ACCESSIBLE. Key valid (team: "The Hermetic Flight"). The `/contacts` endpoint in the skill is wrong — needs corrected API paths (deferred F-10).
- **GA4:** UNKNOWN. Credentials present; full auth flow not testable via shell curl alone.
- **Skill procedure:** Sound. Two structural gaps: (1) Loops.so endpoint paths need correction, (2) GA4 smoke test script should be added before production use.
- **Recommendation:** Loops.so key works. Before running live weekly report: correct Loops.so endpoint paths in skill (F-10) and build GA4 smoke test script (F-02).
