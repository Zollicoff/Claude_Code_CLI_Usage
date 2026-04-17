import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { UsageEntry, CachedData } from './types';

const CACHE_VERSION = 1;
const CACHE_DIR = '.claude-code-usage';
const CACHE_FILE = 'cache.json';

function cacheDir(): string {
  return path.join(os.homedir(), CACHE_DIR);
}

export function cachePath(): string {
  return path.join(cacheDir(), CACHE_FILE);
}

export function loadCache(): CachedData {
  const p = cachePath();
  if (!fs.existsSync(p)) {
    return { version: CACHE_VERSION, lastUpdated: new Date().toISOString(), entries: [] };
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as CachedData;
    if (data.version !== CACHE_VERSION) {
      data.version = CACHE_VERSION;
    }
    return data;
  } catch (err) {
    console.error('Cache load failed:', err);
    return { version: CACHE_VERSION, lastUpdated: new Date().toISOString(), entries: [] };
  }
}

export function saveCache(data: CachedData): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(cachePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Cache save failed:', err);
  }
}

function entryKey(e: UsageEntry): string {
  return `${e.timestamp}:${e.sessionId}:${e.model}:${e.inputTokens}:${e.outputTokens}`;
}

export function mergeEntries(cached: UsageEntry[], live: UsageEntry[]): UsageEntry[] {
  const seen = new Set<string>();
  const out: UsageEntry[] = [];
  for (const e of live) {
    const k = entryKey(e);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  for (const e of cached) {
    const k = entryKey(e);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return out;
}

/** True when `next` has the same length and same last-timestamp as `current.entries`. */
export function isUnchanged(current: CachedData, next: UsageEntry[]): boolean {
  if (current.entries.length !== next.length) {
    return false;
  }
  if (next.length === 0) {
    return true;
  }
  return current.entries[next.length - 1].timestamp === next[next.length - 1].timestamp;
}
