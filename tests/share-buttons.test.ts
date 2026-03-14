/**
 * ShareButtons.astro Component — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify during implementation.
 *
 * Covers: ARCH-09 (Share button SVGs duplicated)
 *
 * Verifies:
 *   - Component file exists
 *   - Props interface includes required fields: shareUrl, shareText, contentType, itemId
 *   - Component template contains X, Facebook, and copy button elements
 *   - Component script imports from share-utils (not duplicating logic)
 *   - No duplicate SVG path definitions — only one copy per icon
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// File existence
// ---------------------------------------------------------------------------

describe('ShareButtons.astro source contract', () => {
  it('component file exists at src/components/ShareButtons.astro', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src/components/ShareButtons.astro')),
      'src/components/ShareButtons.astro must exist',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

describe('ShareButtons.astro props', () => {
  it('declares a shareUrl prop', () => {
    const source = readSource('src/components/ShareButtons.astro');
    expect(source).toMatch(/shareUrl\s*:/);
  });

  it('declares a shareText prop', () => {
    const source = readSource('src/components/ShareButtons.astro');
    expect(source).toMatch(/shareText\s*:/);
  });

  it('declares a contentType prop', () => {
    const source = readSource('src/components/ShareButtons.astro');
    expect(source).toMatch(/contentType\s*:/);
  });

  it('declares an itemId prop', () => {
    const source = readSource('src/components/ShareButtons.astro');
    expect(source).toMatch(/itemId\s*:/);
  });
});

// ---------------------------------------------------------------------------
// Template content — share buttons
// ---------------------------------------------------------------------------

describe('ShareButtons.astro template', () => {
  const source = readSource('src/components/ShareButtons.astro');

  it('contains an X (Twitter) share element', () => {
    // X share links use x.com/intent/tweet or pass via share-utils
    expect(source).toMatch(/x\.com\/intent\/tweet|share-x|shareX/i);
  });

  it('contains a Facebook share element', () => {
    expect(source).toMatch(/facebook\.com\/sharer|share-fb|shareFb/i);
  });

  it('contains a copy link button', () => {
    expect(source).toMatch(/copy-link|copyLink|copy_link/i);
  });

  it('contains X SVG icon path', () => {
    // The X logo path: M18.244 2.25h3.308...
    expect(source).toContain('M18.244 2.25h3.308');
  });

  it('contains Facebook SVG icon path', () => {
    // The Facebook logo path: M24 12.073c0-6.627...
    expect(source).toContain('M24 12.073c0-6.627');
  });

  it('contains copy link SVG icon paths', () => {
    // The link icon: M10 13a5 5...
    expect(source).toContain('M10 13a5 5');
  });
});

// ---------------------------------------------------------------------------
// Script imports share-utils instead of duplicating logic
// ---------------------------------------------------------------------------

describe('ShareButtons.astro script uses share-utils', () => {
  const source = readSource('src/components/ShareButtons.astro');

  it('has a <script> block', () => {
    expect(source).toMatch(/<script/);
  });

  it('imports from share-utils', () => {
    // The script should import trackShare (or other functions) from share-utils
    expect(source).toMatch(/import.*from.*share-utils/);
  });

  it('does not hardcode gtag call inline (delegates to trackShare)', () => {
    // The component should NOT contain a raw gtag() call —
    // it should call trackShare() from share-utils instead.
    const scriptMatch = source.match(/<script[\s\S]*?<\/script>/g);
    if (!scriptMatch) return;
    for (const block of scriptMatch) {
      const hasRawGtag = /\bgtag\s*\(/.test(block);
      expect(
        hasRawGtag,
        'ShareButtons.astro must not call gtag() directly — use trackShare() from share-utils',
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Deduplication: quiz.astro and [archetype].astro no longer contain SVG duplication
// (This test passes once Task 6 wires up the component in both pages.)
// Marked as a forward-looking contract — will be verified in Task 6 verification.
// ---------------------------------------------------------------------------

describe('ShareButtons deduplication (forward-looking contract)', () => {
  it('quiz.astro imports ShareButtons component (verified post-Task 6)', () => {
    // This test will fail until Task 6. It is intentionally included here
    // so the baseline recorded now shows it failing, and Task 6 makes it pass.
    const source = readSource('src/pages/quiz.astro');
    expect(source).toMatch(/import\s+ShareButtons\s+from/);
  });

  it('[archetype].astro imports ShareButtons component (verified post-Task 6)', () => {
    const source = readSource('src/pages/quiz/result/[archetype].astro');
    expect(source).toMatch(/import\s+ShareButtons\s+from/);
  });
});
