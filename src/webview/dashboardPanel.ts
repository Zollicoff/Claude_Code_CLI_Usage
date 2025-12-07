/**
 * Dashboard webview panel for displaying Claude Code usage statistics
 */

import * as vscode from 'vscode';
import { UsageStats, SessionUsage, TimeRange } from '../types/usage';
import { getAllUsageEntries, filterByTimeRange, aggregateStats, getSessionStats } from '../services/logParser';
import { getModelDisplayName } from '../services/pricing';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refresh':
            await this._update(message.timeRange);
            return;
          case 'changeTimeRange':
            await this._update(message.timeRange);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'claudeCodeUsage',
      'Claude Code Usage',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  public static refresh() {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._update();
    }
  }

  private async _update(timeRange: TimeRange = '30d') {
    const webview = this._panel.webview;

    // Load data
    const allEntries = getAllUsageEntries();
    const filteredEntries = filterByTimeRange(allEntries, timeRange);
    const stats = aggregateStats(filteredEntries);
    const sessions = getSessionStats(filteredEntries);

    this._panel.webview.html = this._getHtmlForWebview(webview, stats, sessions, timeRange);
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    stats: UsageStats,
    sessions: SessionUsage[],
    timeRange: TimeRange
  ): string {
    // Format numbers for display
    const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
    const formatTokens = (tokens: number) => tokens.toLocaleString();
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Generate model rows
    const modelRows = stats.byModel.map(m => `
      <tr>
        <td>${getModelDisplayName(m.model)}</td>
        <td class="number">${formatCost(m.totalCost)}</td>
        <td class="number">${formatTokens(m.totalTokens)}</td>
        <td class="number">${formatTokens(m.inputTokens)}</td>
        <td class="number">${formatTokens(m.outputTokens)}</td>
        <td class="number">${m.sessionCount}</td>
      </tr>
    `).join('');

    // Generate project rows
    const projectRows = stats.byProject.slice(0, 10).map(p => `
      <tr>
        <td title="${p.projectPath}">${p.projectName}</td>
        <td class="number">${formatCost(p.totalCost)}</td>
        <td class="number">${formatTokens(p.totalTokens)}</td>
        <td class="number">${p.sessionCount}</td>
        <td>${formatDate(p.lastUsed)}</td>
      </tr>
    `).join('');

    // Generate session rows
    const sessionRows = sessions.slice(0, 20).map(s => `
      <tr>
        <td title="${s.projectPath}">${s.projectName}</td>
        <td class="number">${formatCost(s.totalCost)}</td>
        <td class="number">${formatTokens(s.totalTokens)}</td>
        <td>${s.modelsUsed.map(m => getModelDisplayName(m)).join(', ')}</td>
        <td>${formatDate(s.startTime)}</td>
      </tr>
    `).join('');

    // Generate daily chart data
    const chartData = stats.byDate.slice(-30).map(d => ({
      date: d.date,
      cost: d.totalCost,
      tokens: d.totalTokens
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Usage</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --accent-color: var(--vscode-button-background);
      --accent-hover: var(--vscode-button-hoverBackground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-primary);
      background: var(--bg-primary);
      padding: 20px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
    }

    .controls {
      display: flex;
      gap: 8px;
    }

    button {
      background: var(--accent-color);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    button:hover {
      background: var(--accent-hover);
    }

    button.secondary {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
    }

    button.active {
      background: var(--accent-color);
      color: var(--vscode-button-foreground);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
    }

    .stat-card .label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .stat-card .value {
      font-size: 28px;
      font-weight: 600;
    }

    .stat-card .sub {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chart-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      height: 200px;
      position: relative;
    }

    .chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 160px;
      padding-top: 20px;
    }

    .chart-bar {
      flex: 1;
      background: var(--accent-color);
      border-radius: 2px 2px 0 0;
      min-width: 8px;
      position: relative;
      transition: opacity 0.2s;
    }

    .chart-bar:hover {
      opacity: 0.8;
    }

    .chart-bar .tooltip {
      display: none;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      z-index: 10;
    }

    .chart-bar:hover .tooltip {
      display: block;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    th {
      background: var(--bg-primary);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover {
      background: var(--bg-primary);
    }

    .number {
      text-align: right;
      font-family: var(--vscode-editor-font-family);
    }

    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
    }

    .tab {
      padding: 8px 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .tab.active {
      background: var(--accent-color);
      color: var(--vscode-button-foreground);
      border-color: var(--accent-color);
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .token-breakdown {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .token-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .token-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .token-dot.input { background: #4CAF50; }
    .token-dot.output { background: #2196F3; }
    .token-dot.cache-write { background: #FF9800; }
    .token-dot.cache-read { background: #9C27B0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Claude Code Usage Dashboard</h1>
    <div class="controls">
      <button class="secondary ${timeRange === '7d' ? 'active' : ''}" onclick="changeTimeRange('7d')">7 Days</button>
      <button class="secondary ${timeRange === '30d' ? 'active' : ''}" onclick="changeTimeRange('30d')">30 Days</button>
      <button class="secondary ${timeRange === 'all' ? 'active' : ''}" onclick="changeTimeRange('all')">All Time</button>
      <button onclick="refresh()">Refresh</button>
    </div>
  </div>

  ${stats.totalSessions === 0 ? `
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
        <div class="sub">${stats.byModel.slice(0, 2).map(m => getModelDisplayName(m.model)).join(', ')}${stats.byModel.length > 2 ? '...' : ''}</div>
      </div>
    </div>

    <div class="section">
      <h2>Daily Usage (Cost)</h2>
      <div class="chart-container">
        ${chartData.length > 0 ? `
          <div class="chart">
            ${chartData.map(d => {
              const maxCost = Math.max(...chartData.map(x => x.cost));
              const height = maxCost > 0 ? (d.cost / maxCost) * 100 : 0;
              return `
                <div class="chart-bar" style="height: ${Math.max(height, 2)}%">
                  <div class="tooltip">${d.date}<br/>${formatCost(d.cost)}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : '<div class="empty-state">No daily data available</div>'}
      </div>
    </div>

    <div class="section">
      <h2>Usage by Model</h2>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th class="number">Cost</th>
            <th class="number">Total Tokens</th>
            <th class="number">Input</th>
            <th class="number">Output</th>
            <th class="number">Sessions</th>
          </tr>
        </thead>
        <tbody>
          ${modelRows || '<tr><td colspan="6" class="empty-state">No model data</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Usage by Project</h2>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th class="number">Cost</th>
            <th class="number">Tokens</th>
            <th class="number">Sessions</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody>
          ${projectRows || '<tr><td colspan="5" class="empty-state">No project data</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Recent Sessions</h2>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th class="number">Cost</th>
            <th class="number">Tokens</th>
            <th>Models</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          ${sessionRows || '<tr><td colspan="5" class="empty-state">No session data</td></tr>'}
        </tbody>
      </table>
    </div>
  `}

  <script>
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh', timeRange: '${timeRange}' });
    }

    function changeTimeRange(range) {
      vscode.postMessage({ command: 'changeTimeRange', timeRange: range });
    }
  </script>
</body>
</html>`;
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
