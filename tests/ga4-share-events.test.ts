/**
 * GA4 Analytics Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify during implementation.
 *
 * Covers: TCF-03 (GA4 share events untested)
 *
 * Two layers of verification:
 *
 * Layer 1 — Unit tests via gtag mock:
 *   Test the share-utils module functions directly with a stubbed gtag.
 *   Verifies correct event name and payload shape.
 *
 * Layer 2 — Structural tests:
 *   Read quiz.astro and [archetype].astro source, verify they contain
 *   the expected gtag call patterns. This catches regressions if the
 *   refactor in Task 6 accidentally removes or changes analytics calls.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ===========================================================================
// Layer 1: Unit Tests — trackShare via share-utils
// ===========================================================================

describe('TCF-03: trackShare fires correct GA4 share event', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fires gtag("event", "share", ...) on X platform', async () => {
    const mockGtag = vi.fn();
    vi.stubGlobal('gtag', mockGtag);

    const { trackShare } = await import('../src/lib/share-utils');
    trackShare('x', 'quiz_result', 'air-weaver');

    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith('event', 'share', {
      method: 'x',
      content_type: 'quiz_result',
      item_id: 'air-weaver',
    });
  });

  it('fires gtag("event", "share", ...) on Facebook platform', async () => {
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

  it('fires gtag("event", "share", ...) for copy_link', async () => {
    const mockGtag = vi.fn();
    vi.stubGlobal('gtag', mockGtag);

    const { trackShare } = await import('../src/lib/share-utils');
    trackShare('copy_link', 'quiz_result', 'grounded-mystic');

    expect(mockGtag).toHaveBeenCalledWith('event', 'share', {
      method: 'copy_link',
      content_type: 'quiz_result',
      item_id: 'grounded-mystic',
    });
  });

  it('does not fire gtag when gtag is undefined', async () => {
    vi.stubGlobal('gtag', undefined);

    const { trackShare } = await import('../src/lib/share-utils');
    // Should not throw
    expect(() => trackShare('x', 'quiz_result', 'air-weaver')).not.toThrow();
  });

  it('passes all 6 archetype slugs correctly as item_id', async () => {
    const mockGtag = vi.fn();
    vi.stubGlobal('gtag', mockGtag);

    const { trackShare } = await import('../src/lib/share-utils');
    const slugs = [
      'air-weaver', 'embodied-intuitive', 'ascending-seeker',
      'shadow-dancer', 'flow-artist', 'grounded-mystic',
    ];

    for (const slug of slugs) {
      trackShare('x', 'quiz_result', slug);
    }

    expect(mockGtag).toHaveBeenCalledTimes(6);
    for (const slug of slugs) {
      expect(mockGtag).toHaveBeenCalledWith('event', 'share', expect.objectContaining({
        item_id: slug,
      }));
    }
  });
});

// ===========================================================================
// Layer 2: Structural Tests — quiz.astro contains correct gtag calls
// ===========================================================================

describe('TCF-03: quiz.astro gtag call patterns (structural)', () => {
  const quizSource = readSource('src/pages/quiz.astro');

  it('contains a quiz_completed GA4 event', () => {
    // Must fire: gtag('event', 'quiz_completed', { archetype })
    expect(quizSource).toContain("'quiz_completed'");
    expect(quizSource).toMatch(/gtag\s*\(\s*['"]event['"]\s*,\s*['"]quiz_completed['"]/);
  });

  it('quiz_completed event includes archetype in the payload', () => {
    // The event payload must pass the archetype value
    const quizCompletedBlock = quizSource.match(
      /gtag\s*\(\s*['"]event['"]\s*,\s*['"]quiz_completed['"][^)]*\)/,
    );
    expect(quizCompletedBlock, 'quiz_completed gtag call must exist').not.toBeNull();
    expect(quizCompletedBlock![0]).toMatch(/archetype/);
  });

  it('contains a generate_lead GA4 event', () => {
    // Must fire: gtag('event', 'generate_lead', { event_category, archetype })
    expect(quizSource).toContain("'generate_lead'");
    expect(quizSource).toMatch(/gtag\s*\(\s*['"]event['"]\s*,\s*['"]generate_lead['"]/);
  });

  it('generate_lead event includes event_category and archetype', () => {
    const generateLeadBlock = quizSource.match(
      /gtag\s*\(\s*['"]event['"]\s*,\s*['"]generate_lead['"][\s\S]*?\}/,
    );
    expect(generateLeadBlock, 'generate_lead gtag call must exist').not.toBeNull();
    expect(generateLeadBlock![0]).toMatch(/event_category/);
    expect(generateLeadBlock![0]).toMatch(/archetype/);
  });

  it('contains gtag typeof guard for quiz_completed', () => {
    // Must guard: if (typeof gtag === 'function')
    // Prevents ReferenceError when GA4 is blocked by ad blockers
    const guardPattern = /typeof\s+gtag\s*===?\s*['"]function['"]/;
    expect(
      guardPattern.test(quizSource),
      'quiz.astro must guard gtag calls with typeof check',
    ).toBe(true);
  });

  it('contains a share event (via trackShare call or direct gtag call)', () => {
    // After Task 6 refactor, quiz.astro will use trackShare().
    // Before Task 6, it has a direct gtag share call.
    // Either pattern satisfies this structural contract.
    const hasShare =
      quizSource.includes("'share'") ||
      quizSource.includes('trackShare');
    expect(
      hasShare,
      'quiz.astro must contain either a gtag share event or a trackShare() call',
    ).toBe(true);
  });

  it('uses buildShareText from share-utils (not inline template)', () => {
    expect(
      quizSource.includes('buildShareText'),
      'quiz.astro must import and use buildShareText from share-utils',
    ).toBe(true);
  });
});

// ===========================================================================
// Layer 2: Structural Tests — [archetype].astro contains correct gtag calls
// ===========================================================================

describe('TCF-03: [archetype].astro gtag call patterns (structural)', () => {
  const resultSource = readSource('src/pages/quiz/result/[archetype].astro');

  it('contains a share event (via trackShare, direct gtag, or ShareButtons component)', () => {
    const hasShare =
      resultSource.includes("'share'") ||
      resultSource.includes('trackShare') ||
      /<ShareButtons\s/.test(resultSource);
    expect(
      hasShare,
      '[archetype].astro must contain a gtag share event, trackShare() call, or render <ShareButtons>',
    ).toBe(true);
  });

  it('share event payload includes method, content_type, item_id (or delegates to ShareButtons)', () => {
    const hasDirectPattern =
      /gtag\s*\(\s*['"]event['"]\s*,\s*['"]share['"][\s\S]*?method[\s\S]*?content_type[\s\S]*?item_id/.test(resultSource);
    const hasTrackShare = /trackShare\s*\(/.test(resultSource);
    const hasShareButtons = /<ShareButtons\s/.test(resultSource) && /contentType\s*=/.test(resultSource);
    expect(
      hasDirectPattern || hasTrackShare || hasShareButtons,
      '[archetype].astro share tracking must include method, content_type, item_id — or delegate to ShareButtons/trackShare()',
    ).toBe(true);
  });

  it('contains a gtag typeof guard, uses trackShare, or delegates to ShareButtons', () => {
    const hasGuard = /typeof\s+gtag\s*===?\s*['"]function['"]/.test(resultSource);
    const hasTrackShare = /trackShare\s*\(/.test(resultSource);
    const hasShareButtons = /<ShareButtons\s/.test(resultSource);
    expect(
      hasGuard || hasTrackShare || hasShareButtons,
      '[archetype].astro must guard gtag calls — use typeof check, trackShare(), or delegate to ShareButtons',
    ).toBe(true);
  });
});

// ===========================================================================
// Layer 2: Structural Tests — ShareButtons.astro calls trackShare
// ===========================================================================

describe('TCF-03: ShareButtons.astro delegates GA4 tracking to trackShare', () => {
  it('imports trackShare from share-utils', () => {
    const source = readSource('src/components/ShareButtons.astro');
    expect(source).toMatch(/import.*trackShare.*from.*share-utils/);
  });

  it('calls trackShare for each platform', () => {
    const source = readSource('src/components/ShareButtons.astro');
    const trackShareCallCount = (source.match(/trackShare\s*\(/g) || []).length;
    expect(
      trackShareCallCount,
      'ShareButtons.astro must call trackShare() at least 3 times (x, facebook, copy_link)',
    ).toBeGreaterThanOrEqual(3);
  });
});
