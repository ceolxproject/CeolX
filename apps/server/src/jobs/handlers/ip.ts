import type { JobPayload } from '../types.js';

// TODO M11-GDPR: implement IP address anonymisation (logs older than 30 days)
export async function handleIpAnonymize(_payload: JobPayload<'ip.anonymize'>): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
