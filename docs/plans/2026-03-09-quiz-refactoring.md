# Quiz Code Quality Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address 10 deferred findings from hardening-2026-03-08: extract quiz.astro script block into modules, add GA4 contract tests, improve E2E test reliability, and extract shared components.

**Architecture:** Extract share CTA logic → `src/lib/share-utils.ts`, DOM helpers → `src/lib/dom-helpers.ts`, shared ShareButtons → `src/components/ShareButtons.astro`. Add gtag mock infrastructure for GA4 contract tests. Improve E2E tests with condition-based waits.

**Tech Stack:** Astro 5, TypeScript, Vitest, Playwright

---

## Findings Addressed

| ID | Title | Severity | Task |
|----|-------|----------|------|
| ARCH-04 | quiz.astro script block >250 lines | Medium | Task 6 |
| ARCH-08 | Multiple `as` casts in quiz.astro | Medium | Task 1 |
| ARCH-09 | Share button SVGs duplicated | Medium | Tasks 2, 3 |
| TCF-03 | GA4 share events untested | Medium | Task 4 |
| TCF-06 | Edge cases in slug functions | Low | Task 5 |
| TCF-07 | Brittle E2E DOM selectors | Low | Task 5 |
| TCF-08 | Canonical URL tested on 1 page | Low | Task 5 |
| TCF-09 | Deep structural checks on 1 archetype | Low | Task 5 |
| TCF-10 | Clipboard copy feedback untested | Low | Task 5 |

**Build Order:** DOM helpers (Task 1) → share utils (Task 2) → component (Task 3) → tests (Tasks 4–5) → refactor (Task 6) → gates (Task 7)

**Critical rule:** Every existing test must pass before and after every task. Task 6 (quiz.astro refactor) is the highest-risk step — run the full test suite before and after.

---

## Task 1: Create DOM Helpers Module (ARCH-08)

**Addresses:** Multiple `document.getElementById('x') as HTMLElement` patterns in quiz.astro's script block. Replace unsafe `!` non-null assertions and `as HTMLElement` casts with null-safe typed helpers.

**Files:**
- Create: `src/lib/dom-helpers.ts`
- Test: `tests/dom-helpers.test.ts`

### Step 1 — Write the failing test

Create `tests/dom-helpers.test.ts`:

```typescript
/**
 * DOM Helpers — Contract Tests
 *
 * Frozen-test-file protocol: This file is the TEST CONTRACT.
 * Do NOT modify during implementation.
 *
 * Covers: ARCH-08 (Multiple `as` casts in quiz.astro)
 *
 * Verifies:
 *   - getEl<T>() returns typed element or null when not found
 *   - requireEl<T>() returns typed element when found
 *   - requireEl<T>() throws a descriptive error when not found
 *   - Source file exports both functions with correct signatures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Source-level contract: verify the module exists and exports the right names
// ---------------------------------------------------------------------------

describe('dom-helpers.ts source contract', () => {
  it('file exists at src/lib/dom-helpers.ts', () => {
    const filePath = path.join(ROOT, 'src/lib/dom-helpers.ts');
    expect(fs.existsSync(filePath), 'src/lib/dom-helpers.ts must exist').toBe(true);
  });

  it('exports getEl function', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/dom-helpers.ts'), 'utf-8');
    expect(source).toMatch(/export\s+function\s+getEl\s*</);
  });

  it('exports requireEl function', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/dom-helpers.ts'), 'utf-8');
    expect(source).toMatch(/export\s+function\s+requireEl\s*</);
  });

  it('getEl uses generic type parameter', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/dom-helpers.ts'), 'utf-8');
    expect(source).toMatch(/getEl\s*<T\s+extends\s+HTMLElement/);
  });

  it('requireEl uses generic type parameter', () => {
    const source = fs.readFileSync(path.join(ROOT, 'src/lib/dom-helpers.ts'), 'utf-8');
    expect(source).toMatch(/requireEl\s*<T\s+extends\s+HTMLElement/);
  });
});

// ---------------------------------------------------------------------------
// Runtime contract: jsdom simulation via vi.stubGlobal
// ---------------------------------------------------------------------------

describe('getEl runtime behavior', () => {
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when element is not found', async () => {
    const mockDoc = {
      getElementById: vi.fn().mockReturnValue(null),
    };
    vi.stubGlobal('document', mockDoc);

    // Dynamic import to pick up the stub — works because dom-helpers.ts
    // calls document.getElementById at call time, not module load time.
    const { getEl } = await import('../src/lib/dom-helpers');
    const result = getEl<HTMLElement>('nonexistent');
    expect(result).toBeNull();
  });

  it('returns typed element when found', async () => {
    const fakeEl = { id: 'my-el', tagName: 'DIV' };
    const mockDoc = {
      getElementById: vi.fn().mockReturnValue(fakeEl),
    };
    vi.stubGlobal('document', mockDoc);

    const { getEl } = await import('../src/lib/dom-helpers');
    const result = getEl<HTMLElement>('my-el');
    expect(result).toBe(fakeEl);
  });
});

describe('requireEl runtime behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns element when found', async () => {
    const fakeEl = { id: 'found-el', tagName: 'BUTTON' };
    vi.stubGlobal('document', {
      getElementById: vi.fn().mockReturnValue(fakeEl),
    });

    const { requireEl } = await import('../src/lib/dom-helpers');
    const result = requireEl<HTMLButtonElement>('found-el');
    expect(result).toBe(fakeEl);
  });

  it('throws an error when element is not found', async () => {
    vi.stubGlobal('document', {
      getElementById: vi.fn().mockReturnValue(null),
    });

    const { requireEl } = await import('../src/lib/dom-helpers');
    expect(() => requireEl<HTMLElement>('missing-el')).toThrow('missing-el');
  });

  it('error message includes the element id', async () => {
    vi.stubGlobal('document', {
      getElementById: vi.fn().mockReturnValue(null),
    });

    const { requireEl } = await import('../src/lib/dom-helpers');
    expect(() => requireEl<HTMLElement>('quiz-container')).toThrowError(/quiz-container/);
  });
});
```

