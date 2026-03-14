# Sprint 3+4 Parallel Execution Plan

**Goal:** Execute Sprints 3 (Operational Visibility) and 4 (Code Quality) in
parallel. Zero cross-sprint dependencies — no shared files, no sequential
ordering between sprints.

**Architecture:** 4 parallel tracks dispatched as worktree-isolated subagents.
Track A has internal sequential dependencies (tasks build on each other).
Tracks B, C, D are internally independent or self-contained.

**Tech Stack:** Astro 5, TypeScript, Vitest, Tailwind CSS, Vercel serverless,
GA4 Data API, PageSpeed Insights API

---

## Dependency Analysis

| Sprint 3 Items | Sprint 4 Items | Shared Files? |
|----------------|----------------|---------------|
| Eval harness (scripts/, src/lib/eval/) | Quiz refactoring (src/lib/, src/pages/quiz.astro) | None |
| Skill authoring (~/.claude/skills/) | Skill consistency (~/.claude/skills/) | **Potential overlap** on skill files — serialize D after C |
| Email drip testing (BLOCKED) | — | N/A |

**Verdict:** Tracks A (S4 quiz refactor) and B (S3 eval harness) are fully
parallel. Track C (S3 skill authoring) and D (S4 skill consistency) touch the
same skill directory — run D after C completes.

---

## Track Layout

| Track | Sprint | Items | Type | Agent | Notes |
|-------|--------|-------|------|-------|-------|
| A | 4 | Quiz code quality refactoring (7 tasks) | Project code | [SUBAGENT: sonnet] | Sequential internal deps |
| B | 3 | Eval harness foundation (4 tasks) | Project code | [SUBAGENT: sonnet] | Independent |
| C | 3+4 | Skill creation × 8 (recreate 5 project + 3 new) | Skill files | [SUBAGENT: sonnet] | Independent, outside repo |
| — | 3 | Email drip testing | BLOCKED | — | Needs email-sequences.json |

**NOTE on Track C/D merge:** The 5 project skills (audit-site, publish-post,
social-blast, weekly-report, launch-sequence) are missing from disk. They were
created in a previous session but not on this machine. Track D (12 consistency
fixes) is merged into Track C — the skills will be recreated from the eval
report specs at `operations/eval-skills-2026-03-08/` with all 12 findings
addressed from the start.

---

## Track A: Quiz Code Quality Refactoring [Sprint 4]

**Reference plan:** `docs/plans/2026-03-09-quiz-refactoring.md` (complete, 7
tasks with inline test code, FTF protocol)

**Addresses:** 10 deferred findings from hardening-2026-03-08 (ARCH-04,
ARCH-08, ARCH-09, TCF-03, TCF-06, TCF-07, TCF-08, TCF-09, TCF-10)

### Build Order (sequential — each task depends on previous)

1. **Task 1:** DOM helpers module (`src/lib/dom-helpers.ts`) — ARCH-08
2. **Task 2:** Share utils module (`src/lib/share-utils.ts`) — ARCH-09
3. **Task 3:** ShareButtons component (`src/components/ShareButtons.astro`) — ARCH-09
4. **Task 4:** GA4 contract tests — TCF-03
5. **Task 5:** Edge case + E2E hardening — TCF-06/07/08/09/10
6. **Task 6:** quiz.astro script extraction — ARCH-04 (highest risk)
7. **Task 7:** Quality gates — full suite + build verification

### Execution Strategy

**Batch test authoring:** One agent writes all test files from the plan doc
(tests are already fully specified inline). Then sequential implementer
agents make each task's tests pass.

**FTF protocol per task:**
1. Test author copies test code from plan → test file
2. `sha256sum tests/<file>.test.ts > tests/.<file>.test.ts.sha256`
3. Implementer writes code to pass tests
4. `sha256sum -c tests/.<file>.test.ts.sha256` (must match)
5. `npx vitest run` (all tests pass, no regressions)

### Entry Point
- `npx vitest run` — 474/474 baseline
- `npx astro build` — clean

### Pass/Fail Criteria
- All existing tests still pass (no regressions)
- All new tests pass (dom-helpers, share-utils, ga4-contract)
- quiz.astro script block reduced from >250 lines to imports
- `npx astro build` clean
- No new `any` types or `as` casts introduced

### Known Risks
- **Task 6 (quiz.astro refactor)** is highest risk — modifying the main quiz
  page. Run full test suite before and after. If E2E tests fail, the client-side
  behavior has regressed.
