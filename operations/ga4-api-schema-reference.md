# GA4 Data API — Schema Reference

**Scraped:** 2026-03-08
**Sources:** Google Analytics Developer Docs, FilterExpression REST reference, checkCompatibility reference, Realtime/Exploration/Audience API schema pages

---

## Table of Contents

1. [API Endpoints Overview](#1-api-endpoints-overview)
2. [Request Structure](#2-request-structure)
3. [Dimensions — Complete Reference](#3-dimensions--complete-reference)
4. [Metrics — Complete Reference](#4-metrics--complete-reference)
5. [Realtime API Schema](#5-realtime-api-schema)
6. [Exploration (Funnel) API Schema](#6-exploration-funnel-api-schema)
7. [Audience List API Schema](#7-audience-list-api-schema)
8. [Filter Expressions](#8-filter-expressions)
9. [Compatibility System](#9-compatibility-system)
10. [Custom Dimensions and Metrics](#10-custom-dimensions-and-metrics)
11. [Metric Types and Data Types](#11-metric-types-and-data-types)
12. [getMetadata Method](#12-getmetadata-method)
13. [Deprecated / Renamed Fields](#13-deprecated--renamed-fields)
14. [Key Constraints and Limits](#14-key-constraints-and-limits)

---

## 1. API Endpoints Overview

**Base URL:** `https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}`

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `runReport` | POST | `properties/{id}:runReport` | Core customized report on event data |
| `runRealtimeReport` | POST | `properties/{id}:runRealtimeReport` | Realtime event data report |
| `runPivotReport` | POST | `properties/{id}:runPivotReport` | Customized pivot report |
| `batchRunReports` | POST | `properties/{id}:batchRunReports` | Multiple reports in one request |
| `batchRunPivotReports` | POST | `properties/{id}:batchRunPivotReports` | Multiple pivot reports in one request |
| `getMetadata` | GET | `properties/{id}/metadata` | Dimensions/metrics metadata for property |
| `checkCompatibility` | POST | `properties/{id}:checkCompatibility` | Validate dimension/metric combinations |

**OAuth Scopes Required:**
- `https://www.googleapis.com/auth/analytics.readonly` (read-only)
- `https://www.googleapis.com/auth/analytics` (full access)

---

## 2. Request Structure

### runReport Request Body

```json
{
  "dimensions": [{ "name": "dimensionApiName" }],
  "metrics": [{ "name": "metricApiName" }],
  "dateRanges": [
    { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "name": "optional_label" }
  ],
  "dimensionFilter": { "FilterExpression" },
  "metricFilter": { "FilterExpression" },
  "offset": 0,
  "limit": 10000,
  "metricAggregations": ["TOTAL", "MINIMUM", "MAXIMUM", "COUNT"],
  "orderBys": [
    {
      "dimension": { "dimensionName": "date", "orderType": "ALPHANUMERIC" },
      "desc": false
    }
  ],
  "currencyCode": "USD",
  "cohortSpec": { "cohorts": [], "cohortsRange": {}, "cohortReportSettings": {} },
  "keepEmptyRows": false,
  "returnPropertyQuota": false
}
```

### Date Range Special Values

| Value | Meaning |
|-------|---------|
| `today` | Current day |
| `yesterday` | Previous day |
| `NdaysAgo` | N days before today (e.g. `7daysAgo`) |
| `YYYY-MM-DD` | Absolute date |

Multiple date ranges can be included in one request for comparison analysis.

### Response Structure

```json
{
  "dimensionHeaders": [{ "name": "string" }],
  "metricHeaders": [{ "name": "string", "type": "MetricType" }],
  "rows": [
    {
      "dimensionValues": [{ "value": "string" }],
      "metricValues": [{ "value": "string" }]
    }
  ],
  "rowCount": 0,
  "metadata": { "dataLossFromOtherRow": false, "currencyCode": "USD", "timeZone": "America/Los_Angeles" },
  "propertyQuota": {},
  "kind": "analyticsData#runReport"
}
```

---

## 3. Dimensions — Complete Reference

All dimensions have data type **STRING** unless noted. Dimensions are available in Core Reporting unless explicitly marked otherwise.

### 3.1 User & Session

| API Name | UI Name | Description |
|----------|---------|-------------|
| `newVsReturning` | New / returning | `"new"` for users with 0 prior sessions; `"returning"` for 1+ prior sessions |
| `firstSessionDate` | First session date | Date of user's first session, formatted `YYYYMMDD` |
| `audienceId` | Audience ID | Numeric identifier for an audience the user belonged to |
| `audienceName` | Audience name | Name of the audience |
| `audienceResourceName` | Audience resource name | Full resource identifier (collection + resource ID) |

### 3.2 Geographic

| API Name | UI Name | Description |
|----------|---------|-------------|
| `city` | City | City from which user activity originated (derived from IP) |
| `cityId` | City ID | Geographic ID of city (derived from IP) |
| `country` | Country | Country from which user activity originated |
| `countryId` | Country ID | ISO 3166-1 alpha-2 country code |
| `continent` | Continent | Continent of user activity (e.g., Americas, Asia) |
| `continentId` | Continent ID | Geographic ID of continent |
| `region` | Region | Geographic region derived from IP address |
| `subContinent` | Subcontinent | Subcontinent region |
| `subContinentId` | Subcontinent ID | Geographic ID of subcontinent |
| `metro` | Metro | Metro area (DMA) |

### 3.3 Device & Platform

| API Name | UI Name | Description |
|----------|---------|-------------|
| `deviceCategory` | Device category | `Desktop`, `Tablet`, or `Mobile` |
| `deviceModel` | Device model | Mobile device model (derived from user agent) |
| `mobileDeviceBranding` | Device brand | Manufacturer name (Samsung, HTC, etc.) |
| `mobileDeviceMarketingName` | Device | Branded device name (Galaxy S10, P30 Pro) |
| `mobileDeviceModel` | Mobile model | Device model string (iPhone X, SM-G950F) |
| `operatingSystem` | Operating system | OS of the device (Windows, iOS, Android, etc.) |
| `operatingSystemVersion` | OS version | OS version (Android 10, iOS 13.5.1) |
| `operatingSystemWithVersion` | Operating system with version | Combined OS + version string |
| `platform` | Platform | `web`, `iOS`, or `Android` |
| `platformDeviceCategory` | Platform / device category | Combined platform and device type |
| `screenResolution` | Screen resolution | Screen resolution (e.g., `1920x1080`) |

### 3.4 Browser & Language

| API Name | UI Name | Description |
|----------|---------|-------------|
| `browser` | Browser | Browser used to access the property |
| `browserVersion` | Browser version | Browser version string |
| `language` | Language | Language setting of user's browser or device |
| `languageCode` | Language code | ISO 639 language code |

### 3.5 Time

| API Name | UI Name | Description |
|----------|---------|-------------|
| `date` | Date | Date formatted as `YYYYMMDD` |
| `dateHour` | Date + hour | Combined date and hour as `YYYYMMDDHH` |
| `dateHourMinute` | Date hour and minute | Combined as `YYYYMMDDHHMM` |
| `day` | Day | Two-digit day of month (01–31) |
| `dayOfWeek` | Day of week | Integer 0–6 (0 = Sunday) |
| `dayOfWeekName` | Day of week name | English day name (Sunday, Monday, …) |
| `hour` | Hour | Two-digit hour (00–23) |
| `minute` | Minute | Two-digit minute (00–59) |
| `month` | Month | Two-digit month (01–12) |
| `week` | Week | Two-digit week of year (01–53) |
| `year` | Year | Four-digit year |
| `isoWeek` | ISO week of the year | ISO week number (01–53) |
| `isoYear` | ISO year | ISO year (e.g., 2024) |
| `isoYearIsoWeek` | ISO week of ISO year | Combined format (e.g., `201652`) |
| `nthDay` | Nth day | Days elapsed since start of date range |
| `nthHour` | Nth hour | Hours elapsed since start of date range |
| `nthMinute` | Nth minute | Minutes elapsed since start of date range |
| `nthMonth` | Nth month | Months elapsed since start of date range |
| `nthWeek` | Nth week | Weeks elapsed since start of date range |
| `nthYear` | Nth year | Years elapsed since start of date range |

### 3.6 Page & Content

| API Name | UI Name | Description |
|----------|---------|-------------|
| `contentGroup` | Content group | Category applied to items of published content |
| `contentId` | Content ID | Identifier for a content item |
| `contentType` | Content type | Content category classification |
| `fileExtension` | File extension | Extension of a downloaded file (pdf, txt, xlsx) |
| `fileName` | File name | Page path of a downloaded file |
| `fullPageUrl` | Full page URL | Hostname + page path + query string |
| `hostName` | Hostname | Subdomain and domain (www.example.com) |
| `landingPage` | Landing page | First pageview path in a session |
| `landingPagePlusQueryString` | Landing page + query string | First page path including query parameters |
| `pageLocation` | Page location | Protocol + hostname + page path + query string |
| `pagePath` | Page path | URL portion between hostname and query string |
| `pagePathPlusQueryString` | Page path + query string | Full path following hostname |
| `pageReferrer` | Page referrer | Full referring URL including path and query string |
| `pageTitle` | Page title | HTML `<title>` of the web page |
| `unifiedPagePathScreen` | Page path and screen class | Page path (web) or screen class (app) |
| `unifiedPageScreen` | Page title and screen name | Page title (web) or screen name (app) |
| `unifiedScreenClass` | Page title and screen class | Page title (web) or screen class (app) |
| `unifiedScreenName` | Page title and screen name | Page title (web) or screen name (app) |

### 3.7 Events & Interactions

| API Name | UI Name | Description |
|----------|---------|-------------|
| `eventName` | Event name | Name of the event |
| `isKeyEvent` | Is key event | `"true"` if event is marked as a key event |
| `method` | Method | Method by which the event was triggered |
| `outbound` | Outbound | `"true"` if link led to a domain outside the property |
| `linkClasses` | Link classes | HTML `class` attribute of an outbound link |
| `linkDomain` | Link domain | Destination domain of an outbound link |
| `linkId` | Link ID | HTML `id` attribute of an outbound link |
| `linkText` | Link text | Text label of a file download link |
| `linkUrl` | Link URL | Full URL for an outbound link or file download |
| `percentScrolled` | Percent scrolled | Percentage of page scrolled (Enhanced Measurement) |
| `searchTerm` | Search term | User's site search query |

### 3.8 Marketing & Attribution

| API Name | UI Name | Description |
|----------|---------|-------------|
| `campaignId` | Campaign ID | Marketing campaign identifier |
| `campaignName` | Campaign | Campaign name |
| `defaultChannelGroup` | Default channel group | Channel grouping based on source and medium |
| `medium` | Medium | Medium attributed to the key event |
| `source` | Source | Traffic source attributed to the key event |
| `sourceMedium` | Source / medium | Combined source and medium |
| `sourcePlatform` | Source platform | Platform of traffic source |
| `primaryChannelGroup` | Primary channel group | Channel groups used in GA4 standard reports |
| `sessionCampaignId` | Session campaign ID | Campaign ID for the session |
| `sessionCampaignName` | Session campaign | Campaign name for the session |
| `sessionDefaultChannelGroup` | Session default channel group | Default channel group for the session |
| `sessionMedium` | Session medium | Medium for the session |
| `sessionSource` | Session source | Source for the session |
| `sessionSourceMedium` | Session source / medium | Combined session source and medium |
| `sessionSourcePlatform` | Session source platform | Source platform for the session |
| `sessionPrimaryChannelGroup` | Session primary channel group | Primary channel group for the session |

### 3.9 Manual UTM Parameters

| API Name | UI Name | Description |
|----------|---------|-------------|
| `manualAdContent` | Manual ad content | Populated by `utm_content` URL parameter |
| `manualCampaignId` | Manual campaign ID | Populated by `utm_id` URL parameter |
| `manualCampaignName` | Manual campaign name | Populated by `utm_campaign` URL parameter |
| `manualCreativeFormat` | Manual creative format | Populated by `utm_creative_format` URL parameter |
| `manualMarketingTactic` | Manual marketing tactic | Populated by `utm_marketing_tactic` URL parameter |
| `manualMedium` | Manual medium | Populated by `utm_medium` URL parameter |
| `manualSource` | Manual source | Populated by `utm_source` URL parameter |
| `manualSourceMedium` | Manual source / medium | Combined manual source and medium |
| `manualSourcePlatform` | Manual source platform | Populated by `utm_source_platform` URL parameter |
| `manualTerm` | Manual term | Populated by `utm_term` URL parameter |
| `sessionManualAdContent` | Session manual ad content | Session-level `utm_content` |
| `sessionManualCampaignId` | Session manual campaign ID | Session-level `utm_id` |
| `sessionManualCampaignName` | Session manual campaign | Session-level `utm_campaign` |
| `sessionManualCreativeFormat` | Session manual creative format | Session-level `utm_creative_format` |
| `sessionManualMarketingTactic` | Session manual marketing tactic | Session-level `utm_marketing_tactic` |
| `sessionManualMedium` | Session manual medium | Session-level `utm_medium` |
| `sessionManualSource` | Session manual source | Session-level `utm_source` |
| `sessionManualSourceMedium` | Session manual source / medium | Session-level combined |
| `sessionManualSourcePlatform` | Session manual source platform | Session-level `utm_source_platform` |
| `sessionManualTerm` | Session manual term | Session-level `utm_term` |

### 3.10 First User Acquisition

All `firstUser` dimensions mirror their session-level counterparts but represent attribution for the user's very first session.

| API Name | UI Name |
|----------|---------|
| `firstUserCampaignId` | First user campaign ID |
| `firstUserCampaignName` | First user campaign |
| `firstUserDefaultChannelGroup` | First user default channel group |
| `firstUserGoogleAdsAccountName` | First user Google Ads account name |
| `firstUserGoogleAdsAdGroupId` | First user Google Ads ad group ID |
| `firstUserGoogleAdsAdGroupName` | First user Google Ads ad group name |
| `firstUserGoogleAdsAdNetworkType` | First user Google Ads ad network type |
| `firstUserGoogleAdsCampaignId` | First user Google Ads campaign ID |
| `firstUserGoogleAdsCampaignName` | First user Google Ads campaign |
| `firstUserGoogleAdsCampaignType` | First user Google Ads campaign type |
| `firstUserGoogleAdsCreativeId` | First user Google Ads creative ID |
| `firstUserGoogleAdsCustomerId` | First user Google Ads customer ID |
| `firstUserGoogleAdsKeyword` | First user Google Ads keyword text |
| `firstUserGoogleAdsQuery` | First user Google Ads query |
| `firstUserManualAdContent` | First user manual ad content |
| `firstUserManualCampaignId` | First user manual campaign ID |
| `firstUserManualCampaignName` | First user manual campaign name |
| `firstUserManualCreativeFormat` | First user manual creative format |
| `firstUserManualMarketingTactic` | First user manual marketing tactic |
| `firstUserManualMedium` | First user manual medium |
| `firstUserManualSource` | First user manual source |
| `firstUserManualSourceMedium` | First user manual source / medium |
| `firstUserManualSourcePlatform` | First user manual source platform |
| `firstUserManualTerm` | First user manual term |
| `firstUserMedium` | First user medium |
| `firstUserPrimaryChannelGroup` | First user primary channel group |
| `firstUserSource` | First user source |
| `firstUserSourceMedium` | First user source / medium |
| `firstUserSourcePlatform` | First user source platform |
| `firstUserCm360AccountId` | First user CM360 account ID |
| `firstUserCm360AccountName` | First user CM360 account name |
| `firstUserCm360AdvertiserId` | First user CM360 advertiser ID |
| `firstUserCm360AdvertiserName` | First user CM360 advertiser name |
| `firstUserCm360CampaignId` | First user CM360 campaign ID |
| `firstUserCm360CampaignName` | First user CM360 campaign |
| `firstUserDv360AdvertiserId` | First user DV360 advertiser ID |
| `firstUserDv360AdvertiserName` | First user DV360 advertiser name |
| `firstUserDv360CampaignId` | First user DV360 campaign ID |
| `firstUserDv360CampaignName` | First user DV360 campaign |
| `firstUserSa360CampaignId` | First user SA360 campaign ID |
| `firstUserSa360CampaignName` | First user SA360 campaign |

### 3.11 Google Ads

| API Name | UI Name | Description |
|----------|---------|-------------|
| `googleAdsAccountName` | Google Ads account name | Account name from linked Google Ads account |
| `googleAdsAdGroupId` | Google Ads ad group ID | Ad group ID |
| `googleAdsAdGroupName` | Google Ads ad group name | Ad group name |
| `googleAdsAdNetworkType` | Google Ads ad network type | Network type (Google search, Display Network, YouTube, etc.) |
| `googleAdsCampaignId` | Google Ads campaign ID | Campaign ID |
| `googleAdsCampaignName` | Google Ads campaign | Campaign name |
| `googleAdsCampaignType` | Google Ads campaign type | Campaign type (Search, Display, Shopping, Video, etc.) |
| `googleAdsCreativeId` | Google Ads creative ID | Creative ID |
| `googleAdsCustomerId` | Google Ads customer ID | Customer account ID |
| `googleAdsKeyword` | Google Ads keyword text | Matched keyword |
| `googleAdsQuery` | Google Ads query | Search query that triggered the ad |

### 3.12 CM360 (Campaign Manager 360)

| API Name | UI Name |
|----------|---------|
| `cm360AccountId` | CM360 account ID |
| `cm360AccountName` | CM360 account name |
| `cm360AdvertiserId` | CM360 advertiser ID |
| `cm360AdvertiserName` | CM360 advertiser name |
| `cm360CampaignId` | CM360 campaign ID |
| `cm360CampaignName` | CM360 campaign |
| `cm360CreativeFormat` | CM360 creative format |
| `cm360CreativeId` | CM360 creative ID |
| `cm360CreativeName` | CM360 creative name |
| `cm360CreativeType` | CM360 creative type |
| `cm360CreativeTypeId` | CM360 creative type ID |
| `cm360CreativeVersion` | CM360 creative version |
| `cm360Medium` | CM360 medium |
| `cm360PlacementCostStructure` | CM360 placement cost structure |
| `cm360PlacementId` | CM360 placement ID |
| `cm360PlacementName` | CM360 placement name |
| `cm360RenderingId` | CM360 rendering ID |
| `cm360SiteId` | CM360 site ID |
| `cm360SiteName` | CM360 site name |
| `cm360Source` | CM360 source |
| `cm360SourceMedium` | CM360 source / medium |
| `sessionCm360AccountId` | Session CM360 account ID |
| `sessionCm360CampaignId` | Session CM360 campaign ID |
| `sessionCm360CampaignName` | Session CM360 campaign |

### 3.13 DV360 (Display & Video 360)

| API Name | UI Name |
|----------|---------|
| `dv360AdvertiserId` | DV360 advertiser ID |
| `dv360AdvertiserName` | DV360 advertiser name |
| `dv360CampaignId` | DV360 campaign ID |
| `dv360CampaignName` | DV360 campaign |
| `dv360CreativeFormat` | DV360 creative format |
| `dv360CreativeId` | DV360 creative ID |
| `dv360CreativeName` | DV360 creative name |
| `dv360ExchangeId` | DV360 exchange ID |
| `dv360ExchangeName` | DV360 exchange name |
| `dv360InsertionOrderId` | DV360 insertion order ID |
| `dv360InsertionOrderName` | DV360 insertion order name |
| `dv360LineItemId` | DV360 line item ID |
| `dv360LineItemName` | DV360 line item name |
| `dv360Medium` | DV360 medium |
| `dv360PartnerId` | DV360 partner ID |
| `dv360PartnerName` | DV360 partner name |
| `dv360Source` | DV360 source |
| `dv360SourceMedium` | DV360 source / medium |

### 3.14 SA360 (Search Ads 360)

| API Name | UI Name |
|----------|---------|
| `sa360AdGroupId` | SA360 ad group ID |
| `sa360AdGroupName` | SA360 ad group name |
| `sa360CampaignId` | SA360 campaign ID |
| `sa360CampaignName` | SA360 campaign |
| `sa360CreativeFormat` | SA360 creative format |
| `sa360EngineAccountId` | SA360 engine account ID |
| `sa360EngineAccountName` | SA360 engine account name |
| `sa360EngineAccountType` | SA360 engine account type |
| `sa360KeywordText` | SA360 keyword text |
| `sa360ManagerAccountId` | SA360 manager account ID |
| `sa360ManagerAccountName` | SA360 manager account name |
| `sa360Medium` | SA360 medium |
| `sa360Query` | SA360 query |
| `sa360Source` | SA360 source |
| `sa360SourceMedium` | SA360 source / medium |

### 3.15 E-commerce

| API Name | UI Name | Description |
|----------|---------|-------------|
| `currencyCode` | Currency | ISO 4217 currency code |
| `itemAffiliation` | Item affiliation | Name or code of affiliate or partner |
| `itemBrand` | Item brand | Brand name of item |
| `itemCategory` | Item category | Primary category level in hierarchy |
| `itemCategory2` | Item category 2 | Secondary category level |
| `itemCategory3` | Item category 3 | Tertiary category level |
| `itemCategory4` | Item category 4 | Quaternary category level |
| `itemCategory5` | Item category 5 | Quinary category level |
| `itemId` | Item ID | Item identifier |
| `itemListId` | Item list ID | Item list identifier |
| `itemListName` | Item list name | Item list name |
| `itemListPosition` | Item list position | Position of item in a list |
| `itemLocationID` | Item location ID | Physical location associated with item |
| `itemName` | Item name | Item name |
| `itemPromotionCreativeName` | Item promotion creative name | Promotional creative name |
| `itemPromotionCreativeSlot` | Item promotion creative slot | Slot name associated with promo creative |
| `itemPromotionId` | Item promotion ID | Promotion ID |
| `itemPromotionName` | Item promotion name | Promotion name |
| `itemVariant` | Item variant | Specific variation of a product (color, size) |
| `orderCoupon` | Order coupon | Code for order-level coupon |
| `shippingTier` | Shipping tier | Shipping tier selected (e.g., Ground, Air) |
| `transactionId` | Transaction ID | E-commerce transaction identifier |

### 3.16 App / AdMob

| API Name | UI Name | Description |
|----------|---------|-------------|
| `adFormat` | Ad format | Format of the served ad |
| `adSourceName` | Ad source name | Source network name |
| `adUnitName` | Ad unit name | AdMob ad unit name |
| `appVersion` | App version | `versionName` (Android) or short bundle version (iOS) |
| `streamId` | Stream ID | Numeric data stream identifier |
| `streamName` | Stream name | Data stream name |

### 3.17 Cohort

| API Name | UI Name | Description |
|----------|---------|-------------|
| `cohort` | Cohort | Cohort name as defined in the request |
| `cohortNthDay` | Daily cohort | Day offset from cohort's first session date |
| `cohortNthMonth` | Monthly cohort | Month offset from cohort's first session date |
| `cohortNthWeek` | Weekly cohort | Week offset from cohort's first session date |

### 3.18 Games

| API Name | UI Name | Description |
|----------|---------|-------------|
| `achievementId` | Achievement ID | Achievement ID in a game for an event |
| `character` | Character | Player character in a game |
| `groupId` | Group ID | Player group ID in a game |
| `level` | Level | Player's level in a game |
| `virtualCurrencyName` | Virtual currency name | Virtual currency name |

---

## 4. Metrics — Complete Reference

Metric data types use the `MetricType` enum (see Section 11). All metrics are available in Core Reporting unless marked otherwise.

### 4.1 User Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `activeUsers` | Active users | Distinct users who visited the site or app | INTEGER |
| `newUsers` | New users | Users who interacted for the first time | INTEGER |
| `returningUsers` | Returning users | Users with at least one prior session | INTEGER |
| `totalUsers` | Total users | All distinct users, including new and returning | INTEGER |
| `crashAffectedUsers` | Crash-affected users | Users who experienced an app crash | INTEGER |
| `crashFreeUsersRate` | Crash-free users rate | Percentage of users who did not experience a crash | FLOAT |
| `dauPerMau` | DAU / MAU | Daily active users divided by monthly active users (stickiness ratio) | FLOAT |
| `dauPerWau` | DAU / WAU | Daily active users divided by weekly active users | FLOAT |
| `wauPerMau` | WAU / MAU | Weekly active users divided by monthly active users | FLOAT |
| `active1DayUsers` | 1-day active users | Distinct active users in a 1-day period | INTEGER |
| `active7DayUsers` | 7-day active users | Distinct active users in a 7-day period | INTEGER |
| `active28DayUsers` | 28-day active users | Distinct active users in a 28-day period | INTEGER |

### 4.2 Session Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `sessions` | Sessions | Total number of sessions | INTEGER |
| `averageSessionDuration` | Average session duration | Average duration of sessions in seconds | SECONDS |
| `sessionsPerUser` | Sessions per user | Average sessions per user | FLOAT |
| `bounceRate` | Bounce rate | Percentage of sessions with no engagement | FLOAT |
| `engagedSessions` | Engaged sessions | Sessions lasting 10+ seconds, with a key event, or with 2+ pageviews | INTEGER |
| `engagementRate` | Engagement rate | Engaged sessions divided by total sessions | FLOAT |

### 4.3 Event Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `eventCount` | Event count | Total count of events | INTEGER |
| `eventCountPerUser` | Event count per user | Average event count per user | FLOAT |
| `eventsPerSession` | Events per session | Average events per session | FLOAT |
| `keyEvents` | Key events | Count of events marked as key events | INTEGER |
| `keyEventRate` | Key event rate | Key events divided by total events | FLOAT |
| `itemsClickedInListEvents` | Items clicked in list events | Count of `select_item` events | INTEGER |
| `itemsClickedInPromotionEvents` | Items clicked in promotion events | Count of `select_promotion` events | INTEGER |
| `itemsViewedInListEvents` | Items viewed in list events | Count of `view_item_list` events | INTEGER |
| `itemsViewedInPromotionEvents` | Items viewed in promotion events | Count of `view_promotion` events | INTEGER |

### 4.4 Engagement & Scrolling

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `screenPageViews` | Views | App screens or web pages viewed (counts repeated views) | INTEGER |
| `screenPageViewsPerSession` | Views per session | Average views per session | FLOAT |
| `screenPageViewsPerUser` | Views per user | Average views per user | FLOAT |
| `userEngagementDuration` | User engagement duration | Total foreground time (app) or focus time (web) | SECONDS |
| `averageRevenuePerUser` | Average revenue per user | Average revenue per active user | CURRENCY |

### 4.5 E-commerce Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `totalRevenue` | Total revenue | Sum of revenue from purchases, subscriptions, and ads | CURRENCY |
| `purchaseRevenue` | Purchase revenue | Revenue from purchase events | CURRENCY |
| `purchaseRevenuePerUser` | Purchase revenue per user | Average purchase revenue per user | CURRENCY |
| `transactions` | Transactions | Count of purchase events | INTEGER |
| `transactionsPerPurchaser` | Transactions per purchaser | Average transactions per purchasing user | FLOAT |
| `averagePurchaseRevenue` | Average purchase revenue | Average revenue per purchase transaction | CURRENCY |
| `averagePurchaseRevenuePerUser` | Average purchase revenue per user | Average purchase revenue across all users | CURRENCY |
| `purchasers` | Purchasers | Distinct users who completed a purchase | INTEGER |
| `firstTimePurchasers` | First-time purchasers | Users making their first purchase | INTEGER |
| `firstTimePurchasersPerNewUser` | First-time purchasers per new user | Ratio of first-time purchasers to new users | FLOAT |
| `firstTimePurchaserConversionRate` | First-time purchaser conversion rate | First-time purchasers divided by active users | FLOAT |
| `purchaserConversionRate` | Purchaser conversion rate | Purchasers divided by active users | FLOAT |
| `itemRevenue` | Item revenue | Revenue from item sales (item price × quantity) | CURRENCY |
| `itemsAddedToCart` | Items added to cart | Count of items added to cart | INTEGER |
| `itemsCheckedOut` | Items checked out | Count of items in checkout events | INTEGER |
| `itemsPurchased` | Items purchased | Count of items purchased | INTEGER |
| `itemsViewed` | Items viewed | Count of items viewed in `view_item` events | INTEGER |
| `itemViewEvents` | Item view events | Count of `view_item` events | INTEGER |
| `addToCartEvents` | Add-to-cart events | Count of `add_to_cart` events | INTEGER |
| `checkoutEvents` | Checkout events | Count of `begin_checkout` events | INTEGER |
| `ecommercePurchases` | Ecommerce purchases | Count of `purchase` events with revenue | INTEGER |
| `cartToViewRate` | Cart-to-view rate | Items added to cart divided by items viewed | FLOAT |
| `purchaseToViewRate` | Purchase-to-view rate | Items purchased divided by items viewed | FLOAT |
| `refundAmount` | Refund amount | Total refund value from `refund` events | CURRENCY |
| `refunds` | Refunds | Count of `refund` events | INTEGER |
| `shippingAmount` | Shipping amount | Total shipping value from purchase events | CURRENCY |
| `taxAmount` | Tax amount | Total tax value from purchase events | CURRENCY |

### 4.6 Ad Revenue (AdMob / Publisher)

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `adRevenue` | Ad revenue | Total revenue from ads | CURRENCY |
| `publisherAdClicks` | Publisher ad clicks | Count of ad clicks | INTEGER |
| `publisherAdImpressions` | Publisher ad impressions | Count of ad impressions | INTEGER |

### 4.7 Predictive Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `purchaseProbability` | Purchase probability | Probability a user will purchase in the next 7 days | FLOAT |
| `churnProbability` | Churn probability | Probability a 7-day active user will not be active in the next 7 days | FLOAT |
| `predictedRevenue` | Predicted revenue | Predicted revenue from a user in the next 28 days | CURRENCY |

### 4.8 Cohort Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `cohortActiveUsers` | Cohort active users | Active users in a cohort during a cohort period | INTEGER |
| `cohortTotalUsers` | Cohort total users | Total users in a cohort | INTEGER |

---

## 5. Realtime API Schema

Use via `runRealtimeReport`. Data reflects events collected in approximately the last 30 minutes.

### Realtime Dimensions

| API Name | UI Name | Description |
|----------|---------|-------------|
| `appVersion` | App version | `versionName` (Android) or short bundle version (iOS) |
| `audienceId` | Audience ID | Numeric audience identifier |
| `audienceName` | Audience name | Audience name |
| `audienceResourceName` | Audience resource name | Full resource name for the audience |
| `city` | City | City from which activity originated |
| `cityId` | City ID | Geographic ID derived from IP |
| `country` | Country | Country from which activity originated |
| `countryId` | Country ID | ISO 3166-1 alpha-2 country code |
| `deviceCategory` | Device category | `Desktop`, `Tablet`, or `Mobile` |
| `eventName` | Event name | Name of the event |
| `minutesAgo` | Realtime minutes ago | Number of minutes ago the event was collected |
| `platform` | Platform | `web`, `iOS`, or `Android` |
| `streamId` | Stream ID | Numeric data stream identifier |
| `streamName` | Stream name | Data stream name |
| `unifiedScreenName` | Page title and screen name | Page title (web) or screen name (app) |
| `customUser:parameter_name` | Custom user dimension | User-scoped custom dimensions via `customUser:` prefix |

**Not supported in Realtime:** event-scoped custom dimensions and metrics.

### Realtime Metrics

| API Name | UI Name | Description | Type |
|----------|---------|-------------|------|
| `activeUsers` | Active users | Distinct users active in the last 30 minutes | INTEGER |
| `eventCount` | Event count | Count of events | INTEGER |
| `keyEvents` | Key events | Count of events marked as key events | INTEGER |
| `screenPageViews` | Views | App screens or web pages viewed | INTEGER |

---

## 6. Exploration (Funnel) API Schema

Used via the Explorations API for funnel and path analysis.

### Funnel-Specific Dimensions

These three dimensions are unique to the Exploration API:

| API Name | UI Name | Description |
|----------|---------|-------------|
| `funnelStepName` | Funnel step name | Label assigned to the step (e.g., "3. Purchase") |
| `funnelStepNewVsContinuing` | Funnel step new vs continuing | Distinguishes `"new"` vs `"continuing"` users in open funnels |
| `funnelStepNextAction` | Funnel step next action | The next dimension value observed after completing a step |

### Dimension Categories Supported

The Exploration API supports the same nine dimension categories as Core Reporting:

1. User & Acquisition (campaign data, device identifiers)
2. Traffic Source (UTM parameters, channel groups, source/medium)
3. E-commerce (item details, categories, pricing, promotions)
4. Platform/Device (OS, browser, device model, screen resolution)
5. Geography (country, region, city, continent)
6. Time/Date (date ranges, hourly/daily/weekly/monthly)
7. Cohorts (cohort membership, nth-day/week/month)
8. Identifiers (event names, audience IDs, content identifiers)
9. Google Advertising (Google Ads, DV360, SA360, CM360)

**Custom dimensions** and **custom channel groups** are also supported.

---

## 7. Audience List API Schema

Used via Audience Export methods (`create`, `get`, `list`, `query`). Separate from Core Reporting methods.

### Audience Export Dimensions

| API Name | UI Name | Description |
|----------|---------|-------------|
| `deviceId` | Device ID | Browser-based or mobile-app-based pseudonymous identifier |
| `isAdsPersonalizationAllowed` | Is ads personalization allowed | `"true"`, `"false"`, or `"(not set)"` |
| `isLimitedAdTracking` | Is limited ad tracking | `"true"`, `"false"`, or `"(not set)"` |
| `userId` | User ID | Developer-specified User ID from tagging implementation |

**Usage note:** Specify API name in the `name` field of an `AudienceDimension` resource. These dimensions cannot be used in Core Reporting methods.

---

## 8. Filter Expressions

Filters are applied via `dimensionFilter` and `metricFilter` in `runReport` requests.

**Critical rule:** Dimension filters and metric filters must be kept separate. Do not mix dimension fields into `metricFilter` or vice versa.

### FilterExpression Object

A `FilterExpression` uses exactly one of the following union fields:

| Field | Type | Description |
|-------|------|-------------|
| `andGroup` | `FilterExpressionList` | All expressions in list must be true (AND) |
| `orGroup` | `FilterExpressionList` | At least one expression in list must be true (OR) |
| `notExpression` | `FilterExpression` | Negates the expression |
| `filter` | `Filter` | A single primitive filter |

### FilterExpressionList

```json
{
  "expressions": [
    { "FilterExpression" },
    { "FilterExpression" }
  ]
}
```

### Filter Object

```json
{
  "fieldName": "dimensionOrMetricApiName",
  "stringFilter": { ... }
}
```

Only one filter type may be specified per `Filter`.

### StringFilter

```json
{
  "stringFilter": {
    "matchType": "EXACT | BEGINS_WITH | ENDS_WITH | CONTAINS | FULL_REGEXP | PARTIAL_REGEXP",
    "value": "matchValue",
    "caseSensitive": false
  }
}
```

| matchType | Behavior |
|-----------|----------|
| `EXACT` | Exact string equality |
| `BEGINS_WITH` | String starts with value |
| `ENDS_WITH` | String ends with value |
| `CONTAINS` | String contains value as substring |
| `FULL_REGEXP` | Value is a full regular expression match |
| `PARTIAL_REGEXP` | Value is a partial regular expression match |

### InListFilter

```json
{
  "inListFilter": {
    "values": ["value1", "value2", "value3"],
    "caseSensitive": false
  }
}
```

### NumericFilter

```json
{
  "numericFilter": {
    "operation": "EQUAL | LESS_THAN | LESS_THAN_OR_EQUAL | GREATER_THAN | GREATER_THAN_OR_EQUAL",
    "value": { "int64Value": "123" }
  }
}
```

`NumericValue` can be either `int64Value` (string-encoded integer) or `doubleValue` (floating point).

### BetweenFilter

```json
{
  "betweenFilter": {
    "fromValue": { "int64Value": "100" },
    "toValue": { "int64Value": "200" }
  }
}
```

Inclusive range — matches values where `fromValue <= x <= toValue`.

### EmptyFilter

```json
{
  "emptyFilter": {}
}
```

Matches null values, empty strings, and `"(not set)"`.

### Compound Filter Examples

**AND filter (Chrome users in the US):**
```json
{
  "dimensionFilter": {
    "andGroup": {
      "expressions": [
        {
          "filter": {
            "fieldName": "browser",
            "stringFilter": { "matchType": "EXACT", "value": "Chrome" }
          }
        },
        {
          "filter": {
            "fieldName": "countryId",
            "stringFilter": { "matchType": "EXACT", "value": "US" }
          }
        }
      ]
    }
  }
}
```

**NOT filter (exclude homepage):**
```json
{
  "dimensionFilter": {
    "notExpression": {
      "filter": {
        "fieldName": "pageTitle",
        "stringFilter": { "matchType": "EXACT", "value": "Home" }
      }
    }
  }
}
```

**Metric filter (sessions > 100):**
```json
{
  "metricFilter": {
    "filter": {
      "fieldName": "sessions",
      "numericFilter": {
        "operation": "GREATER_THAN",
        "value": { "int64Value": "100" }
      }
    }
  }
}
```

**Pivot report note:** In pivot reports, any dimension or metric that appears in a `FilterExpression` must also be declared in the request's `dimensions` or `metrics` array.

---

## 9. Compatibility System

GA4 reports fail if incompatible dimensions and metrics are requested together.

### checkCompatibility Endpoint

```
POST https://analyticsdata.googleapis.com/v1beta/{property=properties/*}:checkCompatibility
```

**Request body:**
```json
{
  "dimensions": [{ "name": "date" }],
  "metrics": [{ "name": "activeUsers" }],
  "dimensionFilter": { ... },
  "metricFilter": { ... },
  "compatibilityFilter": "COMPATIBLE"
}
```

The `compatibilityFilter` enum filters results to only `COMPATIBLE` or only `INCOMPATIBLE` items.

**Response:**
```json
{
  "dimensionCompatibilities": [
    {
      "dimensionMetadata": { "apiName": "date", "uiName": "Date", "description": "..." },
      "compatibility": "COMPATIBLE | INCOMPATIBLE"
    }
  ],
  "metricCompatibilities": [
    {
      "metricMetadata": { "apiName": "activeUsers", "uiName": "Active users", "type": "TYPE_INTEGER" },
      "compatibility": "COMPATIBLE | INCOMPATIBLE"
    }
  ]
}
```

### Compatibility Rules (Key Patterns)

- Item-scoped dimensions (`itemId`, `itemName`, `itemCategory`, etc.) are generally only compatible with item-scoped metrics (`itemRevenue`, `itemsPurchased`, etc.)
- Cohort dimensions (`cohort`, `cohortNthDay`, etc.) require cohort metrics and are incompatible with most standard metrics
- First-user dimensions cannot be freely mixed with session-level dimensions in the same request
- Audience dimensions (`audienceId`, `audienceName`) may have limited metric compatibility
- Always run `checkCompatibility` when building new dimension/metric combinations programmatically

---

## 10. Custom Dimensions and Metrics

### Defining Custom Dimensions

Custom dimensions are created in the GA4 property admin UI or via the Admin API (`properties.customDimensions`).

Three scopes are available:

| Scope | Prefix in API | Description |
|-------|--------------|-------------|
| Event-scoped | `customEvent:parameter_name` | Per-event parameter value |
| User-scoped | `customUser:parameter_name` | User-level attribute, persists across sessions |
| Item-scoped | `customItem:parameter_name` | Applied to e-commerce item parameters |

**Example in runReport request:**
```json
{
  "dimensions": [
    { "name": "customEvent:quiz_archetype" },
    { "name": "customUser:subscription_tier" }
  ]
}
```

### Defining Custom Metrics

Custom metrics are created in the GA4 UI or via Admin API (`properties.customMetrics`).

```json
{
  "metrics": [
    { "name": "customEvent:quiz_score" }
  ]
}
```

### Retrieving Custom Field Definitions

Use `getMetadata` with a real property ID to return custom dimensions and metrics for that property. Using `propertyId=0` returns only pre-defined (universal) dimensions and metrics.

### Realtime API Custom Dimension Support

Only **user-scoped** custom dimensions (`customUser:parameter_name`) are supported in Realtime reports. Event-scoped custom dimensions and custom metrics are not available in `runRealtimeReport`.

---

## 11. Metric Types and Data Types

### MetricType Enum

All metric values in responses are returned as strings. The `MetricType` tells you how to parse them.

| Enum Value | Description | Parse As |
|------------|-------------|----------|
| `METRIC_TYPE_UNSPECIFIED` | Unspecified type | — |
| `TYPE_INTEGER` | Integer type | `parseInt()` |
| `TYPE_FLOAT` | Floating point type | `parseFloat()` |
| `TYPE_SECONDS` | Duration in seconds | `parseFloat()` |
| `TYPE_MILLISECONDS` | Duration in milliseconds | `parseFloat()` |
| `TYPE_MINUTES` | Duration in minutes | `parseFloat()` |
| `TYPE_HOURS` | Duration in hours | `parseFloat()` |
| `TYPE_STANDARD` | Custom metric (standard) | `parseFloat()` |
| `TYPE_CURRENCY` | Monetary amount | `parseFloat()` — currency from `currencyCode` response field |
| `TYPE_FEET` | Length in feet | `parseFloat()` |
| `TYPE_MILES` | Length in miles | `parseFloat()` |
| `TYPE_METERS` | Length in meters | `parseFloat()` |
| `TYPE_KILOMETERS` | Length in kilometers | `parseFloat()` |

### Dimension Data Type

All dimensions return string values. Date-formatted dimensions (`date`, `dateHour`) return strings in their documented format (`YYYYMMDD`, `YYYYMMDDHH`). Parse with a date library.

---

## 12. getMetadata Method

Returns all dimensions and metrics available for a GA4 property, including custom fields.

```
GET https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}/metadata
```

**Set propertyId to `0`** for universal metadata (no custom fields). Use a real property ID to include custom dimensions and metrics.

### Response Structure

```json
{
  "name": "properties/1234/metadata",
  "dimensions": [
    {
      "apiName": "date",
      "uiName": "Date",
      "description": "The date of the event, formatted as YYYYMMDD.",
      "deprecatedApiNames": []
    }
  ],
  "metrics": [
    {
      "apiName": "activeUsers",
      "uiName": "Active users",
      "description": "The number of distinct users...",
      "type": "TYPE_INTEGER",
      "deprecatedApiNames": []
    }
  ],
  "comparisons": [
    {
      "apiName": "comparisons/1234",
      "uiName": "Comparison name",
      "description": "..."
    }
  ]
}
```

**Recommended usage pattern:** Call `getMetadata` once per session and cache the result. Use the cached list to validate dimension/metric names before constructing report requests.

---

## 13. Deprecated / Renamed Fields

GA4 API maintains backward compatibility via `deprecatedApiNames` in metadata. Known renames:

| Old Name | New Name | Notes |
|----------|----------|-------|
| `conversions` | `keyEvents` | Renamed when GA4 rebranded conversions to key events (2023) |
| `conversionRate` | `keyEventRate` | Same rebrand |
| `sessionConversionRate` | `sessionKeyEventRate` | Same rebrand |
| `userConversionRate` | `userKeyEventRate` | Same rebrand |

The old names may still work via `deprecatedApiNames` aliases, but new code should use the current names.

---

## 14. Key Constraints and Limits

| Constraint | Value |
|------------|-------|
| Max dimensions per request | 9 |
| Max metrics per request | 10 |
| Max date ranges per request | 4 (2 for cohort reports) |
| Default row limit | 10,000 |
| Max row limit | 250,000 (via `limit` field) |
| Max filter nesting depth | Not officially documented; keep shallow |
| Property quota | Returned via `returnPropertyQuota: true`; varies by property tier |
| Realtime window | ~30 minutes |

### Python Client Example

```python
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Metric, RunReportRequest,
    FilterExpression, Filter, StringFilter
)

client = BetaAnalyticsDataClient()

request = RunReportRequest(
    property="properties/YOUR_GA4_PROPERTY_ID",
    dimensions=[
        Dimension(name="eventName"),
        Dimension(name="date"),
    ],
    metrics=[
        Metric(name="eventCount"),
        Metric(name="activeUsers"),
    ],
    date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
    dimension_filter=FilterExpression(
        filter=Filter(
            field_name="eventName",
            string_filter=StringFilter(
                match_type=StringFilter.MatchType.EXACT,
                value="quiz_completed"
            )
        )
    ),
    limit=10000,
    offset=0,
)

response = client.run_report(request)
```

---

## Sources

- [API Dimensions & Metrics — Google Analytics Developer Docs](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [Exploration API Schema](https://developers.google.com/analytics/devguides/reporting/data/v1/exploration-api-schema)
- [Realtime API Schema](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)
- [Audience List API Schema](https://developers.google.com/analytics/devguides/reporting/data/v1/audience-list-api-schema)
- [FilterExpression REST Reference](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/FilterExpression)
- [checkCompatibility Reference](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility)
- [getMetadata Reference](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata)
- [MetricType Enum](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/MetricType)
- [GA4 Data API Basics](https://developers.google.com/analytics/devguides/reporting/data/v1/basics)
- [GA4 Dimensions & Metrics Explorer](https://ga-dev-tools.google/ga4/dimensions-metrics-explorer/)
- [GA4 Dimensions and Metrics (Support Article)](https://support.google.com/analytics/answer/9143382)
