/**
 * Hardening Sprint — High-Severity Contract Tests
 *
 * F-01: Blog canonical URL missing `www` prefix
 * F-02: OG meta test validates reference impl, not actual Layout
 * F-03: No test for full quiz → share CTA user journey
 *
 * These are SOURCE-LEVEL contract tests that read .astro/.ts files directly
 * and verify structural invariants via regex/string analysis. They do NOT
 * require a build step or browser environment.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { toUrlSlug, archetypeByUrlSlug, archetypes } from '../src/lib/archetype-content';
import type { ArchetypeSlug } from '../src/lib/classifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  const full = path.join(ROOT, relativePath);
  return fs.readFileSync(full, 'utf-8');
}

const CANONICAL_DOMAIN = 'https://www.thehermeticflight.com';

// ---------------------------------------------------------------------------
// F-01: Blog canonical URL must use www prefix
// ---------------------------------------------------------------------------

describe('F-01: Blog canonical URL uses www prefix', () => {
  const blogSlugSource = readSource('src/pages/blog/[...slug].astro');

  it('does not contain a hardcoded canonical URL without the www prefix', () => {
    // Match any URL that starts with https://thehermeticflight.com (no www)
    // but allow https://www.thehermeticflight.com
    const bareUrlPattern = /https:\/\/thehermeticflight\.com(?!\.)/;
    const matches = blogSlugSource.match(bareUrlPattern);
    expect(
      matches,
      'Blog [...slug].astro contains a canonical URL without "www" prefix — all canonical URLs must use https://www.thehermeticflight.com',
    ).toBeNull();
  });

  it('constructs a canonical URL that includes the www prefix', () => {
    // The source must contain a canonical URL construction that uses the www domain.
    // This can be via a variable (like siteUrl) or a literal string.
    // We check that somewhere in the frontmatter the www domain is present
    // in the context of canonical URL construction.
    const hasWwwCanonical =
      blogSlugSource.includes('www.thehermeticflight.com') ||
      blogSlugSource.includes('siteUrl');
    expect(
      hasWwwCanonical,
      'Blog [...slug].astro must construct its canonical URL using https://www.thehermeticflight.com (either directly or via a siteUrl variable)',
    ).toBe(true);
  });

  it('passes the canonical URL to the Layout component', () => {
    // The Layout invocation must include canonicalURL as a prop
    const layoutCanonicalProp = /canonicalURL\s*=\s*\{/;
    expect(
      layoutCanonicalProp.test(blogSlugSource),
      'Blog [...slug].astro must pass canonicalURL prop to Layout',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F-02: Layout.astro OG meta tags — source-level contract
// ---------------------------------------------------------------------------

describe('F-02: Layout.astro contains required OG and Twitter meta tags', () => {
  const layoutSource = readSource('src/layouts/Layout.astro');

  // --- Open Graph required tags ---

  const requiredOGProperties = [
    'og:title',
    'og:description',
    'og:image',
    'og:url',
    'og:type',
    'og:site_name',
  ] as const;

  for (const prop of requiredOGProperties) {
    it(`contains <meta property="${prop}" ...> tag`, () => {
      // Match: <meta property="og:title" content={...} /> (with or without Astro expressions)
      const pattern = new RegExp(
        `<meta\\s+property=["']${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s+content=`,
      );
      expect(
        pattern.test(layoutSource),
        `Layout.astro must contain a <meta property="${prop}" content=...> tag`,
      ).toBe(true);
    });
  }

  // --- Twitter Card required tags ---

  const requiredTwitterNames = [
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
  ] as const;

  for (const name of requiredTwitterNames) {
    it(`contains <meta name="${name}" ...> tag`, () => {
      const pattern = new RegExp(
        `<meta\\s+name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s+content=`,
      );
      expect(
        pattern.test(layoutSource),
        `Layout.astro must contain a <meta name="${name}" content=...> tag`,
      ).toBe(true);
    });
  }

  // --- Structural contracts ---

  it('derives siteUrl as a variable (not only inline)', () => {
    // The site URL should be stored in a variable so it can be reused consistently.
    // Accept patterns like: const siteUrl = '...' or let siteUrl = '...'
    const siteUrlDeclaration = /(?:const|let|var)\s+siteUrl\s*=/;
    expect(
      siteUrlDeclaration.test(layoutSource),
      'Layout.astro must declare a siteUrl variable for consistent URL construction',
    ).toBe(true);
  });

  it('siteUrl uses the www prefix', () => {
    // Extract the siteUrl value and verify it uses www
    const siteUrlMatch = layoutSource.match(
      /siteUrl\s*=\s*['"`]([^'"`]+)['"`]/,
    );
    expect(siteUrlMatch, 'siteUrl declaration must be found').not.toBeNull();
    expect(
      siteUrlMatch![1],
      'siteUrl must be set to the www-prefixed domain',
    ).toBe(CANONICAL_DOMAIN);
  });

  it('constructs a canonical URL variable', () => {
    // Should have canonical URL construction: canonical = canonicalURL || ...
    // or similar pattern
    const canonicalConstruction =
      /(?:const|let|var)\s+canonical\s*=\s*canonicalURL\s*\|\|/;
    expect(
      canonicalConstruction.test(layoutSource),
      'Layout.astro must construct a canonical variable from the canonicalURL prop with a fallback',
    ).toBe(true);
  });

  it('contains <link rel="canonical" ...> tag using the canonical variable', () => {
    const canonicalLink = /<link\s+rel=["']canonical["']\s+href=/;
    expect(
      canonicalLink.test(layoutSource),
      'Layout.astro must contain a <link rel="canonical" ...> tag',
    ).toBe(true);
  });

  it('resolves OG image handling for both relative and absolute URLs', () => {
    // The resolvedOgImage logic must handle relative vs absolute URLs.
    // Check that it tests for 'http' prefix (the starts-with check).
    const ogImageResolution =
      /resolvedOgImage[\s\S]*?startsWith\s*\(\s*['"`]http['"`]\s*\)/;
    expect(
      ogImageResolution.test(layoutSource),
      'Layout.astro must resolve OG images by checking if the URL starts with "http" (handles both relative and absolute)',
    ).toBe(true);
  });

  it('og:site_name is set to "The Hermetic Flight"', () => {
    const siteNamePattern =
      /property=["']og:site_name["']\s+content=["']The Hermetic Flight["']/;
    expect(
      siteNamePattern.test(layoutSource),
      'og:site_name must be "The Hermetic Flight"',
    ).toBe(true);
  });

  it('twitter:card is set to summary_large_image', () => {
    const cardPattern =
      /name=["']twitter:card["']\s+content=["']summary_large_image["']/;
    expect(
      cardPattern.test(layoutSource),
      'twitter:card must be "summary_large_image"',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F-03: Quiz → Share CTA journey — static analysis + slug contracts
// ---------------------------------------------------------------------------

describe('F-03: Quiz share CTA — static source contracts', () => {
  describe('quiz.astro share URL construction', () => {
    const quizSource = readSource('src/pages/quiz.astro');

    it('constructs share URLs using encodeURIComponent or share-utils helpers', () => {
      const hasEncode = /encodeURIComponent\s*\(/.test(quizSource);
      const hasShareUtils = /buildXShareUrl\s*\(/.test(quizSource) || /buildFacebookShareUrl\s*\(/.test(quizSource);
      expect(
        hasEncode || hasShareUtils,
        'quiz.astro must use encodeURIComponent or share-utils helpers when constructing share URLs',
      ).toBe(true);
    });

    it('share URL pattern includes /quiz/result/ path', () => {
      // The share URL must route to the archetype result page
      const resultPathPattern = /\/quiz\/result\//;
      expect(
        resultPathPattern.test(quizSource),
        'quiz.astro share URLs must include the /quiz/result/ path segment',
      ).toBe(true);
    });

    it('share URL uses the www-prefixed domain', () => {
      // The share URL must use the canonical www domain
      const shareUrlDomain =
        /shareUrl\s*=\s*[`'"]https:\/\/www\.thehermeticflight\.com\/quiz\/result\//;
      expect(
        shareUrlDomain.test(quizSource),
        'quiz.astro shareUrl must use https://www.thehermeticflight.com',
      ).toBe(true);
    });

    it('share text includes archetype title pattern', () => {
      // The share text should include the archetype's title
      // e.g., content.title in a template string
      const shareTitlePattern = /shareText[\s\S]*?content\.title/;
      expect(
        shareTitlePattern.test(quizSource),
        'quiz.astro share text must include the archetype title (content.title)',
      ).toBe(true);
    });

    it('constructs an X/Twitter share link via intent URL or buildXShareUrl', () => {
      const hasInline = /https:\/\/x\.com\/intent\/tweet\?text=/.test(quizSource);
      const hasHelper = /buildXShareUrl\s*\(/.test(quizSource);
      expect(
        hasInline || hasHelper,
        'quiz.astro must construct an X/Twitter share link (inline or via buildXShareUrl)',
      ).toBe(true);
    });

    it('constructs a Facebook share link via sharer URL or buildFacebookShareUrl', () => {
      const hasInline = /https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/.test(quizSource);
      const hasHelper = /buildFacebookShareUrl\s*\(/.test(quizSource);
      expect(
        hasInline || hasHelper,
        'quiz.astro must construct a Facebook share link (inline or via buildFacebookShareUrl)',
      ).toBe(true);
    });

    it('share section is rendered directly in quiz results (not gated behind email)', () => {
      // Share buttons are shown immediately after results reveal — no email gate.
      const shareSection = quizSource.match(
        /id=["']share-section["']/,
      );
      expect(
        shareSection,
        '#share-section element must exist in quiz.astro',
      ).not.toBeNull();
      // Must NOT be inside a hidden container
      expect(
        quizSource.includes('email-success'),
        '#email-success should not exist — share section is shown directly',
      ).toBe(false);
    });

    it('share section has staggered reveal animation', () => {
      // The share section uses CSS transition for reveal animation
      const hasTransition = /id=["']share-section["'][^>]*class=["'][^"']*transition/.test(quizSource);
      expect(
        hasTransition,
        '#share-section must have transition classes for reveal animation',
      ).toBe(true);
    });
  });

  describe('result/[archetype].astro share contracts', () => {
    const resultSource = readSource('src/pages/quiz/result/[archetype].astro');

    it('renders <ShareButtons> component with correct props', () => {
      expect(
        /<ShareButtons\s/.test(resultSource),
        'Result page must render <ShareButtons> component',
      ).toBe(true);
      expect(
        /shareUrl\s*=/.test(resultSource),
        'ShareButtons must receive shareUrl prop',
      ).toBe(true);
      expect(
        /shareText\s*=/.test(resultSource),
        'ShareButtons must receive shareText prop',
      ).toBe(true);
    });

    it('uses buildShareText from share-utils for share text', () => {
      expect(
        /buildShareText\s*\(/.test(resultSource),
        'Result page must use buildShareText() from share-utils',
      ).toBe(true);
    });

    it('share URLs use the www-prefixed canonical domain', () => {
      const shareUrlPattern =
        /https:\/\/www\.thehermeticflight\.com\/quiz\/result\//;
      expect(
        shareUrlPattern.test(resultSource),
        'Result page share URLs must use https://www.thehermeticflight.com/quiz/result/',
      ).toBe(true);
    });

    it('result page imports toUrlSlug from archetype-content', () => {
      const importPattern = /import\s*\{[^}]*toUrlSlug[^}]*\}\s*from/;
      expect(
        importPattern.test(resultSource),
        'Result page must import toUrlSlug from archetype-content',
      ).toBe(true);
    });

    it('share text includes archetype title and element', () => {
      // Check that the share text template references the archetype's title and element
      expect(
        resultSource.includes('archetype.title'),
        'Result page share text must reference archetype.title',
      ).toBe(true);
      expect(
        resultSource.includes('archetype.element'),
        'Result page share text must reference archetype.element',
      ).toBe(true);
    });
  });

  describe('archetype slug → share URL roundtrip', () => {
    const allSlugs: ArchetypeSlug[] = [
      'air_weaver',
      'embodied_intuitive',
      'ascending_seeker',
      'shadow_dancer',
      'flow_artist',
      'grounded_mystic',
    ];

    it('all 6 archetypes are defined', () => {
      expect(Object.keys(archetypes)).toHaveLength(6);
      for (const slug of allSlugs) {
        expect(
          archetypes[slug],
          `Archetype "${slug}" must be defined in archetypes map`,
        ).toBeDefined();
      }
    });

    for (const slug of allSlugs) {
      it(`toUrlSlug("${slug}") produces a valid URL segment (no underscores)`, () => {
        const urlSlug = toUrlSlug(slug);
        expect(urlSlug).not.toContain('_');
        expect(urlSlug).toMatch(/^[a-z][a-z-]+[a-z]$/);
      });

      it(`archetypeByUrlSlug roundtrips for "${slug}"`, () => {
        const urlSlug = toUrlSlug(slug);
        const content = archetypeByUrlSlug(urlSlug);
        expect(
          content,
          `archetypeByUrlSlug("${urlSlug}") must return content`,
        ).toBeDefined();
        expect(content!.slug).toBe(slug);
      });

      it(`share URL for "${slug}" is well-formed`, () => {
        const urlSlug = toUrlSlug(slug);
        const shareUrl = `${CANONICAL_DOMAIN}/quiz/result/${urlSlug}`;

        // Must be a valid URL
        const parsed = new URL(shareUrl);
        expect(parsed.hostname).toBe('www.thehermeticflight.com');
        expect(parsed.protocol).toBe('https:');
        expect(parsed.pathname).toBe(`/quiz/result/${urlSlug}`);

        // Must survive encodeURIComponent roundtrip
        const encoded = encodeURIComponent(shareUrl);
        expect(decodeURIComponent(encoded)).toBe(shareUrl);
      });

      it(`share text for "${slug}" encodes cleanly`, () => {
        const content = archetypes[slug];
        const shareText = `I'm ${content.title} \u2014 ${content.element} element. Discover your aerial tarot archetype:`;

        // Must not throw when encoded
        const encoded = encodeURIComponent(shareText);
        expect(decodeURIComponent(encoded)).toBe(shareText);

        // Must contain the archetype title
        expect(shareText).toContain(content.title);
      });
    }
  });
});
