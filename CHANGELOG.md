# Changelog

All notable changes to this extension are documented here.

## 0.1.4 — 2026-04-16

### Added
- Claude Opus 4.7 pricing (input $5 / output $25 / cache write $6.25 / cache read $0.50 per million tokens).
- Claude Opus 4.6 pricing (same tier as 4.5 and 4.7).
- Claude Sonnet 4.6 pricing (input $3 / output $15 / cache write $3.75 / cache read $0.30).
- Tests covering 4.7 / 4.6 matching and cost calculation.

### Fixed
- `tsconfig.test.json` now defines its own `exclude` so `test/**/*.ts` actually compiles when `out/` is clean.

## 0.1.3 — 2026-04-16

### Security
- Escaped all user-controlled values (project paths, model names, session IDs) in both the dashboard and sidebar webviews.
- Added a strict Content Security Policy with a per-render nonce on both webviews; inline scripts eliminated and client JS loaded as an asset via `asWebviewUri`.

### Changed
- Restructured `src/` into focused modules: `pricing/`, `parser/`, `aggregator/`, `cache.ts`, `types.ts`, and `webview/` with `shared/`, `dashboard/`, `sidebar/`, and `assets/` folders. No file larger than ~160 LOC.
- Table-driven pricing: single `MODELS` array in `src/pricing/models.ts` is the source of truth for both cost calculation and display names.
- `aggregateStats` rewritten as a single pass with small `upsertModel` / `upsertDate` / `upsertProject` helpers.
- JSONL file sort now uses `mtime` instead of reading the first lines of every file.
- Cache no longer rewrites to disk when the merged entry list matches the previous one.
- Webview CSS and client JS moved from inline strings to asset files bundled via `copy-webpack-plugin`.
- Activation events now include `onCommand:*` so palette invocations activate the extension even when the sidebar is closed.

### Removed
- Unused `DashboardState` interface.
- Unused `SessionUsage.endTime` field.
- Startup `console.log` from the activation handler.

### Tooling
- Added `eslint.config.js` (flat config).
- Added a Mocha unit-test harness with fixture-based tests for pricing, cache, parser, and aggregator (25 tests).
- Tightened `.vscodeignore` so the VSIX no longer ships tests, docs, or dev configs.

## 0.1.2

- Add persistent cache for historical usage data.
- Add marketplace link to README.

## 0.1.1

- Rename to Claude Code CLI Usage.

## 0.1.0

- Initial release.
