# Google Analytics Data API v1beta — Complete REST Reference

Scraped: 2026-03-08
Source: https://developers.google.com/analytics/devguides/reporting/data/v1/rest

---

## Overview

**Base URL:** `https://analyticsdata.googleapis.com`

**Current stable version:** v1beta
**Experimental version:** v1alpha

**Discovery documents:**
- `https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta`
- `https://analyticsdata.googleapis.com/$discovery/rest?version=v1alpha`

### Authentication

All requests require OAuth 2.0. One of the following scopes is required for all endpoints unless otherwise noted:

- `https://www.googleapis.com/auth/analytics.readonly` — read-only access
- `https://www.googleapis.com/auth/analytics` — full access

### v1beta Resources

**properties** methods:
- `runReport` — customized event data reports
- `runPivotReport` — pivot-formatted analytics data
- `runRealtimeReport` — real-time event data (last 30/60 min)
- `batchRunReports` — up to 5 reports in a single call
- `batchRunPivotReports` — up to 5 pivot reports in a single call
- `getMetadata` — available dimensions and metrics for a property
- `checkCompatibility` — validate dimension/metric combinations before querying

**properties.audienceExports** (v1beta):
- `create`, `get`, `list`, `query`

**properties** (v1alpha only):
- `runFunnelReport`, `getPropertyQuotasSnapshot`
- `audienceLists.*`, `recurringAudienceLists.*`, `reportTasks.*`

---

## Endpoint Reference

---

### runReport

**HTTP Method:** POST
**URL:** `https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:runReport`

Returns customized event data reports derived from Google Analytics tracking.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | GA property identifier. Format: `properties/1234`. Must be consistent within batch requests. |

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | array[Dimension] | No | Dimensions to include. Max 9. |
| `metrics` | array[Metric] | No | Metrics to include. Max 10. |
| `dateRanges` | array[DateRange] | No | Date ranges for data retrieval. Up to 4. Not used in cohort requests. |
| `dimensionFilter` | FilterExpression | No | Filters applied to dimension values only. |
| `metricFilter` | FilterExpression | No | Post-aggregation filter (equivalent to SQL HAVING clause). Metrics only — no dimensions. |
| `offset` | int64 | No | Row offset for pagination. First row = 0. Default: 0. |
| `limit` | int64 | No | Rows to return. Default: 10,000. Max: 250,000. |
| `metricAggregations` | array[MetricAggregation] | No | Aggregation types to compute. Results appear in rows with reserved dimension values. |
| `orderBys` | array[OrderBy] | No | Sort order for response rows. |
| `currencyCode` | string | No | ISO 4217 currency code (e.g. "USD", "EUR"). Uses property default if omitted. |
| `cohortSpec` | CohortSpec | No | Cohort group configuration. Requires `cohort` dimension when specified. |
| `keepEmptyRows` | boolean | No | If false (default), rows with all metric values = 0 are omitted. If true, they are included. |
| `returnPropertyQuota` | boolean | No | If true, includes current property quota state in response. |
| `comparisons` | array[Comparison] | No | Comparison configurations. Requires both this field and a comparisons dimension for results. |

#### Response Body Fields (RunReportResponse)

| Field | Type | Description |
|-------|------|-------------|
| `dimensionHeaders` | array[DimensionHeader] | Column headers for dimensions. Count and order matches `rows[].dimensionValues`. |
| `metricHeaders` | array[MetricHeader] | Column headers for metrics. Count and order matches `rows[].metricValues`. |
| `rows` | array[Row] | Report data rows containing dimension and metric values. |
| `totals` | array[Row] | Totaled metric values (populated when TOTAL requested in metricAggregations). |
| `maximums` | array[Row] | Maximum metric values (populated when MAXIMUM requested). |
| `minimums` | array[Row] | Minimum metric values (populated when MINIMUM requested). |
| `rowCount` | integer | Total number of rows in the full result set, independent of pagination. |
| `metadata` | ResponseMetaData | Report metadata (sampling, schema restrictions, currency, timezone, etc.). |
| `propertyQuota` | PropertyQuota | Current quota state for this property including this request's consumption. |
| `kind` | string | Always `"analyticsData#runReport"`. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Reports contain statistics from Google Analytics tracking code data.
- Multiple date ranges produce a zero-based date range index per row. Overlapping ranges include data for both.
- Metrics cannot appear in `dimensionFilter`; dimensions cannot appear in `metricFilter`.
- Fewer rows may be returned than `limit` if dimension cardinality is lower.

