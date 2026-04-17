import type {
  DailyUsage,
  ModelUsage,
  ProjectUsage,
  UsageEntry,
  UsageStats
} from '../types';
import { projectNameFromPath } from './filters';

interface ModelSlot { m: ModelUsage; sessions: Set<string>; }
interface DateSlot { cost: number; tokens: number; models: Set<string>; }
interface ProjectSlot {
  cost: number;
  tokens: number;
  sessions: Set<string>;
  lastUsed: string;
  name: string;
}

function emptyStats(): UsageStats {
  return {
    totalCost: 0,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalSessions: 0,
    byModel: [],
    byDate: [],
    byProject: []
  };
}

function upsertModel(map: Map<string, ModelSlot>, e: UsageEntry): void {
  let slot = map.get(e.model);
  if (!slot) {
    slot = {
      m: {
        model: e.model,
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        sessionCount: 0
      },
      sessions: new Set()
    };
    map.set(e.model, slot);
  }
  const { m, sessions } = slot;
  m.totalCost += e.cost;
  m.inputTokens += e.inputTokens;
  m.outputTokens += e.outputTokens;
  m.cacheCreationTokens += e.cacheCreationTokens;
  m.cacheReadTokens += e.cacheReadTokens;
  m.totalTokens += e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
  sessions.add(e.sessionId);
}

function upsertDate(map: Map<string, DateSlot>, e: UsageEntry): void {
  const date = e.timestamp.slice(0, 10);
  let slot = map.get(date);
  if (!slot) {
    slot = { cost: 0, tokens: 0, models: new Set() };
    map.set(date, slot);
  }
  slot.cost += e.cost;
  slot.tokens += e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
  slot.models.add(e.model);
}

function upsertProject(map: Map<string, ProjectSlot>, e: UsageEntry): void {
  let slot = map.get(e.projectPath);
  if (!slot) {
    slot = {
      cost: 0,
      tokens: 0,
      sessions: new Set(),
      lastUsed: e.timestamp,
      name: projectNameFromPath(e.projectPath)
    };
    map.set(e.projectPath, slot);
  }
  slot.cost += e.cost;
  slot.tokens += e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
  slot.sessions.add(e.sessionId);
  if (e.timestamp > slot.lastUsed) {
    slot.lastUsed = e.timestamp;
  }
}

export function aggregateStats(entries: UsageEntry[]): UsageStats {
  if (entries.length === 0) {
    return emptyStats();
  }

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCacheReadTokens = 0;
  const allSessions = new Set<string>();

  const models = new Map<string, ModelSlot>();
  const dates = new Map<string, DateSlot>();
  const projects = new Map<string, ProjectSlot>();

  for (const entry of entries) {
    totalCost += entry.cost;
    totalInputTokens += entry.inputTokens;
    totalOutputTokens += entry.outputTokens;
    totalCacheCreationTokens += entry.cacheCreationTokens;
    totalCacheReadTokens += entry.cacheReadTokens;
    allSessions.add(entry.sessionId);
    upsertModel(models, entry);
    upsertDate(dates, entry);
    upsertProject(projects, entry);
  }

  const byModel: ModelUsage[] = [...models.values()]
    .map(({ m, sessions }) => ({ ...m, sessionCount: sessions.size }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const byDate: DailyUsage[] = [...dates.entries()]
    .map(([date, s]) => ({
      date,
      totalCost: s.cost,
      totalTokens: s.tokens,
      modelsUsed: [...s.models]
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byProject: ProjectUsage[] = [...projects.entries()]
    .map(([projectPath, s]) => ({
      projectPath,
      projectName: s.name,
      totalCost: s.cost,
      totalTokens: s.tokens,
      sessionCount: s.sessions.size,
      lastUsed: s.lastUsed
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalCost,
    totalTokens:
      totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    totalSessions: allSessions.size,
    byModel,
    byDate,
    byProject
  };
}
