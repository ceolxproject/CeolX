import { importPKCS8, SignJWT } from 'jose';

interface AppleClientSecretParams {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}

const APPLE_AUD = 'https://appleid.apple.com';
const MAX_EXPIRY_SECONDS = 180 * 24 * 60 * 60; // 180 days (Apple maximum)

export async function generateAppleClientSecret({
  clientId,
  teamId,
  keyId,
  privateKey,
}: AppleClientSecretParams): Promise<string> {
  const key = await importPKCS8(privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_AUD)
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_EXPIRY_SECONDS)
    .sign(key);
}
