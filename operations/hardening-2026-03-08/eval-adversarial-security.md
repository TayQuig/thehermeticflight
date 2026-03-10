# Adversarial Security Evaluation: Share CTA & OG Meta Tags

**Evaluator Lens:** Security (adversarial — can this be broken, exploited, or gamed?)
**Feature:** Share CTA & OG Meta Tags for The Hermetic Flight
**Date:** 2026-03-08
**Scope:** New code only — OG meta infrastructure, 6 static result pages, share buttons, GA4 tracking, placeholder OG images

---

## Executive Summary

The Share CTA & OG Meta Tags feature has a strong security posture for a static-output Astro site. The implementation avoids common XSS vectors: all DOM writes use `textContent` (never `innerHTML`), Astro's build-time HTML escaping covers meta tag attributes, and archetype data originates from a hardcoded TypeScript record with no user input path. The two real findings are: (1) the absence of a Content Security Policy, which is a pre-existing site-wide gap magnified by the number of inline scripts and third-party domains this feature relies on, and (2) a minor clipboard API error-handling gap. No critical or high-severity vulnerabilities were found in the new code.

---

## Findings

| ID | Title | Severity | Description | Affected File(s) | Evidence |
|----|-------|----------|-------------|-------------------|----------|
| ADV-01 | No Content Security Policy | Medium | The site has no CSP headers configured (no `vercel.json`, no `_headers` file, no `<meta http-equiv="Content-Security-Policy">`). The layout loads inline scripts (`is:inline` for GTM, GA4, Meta Pixel), external scripts from 4 domains (`googletagmanager.com`, `google-analytics.com`, `connect.facebook.net`, `fonts.googleapis.com`), and the quiz/result pages add further inline `<script>` blocks. Without CSP, any future XSS vector (e.g., a compromised third-party script, a rogue GTM tag, or a stored XSS via the blog) could execute arbitrary code with no browser-level mitigation. This is a **pre-existing site-wide gap**, not introduced by this feature, but this feature increases the inline script surface area. | `src/layouts/Layout.astro` (lines 24-52), `src/pages/quiz/result/[archetype].astro` (lines 109-133) | No CSP-related configuration found anywhere in the codebase (confirmed via grep for `Content-Security-Policy`). |
| ADV-02 | Clipboard API has no error handling | Low | Both `quiz.astro` (line 408) and `[archetype].astro` (line 114) call `navigator.clipboard.writeText()` with `await` but no `try/catch`. If the Clipboard API is denied by browser permissions (e.g., non-HTTPS context, iframe sandbox, or user permission revocation), the promise rejects with a `DOMException`. This would cause an unhandled promise rejection, and the "Copied!" feedback would never appear, confusing the user. Not a security vulnerability per se, but a robustness gap in a user-facing security-adjacent API. | `src/pages/quiz.astro` (line 408), `src/pages/quiz/result/[archetype].astro` (line 114) | `await navigator.clipboard.writeText(shareUrl);` with no surrounding try/catch. |

---

## Detailed Analysis by Question

### 1. XSS via meta tags

**Verdict: Not exploitable.**

Astro auto-escapes all expression values (`{title}`, `{description}`, etc.) when rendered into HTML attribute context. The expression syntax `content={title}` in `.astro` files goes through Astro's built-in HTML escaper, which encodes `"`, `<`, `>`, `&`, and `'`. This means even if archetype descriptions contained `"onload="alert(1)`, the output would be safely escaped to `&quot;onload=&quot;alert(1)`.

More importantly, all archetype data originates from a hardcoded TypeScript record (`src/lib/archetype-content.ts`, lines 12-61). There is no path for user input to reach these values. The data is:
- Defined at build time in source code
- Used by `getStaticPaths()` which runs at build time
- Never derived from URL parameters, query strings, or user input

The descriptions do contain apostrophes (e.g., `'You move through the world like breath itself'`), but Astro handles these correctly in attribute context.

### 2. Open redirect via share URLs

**Verdict: Not exploitable.**

The share URLs are constructed in two places:

**Static result pages** (`[archetype].astro`, lines 69-78): The X and Facebook share URLs are built at build time using `encodeURIComponent()` on hardcoded strings. The `urlSlug` variable comes from `toUrlSlug(archetype.slug)`, where `archetype.slug` is one of exactly 6 hardcoded values. There is no user-controlled input in these URLs.

**Quiz page** (`quiz.astro`, lines 392-405): The share URLs are built at runtime in the client script, but `quizArchetype` is set from `classify(scores)` which returns one of 6 hardcoded `ArchetypeSlug` values. The `replace(/_/g, '-')` transform on line 392 can only produce the expected URL slugs. The base URLs (`https://x.com/intent/tweet`, `https://www.facebook.com/sharer/sharer.php`) are hardcoded strings.

