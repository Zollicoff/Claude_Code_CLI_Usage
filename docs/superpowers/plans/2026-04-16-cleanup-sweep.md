# Cleanup Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the VS Code extension into focused modules, fix XSS/CSP gaps in the webviews, table-drive pricing, decompose aggregator/parser, move webview HTML/CSS/JS to assets, restore lint + add tests, and delete dead code — without changing any user-visible behavior.

**Architecture:** Split `src/` into small topical folders (`pricing/`, `parser/`, `aggregator/`, `webview/`). Webviews load CSS/JS as `asWebviewUri` assets under a strict CSP. All HTML interpolation flows through `escapeHtml`/`escapeAttr`. Pure-logic modules get Mocha unit tests driven off hand-authored JSONL fixtures.

**Tech Stack:** TypeScript 5.7, VS Code 1.85 Extension API, webpack 5 + `copy-webpack-plugin`, Mocha via `@vscode/test-cli`, ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-04-16-cleanup-sweep-design.md`

---

## Phase 1: Scaffolding & build wiring

### Task 1: Add webpack asset copy + deps

**Files:**
- Modify: `package.json`
- Modify: `webpack.config.js`

- [ ] **Step 1: Add `copy-webpack-plugin` devDependency**

Run:
```bash
npm install --save-dev copy-webpack-plugin@^12.0.2
```

- [ ] **Step 2: Update `webpack.config.js` to copy `src/webview/assets/` → `dist/webview/assets/`**

```js
//@ts-check
'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader' }],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/webview/assets', to: 'webview/assets' },
      ],
    }),
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: { level: 'log' },
};
module.exports = config;
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json webpack.config.js
git commit -m "Wire copy-webpack-plugin for webview assets"
```

### Task 2: Add ESLint flat config

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Create config**

```js
// @ts-check
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'semi': ['error', 'always'],
      'eqeqeq': ['error', 'always'],
    },
  },
  { ignores: ['dist/**', 'out/**', 'node_modules/**', 'test/**'] },
];
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: lint runs without errors (warnings allowed from old code — will drop as files are replaced).

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "Add ESLint flat config"
```

---

## Phase 2: Pricing refactor (table-driven, with tests)

### Task 3: Create pricing model table

**Files:**
- Create: `src/pricing/models.ts`

- [ ] **Step 1: Write the file**

```ts
/** Pricing per million tokens. Order matters: most-specific first. */
export interface ModelDescriptor {
  id: string;
  displayName: string;
  patterns: string[]; // lowercased substrings to match raw model strings
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODELS: readonly ModelDescriptor[] = [
  { id: 'opus-4.5',   displayName: 'Claude Opus 4.5',   patterns: ['opus-4-5', 'opus-4.5'],   input: 5.0,  output: 25.0, cacheWrite: 6.25,  cacheRead: 0.50 },
  { id: 'opus-4.1',   displayName: 'Claude Opus 4.1',   patterns: ['opus-4-1', 'opus-4.1'],   input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  { id: 'opus-4',     displayName: 'Claude Opus 4',     patterns: ['opus-4'],                 input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  { id: 'opus-3',     displayName: 'Claude Opus 3',     patterns: ['opus-3', 'claude-3-opus'], input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  { id: 'sonnet-4.5', displayName: 'Claude Sonnet 4.5', patterns: ['sonnet-4-5', 'sonnet-4.5'], input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  { id: 'sonnet-4',   displayName: 'Claude Sonnet 4',   patterns: ['sonnet-4'],               input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  { id: 'sonnet-3.7', displayName: 'Claude Sonnet 3.7', patterns: ['sonnet-3-7', 'sonnet-3.7', 'claude-3-7-sonnet', 'claude-3.7-sonnet'], input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  { id: 'sonnet-3.5', displayName: 'Claude Sonnet 3.5', patterns: ['sonnet-3-5', 'sonnet-3.5', 'claude-3-5-sonnet', 'claude-3.5-sonnet'], input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  { id: 'haiku-4.5',  displayName: 'Claude Haiku 4.5',  patterns: ['haiku-4-5', 'haiku-4.5'], input: 1.0,  output: 5.0,  cacheWrite: 1.25,  cacheRead: 0.10 },
  { id: 'haiku-3.5',  displayName: 'Claude Haiku 3.5',  patterns: ['haiku-3-5', 'haiku-3.5', 'claude-3-5-haiku', 'claude-3.5-haiku'], input: 0.80, output: 4.0, cacheWrite: 1.0, cacheRead: 0.08 },
  { id: 'haiku-3',    displayName: 'Claude Haiku 3',    patterns: ['haiku-3', 'claude-3-haiku'], input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 },
];

export function matchModel(raw: string): ModelDescriptor | null {
  const lower = raw.toLowerCase();
  for (const m of MODELS) {
    if (m.patterns.some((p) => lower.includes(p))) return m;
  }
  return null;
}
```

### Task 4: Add pricing tests

**Files:**
- Create: `test/pricing.test.ts`
- Modify: `.vscode-test.mjs` (create if absent)

- [ ] **Step 1: Create test runner config**

`.vscode-test.mjs`:
```js
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  mocha: { ui: 'bdd', timeout: 20000 },
});
```

- [ ] **Step 2: Write the failing test**

```ts
import * as assert from 'assert';
import { calculateCost } from '../src/pricing/calculator';
import { getModelDisplayName, matchModel } from '../src/pricing';

describe('pricing', () => {
  it('matches opus 4.5 before opus 4', () => {
    assert.strictEqual(matchModel('claude-opus-4-5-20251015')?.id, 'opus-4.5');
    assert.strictEqual(matchModel('claude-opus-4-20250401')?.id, 'opus-4');
  });

  it('returns 0 for unknown models', () => {
    assert.strictEqual(calculateCost('unknown-model', 1000, 1000, 0, 0), 0);
  });

  it('calculates opus 4.5 cost per million correctly', () => {
    const cost = calculateCost('claude-opus-4-5', 1_000_000, 1_000_000, 0, 0);
    assert.strictEqual(cost, 30.0); // 5 + 25
  });

  it('sums cache read/write costs', () => {
    const cost = calculateCost('claude-sonnet-4-5', 0, 0, 1_000_000, 1_000_000);
    assert.strictEqual(cost, 4.05); // 3.75 + 0.30
  });

  it('returns raw string for unknown display names', () => {
    assert.strictEqual(getModelDisplayName('mystery'), 'mystery');
  });

  it('returns display name for known model', () => {
    assert.strictEqual(getModelDisplayName('claude-haiku-4-5'), 'Claude Haiku 4.5');
  });
});
```

- [ ] **Step 3: Run to verify it fails (cannot find modules)**

Run: `npm run compile-tests`
Expected: FAIL (files don't exist yet).

### Task 5: Create calculator.ts and index.ts

**Files:**
- Create: `src/pricing/calculator.ts`
- Create: `src/pricing/index.ts`

- [ ] **Step 1: `src/pricing/calculator.ts`**

```ts
import { matchModel } from './models';

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): number {
  const m = matchModel(model);
  if (!m) return 0;
  return (
    (inputTokens * m.input) / 1_000_000 +
    (outputTokens * m.output) / 1_000_000 +
    (cacheCreationTokens * m.cacheWrite) / 1_000_000 +
    (cacheReadTokens * m.cacheRead) / 1_000_000
  );
}
```

- [ ] **Step 2: `src/pricing/index.ts`**

```ts
export { MODELS, matchModel } from './models';
export type { ModelDescriptor } from './models';
export { calculateCost } from './calculator';

import { matchModel } from './models';

export function getModelDisplayName(model: string): string {
  return matchModel(model)?.displayName ?? model;
}
```

- [ ] **Step 3: Delete old `src/services/pricing.ts`**

```bash
rm src/services/pricing.ts
```

- [ ] **Step 4: Update imports in callers (they'll be rewritten later; update now to pass compile)**

In `src/services/logParser.ts`: change `from './pricing'` → `from '../pricing'`.
In `src/webview/dashboardPanel.ts` and `src/webview/sidebarProvider.ts`: change `from '../services/pricing'` → `from '../pricing'`.

- [ ] **Step 5: Compile + run tests**

```bash
npm run compile-tests && npm test
```
Expected: pricing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pricing test/pricing.test.ts .vscode-test.mjs src/services src/webview
git commit -m "Table-driven pricing with unit tests"
```

---

## Phase 3: Types cleanup

### Task 6: Consolidate types

**Files:**
- Create: `src/types.ts`
- Delete: `src/types/usage.ts`

- [ ] **Step 1: Write `src/types.ts`** (copy existing `src/types/usage.ts`, remove `DashboardState` + `SessionUsage.endTime`)

```ts
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
  modelsUsed: string[];
}

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

export interface CachedData {
  version: number;
  lastUpdated: string;
  entries: UsageEntry[];
}
```

- [ ] **Step 2: Update imports** — replace `from '../types/usage'`, `from './types/usage'` with `'../types'` / `'./types'` across `src/`.

- [ ] **Step 3: Delete old file**

```bash
rm src/types/usage.ts && rmdir src/types
```

- [ ] **Step 4: Compile**

```bash
npm run compile-tests
```
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/types src/services src/webview
git commit -m "Consolidate types.ts; drop unused DashboardState and endTime"
```

---

## Phase 4: Cache refactor (with tests)

### Task 7: Cache tests

**Files:**
- Create: `test/cache.test.ts`
- Create: `test/fixtures/cache-v1.json`

- [ ] **Step 1: Fixture `test/fixtures/cache-v1.json`**

```json
{
  "version": 1,
  "lastUpdated": "2026-01-01T00:00:00.000Z",
  "entries": [
    { "timestamp": "2026-01-01T00:00:00.000Z", "model": "claude-sonnet-4-5", "inputTokens": 100, "outputTokens": 50, "cacheCreationTokens": 0, "cacheReadTokens": 0, "cost": 0.001, "sessionId": "s1", "projectPath": "/tmp/p1" }
  ]
}
```

- [ ] **Step 2: Test file**

```ts
import * as assert from 'assert';
import { mergeEntries } from '../src/cache';
import type { UsageEntry } from '../src/types';

const e = (overrides: Partial<UsageEntry>): UsageEntry => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  model: 'm', inputTokens: 1, outputTokens: 1,
  cacheCreationTokens: 0, cacheReadTokens: 0,
  cost: 0, sessionId: 's', projectPath: '/p',
  ...overrides,
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
```

### Task 8: Rewrite cache.ts with skip-if-unchanged

**Files:**
- Create: `src/cache.ts`
- Delete: `src/services/cacheManager.ts`

- [ ] **Step 1: Write `src/cache.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { UsageEntry, CachedData } from './types';

const CACHE_VERSION = 1;
const CACHE_DIR = '.claude-code-usage';
const CACHE_FILE = 'cache.json';

function cacheDir(): string {
  return path.join(os.homedir(), CACHE_DIR);
}

export function cachePath(): string {
  return path.join(cacheDir(), CACHE_FILE);
}

export function loadCache(): CachedData {
  const p = cachePath();
  if (!fs.existsSync(p)) {
    return { version: CACHE_VERSION, lastUpdated: new Date().toISOString(), entries: [] };
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as CachedData;
    if (data.version !== CACHE_VERSION) data.version = CACHE_VERSION;
    return data;
  } catch (err) {
    console.error('Cache load failed:', err);
    return { version: CACHE_VERSION, lastUpdated: new Date().toISOString(), entries: [] };
  }
}

export function saveCache(data: CachedData): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(cachePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Cache save failed:', err);
  }
}

function entryKey(e: UsageEntry): string {
  return `${e.timestamp}:${e.sessionId}:${e.model}:${e.inputTokens}:${e.outputTokens}`;
}

export function mergeEntries(cached: UsageEntry[], live: UsageEntry[]): UsageEntry[] {
  const seen = new Set<string>();
  const out: UsageEntry[] = [];
  for (const e of live) {
    const k = entryKey(e);
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  for (const e of cached) {
    const k = entryKey(e);
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return out;
}

/** True when `next` has the same count + same last-timestamp as `current`. */
export function isUnchanged(current: CachedData, next: UsageEntry[]): boolean {
  if (current.entries.length !== next.length) return false;
  if (next.length === 0) return true;
  return current.entries[next.length - 1].timestamp === next[next.length - 1].timestamp;
}
```

- [ ] **Step 2: Delete old file**

```bash
rm src/services/cacheManager.ts
```

- [ ] **Step 3: Update imports** in `src/services/logParser.ts` (temporary; gets replaced next phase) — `../cache` path.

- [ ] **Step 4: Compile + test**

```bash
npm run compile-tests && npm test
```
Expected: pricing + cache tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/cache.ts src/services test/cache.test.ts test/fixtures
git commit -m "Cache module: rename, skip-if-unchanged helper, unit tests"
```

---

## Phase 5: Parser refactor (with tests)

### Task 9: Parser test fixtures

**Files:**
- Create: `test/fixtures/session-opus.jsonl`
- Create: `test/fixtures/session-sonnet.jsonl`
- Create: `test/fixtures/session-dupes.jsonl`

- [ ] **Step 1: `session-opus.jsonl`**

```jsonl
{"timestamp":"2026-04-10T10:00:00Z","sessionId":"sess-a","requestId":"r1","cwd":"/home/u/proj-a","message":{"id":"m1","model":"claude-opus-4-5","usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
{"timestamp":"2026-04-10T10:05:00Z","sessionId":"sess-a","requestId":"r2","cwd":"/home/u/proj-a","message":{"id":"m2","model":"claude-opus-4-5","usage":{"input_tokens":200,"output_tokens":100,"cache_creation_input_tokens":500,"cache_read_input_tokens":0}}}
```

- [ ] **Step 2: `session-sonnet.jsonl`**

```jsonl
{"timestamp":"2026-04-11T09:00:00Z","sessionId":"sess-b","requestId":"r3","cwd":"/home/u/proj-b","message":{"id":"m3","model":"claude-sonnet-4-5","usage":{"input_tokens":0,"output_tokens":0}}}
{"timestamp":"2026-04-11T09:01:00Z","sessionId":"sess-b","requestId":"r4","cwd":"/home/u/proj-b","costUSD":0.123,"message":{"id":"m4","model":"claude-sonnet-4-5","usage":{"input_tokens":50,"output_tokens":25}}}
```

- [ ] **Step 3: `session-dupes.jsonl`** (same id+requestId twice)

```jsonl
{"timestamp":"2026-04-12T09:00:00Z","sessionId":"sess-c","requestId":"r5","cwd":"/home/u/proj-c","message":{"id":"m5","model":"claude-haiku-4-5","usage":{"input_tokens":10,"output_tokens":5}}}
{"timestamp":"2026-04-12T09:00:00Z","sessionId":"sess-c","requestId":"r5","cwd":"/home/u/proj-c","message":{"id":"m5","model":"claude-haiku-4-5","usage":{"input_tokens":10,"output_tokens":5}}}
```

### Task 10: Parser tests

**Files:**
- Create: `test/parser.test.ts`

- [ ] **Step 1: Write tests**

```ts
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
    assert.ok(entries.every((e) => e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens > 0));
  });

  it('dedupes by message.id + requestId across invocations', () => {
    const seen = new Set<string>();
    const first = parseJsonlFile(path.join(FIX, 'session-dupes.jsonl'), 'enc', seen);
    assert.strictEqual(first.length, 1);
    const second = parseJsonlFile(path.join(FIX, 'session-dupes.jsonl'), 'enc', seen);
    assert.strictEqual(second.length, 0);
  });
});
```

### Task 11: Parser modules

**Files:**
- Create: `src/parser/files.ts`
- Create: `src/parser/jsonl.ts`
- Create: `src/parser/index.ts`

- [ ] **Step 1: `src/parser/files.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function claudeProjectsPath(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

/** Returns absolute paths of every *.jsonl file directly under each project folder. */
export function findJsonlFiles(projectsDir: string): Array<{ path: string; projectFolder: string }> {
  if (!fs.existsSync(projectsDir)) return [];
  const out: Array<{ path: string; projectFolder: string }> = [];
  for (const folder of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const dir = path.join(projectsDir, folder.name);
    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        out.push({ path: path.join(dir, file.name), projectFolder: folder.name });
      }
    }
  }
  return out;
}
```

- [ ] **Step 2: `src/parser/jsonl.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';
import type { JsonlEntry, UsageEntry } from '../types';
import { calculateCost } from '../pricing';

export function parseJsonlFile(
  filePath: string,
  encodedProjectName: string,
  seenHashes: Set<string>,
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
    if (!line.trim()) continue;
    let entry: JsonlEntry;
    try {
      entry = JSON.parse(line) as JsonlEntry;
    } catch {
      continue;
    }
    if (!cwd && entry.cwd) cwd = entry.cwd;
    const usage = entry.message?.usage;
    if (!usage) continue;

    if (entry.message?.id && entry.requestId) {
      const key = `${entry.message.id}:${entry.requestId}`;
      if (seenHashes.has(key)) continue;
      seenHashes.add(key);
    }

    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
    if (!(inputTokens || outputTokens || cacheCreationTokens || cacheReadTokens)) continue;

    const model = entry.message?.model ?? 'unknown';
    const cost = entry.costUSD ?? calculateCost(
      model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens,
    );

    out.push({
      timestamp: entry.timestamp,
      model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, cost,
      sessionId: entry.sessionId ?? sessionIdFromPath,
      projectPath: cwd ?? encodedProjectName,
    });
  }

  return out;
}
```

- [ ] **Step 3: `src/parser/index.ts`**

```ts
import * as fs from 'fs';
import type { UsageEntry } from '../types';
import { loadCache, saveCache, mergeEntries, isUnchanged } from '../cache';
import { claudeProjectsPath, findJsonlFiles } from './files';
import { parseJsonlFile } from './jsonl';

export { parseJsonlFile } from './jsonl';
export { claudeProjectsPath, findJsonlFiles } from './files';

export function getLiveUsageEntries(): UsageEntry[] {
  const files = findJsonlFiles(claudeProjectsPath());
  files.sort((a, b) => {
    const aT = safeMtime(a.path);
    const bT = safeMtime(b.path);
    return aT - bT;
  });

  const seen = new Set<string>();
  const entries: UsageEntry[] = [];
  for (const f of files) entries.push(...parseJsonlFile(f.path, f.projectFolder, seen));
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

export function getAllUsageEntries(): UsageEntry[] {
  const cached = loadCache();
  const live = getLiveUsageEntries();
  const merged = mergeEntries(cached.entries, live);
  if (!isUnchanged(cached, merged)) {
    saveCache({ version: cached.version, lastUpdated: new Date().toISOString(), entries: merged });
  }
  return merged;
}

function safeMtime(p: string): number {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
}
```

- [ ] **Step 4: Compile + test**

```bash
npm run compile-tests && npm test
```
Expected: pricing + cache + parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser test/parser.test.ts test/fixtures
git commit -m "Parser module: split files/jsonl, mtime sort, skip-if-unchanged cache save"
```

---

## Phase 6: Aggregator refactor (with tests)

### Task 12: Aggregator tests

**Files:**
- Create: `test/aggregator.test.ts`

- [ ] **Step 1: Tests**

```ts
import * as assert from 'assert';
import { aggregateStats, filterByTimeRange, getSessionStats } from '../src/aggregator';
import type { UsageEntry } from '../src/types';

const e = (o: Partial<UsageEntry> = {}): UsageEntry => ({
  timestamp: '2026-04-10T10:00:00Z', model: 'claude-opus-4-5',
  inputTokens: 100, outputTokens: 50, cacheCreationTokens: 10, cacheReadTokens: 5,
  cost: 0.5, sessionId: 's1', projectPath: '/p1', ...o,
});

describe('aggregator', () => {
  it('sums totals and session count', () => {
    const stats = aggregateStats([
      e({ sessionId: 's1', cost: 1 }),
      e({ sessionId: 's1', cost: 2 }),
      e({ sessionId: 's2', cost: 4 }),
    ]);
    assert.strictEqual(stats.totalCost, 7);
    assert.strictEqual(stats.totalSessions, 2);
  });

  it('counts unique sessions per model', () => {
    const stats = aggregateStats([
      e({ model: 'claude-opus-4-5', sessionId: 's1' }),
      e({ model: 'claude-opus-4-5', sessionId: 's1' }),
      e({ model: 'claude-opus-4-5', sessionId: 's2' }),
      e({ model: 'claude-sonnet-4-5', sessionId: 's2' }),
    ]);
    const opus = stats.byModel.find((m) => m.model === 'claude-opus-4-5')!;
    assert.strictEqual(opus.sessionCount, 2);
  });

  it('groups by date (YYYY-MM-DD)', () => {
    const stats = aggregateStats([
      e({ timestamp: '2026-04-10T10:00:00Z' }),
      e({ timestamp: '2026-04-10T18:00:00Z' }),
      e({ timestamp: '2026-04-11T09:00:00Z' }),
    ]);
    assert.strictEqual(stats.byDate.length, 2);
  });

  it('filterByTimeRange keeps entries within N days', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 1 * 86400000).toISOString();
    const old = new Date(now.getTime() - 40 * 86400000).toISOString();
    const kept = filterByTimeRange([e({ timestamp: recent }), e({ timestamp: old })], '7d');
    assert.strictEqual(kept.length, 1);
  });

  it('getSessionStats returns sessions sorted newest first', () => {
    const sessions = getSessionStats([
      e({ sessionId: 'a', timestamp: '2026-04-10T10:00:00Z' }),
      e({ sessionId: 'b', timestamp: '2026-04-12T10:00:00Z' }),
    ]);
    assert.strictEqual(sessions[0].sessionId, 'b');
  });
});
```

### Task 13: Aggregator modules

**Files:**
- Create: `src/aggregator/filters.ts`
- Create: `src/aggregator/stats.ts`
- Create: `src/aggregator/sessions.ts`
- Create: `src/aggregator/index.ts`

- [ ] **Step 1: `src/aggregator/filters.ts`**

```ts
import type { TimeRange, UsageEntry } from '../types';

export function filterByTimeRange(entries: UsageEntry[], range: TimeRange): UsageEntry[] {
  if (range === 'all') return entries;
  const days = range === '7d' ? 7 : 30;
  const cutoff = Date.now() - days * 86_400_000;
  return entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

export function projectNameFromPath(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}
```

- [ ] **Step 2: `src/aggregator/stats.ts`**

```ts
import type { DailyUsage, ModelUsage, ProjectUsage, UsageEntry, UsageStats } from '../types';
import { projectNameFromPath } from './filters';

const EMPTY: UsageStats = {
  totalCost: 0, totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0,
  totalCacheCreationTokens: 0, totalCacheReadTokens: 0, totalSessions: 0,
  byModel: [], byDate: [], byProject: [],
};

export function aggregateStats(entries: UsageEntry[]): UsageStats {
  if (entries.length === 0) return { ...EMPTY };

  let totalCost = 0, totalInputTokens = 0, totalOutputTokens = 0;
  let totalCacheCreationTokens = 0, totalCacheReadTokens = 0;
  const allSessions = new Set<string>();

  const models = new Map<string, { m: ModelUsage; sessions: Set<string> }>();
  const dates = new Map<string, { cost: number; tokens: number; models: Set<string> }>();
  const projects = new Map<string, { cost: number; tokens: number; sessions: Set<string>; lastUsed: string; name: string }>();

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

  const byModel = [...models.values()]
    .map(({ m, sessions }) => ({ ...m, sessionCount: sessions.size }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const byDate: DailyUsage[] = [...dates.entries()]
    .map(([date, s]) => ({ date, totalCost: s.cost, totalTokens: s.tokens, modelsUsed: [...s.models] }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byProject: ProjectUsage[] = [...projects.entries()]
    .map(([projectPath, s]) => ({
      projectPath, projectName: s.name, totalCost: s.cost, totalTokens: s.tokens,
      sessionCount: s.sessions.size, lastUsed: s.lastUsed,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    totalCost,
    totalTokens: totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens,
    totalInputTokens, totalOutputTokens, totalCacheCreationTokens, totalCacheReadTokens,
    totalSessions: allSessions.size, byModel, byDate, byProject,
  };
}

function upsertModel(map: Map<string, { m: ModelUsage; sessions: Set<string> }>, e: UsageEntry) {
  let slot = map.get(e.model);
  if (!slot) {
    slot = {
      m: {
        model: e.model, totalCost: 0, totalTokens: 0,
        inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
        sessionCount: 0,
      },
      sessions: new Set(),
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

function upsertDate(
  map: Map<string, { cost: number; tokens: number; models: Set<string> }>,
  e: UsageEntry,
) {
  const date = e.timestamp.slice(0, 10);
  let slot = map.get(date);
  if (!slot) { slot = { cost: 0, tokens: 0, models: new Set() }; map.set(date, slot); }
  slot.cost += e.cost;
  slot.tokens += e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
  slot.models.add(e.model);
}

function upsertProject(
  map: Map<string, { cost: number; tokens: number; sessions: Set<string>; lastUsed: string; name: string }>,
  e: UsageEntry,
) {
  let slot = map.get(e.projectPath);
  if (!slot) {
    slot = { cost: 0, tokens: 0, sessions: new Set(), lastUsed: e.timestamp, name: projectNameFromPath(e.projectPath) };
    map.set(e.projectPath, slot);
  }
  slot.cost += e.cost;
  slot.tokens += e.inputTokens + e.outputTokens + e.cacheCreationTokens + e.cacheReadTokens;
  slot.sessions.add(e.sessionId);
  if (e.timestamp > slot.lastUsed) slot.lastUsed = e.timestamp;
}
```

- [ ] **Step 3: `src/aggregator/sessions.ts`**

```ts
import type { SessionUsage, UsageEntry } from '../types';
import { projectNameFromPath } from './filters';

export function getSessionStats(entries: UsageEntry[]): SessionUsage[] {
  const bySession = new Map<string, { projectPath: string; items: UsageEntry[] }>();
  for (const e of entries) {
    let slot = bySession.get(e.sessionId);
    if (!slot) { slot = { projectPath: e.projectPath, items: [] }; bySession.set(e.sessionId, slot); }
    slot.items.push(e);
  }

  const out: SessionUsage[] = [];
  for (const [sessionId, data] of bySession) {
    const models = new Set<string>();
    let totalCost = 0, inputTokens = 0, outputTokens = 0, cacheCreationTokens = 0, cacheReadTokens = 0;
    let startTime = data.items[0].timestamp;
    for (const e of data.items) {
      models.add(e.model);
      totalCost += e.cost;
      inputTokens += e.inputTokens;
      outputTokens += e.outputTokens;
      cacheCreationTokens += e.cacheCreationTokens;
      cacheReadTokens += e.cacheReadTokens;
      if (e.timestamp < startTime) startTime = e.timestamp;
    }
    out.push({
      sessionId, projectPath: data.projectPath, projectName: projectNameFromPath(data.projectPath),
      totalCost,
      totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
      inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens,
      startTime, modelsUsed: [...models],
    });
  }
  return out.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
```

- [ ] **Step 4: `src/aggregator/index.ts`**

```ts
export { aggregateStats } from './stats';
export { getSessionStats } from './sessions';
export { filterByTimeRange, projectNameFromPath } from './filters';
```

- [ ] **Step 5: Delete old `src/services/logParser.ts` and `src/services/` folder**

```bash
rm -r src/services
```

- [ ] **Step 6: Compile + test**

```bash
npm run compile-tests && npm test
```
Expected: all four test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/aggregator src/services test/aggregator.test.ts
git commit -m "Aggregator module: single-pass stats, split filters/stats/sessions"
```

---

## Phase 7: Webview shared utilities

### Task 14: Webview helpers

**Files:**
- Create: `src/webview/shared/html.ts`
- Create: `src/webview/shared/formatters.ts`
- Create: `src/webview/shared/messaging.ts`

- [ ] **Step 1: `src/webview/shared/html.ts`**

```ts
const AMP = /&/g, LT = /</g, GT = />/g, QUOT = /"/g, APOS = /'/g;

export function escapeHtml(input: string): string {
  return input.replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;').replace(QUOT, '&quot;').replace(APOS, '&#39;');
}

export function escapeAttr(input: string): string {
  return escapeHtml(input);
}

export function nonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function cspMeta(webviewCspSource: string, nonceValue: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webviewCspSource}; script-src 'nonce-${nonceValue}'; img-src ${webviewCspSource} data:;">`;
}
```

- [ ] **Step 2: `src/webview/shared/formatters.ts`**

```ts
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function formatTokensCompact(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
```

- [ ] **Step 3: `src/webview/shared/messaging.ts`**

```ts
import type { TimeRange } from '../../types';

export type WebviewMessage =
  | { command: 'refresh'; timeRange?: TimeRange }
  | { command: 'changeTimeRange'; timeRange: TimeRange }
  | { command: 'openDashboard' };
```

- [ ] **Step 4: Commit**

```bash
git add src/webview/shared
git commit -m "Webview shared helpers: escape, CSP meta, formatters, messaging types"
```

---

## Phase 8: Webview assets (CSS + client JS)

### Task 15: Asset files

**Files:**
- Create: `src/webview/assets/dashboard.css`
- Create: `src/webview/assets/sidebar.css`
- Create: `src/webview/assets/webview.js`

- [ ] **Step 1: `src/webview/assets/dashboard.css`** — copy every CSS rule currently embedded in `src/webview/dashboardPanel.ts`'s `<style>` block verbatim into this file.

- [ ] **Step 2: `src/webview/assets/sidebar.css`** — same for `src/webview/sidebarProvider.ts`'s `<style>` block.

- [ ] **Step 3: `src/webview/assets/webview.js`**

```js
(function () {
  const vscode = acquireVsCodeApi();

  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'changeTimeRange') {
      vscode.postMessage({ command: 'changeTimeRange', timeRange: el.dataset.range });
    } else if (action === 'refresh') {
      vscode.postMessage({ command: 'refresh' });
    } else if (action === 'openDashboard') {
      vscode.postMessage({ command: 'openDashboard' });
    }
  });
})();
```

- [ ] **Step 4: Commit**

```bash
git add src/webview/assets
git commit -m "Move webview CSS + client JS to asset files"
```

---

## Phase 9: Dashboard refactor

### Task 16: Dashboard template

**Files:**
- Create: `src/webview/dashboard/template.ts`

- [ ] **Step 1: Write template (build from existing `dashboardPanel.ts` HTML; every dynamic value goes through `escapeHtml` or `escapeAttr`; inline `style=""` for chart bar heights stays but must carry `nonce`; actually chart bar heights need inline style attrs — inline style _attributes_ on elements are allowed by the style-src CSP policy, so that's fine)**

```ts
import type { UsageStats, SessionUsage, TimeRange } from '../../types';
import { getModelDisplayName } from '../../pricing';
import { escapeHtml, escapeAttr, cspMeta, nonce } from '../shared/html';
import { formatCost, formatTokens, formatDate } from '../shared/formatters';

export function renderDashboard(params: {
  stats: UsageStats;
  sessions: SessionUsage[];
  timeRange: TimeRange;
  cssUri: string;
  jsUri: string;
  cspSource: string;
}): string {
  const { stats, sessions, timeRange, cssUri, jsUri, cspSource } = params;
  const n = nonce();

  const modelRows = stats.byModel.map((m) => `
    <tr>
      <td>${escapeHtml(getModelDisplayName(m.model))}</td>
      <td class="number">${formatCost(m.totalCost)}</td>
      <td class="number">${formatTokens(m.totalTokens)}</td>
      <td class="number">${formatTokens(m.inputTokens)}</td>
      <td class="number">${formatTokens(m.outputTokens)}</td>
      <td class="number">${m.sessionCount}</td>
    </tr>`).join('');

  const projectRows = stats.byProject.slice(0, 10).map((p) => `
    <tr>
      <td title="${escapeAttr(p.projectPath)}">${escapeHtml(p.projectName)}</td>
      <td class="number">${formatCost(p.totalCost)}</td>
      <td class="number">${formatTokens(p.totalTokens)}</td>
      <td class="number">${p.sessionCount}</td>
      <td>${escapeHtml(formatDate(p.lastUsed))}</td>
    </tr>`).join('');

  const sessionRows = sessions.slice(0, 20).map((s) => `
    <tr>
      <td title="${escapeAttr(s.projectPath)}">${escapeHtml(s.projectName)}</td>
      <td class="number">${formatCost(s.totalCost)}</td>
      <td class="number">${formatTokens(s.totalTokens)}</td>
      <td>${escapeHtml(s.modelsUsed.map(getModelDisplayName).join(', '))}</td>
      <td>${escapeHtml(formatDate(s.startTime))}</td>
    </tr>`).join('');

  const chartData = stats.byDate.slice(-30);
  const maxCost = chartData.reduce((acc, d) => Math.max(acc, d.totalCost), 0);
  const chartBars = chartData.map((d) => {
    const heightPct = maxCost > 0 ? (d.totalCost / maxCost) * 100 : 0;
    const h = Math.max(heightPct, 2).toFixed(2);
    return `
      <div class="chart-bar" style="height: ${h}%">
        <div class="tooltip">${escapeHtml(d.date)}<br/>${formatCost(d.totalCost)}</div>
      </div>`;
  }).join('');

  const active = (r: TimeRange) => (timeRange === r ? 'active' : '');

  const empty = stats.totalSessions === 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
${cspMeta(cspSource, n)}
<link rel="stylesheet" href="${escapeAttr(cssUri)}">
<title>Claude Code Usage</title>
</head>
<body>
<div class="header">
  <h1>Claude Code Usage Dashboard</h1>
  <div class="controls">
    <button class="secondary ${active('7d')}" data-action="changeTimeRange" data-range="7d">7 Days</button>
    <button class="secondary ${active('30d')}" data-action="changeTimeRange" data-range="30d">30 Days</button>
    <button class="secondary ${active('all')}" data-action="changeTimeRange" data-range="all">All Time</button>
    <button data-action="refresh">Refresh</button>
  </div>
</div>
${empty ? `
<div class="empty-state">
  <h2>No Usage Data Found</h2>
  <p>No Claude Code session logs found in ~/.claude/projects/</p>
  <p>Start using Claude Code to see your usage statistics here.</p>
</div>
` : `
<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Total Cost</div>
    <div class="value">${formatCost(stats.totalCost)}</div>
    <div class="sub">${stats.totalSessions} sessions</div>
  </div>
  <div class="stat-card">
    <div class="label">Total Tokens</div>
    <div class="value">${formatTokens(stats.totalTokens)}</div>
    <div class="sub">
      <div class="token-breakdown">
        <span class="token-item"><span class="token-dot input"></span>${formatTokens(stats.totalInputTokens)} in</span>
        <span class="token-item"><span class="token-dot output"></span>${formatTokens(stats.totalOutputTokens)} out</span>
      </div>
    </div>
  </div>
  <div class="stat-card">
    <div class="label">Cache Tokens</div>
    <div class="value">${formatTokens(stats.totalCacheCreationTokens + stats.totalCacheReadTokens)}</div>
    <div class="sub">
      <div class="token-breakdown">
        <span class="token-item"><span class="token-dot cache-write"></span>${formatTokens(stats.totalCacheCreationTokens)} write</span>
        <span class="token-item"><span class="token-dot cache-read"></span>${formatTokens(stats.totalCacheReadTokens)} read</span>
      </div>
    </div>
  </div>
  <div class="stat-card">
    <div class="label">Models Used</div>
    <div class="value">${stats.byModel.length}</div>
    <div class="sub">${escapeHtml(stats.byModel.slice(0, 2).map((m) => getModelDisplayName(m.model)).join(', '))}${stats.byModel.length > 2 ? '...' : ''}</div>
  </div>
</div>
<div class="section">
  <h2>Daily Usage (Cost)</h2>
  <div class="chart-container">
    ${chartData.length > 0 ? `<div class="chart">${chartBars}</div>` : '<div class="empty-state">No daily data available</div>'}
  </div>
</div>
<div class="section">
  <h2>Usage by Model</h2>
  <table>
    <thead><tr><th>Model</th><th class="number">Cost</th><th class="number">Total Tokens</th><th class="number">Input</th><th class="number">Output</th><th class="number">Sessions</th></tr></thead>
    <tbody>${modelRows || '<tr><td colspan="6" class="empty-state">No model data</td></tr>'}</tbody>
  </table>
</div>
<div class="section">
  <h2>Usage by Project</h2>
  <table>
    <thead><tr><th>Project</th><th class="number">Cost</th><th class="number">Tokens</th><th class="number">Sessions</th><th>Last Used</th></tr></thead>
    <tbody>${projectRows || '<tr><td colspan="5" class="empty-state">No project data</td></tr>'}</tbody>
  </table>
</div>
<div class="section">
  <h2>Recent Sessions</h2>
  <table>
    <thead><tr><th>Project</th><th class="number">Cost</th><th class="number">Tokens</th><th>Models</th><th>Started</th></tr></thead>
    <tbody>${sessionRows || '<tr><td colspan="5" class="empty-state">No session data</td></tr>'}</tbody>
  </table>
</div>
`}
<script nonce="${n}" src="${escapeAttr(jsUri)}"></script>
</body>
</html>`;
}
```

### Task 17: DashboardPanel class (logic only)

**Files:**
- Create: `src/webview/dashboard/panel.ts`
- Delete: `src/webview/dashboardPanel.ts`

- [ ] **Step 1: Panel**

```ts
import * as vscode from 'vscode';
import type { TimeRange } from '../../types';
import { getAllUsageEntries } from '../../parser';
import { aggregateStats, filterByTimeRange, getSessionStats } from '../../aggregator';
import { renderDashboard } from './template';
import type { WebviewMessage } from '../shared/messaging';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _timeRange: TimeRange = '30d';

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (message.command === 'refresh' || message.command === 'changeTimeRange') {
          if (message.timeRange) this._timeRange = message.timeRange;
          this._update();
        }
      },
      null,
      this._disposables,
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'claudeCodeUsage', 'Claude Code Usage', column ?? vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets')] },
    );
    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  public static refresh() { DashboardPanel.currentPanel?._update(); }

  private _update() {
    const webview = this._panel.webview;
    const entries = getAllUsageEntries();
    const filtered = filterByTimeRange(entries, this._timeRange);
    const stats = aggregateStats(filtered);
    const sessions = getSessionStats(filtered);

    const assetsDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets');
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'dashboard.css')).toString();
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'webview.js')).toString();

    webview.html = renderDashboard({
      stats, sessions, timeRange: this._timeRange,
      cssUri, jsUri, cspSource: webview.cspSource,
    });
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) this._disposables.pop()?.dispose();
  }
}
```

- [ ] **Step 2: Delete old**

```bash
rm src/webview/dashboardPanel.ts
```

- [ ] **Step 3: Compile**

```bash
npm run compile
```
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/webview/dashboard src/webview/dashboardPanel.ts
git commit -m "Dashboard refactor: template module, panel class, CSP + escape"
```

---

## Phase 10: Sidebar refactor

### Task 18: Sidebar template + provider

**Files:**
- Create: `src/webview/sidebar/template.ts`
- Create: `src/webview/sidebar/provider.ts`
- Delete: `src/webview/sidebarProvider.ts`

- [ ] **Step 1: `template.ts`**

```ts
import type { UsageStats, TimeRange } from '../../types';
import { getModelDisplayName } from '../../pricing';
import { escapeHtml, escapeAttr, cspMeta, nonce } from '../shared/html';
import { formatCost, formatTokensCompact } from '../shared/formatters';

export function renderSidebar(params: {
  stats: UsageStats;
  timeRange: TimeRange;
  cssUri: string;
  jsUri: string;
  cspSource: string;
}): string {
  const { stats, timeRange, cssUri, jsUri, cspSource } = params;
  const n = nonce();

  const topModels = stats.byModel.slice(0, 3).map((m) => `
    <div class="model-item">
      <span class="model-name">${escapeHtml(getModelDisplayName(m.model))}</span>
      <span class="model-cost">${formatCost(m.totalCost)}</span>
    </div>`).join('');

  const topProjects = stats.byProject.slice(0, 3).map((p) => `
    <div class="project-item">
      <span class="project-name" title="${escapeAttr(p.projectPath)}">${escapeHtml(p.projectName)}</span>
      <span class="project-cost">${formatCost(p.totalCost)}</span>
    </div>`).join('');

  const active = (r: TimeRange) => (timeRange === r ? 'active' : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
${cspMeta(cspSource, n)}
<link rel="stylesheet" href="${escapeAttr(cssUri)}">
</head>
<body>
<div class="time-filter">
  <button class="time-btn ${active('7d')}" data-action="changeTimeRange" data-range="7d">7D</button>
  <button class="time-btn ${active('30d')}" data-action="changeTimeRange" data-range="30d">30D</button>
  <button class="time-btn ${active('all')}" data-action="changeTimeRange" data-range="all">All</button>
</div>
${stats.totalSessions === 0 ? `
<div class="empty-state">
  <p>No usage data found</p>
  <p class="sub">Start using Claude Code to see stats</p>
</div>
` : `
<div class="stat-card">
  <div class="stat-label">Total Cost</div>
  <div class="stat-value">${formatCost(stats.totalCost)}</div>
  <div class="stat-sub">${stats.totalSessions} sessions</div>
</div>
<div class="stat-card">
  <div class="stat-label">Tokens</div>
  <div class="stat-value">${formatTokensCompact(stats.totalTokens)}</div>
  <div class="token-row">
    <span>In: ${formatTokensCompact(stats.totalInputTokens)}</span>
    <span>Out: ${formatTokensCompact(stats.totalOutputTokens)}</span>
  </div>
  <div class="token-row">
    <span>Cache W: ${formatTokensCompact(stats.totalCacheCreationTokens)}</span>
    <span>Cache R: ${formatTokensCompact(stats.totalCacheReadTokens)}</span>
  </div>
</div>
${stats.byModel.length > 0 ? `<div class="section"><div class="section-title">Top Models</div>${topModels}</div>` : ''}
${stats.byProject.length > 0 ? `<div class="section"><div class="section-title">Top Projects</div>${topProjects}</div>` : ''}
`}
<button class="open-dashboard" data-action="openDashboard">Open Full Dashboard</button>
<script nonce="${n}" src="${escapeAttr(jsUri)}"></script>
</body>
</html>`;
}
```

- [ ] **Step 2: `provider.ts`**

```ts
import * as vscode from 'vscode';
import type { TimeRange } from '../../types';
import { getAllUsageEntries } from '../../parser';
import { aggregateStats, filterByTimeRange } from '../../aggregator';
import { renderSidebar } from './template';
import type { WebviewMessage } from '../shared/messaging';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeCodeUsage';
  private _view?: vscode.WebviewView;
  private _timeRange: TimeRange = '30d';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets')],
    };
    this._update();
    view.webview.onDidReceiveMessage((m: WebviewMessage) => {
      if (m.command === 'refresh') this._update();
      else if (m.command === 'openDashboard') vscode.commands.executeCommand('claude-code-usage.showDashboard');
      else if (m.command === 'changeTimeRange') { this._timeRange = m.timeRange; this._update(); }
    });
  }

  public refresh() { if (this._view) this._update(); }

  private _update() {
    if (!this._view) return;
    const webview = this._view.webview;
    const entries = getAllUsageEntries();
    const stats = aggregateStats(filterByTimeRange(entries, this._timeRange));
    const assetsDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets');
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'sidebar.css')).toString();
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'webview.js')).toString();
    webview.html = renderSidebar({ stats, timeRange: this._timeRange, cssUri, jsUri, cspSource: webview.cspSource });
  }
}
```

- [ ] **Step 3: Delete old**

```bash
rm src/webview/sidebarProvider.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/webview/sidebar src/webview/sidebarProvider.ts
git commit -m "Sidebar refactor: template module, provider class, CSP + escape"
```

---

## Phase 11: Wire extension.ts + final cleanup

### Task 19: Update extension entry

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Rewrite**

```ts
import * as vscode from 'vscode';
import { DashboardPanel } from './webview/dashboard/panel';
import { SidebarProvider } from './webview/sidebar/provider';

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider),
    vscode.commands.registerCommand('claude-code-usage.showDashboard', () => {
      DashboardPanel.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand('claude-code-usage.refreshData', () => {
      DashboardPanel.refresh();
      sidebarProvider.refresh();
      vscode.window.showInformationMessage('Claude Code usage data refreshed');
    }),
  );
}

export function deactivate() {}
```

- [ ] **Step 2: Compile + lint + test**

```bash
npm run compile && npm run lint && npm test
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "Wire new module paths in extension entry"
```

### Task 20: README + package.json touch-up

**Files:**
- Modify: `README.md` (Project Structure section)
- Modify: `package.json` (ensure `activationEvents` covers command palette invocations)

- [ ] **Step 1: Update README project-structure listing to match new layout.**

- [ ] **Step 2: Add `onCommand:claude-code-usage.showDashboard` and `onCommand:claude-code-usage.refreshData` to `activationEvents`** so the palette command activates the extension even when the sidebar is never opened:

```json
"activationEvents": [
  "onView:claudeCodeUsage",
  "onCommand:claude-code-usage.showDashboard",
  "onCommand:claude-code-usage.refreshData"
]
```

- [ ] **Step 3: Verify build**

```bash
npm run package
```
Expected: `dist/extension.js` + `dist/webview/assets/` populated.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "Update project structure docs and activation events"
```

### Task 21: Smoke test

- [ ] **Step 1: Package VSIX**

```bash
npx @vscode/vsce package
```

- [ ] **Step 2: Manual verification**

Install VSIX, confirm:
- Sidebar renders; 7D/30D/All buttons toggle; top models/projects render.
- Dashboard opens via palette; all tables + chart render; refresh works.
- No console errors in DevTools for either webview (CSP clean).
- Cost totals match a known pre-sweep value on the same `~/.claude/projects/` snapshot.

- [ ] **Step 3: If smoke OK, no further commit. If issues, fix and commit separately.**

---

## Self-review notes

- **Spec coverage:** All six problems in the spec are addressed: pricing dedup (Tasks 3–5), XSS+CSP (Tasks 14, 16, 18), monolith split (Tasks 11–13, 16–18), aggregator single-pass (Task 13), cache skip-if-unchanged (Tasks 8, 11), dead code removed (Task 6, 19), dev tooling (Tasks 2, 4, 7, 10, 12).
- **Type consistency check:** `UsageStats`, `UsageEntry`, `SessionUsage` used across tasks match the new `src/types.ts` (Task 6). `CachedData` used in `src/cache.ts` and `isUnchanged` — consistent.
- **Placeholder scan:** No TBD/TODO/"similar to". All code blocks are full.
- **`SessionUsage.endTime`** — removed from the type, not used in any template. Confirmed.
