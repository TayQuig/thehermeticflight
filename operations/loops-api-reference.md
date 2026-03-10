# Loops.so API Reference Guide

> Compiled from https://loops.so/docs/api-reference/ and https://app.loops.so/openapi.json — 2026-03-08

## Overview

Loops.so is an email marketing platform for SaaS companies. Its REST API
enables server-side contact management, event-triggered emails, transactional
emails, mailing list management, and contact property configuration.

**Key constraints:**
- Server-side only — CORS is not supported. Never expose the API key client-side.
- All request/response bodies are JSON (`Content-Type: application/json`).
- Maximum 500 characters per field value (including quotes).

## Authentication

All requests require a Bearer token in the `Authorization` header.

```
Authorization: Bearer YOUR_API_KEY
```

Generate API keys at: https://app.loops.so/settings?page=api

Keys can be assigned human-readable names for identification. Your API key
should never be used client-side or exposed to end users.

### Test API Key

```
GET https://app.loops.so/api/v1/api-key
```

**Success (200):**
```json
{
  "success": true,
  "teamName": "The Hermetic Flight"
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Invalid API key",
  "error": "Invalid API key"
}
```

> **Note:** The `error` field is deprecated. Use `message` instead.

## Rate Limiting

- **Baseline limit:** 10 requests per second per team
- **Exceeded:** HTTP 429 (Too Many Requests)
- **Strategy:** Exponential backoff retry

**Response headers on every API response:**

| Header | Description |
|--------|-------------|
| `x-ratelimit-limit` | Maximum requests per second |
| `x-ratelimit-remaining` | Requests remaining in current window |

## Base URL

```
https://app.loops.so/api/v1
```

All endpoint paths below are relative to this base URL.

## Idempotency

The `events/send` and `transactional` endpoints support an optional
`Idempotency-Key` header (max 100 characters). If the same key is sent
within 24 hours, the API returns `409 Conflict` instead of processing a
duplicate request.

```
Idempotency-Key: unique-request-id-here
```

---

## Contacts

### Create Contact

Creates a new contact in your audience.

```
POST /contacts/create
```

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | **Yes** | Contact's email address |
| `firstName` | string | No | First name |
| `lastName` | string | No | Last name |
| `source` | string | No | Custom source value (replaces default "API") |
| `subscribed` | boolean | No | Campaign/loop email eligibility. Default: `true`. Omit unless you specifically want to unsubscribe or re-subscribe. |
| `userGroup` | string | No | User segmentation group. Contact can belong to only one group at a time. |
| `userId` | string | No | External application user identifier |
| `mailingLists` | object | No | Key-value pairs of list IDs → boolean subscription status |
| *custom properties* | string/number/boolean/date | No | Any custom contact property as a top-level field |

**Example Request:**
```bash
curl -X POST https://app.loops.so/api/v1/contacts/create \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "firstName": "Alice",
    "source": "quiz",
    "mailingLists": {"cm06f5v0e45nf0ml5754o9cix": true},
    "archetype": "air_weaver"
  }'
```

**Success (200):**
```json
{
  "success": true,
  "id": "cll6b3i8901a9jx0oyktl2m4u"
}
```

**Error (409 Conflict — contact already exists):**
```json
{
  "success": false,
  "message": "An error message"
}
```

**Error (400 Bad Request):**
```json
{
  "success": false,
  "message": "An error message"
}
```

**Notes:**
- Send `null` values to reset contact properties.
- Reserved property names cannot be used for custom attributes.

---

### Update Contact

Updates an existing contact, or creates one if no match is found.

```
PUT /contacts/update
```

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | One of email/userId required | Contact's email address |
| `userId` | string | One of email/userId required | Contact's unique user ID |
| `firstName` | string | No | First name |
| `lastName` | string | No | Last name |
| `source` | string | No | Custom source value |
| `subscribed` | boolean | No | Campaign/loop email eligibility |
| `userGroup` | string | No | User segmentation group |
| `mailingLists` | object | No | List ID → boolean pairs |
| *custom properties* | string/number/boolean/date | No | Top-level custom fields |

**Lookup behavior:** If both `email` and `userId` are provided, the system
looks for a contact matching **either** value. If no match exists, a new
contact is created.

**Example Request:**
```bash
curl -X PUT https://app.loops.so/api/v1/contacts/update \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "archetype": "shadow_dancer",
    "subscribed": true
  }'
```

