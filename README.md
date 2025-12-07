# Claude Code Usage

A Visual Studio Code extension that tracks and displays your Claude Code usage statistics, costs, and analytics directly within VS Code.

## Features

- **Sidebar Panel**: Quick access usage overview right in the activity bar
- **Full Dashboard**: Detailed analytics in a dedicated panel
- **Real-time Cost Monitoring**: Track your spending across all Claude API calls
- **Token Consumption Breakdown**: View detailed breakdowns of input, output, and cache tokens
- **Multi-perspective Analysis**: Analyze usage by model, project, session, or timeline
- **Time Range Filtering**: Filter data by 7 days, 30 days, or all-time
- **Daily Usage Charts**: Visualize your usage patterns over time
- **Session Tracking**: View individual session statistics and costs

## Supported Models

The extension supports cost calculation for all Claude model variants:

- **Opus**: 4.5, 4.1, 4, 3
- **Sonnet**: 4.5, 4, 3.7, 3.5
- **Haiku**: 4.5, 3.5, 3

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Search for "Claude Code Usage"
4. Click Install

### From VSIX File

1. Download the `.vsix` file from [Releases](https://github.com/Zollicoff/Claude_Code_Usage_VSC_Extension/releases)
2. Open VS Code
3. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded `.vsix` file

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/Zollicoff/Claude_Code_Usage_VSC_Extension.git
   cd Claude_Code_Usage_VSC_Extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Package the extension:
   ```bash
   npx @vscode/vsce package
   ```

5. Install the generated `.vsix` file via the method above

## Usage

### Sidebar Panel

Click the chart icon in the activity bar (left sidebar) to open the usage overview panel. This compact view shows:

- Total cost and session count
- Token breakdown (input/output/cache)
- Top 3 models by cost
- Top 3 projects by cost
- Quick time range filter (7D/30D/All)

### Full Dashboard

For detailed analytics, open the full dashboard:

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Claude Code: Show Usage Dashboard` | `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` (Windows/Linux) | Open the full dashboard |
| `Claude Code: Refresh Usage Data` | - | Refresh all usage data |

You can also click "Open Full Dashboard" from the sidebar panel.

### Dashboard Sections

**Overview Cards**
- Total cost across all sessions
- Total token consumption with input/output breakdown
- Cache token usage (read/write)
- Number of models used

**Daily Usage Chart**
- Visual representation of daily costs over the selected time period

**Usage by Model**
- Cost and token breakdown per Claude model variant
- Session count per model

**Usage by Project**
- Cost and token usage grouped by project
- Session count and last used timestamp

**Recent Sessions**
- Individual session details
- Models used per session
- Session timestamps

## How It Works

The extension reads Claude Code session logs from `~/.claude/projects/`. Each project folder contains session data in JSONL format, which includes:

- Timestamps
- Model information
- Token usage (input, output, cache creation, cache read)
- Cost data (when available)

If cost data is not present in the logs, the extension calculates costs based on current Anthropic API pricing.

## Data Privacy

All data processing happens locally on your machine. The extension:

- Only reads files from your local `~/.claude/projects/` directory
- Does not send any data to external servers
- Does not require any API keys or authentication

## Requirements

- Visual Studio Code 1.85.0 or higher
- Claude Code installed with session logs in `~/.claude/projects/`

## Project Structure

```
.
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── types/
│   │   └── usage.ts              # TypeScript interfaces
│   ├── services/
│   │   ├── logParser.ts          # Log file parsing logic
│   │   └── pricing.ts            # Model pricing calculations
│   └── webview/
│       ├── dashboardPanel.ts     # Full dashboard webview
│       └── sidebarProvider.ts    # Sidebar panel webview
├── media/
│   └── icon.svg                  # Activity bar icon
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
└── webpack.config.js             # Build configuration
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Projects

- [Claude Code Usage Dashboard](https://github.com/Zollicoff/Claude_Code_Usage_Dashboard) - Desktop application version built with Tauri
