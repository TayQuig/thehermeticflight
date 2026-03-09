import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('playwright.config.ts exists and is valid', () => {
  const configPath = resolve(process.cwd(), 'playwright.config.ts');
  it('playwright.config.ts exists at project root', () => { expect(existsSync(configPath)).toBe(true); });
  it('config references webServer with npm run preview', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain("command: 'npm run preview'");
  });
  it('config sets baseURL to localhost:4321', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('localhost:4321');
  });
  it('config uses forbidOnly on CI', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('forbidOnly');
    expect(content).toContain('process.env.CI');
  });
});

describe('package.json has e2e scripts', () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
  it('has e2e script', () => { expect(pkg.scripts.e2e).toBeDefined(); });
  it('has e2e:ui script', () => { expect(pkg.scripts['e2e:ui']).toBeDefined(); });
  it('has e2e:headed script', () => { expect(pkg.scripts['e2e:headed']).toBeDefined(); });
  it('devDependencies has @playwright/test not playwright', () => {
    expect(pkg.devDependencies['@playwright/test']).toBeDefined();
    expect(pkg.devDependencies['playwright']).toBeUndefined();
  });
});
