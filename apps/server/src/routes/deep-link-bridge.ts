import { Hono } from 'hono';

/**
 * Factory for an HTTPS "deep-link bridge" route.
 *
 * Email clients (Gmail web, Outlook, many mobile clients) strip or disable
 * custom-scheme hrefs like `ceolx://...`, so transactional emails point at an
 * HTTPS route here instead. That route returns a tiny HTML page that redirects
 * to `ceolx://<path>?token=...`, where the mobile app picks the token up via
 * expo-linking. One factory serves every flow that needs this bounce
 * (email verification, password reset, ...).
 */

// BetterAuth tokens are URL-safe (base64url + JWT shape). Reject anything
// outside this allowlist so the rendered HTML can never carry an XSS payload.
const TOKEN_ALLOWED = /^[A-Za-z0-9._~+/=-]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRedirectPage(path: string, token: string): string {
  const safe = escapeHtml(token);
  const deepLink = `ceolx://${path}?token=${safe}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Opening CeolX…</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#080808; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .card { max-width:360px; padding:32px 24px; text-align:center; }
    h1 { font-size:22px; margin:0 0 12px; }
    p { font-size:15px; line-height:1.5; opacity:.8; margin:0 0 24px; }
    a.btn { display:inline-block; background:#A7F46A; color:#080808; text-decoration:none;
            padding:14px 24px; border-radius:999px; font-weight:700; }
    a.small { color:#A7F46A; font-size:13px; text-decoration:none; display:inline-block; margin-top:18px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Opening CeolX…</h1>
    <p>If the app doesn't open automatically, tap the button below.</p>
    <a class="btn" href="${deepLink}">Open the CeolX app</a>
    <div><a class="small" href="${deepLink}">${deepLink}</a></div>
  </div>
  <script>window.location.href = '${deepLink}';</script>
</body>
</html>`;
}

function renderErrorPage(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#080808; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .card { max-width:360px; padding:32px 24px; text-align:center; }
    h1 { font-size:22px; margin:0 0 12px; }
    p { font-size:15px; line-height:1.5; opacity:.8; }
  </style>
</head>
<body><div class="card"><h1>Link not valid</h1><p>${safeMessage}</p></div></body>
</html>`;
}

interface DeepLinkBridgeConfig {
  /** App deep-link path segment, also the HTTPS route path. e.g. 'reset-password' */
  path: string;
  /** <title> shown on the invalid-token error page. */
  errorTitle: string;
  /** User-facing body shown when the token is missing or malformed. */
  errorBody: string;
}

export function createDeepLinkBridge(config: DeepLinkBridgeConfig): Hono {
  const bridge = new Hono();

  bridge.get(`/${config.path}`, (c) => {
    const token = c.req.query('token') ?? '';

    c.header('Cache-Control', 'no-store');
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    );

    if (!token || !TOKEN_ALLOWED.test(token)) {
      return c.html(renderErrorPage(config.errorTitle, config.errorBody), 400);
    }

    return c.html(renderRedirectPage(config.path, token), 200);
  });

  return bridge;
}
