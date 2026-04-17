# Cleanup Sweep — Design

Date: 2026-04-16

## Goals

- No user-visible behavior change.
- Clear module boundaries; no file larger than ~200 LOC after the sweep.
- Webviews safe from XSS; strict Content Security Policy.
- Table-driven pricing (one source of truth for model info).
- Decomposed aggregator; smaller, testable helpers.
- Webview HTML/CSS/JS split into loadable assets via `webview.asWebviewUri`.
- ESLint config restored; minimal test harness with fixture-based tests for pure logic.
- Dead code deleted.

## Non-goals

- No new features; no UI redesign.
- Cache file stays on-disk-compatible (`version: 1`).
- No changes to `package.json` `name`/`publisher`/`displayName`/icon.
- No dep bumps unless required to make the rest compile.

## Problems observed (root causes, not symptoms)

1. **Pricing logic duplicated three ways.** `getModelPricing` and `getModelDisplayName` each carry a parallel 40-line if-chain over the same set of model name fragments, while the pricing table itself is a third list. Adding a model requires editing three places; it's easy to drift.
2. **XSS vector.** `cwd` from JSONL, project folder names, model strings, and session IDs flow from user-controlled files into webview HTML via template literals without escaping. No CSP is set on either webview.
3. **555-line dashboard.** `dashboardPanel.ts` embeds all HTML, CSS, and client JS inline. `sidebarProvider.ts` repeats the same pattern. Both duplicate `formatCost`/`formatTokens`, time-filter UI, message plumbing, and stat-card styles.
4. **Monolithic aggregator.** `aggregateStats` is 150 lines that build model/date/project maps inline and then run a second pass just to count sessions per model — that pass can fold into the first.
5. **Cache I/O waste.** `getAllUsageEntries` rewrites the entire cache file on every refresh, and `getFirstTimestamp` reads every JSONL's first 10 lines just to sort files for deduplication.
6. **Dead code / stale config.** `DashboardState` interface unused. `SessionUsage.endTime` computed but never displayed. Activation `console.log`. `pretest`/`test` scripts and `@types/mocha` dep present, but no `eslint.config.js` and no tests exist.

## Target module layout

```
src/
├── extension.ts
├── types.ts                       # DashboardState removed
├── pricing/
│   ├── models.ts                  # single model table (id, patterns, display, prices)
│   ├── calculator.ts              # calculateCost
│   └── index.ts                   # matchModel + getModelDisplayName + re-exports
├── parser/
│   ├── files.ts                   # findJsonlFiles (flat, not recursive)
│   ├── jsonl.ts                   # parseJsonlFile
│   └── index.ts                   # getLiveUsageEntries + getAllUsageEntries
├── aggregator/
│   ├── filters.ts                 # filterByTimeRange
│   ├── stats.ts                   # aggregateStats (single pass, smaller helpers)
│   ├── sessions.ts                # getSessionStats
│   └── index.ts
├── cache.ts
└── webview/
    ├── shared/
    │   ├── html.ts                # escape(), nonce(), cspMeta()
    │   ├── formatters.ts          # formatCost/formatTokens/formatDate
    │   └── messaging.ts           # WebviewMessage union types
    ├── dashboard/
    │   ├── panel.ts               # DashboardPanel class (logic only)
    │   └── template.ts            # renderDashboard(...)
    ├── sidebar/
    │   ├── provider.ts            # SidebarProvider (logic only)
    │   └── template.ts
    └── assets/
        ├── dashboard.css
        ├── sidebar.css
        └── webview.js             # client-side message dispatch
test/
├── fixtures/
│   ├── session-opus.jsonl
│   ├── session-sonnet.jsonl
│   └── cache-v1.json
├── pricing.test.ts
├── cache.test.ts
├── parser.test.ts
└── aggregator.test.ts
```

## Design details

### Pricing (single source of truth)

One ordered array of model descriptors. `matchModel(raw)` walks the array and returns the first descriptor whose `patterns` match. `calculateCost` and `getModelDisplayName` both consume that result. Adding a model means adding one entry.