---

### batchRunReports

**HTTP Method:** POST
**URL:** `https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:batchRunReports`

Returns multiple reports in a single request. Max 5 reports per batch.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | GA property identifier. Format: `properties/1234`. All reports must target the same property. |

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requests` | array[RunReportRequest] | Yes | Individual report requests. Max 5 per batch. |

Each `RunReportRequest` in the array has the same fields as the `runReport` request body above. The `property` field within each request should be omitted or must match the batch-level property.

#### Response Body Fields

| Field | Type | Description |
|-------|------|-------------|
| `reports` | array[RunReportResponse] | Individual responses in same order as requests. Each has the same schema as runReport response. |
| `kind` | string | Always `"analyticsData#batchRunReports"`. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Maximum 5 requests per batch call.
- All requests must reference the same Google Analytics property.
- Pagination supported per-request via `offset` and `limit`.

---

### runPivotReport

**HTTP Method:** POST
**URL:** `https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:runPivotReport`

Returns a customized pivot report. Pivot reports are more advanced and expressive formats than regular reports.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | GA property identifier. Format: `properties/1234`. |

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | array[Dimension] | No | All requested dimensions. Every dimension must be used in a dimensionExpression, dimensionFilter, pivot, or orderBy. Max 9. |
| `metrics` | array[Metric] | Yes | At least one metric required. All metrics must be used in metric_expression, metricFilter, or orderBys. Max 10. |
| `dateRanges` | array[DateRange] | No | Date ranges for data. Multiple ranges supported. Not used in cohort requests. The special "dateRange" dimension is available in pivots for multi-range comparisons. |
| `pivots` | array[Pivot] | No | Visual format specification. The union of `fieldNames` across all pivots must be a subset of declared dimensions. No two pivots can share a dimension. Dimensions only visible if included in a pivot. |
| `dimensionFilter` | FilterExpression | No | Filters dimensions only; metrics not allowed. |
| `metricFilter` | FilterExpression | No | Post-aggregation filter (SQL HAVING equivalent). Metrics only; dimensions not allowed. |
| `currencyCode` | string | No | ISO 4217 currency code. Uses property default if omitted. |
| `cohortSpec` | CohortSpec | No | Cohort group configuration. Requires `cohort` dimension. |
| `keepEmptyRows` | boolean | No | If false (default), rows with all metrics = 0 omitted. If true, retained (unless separately filtered). |
| `returnPropertyQuota` | boolean | No | If true, includes PropertyQuota in response. |
| `comparisons` | array[Comparison] | No | Comparison configurations. Requires both this field and the comparisons dimension. |

#### Response Body Fields (RunPivotReportResponse)

| Field | Type | Description |
|-------|------|-------------|
| `pivotHeaders` | array[PivotHeader] | One PivotHeader per pivot in the request. Summarizes columns/rows created by each pivot. |
| `dimensionHeaders` | array[DimensionHeader] | Column headers for dimensions. |
| `metricHeaders` | array[MetricHeader] | Column headers for metrics. |
| `rows` | array[Row] | Rows of dimension and metric values. |
| `aggregates` | array[Row] | Aggregated metric values (totals, minimums, maximums). |
| `metadata` | ResponseMetaData | Report metadata. |
| `propertyQuota` | PropertyQuota | Current quota state including this request. |
| `kind` | string | Always `"analyticsData#runPivotReport"`. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Dimensions are only visible in responses if they are included in a pivot's `fieldNames`.
- Multiple pivots enable deeper data analysis.
- The product of all pivot `limit` values must not exceed 250,000.

---

### batchRunPivotReports

**HTTP Method:** POST
**URL:** `https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:batchRunPivotReports`

Returns multiple pivot reports in a single request. Max 5 pivot reports per batch.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | GA property identifier. Format: `properties/1234`. All pivot reports must target this property. |

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requests` | array[RunPivotReportRequest] | Yes | Individual pivot report requests. Max 5 per batch. |

