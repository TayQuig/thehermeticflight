/**
 * Share Utils
 *
 * Extracted from quiz.astro (lines ~405-430) and [archetype].astro (lines ~103-126).
 * Both pages contained duplicate share URL construction and GA4 tracking logic.
 *
 * This module is browser-safe (no Node.js APIs). It may be imported in
 * Astro <script> blocks which run in the browser at runtime.
 *
 * Functions:
 *   buildXShareUrl()        — compose the X (Twitter) intent URL
 *   buildFacebookShareUrl() — compose the Facebook sharer URL
 *   buildShareText()        — produce canonical share copy from archetype data
 *   trackShare()            — fire a GA4 'share' event (no-op if gtag absent)
 */

declare function gtag(...args: unknown[]): void;

/**
 * Compose a Twitter/X intent URL for sharing.
 * @param text   The tweet text (will be URL-encoded)
 * @param url    The URL to share (will be URL-encoded)
 */
export function buildXShareUrl(text: string, url: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/**
 * Compose a Facebook sharer URL.
 * @param url  The URL to share (will be URL-encoded)
 */
export function buildFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/**
 * Produce canonical share text for an archetype result.
 * Matches the pattern used in both quiz.astro and [archetype].astro prior to extraction.
 *
 * @param title    e.g. "The Air Weaver"
 * @param element  e.g. "Air"
 */
export function buildShareText(title: string, element: string): string {
  return `I'm ${title} — ${element} element. Discover your aerial tarot archetype:`;
}

/**
 * Fire a GA4 'share' event. Safe to call when gtag is not loaded —
 * performs a typeof guard before calling.
 *
 * @param method       Platform identifier: 'x' | 'facebook' | 'copy_link'
 * @param contentType  GA4 content_type parameter (e.g. 'quiz_result')
 * @param itemId       GA4 item_id parameter (e.g. the archetype URL slug)
 */
export function trackShare(method: string, contentType: string, itemId: string): void {
  if (typeof gtag === 'function') {
    gtag('event', 'share', {
      method,
      content_type: contentType,
      item_id: itemId,
    });
  }
}
