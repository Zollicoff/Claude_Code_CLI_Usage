const AMP = /&/g, LT = /</g, GT = />/g, QUOT = /"/g, APOS = /'/g;

export function escapeHtml(input: string): string {
  return input
    .replace(AMP, '&amp;')
    .replace(LT, '&lt;')
    .replace(GT, '&gt;')
    .replace(QUOT, '&quot;')
    .replace(APOS, '&#39;');
}

export function escapeAttr(input: string): string {
  return escapeHtml(input);
}

export function nonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export function cspMeta(webviewCspSource: string, nonceValue: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webviewCspSource}; script-src 'nonce-${nonceValue}'; img-src ${webviewCspSource} data:;">`;
}