Each `RunPivotReportRequest` in the array has the same fields as the `runPivotReport` request body above. The `property` field within each request should be omitted or must match the batch-level property.

#### Response Body Fields

| Field | Type | Description |
|-------|------|-------------|
| `pivotReports` | array[RunPivotReportResponse] | Individual pivot report responses in same order as requests. |
| `kind` | string | Always `"analyticsData#batchRunPivotReports"`. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Maximum 5 requests per batch.
- All requests must target the same property.
- No two pivots within any single request can share a dimension.

---

### runRealtimeReport

**HTTP Method:** POST
**URL:** `https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:runRealtimeReport`

Returns a report of real-time event data. Events appear in realtime reports seconds after being sent to Google Analytics.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | GA property identifier. Format: `properties/1234`. |

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | array[Dimension] | No | Dimensions to display in the report. |
| `metrics` | array[Metric] | No | Metrics to display in the report. |
| `dimensionFilter` | FilterExpression | No | Filter for dimensions only. |
| `metricFilter` | FilterExpression | No | Post-aggregation metric filter (SQL HAVING equivalent). |
| `limit` | int64 | No | Rows to return. Default: 10,000. Max: 250,000. Must be positive. |
| `metricAggregations` | array[MetricAggregation] | No | Aggregations to compute. Results use reserved dimension values (e.g., "RESERVED_TOTAL"). |
| `orderBys` | array[OrderBy] | No | Row sort order. |
| `returnPropertyQuota` | boolean | No | If true, includes realtime quota state in response. |
| `minuteRanges` | array[MinuteRange] | No | Minute ranges for data. Default: last 30 minutes (one range). Max: 2 ranges. |

#### MinuteRange Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Identifier for this range. Appears as `dateRange` dimension value in response. Cannot start with `"date_range_"` or `"RESERVED_"`. Auto-named `date_range_0`, `date_range_1` if omitted. |
| `startMinutesAgo` | integer | No | Inclusive start, in minutes before now. Default: 29. Standard properties: max 29. GA 360: max 59. Must be >= `endMinutesAgo`. |
| `endMinutesAgo` | integer | No | Inclusive end, in minutes before now. Default: 0. Standard properties: max 29. GA 360: max 59. |

#### Response Body Fields (RunRealtimeReportResponse)

| Field | Type | Description |
|-------|------|-------------|
| `dimensionHeaders` | array[DimensionHeader] | Column headers for dimensions. |
| `metricHeaders` | array[MetricHeader] | Column headers for metrics. |
| `rows` | array[Row] | Report data rows. |
| `totals` | array[Row] | Totaled metric values (if requested). |
| `maximums` | array[Row] | Maximum metric values (if requested). |
| `minimums` | array[Row] | Minimum metric values (if requested). |
| `rowCount` | integer | Total rows in result set, independent of pagination. |
| `propertyQuota` | PropertyQuota | Realtime quota state including this request. |
| `kind` | string | Always `"analyticsData#runRealtimeReport"`. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Realtime data window: last 30 minutes for standard properties; last 60 minutes for GA 360.
- `offset` pagination is NOT supported (no offset field); use `limit` only.
- Fewer rows may be returned if fewer dimension value combinations exist than `limit`.

---

### getMetadata

**HTTP Method:** GET
**URL:** `https://analyticsdata.googleapis.com/v1beta/{name=properties/*/metadata}`

