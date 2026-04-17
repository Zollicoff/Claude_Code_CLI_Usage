import type { TimeRange, UsageEntry } from '../types';

export function filterByTimeRange(entries: UsageEntry[], range: TimeRange): UsageEntry[] {
  if (range === 'all') {
    return entries;
  }
  const days = range === '7d' ? 7 : 30;
  const cutoff = Date.now() - days * 86_400_000;
  return entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

export function projectNameFromPath(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}
