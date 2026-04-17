(function () {
  const vscode = acquireVsCodeApi();

  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-action]');
    if (!el) { return; }
    const action = el.dataset.action;
    if (action === 'changeTimeRange') {
      vscode.postMessage({ command: 'changeTimeRange', timeRange: el.dataset.range });
    } else if (action === 'refresh') {
      vscode.postMessage({ command: 'refresh' });
    } else if (action === 'openDashboard') {
      vscode.postMessage({ command: 'openDashboard' });
    }
  });
})();
