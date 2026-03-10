# PageSpeed Insights API Reference Guide

> Compiled from https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed and https://developers.google.com/speed/docs/insights/v5/get-started — 2026-03-09

## Overview

PageSpeed Insights (PSI) is a Google API that analyzes a URL and returns:

- **Lab data** — Lighthouse audit scores run in a controlled environment (performance, accessibility, best-practices, SEO)
- **Field data** — Real-world Chrome User Experience Report (CrUX) metrics aggregated from actual user visits

**Key constraints:**
- GET requests only. The request body must be empty.
- All responses are JSON.
- No API key required for basic/manual use. A key is strongly recommended for automated/frequent queries to avoid quota throttling.
- The API runs a fresh Lighthouse audit on every request — it is not cached. Expect 10–30 seconds per call.

## Authentication

The API can be used without a key (anonymous quota) or with a key (higher quota).

**Without a key (anonymous):**
```bash
curl "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com"
```

**With an API key (recommended for automation):**
```bash
curl "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=YOUR_API_KEY"
```

API keys are safe to embed in URLs without encoding. Generate one at:
https://console.cloud.google.com/apis/credentials

The required OAuth scope (if using OAuth instead of API key) is `openid`.

## Rate Limits

Google does not publish a hard numeric rate limit in the PSI documentation. In practice:

- **Anonymous (no key):** Low quota — suitable for occasional manual queries only. Throttling is aggressive.
- **With API key:** Higher quota — suitable for CI scripts, nightly monitoring, and multi-page sweeps.
- **Recommended strategy:** Add a 2–5 second delay between requests when testing multiple pages in sequence to avoid triggering rate limiting.
- **Throttled response:** HTTP `429 Too Many Requests`

---

## Endpoint

```
GET https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed
```

All parameters are passed as query string arguments. The request body must be empty.

---

## Query Parameters

| Parameter | Type | Required | Default | Description | Allowed Values |
|-----------|------|----------|---------|-------------|----------------|
| `url` | string | **Yes** | — | The URL to fetch and analyze | Any valid HTTP/HTTPS URL |
| `strategy` | enum | No | `DESKTOP` | The analysis strategy to use | `DESKTOP`, `MOBILE`, `STRATEGY_UNSPECIFIED` |
| `category` | enum (repeatable) | No | `PERFORMANCE` | Lighthouse category to run. Repeat the parameter to run multiple categories. | `PERFORMANCE`, `ACCESSIBILITY`, `BEST_PRACTICES`, `SEO`, `CATEGORY_UNSPECIFIED` |
| `locale` | string | No | `en` | Locale for localized formatted results | BCP 47 locale string (e.g., `en`, `fr`, `de`) |
| `key` | string | No | — | Google API key for higher quota | Your project's API key |
| `utm_campaign` | string | No | — | Campaign name for analytics attribution | Any string |
| `utm_source` | string | No | — | Campaign source for analytics attribution | Any string |
| `captchaToken` | string | No | — | Captcha token when filling out a captcha | Any token string |

**Notes:**
- To run all four Lighthouse categories, repeat `category` four times (see curl examples below).
- `STRATEGY_UNSPECIFIED` and `CATEGORY_UNSPECIFIED` are enum sentinels — do not use them in practice.
- `url` must be a fully-qualified URL including the scheme (`https://`).

---

## Curl Examples

### Minimal — Performance only, desktop

```bash
curl "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed\
?url=https://thehermeticflight.com\
&key=$PSI_API_KEY"
```

### Mobile performance score

```bash
curl "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed\
?url=https://thehermeticflight.com\
&strategy=MOBILE\
&key=$PSI_API_KEY"
```

### All four categories, mobile

```bash
curl "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed\
?url=https://thehermeticflight.com/quiz\
&strategy=MOBILE\
&category=PERFORMANCE\
&category=ACCESSIBILITY\
&category=BEST_PRACTICES\
&category=SEO\
&key=$PSI_API_KEY"
```

