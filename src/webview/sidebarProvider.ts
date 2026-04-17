/**
 * Sidebar webview provider for Claude Code Usage
 * Shows a compact usage summary in the sidebar
 */

import * as vscode from 'vscode';
import { UsageStats, TimeRange } from '../types';
import { getAllUsageEntries } from '../parser';
import { filterByTimeRange, aggregateStats } from '../aggregator';
import { getModelDisplayName } from '../pricing';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeCodeUsage';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    this._update();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'refresh':
          this._update();
          break;
        case 'openDashboard':
          vscode.commands.executeCommand('claude-code-usage.showDashboard');
          break;
        case 'changeTimeRange':
          this._update(message.timeRange);
          break;
      }
    });
  }

  public refresh() {
    if (this._view) {
      this._update();
    }
  }

  private _update(timeRange: TimeRange = '30d') {
    if (!this._view) {
      return;
    }

    const allEntries = getAllUsageEntries();
    const filteredEntries = filterByTimeRange(allEntries, timeRange);
    const stats = aggregateStats(filteredEntries);

    this._view.webview.html = this._getHtmlForWebview(stats, timeRange);
  }

  private _getHtmlForWebview(stats: UsageStats, timeRange: TimeRange): string {
    const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
    const formatTokens = (tokens: number) => {
      if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
      }
      if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
      }
      return tokens.toString();
    };

    const topModels = stats.byModel.slice(0, 3).map(m =>
      `<div class="model-item">
        <span class="model-name">${getModelDisplayName(m.model)}</span>
        <span class="model-cost">${formatCost(m.totalCost)}</span>
      </div>`
    ).join('');

    const topProjects = stats.byProject.slice(0, 3).map(p =>
      `<div class="project-item">
        <span class="project-name" title="${p.projectPath}">${p.projectName}</span>
        <span class="project-cost">${formatCost(p.totalCost)}</span>
      </div>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 12px;
      line-height: 1.4;
    }

    .time-filter {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
    }

    .time-btn {
      flex: 1;
      padding: 4px 8px;
      font-size: 11px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }

    .time-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .time-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .stat-card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .stat-sub {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .section {
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .model-item, .project-item {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 12px;
    }

    .model-item:last-child, .project-item:last-child {
      border-bottom: none;
    }

    .model-name, .project-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 60%;
    }

    .model-cost, .project-cost {
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
    }

    .open-dashboard {
      width: 100%;
      padding: 8px;
      margin-top: 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .open-dashboard:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
    }

    .token-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="time-filter">
    <button class="time-btn ${timeRange === '7d' ? 'active' : ''}" onclick="changeTimeRange('7d')">7D</button>
    <button class="time-btn ${timeRange === '30d' ? 'active' : ''}" onclick="changeTimeRange('30d')">30D</button>
    <button class="time-btn ${timeRange === 'all' ? 'active' : ''}" onclick="changeTimeRange('all')">All</button>
  </div>

  ${stats.totalSessions === 0 ? `
    <div class="empty-state">
      <p>No usage data found</p>
      <p style="font-size: 11px; margin-top: 8px;">Start using Claude Code to see stats</p>
    </div>
  ` : `
    <div class="stat-card">
      <div class="stat-label">Total Cost</div>
      <div class="stat-value">${formatCost(stats.totalCost)}</div>
      <div class="stat-sub">${stats.totalSessions} sessions</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Tokens</div>
      <div class="stat-value">${formatTokens(stats.totalTokens)}</div>
      <div class="token-row">
        <span>In: ${formatTokens(stats.totalInputTokens)}</span>
        <span>Out: ${formatTokens(stats.totalOutputTokens)}</span>
      </div>
      <div class="token-row">
        <span>Cache W: ${formatTokens(stats.totalCacheCreationTokens)}</span>
        <span>Cache R: ${formatTokens(stats.totalCacheReadTokens)}</span>
      </div>
    </div>

    ${stats.byModel.length > 0 ? `
      <div class="section">
        <div class="section-title">Top Models</div>
        ${topModels}
      </div>
    ` : ''}

    ${stats.byProject.length > 0 ? `
      <div class="section">
        <div class="section-title">Top Projects</div>
        ${topProjects}
      </div>
    ` : ''}
  `}

  <button class="open-dashboard" onclick="openDashboard()">Open Full Dashboard</button>

  <script>
    const vscode = acquireVsCodeApi();

    function changeTimeRange(range) {
      vscode.postMessage({ command: 'changeTimeRange', timeRange: range });
    }

    function openDashboard() {
      vscode.postMessage({ command: 'openDashboard' });
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }
  </script>
</body>
</html>`;
  }
}
