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
