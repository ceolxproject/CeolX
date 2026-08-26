import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';

import { buildCheckoutSessionForVenue } from '@CeolX/api/routers/stripe';
import { resolveActivationToken } from '@CeolX/api/services/activation-token';
import { ServerAnalyticsEvent, captureServerEvent } from '@CeolX/api/services/analytics';
import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { venueProfiles } from '@CeolX/db/schema/users';
import { ACTIVATION_RETURN_PATHS } from '@CeolX/shared';
import { activateQuerySchema } from '@CeolX/shared/validators';

/**
 * GET /activate?token=…&plan=monthly|annual — the venue's route into Stripe.
 *
 * This is the only path to payment (M8-T0 D-16): no price, URL or checkout button
 * exists anywhere in the mobile app, which is what keeps the flow compliant on both
 * stores in every country without a special entitlement.
 *
 * On a valid token it 302s straight to Stripe (D-60) — there is no page of our own
 * to build, and no login step, which matters because Google/Apple sign-ups have no
 * password to log in with (D-19). Only the failure states need markup.
 *
 * ⚠️ `/activate` must NEVER be added to LINK_PATH_GLOBS in routes/app-links.ts or to
 * `intentFilters` in apps/native/app.config.js. Both are correctly scoped to
 * /post, /event and /u today. Widening either to `/*` would make this link open the
 * APP instead of the payment page, silently breaking the only route into billing.
 */

const activateRoute = new Hono();

/**
 * Bucket for activation failures that cannot be tied to an account.
 *
 * A malformed or superseded token resolves to no user, and inventing one per request
 * would spray single-event people across the project and make the funnel unreadable.
 */
const ANONYMOUS_DISTINCT_ID = 'anonymous-activation';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal self-contained page for the terminal states.
 *
 * No external assets and a tight CSP: this page is reached from an email client,
 * often in an in-app browser, and it must render identically with nothing else
 * loaded. Nothing interpolated here is attacker-controlled — the token never
 * reaches the output — but it is escaped anyway so that stays true if someone
 * later adds a dynamic field.
 */
