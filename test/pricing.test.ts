import * as assert from 'assert';
import { calculateCost } from '../src/pricing/calculator';
import { getModelDisplayName, matchModel } from '../src/pricing';

describe('pricing', () => {
  it('matches opus 4.5 before opus 4', () => {
    assert.strictEqual(matchModel('claude-opus-4-5-20251015')?.id, 'opus-4.5');
    assert.strictEqual(matchModel('claude-opus-4-20250401')?.id, 'opus-4');
  });

  it('matches opus 4.7 and 4.6', () => {
    assert.strictEqual(matchModel('claude-opus-4-7')?.id, 'opus-4.7');
    assert.strictEqual(matchModel('claude-opus-4-6-20260201')?.id, 'opus-4.6');
  });

  it('matches sonnet 4.6 before sonnet 4', () => {
    assert.strictEqual(matchModel('claude-sonnet-4-6-20260101')?.id, 'sonnet-4.6');
  });

  it('Opus 4.7 priced $5/$25 per million', () => {
    assert.strictEqual(calculateCost('claude-opus-4-7', 1_000_000, 1_000_000, 0, 0), 30);
  });

  it('Sonnet 4.6 priced $3/$15 per million', () => {
    assert.strictEqual(calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000, 0, 0), 18);
  });

  it('returns 0 for unknown models', () => {
    assert.strictEqual(calculateCost('unknown-model', 1000, 1000, 0, 0), 0);
  });

  it('calculates opus 4.5 cost per million correctly', () => {
    const cost = calculateCost('claude-opus-4-5', 1_000_000, 1_000_000, 0, 0);
    assert.strictEqual(cost, 30.0);
  });

  it('sums cache read/write costs', () => {
    const cost = calculateCost('claude-sonnet-4-5', 0, 0, 1_000_000, 1_000_000);
    assert.strictEqual(cost, 4.05);
  });

  it('returns raw string for unknown display names', () => {
    assert.strictEqual(getModelDisplayName('mystery'), 'mystery');
  });

  it('returns display name for known model', () => {
    assert.strictEqual(getModelDisplayName('claude-haiku-4-5'), 'Claude Haiku 4.5');
  });

  it('matches sonnet variants', () => {
    assert.strictEqual(matchModel('claude-3-7-sonnet-20250219')?.id, 'sonnet-3.7');
    assert.strictEqual(matchModel('claude-3-5-sonnet-20241022')?.id, 'sonnet-3.5');
    assert.strictEqual(matchModel('claude-sonnet-4-20250514')?.id, 'sonnet-4');
  });
});