```ts
// pricing/models.ts
export interface ModelDescriptor {
  id: string;
  displayName: string;
  patterns: string[]; // substrings to match (already lowercased)
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const MODELS: readonly ModelDescriptor[] = [/* ordered most-specific first */];
```

Order matters (Opus 4.5 before Opus 4, etc.) — documented inline as a single short comment on the array.

### Webview safety

- All dynamic values (`model`, `projectPath`, `projectName`, `sessionId`, timestamps) pass through `escapeHtml`.
- `escapeAttr` used for values interpolated into attribute contexts (e.g. `title="..."`).
- Strict CSP meta tag on both webviews: `default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-<nonce>'; img-src ${webview.cspSource} data:;`
- Inline `<script>` replaced with external `webview.js` loaded via `asWebviewUri`, carrying a `nonce`.
- CSS moved to external files loaded via `asWebviewUri`.

### Aggregator (single pass)

`aggregateStats` now:

- Tracks model-sessions via `Map<model, Set<sessionId>>` during the main loop (kills the second pass).
- Private helpers: `upsertModel`, `upsertDate`, `upsertProject` — each ~10 lines, each testable.

### Cache

- `saveCache` short-circuits when the live merge produced no new entries and the cache already exists (compare entry count + last timestamp).
- Replace `getFirstTimestamp`-per-file (reads every JSONL just to sort) with sort by `fs.statSync(...).mtimeMs`. Deduplication keys use `message.id + requestId`, which are unique regardless of sort order — so the sort is only about stability of which entry wins on tie. `mtime` is stable enough and free.
- `findJsonlFiles` becomes non-recursive. Claude Code stores `~/.claude/projects/<encoded>/*.jsonl` flat; recursion was unused depth.

### Dead code removed

- `DashboardState` interface in `types.ts`.
- `SessionUsage.endTime` field (unused by any view).
- `console.log('Claude Code Usage extension is now active')`.
- `@types/mocha` gets kept since we are adding Mocha tests.

### Dev tooling

- Add `eslint.config.js` (flat config): TypeScript + recommended + `no-unused-vars` + `no-console` warn (allow in `cache.ts` error paths via inline `// eslint-disable-next-line`).
- Add `.vscode-test.mjs` pointing at compiled test output.
- Tests use Mocha + Node `assert`. Fixtures under `test/fixtures/` are tiny hand-authored JSONL samples covering: normal entries, duplicate `message.id+requestId`, missing `usage`, `costUSD` override, unknown model. No VS Code API is touched by these tests (they run `parser` / `pricing` / `cache` / `aggregator` directly).

## Testing strategy

- **Unit (pure logic)** — `pricing.test.ts`, `cache.test.ts`, `parser.test.ts`, `aggregator.test.ts`. Table-driven where it fits (pricing).
- **Manual smoke** — build VSIX, install, open sidebar + dashboard, toggle time ranges, confirm output matches pre-sweep numbers on a real `~/.claude/projects/` snapshot.

## Rollout

One PR, several commits:

1. Scaffold (folders, empty index files, tsconfig/webpack updates).
2. Extract + table-drive pricing.
3. Split parser; non-recursive find; mtime sort.
4. Split aggregator; single-pass stats.
5. Webview shared utils (escape, CSP, formatters).
6. Move dashboard HTML/CSS/JS to template + assets.
7. Move sidebar HTML/CSS/JS to template + assets.
8. Cache skip-if-unchanged.
9. Delete dead code.
10. ESLint config + tests + fixtures.
11. Smoke test + README update (project-structure section only).

## Risks

- **Webpack asset copy.** Moving CSS/JS into `webview/assets/` requires either `copy-webpack-plugin` or using `webpack`'s `asset/resource` via imports. Plan: use `copy-webpack-plugin` — one devDep, minimal config change, most portable. Pinned to a known-good version.
- **CSP breaks inline styles/scripts.** Every inline `onclick`, `<style>`, inline `<script>` must be converted. Caught by smoke test.
- **Sort change could shift which duplicate wins.** Dedup key is `message.id+requestId`, which is unique per API call, so the "winner" is the same regardless of file sort order. Low risk.
