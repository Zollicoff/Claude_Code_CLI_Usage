import * as vscode from 'vscode';
import type { TimeRange } from '../../types';
import { getAllUsageEntries } from '../../parser';
import { aggregateStats, filterByTimeRange, getSessionStats } from '../../aggregator';
import { renderDashboard } from './template';
import type { WebviewMessage } from '../shared/messaging';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _timeRange: TimeRange = '30d';

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (message.command === 'refresh' || message.command === 'changeTimeRange') {
          if (message.timeRange) {
            this._timeRange = message.timeRange;
          }
          this._update();
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'claudeCodeUsage',
      'Claude Code Usage',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets')]
      }
    );
    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  public static refresh() {
    DashboardPanel.currentPanel?._update();
  }

  private _update() {
    const webview = this._panel.webview;
    const entries = getAllUsageEntries();
    const filtered = filterByTimeRange(entries, this._timeRange);
    const stats = aggregateStats(filtered);
    const sessions = getSessionStats(filtered);

    const assetsDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets');
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'dashboard.css')).toString();
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'webview.js')).toString();

    webview.html = renderDashboard({
      stats,
      sessions,
      timeRange: this._timeRange,
      cssUri,
      jsUri,
      cspSource: webview.cspSource
    });
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}
