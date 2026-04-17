import * as fs from 'fs';
import * as path from 'path';
import type { JsonlEntry, UsageEntry } from '../types';
import { calculateCost } from '../pricing';

export function parseJsonlFile(
  filePath: string,
  encodedProjectName: string,
  seenHashes: Set<string>
): UsageEntry[] {
  const out: UsageEntry[] = [];
  let cwd: string | null = null;
  const sessionIdFromPath = path.basename(filePath, '.jsonl');

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Parse read failed for ${filePath}:`, err);
    return out;
  }

  for (const line of content.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    let entry: JsonlEntry;
    try {
      entry = JSON.parse(line) as JsonlEntry;
    } catch {
      continue;
    }
    if (!cwd && entry.cwd) {
      cwd = entry.cwd;
    }
    const usage = entry.message?.usage;
    if (!usage) {
      continue;
    }

    if (entry.message?.id && entry.requestId) {
      const key = `${entry.message.id}:${entry.requestId}`;
      if (seenHashes.has(key)) {
        continue;
      }
      seenHashes.add(key);
    }

    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    if (!(inputTokens || outputTokens || cacheCreationTokens || cacheReadTokens)) {
      continue;
    }

    const model = entry.message?.model ?? 'unknown';
    const cost = entry.costUSD ?? calculateCost(
      model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens
    );

    out.push({
      timestamp: entry.timestamp,
      model,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      cost,
      sessionId: entry.sessionId ?? sessionIdFromPath,
      projectPath: cwd ?? encodedProjectName
    });
  }

  return out;
}