### Step 2 — Verify the test fails

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/dom-helpers.test.ts 2>&1 | tail -20
```

Expected: Tests fail with "Cannot find module" or "file does not exist".

### Step 3 — Implement dom-helpers.ts

Create `src/lib/dom-helpers.ts` with exactly this content:

```typescript
/**
 * DOM Helpers
 *
 * Null-safe typed wrappers for document.getElementById.
 * Replaces `document.getElementById('x') as HTMLElement` patterns
 * with helpers that make null-safety explicit at the call site.
 *
 * getEl<T>  — returns T | null. Use when absence is a valid state.
 * requireEl<T> — returns T, throws if null. Use when absence is a bug.
 *
 * Both functions accept a generic type parameter constrained to HTMLElement,
 * so callers retain full type information without unsafe casts:
 *
 *   const form = requireEl<HTMLFormElement>('email-form');
 *   const btn  = getEl<HTMLButtonElement>('optional-btn');
 */

/**
 * Returns the element with the given id cast to T, or null if not found.
 */
export function getEl<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Returns the element with the given id cast to T.
 * Throws a descriptive error if the element is not found.
 * Use this for elements that must exist for the page to function correctly.
 */
export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (el === null) {
    throw new Error(`requireEl: element with id "${id}" not found in the DOM`);
  }
  return el;
}
```

### Step 4 — Verify the test passes

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/dom-helpers.test.ts 2>&1 | tail -10
```

Expected: All tests pass.

### Step 5 — Verify no regressions

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -10
```

Expected: All existing tests continue to pass.

### Step 6 — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add src/lib/dom-helpers.ts tests/dom-helpers.test.ts
git commit -m "feat(refactor): add dom-helpers module with null-safe getEl/requireEl (ARCH-08)"
```

---

## Task 2: Create Share Utils Module (ARCH-04 partial, ARCH-09)

**Addresses:** Share URL construction and GA4 tracking logic duplicated inline in both `quiz.astro` (lines 405–430) and `[archetype].astro` (lines 103–126). Extract into a shared module so both pages call the same functions.

**Files:**
- Create: `src/lib/share-utils.ts`
- Test: `tests/share-utils.test.ts`

### Step 1 — Write the failing test

Create `tests/share-utils.test.ts`:

```typescript
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
```

### Step 2 — Verify the test fails

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/share-utils.test.ts 2>&1 | tail -20
```

Expected: Tests fail with "Cannot find module".

### Step 3 — Implement share-utils.ts

Create `src/lib/share-utils.ts` with exactly this content:

```typescript
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
```

### Step 4 — Verify the test passes

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/share-utils.test.ts 2>&1 | tail -10
```

Expected: All tests pass.

### Step 5 — Verify no regressions

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -10
```

Expected: All existing tests continue to pass.

### Step 6 — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add src/lib/share-utils.ts tests/share-utils.test.ts
git commit -m "feat(refactor): add share-utils module extracting share URL + GA4 tracking (ARCH-04, ARCH-09)"
```

---

## Task 3: Create ShareButtons.astro Component (ARCH-09)

**Addresses:** Share button SVG markup and click-handler logic duplicated in both `quiz.astro` (lines 168–183) and `[archetype].astro` (lines 57–83). Extract into a single reusable Astro component.

**Important:** This task extracts the HTML structure into a component. It does NOT yet wire up share-utils.ts (that happens in Task 6). The component will contain its own inline script that uses share-utils. The existing pages keep their current scripts untouched until Task 6.

