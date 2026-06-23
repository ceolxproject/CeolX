import { Client } from '@upstash/qstash';

// Lazy init — avoids module-level throw so tests can import without QSTASH_TOKEN set.
let _client: Client | null = null;

export function getQStashClient(): Client {
  if (!_client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error('QSTASH_TOKEN is required');
    // QSTASH_BASE_URL is the QStash *service* endpoint (e.g. a regional
    // upstash.io URL) — it belongs here, not as a publish destination.
    _client = new Client({ token, baseUrl: process.env.QSTASH_BASE_URL });
  }
  return _client;
}

// The public URL QStash delivers jobs to — our own webhook handler
// (POST /api/webhooks/qstash). Derived from the server base URL so each
// environment has a single source of truth, and so the publish destination
// always matches the URL the signature verifier checks against.
export function getJobWebhookUrl(): string {
  const base = process.env.BETTER_AUTH_URL;
  if (!base) throw new Error('BETTER_AUTH_URL is not set');
  return `${base.replace(/\/$/, '')}/api/webhooks/qstash`;
}

// Allow tests to reset the cached instance between test runs.
export function _resetClientForTesting(): void {
  _client = null;
}
