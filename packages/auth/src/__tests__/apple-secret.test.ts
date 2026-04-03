import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { generateAppleClientSecret } from '../apple-secret.js';

describe('generateAppleClientSecret', () => {
  let privateKeyPem: string;

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair('ES256');
    privateKeyPem = await exportPKCS8(privateKey);
  });

  it('returns a three-part JWT string', async () => {
    const secret = await generateAppleClientSecret({
      clientId: 'ie.ceolx.app.si',
      teamId: 'TESTTEAM1',
      keyId: 'TESTKEYID',
      privateKey: privateKeyPem,
    });
    expect(typeof secret).toBe('string');
    expect(secret.split('.')).toHaveLength(3);
  });

  it('sets alg ES256 and kid from keyId in protected header', async () => {
    const secret = await generateAppleClientSecret({
      clientId: 'ie.ceolx.app.si',
      teamId: 'TESTTEAM1',
      keyId: 'TESTKEYID',
      privateKey: privateKeyPem,
    });
    const header = decodeProtectedHeader(secret);
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe('TESTKEYID');
  });

  it('sets iss to teamId', async () => {
    const secret = await generateAppleClientSecret({
      clientId: 'ie.ceolx.app.si',
      teamId: 'TESTTEAM1',
      keyId: 'TESTKEYID',
      privateKey: privateKeyPem,
    });
    expect(decodeJwt(secret).iss).toBe('TESTTEAM1');
  });

  it('sets sub to clientId', async () => {
    const secret = await generateAppleClientSecret({
      clientId: 'ie.ceolx.app.si',
      teamId: 'TESTTEAM1',
      keyId: 'TESTKEYID',
      privateKey: privateKeyPem,
    });
    expect(decodeJwt(secret).sub).toBe('ie.ceolx.app.si');
  });

  it('sets aud to https://appleid.apple.com', async () => {
    const secret = await generateAppleClientSecret({
      clientId: 'ie.ceolx.app.si',
      teamId: 'TESTTEAM1',
      keyId: 'TESTKEYID',
      privateKey: privateKeyPem,
    });
    expect(decodeJwt(secret).aud).toBe('https://appleid.apple.com');
  });

  it('sets exp within 180 days from now', async () => {
    const now = Math.floor(Date.now() / 1000);
    const secret = await generateAppleClientSecret({
      clientId: 'ie.ceolx.app.si',
      teamId: 'TESTTEAM1',
      keyId: 'TESTKEYID',
      privateKey: privateKeyPem,
    });
    const { exp } = decodeJwt(secret);
    const maxExpiry = now + 180 * 24 * 60 * 60;
    expect(exp).toBeGreaterThan(now);
    expect(exp).toBeLessThanOrEqual(maxExpiry + 5); // 5s tolerance
  });
});
