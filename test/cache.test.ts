import * as assert from 'assert';
import { mergeEntries, isUnchanged } from '../src/cache';
import type { UsageEntry } from '../src/types';

const e = (overrides: Partial<UsageEntry> = {}): UsageEntry => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  model: 'm',
  inputTokens: 1,
  outputTokens: 1,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  cost: 0,
  sessionId: 's',
  projectPath: '/p',
  ...overrides
});

describe('cache.mergeEntries', () => {
  it('dedupes identical entries; live wins', () => {
    const cached = [e({ cost: 1 })];
    const live = [e({ cost: 2 })];
    const merged = mergeEntries(cached, live);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].cost, 2);
  });

  it('keeps non-overlapping entries from both', () => {
    const cached = [e({ sessionId: 'a' })];
    const live = [e({ sessionId: 'b' })];
    assert.strictEqual(mergeEntries(cached, live).length, 2);
  });

  it('sorts by timestamp ascending', () => {
    const cached = [e({ timestamp: '2026-03-01T00:00:00Z', sessionId: 'c' })];
    const live = [e({ timestamp: '2026-01-01T00:00:00Z', sessionId: 'a' })];
    const merged = mergeEntries(cached, live);
    assert.strictEqual(merged[0].sessionId, 'a');
  });
});

describe('cache.isUnchanged', () => {
  it('is true when both empty', () => {
    assert.strictEqual(
      isUnchanged({ version: 1, lastUpdated: '', entries: [] }, []),
      true
    );
  });

  it('is true when lengths match and last-timestamp matches', () => {
    const entries = [e({ timestamp: '2026-01-01T00:00:00Z' }), e({ timestamp: '2026-01-02T00:00:00Z' })];
    assert.strictEqual(
      isUnchanged({ version: 1, lastUpdated: '', entries }, [...entries]),
      true
    );
  });

  it('is false when lengths differ', () => {
    const cached = [e()];
    const next = [e(), e()];
    assert.strictEqual(
      isUnchanged({ version: 1, lastUpdated: '', entries: cached }, next),
      false
    );
  });

  it('is false when last-timestamp differs', () => {
    const cached = [e({ timestamp: '2026-01-01T00:00:00Z' })];
    const next = [e({ timestamp: '2026-02-01T00:00:00Z' })];
    assert.strictEqual(
      isUnchanged({ version: 1, lastUpdated: '', entries: cached }, next),
      false
    );
  });
});
