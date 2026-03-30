import type { JobPayload } from '../types.js';

// TODO M11-GDPR: implement account anonymisation (Art. 17 GDPR)
export async function handleAccountAnonymize(
  _payload: JobPayload<'account.anonymize'>
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}

// TODO M11-GDPR: implement account cleanup (S3 media removal, session revocation)
export async function handleAccountCleanup(_payload: JobPayload<'account.cleanup'>): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