An attacker cannot inject a redirect target because:
- The share URL domain is always `https://www.thehermeticflight.com`
- The path is always `/quiz/result/{one-of-six-slugs}`
- Both values are `encodeURIComponent`-encoded before interpolation

### 3. URL injection via archetype slug

**Verdict: Not exploitable.**

The `[archetype].astro` page uses `getStaticPaths()`, meaning only the 6 paths explicitly returned by `getStaticPaths` are valid. Any other path returns a 404. There is no dynamic routing that could accept arbitrary input.

The `archetypeByUrlSlug()` function (line 69-72 of `archetype-content.ts`) does accept arbitrary strings and performs `replace(/-/g, '_')`, but this function is only used in the static page context where the input is already constrained by `getStaticPaths`. A crafted slug like `../../etc/passwd` would simply return `undefined` from the lookup and produce no page (404 at build time).

The `toUrlSlug()` function (line 64-66) only operates on `ArchetypeSlug` type values, which TypeScript constrains to the 6 known strings.

### 4. Clipboard API abuse

**Verdict: Not exploitable, but minor robustness gap (see ADV-02).**

The `navigator.clipboard.writeText()` calls on both pages are attached to `click` event listeners, which guarantees a user gesture precondition. Browsers require a recent user activation (click, tap, keypress) to allow clipboard writes, and both call sites are inside `click` handlers:
- `quiz.astro` line 407: Inside `shareCopy.addEventListener('click', ...)`
- `[archetype].astro` line 113: Inside `copyBtn.addEventListener('click', ...)`

The clipboard API cannot be triggered programmatically without a user gesture. The only concern is the lack of error handling (ADV-02).

### 5. DOM manipulation / innerHTML

**Verdict: No vulnerability.**

The quiz page's script block (lines 197-448 of `quiz.astro`) uses `textContent` exclusively for all DOM writes:
- Line 263: `progressText.textContent = ...`
- Line 279: `resultTitle.textContent = content.title`
- Line 280: `resultElement.textContent = ...`
- Line 281: `resultDescription.textContent = content.description`
- Line 372: `submitBtn.textContent = 'Sending...'`
- Line 409: `shareCopyText.textContent = 'Copied!'`

`textContent` sets raw text, not HTML. It does not parse or render HTML entities, tags, or event handlers. A grep for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `document.write` across the entire `src/` directory returned zero matches in any of the feature files.

The only `set:html` usage in the codebase is in `src/components/AccordionItem.astro`, which is unrelated to this feature.

### 6. Share URL construction / encodeURIComponent sufficiency

**Verdict: Sufficient.**

Both construction paths use `encodeURIComponent()`:

**Static pages** (`[archetype].astro` line 69):
```astro
href={`https://x.com/intent/tweet?text=${encodeURIComponent(...)}&url=${encodeURIComponent(...)}`}
```

**Quiz page** (`quiz.astro` lines 404-405):
```typescript
shareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
shareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
```

`encodeURIComponent()` encodes all characters except `A-Z a-z 0-9 - _ . ! ~ * ' ( )`. Crucially, it encodes `&`, `=`, `?`, `#`, `/`, and `%`, which are the characters that could inject additional URL parameters. Since the share text and URL are both fully encoded, an attacker cannot:
- Inject additional query parameters (e.g., `&redirect_to=evil.com`)
- Break out of the parameter value context
- Fragment-inject (`#`) into the URL

### 7. GA4 event injection

**Verdict: Not practically exploitable.**

GA4 events are fired in three places:
- `quiz.astro` line 305: `gtag('event', 'quiz_completed', { archetype })` — `archetype` comes from `classify()`, which returns one of 6 hardcoded strings.
- `quiz.astro` lines 418-422: `gtag('event', 'share', { method: platform, content_type: 'quiz_result', item_id: quizArchetype })` — `platform` is derived from a ternary chain comparing DOM element references, `quizArchetype` is from `classify()`.
- `[archetype].astro` lines 127-131: `const archetype = window.location.pathname.split('/').pop()` — this is the only value derived from the URL.

The result page's GA4 tracking reads `window.location.pathname.split('/').pop()` (line 124), which could theoretically contain arbitrary text if the user somehow accesses a URL outside the static paths. However, since the site is statically generated, only the 6 valid paths exist. A 404 page would not contain this script. The worst case is polluted analytics data from a custom URL, which is cosmetic, not harmful.

Additionally, GA4 event parameters are sandwiched within the site's own analytics property. An attacker cannot use these to access another site's analytics or inject code — GA4 treats all parameter values as plain strings.

### 8. Content Security Policy

**Verdict: Pre-existing gap, not introduced by this feature. See ADV-01.**

The site has zero CSP configuration. The feature adds:
- 2 new inline `<script>` blocks (quiz.astro script, result page script)
- No new external script sources beyond what the layout already loads