**Files:**
- Create: `src/components/ShareButtons.astro`
- Test: `tests/share-buttons.test.ts`

### Step 1 — Write the failing test

Create `tests/share-buttons.test.ts`:

```typescript
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
```

**Note on forward-looking tests:** The last two tests in the `ShareButtons deduplication` describe block will fail until Task 6. This is intentional — record the baseline now, and they become the acceptance criteria for Task 6.

### Step 2 — Verify the test fails

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/share-buttons.test.ts 2>&1 | tail -20
```

Expected: Multiple failures including "file does not exist".

### Step 3 — Implement ShareButtons.astro

Create `src/components/ShareButtons.astro` with exactly this content:

```astro
---
/**
 * ShareButtons — Reusable Share CTA Component
 *
 * Extracted from quiz.astro (post-submission share section) and
 * [archetype].astro (result page share section).
 *
 * Props:
 *   shareUrl     - Full URL to share (e.g. https://www.thehermeticflight.com/quiz/result/air-weaver)
 *   shareText    - Pre-composed tweet/share text (use buildShareText() from share-utils)
 *   contentType  - GA4 content_type (e.g. 'quiz_result')
 *   itemId       - GA4 item_id (e.g. archetype URL slug like 'air-weaver')
 *   accentColor  - Optional: override button hover accent (unused in current design, reserved)
 */

interface Props {
  shareUrl: string;
  shareText: string;
  contentType: string;
  itemId: string;
  accentColor?: string;
}

const { shareUrl, shareText, contentType, itemId } = Astro.props;

const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
---

<div class="flex justify-center gap-3 flex-wrap" data-share-buttons data-content-type={contentType} data-item-id={itemId} data-share-url={shareUrl}>
  <a
    id="share-x"
    href={xHref}
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
  >
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
    Post
  </a>

  <a
    id="share-fb"
    href={fbHref}
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
  >
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
    Share
  </a>

  <button
    id="share-copy"
    class="inline-flex items-center gap-2 px-4 py-2 border border-hermetic-gold/30 rounded-lg text-hermetic-gold/80 hover:text-hermetic-gold hover:border-hermetic-gold/60 transition-colors text-sm font-sans"
  >
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
    <span id="share-copy-text">Copy Link</span>
  </button>
</div>

<script>
  import { trackShare } from '../lib/share-utils';

  const container = document.querySelector('[data-share-buttons]') as HTMLElement | null;
  if (container) {
    const contentType = container.dataset.contentType ?? 'quiz_result';
    const itemId = container.dataset.itemId ?? '';
    const shareUrl = container.dataset.shareUrl ?? window.location.href;

    const shareX = container.querySelector('#share-x');
    const shareFb = container.querySelector('#share-fb');
    const shareCopy = container.querySelector('#share-copy');
    const shareCopyText = container.querySelector('#share-copy-text');

    shareX?.addEventListener('click', () => trackShare('x', contentType, itemId));
    shareFb?.addEventListener('click', () => trackShare('facebook', contentType, itemId));

    shareCopy?.addEventListener('click', async () => {
      trackShare('copy_link', contentType, itemId);
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (shareCopyText) shareCopyText.textContent = 'Copied!';
      } catch {
        if (shareCopyText) shareCopyText.textContent = 'Copy failed';
      }
      setTimeout(() => {
        if (shareCopyText) shareCopyText.textContent = 'Copy Link';
      }, 2000);
    });
  }
</script>
```

### Step 4 — Verify the test passes (except forward-looking tests)

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/share-buttons.test.ts 2>&1 | tail -20
```

Expected: All tests pass except the two in "ShareButtons deduplication (forward-looking contract)" — those fail because quiz.astro and [archetype].astro have not yet been updated. This is correct. Record this as the baseline.

### Step 5 — Record baseline for forward-looking tests

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/share-buttons.test.ts 2>&1 | grep -E "pass|fail|FAIL|PASS"
```

Note the 2 failing forward-looking tests in the output. Task 6 must make them pass.

### Step 6 — Verify no regressions in other tests

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -10
```

Expected: All previously passing tests still pass. The 2 new forward-looking tests fail — this is expected and acceptable at this stage.

### Step 7 — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add src/components/ShareButtons.astro tests/share-buttons.test.ts
git commit -m "feat(refactor): add ShareButtons.astro component, extract duplicate SVG share buttons (ARCH-09)"
```

---

## Task 4: GA4 Contract Tests (TCF-03)

**Addresses:** GA4 share events, quiz_completed events, and generate_lead events in quiz.astro are completely untested. Add contract tests that (a) mock gtag and verify the correct call shapes at the unit level, and (b) verify the source files contain the expected gtag call patterns.

**CRITICAL — Frozen Test File Protocol:** The agent writing these tests (Task 4) must NOT be the agent implementing share-utils (Task 2) or the quiz.astro refactor (Task 6). The tests define the contract; a separate agent implements against it.

**Files:**
- Create: `tests/ga4-share-events.test.ts`

### Step 1 — Write the tests

Create `tests/ga4-share-events.test.ts`:

```typescript
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
});

