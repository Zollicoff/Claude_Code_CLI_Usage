/**
 * Types for Claude Code usage tracking
 */

export interface UsageEntry {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  sessionId: string;
  projectPath: string;
}

export interface UsageStats {
  totalCost: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalSessions: number;
  byModel: ModelUsage[];
  byDate: DailyUsage[];
  byProject: ProjectUsage[];
}

export interface ModelUsage {
  model: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  sessionCount: number;
}

export interface DailyUsage {
  date: string;
  totalCost: number;
  totalTokens: number;
  modelsUsed: string[];
}

export interface ProjectUsage {
  projectPath: string;
  projectName: string;
  totalCost: number;
  totalTokens: number;
  sessionCount: number;
  lastUsed: string;
}

export interface SessionUsage {
  sessionId: string;
  projectPath: string;
  projectName: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  startTime: string;
  endTime: string;
  modelsUsed: string[];
}

// Raw JSONL entry structure from Claude Code logs
export interface JsonlEntry {
  timestamp: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  sessionId?: string;
  requestId?: string;
  costUSD?: number;
  cwd?: string;
}

export type TimeRange = '7d' | '30d' | 'all';

export interface DashboardState {
  stats: UsageStats | null;
  sessions: SessionUsage[];
  timeRange: TimeRange;
  loading: boolean;
  error: string | null;
}
