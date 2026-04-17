/**
 * Cache manager for persisting usage data
 * Ensures historical data is preserved when Claude Code prunes old logs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UsageEntry, CachedData } from '../types';

const CACHE_VERSION = 1;
const CACHE_DIR = '.claude-code-usage';
const CACHE_FILE = 'cache.json';

/**
 * Get the cache directory path
 */
function getCacheDir(): string {
  return path.join(os.homedir(), CACHE_DIR);
}

/**
 * Get the cache file path
 */
export function getCachePath(): string {
  return path.join(getCacheDir(), CACHE_FILE);
}

/**
 * Ensure the cache directory exists
 */
function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load cached data from disk
 */
export function loadCache(): CachedData {
  const cachePath = getCachePath();

  if (!fs.existsSync(cachePath)) {
    return {
      version: CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      entries: [],
    };
  }

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(content) as CachedData;

    // Handle version migrations if needed in the future
    if (data.version !== CACHE_VERSION) {
      // For now, just update the version
      data.version = CACHE_VERSION;
    }

    return data;
  } catch (error) {
    console.error('Error loading cache:', error);
    return {
      version: CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      entries: [],
    };
  }
}

/**
 * Save cached data to disk
 */
export function saveCache(data: CachedData): void {
  ensureCacheDir();
  const cachePath = getCachePath();

  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

/**
 * Create a unique key for deduplication
 */
function getEntryKey(entry: UsageEntry): string {
  return `${entry.timestamp}:${entry.sessionId}:${entry.model}:${entry.inputTokens}:${entry.outputTokens}`;
}

/**
 * Merge cached entries with live entries, removing duplicates
 * Live entries take precedence over cached entries
 */
export function mergeEntries(
  cached: UsageEntry[],
  live: UsageEntry[]
): UsageEntry[] {
  const seenKeys = new Set<string>();
  const merged: UsageEntry[] = [];

  // Add live entries first (they take precedence)
  for (const entry of live) {
    const key = getEntryKey(entry);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(entry);
    }
  }

  // Add cached entries that aren't duplicates
  for (const entry of cached) {
    const key = getEntryKey(entry);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(entry);
    }
  }

  // Sort by timestamp
  merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return merged;
}
