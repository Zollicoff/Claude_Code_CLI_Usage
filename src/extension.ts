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
    })
  );
}

export function deactivate() {}