A proper CSP would require:
- `script-src` with nonces for all inline scripts (GTM, GA4, Meta Pixel, quiz logic, result page logic)
- `script-src` allowlisting: `https://www.googletagmanager.com`, `https://www.google-analytics.com`, `https://connect.facebook.net`
- `font-src`: `https://fonts.gstatic.com`
- `style-src`: `https://fonts.googleapis.com` plus `'unsafe-inline'` for Tailwind
- `img-src`: `https://www.facebook.com` (tracking pixel), `'self'`
- `connect-src`: `'self'` plus analytics endpoints

This is a meaningful hardening opportunity but represents a site-wide architecture decision, not a flaw in the share CTA feature specifically. GTM's dynamic script injection makes strict CSP difficult without `'unsafe-eval'` or a GTM CSP feature.

### 9. Information leakage

**Verdict: No sensitive data leaked.**

OG tags expose:
- Page title (archetype name — public content)
- Page description (archetype description — public content)
- OG image URL (public static asset path)
- Canonical URL (public page URL)
- Site name ("The Hermetic Flight" — public)

Share URLs expose:
- The archetype name in the URL path (`/quiz/result/air-weaver`)
- The archetype name and element in the tweet text

None of these contain:
- Email addresses
- Internal IDs or database keys
- API endpoints or keys
- User-specific identifiers
- Session tokens

The API endpoint `/api/quiz-submit` is not referenced in any share URL or OG tag. The `LOOPS_API_KEY` is only used server-side and never appears in client code.

### 10. Social engineering via share flow

**Verdict: Minimal risk, within expected parameters.**

The share text is formulaic and controlled:
```
I'm The Air Weaver -- Air element. Discover your aerial tarot archetype:
```

An attacker cannot modify the share text because:
- On static result pages, the text is baked into the HTML at build time
- On the quiz page, the text is derived from hardcoded archetype content

The only social engineering vector is inherent to the quiz format itself: someone could share their result to generate curiosity and drive traffic to the quiz. This is the intended behavior — it is the entire purpose of the share CTA. The quiz collects email addresses voluntarily after showing results, with clear labeling.

One could argue that the result pages (`/quiz/result/air-weaver`) serve as social proof / authority signals ("the site says I'm this archetype"), but this is standard personality quiz marketing, not a vulnerability.

---

## Recommendations

### For ADV-01 (No CSP) — Medium Priority

1. **Add a `vercel.json` or `_headers` with CSP headers.** Start with a report-only policy:
   ```json
   {
     "headers": [{
       "source": "/(.*)",
       "headers": [{
         "key": "Content-Security-Policy-Report-Only",
         "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://www.facebook.com data:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com"
       }]
     }]
   }
   ```

2. **Monitor CSP violations** via `report-uri` or `report-to` for 2 weeks before enforcing.

3. **Consider nonce-based script-src** if GTM's dynamic injection requirements allow it (GTM supports a custom `nonce` variable).

4. **Note:** This is a site-wide hardening task, not specific to the share CTA feature. Scope it as a separate backlog item.

### For ADV-02 (Clipboard error handling) — Low Priority

Wrap clipboard writes in try/catch with user feedback:

**In `quiz.astro` (line 407-411):**
```typescript
shareCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    shareCopyText.textContent = 'Copied!';
  } catch {
    shareCopyText.textContent = 'Copy failed';
  }
  setTimeout(() => { shareCopyText.textContent = 'Copy Link'; }, 2000);
});
```

**In `[archetype].astro` (line 113-117):**
```typescript
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyText.textContent = 'Copied!';
  } catch {
    copyText.textContent = 'Copy failed';
  }
  setTimeout(() => { copyText.textContent = 'Copy Link'; }, 2000);
});
```

---

## Items Investigated but Not Flagged

| Question | Verdict | Rationale |
|----------|---------|-----------|
| XSS via meta tags | Safe | Astro auto-escapes attribute expressions; data is hardcoded |
| Open redirect | Safe | Share URLs use hardcoded domains and `encodeURIComponent` |
| URL injection | Safe | `getStaticPaths` constrains valid paths to 6 slugs |
| Clipboard API abuse | Safe | Requires user gesture (click handler) |
| DOM-based XSS | Safe | All DOM writes use `textContent`, zero `innerHTML` usage |
| URL parameter injection | Safe | `encodeURIComponent` covers all injection characters |
| GA4 event injection | Safe | Parameters are hardcoded strings; analytics-only impact |
| Information leakage | Safe | No sensitive data in OG tags or share URLs |
| Social engineering | Acceptable | Standard quiz marketing; no deceptive vectors |

---

## Conclusion

The Share CTA & OG Meta Tags feature is well-implemented from a security perspective. The code demonstrates good practices: `textContent` over `innerHTML`, `encodeURIComponent` for URL construction, hardcoded data sources rather than user input, and `target="_blank" rel="noopener noreferrer"` on share links. The two findings (CSP gap and clipboard error handling) are low-to-medium severity, with the CSP gap being pre-existing rather than introduced by this feature.
