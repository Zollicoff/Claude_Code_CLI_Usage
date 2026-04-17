import * as fs from 'fs';
import type { UsageEntry } from '../types';
import { loadCache, saveCache, mergeEntries, isUnchanged } from '../cache';
import { claudeProjectsPath, findJsonlFiles } from './files';
import { parseJsonlFile } from './jsonl';

export { parseJsonlFile } from './jsonl';
export { claudeProjectsPath, findJsonlFiles } from './files';

function safeMtime(p: string): number {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

export function getLiveUsageEntries(): UsageEntry[] {
  const files = findJsonlFiles(claudeProjectsPath());
  files.sort((a, b) => safeMtime(a.path) - safeMtime(b.path));

  const seen = new Set<string>();
  const entries: UsageEntry[] = [];
  for (const f of files) {
    entries.push(...parseJsonlFile(f.path, f.projectFolder, seen));
  }
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

export function getAllUsageEntries(): UsageEntry[] {
  const cached = loadCache();
  const live = getLiveUsageEntries();
  const merged = mergeEntries(cached.entries, live);
  if (!isUnchanged(cached, merged)) {
    saveCache({
      version: cached.version,
      lastUpdated: new Date().toISOString(),
      entries: merged
    });
  }
  return merged;
}