### Extract only the performance score with jq

```bash
curl -s "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed\
?url=https://thehermeticflight.com\
&strategy=MOBILE\
&category=PERFORMANCE\
&key=$PSI_API_KEY" \
| jq '.lighthouseResult.categories.performance.score'
```

### Extract Core Web Vitals (field data) with jq

```bash
curl -s "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed\
?url=https://thehermeticflight.com\
&strategy=MOBILE\
&key=$PSI_API_KEY" \
| jq '{
    lcp: .loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS,
    cls: .loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE,
    inp: .loadingExperience.metrics.INTERACTION_TO_NEXT_PAINT,
    fcp: .loadingExperience.metrics.FIRST_CONTENTFUL_PAINT_MS,
    ttfb: .loadingExperience.metrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE,
    overall: .loadingExperience.overall_category
}'
```

---

## Response Schema

### Top-Level Response Object (`PagespeedApiPagespeedResponseV5`)

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Always `"pagespeedonline#result"` |
| `id` | string | Final canonicalized URL analyzed (after redirects) |
| `captchaResult` | string | Captcha validation result, if applicable |
| `analysisUTCTimestamp` | string | ISO 8601 UTC timestamp of the analysis |
| `loadingExperience` | object | Field data — real-world CrUX metrics for this specific URL |
| `originLoadingExperience` | object | Field data — CrUX metrics aggregated across the entire origin |
| `lighthouseResult` | object | Full Lighthouse audit result (lab data) |
| `version` | object | PageSpeed API version info (`{ "major": 5, "minor": N }`) |

---

### Lighthouse Result (`lighthouseResult`)

| Field | Type | Description |
|-------|------|-------------|
| `requestedUrl` | string | URL that was requested |
| `finalUrl` | string | URL actually analyzed after redirects |
| `fetchTime` | string | ISO 8601 timestamp of the Lighthouse run |
| `lighthouseVersion` | string | Lighthouse version used (e.g., `"11.4.0"`) |
| `userAgent` | string | Headless Chrome user agent string |
| `categories` | object | Lighthouse category scores — see below |
| `audits` | object | Map of audit ID → audit result — see below |
| `categoryGroups` | object | Groupings used to organize audit display |
| `runtimeError` | object | Present only when a fatal error occurs — see Error Responses |
| `runWarnings` | array | Non-fatal warnings from the Lighthouse run |
| `configSettings` | object | Settings used for the run (emulatedFormFactor, locale, etc.) |
| `environment` | object | Host machine environment info |
| `timing` | object | Wall clock timing for the Lighthouse run |
| `stackPacks` | array | Stack-specific advice (e.g., WordPress, React) |

---

### Lighthouse Category Scores (`lighthouseResult.categories`)

Four categories are available. Each must be explicitly requested via the `category` parameter (except `PERFORMANCE`, which is always included).

```json
{
  "performance": {
    "id": "performance",
    "title": "Performance",
    "score": 0.72,
    "auditRefs": [...]
  },
  "accessibility": {
    "id": "accessibility",
    "title": "Accessibility",
    "score": 0.95,
    "auditRefs": [...]
  },
  "best-practices": {
    "id": "best-practices",
    "title": "Best Practices",
    "score": 1.0,
    "auditRefs": [...]
  },
  "seo": {
    "id": "seo",
    "title": "SEO",
    "score": 0.91,
    "auditRefs": [...]
  }
}
```

**Category score fields (`LighthouseCategoryV5`):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Category identifier: `performance`, `accessibility`, `best-practices`, `seo` |
| `title` | string | Human-readable category name |
| `description` | string | Extended description of the category |
| `score` | number | Weighted average score: `0.0` to `1.0`. Multiply by 100 for the familiar 0–100 display value. |
| `auditRefs` | array | References to individual audits contributing to this category score |

