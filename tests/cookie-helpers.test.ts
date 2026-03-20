/**
 * Unit tests for cookie-helpers.ts — multi-slug cookie parsing and management.
 *
 * Cookie contract:
 *   Name: thf_sub
 *   Value: comma-separated kebab-case archetype slugs (e.g. "air-weaver,shadow-dancer")
 *   Max-Age: 15552000 (180 days)
 *   Set by: server-side Set-Cookie header (primary) + client-side document.cookie (fallback)
 *   Read by: server-side Astro.cookies in [slug].astro, client-side JS in quiz.astro
 */

import { describe, it, expect } from 'vitest';
import { parseCookieValue, appendSlug } from '../src/lib/cookie-helpers';

// ---------------------------------------------------------------------------
// parseCookieValue
// ---------------------------------------------------------------------------

describe('parseCookieValue', () => {
  it('returns empty string for empty header', () => {
    expect(parseCookieValue('', 'thf_sub')).toBe('');
  });

  it('returns empty string for missing cookie name', () => {
    expect(parseCookieValue('other=value', 'thf_sub')).toBe('');
  });

  it('extracts single cookie value', () => {
    expect(parseCookieValue('thf_sub=air-weaver', 'thf_sub')).toBe('air-weaver');
  });

  it('extracts named cookie from multiple cookies', () => {
    expect(parseCookieValue('ga=123; thf_sub=air-weaver; _fbp=456', 'thf_sub')).toBe('air-weaver');
  });

  it('decodes URL-encoded value', () => {
    expect(parseCookieValue('thf_sub=air-weaver%2Cshadow-dancer', 'thf_sub')).toBe('air-weaver,shadow-dancer');
  });

  it('handles cookie at start of header string', () => {
    expect(parseCookieValue('thf_sub=flow-artist; other=1', 'thf_sub')).toBe('flow-artist');
  });

  it('handles cookie at end of header string', () => {
    expect(parseCookieValue('other=1; thf_sub=grounded-mystic', 'thf_sub')).toBe('grounded-mystic');
  });

  it('returns empty string for empty cookie value', () => {
    expect(parseCookieValue('thf_sub=', 'thf_sub')).toBe('');
  });

  it('does not partial-match cookie names', () => {
    expect(parseCookieValue('xthf_sub=wrong; thf_sub=correct', 'thf_sub')).toBe('correct');
  });
});

// ---------------------------------------------------------------------------
// appendSlug
// ---------------------------------------------------------------------------

describe('appendSlug', () => {
  it('returns single slug when existing is empty', () => {
    expect(appendSlug('', 'air-weaver')).toBe('air-weaver');
  });

  it('appends new slug to existing', () => {
    expect(appendSlug('air-weaver', 'shadow-dancer')).toBe('air-weaver,shadow-dancer');
  });

  it('does not duplicate existing slug', () => {
    expect(appendSlug('air-weaver', 'air-weaver')).toBe('air-weaver');
  });

  it('does not duplicate in multi-slug value', () => {
    expect(appendSlug('air-weaver,shadow-dancer', 'air-weaver')).toBe('air-weaver,shadow-dancer');
  });

  it('handles trailing comma in existing value', () => {
    const result = appendSlug('air-weaver,', 'shadow-dancer');
    expect(result).toBe('air-weaver,shadow-dancer');
    // Verify no empty segments
    expect(result.split(',').every(s => s.length > 0)).toBe(true);
  });

  it('handles leading comma in existing value', () => {
    const result = appendSlug(',air-weaver', 'shadow-dancer');
    expect(result).toBe('air-weaver,shadow-dancer');
  });

  it('handles double comma in existing value', () => {
    const result = appendSlug('air-weaver,,shadow-dancer', 'flow-artist');
    expect(result).toBe('air-weaver,shadow-dancer,flow-artist');
  });

  it('handles all 6 archetypes', () => {
    let value = '';
    const slugs = ['air-weaver', 'embodied-intuitive', 'ascending-seeker', 'shadow-dancer', 'flow-artist', 'grounded-mystic'];
    for (const slug of slugs) {
      value = appendSlug(value, slug);
    }
    expect(value).toBe(slugs.join(','));
    // Must be under 4096 bytes
    expect(value.length).toBeLessThan(4096);
  });
});