Returns available dimensions, metrics, and comparisons for a property.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Format: `properties/{propertyId}/metadata`. Use `properties/0/metadata` for universal metadata across all properties (excludes custom dimensions/metrics). |

#### Request Body

None — GET request with no body.

#### Response Body Fields (Metadata)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Resource name of the metadata. |
| `dimensions` | array[DimensionMetadata] | All dimensions available for this property. |
| `metrics` | array[MetricMetadata] | All metrics available for this property. |
| `comparisons` | array[ComparisonMetadata] | Available comparison configurations. |

##### ComparisonMetadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `apiName` | string | Comparison resource name. Useable in `Comparison.comparison` field. Format: `comparisons/1234`. |
| `uiName` | string | Display name within the GA interface. |
| `description` | string | Explanation of the comparison. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Returns both custom and universal dimensions/metrics.
- Custom metrics follow naming pattern `customEvent:{parameter_name}`.
- Use property ID `0` for generic metadata not tied to a specific property.

---

### checkCompatibility

**HTTP Method:** POST
**URL:** `https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:checkCompatibility`

Lists dimensions and metrics that can be added to a report request while maintaining compatibility. Reports fail if they request incompatible dimensions/metrics.

**Important:** This checks compatibility for Core reports (runReport, runPivotReport). It does NOT apply to Realtime reports, which have different compatibility rules.

#### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `property` | string | Yes | GA property identifier. Format: `properties/1234`. |

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dimensions` | array[Dimension] | No | Dimensions from the intended runReport request. |
| `metrics` | array[Metric] | No | Metrics from the intended runReport request. |
| `dimensionFilter` | FilterExpression | No | Dimension filter from the intended runReport request. |
| `metricFilter` | FilterExpression | No | Metric filter from the intended runReport request. |
| `compatibilityFilter` | enum(Compatibility) | No | Filter response to only show dimensions/metrics of this compatibility. E.g., `"COMPATIBLE"`. |

#### Response Body Fields

| Field | Type | Description |
|-------|------|-------------|
| `dimensionCompatibilities` | array[DimensionCompatibility] | Compatibility status for each dimension. |
| `metricCompatibilities` | array[MetricCompatibility] | Compatibility status for each metric. |

##### DimensionCompatibility Fields

| Field | Type | Description |
|-------|------|-------------|
| `dimensionMetadata` | DimensionMetadata | Metadata including `apiName` and other dimension info. |
| `compatibility` | enum(Compatibility) | `COMPATIBLE` or `INCOMPATIBLE`. |

##### MetricCompatibility Fields

| Field | Type | Description |
|-------|------|-------------|
| `metricMetadata` | MetricMetadata | Metadata including `apiName` and other metric info. |
| `compatibility` | enum(Compatibility) | `COMPATIBLE` or `INCOMPATIBLE`. |

#### OAuth Scopes

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/analytics`

#### Notes

- Use this before building a query to avoid runtime failures from incompatible field combinations.
- Does NOT apply to Realtime reports.

---

## Shared Type Definitions

---

### Dimension

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Dimension identifier. Must match `^[a-zA-Z0-9_]$`. Required unless `dimensionExpression` provides the identifier. |
| `dimensionExpression` | DimensionExpression | No | Formula to derive a dimension from existing dimensions (e.g., lowercase, uppercase, concatenate). |

#### DimensionExpression (union — use exactly one)

| Field | Type | Description |
|-------|------|-------------|
| `lowerCase` | CaseExpression | Converts dimension value to lowercase. |
| `upperCase` | CaseExpression | Converts dimension value to uppercase. |
| `concatenate` | ConcatenateExpression | Combines multiple dimension values with a delimiter. |

#### CaseExpression

| Field | Type | Description |
|-------|------|-------------|
| `dimensionName` | string | Name of the dimension to transform. Must be declared in the request's `dimensions`. |

#### ConcatenateExpression