**Score color bands (per Google's thresholds):**

| Score Range | Color | Label |
|-------------|-------|-------|
| 0.90 – 1.00 | Green | Good |
| 0.50 – 0.89 | Orange | Needs Improvement |
| 0.00 – 0.49 | Red | Poor |

---

### Individual Audit Result (`lighthouseResult.audits[id]`)

The `audits` map contains one entry per audit, keyed by audit ID. Key audit IDs for performance:

| Audit ID | Metric |
|----------|--------|
| `largest-contentful-paint` | LCP lab value |
| `cumulative-layout-shift` | CLS lab value |
| `interaction-to-next-paint` | INP lab value |
| `first-contentful-paint` | FCP lab value |
| `speed-index` | Speed Index |
| `total-blocking-time` | TBT (TBT correlates with INP) |
| `time-to-interactive` | TTI |

**Audit result fields (`LighthouseAuditResultV5`):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Audit identifier |
| `title` | string | Human-readable audit name |
| `description` | string | Explanation and guidance |
| `score` | number\|null | `0.0`–`1.0`, or `null` for informational audits |
| `scoreDisplayMode` | string | How to interpret score: `numeric`, `binary`, `informative`, `notApplicable`, `error` |
| `numericValue` | number | Raw metric value in its natural unit (milliseconds for time metrics, unitless for CLS/scores) |
| `numericUnit` | string | Unit for numericValue: `millisecond`, `unitless`, `byte`, etc. |
| `displayValue` | string | Formatted string for display (e.g., `"2.4 s"`, `"0.12"`) |
| `details` | object | Supplementary data (opportunity tables, filmstrip, etc.) — structure varies by audit |

**Example audit entry:**
```json
"largest-contentful-paint": {
  "id": "largest-contentful-paint",
  "title": "Largest Contentful Paint",
  "description": "Largest Contentful Paint marks the time...",
  "score": 0.72,
  "scoreDisplayMode": "numeric",
  "numericValue": 2850.5,
  "numericUnit": "millisecond",
  "displayValue": "2.9 s"
}
```

---

### Core Web Vitals — Field Data (`loadingExperience.metrics`)

Field data comes from the Chrome User Experience Report (CrUX) — real measurements from real users over the past 28 days. This section may be absent if the URL has insufficient traffic.

**Metric keys:**

| Key | Metric | Description |
|-----|--------|-------------|
| `LARGEST_CONTENTFUL_PAINT_MS` | LCP | Time until largest content element is visible. Good: < 2500ms |
| `CUMULATIVE_LAYOUT_SHIFT_SCORE` | CLS | Visual stability — unexpected layout shifts. Good: < 0.1 |
| `INTERACTION_TO_NEXT_PAINT` | INP | Responsiveness — time from input to next paint. Good: < 200ms |
| `FIRST_CONTENTFUL_PAINT_MS` | FCP | Time until first content is painted. Good: < 1800ms |
| `EXPERIMENTAL_TIME_TO_FIRST_BYTE` | TTFB | Server response time. Good: < 800ms |

**Each metric object structure (`UserPageLoadMetricV5`):**

| Field | Type | Description |
|-------|------|-------------|
| `percentile` | number | 75th-percentile value for this metric across real users |
| `distributions` | array | Buckets with `min`, `max`, `proportion` fields showing distribution across FAST/AVERAGE/SLOW |
| `category` | string | Overall rating: `FAST`, `AVERAGE`, or `SLOW` |

**`loadingExperience` top-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | The URL, pattern, or origin that the CrUX data applies to |
| `metrics` | object | Map of metric key → `UserPageLoadMetricV5` |
| `overall_category` | string | Aggregate speed category: `FAST`, `AVERAGE`, `SLOW`, or `NONE` |
| `initial_url` | string | The URL that was originally requested |
| `origin_fallback` | boolean | `true` if field data is from the origin aggregate because the specific URL had insufficient traffic |

**Example `loadingExperience` section:**
```json
"loadingExperience": {
  "id": "https://thehermeticflight.com/",
  "metrics": {
    "LARGEST_CONTENTFUL_PAINT_MS": {
      "percentile": 2340,
      "distributions": [
        {"min": 0, "max": 2500, "proportion": 0.68},
        {"min": 2500, "max": 4000, "proportion": 0.19},
        {"min": 4000, "max": null, "proportion": 0.13}
      ],
      "category": "FAST"
    },
    "CUMULATIVE_LAYOUT_SHIFT_SCORE": {
      "percentile": 0,
      "distributions": [
        {"min": 0, "max": 10, "proportion": 0.94},
        {"min": 10, "max": 25, "proportion": 0.04},
        {"min": 25, "max": null, "proportion": 0.02}
      ],
      "category": "FAST"
    },
    "INTERACTION_TO_NEXT_PAINT": {
      "percentile": 185,
      "distributions": [
        {"min": 0, "max": 200, "proportion": 0.62},
        {"min": 200, "max": 500, "proportion": 0.27},
        {"min": 500, "max": null, "proportion": 0.11}
      ],
      "category": "FAST"
    },
    "FIRST_CONTENTFUL_PAINT_MS": {
      "percentile": 1520,
      "distributions": [
        {"min": 0, "max": 1800, "proportion": 0.71},
        {"min": 1800, "max": 3000, "proportion": 0.17},
        {"min": 3000, "max": null, "proportion": 0.12}
      ],
      "category": "FAST"
    },
    "EXPERIMENTAL_TIME_TO_FIRST_BYTE": {
      "percentile": 620,
      "distributions": [
        {"min": 0, "max": 800, "proportion": 0.78},
        {"min": 800, "max": 1800, "proportion": 0.16},
        {"min": 1800, "max": null, "proportion": 0.06}
      ],
      "category": "FAST"
    }
  },
  "overall_category": "FAST",
  "initial_url": "https://thehermeticflight.com/",
  "origin_fallback": false
}
```

---

### Lab vs. Field Data — Key Distinction

| Aspect | Lab Data (`lighthouseResult`) | Field Data (`loadingExperience`) |
|--------|-------------------------------|----------------------------------|
| Source | Lighthouse run in controlled environment | Chrome User Experience Report (CrUX) — real users |
| Availability | Always present | Only if URL has sufficient traffic (28-day window) |
| Strategy effect | Significantly affected by `MOBILE` vs `DESKTOP` | CrUX data is stratified by form factor but not directly switchable via the API |
| Use for | Diagnosing specific issues, CI regression | Actual user experience, Core Web Vitals assessment for Google Search |
| Score range | `0.0`–`1.0` per audit | `FAST` / `AVERAGE` / `SLOW` per metric |

If `origin_fallback: true`, the field data applies to the full origin (e.g., `thehermeticflight.com`), not the specific page — the page may have insufficient traffic for page-level CrUX data.

---

## Error Responses

### Runtime Error (in response body)

When Lighthouse encounters a fatal error that may invalidate results, `lighthouseResult.runtimeError` is populated:

```json
{
  "runtimeError": {
    "code": "NO_ERROR",
    "message": ""
  }
}
```

Common runtime error codes:

| Code | Meaning |
|------|---------|
| `NO_ERROR` | No error — results are valid |
| `ERRORED_DOCUMENT_REQUEST` | The URL could not be loaded |
| `FAILED_DOCUMENT_REQUEST` | The page failed to load within the timeout |
| `CHROME_INTERSTITIAL_ERROR` | Chrome showed a security/interstitial page |
| `DNS_FAILURE` | DNS resolution failed |
| `NOT_HTML` | URL did not return HTML (e.g., PDF, image) |

### HTTP-Level Errors

| Status | Meaning |
|--------|---------|
| `400 Bad Request` | Missing or invalid `url` parameter |
| `403 Forbidden` | Invalid or missing API key |
| `429 Too Many Requests` | Quota exceeded — back off and retry |
| `500 Internal Server Error` | Google server error — retry after a delay |

**Error response body (HTTP 4xx/5xx):**
```json
{
  "error": {
    "code": 400,
    "message": "Request contains an invalid argument.",
    "status": "INVALID_ARGUMENT"
  }
}
```

---

## Core Web Vitals Thresholds (Google Search Ranking)

These are the thresholds Google uses to classify Core Web Vitals for Search ranking. Targets for The Hermetic Flight:

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5 s | 2.5 – 4.0 s | > 4.0 s |
| CLS | < 0.1 | 0.1 – 0.25 | > 0.25 |
| INP | < 200 ms | 200 – 500 ms | > 500 ms |
| FCP | < 1.8 s | 1.8 – 3.0 s | > 3.0 s |
| TTFB | < 800 ms | 800 – 1800 ms | > 1800 ms |

**Target Lighthouse scores for all pages:** Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90.

---

## Hermetic Flight Integration Notes

### Pages to Test

| Page | URL | Notes |
|------|-----|-------|
| Homepage | `https://thehermeticflight.com/` | Primary landing page — highest traffic, most important CrUX data |
| Quiz | `https://thehermeticflight.com/quiz` | Heavy client-side JavaScript — INP and TBT are key metrics |
| Launch | `https://thehermeticflight.com/launch` | Kickstarter countdown page |
| Daily | `https://thehermeticflight.com/daily` | Daily card draw — image loading is a factor |
| Gallery | `https://thehermeticflight.com/gallery` | Image-heavy progressive reveal — LCP and CLS are critical |
| Result: Air Weaver | `https://thehermeticflight.com/quiz/result/air-weaver` | OG image, share buttons |
| Result: Embodied Intuitive | `https://thehermeticflight.com/quiz/result/embodied-intuitive` | |
| Result: Ascending Seeker | `https://thehermeticflight.com/quiz/result/ascending-seeker` | |
| Result: Shadow Dancer | `https://thehermeticflight.com/quiz/result/shadow-dancer` | |
| Result: Grounded Mystic | `https://thehermeticflight.com/quiz/result/grounded-mystic` | |
| Result: Celestial Navigator | `https://thehermeticflight.com/quiz/result/celestial-navigator` | |

Total: 11 pages × 2 strategies (mobile + desktop) = 22 PSI calls per sweep.

### Strategy Testing

Always run both strategies for complete coverage:

- **`MOBILE`** — Simulates a mid-tier Android device on a slow 4G connection. This is what Google uses for Search ranking Core Web Vitals. Scores will be substantially lower than desktop. Treat mobile as the primary KPI.
- **`DESKTOP`** — Simulates a desktop Chrome browser on a fast connection. Use for diagnosing issues and verifying desktop UX, but don't use desktop scores as the primary health signal.

**Recommendation:** Run mobile sweeps weekly; run desktop sweeps monthly or before/after major changes.

### Historical Score Tracking

Append results to a JSON file at `operations/reports/pagespeed-history.json`. Each entry records one page + strategy combination per run.

**Suggested schema:**

```json
[
  {
    "timestamp": "2026-03-09T14:32:00Z",
    "url": "https://thehermeticflight.com/",
    "strategy": "MOBILE",
    "scores": {
      "performance": 0.72,
      "accessibility": 0.95,
      "best-practices": 1.0,
      "seo": 0.91
    },
    "labMetrics": {
      "lcp_ms": 2850,
      "cls": 0.04,
      "inp_ms": 210,
      "fcp_ms": 1640,
      "tbt_ms": 320
    },
    "fieldMetrics": {
      "lcp_p75": 2340,
      "lcp_category": "FAST",
      "cls_p75": 0.01,
      "cls_category": "FAST",
      "inp_p75": 185,
      "inp_category": "FAST",
      "fcp_p75": 1520,
      "fcp_category": "FAST",
      "ttfb_p75": 620,
      "ttfb_category": "FAST",
      "overall_category": "FAST",
      "origin_fallback": false
    }
  }
]
```

**Extraction script outline (bash + jq):**

```bash
#!/usr/bin/env bash
# Run PSI for a URL and append result to pagespeed-history.json

URL="$1"
STRATEGY="${2:-MOBILE}"
HISTORY="operations/reports/pagespeed-history.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

RESPONSE=$(curl -s \
  "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed\
?url=${URL}\
&strategy=${STRATEGY}\
&category=PERFORMANCE\
&category=ACCESSIBILITY\
&category=BEST_PRACTICES\
&category=SEO\
&key=${PSI_API_KEY}")

# Extract scores
PERF=$(echo "$RESPONSE" | jq '.lighthouseResult.categories.performance.score')
A11Y=$(echo "$RESPONSE" | jq '.lighthouseResult.categories.accessibility.score')
BP=$(echo "$RESPONSE" | jq '.lighthouseResult.categories["best-practices"].score')
SEO=$(echo "$RESPONSE" | jq '.lighthouseResult.categories.seo.score')

# Extract lab metrics
LCP=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["largest-contentful-paint"].numericValue')
CLS=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["cumulative-layout-shift"].numericValue')
INP=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["interaction-to-next-paint"].numericValue // null')
FCP=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["first-contentful-paint"].numericValue')
TBT=$(echo "$RESPONSE" | jq '.lighthouseResult.audits["total-blocking-time"].numericValue')

# Build entry and append
ENTRY=$(jq -n \
  --arg ts "$TIMESTAMP" --arg url "$URL" --arg strategy "$STRATEGY" \
  --argjson perf "$PERF" --argjson a11y "$A11Y" --argjson bp "$BP" --argjson seo "$SEO" \
  --argjson lcp "$LCP" --argjson cls "$CLS" --argjson inp "${INP:-null}" \
  --argjson fcp "$FCP" --argjson tbt "$TBT" \
  '{
    timestamp: $ts, url: $url, strategy: $strategy,
    scores: {performance: $perf, accessibility: $a11y, "best-practices": $bp, seo: $seo},
    labMetrics: {lcp_ms: $lcp, cls: $cls, inp_ms: $inp, fcp_ms: $fcp, tbt_ms: $tbt}
  }')

# Initialize file if it doesn't exist
[ -f "$HISTORY" ] || echo "[]" > "$HISTORY"

# Append entry to array
jq ". + [$ENTRY]" "$HISTORY" > "${HISTORY}.tmp" && mv "${HISTORY}.tmp" "$HISTORY"

echo "Recorded: $URL ($STRATEGY) — Performance: $(echo "$PERF * 100" | bc | cut -d. -f1)"
```

Usage:
```bash
PSI_API_KEY=your_key_here bash operations/scripts/pagespeed-check.sh https://thehermeticflight.com MOBILE
```

### Integration with weekly-report Skill

The weekly-report skill can incorporate PSI data by reading `operations/reports/pagespeed-history.json` and comparing the most recent entry per page against the previous entry. Key signal: if any page drops below 0.50 on Performance or 0.80 on Accessibility, flag it as a regression in the weekly Slack report.

### API Key Storage

Store the PSI API key as `PSI_API_KEY` in the project `.env` file. Unlike some APIs, the PSI key can be safely passed in the URL query string (no Bearer header needed). The key is not a secret in the same sense as LOOPS_API_KEY — Google restricts it by HTTP referrer or IP in the Cloud Console rather than treating it as a credential.

---

## Complete Parameter Reference (Quick-Copy)

```
GET https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed
  ?url=URL_TO_TEST
  &strategy=MOBILE|DESKTOP
  &category=PERFORMANCE
  &category=ACCESSIBILITY
  &category=BEST_PRACTICES
  &category=SEO
  &locale=en
  &key=YOUR_API_KEY
```
