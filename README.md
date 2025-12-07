# Claude Code Usage

A Visual Studio Code extension that tracks and displays your Claude Code usage statistics, costs, and analytics directly within VS Code.

## Features

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
   npx vsce package
   ```

5. Install the generated `.vsix` file:
   - Open VS Code
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Extensions: Install from VSIX"
   - Select the generated `.vsix` file

### Development

1. Open the project in VS Code
2. Press `F5` (or `Fn+F5` on macOS) to launch the Extension Development Host
3. In the new window, run the "Claude Code: Show Usage Dashboard" command

## Usage

### Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Claude Code: Show Usage Dashboard` | `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` (Windows/Linux) | Open the usage dashboard |
| `Claude Code: Refresh Usage Data` | - | Refresh the dashboard data |

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
│   ├── extension.ts           # Extension entry point
│   ├── types/
│   │   └── usage.ts           # TypeScript interfaces
│   ├── services/
│   │   ├── logParser.ts       # Log file parsing logic
│   │   └── pricing.ts         # Model pricing calculations
│   └── webview/
│       └── dashboardPanel.ts  # Dashboard UI webview
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript configuration
└── webpack.config.js          # Build configuration
```

## License

MIT

## Related Projects

- [Claude Code Usage Dashboard](https://github.com/Zollicoff/Claude_Code_Usage_Dashboard) - Desktop application version built with Tauri
