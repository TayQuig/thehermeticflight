import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('vercel.json CSP header structure', () => {
  const vercelJsonPath = resolve(process.cwd(), 'vercel.json');

  it('vercel.json exists', () => { expect(existsSync(vercelJsonPath)).toBe(true); });

  it('has a headers array', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    expect(Array.isArray(config.headers)).toBe(true);
    expect(config.headers.length).toBeGreaterThan(0);
  });

  it('applies headers to all routes via /(.*)', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const sources = config.headers.map((h: { source: string }) => h.source);
    expect(sources).toContain('/(.*)');
  });

  it('has Content-Security-Policy-Report-Only header (not enforcing)', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap(
      (rule: { headers: { key: string; value: string }[] }) => rule.headers
    );
    const cspHeader = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    expect(cspHeader).toBeDefined();
    const enforcing = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(enforcing).toBeUndefined();
  });

  it('CSP script-src includes googletagmanager.com', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers);
    const csp = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    expect(csp.value).toContain('https://www.googletagmanager.com');
  });

  it('CSP script-src includes connect.facebook.net', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers);
    const csp = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    expect(csp.value).toContain('https://connect.facebook.net');
  });

  it('CSP font-src includes fonts.gstatic.com', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers);
    const csp = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    expect(csp.value).toContain('https://fonts.gstatic.com');
  });

  it('CSP connect-src includes app.loops.so', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers);
    const csp = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    expect(csp.value).toContain('https://app.loops.so');
  });

  it('CSP includes object-src none', () => {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers);
    const csp = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    expect(csp.value).toContain("object-src 'none'");
  });
});

describe('Layout.astro external sources are all in CSP', () => {
  const layoutPath = resolve(process.cwd(), 'src/layouts/Layout.astro');
  const vercelJsonPath = resolve(process.cwd(), 'vercel.json');

  function getCspValue(): string {
    const config = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
    const allHeaders = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers);
    const csp = allHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    return csp?.value ?? '';
  }

  it('Layout.astro googletagmanager.com script is in CSP script-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('googletagmanager.com');
    expect(getCspValue()).toContain('https://www.googletagmanager.com');
  });

  it('Layout.astro fonts.googleapis.com is in CSP style-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('fonts.googleapis.com');
    expect(getCspValue()).toContain('https://fonts.googleapis.com');
  });

  it('Layout.astro fonts.gstatic.com preconnect is in CSP font-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('fonts.gstatic.com');
    expect(getCspValue()).toContain('https://fonts.gstatic.com');
  });

  it('Layout.astro connect.facebook.net script is in CSP script-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('connect.facebook.net');
    expect(getCspValue()).toContain('https://connect.facebook.net');
  });

  it('Layout.astro facebook.com noscript img is in CSP img-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('www.facebook.com');
    expect(getCspValue()).toContain('https://www.facebook.com');
  });

  it('Layout.astro GTM noscript iframe is in CSP frame-src', () => {
    const layout = readFileSync(layoutPath, 'utf-8');
    expect(layout).toContain('googletagmanager.com/ns.html');
    expect(getCspValue()).toContain('frame-src');
    expect(getCspValue()).toContain('https://www.googletagmanager.com');
  });
});

// ---------------------------------------------------------------------------
// Manual verification note (not automated — requires live Vercel deployment)
// ---------------------------------------------------------------------------
// To verify the CSP header is served on Vercel:
//   curl -sI https://www.thehermeticflight.com/ | grep -i content-security
// Expected: Content-Security-Policy-Report-Only: default-src 'self'; ...
//
// To verify no violations, open browser DevTools → Console on the deployed site.
// CSP violations appear as "Refused to load..." messages in the console.
// Monitor for 2 weeks before switching to enforcing mode.
