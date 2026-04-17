import * as assert from 'assert';
import * as path from 'path';
import { parseJsonlFile } from '../src/parser/jsonl';

const FIX = path.resolve(__dirname, '../../test/fixtures');

describe('parser.parseJsonlFile', () => {
  it('parses entries and preserves costUSD override', () => {
    const seen = new Set<string>();
    const entries = parseJsonlFile(path.join(FIX, 'session-sonnet.jsonl'), 'enc', seen);
    assert.strictEqual(entries.length, 1); // zero-token entry skipped
    assert.strictEqual(entries[0].cost, 0.123);
    assert.strictEqual(entries[0].projectPath, '/home/u/proj-b');
  });

  it('skips entries with no token activity', () => {
    const seen = new Set<string>();
    const entries = parseJsonlFile(path.join(FIX, 'session-sonnet.jsonl'), 'enc', seen);
    assert.ok(entries.every((e) =>
      e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens > 0
    ));
  });

  it('dedupes by message.id + requestId across invocations', () => {
    const seen = new Set<string>();
    const first = parseJsonlFile(path.join(FIX, 'session-dupes.jsonl'), 'enc', seen);
    assert.strictEqual(first.length, 1);
    const second = parseJsonlFile(path.join(FIX, 'session-dupes.jsonl'), 'enc', seen);
    assert.strictEqual(second.length, 0);
  });

  it('parses opus entries and calculates cost when costUSD absent', () => {
    const seen = new Set<string>();
    const entries = parseJsonlFile(path.join(FIX, 'session-opus.jsonl'), 'enc', seen);
    assert.strictEqual(entries.length, 2);
    assert.ok(entries[0].cost > 0, 'calculated cost should be positive');
    assert.strictEqual(entries[0].model, 'claude-opus-4-5');
  });
});
