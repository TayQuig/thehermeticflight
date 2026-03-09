import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('.github/workflows/preview-e2e.yaml exists and is valid', () => {
  const workflowPath = resolve(process.cwd(), '.github/workflows/preview-e2e.yaml');

  it('workflow file exists', () => { expect(existsSync(workflowPath)).toBe(true); });
  it('workflow triggers on push to non-main branches', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('branches-ignore');
    expect(content).toContain('main');
  });
  it('workflow references VERCEL_TOKEN secret', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('VERCEL_TOKEN');
  });
  it('workflow references VERCEL_ORG_ID secret', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('VERCEL_ORG_ID');
  });
  it('workflow references VERCEL_PROJECT_ID secret', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('VERCEL_PROJECT_ID');
  });
  it('workflow runs playwright test with TEST_URL', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('playwright test');
    expect(content).toContain('TEST_URL');
  });
  it('workflow uploads playwright report as artifact', () => {
    const content = readFileSync(workflowPath, 'utf-8');
    expect(content).toContain('upload-artifact');
    expect(content).toContain('playwright-report');
  });
});
