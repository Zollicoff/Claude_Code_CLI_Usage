import * as assert from 'assert';
import { aggregateStats, filterByTimeRange, getSessionStats } from '../src/aggregator';
import type { UsageEntry } from '../src/types';

const e = (o: Partial<UsageEntry> = {}): UsageEntry => ({
  timestamp: '2026-04-10T10:00:00Z',
  model: 'claude-opus-4-5',
  inputTokens: 100,
  outputTokens: 50,
  cacheCreationTokens: 10,
  cacheReadTokens: 5,
  cost: 0.5,
  sessionId: 's1',
  projectPath: '/p1',
  ...o
});

describe('aggregator', () => {
  it('sums totals and session count', () => {
    const stats = aggregateStats([
      e({ sessionId: 's1', cost: 1 }),
      e({ sessionId: 's1', cost: 2 }),
      e({ sessionId: 's2', cost: 4 })
    ]);
    assert.strictEqual(stats.totalCost, 7);
    assert.strictEqual(stats.totalSessions, 2);
  });

  it('counts unique sessions per model', () => {
    const stats = aggregateStats([
      e({ model: 'claude-opus-4-5', sessionId: 's1' }),
      e({ model: 'claude-opus-4-5', sessionId: 's1' }),
      e({ model: 'claude-opus-4-5', sessionId: 's2' }),
      e({ model: 'claude-sonnet-4-5', sessionId: 's2' })
    ]);
    const opus = stats.byModel.find((m) => m.model === 'claude-opus-4-5')!;
    assert.strictEqual(opus.sessionCount, 2);
  });

  it('groups by date (YYYY-MM-DD)', () => {
    const stats = aggregateStats([
      e({ timestamp: '2026-04-10T10:00:00Z' }),
      e({ timestamp: '2026-04-10T18:00:00Z' }),
      e({ timestamp: '2026-04-11T09:00:00Z' })
    ]);
    assert.strictEqual(stats.byDate.length, 2);
  });

  it('filterByTimeRange keeps entries within N days', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 1 * 86_400_000).toISOString();
    const old = new Date(now.getTime() - 40 * 86_400_000).toISOString();
    const kept = filterByTimeRange([e({ timestamp: recent }), e({ timestamp: old })], '7d');
    assert.strictEqual(kept.length, 1);
  });

  it('filterByTimeRange all returns input', () => {
    const entries = [e(), e()];
    assert.strictEqual(filterByTimeRange(entries, 'all').length, 2);
  });

  it('getSessionStats returns sessions sorted newest first', () => {
    const sessions = getSessionStats([
      e({ sessionId: 'a', timestamp: '2026-04-10T10:00:00Z' }),
      e({ sessionId: 'b', timestamp: '2026-04-12T10:00:00Z' })
    ]);
    assert.strictEqual(sessions[0].sessionId, 'b');
  });

  it('empty input returns empty stats', () => {
    const stats = aggregateStats([]);
    assert.strictEqual(stats.totalCost, 0);
    assert.strictEqual(stats.totalSessions, 0);
    assert.strictEqual(stats.byModel.length, 0);
  });
});
