/**
 * Log parser service for Claude Code session logs
 * Reads JSONL files from ~/.claude/projects/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  UsageEntry,
  UsageStats,
  ModelUsage,
  DailyUsage,
  ProjectUsage,
  SessionUsage,
  JsonlEntry,
  TimeRange
} from '../types/usage';
import { calculateCost } from './pricing';

/**
 * Get the Claude projects directory path
 */
function getClaudeProjectsPath(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * Recursively find all .jsonl files in a directory
 */
function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findJsonlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract the first timestamp from a JSONL file for sorting
 */
function getFirstTimestamp(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, 10);

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as JsonlEntry;
        if (entry.timestamp) {
          return entry.timestamp;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // File read error
  }

  return null;
}

/**
 * Parse a single JSONL file and extract usage entries
 */
function parseJsonlFile(
  filePath: string,
  encodedProjectName: string,
  processedHashes: Set<string>
): UsageEntry[] {
  const entries: UsageEntry[] = [];
  let actualProjectPath: string | null = null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Extract session ID from file path
    const sessionId = path.basename(path.dirname(filePath));

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as JsonlEntry;

        // Extract actual project path from cwd if not already found
        if (!actualProjectPath && entry.cwd) {
          actualProjectPath = entry.cwd;
        }

        // Check if this entry has usage data
        if (entry.message?.usage) {
          const usage = entry.message.usage;

          // Create unique hash for deduplication
          if (entry.message.id && entry.requestId) {
            const hash = `${entry.message.id}:${entry.requestId}`;
            if (processedHashes.has(hash)) {
              continue; // Skip duplicate
            }
            processedHashes.add(hash);
          }

          const inputTokens = usage.input_tokens ?? 0;
          const outputTokens = usage.output_tokens ?? 0;
          const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
          const cacheReadTokens = usage.cache_read_input_tokens ?? 0;

          // Skip entries without meaningful token usage
          if (inputTokens === 0 && outputTokens === 0 &&
              cacheCreationTokens === 0 && cacheReadTokens === 0) {
            continue;
          }

          const model = entry.message.model ?? 'unknown';

          // Use provided cost or calculate it
          const cost = entry.costUSD ?? calculateCost(
            model,
            inputTokens,
            outputTokens,
            cacheCreationTokens,
            cacheReadTokens
          );

          entries.push({
            timestamp: entry.timestamp,
            model,
            inputTokens,
            outputTokens,
            cacheCreationTokens,
            cacheReadTokens,
            cost,
            sessionId: entry.sessionId ?? sessionId,
            projectPath: actualProjectPath ?? encodedProjectName,
          });
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
  }

  return entries;
}

/**
 * Get all usage entries from Claude Code logs
 */
export function getAllUsageEntries(): UsageEntry[] {
  const projectsDir = getClaudeProjectsPath();
  const allEntries: UsageEntry[] = [];
  const processedHashes = new Set<string>();

  if (!fs.existsSync(projectsDir)) {
    return allEntries;
  }

  // Collect all JSONL files with their project names
  const filesToProcess: Array<{ path: string; projectName: string }> = [];

  const projectFolders = fs.readdirSync(projectsDir, { withFileTypes: true });
  for (const folder of projectFolders) {
    if (!folder.isDirectory()) continue;

    const projectPath = path.join(projectsDir, folder.name);
    const jsonlFiles = findJsonlFiles(projectPath);

    for (const file of jsonlFiles) {
      filesToProcess.push({ path: file, projectName: folder.name });
    }
  }

  // Sort files by their first timestamp for deterministic deduplication
  filesToProcess.sort((a, b) => {
    const tsA = getFirstTimestamp(a.path) ?? '';
    const tsB = getFirstTimestamp(b.path) ?? '';
    return tsA.localeCompare(tsB);
  });

  // Parse all files
  for (const file of filesToProcess) {
    const entries = parseJsonlFile(file.path, file.projectName, processedHashes);
    allEntries.push(...entries);
  }

  // Sort by timestamp
  allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return allEntries;
}

/**
 * Filter entries by time range
 */
export function filterByTimeRange(entries: UsageEntry[], range: TimeRange): UsageEntry[] {
  if (range === 'all') {
    return entries;
  }

  const now = new Date();
  const days = range === '7d' ? 7 : 30;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return entries.filter(entry => new Date(entry.timestamp) >= cutoff);
}

/**
 * Extract project name from path
 */
