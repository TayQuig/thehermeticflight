/**
 * Share Utils — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify during implementation.
 *
 * Covers: ARCH-04 (partial), ARCH-09, TCF-03 (structural portion)
 *
 * Verifies:
 *   - buildXShareUrl() produces correct X (Twitter) intent URL
 *   - buildFacebookShareUrl() produces correct Facebook sharer URL
 *   - buildShareText() produces canonical share text from archetype content
 *   - trackShare() calls gtag with the correct event shape
 *   - Source file exports all required functions
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Source-level contract
// ---------------------------------------------------------------------------

describe('share-utils.ts source contract', () => {
  it('file exists at src/lib/share-utils.ts', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/lib/share-utils.ts')),
      'src/lib/share-utils.ts must exist',
    ).toBe(true);
  });

  it('exports buildXShareUrl', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/share-utils.ts'), 'utf-8');
    expect(source).toMatch(/export\s+function\s+buildXShareUrl/);
  });

  it('exports buildFacebookShareUrl', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/share-utils.ts'), 'utf-8');
    expect(source).toMatch(/export\s+function\s+buildFacebookShareUrl/);
  });

  it('exports buildShareText', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/share-utils.ts'), 'utf-8');
    expect(source).toMatch(/export\s+function\s+buildShareText/);
  });

  it('exports trackShare', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/share-utils.ts'), 'utf-8');
    expect(source).toMatch(/export\s+function\s+trackShare/);
  });
});

// ---------------------------------------------------------------------------
// buildXShareUrl
// ---------------------------------------------------------------------------

describe('buildXShareUrl', () => {
  it('returns a properly formed X intent URL', async () => {
    const { buildXShareUrl } = await import('../src/lib/share-utils');
    const url = buildXShareUrl(
      'I\'m The Air Weaver — Air element. Discover your aerial tarot archetype:',
      'https://www.thehermeticflight.com/quiz/result/air-weaver',
    );
    expect(url).toMatch(/^https:\/\/x\.com\/intent\/tweet\?/);
    expect(url).toContain('Air%20Weaver');
    expect(url).toContain('air-weaver');
  });

  it('URL-encodes the text and url parameters', async () => {
    const { buildXShareUrl } = await import('../src/lib/share-utils');
    const url = buildXShareUrl('text with spaces & special chars', 'https://example.com/path?a=1');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&url=https://example');
    // The & before url= should be the separator, not encoded
    expect(url).toMatch(/[?&]url=/);
  });

  it('includes both text= and url= query parameters', async () => {
    const { buildXShareUrl } = await import('../src/lib/share-utils');
    const url = buildXShareUrl('hello', 'https://example.com');
    expect(url).toMatch(/[?&]text=/);
    expect(url).toMatch(/[?&]url=/);
  });
});

// ---------------------------------------------------------------------------
// buildFacebookShareUrl
// ---------------------------------------------------------------------------

describe('buildFacebookShareUrl', () => {
  it('returns a properly formed Facebook sharer URL', async () => {
    const { buildFacebookShareUrl } = await import('../src/lib/share-utils');
    const url = buildFacebookShareUrl(
      'https://www.thehermeticflight.com/quiz/result/shadow-dancer',
    );
    expect(url).toMatch(/^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?/);
    expect(url).toContain('shadow-dancer');
  });

  it('URL-encodes the share URL', async () => {
    const { buildFacebookShareUrl } = await import('../src/lib/share-utils');
    const url = buildFacebookShareUrl('https://example.com/path?a=1&b=2');
    // The u= parameter value should be URL-encoded
    const uParam = url.split('u=')[1];
    expect(uParam).toBeDefined();
    expect(uParam).not.toContain('&b=2');
  });
});

// ---------------------------------------------------------------------------
// buildShareText
// ---------------------------------------------------------------------------

describe('buildShareText', () => {
  it('includes the archetype title in the share text', async () => {
    const { buildShareText } = await import('../src/lib/share-utils');
    const text = buildShareText('The Air Weaver', 'Air');
    expect(text).toContain('The Air Weaver');
  });

  it('includes the element in the share text', async () => {
    const { buildShareText } = await import('../src/lib/share-utils');
    const text = buildShareText('The Shadow Dancer', 'Shadow');
    expect(text).toContain('Shadow');
  });

  it('includes a call to action for the quiz', async () => {
    const { buildShareText } = await import('../src/lib/share-utils');
    const text = buildShareText('The Grounded Mystic', 'Mercury');
    expect(text.toLowerCase()).toMatch(/archetype|tarot|discover/);
  });

  it('produces a non-empty string', async () => {
    const { buildShareText } = await import('../src/lib/share-utils');
    const text = buildShareText('The Flow Artist', 'Water');
    expect(text.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// trackShare
// ---------------------------------------------------------------------------

describe('trackShare', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls gtag with event name "share"', async () => {
    const mockGtag = vi.fn();
    vi.stubGlobal('gtag', mockGtag);

    const { trackShare } = await import('../src/lib/share-utils');
    trackShare('x', 'quiz_result', 'air-weaver');

    expect(mockGtag).toHaveBeenCalledWith('event', 'share', expect.any(Object));
  });

  it('passes method, content_type, item_id in the event payload', async () => {
    const mockGtag = vi.fn();
    vi.stubGlobal('gtag', mockGtag);

    const { trackShare } = await import('../src/lib/share-utils');
    trackShare('facebook', 'quiz_result', 'shadow-dancer');

    expect(mockGtag).toHaveBeenCalledWith('event', 'share', {
      method: 'facebook',
      content_type: 'quiz_result',
      item_id: 'shadow-dancer',
    });
  });

  it('does not throw when gtag is not defined', async () => {
    vi.stubGlobal('gtag', undefined);

    const { trackShare } = await import('../src/lib/share-utils');
    expect(() => trackShare('copy_link', 'quiz_result', 'flow-artist')).not.toThrow();
  });

  it('does not call gtag when it is not a function', async () => {
    vi.stubGlobal('gtag', 'not-a-function');

    const { trackShare } = await import('../src/lib/share-utils');
    // Should not throw — typeof check must guard the call
    expect(() => trackShare('x', 'quiz_result', 'grounded-mystic')).not.toThrow();
  });
});
