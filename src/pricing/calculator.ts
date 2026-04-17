import { matchModel } from './models';

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): number {
  const m = matchModel(model);
  if (!m) {
    return 0;
  }
  return (
    (inputTokens * m.input) / 1_000_000 +
    (outputTokens * m.output) / 1_000_000 +
    (cacheCreationTokens * m.cacheWrite) / 1_000_000 +
    (cacheReadTokens * m.cacheRead) / 1_000_000
  );
}
