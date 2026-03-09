# GA4 Data API v1 — Complete Reference Guide

> Compiled from developers.google.com/analytics — 2026-03-08
> 30+ documentation pages scraped and synthesized via 4 parallel research agents.
> Primary source: https://developers.google.com/analytics/devguides/reporting/data/v1

---

## Contents

1. Overview — 2. Getting Started — 3. Authentication —
4. API Reference (Endpoints) — 5. Shared Type Definitions —
6. Dimensions & Metrics — 7. Guides & Patterns — 8. Quotas & Limits —
9. Error Reference — 10. Environment Variables — 11. Vercel/Serverless —
12. Working Examples (Node.js)

---

## 1. Overview

The Google Analytics Data API v1 provides programmatic access to GA4 report
data. It is **incompatible with Universal Analytics (UA-xxx) properties** —
only numeric GA4 property IDs are supported.

**Base URL:** `https://analyticsdata.googleapis.com`

**Stable version:** v1beta (no breaking changes expected)
**Experimental version:** v1alpha (breaking changes possible)

**Discovery documents:**
- `https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta`
- `https://analyticsdata.googleapis.com/$discovery/rest?version=v1alpha`

### Available Methods

| Method | Version | Purpose |
|--------|---------|---------|
| `runReport` | v1beta | Standard customized reports (preferred for most queries) |
| `batchRunReports` | v1beta | Up to 5 reports in a single call |
| `runPivotReport` | v1beta | Pivot table format reports |
| `batchRunPivotReports` | v1beta | Up to 5 pivot reports in a single call |
| `runRealtimeReport` | v1beta | Real-time event data (seconds-level latency) |
| `getMetadata` | v1beta | List available dimensions, metrics, custom parameters |
| `checkCompatibility` | v1beta | Validate dimension/metric combinations before querying |
| `audienceExports.*` | v1beta | Async audience snapshots (create, get, list, query) |
| `runFunnelReport` | v1alpha | Funnel analysis (early preview) |
| `audienceLists.*` | v1alpha | Audience lists (alpha equivalent of audienceExports) |
| `recurringAudienceLists.*` | v1alpha | Daily recurring audience exports |
| `reportTasks.*` | v1alpha | Async report tasks |

### Key Constraints

| Limit | Value |
|-------|-------|
| Max dimensions per report | 9 |
| Max metrics per report | 10 |
| Max date ranges per report | 4 |
| Max rows per request | 250,000 |
| Default rows per request | 10,000 |
| Max batch size | 5 requests |
| Product of all pivot limits | ≤ 100,000 |
| Max minute ranges (realtime) | 2 |
| Realtime window (standard) | 30 minutes |
| Realtime window (GA 360) | 60 minutes |

---

## 2. Getting Started

### Prerequisites

1. A Google Cloud project with the **Google Analytics Data API** enabled
   (APIs & Services → Library → search "Analytics Data API" → Enable)
2. A **service account** with a JSON key file
3. The service account email granted **Viewer** access in the GA4 property
4. The **GA4 Property ID** (numeric only — NOT a UA tracking ID)

### Installation (Node.js)

```bash
npm install @google-analytics/data
```

Package: `@google-analytics/data`
npm: https://www.npmjs.com/package/@google-analytics/data
GitHub: https://github.com/googleapis/nodejs-analytics-data

### Finding Your Property ID

- **GA4 UI:** Admin → Property → Property Settings → "PROPERTY ID"
- **Firebase:** Project settings → Integrations → Google Analytics → "Property ID"

The Property ID is numeric only (e.g., `123456789`). If you see `UA-123-1`
(with dashes), that is a Universal Analytics tracking ID — NOT supported.

In API calls, format as: `properties/123456789`

### Service Account Setup

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Select project → Create Service Account
3. Name it (e.g., `ga4-reader@your-project.iam.gserviceaccount.com`)
4. Click Keys → Add Key → JSON → download the file
5. **Store the JSON file securely — Google does NOT retain the private key**
6. Go to Google Analytics → Admin → Property → Property Access Management
7. Add the service account email with **"Viewer"** role
8. Enable the Google Analytics Data API in Cloud Console

### CRITICAL: Two Permissions Required

| Permission | Where to Set | Purpose |
|-----------|-------------|---------|
| Cloud IAM | Cloud Console → IAM & Admin | Allows the SA to call the API |
| GA4 Property Access | Analytics UI → Admin → Property Access Management | Allows the SA to read data |

**Cloud IAM alone is NOT sufficient.** The service account must also be added
as a Viewer in the GA4 property through the Analytics UI.

---

## 3. Authentication

All requests require OAuth 2.0 with one of these scopes:

| Scope | Access Level |
|-------|-------------|
| `https://www.googleapis.com/auth/analytics.readonly` | Read-only (recommended) |
| `https://www.googleapis.com/auth/analytics` | Read/write |

### 3a. Application Default Credentials (Local / GCE)

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

```javascript
const {BetaAnalyticsDataClient} = require('@google-analytics/data');
const analyticsDataClient = new BetaAnalyticsDataClient();
```

### 3b. Explicit keyFilename (File Path)

```javascript
const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: '/path/to/service-account-key.json',
});
```