**Success (200):**
```json
{
  "success": true,
  "id": "cll6b3i8901a9jx0oyktl2m4u"
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Notes:**
- Creates a new contact if no match is found (upsert behavior).
- Send `null` to reset property values.
- Reserved property names cannot be used for custom fields.

---

### Find Contact

Retrieves a contact by email or userId.

```
GET /contacts/find?email=VALUE
GET /contacts/find?userId=VALUE
```

**Query Parameters (mutually exclusive — provide only one):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | One of | Contact's email address (must be URI-encoded) |
| `userId` | string | One of | Contact's unique user identifier |

**Example Request:**
```bash
curl -G https://app.loops.so/api/v1/contacts/find \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  --data-urlencode "email=user@example.com"
```

**Success (200) — returns an array:**
```json
[
  {
    "id": "cll6b3i8901a9jx0oyktl2m4u",
    "email": "user@example.com",
    "firstName": "Alice",
    "lastName": null,
    "source": "API",
    "subscribed": true,
    "userGroup": "",
    "userId": null,
    "mailingLists": {
      "cm06f5v0e45nf0ml5754o9cix": true
    },
    "optInStatus": "accepted"
  }
]
```

**No match:** Returns empty array `[]`

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Loops-assigned contact ID |
| `email` | string | Email address |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `source` | string | How the contact was created |
| `subscribed` | boolean | Campaign email eligibility |
| `userGroup` | string | Segmentation group |
| `userId` | string | External user ID |
| `mailingLists` | object | List ID → boolean subscriptions |
| `optInStatus` | string | Double opt-in status: `"pending"`, `"accepted"`, `"rejected"`, or `null` |

**Error (400):**
```json
{
  "success": false,
  "message": "An error message"
}
```

---

### Delete Contact

Permanently deletes a contact from your audience.

```
POST /contacts/delete
```

**Request Body (provide one):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | One of | Contact's email address |
| `userId` | string | One of | Contact's user ID |

**Example Request:**
```bash
curl -X POST https://app.loops.so/api/v1/contacts/delete \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Success (200):**
```json
{
  "success": true,
  "message": "Contact deleted."
}
```

**Error (404 — not found):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "An error message."
}
```

---

## Contact Properties

### Create Contact Property

Creates a new custom property for contacts.

```
POST /contacts/properties
```

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **Yes** | Property name in `camelCase` (e.g., `planName`, `favoriteColor`) |
| `type` | string | **Yes** | Value type: `string`, `number`, `boolean`, or `date` |

**Example Request:**
```bash
curl -X POST https://app.loops.so/api/v1/contacts/properties \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "archetype", "type": "string"}'
```

**Success (200):**
```json
{
  "success": true
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Notes:**
- Property names must be camelCase.
- Reserved property names cannot be used.

---

### List Contact Properties

Returns all contact properties (default + custom) or only custom properties.

```
GET /contacts/properties
GET /contacts/properties?list=custom
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `list` | string | No | `all` | Use `custom` to return only team-defined properties |

**Example Request:**
```bash
curl https://app.loops.so/api/v1/contacts/properties \
  -H "Authorization: Bearer $LOOPS_API_KEY"
```

**Success (200) — returns an array:**
```json
[
  {"key": "firstName", "label": "First name", "type": "string"},
  {"key": "lastName", "label": "Last name", "type": "string"},
  {"key": "email", "label": "Email", "type": "string"},
  {"key": "subscribed", "label": "Subscribed", "type": "boolean"},
  {"key": "createdAt", "label": "Created at", "type": "date"},
  {"key": "archetype", "label": "Archetype", "type": "string"}
]
```

**Custom-only response (`?list=custom`):**
```json
[
  {"key": "archetype", "label": "Archetype", "type": "string"}
]
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Property's name key |
| `label` | string | Human-friendly label |
| `type` | string | `string`, `number`, `boolean`, or `date` |

---

## Mailing Lists

### List Mailing Lists

Returns all mailing lists for your account.

```
GET /lists
```

**Example Request:**
```bash
curl https://app.loops.so/api/v1/lists \
  -H "Authorization: Bearer $LOOPS_API_KEY"
```

**Success (200) — returns an array:**
```json
[
  {
    "id": "cm06f5v0e45nf0ml5754o9cix",
    "name": "Newsletter",
    "description": "Weekly updates",
    "isPublic": true
  }
]
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | List ID (use in `mailingLists` objects) |
| `name` | string | List name |
| `description` | string\|null | List description, `null` if not set |
| `isPublic` | boolean | Whether the list is public or private |

**Empty account:** Returns `[]`

---

## Events

### Send Event

Triggers event-based automations (loops) for a contact. This is the primary
endpoint for the quiz submission pipeline.

```
POST /events/send
```

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | **Yes** | `Bearer YOUR_API_KEY` |
| `Content-Type` | **Yes** | `application/json` |
| `Idempotency-Key` | No | Max 100 chars. Prevents duplicate processing within 24 hours. |

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | One of email/userId | Contact's email address |
| `userId` | string | One of email/userId | Contact's unique user ID |
| `eventName` | string | **Yes** | Name of the event to trigger |
| `eventProperties` | object | No | Event-specific data (string/number/boolean/date values). Available in triggered emails but NOT saved to contact. |
| `mailingLists` | object | No | List ID → boolean pairs to update subscriptions |
| *contact properties* | string/number/boolean/date | No | Top-level custom fields. These ARE saved to the contact permanently. |

**Critical distinction:**
- `eventProperties` → available in triggered emails as template variables, but **not persisted** to the contact record.
- Top-level custom properties (e.g., `archetype`, `firstName`) → **persisted permanently** to the contact record.

**Example Request (quiz submission):**
```bash
curl -X POST https://app.loops.so/api/v1/events/send \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: quiz-2026-03-08-user@example.com" \
  -d '{
    "email": "user@example.com",
    "firstName": "Alice",
    "eventName": "quiz_completed",
    "archetype": "air_weaver",
    "mailingLists": {"cm06f5v0e45nf0ml5754o9cix": true},
    "eventProperties": {
      "archetypeName": "The Air Weaver",
      "archetypeDescription": "You move through the world like breath itself..."
    }
  }'
