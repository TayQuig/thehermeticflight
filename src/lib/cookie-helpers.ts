/**
 * Cookie utility functions for thf_sub multi-slug cookie management.
 *
 * Cookie contract:
 *   Name: thf_sub
 *   Value: comma-separated kebab-case archetype slugs (e.g. "air-weaver,shadow-dancer")
 *   Max-Age: 15552000 (180 days)
 */

/**
 * Parse a specific cookie value from a raw Cookie header string.
 * Decodes URL-encoded values. Returns empty string if the cookie is not found.
 */
export function parseCookieValue(cookieHeader: string, name: string): string {
  if (!cookieHeader) return '';

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const cookieName = trimmed.slice(0, eqIndex).trim();
    if (cookieName !== name) continue;

    const rawValue = trimmed.slice(eqIndex + 1);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return '';
}

/**
 * Append a slug to a comma-separated value, deduplicating.
 * Cleans malformed input (empty segments from trailing/leading/double commas).
 */
export function appendSlug(existing: string, newSlug: string): string {
  const segments = existing.split(',').filter(Boolean);
  if (segments.includes(newSlug)) {
    return segments.join(',');
  }
  segments.push(newSlug);
  return segments.join(',');
}
