import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('env.d.ts declarations', () => {
  const envDts = readFileSync(resolve(process.cwd(), 'src/env.d.ts'), 'utf-8');

  it('declares LOOPS_API_KEY', () => { expect(envDts).toContain('LOOPS_API_KEY'); });
  it('declares TALLY_API_KEY', () => { expect(envDts).toContain('TALLY_API_KEY'); });
  it('declares GA4_SERVICE_ACCOUNT_KEY', () => { expect(envDts).toContain('GA4_SERVICE_ACCOUNT_KEY'); });
  it('declares GA4_PROPERTY_ID', () => { expect(envDts).toContain('GA4_PROPERTY_ID'); });
  it('declares SEOBOT_API_SECRET', () => { expect(envDts).toContain('SEOBOT_API_SECRET'); });
});