```

**Success (200):**
```json
{
  "success": true
}
```

**Error (409 — duplicate idempotency key within 24h):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Notes:**
- If the contact doesn't exist, it is created automatically.
- Contact properties are updated/set on every event send.
- The `eventName` must match an event trigger configured in a Loop
  within the Loops.so dashboard.

---

## Transactional Emails

### Send Transactional Email

Sends a one-off transactional email using a pre-built template.

```
POST /transactional
```

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | **Yes** | `Bearer YOUR_API_KEY` |
| `Content-Type` | **Yes** | `application/json` |
| `Idempotency-Key` | No | Max 100 chars. Prevents duplicates within 24 hours. |

**Request Body:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | **Yes** | Recipient's email address |
| `transactionalId` | string | **Yes** | ID of the transactional email template |
| `addToAudience` | boolean | No | If `true`, creates a contact in your audience. Default: `false`. |
| `dataVariables` | object | No | Template variables as strings or numbers. Optional vars can be omitted or set to `""`. |
| `attachments` | array | No | File attachments (requires account enablement) |

**Attachment object format:**

| Field | Type | Description |
|-------|------|-------------|
| `filename` | string | File name with extension |
| `contentType` | string | MIME type (e.g., `application/pdf`) |
| `data` | string | Base64-encoded file content |

**Example Request:**
```bash
curl -X POST https://app.loops.so/api/v1/transactional \
  -H "Authorization: Bearer $LOOPS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "transactionalId": "cm1a2b3c4d5e6f7g8h9i0",
    "addToAudience": true,
    "dataVariables": {
      "userName": "Alice",
      "archetypeName": "The Air Weaver"
    }
  }'
```

**Success (200):**
```json
{
  "success": true
}
```

**Error (404 — template not found):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Error (409 — duplicate idempotency key):**
```json
{
  "success": false,
  "message": "An error message."
}
```

**Error (400):**
```json
{
  "success": false,
  "message": "An error message."
}
```

---

### List Transactional Emails

Returns a paginated list of published transactional email templates.

```
GET /transactional
```

**Query Parameters:**

| Parameter | Type | Required | Default | Constraints |
|-----------|------|----------|---------|-------------|
| `perPage` | string | No | `20` | Must be between 10 and 50 |
| `cursor` | string | No | — | Pagination cursor from `pagination.nextCursor` |

**Example Request:**
```bash
curl "https://app.loops.so/api/v1/transactional?perPage=20" \
  -H "Authorization: Bearer $LOOPS_API_KEY"
