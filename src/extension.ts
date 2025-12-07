/**
 * Claude Code Usage - VS Code Extension
 * Tracks and displays Claude Code usage statistics
 */

import * as vscode from 'vscode';
import { DashboardPanel } from './webview/dashboardPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Usage extension is now active');

  // Register command to show the dashboard
  const showDashboardCommand = vscode.commands.registerCommand(
    'claude-code-usage.showDashboard',
    () => {
      DashboardPanel.createOrShow(context.extensionUri);
    }
  );

  // Register command to refresh data
  const refreshDataCommand = vscode.commands.registerCommand(
    'claude-code-usage.refreshData',
    () => {
      DashboardPanel.refresh();
      vscode.window.showInformationMessage('Claude Code usage data refreshed');
    }
  );

  context.subscriptions.push(showDashboardCommand);
  context.subscriptions.push(refreshDataCommand);
}

export function deactivate() {
  // Cleanup if needed
}
