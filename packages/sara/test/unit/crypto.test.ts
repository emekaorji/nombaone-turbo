import { describe, expect, it } from 'vitest';

import { decryptPii, encryptPii } from '@nombaone/sara/crypto';

/**
 * Column-level PII encryption at rest (AES-256-GCM). The key is supplied via
 * `INFRA_PII_ENCRYPTION_KEY` (set in vitest.config.ts for the test run).
 */
describe('crypto.encryptPii / decryptPii', () => {
  it('round-trips a plaintext value', () => {
    const secret = 'JBSWY3DPEHPK3PXP'; // a representative TOTP secret
    const encrypted = encryptPii(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptPii(encrypted)).toBe(secret);
  });

  it('produces a distinct ciphertext per call (random IV) that still decrypts', () => {
    const plaintext = 'pii-value-with-üñïçödé';
    const a = encryptPii(plaintext);
    const b = encryptPii(plaintext);
    expect(a).not.toBe(b); // random IV per encryption
    expect(decryptPii(a)).toBe(plaintext);
    expect(decryptPii(b)).toBe(plaintext);
  });

  it('emits the iv:authTag:ciphertext base64 envelope', () => {
    const parts = encryptPii('x').split(':');
    expect(parts).toHaveLength(3);
  });

  it('rejects a malformed payload', () => {
    expect(() => decryptPii('not-a-valid-envelope')).toThrowError();
  });
});