> **WARNING:** Do NOT use `keyFilename` on Vercel or any serverless platform —
> there is no filesystem. Use `credentials` instead (see 3c/3d/3e).

### 3c. Inline credentials Object (No File Required)

```javascript
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    type: 'service_account',
    project_id: 'your-project-id',
    private_key_id: 'your-private-key-id',
    private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
    client_email: 'your-sa@your-project.iam.gserviceaccount.com',
    client_id: 'your-client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/...',
  },
});
```

### 3d. From Environment Variable — JSON String

```bash
# In .env or Vercel environment:
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...",...}'
```

```javascript
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
```

### 3e. From Environment Variable — Base64-Encoded JSON

```bash
# Encode locally:
base64 -i service-account-key.json | tr -d '\n'
# Store result as GA4_SERVICE_ACCOUNT_KEY in .env / Vercel
```

```javascript
const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY;
const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
```

### 3f. Using google-auth-library JWT Directly

```javascript
const {JWT} = require('google-auth-library');

const keys = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const jwtClient = new JWT({
  email: keys.client_email,
  key: keys.private_key,
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});

const analyticsDataClient = new BetaAnalyticsDataClient({ auth: jwtClient });
```

### 3g. Manual JWT Flow (Raw HTTP — No Client Library)

Only needed for environments without the Node.js client library.

**Step 1 — Construct JWT Header:**
```json
{ "alg": "RS256", "typ": "JWT", "kid": "[private_key_id from JSON key]" }
```

**Step 2 — Construct JWT Claim Set:**
```json
{
  "iss": "service-account@project.iam.gserviceaccount.com",
  "scope": "https://www.googleapis.com/auth/analytics.readonly",
  "aud": "https://oauth2.googleapis.com/token",
  "iat": 1711900000,
  "exp": 1711903600
}
```

Rules: `iss` = `client_email`, `exp - iat` must be ≤ 65 minutes, `aud` is
always `https://oauth2.googleapis.com/token`.

**Step 3 — Sign:** Base64url-encode header + claims, sign with RS256 using
`private_key`, base64url-encode signature.