function getProjectName(projectPath: string): string {
  // Try to get a clean name from the path
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

/**
 * Aggregate entries into usage statistics
 */
export function aggregateStats(entries: UsageEntry[]): UsageStats {
  if (entries.length === 0) {
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
      byProject: [],
    };
  }

  // Calculate totals
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalCacheReadTokens = 0;
  const sessions = new Set<string>();

  // Group by model
  const modelMap = new Map<string, ModelUsage>();
  // Group by date
  const dateMap = new Map<string, { cost: number; tokens: number; models: Set<string> }>();
  // Group by project
  const projectMap = new Map<string, {
    cost: number;
    tokens: number;
    sessions: Set<string>;
    lastUsed: string;
    projectName: string;
  }>();

  for (const entry of entries) {
    totalCost += entry.cost;
    totalInputTokens += entry.inputTokens;
    totalOutputTokens += entry.outputTokens;
    totalCacheCreationTokens += entry.cacheCreationTokens;
    totalCacheReadTokens += entry.cacheReadTokens;
    sessions.add(entry.sessionId);

    // By model
    if (!modelMap.has(entry.model)) {
      modelMap.set(entry.model, {
        model: entry.model,
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        sessionCount: 0,
      });
    }
    const modelStats = modelMap.get(entry.model)!;
    modelStats.totalCost += entry.cost;
    modelStats.inputTokens += entry.inputTokens;
    modelStats.outputTokens += entry.outputTokens;
    modelStats.cacheCreationTokens += entry.cacheCreationTokens;
    modelStats.cacheReadTokens += entry.cacheReadTokens;
    modelStats.totalTokens += entry.inputTokens + entry.outputTokens +
                              entry.cacheCreationTokens + entry.cacheReadTokens;

    // By date (YYYY-MM-DD)
    const date = entry.timestamp.split('T')[0];
    if (!dateMap.has(date)) {
      dateMap.set(date, { cost: 0, tokens: 0, models: new Set() });
    }
    const dateStats = dateMap.get(date)!;
    dateStats.cost += entry.cost;
    dateStats.tokens += entry.inputTokens + entry.outputTokens +
                        entry.cacheCreationTokens + entry.cacheReadTokens;
    dateStats.models.add(entry.model);

    // By project
    if (!projectMap.has(entry.projectPath)) {
      projectMap.set(entry.projectPath, {
        cost: 0,
        tokens: 0,
        sessions: new Set(),
        lastUsed: entry.timestamp,
        projectName: getProjectName(entry.projectPath),
      });
    }
    const projectStats = projectMap.get(entry.projectPath)!;
    projectStats.cost += entry.cost;
    projectStats.tokens += entry.inputTokens + entry.outputTokens +
                           entry.cacheCreationTokens + entry.cacheReadTokens;
    projectStats.sessions.add(entry.sessionId);
    if (entry.timestamp > projectStats.lastUsed) {
      projectStats.lastUsed = entry.timestamp;
    }
  }

  // Count unique sessions per model
  const modelSessions = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!modelSessions.has(entry.model)) {
      modelSessions.set(entry.model, new Set());
    }
    modelSessions.get(entry.model)!.add(entry.sessionId);
  }
  for (const [model, sessionsSet] of modelSessions) {
    const modelStats = modelMap.get(model);
    if (modelStats) {
      modelStats.sessionCount = sessionsSet.size;
    }
  }

  // Convert maps to arrays
  const byModel: ModelUsage[] = Array.from(modelMap.values())
    .sort((a, b) => b.totalCost - a.totalCost);

  const byDate: DailyUsage[] = Array.from(dateMap.entries())
    .map(([date, stats]) => ({
      date,
      totalCost: stats.cost,
      totalTokens: stats.tokens,
      modelsUsed: Array.from(stats.models),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byProject: ProjectUsage[] = Array.from(projectMap.entries())
    .map(([projectPath, stats]) => ({
      projectPath,
      projectName: stats.projectName,
      totalCost: stats.cost,
      totalTokens: stats.tokens,
      sessionCount: stats.sessions.size,
      lastUsed: stats.lastUsed,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalCost,
    totalTokens: totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    totalSessions: sessions.size,
    byModel,
    byDate,
    byProject,
  };
}

/**
 * Get session-level statistics
 */
export function getSessionStats(entries: UsageEntry[]): SessionUsage[] {
  const sessionMap = new Map<string, {
    projectPath: string;
    entries: UsageEntry[];
  }>();

  for (const entry of entries) {
    if (!sessionMap.has(entry.sessionId)) {
      sessionMap.set(entry.sessionId, {
        projectPath: entry.projectPath,
        entries: [],
      });
    }
    sessionMap.get(entry.sessionId)!.entries.push(entry);
  }

  const sessions: SessionUsage[] = [];

  for (const [sessionId, data] of sessionMap) {
    const sessionEntries = data.entries;
    const models = new Set<string>();
    let totalCost = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let startTime = sessionEntries[0].timestamp;
    let endTime = sessionEntries[0].timestamp;

    for (const entry of sessionEntries) {
      models.add(entry.model);
      totalCost += entry.cost;
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
      cacheCreationTokens += entry.cacheCreationTokens;
      cacheReadTokens += entry.cacheReadTokens;

      if (entry.timestamp < startTime) startTime = entry.timestamp;
      if (entry.timestamp > endTime) endTime = entry.timestamp;
    }

    sessions.push({
      sessionId,
      projectPath: data.projectPath,
      projectName: getProjectName(data.projectPath),
      totalCost,
      totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      startTime,
      endTime,
      modelsUsed: Array.from(models),
    });
  }

  // Sort by start time descending (most recent first)
  return sessions.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