// ===========================================================================
// Layer 2: Structural Tests — [archetype].astro contains correct gtag calls
// ===========================================================================

describe('TCF-03: [archetype].astro gtag call patterns (structural)', () => {
  const resultSource = readSource('src/pages/quiz/result/[archetype].astro');

  it('contains a share event (via trackShare or direct gtag)', () => {
    const hasShare =
      resultSource.includes("'share'") ||
      resultSource.includes('trackShare');
    expect(
      hasShare,
      '[archetype].astro must contain either a gtag share event or a trackShare() call',
    ).toBe(true);
  });

  it('share event payload includes method, content_type, item_id', () => {
    // Accept either direct gtag call (pre-Task 6) or trackShare import (post-Task 6)
    const hasDirectPattern =
      /gtag\s*\(\s*['"]event['"]\s*,\s*['"]share['"][\s\S]*?method[\s\S]*?content_type[\s\S]*?item_id/.test(resultSource);
    const hasTrackShare = /trackShare\s*\(/.test(resultSource);
    expect(
      hasDirectPattern || hasTrackShare,
      '[archetype].astro share tracking must include method, content_type, item_id — or delegate to trackShare()',
    ).toBe(true);
  });

  it('contains a gtag typeof guard or uses trackShare (which guards internally)', () => {
    const hasGuard = /typeof\s+gtag\s*===?\s*['"]function['"]/. test(resultSource);
    const hasTrackShare = /trackShare\s*\(/.test(resultSource);
    expect(
      hasGuard || hasTrackShare,
      '[archetype].astro must guard gtag calls — use typeof check or trackShare() which guards internally',
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
```

### Step 2 — Verify the tests (Layer 1 passes, Layer 2 structural assertions pass for existing code)

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/ga4-share-events.test.ts 2>&1 | tail -20
```

Expected: Layer 1 unit tests pass (share-utils exists from Task 2). Layer 2 structural tests pass for the existing quiz.astro and [archetype].astro patterns. The ShareButtons structural tests also pass (component exists from Task 3). All tests should pass.

If any Layer 2 structural test fails, this indicates the existing source code does not match the expected pattern. Investigate the source before proceeding.

### Step 3 — Verify no regressions

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -10
```

### Step 4 — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add tests/ga4-share-events.test.ts
git commit -m "test(ga4): add GA4 contract tests with gtag mock for share/quiz_completed/generate_lead events (TCF-03)"
```

---

## Task 5: Improve E2E Tests (TCF-06 through TCF-10)

**Addresses:**
- TCF-06: Edge cases for slug functions (`toUrlSlug`, `archetypeByUrlSlug`) — empty strings, unknown slugs
- TCF-07: `page.waitForTimeout()` in quiz-flow.spec.ts line 174 — replace with `page.waitForSelector()`
- TCF-08: Canonical URL checked only on shadow-dancer — check all 6 result pages
- TCF-09: Deep OG + share button structural check on only 1 archetype — run on all 6
- TCF-10: Clipboard copy button text change to "Copied!" is untested

**Files:**
- Modify: `tests/archetype-content.test.ts` (add slug edge cases)
- Modify: `tests/quiz-flow.spec.ts` (replace waitForTimeout, expand canonical + structural checks, add copy feedback test)

### Step 1 — Write the failing tests

**Add to `tests/archetype-content.test.ts`** (append after the existing tests, before the closing of the file):

```typescript
// ===========================================================================
// TCF-06: Slug function edge cases
// ===========================================================================

describe('TCF-06: toUrlSlug edge cases', () => {
  it('handles a slug with no underscores (single word)', () => {
    // Type cast required since single-word slugs are not valid ArchetypeSlug values,
    // but the function should still work gracefully on any string.
    expect(toUrlSlug('air' as ArchetypeSlug)).toBe('air');
  });

  it('converts multiple consecutive underscores correctly', () => {
    // Defensive: toUrlSlug replaces all _ globally
    expect(toUrlSlug('air__weaver' as ArchetypeSlug)).toBe('air--weaver');
  });

  it('does not mutate the input string', () => {
    const input = 'air_weaver' as ArchetypeSlug;
    toUrlSlug(input);
    expect(input).toBe('air_weaver');
  });
});

describe('TCF-06: archetypeByUrlSlug edge cases', () => {
  it('returns undefined for an empty string', () => {
    expect(archetypeByUrlSlug('')).toBeUndefined();
  });

  it('returns undefined for a slug with wrong separator (underscore instead of hyphen)', () => {
    expect(archetypeByUrlSlug('air_weaver')).toBeUndefined();
  });

  it('returns undefined for a partial match', () => {
    expect(archetypeByUrlSlug('air')).toBeUndefined();
  });

  it('returns undefined for a slug with trailing hyphen', () => {
    expect(archetypeByUrlSlug('air-weaver-')).toBeUndefined();
  });

  it('is case-sensitive — uppercase does not match', () => {
    expect(archetypeByUrlSlug('Air-Weaver')).toBeUndefined();
  });
});
```

**Add to `tests/quiz-flow.spec.ts`** — new test functions and runner entries:

```typescript
// ---------------------------------------------------------------------------
// Test: TCF-07 — Condition-based wait: Quiz start button activates Q1 without
//   relying on waitForTimeout
// ---------------------------------------------------------------------------
async function testQuizIntroAndStartConditionWait() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz`);

    const startBtn = await page.$('#start-quiz');
    if (!startBtn) throw new Error('Start quiz button not found');

    const introActive = await page.$('#quiz-intro.active');
    if (!introActive) throw new Error('Quiz intro should be active on load');

    await startBtn.click();

    // TCF-07: Use waitForSelector with .active state instead of waitForTimeout
    await page.waitForSelector('[data-step="1"].active', { timeout: 3000 });

    const q1 = await page.$('[data-step="1"].active');
    if (!q1) throw new Error('Question 1 should be active after clicking start');

    pass('testQuizIntroAndStartConditionWait (TCF-07: condition-based wait)');
  } catch (err) {
    fail('testQuizIntroAndStartConditionWait', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: TCF-08 — Canonical URL uses www on ALL 6 result pages
// ---------------------------------------------------------------------------
async function testAllResultPagesCanonicalURL() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const slugs = [
    'air-weaver',
    'embodied-intuitive',
    'ascending-seeker',
    'shadow-dancer',
    'flow-artist',
    'grounded-mystic',
  ];
  try {
    for (const slug of slugs) {
      await page.goto(`${BASE_URL}/quiz/result/${slug}`);

      const canonical = await page.$eval(
        'link[rel="canonical"]',
        (el) => el.getAttribute('href'),
      );
      if (!canonical?.startsWith('https://www.thehermeticflight.com')) {
        throw new Error(
          `/quiz/result/${slug}: canonical should use www prefix, got: ${canonical}`,
        );
      }
    }
    pass('testAllResultPagesCanonicalURL (TCF-08: all 6 pages checked)');
  } catch (err) {
    fail('testAllResultPagesCanonicalURL', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: TCF-09 — OG tags and share buttons on ALL 6 result pages
// ---------------------------------------------------------------------------
async function testAllResultPagesStructure() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const archetypes = [
    { slug: 'air-weaver',          title: 'The Air Weaver' },
    { slug: 'embodied-intuitive',  title: 'The Embodied Intuitive' },
    { slug: 'ascending-seeker',    title: 'The Ascending Seeker' },
    { slug: 'shadow-dancer',       title: 'The Shadow Dancer' },
    { slug: 'flow-artist',         title: 'The Flow Artist' },
    { slug: 'grounded-mystic',     title: 'The Grounded Mystic' },
  ];
  try {
    for (const { slug, title } of archetypes) {
      await page.goto(`${BASE_URL}/quiz/result/${slug}`);

      // h1 contains the archetype title
      const h1Text = await page.textContent('h1');
      if (!h1Text?.includes(title)) {
        throw new Error(`/quiz/result/${slug}: expected h1 to contain "${title}", got: ${h1Text}`);
      }

      // OG title references the archetype
      const ogTitle = await page.$eval(
        'meta[property="og:title"]',
        (el) => el.getAttribute('content'),
      );
      if (!ogTitle || ogTitle.length === 0) {
        throw new Error(`/quiz/result/${slug}: og:title missing or empty`);
      }

      // OG image references the slug
      const ogImage = await page.$eval(
        'meta[property="og:image"]',
        (el) => el.getAttribute('content'),
      );
      if (!ogImage?.includes(slug)) {
        throw new Error(`/quiz/result/${slug}: og:image should reference slug, got: ${ogImage}`);
      }

      // Share links present (X + Facebook)
      const shareLinks = await page.$$('#share-buttons a, [data-share-buttons] a');
      if (shareLinks.length < 2) {
        throw new Error(
          `/quiz/result/${slug}: expected at least 2 share links, got: ${shareLinks.length}`,
        );
      }

      // Copy button present
      const copyBtn = await page.$('#copy-link-btn, #share-copy');
      if (!copyBtn) throw new Error(`/quiz/result/${slug}: copy button not found`);
    }
    pass('testAllResultPagesStructure (TCF-09: all 6 archetypes checked)');
  } catch (err) {
    fail('testAllResultPagesStructure', err);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Test: TCF-10 — Clipboard copy button text changes to "Copied!"
// ---------------------------------------------------------------------------
async function testCopyButtonFeedback() {
  const browser = await chromium.launch();
  // Copy button requires clipboard permissions — grant them
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/quiz/result/air-weaver`);

    // Find the copy button (id may be copy-link-btn or share-copy depending on
    // whether Task 6 has been run; check both)
    const copyBtn = await page.$('#copy-link-btn, #share-copy');
    if (!copyBtn) throw new Error('Copy button not found on result page');

    // Get the initial text of the copy label span
    const initialText = await page.textContent('#copy-text, #share-copy-text');
    if (!initialText?.toLowerCase().includes('copy')) {
      throw new Error(`Copy button initial text unexpected: ${initialText}`);
    }

    // Click the button
    await copyBtn.click();

    // TCF-10: Wait for the feedback text to appear (condition-based wait, not timeout)
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#copy-text, #share-copy-text');
        return el?.textContent === 'Copied!';
      },
      { timeout: 3000 },
    );

    const feedbackText = await page.textContent('#copy-text, #share-copy-text');
    if (feedbackText !== 'Copied!') {
      throw new Error(`Expected "Copied!" after click, got: ${feedbackText}`);
    }

    pass('testCopyButtonFeedback (TCF-10: clipboard feedback verified)');
  } catch (err) {
    fail('testCopyButtonFeedback', err);
  } finally {
    await browser.close();
  }
}
```

Also add the new functions to the `run()` function in quiz-flow.spec.ts:

```typescript
await testQuizIntroAndStartConditionWait();
await testAllResultPagesCanonicalURL();
await testAllResultPagesStructure();
await testCopyButtonFeedback();
```

### Step 2 — Verify edge case tests fail first (for archetype-content.test.ts additions)

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run tests/archetype-content.test.ts 2>&1 | grep -E "TCF-06|FAIL|pass" | head -20
```

Expected: The TCF-06 tests should pass immediately (the functions already exist and handle these cases). If any fail, the implementation in Task 2 needs adjustment — but these are edge-case defensive tests so most should pass.

### Step 3 — Verify all unit tests pass

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -10
```

### Step 4 — Verify E2E tests (requires running server)

The E2E improvements in quiz-flow.spec.ts require a running dev server. Verify the syntax compiles cleanly:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

Expected: No TypeScript errors in the test file.

### Step 5 — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add tests/archetype-content.test.ts tests/quiz-flow.spec.ts
git commit -m "test(e2e): improve E2E tests with condition-based waits, all-archetype checks, copy feedback (TCF-06 through TCF-10)"
```

---

## Task 6: Refactor quiz.astro to Use Extracted Modules (ARCH-04)

**Addresses:** quiz.astro script block is ~256 lines. After extracting dom-helpers, share-utils, and the ShareButtons component, the script block should shrink to ~150 lines. This is the highest-risk task — all tests must pass before AND after.

**CRITICAL — Behavioral Equivalence:** This is a pure refactor. Zero behavioral changes allowed. Every existing test must pass before and after. The forward-looking tests from Task 3 (`ShareButtons deduplication`) must now pass.

**Files:**
- Modify: `src/pages/quiz.astro`
- Modify: `src/pages/quiz/result/[archetype].astro`

### Pre-flight check — confirm all tests pass before touching quiz.astro

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -5
```

If any tests fail before this task begins, STOP and resolve them first.

### Step 1 — Refactor quiz.astro

**Changes to make in `src/pages/quiz.astro`:**

1. Add `ShareButtons` component import in the frontmatter
2. Add `buildShareText` and `toUrlSlug` imports (already present — verify)
3. Replace the share section HTML (lines 164–184) with `<ShareButtons ... />` tag
4. In the `<script>` block: replace `as HTMLElement` casts and `!` assertions with `requireEl`/`getEl` from dom-helpers
5. In the `<script>` block: replace the inline share URL + tracking logic with share-utils calls
6. Remove the now-redundant inline share click handler setup (lines 419–430)

**Updated frontmatter** (replace existing `---` block):

```astro
---
import Layout from '../layouts/Layout.astro';
import ShareButtons from '../components/ShareButtons.astro';
import { questions } from '../lib/quiz-data';
import { archetypes } from '../lib/archetype-content';
---
```

**Replace the share section in the HTML** (the `<div id="share-section" ...>` block inside `#email-success`):

```astro
<!-- Share Buttons (rendered via ShareButtons component; URLs populated by data attributes from JS) -->
<div id="share-section" class="border-t border-hermetic-gold/20 pt-6 mt-6">
  <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-4">Share Your Archetype</p>
  <div id="share-buttons-mount"></div>
</div>
```

**Note:** The ShareButtons component is SSG — it needs the archetype slug at build time for the href attributes. Since quiz.astro is fully dynamic (the archetype is only known client-side after quiz completion), we cannot pre-render the ShareButtons component with the correct URLs. Instead, quiz.astro will continue to dynamically update the share link hrefs in JavaScript as it does today, but will delegate GA4 tracking to `trackShare` from share-utils.

This means the HTML structure of the share buttons stays in quiz.astro (it is already there and dynamically populated), but the tracking logic is replaced with `trackShare()` calls. Full component extraction in quiz.astro is limited to the result page where the archetype is known at build time.

**Revised approach for quiz.astro script block** — replace the inline tracking logic at lines 419–430:

Replace:
```javascript
// Track share clicks
[shareX, shareFb, shareCopy].forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof gtag === 'function') {
      const platform = btn === shareX ? 'x' : btn === shareFb ? 'facebook' : 'copy_link';
      gtag('event', 'share', {
        method: platform,
        content_type: 'quiz_result',
        item_id: quizArchetype,
      });
    }
  });
});
```

With:
```javascript
import { trackShare } from '../lib/share-utils';

// Track share clicks
shareX.addEventListener('click', () => trackShare('x', 'quiz_result', quizArchetype ?? ''));
shareFb.addEventListener('click', () => trackShare('facebook', 'quiz_result', quizArchetype ?? ''));
shareCopy.addEventListener('click', () => trackShare('copy_link', 'quiz_result', quizArchetype ?? ''));
```

**Replace `as` casts in the DOM refs block** (lines 216–230):

Replace the entire DOM refs block:
```javascript
// DOM refs
const allSteps = document.querySelectorAll<HTMLElement>('.quiz-step');
const progressBar = document.getElementById('progress-bar')!;
const progressFill = document.getElementById('progress-fill')!;
const progressText = document.getElementById('progress-text')!;
const startBtn = document.getElementById('start-quiz')!;
const resultTitle = document.getElementById('result-title')!;
const resultElement = document.getElementById('result-element')!;
const resultDescription = document.getElementById('result-description')!;
const resultLabel = document.getElementById('result-label')!;
const resultDivider = document.getElementById('result-divider')!;
const resultGlow = document.getElementById('result-glow')!;
const emailSection = document.getElementById('email-section')!;
const emailForm = document.getElementById('email-form') as HTMLFormElement;
const emailSuccess = document.getElementById('email-success')!;
const submitBtn = document.getElementById('submit-btn')!;
```

With:
```javascript
import { requireEl, getEl } from '../lib/dom-helpers';

// DOM refs
const allSteps = document.querySelectorAll<HTMLElement>('.quiz-step');
const progressBar = requireEl('progress-bar');
const progressFill = requireEl('progress-fill');
const progressText = requireEl('progress-text');
const startBtn = requireEl('start-quiz');
const resultTitle = requireEl('result-title');
const resultElement = requireEl('result-element');
const resultDescription = requireEl('result-description');
const resultLabel = requireEl('result-label');
const resultDivider = requireEl('result-divider');
const resultGlow = requireEl('result-glow');
const emailSection = requireEl('email-section');
const emailForm = requireEl<HTMLFormElement>('email-form');
const emailSuccess = requireEl('email-success');
const submitBtn = requireEl('submit-btn');
```

**Refactor [archetype].astro** — replace the `<script>` block with a version that uses `trackShare` from share-utils and the ShareButtons component:

In the frontmatter of `[archetype].astro`, add the ShareButtons import:
```astro
import ShareButtons from '../../../components/ShareButtons.astro';
```

Replace the share section HTML:
```astro
<!-- Share Section -->
<div class="border-t border-hermetic-gold/20 pt-8 mt-4">
  <p class="text-hermetic-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-4">Share This Archetype</p>
  <ShareButtons
    shareUrl={`https://www.thehermeticflight.com/quiz/result/${urlSlug}`}
    shareText={`I'm ${archetype.title} — ${archetype.element} element. Discover your aerial tarot archetype:`}
    contentType="quiz_result"
    itemId={urlSlug}
  />
</div>
```

Remove the `<script>` block entirely from `[archetype].astro` — the ShareButtons component handles all client-side behavior (copy handler + GA4 tracking via trackShare).

### Step 2 — Run the full test suite

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1 | tail -20
```

Expected:
- All previously passing tests continue to pass
- The 2 forward-looking tests from Task 3 (`ShareButtons deduplication`) now pass
- `tests/ga4-share-events.test.ts` Layer 2 structural tests pass with updated source patterns

If any test fails, do NOT commit. Diagnose the failure, fix the source, re-run until all tests pass.

### Step 3 — Verify build compiles cleanly

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

### Step 4 — Verify script block line count reduction

```bash
awk '/^  <script>/{found=1; count=0} found{count++} /<\/script>/{if(found){print count; found=0}}' /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight/src/pages/quiz.astro
```

Expected: Line count less than 175 (down from ~256).

### Step 5 — Commit

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add src/pages/quiz.astro src/pages/quiz/result/[archetype].astro
git commit -m "refactor(quiz): extract dom-helpers, share-utils, ShareButtons into quiz.astro and result page (ARCH-04, ARCH-08, ARCH-09)"
```

---

## Task 7: Quality Gates

### 7a — Frozen Test File Verification

Confirm that the test files written in Tasks 1–5 have not been modified during implementation:

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git log --oneline tests/dom-helpers.test.ts tests/share-utils.test.ts tests/share-buttons.test.ts tests/ga4-share-events.test.ts tests/archetype-content.test.ts tests/quiz-flow.spec.ts
```

Each test file should have exactly one commit (authored during its task). If any test file has multiple commits, investigate whether the test contract was modified during implementation — this violates the FTF protocol.

### 7b — Full Test Suite Passage

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npx vitest run 2>&1
```

Expected: All tests pass. Zero failures.

Count tests before and after this sprint to verify test coverage increased:

```bash
npx vitest run 2>&1 | grep -E "Tests\s+[0-9]"
```

Pre-sprint baseline (from hardening-2026-03-08): 341 tests. Post-sprint should be higher.

### 7c — Build Health

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
npm run build 2>&1 | tail -5
```

Expected: Build completes successfully with no errors.

### 7d — Three-Evaluator Convergence Analysis

After all tasks complete, deploy 3 independent evaluation subagents with orthogonal lenses:

**Evaluator 1 — Regression Lens**
Verify: All 341+ tests pass. No behavioral changes in quiz.astro or [archetype].astro. The quiz flow (start → answer questions → see results → submit email → share) functions identically to pre-refactor. GA4 events still fire with the same event names and payloads. Facebook pixel still fires on lead generation.

**Evaluator 2 — Code Quality Lens**
Verify: DRY — share URL construction logic exists in exactly one place (share-utils.ts). Type safety — no unsafe `as HTMLElement` casts remain in quiz.astro script block. Module boundaries — each module has a single clear responsibility. ShareButtons.astro is self-contained (includes its own script, imports from share-utils). dom-helpers.ts has no dependencies on project-specific logic.

**Evaluator 3 — Test Coverage Lens**
Verify: All 9 deferred findings now have at least one test. GA4 events have both unit-level mock tests AND structural source-level tests. E2E tests use condition-based waits (no remaining `waitForTimeout` calls that could be condition-based). All 6 archetypes are covered in canonical URL, OG structure, and share button tests.

**Synthesis:** Convergence analysis — findings from 2+ evaluators are high-confidence and must be remediated before closing the sprint.

**Note:** Run `harden` after evaluation if findings warrant remediation. This is Sprint 4 — the code quality sprint — so the bar for harden is higher here. A finding must affect correctness or introduce a regression risk to trigger a remediation cycle. Pure aesthetic preferences do not trigger harden.

### 7e — Final Sprint Commit (if evaluation requires no remediation)

```bash
cd /Users/taylorquigley/Documents/Quigley-Multimedia/thehermeticflight
git add .
git commit -m "chore: complete Sprint 4A quiz refactoring — all 9 deferred findings addressed"
```

---

## Verification Checklist

Before closing Sprint 4A, confirm all of the following:

| Check | Command | Expected |
|-------|---------|----------|
| All tests pass | `npx vitest run` | Zero failures |
| Build succeeds | `npm run build` | No errors |
| quiz.astro script block < 175 lines | Line count awk | < 175 |
| No `as HTMLElement` casts remain in quiz.astro script | `grep 'as HTML' src/pages/quiz.astro` | Zero matches in script block |
| No inline slug replace in quiz.astro | `grep 'replace(/_/g' src/pages/quiz.astro` | Zero matches |
| ShareButtons imported in [archetype].astro | `grep 'ShareButtons' src/pages/quiz/result/[archetype].astro` | One import match |
| trackShare imported in ShareButtons.astro | `grep 'trackShare' src/components/ShareButtons.astro` | Present |
| dom-helpers.ts exports both helpers | `grep 'export function' src/lib/dom-helpers.ts` | getEl + requireEl |
| share-utils.ts exports all functions | `grep 'export function' src/lib/share-utils.ts` | 4 functions |
| No [archetype].astro script block | `grep '<script' src/pages/quiz/result/[archetype].astro` | Zero or only component scripts |
