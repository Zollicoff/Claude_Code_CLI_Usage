/** Pricing per million tokens. Order matters: most-specific patterns first. */
export interface ModelDescriptor {
  id: string;
  displayName: string;
  patterns: string[];
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODELS: readonly ModelDescriptor[] = [
  { id: 'opus-4.7',   displayName: 'Claude Opus 4.7',   patterns: ['opus-4-7', 'opus-4.7'],                                                   input: 5.0,  output: 25.0, cacheWrite: 6.25,  cacheRead: 0.50 },
  { id: 'opus-4.6',   displayName: 'Claude Opus 4.6',   patterns: ['opus-4-6', 'opus-4.6'],                                                   input: 5.0,  output: 25.0, cacheWrite: 6.25,  cacheRead: 0.50 },
  { id: 'opus-4.5',   displayName: 'Claude Opus 4.5',   patterns: ['opus-4-5', 'opus-4.5'],                                                   input: 5.0,  output: 25.0, cacheWrite: 6.25,  cacheRead: 0.50 },
  { id: 'opus-4.1',   displayName: 'Claude Opus 4.1',   patterns: ['opus-4-1', 'opus-4.1'],                                                   input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  { id: 'opus-4',     displayName: 'Claude Opus 4',     patterns: ['opus-4'],                                                                  input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  { id: 'opus-3',     displayName: 'Claude Opus 3',     patterns: ['opus-3', 'claude-3-opus'],                                                 input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  { id: 'sonnet-4.6', displayName: 'Claude Sonnet 4.6', patterns: ['sonnet-4-6', 'sonnet-4.6'],                                               input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  { id: 'sonnet-4.5', displayName: 'Claude Sonnet 4.5', patterns: ['sonnet-4-5', 'sonnet-4.5'],                                               input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  { id: 'sonnet-4',   displayName: 'Claude Sonnet 4',   patterns: ['sonnet-4'],                                                                input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  { id: 'sonnet-3.7', displayName: 'Claude Sonnet 3.7', patterns: ['sonnet-3-7', 'sonnet-3.7', 'claude-3-7-sonnet', 'claude-3.7-sonnet'],     input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  { id: 'sonnet-3.5', displayName: 'Claude Sonnet 3.5', patterns: ['sonnet-3-5', 'sonnet-3.5', 'claude-3-5-sonnet', 'claude-3.5-sonnet'],     input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  { id: 'haiku-4.5',  displayName: 'Claude Haiku 4.5',  patterns: ['haiku-4-5', 'haiku-4.5'],                                                 input: 1.0,  output: 5.0,  cacheWrite: 1.25,  cacheRead: 0.10 },
  { id: 'haiku-3.5',  displayName: 'Claude Haiku 3.5',  patterns: ['haiku-3-5', 'haiku-3.5', 'claude-3-5-haiku', 'claude-3.5-haiku'],         input: 0.80, output: 4.0,  cacheWrite: 1.0,   cacheRead: 0.08 },
  { id: 'haiku-3',    displayName: 'Claude Haiku 3',    patterns: ['haiku-3', 'claude-3-haiku'],                                               input: 0.25, output: 1.25, cacheWrite: 0.30,  cacheRead: 0.03 }
];

export function matchModel(raw: string): ModelDescriptor | null {
  const lower = raw.toLowerCase();
  for (const m of MODELS) {
    if (m.patterns.some((p) => lower.includes(p))) {
      return m;
    }
  }
  return null;
}