| Field | Type | Description |
|-------|------|-------------|
| `dimensionNames` | array[string] | Dimension names to concatenate. Must be declared in the request. |
| `delimiter` | string | Separator string placed between values. |

---

### Metric

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Metric identifier (e.g., `eventCount`, `activeUsers`). Must match `^[a-zA-Z0-9_]$`. Customizable when `expression` is set. |
| `expression` | string | No | Math formula for derived metrics (e.g., `"eventCount/totalUsers"`). |
| `invisible` | boolean | No | If true, metric is excluded from response columns but can still be used in filters/sorting/expressions. |

---

### DateRange

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startDate` | string | Yes | Inclusive start date. Format: `YYYY-MM-DD` or relative: `NdaysAgo`, `yesterday`, `today`. Interpreted in property's reporting timezone. Cannot be after `endDate`. |
| `endDate` | string | Yes | Inclusive end date. Same format as `startDate`. Cannot be before `startDate`. |
| `name` | string | No | Identifier for this range. Used as the `dateRange` dimension value in multi-range reports. Cannot start with `"date_range_"` or `"RESERVED_"`. Auto-named `date_range_0`, `date_range_1`, etc. if omitted. |

Requests may include up to 4 date ranges.

---

### FilterExpression

Union — use exactly one of the following:

| Field | Type | Description |
|-------|------|-------------|
| `andGroup` | FilterExpressionList | All expressions in the list must be true (logical AND). |
| `orGroup` | FilterExpressionList | At least one expression must be true (logical OR). |
| `notExpression` | FilterExpression | Negation of the contained expression (logical NOT). |
| `filter` | Filter | A single primitive filter condition. |

#### FilterExpressionList

| Field | Type | Description |
|-------|------|-------------|
| `expressions` | array[FilterExpression] | List of filter expressions to combine. |

#### Filter

| Field | Type | Description |
|-------|------|-------------|
| `fieldName` | string | The dimension or metric name to filter on. |
| One of: `stringFilter`, `inListFilter`, `numericFilter`, `betweenFilter` | — | Filter type (union — use exactly one). |

#### StringFilter

| Field | Type | Description |
|-------|------|-------------|
| `matchType` | enum | `EXACT`, `BEGINS_WITH`, `ENDS_WITH`, `CONTAINS`, `FULL_REGEXP`, `PARTIAL_REGEXP` |
| `value` | string | String value to match against. |
| `caseSensitive` | boolean | If true, match is case-sensitive. |

#### InListFilter

| Field | Type | Description |
|-------|------|-------------|
| `values` | array[string] | List of possible values to match. |
| `caseSensitive` | boolean | If true, matching is case-sensitive. |

#### NumericFilter

| Field | Type | Description |
|-------|------|-------------|
| `operation` | enum | `EQUAL`, `LESS_THAN`, `LESS_THAN_OR_EQUAL`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL` |
| `value` | NumericValue | Comparison value. |

#### BetweenFilter

| Field | Type | Description |
|-------|------|-------------|
| `fromValue` | NumericValue | Lower bound (inclusive). |
| `toValue` | NumericValue | Upper bound (inclusive). |

#### NumericValue (union — use exactly one)

| Field | Type | Description |
|-------|------|-------------|
| `int64Value` | string | 64-bit integer as string. |
| `doubleValue` | number | Double-precision float. |

---

### MetricAggregation (enum)

| Value | Description |
|-------|-------------|
| `METRIC_AGGREGATION_UNSPECIFIED` | Default, unspecified. |
| `TOTAL` | Compute sum of metric across all rows. |
| `MINIMUM` | Compute minimum value of metric. |
| `MAXIMUM` | Compute maximum value of metric. |
| `COUNT` | Compute count of distinct metric values. |

---

### OrderBy

| Field | Type | Description |
|-------|------|-------------|
| `desc` | boolean | If true, sort descending. Default: ascending. |
| One of: `metric`, `dimension`, `pivot` | — | Sort type (union — use exactly one). |

