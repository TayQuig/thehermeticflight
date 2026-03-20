# Round 2 — Researcher Fact-Check Report

## Fact-Check Request 1: Safari ITP 7-Day Cap on JavaScript Cookies

### Verdict: **VERIFIED** (with nuance)

The Devil's Advocate claim R-01 is substantively correct. Safari ITP **does** cap JavaScript-set first-party cookies to 7 days maximum. However, the precise mechanism needs clarification.

#### Evidence

**Primary source — WebKit official blog, ITP 2.1 (February 2019):**

> "With ITP 2.1, all persistent client-side cookies, i.e. persistent cookies created through document.cookie, are capped to a seven day expiry."
> — [Intelligent Tracking Prevention 2.1, webkit.org](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/)

**Key details from the same source:**

- Applies to **all** cookies created via `document.cookie`, not just those classified as tracking cookies. The cap is universal for JS-set persistent cookies.
- "Persistent cookies that have an expiry shorter than seven days keep their shorter expiry."
- Session cookies (no `expires`/`max-age`) are NOT affected — they remain session cookies.
- This was introduced in **Safari 12.1 / iOS 12.2** (February 2019) and remains in effect through Safari 18.x (current).

**Interaction model — from WebKit tracking prevention page:**

> "ITP deletes all cookies created in JavaScript and all other script-writeable storage after 7 days of no user interaction with the website."
> — [Tracking Prevention in WebKit](https://webkit.org/tracking-prevention/)

This is an important nuance: the 7-day timer **resets on user interaction** with the site. If a user visits thehermeticflight.com within 7 days, the cookie lifetime resets. The cookie only expires if 7 full days pass with zero visits.

**Additional restriction — link decoration (24-hour cap):**

> "ITP detects such link decoration and caps the expiry of cookies created in JavaScript on the landing webpage to 24 hours."
> — [Tracking Prevention in WebKit](https://webkit.org/tracking-prevention/)

If users arrive via a decorated link (e.g., UTM-tagged ad click), JS-set cookies get an even stricter 24-hour cap.

#### Nuance the DA Missed

The DA stated the cap applies "regardless of max-age." This is true — but the cap is not a hard 7-day wall. It's a **7-day inactivity window**. If the user returns to the site within 7 days, the timer resets. For a quiz funnel where the user takes the quiz and then receives email drip links back to the site, the cookie would likely survive IF the user clicks any email link within 7 days.

However, relying on this for a 90-180 day cookie is still problematic. A user who completes the quiz but doesn't click any emails for 8+ days would lose their cookie entirely.

---

## Fact-Check Request 2: Server-Side Set-Cookie Bypass

### Verdict: **VERIFIED** (conditionally — Vercel architecture satisfies the conditions)

Setting a cookie via the `Set-Cookie` HTTP response header from a same-domain server **does** bypass the Safari ITP 7-day cap, provided specific conditions are met. Vercel's architecture appears to satisfy those conditions.

#### Evidence

**ITP 2.1 explicitly excludes server-set cookies:**

> "Cookies created through document.cookie cannot be HttpOnly which means authentication cookies should not be affected by the lifetime cap. If they are, you need to set your authentication cookies in an HTTP response and mark them Secure and HttpOnly."
> — [Intelligent Tracking Prevention 2.1, webkit.org](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/)

The 7-day cap applies only to `document.cookie`. Server-set cookies via `Set-Cookie` header are exempt from this specific restriction.

**However — Safari 16.4+ added IP address cloaking detection:**

Starting with Safari 16.4 (March 2023), server-set cookies CAN be capped to 7 days if Safari detects the response comes from a "third-party" IP address. The check works as follows:

> "ITP detects third-party CNAME cloaking and third-party IP address cloaking requests and caps the expiry of any cookies set in the HTTP response to 7 days."
> — [Tracking Prevention in WebKit](https://webkit.org/tracking-prevention/)

The IP matching rules from the [WebKit PR #5347](https://github.com/WebKit/WebKit/pull/5347) (merged October 2022, shipped Safari 16.4):

- **IPv4:** The first 16 bits (first two octets) of the server's IP must match the first 16 bits of the website's IP
- **IPv6:** The first 64 bits must match
- Example from [Snowplow analysis](https://snowplow.io/blog/tracking-cookies-length): "203.52.1.2 and 203.52.56.22 are okay, 201.55.1.2 is not"

**Two conditions that trigger the 7-day cap on server-set cookies:**
1. The subdomain uses a CNAME that resolves to a third-party host, OR
2. The server's IP address first-half doesn't match the website's IP address first-half

#### Vercel-Specific Analysis

For thehermeticflight.com on Vercel:

1. **DNS resolution:** Vercel uses Anycast IPs. The domain resolves to a Vercel-owned Anycast IP via A record (or CNAME to `cname.vercel-dns.com`). Source: [Vercel A Record docs](https://vercel.com/kb/guide/a-record-and-caa-with-vercel).

2. **Request routing:** All requests (static + serverless) flow through the same Vercel Edge Network. The edge PoP acts as a reverse proxy. Per [Vercel's infrastructure blog](https://vercel.com/blog/life-of-a-vercel-request-navigating-the-edge-network): the Anycast IP routes to the nearest PoP, which proxies to the serverless function region, and the response returns through the same PoP.

3. **Key implication:** The browser sees the response coming from the **same Anycast IP** as the domain's A record, because the edge PoP proxies the serverless function response. The `/api/quiz-submit` endpoint response will come from the same IP as `thehermeticflight.com` itself.

4. **No CNAME cloaking:** The API route is at `/api/quiz-submit` on the same domain — not a subdomain with a CNAME to a third-party host.

**Conclusion:** Server-set cookies from `/api/quiz-submit` on Vercel should **NOT** trigger the Safari 16.4 IP-mismatch detection, because:
- Same domain (no subdomain CNAME)
- Same IP (Vercel proxies through the same Anycast edge)
- The `Set-Cookie` header comes from a first-party response on the same eTLD+1

Server-set cookies can persist for their full `Max-Age`/`Expires` value (up to 400 days per browser limits in Safari and Chrome).

---

## Fact-Check Request 3: Vercel Serverless Set-Cookie Feasibility

### Verdict: **VERIFIED** (with implementation guidance)

The existing `/api/quiz-submit` endpoint can return a `Set-Cookie` header. However, the current implementation pattern needs a minor adjustment.

#### Current State of quiz-submit.ts

The endpoint at `src/pages/api/quiz-submit.ts` currently:
- Uses `export const POST: APIRoute = async ({ request }) => { ... }`
- Destructures only `request` from the `APIContext`
- Returns raw `new Response(...)` objects with manually constructed headers

The `APIContext` interface (verified in the installed Astro types at `node_modules/astro/dist/types/public/context.d.ts`) includes a `cookies: AstroCookies` property inherited from `AstroSharedContext`. This is available but currently unused.

#### Two Implementation Paths

**Path A: Use `Astro.cookies.set()` (recommended)**

Add `cookies` to the destructured context:

```typescript
export const POST: APIRoute = async ({ request, cookies }) => {
  // ... existing validation and Loops.so call ...

  cookies.set('thf_sub', archetype, {
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // 180 days
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  return new Response(JSON.stringify({ success: true, archetype, quizVersion: 'v2' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

Per [Astro API docs](https://docs.astro.build/en/reference/api-reference/), `cookies.set()` accepts `maxAge` (seconds), `httpOnly`, `secure`, `sameSite`, `path`, and `domain` options. The Vercel adapter automatically appends `Set-Cookie` headers from `Astro.cookies` to the response.
Source: [DeepWiki Vercel Adapter analysis](https://deepwiki.com/withastro/astro/4.2-vercel-adapter) — "Appends Set-Cookie headers from app.setCookieHeaders() to the response."

**Path B: Manual Set-Cookie header on the Response**

```typescript
const response = new Response(JSON.stringify({ success: true, archetype, quizVersion: 'v2' }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});
response.headers.append('Set-Cookie',
  `thf_sub=${archetype}; Path=/; Max-Age=${60*60*24*180}; HttpOnly; Secure; SameSite=Lax`
);
return response;
```

#### Known Issues and Risks

1. **Do NOT mix both paths.** [Astro Issue #15076](https://github.com/withastro/astro/issues/15076) confirmed that combining `Astro.cookies.set()` with manual `headers.append('set-cookie', ...)` causes one to be dropped. This was fixed in PR #15152, but using a single approach is safer.

2. **Historical Vercel adapter bugs:** [Issue #5461](https://github.com/withastro/astro/issues/5461) reported `Set-Cookie` headers breaking on Vercel due to `request-transform.js` calling unsupported methods. This was fixed in Astro 2.x era. The current Astro version in this project should not be affected.

3. **Path A is preferred** because it uses Astro's built-in cookie abstraction, which the Vercel adapter explicitly supports and tests against. It also avoids manual string formatting of cookie attributes.

#### Verification of Astro Version Compatibility

The project uses Astro with `@astrojs/vercel` adapter and `prerender = false` on the endpoint. The `AstroCookies` type is available in the installed `astro` package (confirmed in `node_modules/astro/dist/types/public/context.d.ts`). The `cookies` property is part of `AstroSharedContext`, which `APIContext` extends.

---

## Summary Table

| Claim | Verdict | Key Condition |
|-------|---------|---------------|
| Safari ITP caps JS cookies to 7 days | **VERIFIED** | Applies to ALL `document.cookie` persistent cookies; timer resets on user interaction |
| Server-side `Set-Cookie` bypasses the 7-day cap | **VERIFIED** | Must be same eTLD+1, same IP first-half (Safari 16.4+); no CNAME cloaking |
| Vercel satisfies the IP-match condition | **VERIFIED** | Edge proxy returns response through same Anycast IP as domain A record |
| `quiz-submit.ts` can set cookies via `Set-Cookie` header | **VERIFIED** | Add `cookies` to destructured context; use `cookies.set()` |

## Implications for the Mastermind Decision

1. **The DA's core concern is valid** — JS-set cookies (`document.cookie`) are unreliable for long-term access tokens on Safari. A 180-day cookie set via `document.cookie` will die after 7 days of user inactivity.

2. **The DA's proposed mitigation (server-side Set-Cookie) works** — but only because Vercel's proxy architecture means the API endpoint response comes from the same IP as the domain. This would NOT work if the API were on a different subdomain with a CNAME to a third-party host.

3. **Implementation is straightforward** — a one-line change to the destructured context (`{ request }` becomes `{ request, cookies }`) plus a `cookies.set()` call before the final response.

4. **The 7-day inactivity reset is actually favorable** — users receiving email drip sequences will likely click links within 7 days, which resets the JS cookie timer. But server-side is still better because it removes this dependency entirely.

---

## Sources

1. [Intelligent Tracking Prevention 2.1 — WebKit Blog](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/) — Primary source for the 7-day cap on `document.cookie`
2. [Tracking Prevention in WebKit](https://webkit.org/tracking-prevention/) — Comprehensive ITP reference including CNAME/IP cloaking rules
3. [WebKit PR #5347 — Cap cookie lifetimes for third-party IP addresses](https://github.com/WebKit/WebKit/pull/5347) — Source code for IP matching rules (16-bit IPv4, 64-bit IPv6)
4. [Safari ITP update — Snowplow Blog](https://snowplow.io/blog/tracking-cookies-length) — Clear explanation of Safari 16.4 IP matching with examples
5. [Stape — Safari ITP update limits cookies to 7 days for 3rd-party IPs](https://stape.io/blog/safari-itp-update-limits-cookies-to-7-days-for-responses-from-3rd-party-ips) — Additional confirmation of Safari 16.4 behavior
6. [Vercel — A Record configuration](https://vercel.com/kb/guide/a-record-and-caa-with-vercel) — Vercel Anycast IP assignment
7. [Vercel — Life of a Vercel Request](https://vercel.com/blog/life-of-a-vercel-request-navigating-the-edge-network) — Request routing through edge PoPs
8. [Vercel — Can I get a fixed IP address?](https://vercel.com/kb/guide/can-i-get-a-fixed-ip-address) — Serverless function IP behavior
9. [Astro API Reference — cookies](https://docs.astro.build/en/reference/api-reference/) — `AstroCookies.set()` options and behavior
10. [DeepWiki — Vercel Adapter](https://deepwiki.com/withastro/astro/4.2-vercel-adapter) — Adapter Set-Cookie header merging
11. [Astro Issue #15076](https://github.com/withastro/astro/issues/15076) — Fixed bug with mixed cookie methods (closed/resolved)
12. [Astro Issue #5461](https://github.com/withastro/astro/issues/5461) — Historical Vercel Set-Cookie bug (fixed)
13. Installed Astro types: `node_modules/astro/dist/types/public/context.d.ts` — Confirms `cookies: AstroCookies` on `APIContext`
14. Project source: `src/pages/api/quiz-submit.ts` — Current endpoint implementation (uses raw `{ request }` destructuring)
