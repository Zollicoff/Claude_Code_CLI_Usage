import type { SessionUsage, UsageEntry } from '../types';
import { projectNameFromPath } from './filters';

interface SessionGroup { projectPath: string; items: UsageEntry[]; }

export function getSessionStats(entries: UsageEntry[]): SessionUsage[] {
  const bySession = new Map<string, SessionGroup>();
  for (const e of entries) {
    let slot = bySession.get(e.sessionId);
    if (!slot) {
      slot = { projectPath: e.projectPath, items: [] };
      bySession.set(e.sessionId, slot);
    }
    slot.items.push(e);
  }

  const out: SessionUsage[] = [];
  for (const [sessionId, data] of bySession) {
    const models = new Set<string>();
    let totalCost = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let startTime = data.items[0].timestamp;

    for (const e of data.items) {
      models.add(e.model);
      totalCost += e.cost;
      inputTokens += e.inputTokens;
      outputTokens += e.outputTokens;
      cacheCreationTokens += e.cacheCreationTokens;
      cacheReadTokens += e.cacheReadTokens;
      if (e.timestamp < startTime) {
        startTime = e.timestamp;
      }
    }

    out.push({
      sessionId,
      projectPath: data.projectPath,
      projectName: projectNameFromPath(data.projectPath),
      totalCost,
      totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      startTime,
      modelsUsed: [...models]
    });
  }

  return out.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
