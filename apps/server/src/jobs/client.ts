import { Client } from '@upstash/qstash';

// Lazy init — avoids module-level throw so tests can import without QSTASH_TOKEN set.
let _client: Client | null = null;

export function getQStashClient(): Client {
  if (!_client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error('QSTASH_TOKEN is required');
    _client = new Client({ token });
  }
  return _client;
}

// Allow tests to reset the cached instance between test runs.
export function _resetClientForTesting(): void {
  _client = null;
}
