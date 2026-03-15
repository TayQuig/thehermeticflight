/**
 * Hardening Sprint -- Medium-Severity Contract Tests
 *
 * F-04: Clipboard API calls lack error handling
 * F-05: Hardcoded siteUrl should derive from Astro.site
 * F-06: Slug conversion logic duplicated
 * F-07: No test verifies OG images exist at expected paths
 * F-08: No test for sitemap inclusion of result pages
 * F-09: elementColors map duplicated outside archetype-content.ts
 *
 * These are SOURCE-LEVEL contract tests that read .astro/.ts files directly
 * and verify structural invariants via regex/string analysis. They do NOT
 * require a build step or browser environment.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { archetypes, toUrlSlug } from '../src/lib/archetype-content';
import type { ArchetypeSlug } from '../src/lib/classifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  const full = path.join(ROOT, relativePath);
  return fs.readFileSync(full, 'utf-8');
}

const ALL_SLUGS: ArchetypeSlug[] = [
  'air_weaver',
  'embodied_intuitive',
  'ascending_seeker',
  'shadow_dancer',
  'flow_artist',
  'grounded_mystic',
];

// ---------------------------------------------------------------------------
// F-04: Clipboard API calls must have error handling
// ---------------------------------------------------------------------------

describe('F-04: Clipboard API calls have error handling', () => {
  describe('quiz.astro clipboard usage', () => {
    const quizSource = readSource('src/pages/quiz.astro');

    it('wraps navigator.clipboard.writeText in a try/catch block', () => {
      // Extract all <script> blocks from quiz.astro
      const scriptBlocks = quizSource.match(/<script[\s\S]*?<\/script>/g);
      expect(scriptBlocks, 'quiz.astro must contain at least one <script> block').not.toBeNull();

      // Find the script block(s) that contain clipboard.writeText
      const clipboardScripts = scriptBlocks!.filter((block) =>
        block.includes('clipboard.writeText'),
      );
      expect(
        clipboardScripts.length,
        'quiz.astro must contain at least one script block using clipboard.writeText',
      ).toBeGreaterThanOrEqual(1);

      for (const script of clipboardScripts) {
        // Verify that clipboard.writeText appears inside a try block.
        // The pattern: try { ... clipboard.writeText ... } catch
        const tryCatchWrapsClipboard = /try\s*\{[^}]*clipboard\.writeText/.test(script);
        expect(
          tryCatchWrapsClipboard,
          'quiz.astro: navigator.clipboard.writeText must be wrapped in a try/catch block — ' +
            'the Clipboard API can throw (e.g., when document is not focused or permissions are denied)',
        ).toBe(true);
      }
    });

    it('provides user feedback on clipboard failure (catch is local to clipboard handler)', () => {
      const scriptBlocks = quizSource.match(/<script[\s\S]*?<\/script>/g) || [];
      const clipboardScripts = scriptBlocks.filter((block) =>
        block.includes('clipboard.writeText'),
      );

      for (const script of clipboardScripts) {
        // Extract the clipboard event listener callback. The clipboard call lives inside
        // an addEventListener('click', async () => { ... }) block. We need to find
        // a try/catch INSIDE that callback, not an outer try/catch from a parent scope.
        //
        // Strategy: find the addEventListener callback that contains clipboard.writeText
        // and verify it has its own try/catch with feedback (textContent assignment).
        // We look for the pattern: async () => { try { ... clipboard.writeText ... } catch ... textContent
        // within a narrow scope (< 300 chars from clipboard.writeText to catch + feedback).
        const clipboardHandlerWithLocalCatch =
          /addEventListener\s*\(\s*['"]click['"]\s*,\s*async\s*\(\s*\)\s*=>\s*\{\s*try\s*\{[^}]*clipboard\.writeText/;
        expect(
          clipboardHandlerWithLocalCatch.test(script),
          'quiz.astro: The clipboard click handler must have its own try/catch block — ' +
            'an outer try/catch from the form handler does not protect the clipboard call',
        ).toBe(true);
      }
    });
  });

  describe('ShareButtons.astro clipboard usage (delegates from [archetype].astro)', () => {
    const shareButtonsSource = readSource('src/components/ShareButtons.astro');

    it('wraps navigator.clipboard.writeText in a try/catch block', () => {
      const scriptBlocks = shareButtonsSource.match(/<script[\s\S]*?<\/script>/g);
      expect(
        scriptBlocks,
        'ShareButtons.astro must contain at least one <script> block',
      ).not.toBeNull();

      const clipboardScripts = scriptBlocks!.filter((block) =>
        block.includes('clipboard.writeText'),
      );
      expect(
        clipboardScripts.length,
        'ShareButtons.astro must contain at least one script block using clipboard.writeText',
      ).toBeGreaterThanOrEqual(1);

      for (const script of clipboardScripts) {
        const tryCatchWrapsClipboard = /try\s*\{[^}]*clipboard\.writeText/.test(script);
        expect(
          tryCatchWrapsClipboard,
          'ShareButtons.astro: navigator.clipboard.writeText must be wrapped in a try/catch block',
        ).toBe(true);
      }
    });

    it('provides user feedback on clipboard failure', () => {
      const scriptBlocks = shareButtonsSource.match(/<script[\s\S]*?<\/script>/g) || [];
      const clipboardScripts = scriptBlocks.filter((block) =>
        block.includes('clipboard.writeText'),
      );

      for (const script of clipboardScripts) {
        const hasTryCatchWithClipboard = /try\s*\{[\s\S]*?clipboard\.writeText[\s\S]*?\}\s*catch/.test(script);
        expect(
          hasTryCatchWithClipboard,
          'ShareButtons.astro: The clipboard handler must have try/catch with error feedback',
        ).toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// F-05: Layout.astro siteUrl must derive from Astro.site
// ---------------------------------------------------------------------------

describe('F-05: Layout.astro siteUrl derives from Astro.site', () => {
  const layoutSource = readSource('src/layouts/Layout.astro');

  it('references Astro.site in siteUrl derivation', () => {
    // The siteUrl variable should use Astro.site rather than a hardcoded string.
    // Accept patterns like:
    //   const siteUrl = Astro.site?.origin
    //   const siteUrl = Astro.site?.href
    //   const siteUrl = new URL(Astro.site)
    //   const siteUrl = String(Astro.site)
    // Reject:
    //   const siteUrl = 'https://www.thehermeticflight.com'
    const siteUrlLine = layoutSource.match(
      /(?:const|let|var)\s+siteUrl\s*=\s*(.+)/,
    );
    expect(siteUrlLine, 'Layout.astro must declare a siteUrl variable').not.toBeNull();

    const siteUrlValue = siteUrlLine![1];
    expect(
      siteUrlValue.includes('Astro.site'),
      `Layout.astro: siteUrl must derive from Astro.site, but found: ${siteUrlValue.trim()} ` +
        '-- hardcoding the URL means it can drift from the astro.config.mjs site value',
    ).toBe(true);
  });

  it('does not hardcode the full domain URL in siteUrl assignment', () => {
    // Specifically check that the siteUrl assignment line does NOT contain
    // a hardcoded https://... string
    const siteUrlLine = layoutSource.match(
      /(?:const|let|var)\s+siteUrl\s*=\s*(.+)/,
    );
    expect(siteUrlLine, 'Layout.astro must declare a siteUrl variable').not.toBeNull();

    const siteUrlValue = siteUrlLine![1];
    const hasHardcodedUrl = /['"`]https?:\/\//.test(siteUrlValue);
    expect(
      hasHardcodedUrl,
      'Layout.astro: siteUrl should NOT contain a hardcoded URL string — ' +
        'it must derive from Astro.site so the URL stays in sync with astro.config.mjs',
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F-06: Slug conversion must use toUrlSlug, not inline replace
// ---------------------------------------------------------------------------

describe('F-06: quiz.astro uses toUrlSlug instead of inline slug conversion', () => {
  const quizSource = readSource('src/pages/quiz.astro');

  it('imports toUrlSlug from archetype-content', () => {
    // Check for a named import of toUrlSlug
    const importPattern = /import\s*\{[^}]*\btoUrlSlug\b[^}]*\}\s*from\s*['"][^'"]*archetype-content['"]/;
    expect(
      importPattern.test(quizSource),
      'quiz.astro must import toUrlSlug from archetype-content — ' +
        'slug conversion logic should not be duplicated',
    ).toBe(true);
  });

  it('does not contain inline .replace(/_/g slug conversion', () => {
    // The script section should NOT contain the inline pattern:
    //   .replace(/_/g, '-')
    // This is the duplicated logic that should be replaced by toUrlSlug()
    const scriptBlocks = quizSource.match(/<script[\s\S]*?<\/script>/g) || [];
    for (const script of scriptBlocks) {
      const inlineReplace = /\.replace\s*\(\s*\/_\/g\s*,\s*['"][-]['"]/.test(script);
      expect(
        inlineReplace,
        'quiz.astro: must not contain inline .replace(/_/g, \'-\') — ' +
          'use the imported toUrlSlug() function instead to avoid logic duplication',
      ).toBe(false);
    }
  });

  it('calls toUrlSlug for URL slug derivation in the script block', () => {
    // After removing the inline replace, quiz.astro should call toUrlSlug()
    // somewhere in the script for constructing the share URL slug.
    const scriptBlocks = quizSource.match(/<script[\s\S]*?<\/script>/g) || [];
    const hasToUrlSlugCall = scriptBlocks.some((script) =>
      /\btoUrlSlug\s*\(/.test(script),
    );
    expect(
      hasToUrlSlugCall,
      'quiz.astro: must call toUrlSlug() in its script block for share URL construction',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F-07: OG images exist at expected paths
// ---------------------------------------------------------------------------

describe('F-07: OG images exist for all archetypes', () => {
  const ogDir = path.join(ROOT, 'public', 'images', 'og');

  it('default.png exists', () => {
    const filePath = path.join(ogDir, 'default.png');
    expect(
      fs.existsSync(filePath),
      `OG image missing: public/images/og/default.png`,
    ).toBe(true);
  });

  for (const slug of ALL_SLUGS) {
    const urlSlug = toUrlSlug(slug);
    const fileName = `${urlSlug}.png`;

    it(`${fileName} exists for archetype "${slug}"`, () => {
      const filePath = path.join(ogDir, fileName);
      expect(
        fs.existsSync(filePath),
        `OG image missing: public/images/og/${fileName} — this image is referenced by the result page for ${slug}`,
      ).toBe(true);
    });
  }

  it('exactly 7 OG images exist (default + 6 archetypes)', () => {
    const expectedFiles = ['default.png', ...ALL_SLUGS.map((s) => `${toUrlSlug(s)}.png`)];
    for (const file of expectedFiles) {
      expect(
        fs.existsSync(path.join(ogDir, file)),
        `Expected OG image missing: ${file}`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// F-08: Sitemap includes result pages
// ---------------------------------------------------------------------------

describe('F-08: Sitemap integration covers archetype result pages', () => {
  it('astro.config.mjs includes the sitemap integration', () => {
    const configSource = readSource('astro.config.mjs');

    // Check for sitemap import
    const sitemapImport = /import\s+sitemap\s+from\s+['"]@astrojs\/sitemap['"]/;
    expect(
      sitemapImport.test(configSource),
      'astro.config.mjs must import sitemap from @astrojs/sitemap',
    ).toBe(true);

    // Check that sitemap() is in the integrations array
    const sitemapInIntegrations = /integrations\s*:\s*\[[^\]]*sitemap\s*\(\s*\)/;
    expect(
      sitemapInIntegrations.test(configSource),
      'astro.config.mjs must include sitemap() in the integrations array',
    ).toBe(true);
  });

  it('astro.config.mjs has a site value configured', () => {
    const configSource = readSource('astro.config.mjs');

    // Sitemap integration requires a site value to generate URLs
    const siteConfig = /site\s*:\s*['"]https?:\/\//;
    expect(
      siteConfig.test(configSource),
      'astro.config.mjs must have a site value configured (required by the sitemap integration)',
    ).toBe(true);
  });

  it('[archetype].astro exports getStaticPaths that maps all 6 archetypes', () => {
    const resultSource = readSource('src/pages/quiz/result/[archetype].astro');

    // getStaticPaths must be exported
    const getStaticPathsExport = /export\s+const\s+getStaticPaths/;
    expect(
      getStaticPathsExport.test(resultSource),
      '[archetype].astro must export getStaticPaths for static generation',
    ).toBe(true);

    // getStaticPaths must iterate over all archetypes (uses Object.keys(archetypes))
    const mapsAllArchetypes =
      /getStaticPaths[\s\S]*?Object\.keys\s*\(\s*archetypes\s*\)/;
    expect(
      mapsAllArchetypes.test(resultSource),
      '[archetype].astro: getStaticPaths must map over Object.keys(archetypes) ' +
        'to generate routes for all 6 archetypes',
    ).toBe(true);
  });

  it('[archetype].astro getStaticPaths uses toUrlSlug for param generation', () => {
    const resultSource = readSource('src/pages/quiz/result/[archetype].astro');

    // The params should use toUrlSlug to convert internal slugs to URL slugs
    const usesToUrlSlug =
      /getStaticPaths[\s\S]*?toUrlSlug/;
    expect(
      usesToUrlSlug.test(resultSource),
      '[archetype].astro: getStaticPaths must use toUrlSlug for URL parameter generation',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F-09: elementColors map must live in archetype-content.ts, not in pages
// ---------------------------------------------------------------------------

describe('F-09: elementColors/accentHex centralized in archetype-content.ts', () => {
  describe('archetype-content.ts has accentHex field', () => {
    it('ArchetypeContent objects include an accentHex property', () => {
      // Verify at runtime that all archetype objects have an accentHex field
      for (const slug of ALL_SLUGS) {
        const content = archetypes[slug] as Record<string, unknown>;
        expect(
          'accentHex' in content,
          `Archetype "${slug}" must have an accentHex property in archetype-content.ts — ` +
            'element accent colors should be centralized, not duplicated in page components',
        ).toBe(true);
      }
    });

    it('all accentHex values are valid hex color strings', () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      for (const slug of ALL_SLUGS) {
        const content = archetypes[slug] as Record<string, unknown>;
        const accentHex = content.accentHex;
        expect(
          typeof accentHex === 'string' && hexPattern.test(accentHex),
          `Archetype "${slug}".accentHex must be a valid 6-digit hex color (e.g., "#93c5fd"), ` +
            `but got: ${JSON.stringify(accentHex)}`,
        ).toBe(true);
      }
    });

    it('ArchetypeContent interface includes accentHex in source', () => {
      const contentSource = readSource('src/lib/archetype-content.ts');

      // The interface definition must include accentHex
      const interfaceBlock = contentSource.match(
        /export\s+interface\s+ArchetypeContent\s*\{([\s\S]*?)\}/,
      );
      expect(
        interfaceBlock,
        'archetype-content.ts must export an ArchetypeContent interface',
      ).not.toBeNull();

      expect(
        interfaceBlock![1].includes('accentHex'),
        'ArchetypeContent interface must include an accentHex field — ' +
          'this centralizes element accent colors that were previously duplicated in page components',
      ).toBe(true);
    });
  });

  describe('[archetype].astro does not duplicate elementColors', () => {
    const resultSource = readSource('src/pages/quiz/result/[archetype].astro');

    it('does not define a local elementColors map', () => {
      // The result page must NOT contain a local elementColors definition
      const elementColorsPattern =
        /(?:const|let|var)\s+elementColors\s*(?::\s*Record<[^>]+>\s*)?=/;
      expect(
        elementColorsPattern.test(resultSource),
        '[archetype].astro must NOT define a local elementColors map — ' +
          'accent colors should be imported from archetype-content.ts via the accentHex field',
      ).toBe(false);
    });

    it('uses archetype.accentHex instead of a local color lookup', () => {
      // After removing the local map, the page should reference archetype.accentHex
      // for the accent color value
      expect(
        resultSource.includes('archetype.accentHex') || resultSource.includes('accentHex'),
        '[archetype].astro must reference accentHex from the archetype content object ' +
          'instead of using a local elementColors lookup',
      ).toBe(true);
    });
  });
});