#### MetricOrderBy

| Field | Type | Description |
|-------|------|-------------|
| `metricName` | string | A metric name from the request to sort by. |

#### DimensionOrderBy

| Field | Type | Description |
|-------|------|-------------|
| `dimensionName` | string | A dimension name from the request to sort by. |
| `orderType` | enum(OrderType) | How dimension values are compared for sorting. |

##### OrderType enum

| Value | Description |
|-------|-------------|
| `ORDER_TYPE_UNSPECIFIED` | Default. |
| `ALPHANUMERIC` | Alphanumeric sort by Unicode code point. |
| `CASE_INSENSITIVE_ALPHANUMERIC` | Case-insensitive alphanumeric sort by lowercase Unicode code point. |
| `NUMERIC` | Dimension values converted to numbers before sorting. |

#### PivotOrderBy

| Field | Type | Description |
|-------|------|-------------|
| `metricName` | string | Metric to sort by. |
| `pivotSelections` | array[PivotSelection] | Dimension name/value pairs identifying the pivot column to sort within. |

#### PivotSelection

| Field | Type | Description |
|-------|------|-------------|
| `dimensionName` | string | A dimension name from the request. |
| `dimensionValue` | string | Order by rows where this dimension has this value. |

---

### Pivot

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fieldNames` | array[string] | No | Dimension names to include as visible columns in pivot. Including `"dateRange"` creates a date range column. |
| `orderBys` | array[OrderBy] | No | Sort order. In the first pivot, determines Row and PivotDimensionHeader ordering. In subsequent pivots, determines only PivotDimensionHeader ordering. |
| `offset` | int64 | No | Start row offset. First row = 0. |
| `limit` | int64 | Yes | Number of unique dimension value combinations to return. Required. Commonly 10,000 for single-pivot requests. The product of all pivot `limit` values in a request must not exceed 250,000. |
| `metricAggregations` | array[MetricAggregation] | No | Aggregations to compute for this pivot's dimensions. |

---

### CohortSpec

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cohorts` | array[Cohort] | No | Cohort definitions. |
| `cohortsRange` | CohortsRange | No | Extended date range and tracking period for cohorts. |
| `cohortReportSettings` | CohortReportSettings | No | Optional report configuration. |

#### Cohort

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Cohort identifier. Used as the `cohort` dimension value in responses. Cannot start with `"cohort_"` or `"RESERVED_"`. |
| `dimension` | string | Yes | Grouping dimension. Currently only `"firstSessionDate"` is supported. |
| `dateRange` | DateRange | No | Window for users' first touch. Users whose first touch falls in this range are included. |

#### CohortsRange

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `granularity` | enum(Granularity) | Yes | Time unit for offset values. |
| `startOffset` | integer | No | Beginning offset. Typically 0 to include from acquisition forward. |
| `endOffset` | integer | Yes | Ending offset. Typically 5–10 for multi-period tracking. |

##### Granularity enum

| Value | Description |
|-------|-------------|
| `GRANULARITY_UNSPECIFIED` | Default, should not be used. |
| `DAILY` | Used with single-day cohort ranges. |
| `WEEKLY` | Used with week-long cohort ranges (Sunday–Saturday). |
| `MONTHLY` | Used with month-long cohort ranges. |

#### CohortReportSettings

| Field | Type | Description |
|-------|------|-------------|
| `accumulate` | boolean | If true, accumulates result from first touch day to end day (cumulative). |

---

### Comparison

| Field | Type | Description |
|-------|------|-------------|
| `dateRange` | DateRange | Comparison time period. |
| `dimensionFilter` | FilterExpression | Optional filter for the comparison. |

---

## Response Type Definitions

---

### DimensionHeader

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | The dimension's name. |

---

### MetricHeader

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | The metric's name. |
| `type` | enum(MetricType) | The metric's data type. |

---

### Row

