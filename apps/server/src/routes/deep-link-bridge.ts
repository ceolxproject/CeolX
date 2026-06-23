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

function renderRedirectPage(path: string, token: string, confirmable: boolean): string {
  const safe = escapeHtml(token);
  const deepLink = `ceolx://${path}?token=${safe}`;
  //
  // Ordering matters: the page arms the fallback (below) and THEN fires the deep
  // link via a single `window.location.replace`. Calling replace() during initial
  // parse commits a navigation that halts any inline <script> following it — the
  // old page fired the deep link in an earlier, separate <script>, so on desktop
  // (where ceolx:// has no handler and the navigation aborts) the fallback script
  // was skipped entirely: the app never opened AND verification never ran. A timer
  // armed in the same script *before* replace() survives the aborted navigation.
  // (Asana 1215700058851863)
  //
  // Exactly one auto-trigger (the replace). A <meta http-equiv="refresh"> firing
  // alongside it would deliver the ceolx:// intent twice — and on Android a custom-
  // scheme navigation doesn't unload the page, so the duplicate re-anchors the
  // (auth) splash and bounces the deep-linked screen to sign-in. The visible button
  // is the only manual trigger. (Asana 1215040939202673)
  //
  // Desktop/web fallback (only when `confirmable`): a custom-scheme link can't open
  // the app on a desktop browser, so verification would never run there — the link
  // looks dead and the account stays unverified (Asana 1215700058851863). When the
  // app DID open, launching it backgrounds this tab (visibilitychange → hidden), so
  // we only POST to /<path>/confirm — which completes verification server-side — if
  // the tab was never hidden, i.e. the deep link found no app to hand off to. This
  // keeps the mobile happy path untouched (the app still verifies and gets the
  // auto-sign-in session) while making the link work from any device.
  const fallbackSetup = confirmable
    ? `
      var appOpened = false;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') appOpened = true;
      });
      // Give the deep link time to launch the app and background this tab.
      setTimeout(function () {
        if (appOpened || document.visibilityState !== 'visible') return;
        var card = document.getElementById('card');
        fetch('/${path}/confirm?token=${safe}', { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!card) return;
            card.innerHTML = d && d.verified
              ? '<div class="brand">CEOLX</div><div class="badge">✓</div><h1>Email verified</h1><p>Your CeolX account is now active. Open the app on your phone and sign in to continue.</p>'
              : '<div class="brand">CEOLX</div><h1>Link not valid</h1><p>This verification link has expired or has already been used. Request a new one from the app.</p>';
          })
          .catch(function () {
            if (card) card.innerHTML = '<div class="brand">CEOLX</div><h1>Something went wrong</h1><p>We couldn\\'t verify your email. Please try again from the app.</p>';
          });
      }, 2500);`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Opening CeolX…</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
           background:#080808; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .card { max-width:360px; padding:32px 24px; text-align:center; }
    .brand { letter-spacing:4px; font-weight:800; font-size:16px; color:#A7F46A; margin:0 0 20px; }
    .badge { width:64px; height:64px; margin:0 auto 20px; border-radius:50%; background:#A7F46A;
             color:#080808; display:flex; align-items:center; justify-content:center;
             font-size:34px; font-weight:800; line-height:1; }
    h1 { font-size:22px; margin:0 0 12px; }
    p { font-size:15px; line-height:1.5; opacity:.8; margin:0 0 24px; }
    a.btn { display:inline-block; background:#A7F46A; color:#080808; text-decoration:none;
            padding:14px 24px; border-radius:999px; font-weight:700; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="brand">CEOLX</div>
    <h1>Opening CeolX…</h1>
    <p>If the app doesn't open automatically, tap the button below.</p>
    <a class="btn" href="${deepLink}">Open the CeolX app</a>
  </div>
  <script>
    (function () {${fallbackSetup}
      // Deep link fires LAST so the fallback above is armed first (see fn comment).
      window.location.replace('${deepLink}');
    })();
  </script>
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
    .brand { letter-spacing:4px; font-weight:800; font-size:16px; color:#A7F46A; margin:0 0 20px; }
    h1 { font-size:22px; margin:0 0 12px; }
    p { font-size:15px; line-height:1.5; opacity:.8; }
  </style>
</head>
<body><div class="card"><div class="brand">CEOLX</div><h1>Link not valid</h1><p>${safeMessage}</p></div></body>
</html>`;
}

interface DeepLinkBridgeConfig {
  /** App deep-link path segment, also the HTTPS route path. e.g. 'reset-password' */
  path: string;
  /** <title> shown on the invalid-token error page. */
  errorTitle: string;
  /** User-facing body shown when the token is missing or malformed. */
  errorBody: string;
  /**
   * Optional server-side completion of the flow, used as a desktop/web fallback.
   *
   * When set, the bridge exposes `POST /<path>/confirm` and the redirect page
   * calls it if the deep link didn't open the app (e.g. the link was opened on
   * a desktop browser). Return `true` when the token was accepted. Used by email
   * verification — where clicking the link should mark the account verified on
   * any device — but NOT by reset-password, which requires the user to enter a
   * new password inside the app. (Asana 1215700058851863)
   */
  confirm?: (token: string) => Promise<boolean>;
}

export function createDeepLinkBridge(config: DeepLinkBridgeConfig): Hono {
  const bridge = new Hono();
  const confirmable = typeof config.confirm === 'function';

  bridge.get(`/${config.path}`, (c) => {
    const token = c.req.query('token') ?? '';

    c.header('Cache-Control', 'no-store');
    c.header(
      'Content-Security-Policy',
      // `connect-src 'self'` is only needed for the confirm fetch on confirmable
      // flows; keep it off everything else so the policy stays as tight as possible.
      `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'${
        confirmable ? "; connect-src 'self'" : ''
      }`
    );

    if (!token || !TOKEN_ALLOWED.test(token)) {
      return c.html(renderErrorPage(config.errorTitle, config.errorBody), 400);
    }

    return c.html(renderRedirectPage(config.path, token, confirmable), 200);
  });

  // Desktop/web fallback target. The redirect page POSTs here only when the app
  // didn't take over the deep link. Verification runs server-side so the account
  // is marked verified regardless of the device the link was opened on.
  if (config.confirm) {
    const confirm = config.confirm;
    bridge.post(`/${config.path}/confirm`, async (c) => {
      const token = c.req.query('token') ?? '';
      c.header('Cache-Control', 'no-store');

      if (!token || !TOKEN_ALLOWED.test(token)) {
        return c.json({ verified: false }, 400);
      }

      const verified = await confirm(token).catch(() => false);
      return c.json({ verified });
    });
  }

  return bridge;
}
