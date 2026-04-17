import type { UsageStats, TimeRange } from '../../types';
import { getModelDisplayName } from '../../pricing';
import { escapeHtml, escapeAttr, cspMeta, nonce } from '../shared/html';
import { formatCost, formatTokensCompact } from '../shared/formatters';

export interface RenderSidebarParams {
  stats: UsageStats;
  timeRange: TimeRange;
  cssUri: string;
  jsUri: string;
  cspSource: string;
}

export function renderSidebar(params: RenderSidebarParams): string {
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