| Field | Type | Description |
|-------|------|-------------|
| `dimensionValues` | array[DimensionValue] | Dimension values in the same order as `dimensionHeaders`. In PivotReports, only listed for dimensions included in a pivot. |
| `metricValues` | array[MetricValue] | Visible metric values in the same order as `metricHeaders`. |

---

### DimensionValue

| Field | Type | Description |
|-------|------|-------------|
| `value` | string | Dimension value as a string. |

---

### MetricValue

| Field | Type | Description |
|-------|------|-------------|
| `value` | string | Metric measurement as a string. Interpret according to the corresponding MetricHeader's `type`. |

---

### MetricType (enum)

| Value | Description |
|-------|-------------|
| `METRIC_TYPE_UNSPECIFIED` | Unspecified type. |
| `TYPE_INTEGER` | Integer type. |
| `TYPE_FLOAT` | Floating point type. |
| `TYPE_SECONDS` | Duration in seconds (special floating point). |
| `TYPE_MILLISECONDS` | Duration in milliseconds (special floating point). |
| `TYPE_MINUTES` | Duration in minutes (special floating point). |
| `TYPE_HOURS` | Duration in hours (special floating point). |
| `TYPE_STANDARD` | Custom metric of standard type (special floating point). |
| `TYPE_CURRENCY` | Amount of money (special floating point). |
| `TYPE_FEET` | Length in feet (special floating point). |
| `TYPE_MILES` | Length in miles (special floating point). |
| `TYPE_METERS` | Length in meters (special floating point). |
| `TYPE_KILOMETERS` | Length in kilometers (special floating point). |

---

### PivotHeader

| Field | Type | Description |
|-------|------|-------------|
| `pivotDimensionHeaders` | array[PivotDimensionHeader] | One entry per unique combination of pivot dimension values. Count matches the pivot's dimension cardinality. |
| `rowCount` | integer | Total rows for this pivot's fields, regardless of offset/limit. |

---

### PivotDimensionHeader

| Field | Type | Description |
|-------|------|-------------|
| `dimensionValues` | array[DimensionValue] | The dimension values for this pivot column group. |

---

### ResponseMetaData

| Field | Type | Description |
|-------|------|-------------|
| `dataLossFromOtherRow` | boolean | True if some dimension combinations were rolled into an "(other)" row due to high cardinality. |
| `samplingMetadatas` | array[SamplingMetadata] | If report is sampled, describes the percentage of events used. |
| `schemaRestrictionResponse` | SchemaRestrictionResponse | Details schema restrictions enforced when creating the report. |
| `currencyCode` | string | ISO 4217 currency code used for formatting currency metrics (e.g., `purchaseRevenue`). |
| `timeZone` | string | Property's current timezone from IANA Time Zone database. |
| `emptyReason` | string | Reason given if the report is empty. |
| `subjectToThresholding` | boolean | True if the report is subject to thresholding (data below minimum aggregation thresholds is excluded). |

#### SamplingMetadata

| Field | Type | Description |
|-------|------|-------------|
| `samplesReadCount` | int64 | Number of events read in the sampled report. |
| `samplingSpaceSize` | int64 | Total events available. Sampling rate = `samplesReadCount / samplingSpaceSize`. |

#### SchemaRestrictionResponse

| Field | Type | Description |
|-------|------|-------------|
| `activeMetricRestrictions` | array[ActiveMetricRestriction] | All restrictions actively enforced when creating the report. |

#### ActiveMetricRestriction

| Field | Type | Description |
|-------|------|-------------|
| `metricName` | string | Name of the restricted metric. |
| `restrictedMetricTypes` | array[enum(RestrictedMetricType)] | Reason(s) for restriction. |

##### RestrictedMetricType enum

| Value | Description |
|-------|-------------|
| `RESTRICTED_METRIC_TYPE_UNSPECIFIED` | Default, never appears in responses. |
| `COST_DATA` | Cost metrics such as `adCost`. |
| `REVENUE_DATA` | Revenue metrics such as `purchaseRevenue`. |