```

**Success (200):**
```json
{
  "pagination": {
    "totalResults": 23,
    "returnedResults": 20,
    "perPage": 20,
    "totalPages": 2,
    "nextCursor": "abc123",
    "nextPage": "https://app.loops.so/api/v1/transactional?perPage=20&cursor=abc123"
  },
  "data": [
    {
      "id": "cm1a2b3c4d5e6f7g8h9i0",
      "name": "Welcome Email",
      "lastUpdated": "2026-01-15T10:30:00.000Z",
      "dataVariables": ["userName", "archetypeName"]
    }
  ]
}
```

**Pagination fields:**

| Field | Type | Description |
|-------|------|-------------|
| `totalResults` | number | Total templates available |
| `returnedResults` | number | Templates in this response |
| `perPage` | number | Page size |
| `totalPages` | number | Total pages |
| `nextCursor` | string\|null | Cursor for next page, `null` on last page |
| `nextPage` | string\|null | Full URL for next page |

---

## Dedicated Sending IPs

### List Dedicated IPs

Returns dedicated sending IP addresses for your account.

```
GET /dedicated-sending-ips
```

**Example Request:**
```bash
curl https://app.loops.so/api/v1/dedicated-sending-ips \
  -H "Authorization: Bearer $LOOPS_API_KEY"
```

**Success (200):**
```json
["192.0.2.1", "192.0.2.2"]
```

---

## Deprecated Endpoints

### List Custom Fields (DEPRECATED)

Use [List Contact Properties](#list-contact-properties) with `?list=custom` instead.

```
GET /contacts/properties?list=custom
```

The old endpoint returned the same `{key, label, type}` array format.

---

## Complete Endpoint Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api-key` | Test API key |
| `POST` | `/contacts/create` | Create contact |
| `PUT` | `/contacts/update` | Update/upsert contact |
| `GET` | `/contacts/find` | Find contact by email or userId |
| `POST` | `/contacts/delete` | Delete contact |
| `POST` | `/contacts/properties` | Create contact property |
| `GET` | `/contacts/properties` | List contact properties |
| `GET` | `/lists` | List mailing lists |
| `POST` | `/events/send` | Send event (trigger automations) |
| `POST` | `/transactional` | Send transactional email |
| `GET` | `/transactional` | List transactional email templates |
| `GET` | `/dedicated-sending-ips` | List dedicated IPs |

All paths relative to `https://app.loops.so/api/v1`.

---

## Error Response Pattern

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

**Common status codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid params, missing fields, value too long) |
| 401 | Invalid or missing API key |
| 404 | Resource not found (contact, template) |
| 409 | Conflict (duplicate contact on create, duplicate idempotency key) |
| 429 | Rate limit exceeded |

---

## Hermetic Flight Integration Notes

This section documents how The Hermetic Flight project uses the Loops.so API.

### Quiz Submission Flow

The quiz submission endpoint (`src/pages/api/quiz-submit.ts`) uses
`POST /events/send` with:

- **eventName:** `quiz_completed`
- **Contact properties (persisted):** `firstName`, `archetype` (slug),
  `mailingLists`
- **Event properties (template-only):** `archetypeName`, `archetypeDescription`,
  `archetypeElement`
- **Idempotency:** `quiz-YYYY-MM-DD-email` prevents same-day duplicate
  submissions

### Weekly Report Subscriber Metrics

The weekly-report skill needs these endpoints:

| Metric | Endpoint | How |
|--------|----------|-----|
| Total subscribers | `GET /contacts/find` | Not directly available. Use `GET /lists` to get list IDs, then there is no bulk count endpoint. **Alternative:** Use Loops.so dashboard export or track counts manually. |
| Subscribers by archetype | `GET /contacts/find` | Query one at a time — no bulk filter endpoint exists. **Alternative:** Track archetype counts via event-driven counter or dashboard export. |
| New subscribers this period | No endpoint | Loops.so API does not expose time-range queries or creation timestamps in bulk. **Alternative:** Track via dashboard analytics or event-driven counter. |

**Key limitation:** The Loops.so REST API does not support bulk contact listing,
filtering, or aggregate counting. The `/contacts/find` endpoint returns a single
contact by email or userId. For subscriber metrics, use the Loops.so dashboard
analytics directly or maintain a local counter updated via webhooks/events.

### Launch Sequence Email Scheduling

The launch-sequence skill uses a **manual workflow** (not API-driven):

1. Draft emails as markdown in `operations/launch-emails/`
2. Present schedule to operator
3. Operator creates campaigns in the Loops.so dashboard manually

Loops.so does not expose a broadcast/campaign scheduling API. Campaigns and
broadcasts are managed exclusively through the dashboard UI.

### OpenAPI Specification

Machine-readable specs available at:
- **YAML:** https://app.loops.so/openapi.yaml
- **JSON:** https://app.loops.so/openapi.json
