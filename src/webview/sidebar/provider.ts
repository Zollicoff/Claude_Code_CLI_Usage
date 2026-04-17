import * as vscode from 'vscode';
import type { TimeRange } from '../../types';
import { getAllUsageEntries } from '../../parser';
import { aggregateStats, filterByTimeRange } from '../../aggregator';
import { renderSidebar } from './template';
import type { WebviewMessage } from '../shared/messaging';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeCodeUsage';
  private _view?: vscode.WebviewView;
  private _timeRange: TimeRange = '30d';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets')]
    };
    this._update();
    view.webview.onDidReceiveMessage((m: WebviewMessage) => {
      if (m.command === 'refresh') {
        this._update();
      } else if (m.command === 'openDashboard') {
        vscode.commands.executeCommand('claude-code-usage.showDashboard');
      } else if (m.command === 'changeTimeRange') {
        this._timeRange = m.timeRange;
        this._update();
      }
    });
  }

  public refresh() {
    if (this._view) {
      this._update();
    }
  }

  private _update() {
    if (!this._view) {
      return;
    }
    const webview = this._view.webview;
    const entries = getAllUsageEntries();
    const stats = aggregateStats(filterByTimeRange(entries, this._timeRange));
    const assetsDir = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'assets');
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'sidebar.css')).toString();
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'webview.js')).toString();
    webview.html = renderSidebar({
      stats,
      timeRange: this._timeRange,
      cssUri,
      jsUri,
      cspSource: webview.cspSource
    });
  }
}