---

### PropertyQuota

Current quota state. All requests fail with Resource Exhausted if any quota is exhausted.

| Field | Type | Description |
|-------|------|-------------|
| `tokensPerDay` | QuotaStatus | Standard: 200,000/day. Analytics 360: 2,000,000/day. |
| `tokensPerHour` | QuotaStatus | Standard: 40,000/hour. Analytics 360: 400,000/hour. |
| `concurrentRequests` | QuotaStatus | Standard: 10 concurrent. Analytics 360: 50 concurrent. |
| `serverErrorsPerProjectPerHour` | QuotaStatus | Standard: 10 errors/hour. Analytics 360: 50 errors/hour. |
| `potentiallyThresholdedRequestsPerHour` | QuotaStatus | Maximum 120 requests/hour with thresholded dimensions. |
| `tokensPerProjectPerHour` | QuotaStatus | Standard: 14,000/hour. Analytics 360: 140,000/hour. (35% of per-property hourly limit.) |

#### QuotaStatus

| Field | Type | Description |
|-------|------|-------------|
| `consumed` | integer | Quota consumed by this request. |
| `remaining` | integer | Quota remaining after this request. |

---

### DimensionMetadata

| Field | Type | Description |
|-------|------|-------------|
| `apiName` | string | Dimension identifier. Useable in `Dimension.name`. Example: `eventName`. |
| `uiName` | string | Display name in the GA interface. Example: `Event name`. |
| `description` | string | How this dimension is used and calculated. |
| `deprecatedApiNames` | array[string] | Former names that still work temporarily. |
| `customDefinition` | boolean | True if this is a custom dimension specific to this property. |
| `category` | string | Display name of the category this dimension belongs to. |

---

### MetricMetadata

| Field | Type | Description |
|-------|------|-------------|
| `apiName` | string | Metric identifier. Useable in `Metric.name`. Example: `eventCount`. |
| `uiName` | string | Display name in the GA interface. Example: `Event count`. |
| `description` | string | How this metric is used and calculated. |
| `deprecatedApiNames` | array[string] | Former names that still work temporarily. |
| `type` | enum(MetricType) | Data type of this metric. |
| `expression` | string | Mathematical expression for derived metrics. Empty for non-expressions. |
| `customDefinition` | boolean | True if this is a property-specific custom metric. |
| `blockedReasons` | array[enum(BlockedReason)] | Access restriction reasons. Empty array means full access. When blocked, requests succeed but return zeros; requests with filters on blocked metrics fail. |
| `category` | string | Display name of the category this metric belongs to. |

#### BlockedReason enum

| Value | Description |
|-------|-------------|
| `BLOCKED_REASON_UNSPECIFIED` | Default, never appears in responses. |
| `NO_REVENUE_METRICS` | User lacks authorization for revenue-related metrics. |
| `NO_COST_METRICS` | User lacks authorization for cost-related metrics. |

---

## Quota Summary

| Quota | Standard Property | Analytics 360 |
|-------|------------------|---------------|
| Tokens per day | 200,000 | 2,000,000 |
| Tokens per hour | 40,000 | 400,000 |
| Tokens per hour per project | 14,000 | 140,000 |
| Concurrent requests | 10 | 50 |
| Server errors per project per hour | 10 | 50 |
| Thresholded requests per hour | 120 | 120 |

---

## Key Limits Summary

| Limit | Value |
|-------|-------|
| Max dimensions per report | 9 |
| Max metrics per report | 10 |
| Max date ranges per report | 4 |
| Max rows per request (runReport, runPivotReport) | 250,000 |
| Max rows default | 10,000 |
| Max batch size (batchRunReports, batchRunPivotReports) | 5 requests |
| Product of all pivot limits | 250,000 max |
| Max minute ranges (runRealtimeReport) | 2 |
| Realtime window (standard) | 30 minutes |
| Realtime window (GA 360) | 60 minutes |