- Dynamic imports in tests (for document stub) may cause vitest module caching
  issues. Use `vi.resetModules()` between tests if needed.

### Failure Triage
- If Task 6 breaks E2E tests: revert quiz.astro changes, run tests to confirm
  revert is clean, then debug the extraction incrementally.
- If test file hash changes during implementation: FTF violation — reject and
  re-run from the unmodified test.

---

## Track B: Eval Harness Foundation [Sprint 3]

**Purpose:** Build the metric query infrastructure that Sprint 6 autoresearch
loops will use. Delivers typed GA4 and PageSpeed query clients with JSON-file
storage for metric snapshots.

**Scope note:** Loops.so webhook endpoint deferred — needs production storage
decision (Vercel serverless is stateless). The webhook can be added in Sprint 6
when autoresearch loops are built.

### Task B1: Eval Types and Storage Layer

**Files created:**
- `src/lib/eval/types.ts`
- `src/lib/eval/storage.ts`
- `tests/eval-storage.test.ts`

#### Types (`src/lib/eval/types.ts`)

```typescript
/** A metric query configuration */
export interface MetricQuery {
  /** Unique identifier for this metric (e.g., 'quiz_start_rate') */
  id: string;
  /** Human-readable description */
  label: string;
  /** Source system: 'ga4' | 'pagespeed' */
  source: 'ga4' | 'pagespeed';
}

/** A single metric measurement */
export interface MetricSnapshot {
  metricId: string;
  timestamp: string; // ISO 8601
  value: number;
  metadata?: Record<string, string | number>;
}

/** GA4 query parameters */
export interface GA4QueryConfig {
  propertyId: string;
  metrics: string[];      // e.g., ['eventCount']
  dimensions?: string[];  // e.g., ['eventName']
  dateRange: { startDate: string; endDate: string };
  dimensionFilter?: {
    fieldName: string;
    stringFilter: { matchType: 'EXACT'; value: string };
  };
}

/** GA4 API response row */
export interface GA4Row {
  dimensionValues?: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

/** PageSpeed CWV result */
export interface CWVResult {
  url: string;
  lcp: number;       // Largest Contentful Paint (ms)
  cls: number;       // Cumulative Layout Shift (score)
  inp: number | null; // Interaction to Next Paint (ms), null if no data
  performance: number; // Lighthouse performance score 0-100
  fetchedAt: string;   // ISO 8601
}
```

#### Storage (`src/lib/eval/storage.ts`)

JSON-file backed storage at `data/eval/snapshots.json`. No new dependencies.

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MetricSnapshot } from './types';

const DEFAULT_PATH = 'data/eval/snapshots.json';

