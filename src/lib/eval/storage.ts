import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MetricSnapshot } from './types';

const DEFAULT_PATH = 'data/eval/snapshots.json';

/**
 * Read all snapshots from the JSON store.
 * Returns an empty array if the file does not exist.
 */
export function readSnapshots(filePath = DEFAULT_PATH): MetricSnapshot[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as MetricSnapshot[];
}

/**
 * Append a snapshot to the JSON store.
 * Creates the file (and parent directories) if they do not exist.
 */
export function writeSnapshot(snapshot: MetricSnapshot, filePath = DEFAULT_PATH): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const existing = readSnapshots(filePath);
  existing.push(snapshot);
  writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
}

/**
 * Return the most recently written snapshot for a given metricId,
 * or null if no matching snapshot exists.
 */
export function getLatestSnapshot(metricId: string, filePath = DEFAULT_PATH): MetricSnapshot | null {
  const all = readSnapshots(filePath);
  const matching = all.filter(s => s.metricId === metricId);
  if (matching.length === 0) {
    return null;
  }
  // Sort descending by timestamp and return the first
  matching.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return matching[0];
}
