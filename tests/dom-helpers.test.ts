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