export function readSnapshots(filePath = DEFAULT_PATH): MetricSnapshot[] { ... }
export function writeSnapshot(snapshot: MetricSnapshot, filePath = DEFAULT_PATH): void { ... }
export function getLatestSnapshot(metricId: string, filePath = DEFAULT_PATH): MetricSnapshot | null { ... }
```

#### Tests (`tests/eval-storage.test.ts`)

```typescript
/**
 * Eval Storage — Unit Tests
 *
 * Frozen-test-file protocol: TEST CONTRACT.
 * Module under test: src/lib/eval/storage.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readSnapshots, writeSnapshot, getLatestSnapshot } from '../src/lib/eval/storage';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = 'data/eval-test';
const TEST_FILE = join(TEST_DIR, 'snapshots.json');

describe('eval storage', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('returns empty array when file does not exist', () => {
    const result = readSnapshots(TEST_FILE);
    expect(result).toEqual([]);
  });

  it('writes and reads a snapshot', () => {
    const snap = { metricId: 'test', timestamp: '2026-03-14T00:00:00Z', value: 42 };
    writeSnapshot(snap, TEST_FILE);
    const result = readSnapshots(TEST_FILE);
    expect(result).toHaveLength(1);
    expect(result[0].metricId).toBe('test');
    expect(result[0].value).toBe(42);
  });

  it('appends without losing existing data', () => {
    writeSnapshot({ metricId: 'a', timestamp: '2026-03-14T00:00:00Z', value: 1 }, TEST_FILE);
    writeSnapshot({ metricId: 'b', timestamp: '2026-03-14T00:01:00Z', value: 2 }, TEST_FILE);
    const result = readSnapshots(TEST_FILE);
    expect(result).toHaveLength(2);
  });

  it('getLatestSnapshot returns the most recent for a given metricId', () => {
    writeSnapshot({ metricId: 'x', timestamp: '2026-03-14T00:00:00Z', value: 10 }, TEST_FILE);
    writeSnapshot({ metricId: 'x', timestamp: '2026-03-14T01:00:00Z', value: 20 }, TEST_FILE);
    writeSnapshot({ metricId: 'y', timestamp: '2026-03-14T02:00:00Z', value: 99 }, TEST_FILE);
    const latest = getLatestSnapshot('x', TEST_FILE);
    expect(latest).not.toBeNull();
    expect(latest!.value).toBe(20);
  });

  it('getLatestSnapshot returns null for unknown metricId', () => {
    writeSnapshot({ metricId: 'x', timestamp: '2026-03-14T00:00:00Z', value: 1 }, TEST_FILE);
    expect(getLatestSnapshot('z', TEST_FILE)).toBeNull();
  });
});
```

### Task B2: GA4 Query Client

**Files created:**
- `src/lib/eval/ga4-client.ts`
- `tests/eval-ga4-client.test.ts`

**Reference:** `operations/ga4-api-reference.md`, `scripts/ga4-smoke-test.mjs`

The GA4 client wraps the GA4 Data API v1beta `runReport` endpoint. Auth flow
follows the pattern in `scripts/ga4-smoke-test.mjs` (JWT → OAuth2 token
exchange → Bearer header). The fetch function is injectable for testing.

```typescript
// src/lib/eval/ga4-client.ts
import type { GA4QueryConfig, GA4Row } from './types';

export interface GA4ClientConfig {
  serviceAccountEmail: string;
  privateKey: string;   // PEM format
  propertyId: string;
  fetchFn?: typeof fetch; // Injectable for tests
}

export async function queryGA4(
  config: GA4ClientConfig,
  query: GA4QueryConfig,
): Promise<GA4Row[]> { ... }
```

#### Tests (`tests/eval-ga4-client.test.ts`)

```typescript
/**
 * GA4 Query Client — Unit Tests
 *
 * Frozen-test-file protocol: TEST CONTRACT.
 * Module under test: src/lib/eval/ga4-client.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { queryGA4 } from '../src/lib/eval/ga4-client';
import type { GA4ClientConfig, GA4QueryConfig } from '../src/lib/eval/types';

const mockConfig: GA4ClientConfig = {
  serviceAccountEmail: 'test@test.iam.gserviceaccount.com',
  privateKey: 'MOCK_KEY',
  propertyId: '514560510',
  fetchFn: vi.fn(),
};

const mockQuery: GA4QueryConfig = {
  propertyId: '514560510',
  metrics: ['eventCount'],
  dimensions: ['eventName'],
  dateRange: { startDate: '2026-03-01', endDate: '2026-03-14' },
};

describe('GA4 client', () => {
  it('calls the correct API endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
    });
    await queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery);
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('analyticsdata.googleapis.com');
    expect(url).toContain('514560510');
  });

  it('parses rows from a successful response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        rows: [
          { dimensionValues: [{ value: 'quiz_started' }], metricValues: [{ value: '150' }] },
          { dimensionValues: [{ value: 'share' }], metricValues: [{ value: '42' }] },
        ],
      }),
    });
    const rows = await queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery);
    expect(rows).toHaveLength(2);
    expect(rows[0].metricValues[0].value).toBe('150');
  });

  it('returns empty array when response has no rows', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const rows = await queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery);
    expect(rows).toEqual([]);
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Access denied'),
    });
    await expect(queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery))
      .rejects.toThrow(/403/);
  });

  it('throws on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(queryGA4({ ...mockConfig, fetchFn: mockFetch }, mockQuery))
      .rejects.toThrow('Network error');
  });
});
```

### Task B3: PageSpeed Query Client

**Files created:**
- `src/lib/eval/pagespeed.ts`
- `tests/eval-pagespeed.test.ts`

**Reference:** `operations/pagespeed-api-reference.md`

```typescript
// src/lib/eval/pagespeed.ts
import type { CWVResult } from './types';

export interface PageSpeedConfig {
  apiKey?: string;   // Optional — unauthenticated requests have lower quota
  fetchFn?: typeof fetch;
}

export async function queryCWV(
  url: string,
  config?: PageSpeedConfig,
): Promise<CWVResult> { ... }
```

#### Tests (`tests/eval-pagespeed.test.ts`)

```typescript
/**
 * PageSpeed Query Client — Unit Tests
 *
 * Frozen-test-file protocol: TEST CONTRACT.
 * Module under test: src/lib/eval/pagespeed.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { queryCWV } from '../src/lib/eval/pagespeed';

// Mock PageSpeed API response (matches actual API shape from reference doc)
const mockPsiResponse = {
  lighthouseResult: {
    categories: {
      performance: { score: 0.92 },
    },
    audits: {
      'largest-contentful-paint': { numericValue: 1200 },
      'cumulative-layout-shift': { numericValue: 0.05 },
      'interaction-to-next-paint': { numericValue: 180 },
    },
  },
};

describe('PageSpeed client', () => {
  it('calls the correct API URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPsiResponse),
    });
    await queryCWV('https://www.thehermeticflight.com/', { fetchFn: mockFetch });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('pagespeedonline.googleapis.com');
    expect(url).toContain(encodeURIComponent('https://www.thehermeticflight.com/'));
  });

  it('extracts LCP, CLS, INP, and performance score', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPsiResponse),
    });
    const result = await queryCWV('https://example.com', { fetchFn: mockFetch });
    expect(result.lcp).toBe(1200);
    expect(result.cls).toBe(0.05);
    expect(result.inp).toBe(180);
    expect(result.performance).toBe(92);
  });

  it('handles missing INP (returns null)', async () => {
    const noInp = structuredClone(mockPsiResponse);
    delete (noInp.lighthouseResult.audits as Record<string, unknown>)['interaction-to-next-paint'];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(noInp),
    });
    const result = await queryCWV('https://example.com', { fetchFn: mockFetch });
    expect(result.inp).toBeNull();
  });

  it('throws on non-200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('Rate limited'),
    });
    await expect(queryCWV('https://example.com', { fetchFn: mockFetch }))
      .rejects.toThrow(/429/);
  });

  it('includes API key in URL when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPsiResponse),
    });
    await queryCWV('https://example.com', { apiKey: 'test-key', fetchFn: mockFetch });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('key=test-key');
  });
});
```

### Task B4: CLI Query Scripts

**Files created:**
- `scripts/eval/run-ga4-query.ts` — CLI wrapper for GA4 client
- `scripts/eval/run-pagespeed.ts` — CLI wrapper for PageSpeed client

These are runnable via `npx tsx scripts/eval/run-ga4-query.ts` and read
credentials from environment variables.

**Verification:** `npx tsx scripts/eval/run-pagespeed.ts --url https://www.thehermeticflight.com/`
should exit 0 and print CWV results (PageSpeed API works unauthenticated).
`npx tsx scripts/eval/run-ga4-query.ts` should exit with a clear "credentials
not configured" message if env vars are missing.

### .gitignore Addition

Add `data/eval/` to `.gitignore` — metric snapshots are runtime artifacts,
not source code.

### Entry Point
- `npx vitest run` — baseline (all existing tests pass)
- All eval modules in `src/lib/eval/` importable

### Pass/Fail Criteria
- All new tests pass (eval-storage, eval-ga4-client, eval-pagespeed)
- All existing tests still pass (no regressions)
- `npx astro build` clean (eval modules don't break SSG)
- CLI scripts exit cleanly (PageSpeed produces output; GA4 shows credential
  error if unconfigured)
- `data/eval/` is in `.gitignore`

### Known Risks
- GA4 auth requires JWT signing — needs `crypto.createSign()` which is
  available in Node.js but not in browser. Ensure eval modules are never
  imported client-side.
- PageSpeed API unauthenticated quota is 25 req/day — tests must use mocked
  fetch.
- GA4 test uses `MOCK_KEY` for `privateKey`. The implementation must skip
  JWT signing when `fetchFn` is provided (mock intercepts before real endpoint),
  so the test exercises the request/response contract, not the auth flow.

### Failure Triage
- If GA4 auth JWT generation fails: compare with `scripts/ga4-smoke-test.mjs`
  implementation, which is known to work.
- If PageSpeed response shape changes: verify against `operations/pagespeed-api-reference.md`.

---

## Track C: Skill Creation × 8 [Sprint 3+4 merged]

**Files created:** All in `~/.claude/skills/` (outside project repo).

**Context:** The 5 project skills (audit-site, publish-post, social-blast,
weekly-report, launch-sequence) were created in a previous session but are
missing from disk on this machine. They will be recreated from the eval report
specs at `operations/eval-skills-2026-03-08/synthesis.md` with all 12 deferred
findings (F-14 through F-26) addressed from the start. Plus 3 new skills.

### Entry Point
Read existing skill files as format reference (e.g., `~/.claude/skills/evaluation-protocol/SKILL.md`).
Read `operations/eval-skills-2026-03-08/synthesis.md` for the 5 project skill specs and finding details.

### Skills to Create

**Recreated (5):**
1. `~/.claude/skills/audit-site/SKILL.md` — SEO + WCAG auditing (incorporates C3 WCAG requirement + F-17, F-20)
2. `~/.claude/skills/publish-post/SKILL.md` — Blog publishing (F-19)
3. `~/.claude/skills/social-blast/SKILL.md` — Social media amplification (F-18, F-24, F-26)
4. `~/.claude/skills/weekly-report/SKILL.md` — Analytics reporting
5. `~/.claude/skills/launch-sequence/SKILL.md` — Kickstarter launch orchestration (F-14, F-25)

**New (3):**
6. `~/.claude/skills/site-monitor/SKILL.md` — HTTP health check, DNS, SSL, Vercel status
7. `~/.claude/skills/cwv-monitor/SKILL.md` — PageSpeed API CWV tracking per page
8. `~/.claude/skills/wcag-audit/SKILL.md` — Lighthouse accessibility audit (extends audit-site)

### Cross-cutting requirements from deferred findings

All 8 skills must include:
- **F-16:** "On Failure" section with degradation procedure
- **F-21:** Standardized section ordering (Name, When to Use, Procedure, Output, On Failure)
- **F-22:** No emojis in Slack templates
- **F-23:** Output paths standardized to `operations/<skill-name>/`

### Pass/Fail Criteria
- All 8 SKILL.md files exist at their specified paths
- Each has required sections: Name, When to Use, Procedure, Output, On Failure
- API URLs verified against reference docs (GA4, PageSpeed, Loops.so)
- `grep -rL 'On Failure' ~/.claude/skills/{audit-site,publish-post,social-blast,weekly-report,launch-sequence,site-monitor,cwv-monitor,wcag-audit}/SKILL.md` returns empty (all have On Failure)
- No emojis in Slack message templates
- All output paths use `operations/<skill-name>/` pattern

### Known Risks
- Skill files are outside the git repo and not version-controlled. No automated
  backup — manual verification required.
- The eval report synthesis may not have complete specs for all 5 original skills.
  If a skill spec is insufficient, create a minimal viable version and note it for
  future enhancement.

### Failure Triage
- If eval synthesis report lacks detail for a skill: read the individual evaluator
  reports at `operations/eval-skills-2026-03-08/eval-*.md` for supplementary detail.
- If a skill format is wrong: compare against `~/.claude/skills/evaluation-protocol/SKILL.md`
  as canonical reference.

---

## Blocked Items

### Email Drip Sequence Testing [Sprint 3]

**Status:** BLOCKED — `src/data/email-sequences.json` does not exist on disk.
TASKBOARD backlog says "UNBLOCKED — operator has email content" but the file
hasn't been created yet. When the operator provides the file, this item
becomes executable.

**When unblocked:** Verify each archetype triggers correct Loops.so sequence,
test email delivery with correct content/timing, test edge cases (resubmission,
multiple archetypes). The 6 Loops.so event names (`quiz_completed` with each
archetype value) are already wired in `src/pages/api/quiz-submit.ts`.

### Subscriber Funnel Analytics [Sprint 3]

**Status:** DEFERRED to Sprint 6 — shares infrastructure with eval harness
webhook (which requires production storage decision). Once eval harness
Track B is complete, funnel analytics becomes a thin wrapper.

---

## Execution Order

```
Parallel dispatch (worktree-isolated):
  ├── Track A (sonnet): Quiz refactoring — 7 sequential tasks
  ├── Track B (sonnet): Eval harness — 4 tasks
  └── Track C (sonnet): Skill creation — 8 skills

After all tracks complete:
  └── Integration gate
```

### Worktree Merge Protocol

Tracks A and B produce project code in worktrees. Merge order:
1. **Merge Track B first** — creates new files only (`src/lib/eval/`,
   `scripts/eval/`, `tests/eval-*.test.ts`), zero overlap risk.
2. **Merge Track A second** — modifies existing files (`src/pages/quiz.astro`,
   `src/lib/`, `src/components/`), higher risk.
3. Track C writes to `~/.claude/skills/` (outside repo) — no merge needed.

### Integration Gate

**Entry:** `npx vitest run && npx astro build`

**Pass criteria:**
- All tests pass (original + new from Tracks A and B)
- Build produces no errors
- No TypeScript errors
- Track C: all 8 SKILL.md files exist at specified paths

**Fail triage:** Identify which track introduced the regression (check
worktree branch commits). Fix in isolation, re-merge, re-verify.
