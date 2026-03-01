# Loops.so API Reference

**Date:** 2026-02-28
**Purpose:** Go/no-go verification for Hermetic Flight marketing pipeline
**Sources:** loops.so/docs/api-reference, loops.so/docs/llms-full.txt, loops.so/docs/events, loops.so/docs/transactional, loops.so/docs/contacts/properties, loops.so/docs/loop-builder, loops.so/docs/account/free-plan

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication](#2-authentication)
3. [Rate Limits](#3-rate-limits)
4. [Free Tier Constraints](#4-free-tier-constraints)
5. [Contacts API](#5-contacts-api)
6. [Custom Contact Properties](#6-custom-contact-properties)
7. [Mailing Lists](#7-mailing-lists)
8. [Events API](#8-events-api)
9. [Transactional Email API](#9-transactional-email-api)
10. [Automation Triggers (Loop Builder)](#10-automation-triggers-loop-builder)
11. [Pipeline Feasibility Assessment](#11-pipeline-feasibility-assessment)
12. [Hermetic Flight Integration Examples](#12-hermetic-flight-integration-examples)

---

## 1. API Overview

| Property | Value |
|----------|-------|
| Base URL | `https://app.loops.so/api/v1` |
| Protocol | HTTPS only |
| Format | JSON request/response bodies |
| Auth | Bearer token (API key) |
| CORS | Not supported -- server-side calls only |
| Max value length | 500 characters per field |
| SDKs | Official: JavaScript/TypeScript, Nuxt, PHP, Ruby |

### All Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/api-key` | Test API key validity |
| `POST` | `/v1/contacts/create` | Create a new contact |
| `PUT` | `/v1/contacts/update` | Update an existing contact (or upsert) |
| `GET` | `/v1/contacts/find?email={email}` | Find contact by email |
| `GET` | `/v1/contacts/find?userId={userId}` | Find contact by userId |
| `POST` | `/v1/contacts/delete` | Delete a contact |
| `POST` | `/v1/contacts/properties` | Create a custom contact property |
| `GET` | `/v1/contacts/properties` | List all contact properties |
| `GET` | `/v1/contacts/properties?list=custom` | List custom properties only |
| `GET` | `/v1/lists` | List all mailing lists |
| `POST` | `/v1/events/send` | Send a custom event |
| `POST` | `/v1/transactional` | Send a transactional email |
| `GET` | `/v1/transactional` | List transactional email templates |

---

## 2. Authentication

API keys are generated in the Loops dashboard at **Settings > API**.

The key is passed as a Bearer token in the `Authorization` header on every request.

**Security:** The API key must never be used client-side or exposed to end users. All calls must originate from a server (e.g., Vercel serverless functions).

### Test API Key

```js
const res = await fetch("https://app.loops.so/api/v1/api-key", {
  method: "GET",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
  },
});
const data = await res.json();
// Success: { success: true, teamName: "Your Team" }
// Failure: 401 { success: false }
```

---

## 3. Rate Limits

| Property | Value |
|----------|-------|
| Baseline | 10 requests per second per team |
| Scope | All endpoints combined |
| Exceeded | HTTP 429 Too Many Requests |

### Response Headers

Every response includes:
- `x-ratelimit-limit` -- max requests per second
- `x-ratelimit-remaining` -- remaining in current window

### Recommended Handling

Implement exponential backoff on 429 responses. For the quiz pipeline, 10 req/s is more than sufficient -- even at peak, quiz completions will not approach this limit.

---

## 4. Free Tier Constraints

| Property | Free Plan | Starter (paid) |
|----------|-----------|-----------------|
| Contacts | 1,000 | 5,000 ($49/mo) |
| Emails / 30 days | 4,000 | Unlimited |
| Features | All features | All features |
| API access | Full | Full |
| Transactional email | Included | Included |
| Automations (Loops) | Included | Included |
| Branding | "Powered by Loops" footer | Removable |

**Key finding:** The free plan has NO feature gating. API access, transactional emails, automation flows, custom properties, mailing lists, and events are all available on free. The only constraints are volume (1,000 contacts, 4,000 emails/month) and a small branding footer.

**Implication for Hermetic Flight:** 1,000 contacts and 4,000 emails/month is generous for an early-stage quiz funnel. Each quiz completion would consume approximately 1 contact slot + 1 transactional email (archetype reveal) + ~5-7 drip emails = ~6-8 emails per contact. This supports roughly 500-600 new quiz completions per month before hitting the email limit.

---

## 5. Contacts API

### Create Contact

**`POST /v1/contacts/create`**

Creates a new contact. Returns 409 if a contact with the same email already exists.

```js
const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    // Required
    email: "user@example.com",

    // Optional standard fields
    firstName: "Jane",
    lastName: "Doe",
    source: "quiz",            // overrides default "API"
    subscribed: true,          // default: true
    userGroup: "quiz_takers",  // single group string
    userId: "usr_abc123",      // external ID

    // Mailing lists (subscribe by ID)
    mailingLists: {
      "clx1abc123def456": true,
    },

    // Custom properties (added as top-level keys)
    archetype: "air_weaver",
    quizScore: 42,
    quizCompleted: true,
    quizCompletedAt: "2026-02-28",
  }),
});

const data = await res.json();
// Success (200): { success: true, id: "contact_id_here" }
// Already exists (409): { success: false, message: "An error message" }
// Bad request (400): { success: false, message: "An error message" }
```

### Update Contact

**`PUT /v1/contacts/update`**

Updates an existing contact. If no match is found by email or userId, it **creates a new contact** (upsert behavior).

```js
const res = await fetch("https://app.loops.so/api/v1/contacts/update", {
  method: "PUT",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    // At least one identifier required
    email: "user@example.com",
    // OR: userId: "usr_abc123",

    // Fields to update (all optional)
    firstName: "Jane",
    archetype: "grounded_mystic",  // custom property
    mailingLists: {
      "clx1abc123def456": true,    // subscribe to list
      "clx2xyz789ghi012": false,   // unsubscribe from list
    },
  }),
});

const data = await res.json();
// Success (200): { success: true, id: "contact_id_here" }
// Error (400): { success: false, message: "An error message" }
```

**Important:** Do not include `subscribed` unless you specifically want to change subscription status. Omitting it preserves the current value.

### Find Contact

**`GET /v1/contacts/find`**

```js
const res = await fetch(
  "https://app.loops.so/api/v1/contacts/find?email=user@example.com",
  {
    method: "GET",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
    },
  }
);

const data = await res.json();
// Returns array of contact objects (usually 0 or 1):
// [{ id: "...", email: "...", firstName: "...", archetype: "air_weaver", ... }]
// Returns empty array [] if not found
```

### Delete Contact

**`POST /v1/contacts/delete`**

```js
const res = await fetch("https://app.loops.so/api/v1/contacts/delete", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    // OR: userId: "usr_abc123"
  }),
});

const data = await res.json();
// Success (200): { success: true, message: "Contact deleted." }
// Not found (404): { success: false, message: "..." }
```

---

## 6. Custom Contact Properties

Custom properties are the key mechanism for storing archetype data on contacts.

### Supported Types

| Type | Example Values |
|------|---------------|
| `string` | `"air_weaver"`, `"grounded_mystic"` |
| `number` | `42`, `7.5` |
| `boolean` | `true`, `false` |
| `date` | `"2026-02-28"`, Unix timestamp in ms |

### Reserved Names (cannot be used)

`id`, `listId`, `softDeleteAt`, `teamId`, `updatedAt`

### Create a Custom Property via API

**`POST /v1/contacts/properties`**

```js
const res = await fetch("https://app.loops.so/api/v1/contacts/properties", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "archetype",     // must be camelCase
    type: "string",        // string | number | boolean | date
  }),
});

const data = await res.json();
// Success (200): { success: true }
```

### List Custom Properties

**`GET /v1/contacts/properties?list=custom`**

```js
const res = await fetch(
  "https://app.loops.so/api/v1/contacts/properties?list=custom",
  {
    method: "GET",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
    },
  }
);

const data = await res.json();
// Returns: [{ key: "archetype", label: "Archetype", type: "string" }, ...]
```

### How Custom Properties Enable Segmentation

Custom properties can be used in:
- **Audience filters in automations:** Filter contacts by property value at any point in a loop flow
- **Email personalization:** Insert property values as dynamic tags in email templates
- **Automation triggers:** The "Contact Updated" trigger fires when a property changes, and can be conditioned on specific value transitions
- **Audience segments:** Filter contacts in the Audience view by property values

**This directly supports archetype-based segmentation.** A contact with `archetype: "air_weaver"` can be routed through a different automation branch than one with `archetype: "grounded_mystic"`.

---

## 7. Mailing Lists

Mailing lists provide another segmentation axis. Contacts can belong to multiple lists simultaneously.

### List All Mailing Lists

**`GET /v1/lists`**

```js
const res = await fetch("https://app.loops.so/api/v1/lists", {
  method: "GET",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
  },
});

const data = await res.json();
// Returns: [{ id: "clx...", name: "Air Weaver Drip", description: "...", isPublic: true }, ...]
```

### Adding Contacts to Lists

Lists are managed through the contact create/update endpoints via the `mailingLists` field:

```js
// Subscribe to a list during contact creation
body: JSON.stringify({
  email: "user@example.com",
  mailingLists: {
    "clx_air_weaver_list_id": true,   // subscribe
  },
})

// Unsubscribe from a list via update
body: JSON.stringify({
  email: "user@example.com",
  mailingLists: {
    "clx_air_weaver_list_id": false,  // unsubscribe
  },
})
```

### Mailing Lists as Automation Triggers

The Loop Builder has a dedicated "Contact Added to List" trigger. This means you can:
1. Create a mailing list per archetype (e.g., "Air Weaver Drip", "Grounded Mystic Drip")
2. When the quiz completes, add the contact to the appropriate list via the API
3. The list addition automatically triggers the archetype-specific drip sequence

This is a clean, no-code way to route contacts into different automation flows.

---

## 8. Events API

Events are the most powerful mechanism for triggering automations from external code.

### Send Event

**`POST /v1/events/send`**

```js
const res = await fetch("https://app.loops.so/api/v1/events/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
    // Optional: prevent duplicate processing within 24 hours
    "Idempotency-Key": "quiz_user@example.com_2026-02-28",
  },
  body: JSON.stringify({
    // At least one identifier required
    email: "user@example.com",
    // OR: userId: "usr_abc123",

    // Required: the event name
    eventName: "quiz_completed",

    // Optional: event-specific data (temporary, not saved to contact)
    eventProperties: {
      archetype: "air_weaver",
      archetypeName: "The Air Weaver",
      score: 42,
      quizVersion: "v2",
    },

    // Optional: update contact properties (saved permanently to contact)
    archetype: "air_weaver",
    quizCompletedAt: "2026-02-28",

    // Optional: manage mailing list subscriptions
    mailingLists: {
      "clx_air_weaver_list_id": true,
    },
  }),
});

const data = await res.json();
// Success (200): { success: true }
// Error (400): { success: false, message: "..." }
// Duplicate idempotency key (409): { success: false, message: "..." }
```

### Key Behaviors

1. **Auto-creates contacts:** If the email/userId doesn't match an existing contact, a new contact is created automatically when the event is sent.
2. **Auto-creates events:** Sending an event with a new `eventName` automatically registers that event type in your Loops account. No pre-creation required.
3. **Contact properties persist:** Any contact properties included in the event body are saved permanently to the contact record.
4. **Event properties are temporary:** `eventProperties` values are available only for the emails triggered by this specific event instance. They are not saved to the contact.
5. **Idempotency:** The optional `Idempotency-Key` header prevents duplicate processing within a 24-hour window. Max 100 characters.

### Event Names

- Cannot contain colon characters (`:`)
- Common patterns: `signUp`, `quiz_completed`, `purchaseCompleted`, `canceled`
- Events cannot be deleted after creation

---

## 9. Transactional Email API

Transactional emails are one-off messages sent to specific recipients. They bypass subscription status (unsubscribed contacts still receive them), have no unsubscribe link, and do not track opens/clicks (improving deliverability).

### Send Transactional Email

**`POST /v1/transactional`**

```js
const res = await fetch("https://app.loops.so/api/v1/transactional", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
    // Optional: prevent duplicate sends within 24 hours
    "Idempotency-Key": "archetype_reveal_user@example.com",
  },
  body: JSON.stringify({
    // Required
    transactionalId: "cm1abc123def456",  // from Loops dashboard
    email: "user@example.com",

    // Optional: add recipient to marketing audience
    addToAudience: true,

    // Data variables for template personalization
    dataVariables: {
      firstName: "Jane",
      archetype: "The Air Weaver",
      archetypeDescription: "You move through the world like breath itself...",
      archetypeImageUrl: "https://thehermeticflight.com/images/air-weaver.jpg",
      quizResultsUrl: "https://thehermeticflight.com/results/air_weaver",
    },

    // Optional: file attachments (requires account enablement)
    // attachments: [{ filename: "result.pdf", contentType: "application/pdf", data: "base64..." }]
  }),
});

const data = await res.json();
// Success (200): { success: true }
// Template not found (404): { success: false, message: "..." }
// Duplicate (409): { success: false, message: "..." }
// Error (400): { success: false, message: "..." }
```

### Transactional Email Setup

1. Design the email in the Loops editor (or upload MJML)
2. Add data variables using `{DATA_VARIABLE:variableName}` syntax
3. Variables can be placed in: body text, button links, image links, subject line, from name, reply-to, CC, BCC
4. Publish the email (draft emails cannot be sent via API)
5. Copy the `transactionalId` from the API Details page
6. Send via the API endpoint

### Data Variables

- Case-sensitive (`firstName` and `firstname` are different)
- Can contain letters, numbers, underscores, dashes
- Values must be strings or numbers
- All non-optional variables must be included in the API call or it will fail
- Optional variables can be omitted or sent as empty string `""`
- Array variables support repeatable content blocks (e.g., product lists)

### List Transactional Email Templates

**`GET /v1/transactional`**

```js
const res = await fetch(
  "https://app.loops.so/api/v1/transactional?perPage=50",
  {
    method: "GET",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
    },
  }
);

const data = await res.json();
// Returns: {
//   pagination: { totalResults, returnedResults, perPage, totalPages, nextCursor, nextPage },
//   data: [{ id: "cm1...", name: "Archetype Reveal", lastUpdated: "...", dataVariables: [...] }]
// }
```

---

## 10. Automation Triggers (Loop Builder)

Loops provides four trigger types for automations. These are configured in the visual Loop Builder, not via the API. The API's role is to create the conditions that cause triggers to fire.

### Trigger: Contact Added

Fires when a new contact is added via the API, forms, or integrations.

- **API action that fires this:** `POST /v1/contacts/create`
- **Use case:** Welcome sequence for any new quiz taker, regardless of archetype

### Trigger: Contact Updated

Fires when a contact property changes. Can be conditioned on the previous value.

- **API action that fires this:** `PUT /v1/contacts/update` (changing a property value)
- **Use case:** Trigger when `archetype` property changes from `null` to any value

### Trigger: Contact Added to List

Fires when a contact is added to a specific mailing list.

- **API action that fires this:** `POST /v1/contacts/create` or `PUT /v1/contacts/update` with `mailingLists: { "listId": true }`
- **Use case:** Create one mailing list per archetype. When contact is added to "Air Weaver" list, trigger the Air Weaver drip sequence.

### Trigger: Event Received

Fires when a specific custom event is received via the API.

- **API action that fires this:** `POST /v1/events/send` with `eventName: "quiz_completed"`
- **Use case:** Fire a `quiz_completed` event, then use audience filters (branching) within the loop to check the contact's `archetype` property and route to the correct drip sequence.

### Audience Filters (Branching)

Inside any automation, you can add audience filter nodes that check contact properties:
- Filter by `archetype == "air_weaver"` to route to the Air Weaver branch
- Filter by `archetype == "grounded_mystic"` to route to the Grounded Mystic branch
- Filters can apply to all subsequent nodes or just the next node

---

## 11. Pipeline Feasibility Assessment

### Question 1: Can the API create/update contacts with custom fields like an "archetype" tag?

**YES.** Custom contact properties support string, number, boolean, and date types. An `archetype` string property (e.g., `"air_weaver"`, `"grounded_mystic"`) can be:
- Created via `POST /v1/contacts/properties` (one-time setup)
- Set during contact creation via `POST /v1/contacts/create`
- Updated via `PUT /v1/contacts/update`
- Included in event payloads via `POST /v1/events/send`

Custom properties are added as top-level keys in the request body alongside standard fields.

### Question 2: Can automation flows be triggered programmatically via the API?

**YES, via three mechanisms:**
1. **Contact creation** triggers "Contact Added" automations
2. **Mailing list addition** triggers "Contact Added to List" automations
3. **Custom events** trigger "Event Received" automations

Automations are configured in the Loop Builder UI. The API provides the data/events that cause those triggers to fire. You do not call an API endpoint to "start" an automation -- you create the condition that the automation is listening for.

### Question 3: Can custom events trigger specific automation flows?

**YES.** The Events API (`POST /v1/events/send`) sends named events like `quiz_completed`. In the Loop Builder, you configure an automation with an "Event Received" trigger set to `quiz_completed`. When the API sends that event, the automation fires. Event properties (temporary data) and contact properties (persistent data) can both be included.

### Question 4: Can contacts be segmented by custom properties for drip sequences?

**YES, via two approaches:**

**Approach A -- Mailing Lists (simpler):**
Create one mailing list per archetype. Add the contact to the correct list during creation. Each list has its own automation with a "Contact Added to List" trigger.

**Approach B -- Event + Branching (more flexible):**
Send a single `quiz_completed` event. One automation with an "Event Received" trigger handles all archetypes. Inside the automation, use audience filter nodes to branch by the `archetype` contact property.

### Question 5: Can the API send one-off transactional emails?

**YES.** The Transactional Email API (`POST /v1/transactional`) sends immediate one-off emails with data variables for personalization. This is ideal for the archetype reveal email:
- Design the template in the Loops editor with variables like `{DATA_VARIABLE:archetypeName}`, `{DATA_VARIABLE:archetypeDescription}`
- Send via API immediately after quiz completion
- Bypasses subscription status (always delivered)
- No open/click tracking (better deliverability for critical emails)
- Recipients do not need to be in your audience (use `addToAudience: true` to add them)

### Question 6: How does auth work?

**Bearer token.** Generate an API key in Settings > API. Pass it as `Authorization: Bearer YOUR_API_KEY`. Server-side only -- never expose client-side. One key per team.

### Question 7: What are the rate limits?

**10 requests per second per team** across all endpoints. Response headers report remaining quota. HTTP 429 on exceeded. For the quiz pipeline, this is more than sufficient.

### Question 8: Are any API features gated behind paid plans?

**NO.** The free tier includes full API access, transactional emails, automation flows, custom properties, mailing lists, and events. The only constraints are 1,000 contacts and 4,000 emails per 30 days. A small "Powered by Loops" branding footer appears on emails.

---

## 12. Hermetic Flight Integration Examples

These examples show the exact `fetch()` calls a Vercel serverless function would make to implement the quiz-to-drip pipeline.

### One-Time Setup: Create Custom Properties

Run once (or check idempotently) to ensure the `archetype` property exists.

```js
// /api/setup-loops.js (run once or on deploy)

export default async function handler(req, res) {
  const LOOPS_API_KEY = process.env.LOOPS_API_KEY;

  // Create the archetype property
  const result = await fetch("https://app.loops.so/api/v1/contacts/properties", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOOPS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "archetype",
      type: "string",
    }),
  });

  const data = await result.json();
  res.status(200).json(data);
}
```

### Full Pipeline: Quiz Completion Handler

This is the primary serverless function called when a user completes the quiz. It performs three actions in sequence:

```js
// /api/quiz-complete.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
  const { email, firstName, archetype } = req.body;

  // Validate required fields
  if (!email || !archetype) {
    return res.status(400).json({ error: "Missing email or archetype" });
  }

  const headers = {
    "Authorization": `Bearer ${LOOPS_API_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // -------------------------------------------------------
    // Step 1: Send the quiz_completed event
    //
    // This does three things simultaneously:
    //   - Creates the contact if they don't exist
    //   - Sets their archetype property permanently
    //   - Fires the quiz_completed event (triggers automation)
    // -------------------------------------------------------
    const eventRes = await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: {
        ...headers,
        "Idempotency-Key": `quiz_${email}_${new Date().toISOString().split("T")[0]}`,
      },
      body: JSON.stringify({
        email,
        eventName: "quiz_completed",

        // Saved permanently to contact record
        firstName: firstName || "",
        archetype,
        source: "quiz",

        // Temporary event data (available in triggered emails)
        eventProperties: {
          archetype,
          completedAt: new Date().toISOString(),
        },

        // Subscribe to archetype-specific mailing list
        mailingLists: {
          [getMailingListId(archetype)]: true,
        },
      }),
    });

    const eventData = await eventRes.json();

    if (!eventData.success) {
      console.error("Event send failed:", eventData.message);
      return res.status(500).json({ error: eventData.message });
    }

    // -------------------------------------------------------
    // Step 2: Send the immediate archetype reveal email
    //
    // Transactional email -- sent immediately, bypasses
    // subscription status, no open tracking.
    // -------------------------------------------------------
    const archetypeData = getArchetypeData(archetype);

    const txRes = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        ...headers,
        "Idempotency-Key": `reveal_${email}_${archetype}`,
      },
      body: JSON.stringify({
        transactionalId: process.env.LOOPS_ARCHETYPE_REVEAL_TEMPLATE_ID,
        email,
        addToAudience: true,
        dataVariables: {
          firstName: firstName || "Seeker",
          archetypeName: archetypeData.name,
          archetypeDescription: archetypeData.description,
          archetypeImageUrl: archetypeData.imageUrl,
          resultsUrl: `https://thehermeticflight.com/results/${archetype}`,
        },
      }),
    });

    const txData = await txRes.json();

    if (!txData.success) {
      console.error("Transactional send failed:", txData.message);
      // Non-fatal: the drip sequence will still trigger from the event
    }

    return res.status(200).json({
      success: true,
      contact: eventData,
      revealEmail: txData,
    });

  } catch (error) {
    console.error("Quiz completion handler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Maps archetype slugs to mailing list IDs (configured in Loops dashboard)
function getMailingListId(archetype) {
  const lists = {
    air_weaver: process.env.LOOPS_LIST_AIR_WEAVER,
    grounded_mystic: process.env.LOOPS_LIST_GROUNDED_MYSTIC,
    flame_keeper: process.env.LOOPS_LIST_FLAME_KEEPER,
    water_bearer: process.env.LOOPS_LIST_WATER_BEARER,
    // ... add all archetypes
  };
  return lists[archetype] || lists.air_weaver; // fallback
}

// Archetype content data (could also live in a CMS or config file)
function getArchetypeData(archetype) {
  const archetypes = {
    air_weaver: {
      name: "The Air Weaver",
      description: "You move through the world like breath itself...",
      imageUrl: "https://thehermeticflight.com/images/archetypes/air-weaver.jpg",
    },
    grounded_mystic: {
      name: "The Grounded Mystic",
      description: "Your roots run deep into the earth...",
      imageUrl: "https://thehermeticflight.com/images/archetypes/grounded-mystic.jpg",
    },
    // ... add all archetypes
  };
  return archetypes[archetype] || archetypes.air_weaver;
}
```

### Environment Variables Required

```env
LOOPS_API_KEY=your_loops_api_key_here
LOOPS_ARCHETYPE_REVEAL_TEMPLATE_ID=cm1abc123def456
LOOPS_LIST_AIR_WEAVER=clx1abc123def456
LOOPS_LIST_GROUNDED_MYSTIC=clx2xyz789ghi012
LOOPS_LIST_FLAME_KEEPER=clx3...
LOOPS_LIST_WATER_BEARER=clx4...
```

### Automation Flow Architecture (configured in Loops UI)

```
Option A: One automation per archetype
==========================================
[Contact Added to List: "Air Weaver Drip"]
  --> [Wait 1 day]
  --> [Send Email: Air Weaver Day 1]
  --> [Wait 2 days]
  --> [Send Email: Air Weaver Day 3]
  --> [Wait 4 days]
  --> [Send Email: Air Weaver Day 7]

[Contact Added to List: "Grounded Mystic Drip"]
  --> [Wait 1 day]
  --> [Send Email: Grounded Mystic Day 1]
  --> ...


Option B: Single automation with branching
==========================================
[Event Received: "quiz_completed"]
  --> [Audience Filter: archetype == "air_weaver"]
      --> [Send Email: Air Weaver Day 1]
      --> [Wait 2 days]
      --> ...
  --> [Audience Filter: archetype == "grounded_mystic"]
      --> [Send Email: Grounded Mystic Day 1]
      --> ...
```

**Recommendation:** Option A (one automation per archetype) is simpler to manage and debug. Each mailing list triggers its own independent drip sequence. Adding a new archetype means creating a new list and a new automation, with zero changes to existing flows.

---

## Go/No-Go Verdict

**GO.** Loops.so fully supports every requirement for the Hermetic Flight marketing pipeline:

| Requirement | Supported | Mechanism |
|-------------|-----------|-----------|
| Create contacts with archetype tag | Yes | Custom properties on create/update |
| Trigger automations from API | Yes | Events, list additions, contact creation |
| Custom events for drip triggers | Yes | `POST /v1/events/send` with `eventName` |
| Segment by archetype | Yes | Custom properties + audience filters, or mailing lists |
| Immediate transactional email | Yes | `POST /v1/transactional` with data variables |
| Server-side auth | Yes | Bearer token, server-only |
| Free tier viability | Yes | 1,000 contacts / 4,000 emails/mo, all features |
| Vercel serverless compatibility | Yes | Standard REST API, no CORS needed for server calls |

**No blockers identified.** The single serverless function pattern (send event + send transactional email) handles the entire quiz completion flow in two API calls. Loops manages all downstream automation, drip sequencing, and email delivery.
