import { describe, it, expect } from 'vitest';

/**
 * OG meta tag contract: Layout.astro must render Open Graph and Twitter Card
 * meta tags in the <head>. We verify by checking the built HTML output.
 *
 * These tests validate the data model only — actual HTML rendering is checked
 * by the build verification in Step 4.
 */

// The OG tag props interface — mirrors what Layout.astro should accept
interface OGProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: string;
  canonicalURL?: string;
}

function buildOGTags(props: OGProps) {
  const siteUrl = 'https://www.thehermeticflight.com';
  const ogImage = props.ogImage || '/images/og/default.png';
  const ogType = props.ogType || 'website';
  const url = props.canonicalURL || siteUrl;

  return {
    'og:title': props.title,
    'og:description': props.description,
    'og:image': ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`,
    'og:url': url,
    'og:type': ogType,
    'og:site_name': 'The Hermetic Flight',
    'twitter:card': 'summary_large_image',
    'twitter:title': props.title,
    'twitter:description': props.description,
    'twitter:image': ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`,
  };
}

describe('OG meta tag generation', () => {
  it('produces all required OG tags with defaults', () => {
    const tags = buildOGTags({
      title: 'Test Page',
      description: 'A test page description',
    });

    expect(tags['og:title']).toBe('Test Page');
    expect(tags['og:description']).toBe('A test page description');
    expect(tags['og:image']).toBe('https://www.thehermeticflight.com/images/og/default.png');
    expect(tags['og:type']).toBe('website');
    expect(tags['og:site_name']).toBe('The Hermetic Flight');
    expect(tags['twitter:card']).toBe('summary_large_image');
  });

  it('uses custom ogImage when provided', () => {
    const tags = buildOGTags({
      title: 'Test',
      description: 'Test',
      ogImage: '/images/og/air-weaver.png',
    });

    expect(tags['og:image']).toBe('https://www.thehermeticflight.com/images/og/air-weaver.png');
    expect(tags['twitter:image']).toBe('https://www.thehermeticflight.com/images/og/air-weaver.png');
  });

  it('uses custom ogType when provided', () => {
    const tags = buildOGTags({
      title: 'Blog Post',
      description: 'A post',
      ogType: 'article',
    });

    expect(tags['og:type']).toBe('article');
  });

  it('passes through absolute image URLs unchanged', () => {
    const tags = buildOGTags({
      title: 'Test',
      description: 'Test',
      ogImage: 'https://cdn.example.com/image.png',
    });

    expect(tags['og:image']).toBe('https://cdn.example.com/image.png');
  });
});