function renderPage(title: string, body: string, actionLabel?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — CeolX</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#fafafa; color:#18181b; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#09090b; color:#fafafa; } }
  main { max-width:420px; text-align:center; }
  h1 { font-size:22px; margin:0 0 12px; }
  p { font-size:16px; line-height:24px; margin:0 0 8px; color:#52525b; }
  @media (prefers-color-scheme: dark) { p { color:#a1a1aa; } }
  .hint { font-size:14px; margin-top:20px; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
  ${actionLabel ? `<p class="hint">${escapeHtml(actionLabel)}</p>` : ''}
</main>
</body>
</html>`;
}

/** Terminal states never carry a Location header, so they must not be cached. */
function page(
  c: Context,
  status: 200 | 400 | 410 | 500,
  title: string,
  body: string,
  hint?: string
) {
  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('Cache-Control', 'no-store');
  // No inline scripts and no external anything — this page needs neither.
  c.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  c.header('Referrer-Policy', 'no-referrer');
  return c.body(renderPage(title, body, hint), status);
}

activateRoute.get('/activate', async (c) => {
  // Validate at the boundary. A malformed token is rejected before it reaches a
  // query or any rendered output (the shared schema restricts it to base64url).
  const parsed = activateQuerySchema.safeParse({
    token: c.req.query('token'),
    plan: c.req.query('plan'),
  });

  if (!parsed.success) {
    return page(
      c,
      400,
      'That link looks wrong',
      'This activation link is malformed or incomplete.',
      'Open the most recent activation email from CeolX, or request a new one from the app.'
    );
  }

  // Everything below is wrapped: app.onError returns a JSON envelope and
  // app.notFound a JSON 404, both of which would be nonsense for a page a venue
  // owner opens from their inbox.
  try {
    const resolution = await resolveActivationToken(parsed.data.token);

    // The funnel step between "we emailed a link" and "Stripe rendered a checkout".
    //
    // A failure here has no user to attribute to — `resolveActivationToken` returns a
    // bare status for expired and invalid tokens by design, and `invalid` has no row at
    // all. Rather than widen that union (and the four tests that assert its exact shape)
    // for an analytics nicety, failures are bucketed anonymously and carry the reason.
    // The question these answer is "how many opens fail, and why", which is a count —
    // only the successful open needs to join to a person, and it does.
    if (resolution.status === 'valid') {
      captureServerEvent(ServerAnalyticsEvent.ACTIVATION_LINK_OPENED, resolution.userId, {
        plan: parsed.data.plan,
      });
    } else {
      captureServerEvent(ServerAnalyticsEvent.ACTIVATION_FAILED, ANONYMOUS_DISTINCT_ID, {
        reason: resolution.status,
        plan: parsed.data.plan,
      });
    }

    if (resolution.status === 'expired') {
      return page(
        c,
        410,
        'This link has expired',
        'Activation links are short-lived for security.',
        'Open CeolX and tap Activate Profile to get a fresh link.'
      );
    }

    if (resolution.status === 'consumed') {
      return page(
        c,
        200,
        'Already activated',
        'This link has already been used and your subscription is set up.',
        'Open CeolX — your profile is live.'
      );
    }

    if (resolution.status === 'invalid') {
      // Covers both "never existed" and "superseded by a newer email" — kept
      // indistinguishable so nothing leaks about which tokens exist.
      return page(
        c,
        400,
        'This link is no longer valid',
        'It may have been replaced by a newer activation email.',
        'Use the most recent email from CeolX, or request a new link from the app.'
      );
    }

    const [profile] = await db
      .select({ id: venueProfiles.id })
      .from(venueProfiles)
      .where(eq(venueProfiles.userId, resolution.userId))
      .limit(1);

    const [account] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, resolution.userId))
      .limit(1);

    if (!profile || !account?.email) {
      return page(
        c,
        400,
        'We could not find that venue',
        'The account behind this link no longer has a venue profile.',
        'Please contact support if this is unexpected.'
      );
    }

    const { url } = await buildCheckoutSessionForVenue({
      userId: resolution.userId,
      venueId: profile.id,
      email: account.email,
      interval: parsed.data.plan,
      // Carried to Stripe so the webhook can consume the token once payment
      // succeeds (D-17), rather than here where D-24 requires it to stay reusable.
      activationTokenId: resolution.tokenId,
    });

    // The token is NOT consumed here. D-24 requires a venue who opens this and
    // closes the tab to be able to come back — consumption happens once payment
    // actually succeeds, driven by the Stripe webhook (M8-T3).
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    return c.redirect(url, 302);
  } catch (err) {
    // A venue already subscribed lands here via CONFLICT from the shared guard.
    // Reported as success rather than an error: from their side, there is nothing
    // wrong — they are already paying.
    const code = (err as { code?: string })?.code;
    // Recorded as failures too — a venue who reaches Stripe and is turned away is a
    // drop-off whatever the reason, and `already_subscribed` vs `billing_blocked` is
    // the difference between a harmless double-click and an account nobody can rescue.
    captureServerEvent(ServerAnalyticsEvent.ACTIVATION_FAILED, ANONYMOUS_DISTINCT_ID, {
      reason:
        code === 'CONFLICT'
          ? 'already_subscribed'
          : code === 'FORBIDDEN'
            ? 'billing_blocked'
            : 'error',
      plan: parsed.data.plan,
    });

    if (code === 'CONFLICT') {
      return page(
        c,
        200,
        'Already subscribed',
        'This venue already has an active subscription.',
        'Open CeolX — your profile is live.'
      );
    }
    if (code === 'FORBIDDEN') {
      return page(
        c,
        200,
        'Account under review',
        'We need to review this account before a new subscription can start.',
        'Please contact support.'
      );
    }

    console.error('[GET /activate] failed to start checkout:', err);
    return page(
      c,
      500,
      'Something went wrong',
      'We could not start the subscription just now.',
      'Please try the link again in a few minutes, or contact support.'
    );
  }
});

/**
 * Where Stripe sends the venue back to after Checkout.
 *
 * These exist because `success_url` and `cancel_url` have to resolve to something a
 * person can read. Stripe 303s the browser here; with no route the request falls
 * through to `app.notFound`, so the last thing a venue sees after paying is the
 * API's JSON error envelope.
 *
 * Neither page reports subscription state. The webhook is the only writer (D-22)
 * and may not have landed by the time the browser arrives, so anything asserted
 * here about being active could be false a second later. The app is the honest
 * place to check.
 */
activateRoute.get(ACTIVATION_RETURN_PATHS.complete, (c) =>
  page(
    c,
    200,
    'Payment received',
    'Thanks — your CeolX subscription is being set up.',
    'Open CeolX and refresh your profile. It can take a moment to appear.'
  )
);

// The token is only consumed once payment succeeds, so a cancelled checkout leaves
// the original link usable until it expires on its own.
activateRoute.get(ACTIVATION_RETURN_PATHS.cancelled, (c) =>
  page(
    c,
    200,
    'Checkout cancelled',
    'No payment was taken and your card has not been charged.',
    'Your activation link still works — reopen it, or tap Activate Profile in CeolX for a new one.'
  )
);

export default activateRoute;