**Step 4 — Exchange for access token:**
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={SIGNED_JWT}
```

**Step 5 — Response:**
```json
{
  "access_token": "ya29.c.b0AXooCgt...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Step 6 — Use token:**
```
Authorization: Bearer ya29.c.b0AXooCgt...
```

### BetaAnalyticsDataClient Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `keyFilename` | string | Path to service account JSON key file |
| `credentials` | object | Inline service account credentials object |
| `projectId` | string | Google Cloud project ID |
| `apiEndpoint` | string | Override API endpoint (default: analyticsdata.googleapis.com) |
| `auth` | GoogleAuth / JWT | Pre-constructed auth client |

> **Note:** `BetaAnalyticsDataClient` is for v1beta (standard reporting).
> Use `AlphaAnalyticsDataClient` for v1alpha (funnel reports, audience lists).

---

## 4. API Reference — Endpoints

---

### runReport

**HTTP:** `POST /v1beta/{property=properties/*}:runReport`
**URL:** `https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport`

Returns customized event data reports. Preferred method for simple queries.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | Format: `properties/1234` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | Dimension[] | No | Dimensions to include. Max 9. |
| `metrics` | Metric[] | No | Metrics to include. Max 10. |
| `dateRanges` | DateRange[] | No | Up to 4 date ranges. Not used in cohort requests. |
| `dimensionFilter` | FilterExpression | No | Filters on dimension values only. |
| `metricFilter` | FilterExpression | No | Post-aggregation filter (SQL HAVING). Metrics only. |
| `offset` | int64 | No | Pagination start row. Default: 0. |
| `limit` | int64 | No | Rows to return. Default: 10,000. Max: 250,000. |
| `metricAggregations` | MetricAggregation[] | No | TOTAL, MINIMUM, MAXIMUM, COUNT. |
| `orderBys` | OrderBy[] | No | Row sort order. |
| `currencyCode` | string | No | ISO 4217 code. Property default if omitted. |
| `cohortSpec` | CohortSpec | No | Requires `cohort` dimension. |
| `keepEmptyRows` | boolean | No | Include all-zero rows. Default: false. |
| `returnPropertyQuota` | boolean | No | Include quota state in response. |
| `comparisons` | Comparison[] | No | Comparison configurations. |

#### Response Body (RunReportResponse)

| Field | Type | Description |
|-------|------|-------------|
| `dimensionHeaders` | DimensionHeader[] | Column headers for dimensions. |
| `metricHeaders` | MetricHeader[] | Column headers for metrics. |
| `rows` | Row[] | Data rows with dimension and metric values. |
| `totals` | Row[] | Totaled metric values (if TOTAL requested). |
| `maximums` | Row[] | Maximum metric values (if MAXIMUM requested). |
| `minimums` | Row[] | Minimum metric values (if MINIMUM requested). |
| `rowCount` | integer | Total rows in full result set, independent of pagination. |
| `metadata` | ResponseMetaData | Sampling, restrictions, currency, timezone. |
| `propertyQuota` | PropertyQuota | Current quota state. |
| `kind` | string | Always `"analyticsData#runReport"`. |

#### Notes

- Multiple date ranges produce a zero-based `dateRange` dimension per row.
- Metrics CANNOT appear in `dimensionFilter`; dimensions CANNOT appear in `metricFilter`.
- Fewer rows returned if dimension cardinality < `limit`.

---

### batchRunReports

**HTTP:** `POST /v1beta/{property=properties/*}:batchRunReports`

Returns up to 5 reports in a single request.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requests` | RunReportRequest[] | Yes | Up to 5 requests. All must target same property. |

#### Response Body

| Field | Type | Description |
|-------|------|-------------|
| `reports` | RunReportResponse[] | Responses in same order as requests. |
| `kind` | string | `"analyticsData#batchRunReports"` |

---

### runPivotReport

**HTTP:** `POST /v1beta/{property=properties/*}:runPivotReport`

Returns pivot table format reports. Each response row represents a single cell.

#### Request Body

Same fields as `runReport` plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pivots` | Pivot[] | No | Pivot specifications. No two pivots can share a dimension. |

All declared dimensions must be used in a pivot `fieldNames`, filter, or orderBy.
Product of all pivot `limit` values must not exceed 100,000.

#### Response Body (RunPivotReportResponse)

| Field | Type | Description |
|-------|------|-------------|
| `pivotHeaders` | PivotHeader[] | One per pivot, summarizing columns/rows. |
| `dimensionHeaders` | DimensionHeader[] | Dimension column headers. |
| `metricHeaders` | MetricHeader[] | Metric column headers. |
| `rows` | Row[] | Data rows (each = one cell). |
| `aggregates` | Row[] | Aggregated values (if requested). |
| `metadata` | ResponseMetaData | Report metadata. |
| `propertyQuota` | PropertyQuota | Quota state. |
| `kind` | string | `"analyticsData#runPivotReport"` |

---

### batchRunPivotReports

**HTTP:** `POST /v1beta/{property=properties/*}:batchRunPivotReports`

Up to 5 pivot reports in a single request. Same pattern as `batchRunReports`.

---

### runRealtimeReport

**HTTP:** `POST /v1beta/{property=properties/*}:runRealtimeReport`

Real-time event data. Events appear within seconds of being sent.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | Dimension[] | No | Dimensions to display. |
| `metrics` | Metric[] | No | Metrics to display. |
| `dimensionFilter` | FilterExpression | No | Dimension filter. |
| `metricFilter` | FilterExpression | No | Post-aggregation metric filter. |
| `limit` | int64 | No | Default: 10,000. Max: 250,000. |
| `metricAggregations` | MetricAggregation[] | No | Aggregations to compute. |
| `orderBys` | OrderBy[] | No | Sort order. |
| `returnPropertyQuota` | boolean | No | Include realtime quota state. |
| `minuteRanges` | MinuteRange[] | No | Default: last 30 min. Max: 2 ranges. |

#### MinuteRange

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Identifier for this range. |
| `startMinutesAgo` | integer | Default: 29. Standard max: 29. GA 360 max: 59. |
| `endMinutesAgo` | integer | Default: 0. |

#### Notes

- **No `offset` pagination** — use `limit` only.
- Standard GA4: last 30 minutes. GA 360: last 60 minutes.
- When multiple minute ranges used, `dateRange` dimension auto-added to response.
- Limited subset of dimensions/metrics (see Section 6).

---

### getMetadata

**HTTP:** `GET /v1beta/{name=properties/*/metadata}`

Returns all available dimensions, metrics, and comparisons for a property.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | `properties/{propertyId}/metadata`. Use `properties/0/metadata` for universal metadata. |

**Request Body:** None (GET request).

#### Response Body

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Resource name. |
| `dimensions` | DimensionMetadata[] | All available dimensions. |
| `metrics` | MetricMetadata[] | All available metrics. |
| `comparisons` | ComparisonMetadata[] | Available comparisons. |

#### Notes

- Returns both custom and universal dimensions/metrics.
- Custom metrics follow pattern `customEvent:{parameter_name}`.
- Use property ID `0` for generic metadata not tied to a specific property.

---

### checkCompatibility

**HTTP:** `POST /v1beta/{property=properties/*}:checkCompatibility`

Validates dimension/metric combinations before querying. Core reports only —
does NOT apply to Realtime reports.

#### Request Body

| Field | Type | Description |
|-------|------|-------------|
| `dimensions` | Dimension[] | From intended report. |
| `metrics` | Metric[] | From intended report. |
| `dimensionFilter` | FilterExpression | From intended report. |
| `metricFilter` | FilterExpression | From intended report. |
| `compatibilityFilter` | enum(Compatibility) | Filter to e.g. `"COMPATIBLE"` only. |

#### Response Body

| Field | Type | Description |
|-------|------|-------------|
| `dimensionCompatibilities` | DimensionCompatibility[] | Per-dimension: metadata + `COMPATIBLE` / `INCOMPATIBLE`. |
| `metricCompatibilities` | MetricCompatibility[] | Per-metric: metadata + `COMPATIBLE` / `INCOMPATIBLE`. |

---

### Audience Exports (Async)

Audience exports are point-in-time snapshots of users in a specified audience.

#### Workflow

```
1. POST  properties/{id}/audienceExports           → state: CREATING
2. GET   properties/{id}/audienceExports/{exportId} → poll until state: ACTIVE (~15 min)
   OR configure webhookNotification to avoid polling
3. POST  properties/{id}/audienceExports/{exportId}:query → paginated user rows
```

#### AudienceExport States

| State | Meaning |
|-------|---------|
| `CREATING` | Being constructed; not queryable |
| `ACTIVE` | Ready for `query` calls |
| `FAILED` | Failed; retry may succeed |

#### Methods

| Method | HTTP | Description |
|--------|------|-------------|
| create | POST `.../audienceExports` | Initiates async export |
| get | GET `.../audienceExports/{id}` | Gets metadata/state |
| list | GET `.../audienceExports` | Lists all exports |
| query | POST `.../audienceExports/{id}:query` | Fetches user rows |

---

### Funnel Reports (v1alpha)

**HTTP:** `POST /v1alpha/{property=properties/*}:runFunnelReport`

> **Alpha only** — expect breaking changes. Use `AlphaAnalyticsDataClient`.

Funnel reports visualize user journeys through sequential steps. Response
contains two sub-reports: `funnelVisualization` (high-level) and `funnelTable`
(detailed with completion/abandonment rates).

#### Funnel Table Metrics

| Metric | Description |
|--------|-------------|
| `activeUsers` | Users who completed this step |
| `funnelStepCompletionRate` | Fraction proceeding to next step |
| `funnelStepAbandonments` | Count who did not proceed |
| `funnelStepAbandonmentRate` | Fraction who did not proceed |

---

## 5. Shared Type Definitions

---

### Dimension

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Dimension identifier (e.g., `eventName`, `country`). |
| `dimensionExpression` | DimensionExpression | Formula: `lowerCase`, `upperCase`, or `concatenate`. |

### Metric

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Metric identifier (e.g., `activeUsers`, `sessions`). |
| `expression` | string | Math formula for derived metrics (e.g., `"eventCount/totalUsers"`). |
| `invisible` | boolean | If true, excluded from response but usable in filters/sorting. |

### DateRange

| Field | Type | Description |
|-------|------|-------------|
| `startDate` | string | `YYYY-MM-DD` or relative: `NdaysAgo`, `yesterday`, `today`. |
| `endDate` | string | Same format. Cannot be before `startDate`. |
| `name` | string | Identifier for multi-range reports. Auto-named if omitted. |

### FilterExpression

Union — use exactly one:

| Field | Type | Description |
|-------|------|-------------|
| `andGroup` | FilterExpressionList | All must be true (AND). |
| `orGroup` | FilterExpressionList | At least one true (OR). |
| `notExpression` | FilterExpression | Negation (NOT). |
| `filter` | Filter | Single primitive condition. |

### Filter

| Field | Type | Description |
|-------|------|-------------|
| `fieldName` | string | Dimension or metric name. |
| One of: | | |
| `stringFilter` | StringFilter | String matching. |
| `inListFilter` | InListFilter | Match against list of values. |
| `numericFilter` | NumericFilter | Numeric comparison. |
| `betweenFilter` | BetweenFilter | Inclusive range. |

### StringFilter

| Field | Type | Description |
|-------|------|-------------|
| `matchType` | enum | `EXACT`, `BEGINS_WITH`, `ENDS_WITH`, `CONTAINS`, `FULL_REGEXP`, `PARTIAL_REGEXP` |
| `value` | string | String to match against. |
| `caseSensitive` | boolean | Default: false. |

### InListFilter

| Field | Type | Description |
|-------|------|-------------|
| `values` | string[] | List of possible values. |
| `caseSensitive` | boolean | Default: false. |

### NumericFilter

| Field | Type | Description |
|-------|------|-------------|
| `operation` | enum | `EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL` |
| `value` | NumericValue | `int64Value` (string) or `doubleValue` (number). |

### BetweenFilter

| Field | Type | Description |
|-------|------|-------------|
| `fromValue` | NumericValue | Lower bound (inclusive). |
| `toValue` | NumericValue | Upper bound (inclusive). |

### OrderBy

| Field | Type | Description |
|-------|------|-------------|
| `desc` | boolean | If true, sort descending. Default: ascending. |
| One of: `metric`, `dimension`, `pivot` | | Sort type. |

**MetricOrderBy:** `{ metricName: string }`
**DimensionOrderBy:** `{ dimensionName: string, orderType: enum }`

OrderType enum: `ALPHANUMERIC`, `CASE_INSENSITIVE_ALPHANUMERIC`, `NUMERIC`

### Pivot

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fieldNames` | string[] | No | Dimension names for this pivot. |
| `limit` | int64 | Yes | Max rows. Product of all pivots ≤ 100,000. |
| `offset` | int64 | No | Pagination start. |
| `orderBys` | OrderBy[] | No | Sort order. |
| `metricAggregations` | MetricAggregation[] | No | Aggregations for this pivot. |

### MetricAggregation (enum)

`TOTAL`, `MINIMUM`, `MAXIMUM`, `COUNT`

### CohortSpec

| Field | Type | Description |
|-------|------|-------------|
| `cohorts` | Cohort[] | Cohort definitions. |
| `cohortsRange` | CohortsRange | Extended date range. |
| `cohortReportSettings` | CohortReportSettings | Optional: `accumulate` (boolean). |

**Cohort:** `{ name, dimension: "firstSessionDate", dateRange }`
**CohortsRange:** `{ granularity: DAILY/WEEKLY/MONTHLY, startOffset, endOffset }`

> Cohort weeks run Sunday–Saturday.

### Response Types

**Row:** `{ dimensionValues: DimensionValue[], metricValues: MetricValue[] }`
**DimensionValue:** `{ value: string }`
**MetricValue:** `{ value: string }` — interpret per MetricHeader.type

**MetricType enum:** `TYPE_INTEGER`, `TYPE_FLOAT`, `TYPE_SECONDS`,
`TYPE_MILLISECONDS`, `TYPE_MINUTES`, `TYPE_HOURS`, `TYPE_STANDARD`,
`TYPE_CURRENCY`, `TYPE_FEET`, `TYPE_MILES`, `TYPE_METERS`, `TYPE_KILOMETERS`

### ResponseMetaData

| Field | Type | Description |
|-------|------|-------------|
| `dataLossFromOtherRow` | boolean | High cardinality → "(other)" row. |
| `samplingMetadatas` | SamplingMetadata[] | `samplesReadCount` / `samplingSpaceSize`. |
| `currencyCode` | string | ISO 4217 currency used. |
| `timeZone` | string | IANA timezone. |
| `emptyReason` | string | Why report is empty (if applicable). |
| `subjectToThresholding` | boolean | Data below minimum thresholds excluded. |

### PropertyQuota

| Field | Description | Standard | GA 360 |
|-------|-------------|----------|--------|
| `tokensPerDay` | Daily token budget | 200,000 | 2,000,000 |
| `tokensPerHour` | Hourly token budget | 40,000 | 400,000 |
| `tokensPerProjectPerHour` | Per-project hourly | 14,000 | 140,000 |
| `concurrentRequests` | Simultaneous requests | 10 | 50 |
| `serverErrorsPerProjectPerHour` | Error budget | 10 | 50 |
| `potentiallyThresholdedRequestsPerHour` | Demographic queries | 120 | 120 |

Each field has: `{ consumed: integer, remaining: integer }`

### DimensionMetadata / MetricMetadata

| Field | Type | Description |
|-------|------|-------------|
| `apiName` | string | Identifier for use in queries. |
| `uiName` | string | Display name in GA UI. |
| `description` | string | What it measures/represents. |
| `deprecatedApiNames` | string[] | Former names (still work temporarily). |
| `customDefinition` | boolean | True for property-specific custom fields. |
| `category` | string | Display category name. |

MetricMetadata additionally has: `type` (MetricType), `expression` (for
derived), `blockedReasons` (`NO_REVENUE_METRICS`, `NO_COST_METRICS`).

---

## 6. Dimensions & Metrics Reference

### Dimension Categories (150+ fields)

**User & Session:**
`newVsReturning`, `firstSessionDate`, `audienceId`, `audienceName`

**Geographic:**
`country`, `countryId`, `city`, `cityId`, `continent`, `continentId`,
`region`, `subContinent`, `metro`

**Device & Platform:**
`deviceCategory` (Desktop/Tablet/Mobile), `deviceModel`, `platform`,
`mobileDeviceBranding`, `mobileDeviceMarketingName`, `operatingSystem`,
`operatingSystemVersion`, `screenResolution`

**Browser & Language:**
`browser`, `browserVersion`, `language`, `languageCode`

**Time:**
`date` (YYYYMMDD), `dateHour`, `dateHourMinute`, `day`, `dayOfWeek` (0–6),
`dayOfWeekName`, `hour`, `minute`, `month`, `week`, `year`, `isoWeek`,
`isoYear`, `nthDay`, `nthHour`, `nthMonth`, `nthWeek`, `nthYear`

**Page & Content:**
`pagePath`, `pageLocation` (full URL), `pageTitle`, `hostName`,
`landingPage`, `landingPagePlusQueryString`, `pagePathPlusQueryString`,
`pageReferrer`, `fullPageUrl`, `contentGroup`, `contentId`, `contentType`,
`unifiedPagePathScreen`, `unifiedScreenName`

**Events & Interactions:**
`eventName`, `isKeyEvent`, `method`, `outbound`, `linkClasses`, `linkDomain`,
`linkId`, `linkText`, `linkUrl`, `percentScrolled`, `searchTerm`,
`fileExtension`, `fileName`

**Marketing & Attribution:**
`campaignId`, `campaignName`, `defaultChannelGroup`, `medium`, `source`,
`sourceMedium`, `sourcePlatform`, `primaryChannelGroup`
— All with `session*` and `firstUser*` prefix variants

**Manual UTM (17 fields):**
`manualCampaignName` (utm_campaign), `manualSource` (utm_source),
`manualMedium` (utm_medium), `manualTerm` (utm_term),
`manualAdContent` (utm_content), `manualCampaignId` (utm_id),
`manualSourcePlatform`, `manualCreativeFormat`, `manualMarketingTactic`
— All with `session*` prefix variants

**Google Ads (11 fields):**
`googleAdsAccountName`, `googleAdsAdGroupId/Name`,
`googleAdsCampaignId/Name/Type`, `googleAdsCreativeId`,
`googleAdsKeyword`, `googleAdsQuery`

**E-commerce (23 fields):**
`itemName`, `itemId`, `itemBrand`, `itemCategory`–`itemCategory5`,
`itemVariant`, `itemListId/Name/Position`, `transactionId`,
`orderCoupon`, `shippingTier`, `currencyCode`

**Cohort:**
`cohort`, `cohortNthDay`, `cohortNthMonth`, `cohortNthWeek`

**App / AdMob:**
`adFormat`, `adSourceName`, `adUnitName`, `appVersion`, `streamId`, `streamName`

### Metric Categories (80+ fields)

**User:**
`activeUsers`, `newUsers`, `returningUsers`, `totalUsers`,
`dauPerMau`, `dauPerWau`, `wauPerMau`,
`active1DayUsers`, `active7DayUsers`, `active28DayUsers`

**Session:**
`sessions`, `averageSessionDuration`, `sessionsPerUser`,
`bounceRate`, `engagedSessions`, `engagementRate`

**Events:**
`eventCount`, `eventCountPerUser`, `eventsPerSession`,
`keyEvents`, `keyEventRate`

**Engagement:**
`screenPageViews`, `screenPageViewsPerSession`, `screenPageViewsPerUser`,
`userEngagementDuration`

**Revenue & E-commerce:**
`totalRevenue`, `purchaseRevenue`, `purchaseRevenuePerUser`,
`transactions`, `transactionsPerPurchaser`, `averagePurchaseRevenue`,
`purchasers`, `firstTimePurchasers`, `itemRevenue`,
`itemsAddedToCart`, `itemsCheckedOut`, `itemsPurchased`, `itemsViewed`,
`addToCartEvents`, `checkoutEvents`, `ecommercePurchases`,
`refundAmount`, `shippingAmount`, `taxAmount`

**Predictive:**
`purchaseProbability`, `churnProbability`, `predictedRevenue`

**Cohort:**
`cohortActiveUsers`, `cohortTotalUsers`

### Custom Dimensions & Metrics

Three scopes:
- `customEvent:{param}` — event-scoped
- `customUser:{param}` — user-scoped
- `customItem:{param}` — item-scoped

Only `customUser:*` is available in Realtime reports.
Call `getMetadata` with a real property ID to enumerate custom fields.

### Deprecated / Renamed Fields

| Old Name | New Name |
|----------|----------|
| `conversions` | `keyEvents` |
| `conversionRate` | `keyEventRate` |
| `sessionConversionRate` | `sessionKeyEventRate` |
| `userConversionRate` | `userKeyEventRate` |

### Realtime-Specific Schema

Only 16 dimensions and 4 metrics available:

**Dimensions:** `city`, `country`, `continent`, `deviceCategory`, `eventName`,
`minutesAgo`, `platform`, `streamId`, `streamName`, `appVersion`,
`audienceId`, `audienceName`, `unifiedScreenName`, `customUser:*`

**Metrics:** `activeUsers`, `eventCount`, `keyEvents`, `screenPageViews`

Event-scoped custom dimensions/metrics NOT supported in realtime.

### Compatibility Rules

- Item-scoped dimensions are incompatible with non-item metrics
- Cohort dimensions require cohort metrics
- Use `checkCompatibility` before programmatically constructing novel combinations
- `checkCompatibility` applies to Core reports only (NOT Realtime)

---

## 7. Guides & Patterns

### Basic Reports

Every `runReport` requires: property ID, at least one metric, a date range.

```javascript
const [response] = await client.runReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
  dimensions: [{ name: 'country' }],
  metrics: [{ name: 'activeUsers' }],
});

response.rows.forEach((row) => {
  console.log(row.dimensionValues[0].value, row.metricValues[0].value);
});
```

**Date formats:** `YYYY-MM-DD`, `today`, `yesterday`, `NdaysAgo` (e.g. `7daysAgo`)

**Pagination:** Use `offset` + `limit`. `rowCount` gives total rows.

### Filters

**Single condition:**
```json
"dimensionFilter": {
  "filter": {
    "fieldName": "eventName",
    "stringFilter": { "value": "first_open" }
  }
}
```

**AND logic:**
```json
"dimensionFilter": {
  "andGroup": {
    "expressions": [
      { "filter": { "fieldName": "browser", "stringFilter": { "value": "Chrome" } } },
      { "filter": { "fieldName": "countryId", "stringFilter": { "value": "US" } } }
    ]
  }
}
```

**NOT (exclusion):**
```json
"dimensionFilter": {
  "notExpression": {
    "filter": { "fieldName": "pageTitle", "stringFilter": { "value": "My Homepage" } }
  }
}
```

**CRITICAL:** Never mix dimension fields into `metricFilter` or metric fields
into `dimensionFilter`.

### Custom Dimensions

1. Discover via Metadata API: `GET properties/{id}/metadata`
2. Use in queries: `{ "name": "customEvent:achievement_id" }`
3. Derived metrics: `{ "name": "averageCustomEvent:credits_spent" }`
4. Key event rates: `{ "name": "sessionKeyEventRate:add_to_cart" }`

### Cohort Reports

```json
{
  "dimensions": [{ "name": "cohort" }, { "name": "cohortNthDay" }],
  "metrics": [{ "name": "cohortActiveUsers" }],
  "cohortSpec": {
    "cohorts": [{
      "dimension": "firstSessionDate",
      "dateRange": { "startDate": "2024-12-01", "endDate": "2024-12-01" }
    }],
    "cohortsRange": { "endOffset": 5, "granularity": "DAILY" }
  }
}
```

Use `DAILY` with `cohortNthDay`, `WEEKLY` with `cohortNthWeek`.
Retention formula: `cohortActiveUsers/cohortTotalUsers`.

### Comparisons

Side-by-side analysis of data subsets in a single report:

```json
{
  "comparisons": [
    { "name": "Mobile", "dimensionFilter": {
      "filter": { "fieldName": "platform", "inListFilter": { "values": ["iOS", "Android"] } }
    }},
    { "name": "Web", "dimensionFilter": {
      "filter": { "fieldName": "platform", "stringFilter": { "matchType": "EXACT", "value": "web" } }
    }}
  ],
  "dimensions": [{ "name": "country" }],
  "metrics": [{ "name": "activeUsers" }]
}
```

The `comparison` dimension is auto-prepended to all response rows.

### Realtime Reports (Node.js)

```javascript
const [response] = await client.runRealtimeReport({
  property: `properties/${propertyId}`,
  dimensions: [{ name: 'country' }],
  metrics: [{ name: 'activeUsers' }],
});
```

With minute ranges:
```json
{
  "metrics": [{ "name": "activeUsers" }],
  "minuteRanges": [
    { "name": "0-4 min ago", "startMinutesAgo": 4 },
    { "name": "25-29 min ago", "startMinutesAgo": 29, "endMinutesAgo": 25 }
  ]
}
```

### Pivot Reports (Node.js)

```javascript
const [response] = await client.runPivotReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-30' }],
  pivots: [
    { fieldNames: ['country'], limit: 250,
      orderBys: [{ dimension: { dimensionName: 'country' } }] },
    { fieldNames: ['browser'], offset: 3, limit: 3,
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] },
  ],
  metrics: [{ name: 'sessions' }],
  dimensions: [{ name: 'country' }, { name: 'browser' }],
});
```

Each pivot response row = one cell. Product of all `limit` values ≤ 100,000.

### Funnel Reports (v1alpha)

```javascript
const {AlphaAnalyticsDataClient} = require('@google-analytics/data');
const client = new AlphaAnalyticsDataClient();

const [response] = await client.runFunnelReport({
  property: `properties/${propertyId}`,
  dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
  funnelBreakdown: { breakdownDimension: { name: 'deviceCategory' } },
  funnel: {
    steps: [
      { name: 'First visit', filterExpression: {
        funnelEventFilter: { eventName: 'first_visit' }
      }},
      { name: 'Page view', filterExpression: {
        funnelEventFilter: { eventName: 'page_view' }
      }},
      { name: 'Purchase', filterExpression: {
        funnelEventFilter: { eventName: 'purchase' }
      }},
    ]
  }
});
```

---

## 8. Quotas & Limits

### Quota Categories

| Category | Methods |
|----------|---------|
| Core | runReport, runPivotReport, batch*, getMetadata, checkCompatibility, audienceExports |
| Realtime | runRealtimeReport |
| Funnel | runFunnelReport |

### Standard Property Quotas

| Quota | Per Day | Per Hour | Per Project/Hour |
|-------|---------|----------|------------------|
| Core tokens | 200,000 | 40,000 | 14,000 |
| Realtime tokens | 200,000 | 40,000 | 14,000 |
| Funnel tokens | 200,000 | 40,000 | 14,000 |
| Concurrent requests | — | — | 10 |
| Server errors | — | — | 10/hr |

### Analytics 360 Quotas (10x)

| Quota | Per Day | Per Hour | Per Project/Hour |
|-------|---------|----------|------------------|
| Core tokens | 2,000,000 | 400,000 | 140,000 |
| Concurrent requests | — | — | 50 |
| Server errors | — | — | 50/hr |

### Additional Limits

- **Thresholded requests:** 120/hour for demographic dimensions
  (`userAgeBracket`, `userGender`, `brandingInterest`, `audienceId`, `audienceName`)
- **Quota refresh:** Daily quotas reset at midnight PST; hourly quotas within an hour

### Token Consumption Factors

Token cost increases with: higher row count, more columns (dimensions + metrics),
complex filters, longer date ranges.

### Monitoring Quota

Include `"returnPropertyQuota": true` in any request body.

---

## 9. Error Reference

### OAuth / Auth Errors

| Error | Meaning | Resolution |
|-------|---------|------------|
| `unauthorized_client` | Domain-wide delegation missing | Add to Admin Console; allow 24 hrs |
| `invalid_grant` | JWT invalid / clock skew / expired | Verify clock; `exp` ≤ 65 min after `iat` |
| `invalid_grant` | Bad JWT signature | Verify private key matches key ID |
| `invalid_scope` | Empty or invalid scope | Check scope URLs |
| `disabled_client` | SA key disabled/deleted | Re-enable or create new key |
| `admin_policy_enforced` | Org admin restricted access | Admin must grant access |

### API Errors

| HTTP | Meaning | Resolution |
|------|---------|------------|
| 400 | Bad request (invalid dims/metrics/dates) | Check field names against API schema |
| 403 | SA lacks GA4 property access | Add SA email to GA4 property as Viewer |
| 429 | Quota exceeded | Back off; check `returnPropertyQuota`; upgrade to 360 |
| 429 | Concurrent request limit | Queue requests; max 10 per project |

### Common Mistakes

1. Using UA tracking ID (`UA-123-1`) instead of numeric GA4 property ID
2. Not enabling the Google Analytics Data API in Cloud Console
3. Not adding SA email to GA4 property in Analytics UI (Cloud IAM alone is NOT enough)
4. `private_key` losing newlines in env vars — always `JSON.parse()` the full JSON string
5. Using `keyFilename` on serverless platforms (no filesystem)

---

## 10. Environment Variables

| Variable | Format | Purpose |
|----------|--------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | File path | Path to SA JSON key; used by ADC |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON string | Full SA JSON as stringified env var |
| `GA4_SERVICE_ACCOUNT_KEY` | Base64 string | Base64-encoded SA JSON |
| `GA4_PROPERTY_ID` | Numeric string | GA4 property ID (no `properties/` prefix) |

---

## 11. Vercel / Serverless Notes

- **Do NOT use `keyFilename`** — no filesystem in serverless functions
- Use `credentials` option with an inline object parsed from env var
- Store full SA JSON as `GOOGLE_SERVICE_ACCOUNT_JSON` or base64 as
  `GA4_SERVICE_ACCOUNT_KEY` in Vercel env vars
- Vercel env vars handle JSON strings correctly if entered as single-line

**Recommended pattern:**
```javascript
// Base64 pattern (matches existing .env convention)
const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY;
const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
const client = new BetaAnalyticsDataClient({ credentials });
```

**Private key newlines:** Always `JSON.parse()` the full JSON string rather
than manually extracting `private_key` — env var storage can corrupt `\n`.

---

## 12. Working Examples (Node.js)

### Complete Serverless Example

```javascript
const {BetaAnalyticsDataClient} = require('@google-analytics/data');

// Initialize — base64 credentials from env var (Vercel-safe)
const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY;
const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
const client = new BetaAnalyticsDataClient({ credentials });

const propertyId = process.env.GA4_PROPERTY_ID;

async function getWeeklyTraffic() {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'country' },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'bounceRate' },
      { name: 'screenPageViews' },
    ],
    orderBys: [
      { metric: { metricName: 'activeUsers' }, desc: true }
    ],
    limit: 100,
    returnPropertyQuota: true,
  });

  console.log('Quota:', response.propertyQuota);
  console.log(`Total rows: ${response.rowCount}`);

  response.rows?.forEach((row) => {
    const dims = row.dimensionValues.map(d => d.value).join(' | ');
    const mets = row.metricValues.map(m => m.value).join(' | ');
    console.log(`${dims} — ${mets}`);
  });

  return response;
}
```

### Batch Reports Example

```javascript
async function getBatchReports() {
  const [response] = await client.batchRunReports({
    property: `properties/${propertyId}`,
    requests: [
      {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        limit: 10,
      },
      {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 10,
      },
    ],
  });

  // response.reports[0] = page views by path
  // response.reports[1] = users by country
  return response.reports;
}
```

### REST cURL Example

```bash
export PROPERTY_ID=YOUR_GA4_PROPERTY_ID
export ACCESS_TOKEN=$(gcloud auth application-default print-access-token)

curl -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}],
    "dimensions": [{"name": "country"}],
    "metrics": [{"name": "activeUsers"}],
    "returnPropertyQuota": true
  }' \
  "https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport"
```

### Sample Response

```json
{
  "dimensionHeaders": [{"name": "country"}],
  "metricHeaders": [{"name": "activeUsers", "type": "TYPE_INTEGER"}],
  "rows": [
    {
      "dimensionValues": [{"value": "United States"}],
      "metricValues": [{"value": "3242"}]
    },
    {
      "dimensionValues": [{"value": "India"}],
      "metricValues": [{"value": "805"}]
    }
  ],
  "rowCount": 2,
  "metadata": {
    "currencyCode": "USD",
    "timeZone": "America/Los_Angeles"
  },
  "kind": "analyticsData#runReport"
}
```

---

## Service Account JSON Key File Format

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id-hex-string",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-sa@your-project.iam.gserviceaccount.com",
  "client_id": "numeric-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

*Sources: developers.google.com/analytics/devguides/reporting/data/v1,
developers.google.com/identity/protocols/oauth2/service-account,
cloud.google.com/iam/docs, npmjs.com/package/@google-analytics/data,
support.google.com/analytics/answer/9143382*
