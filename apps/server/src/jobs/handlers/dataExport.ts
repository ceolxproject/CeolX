import type { JobPayload } from '../types.js';

// TODO M11-GDPR: implement GDPR data export — query DB, write to S3, return signed URL
export async function handleDataExportProcess(
  _payload: JobPayload<'data-export.process'>
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}

// TODO M11-GDPR: implement data export notification — email user the S3 download link
export async function handleDataExportNotify(
  _payload: JobPayload<'data-export.notify'>
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
