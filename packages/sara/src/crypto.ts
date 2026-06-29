import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Column-level PII encryption at rest (AES-256-GCM) — for fields like TOTP
 * secrets and any KYC identifiers you add. The key comes from
 * `INFRA_PII_ENCRYPTION_KEY` and MUST be byte-identical across every app that
 * reads the columns, or ciphertext written by one app is unreadable by another.
 * Stored form: `iv:authTag:ciphertext`, all base64.
 */
const resolveKey = (): Buffer => {
  const raw = process.env.INFRA_PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('INFRA_PII_ENCRYPTION_KEY environment variable is required');
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const asUtf8 = Buffer.from(raw, 'utf8');
  return asUtf8.length === 32 ? asUtf8 : createHash('sha256').update(raw).digest();
};

export const encryptPii = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', resolveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
};

export const decryptPii = (payload: string): string => {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload');
  }
  const [ivB64, tagB64, encB64] = parts as [string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', resolveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
