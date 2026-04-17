import type { UsageStats, SessionUsage, TimeRange } from '../../types';
import { getModelDisplayName } from '../../pricing';
import { escapeHtml, escapeAttr, cspMeta, nonce } from '../shared/html';
import { formatCost, formatTokens, formatDate } from '../shared/formatters';

export interface RenderDashboardParams {
  stats: UsageStats;
  sessions: SessionUsage[];
  timeRange: TimeRange;
  cssUri: string;
  jsUri: string;
  cspSource: string;
}

export function renderDashboard(params: RenderDashboardParams): string {
  const { stats, sessions, timeRange, cssUri, jsUri, cspSource } = params;
  const n = nonce();
  const empty = stats.totalSessions === 0;

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
  const modelSummary = stats.byModel
    .slice(0, 2)
    .map((m) => getModelDisplayName(m.model))
    .join(', ');

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
    <div class="sub">${escapeHtml(modelSummary)}${stats.byModel.length > 2 ? '...' : ''}</div>
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
