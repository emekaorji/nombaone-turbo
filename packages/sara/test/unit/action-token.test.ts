import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { mintActionToken, verifyActionToken } from '@nombaone/sara/actions';

/**
 * Signed end-customer action tokens (`base64url(payload).base64url(hmac)`) —
 * the whole authority behind the hosted checkout's `/i/<token>` and
 * `/pm/<token>` pages. Verification must be strict (any deviation → null,
 * never a throw) because the input is a raw URL segment from the open web.
 */
describe('actions.mintActionToken / verifyActionToken', () => {
  const secret = 'test-action-secret';

  it('round-trips a pay-invoice token', () => {
    const token = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: 3600 });
    expect(verifyActionToken(secret, token)).toEqual({ kind: 'pay-invoice', ref: 'nbo123inv' });
  });

  it('round-trips an update-pm token', () => {
    const token = mintActionToken(secret, { kind: 'update-pm', ref: 'nbo123sub', expSec: 3600 });
    expect(verifyActionToken(secret, token)).toEqual({ kind: 'update-pm', ref: 'nbo123sub' });
  });

  it('is URL-safe (base64url segments joined by a dot)', () => {
    const token = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: 60 });
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it('rejects a tampered payload (re-encoded claim, original signature)', () => {
    const token = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: 3600 });
    const [payloadB64, sig] = token.split('.') as [string, string];
    const claim = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      kind: string;
      ref: string;
      exp: number;
    };
    const forged = Buffer.from(
      JSON.stringify({ ...claim, ref: 'nbo999inv' }),
      'utf8'
    ).toString('base64url');
    expect(verifyActionToken(secret, `${forged}.${sig}`)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: 3600 });
    const [payloadB64, sig] = token.split('.') as [string, string];
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(verifyActionToken(secret, `${payloadB64}.${flipped}`)).toBeNull();
    expect(verifyActionToken(secret, `${payloadB64}.${sig.slice(0, -1)}`)).toBeNull();
  });

  it('rejects an expired token (and one expiring exactly now)', () => {
    const expired = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: -10 });
    expect(verifyActionToken(secret, expired)).toBeNull();
    const atNow = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: 0 });
    expect(verifyActionToken(secret, atNow)).toBeNull();
  });

  it('rejects a token minted with a different secret', () => {
    const token = mintActionToken('other-secret', {
      kind: 'update-pm',
      ref: 'nbo123sub',
      expSec: 3600,
    });
    expect(verifyActionToken(secret, token)).toBeNull();
  });

  it('returns null (never throws) on malformed input', () => {
    const good = mintActionToken(secret, { kind: 'pay-invoice', ref: 'nbo123inv', expSec: 60 });
    const [payloadB64] = good.split('.') as [string, string];

    for (const bad of [
      '',
      'no-dot-at-all',
      '.only-a-signature',
      'only-a-payload.',
      'a.b.c',
      `${payloadB64}.!!!not-base64url!!!`,
      'not-json-at-all.deadbeef',
    ]) {
      expect(verifyActionToken(secret, bad)).toBeNull();
    }

    // Correctly signed but structurally invalid claims must also fail.
    const signedGarbage = (claim: unknown): string => {
      const b64 = Buffer.from(JSON.stringify(claim), 'utf8').toString('base64url');
      const sig = createHmac('sha256', secret).update(b64, 'utf8').digest().toString('base64url');
      return `${b64}.${sig}`;
    };
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(verifyActionToken(secret, signedGarbage(null))).toBeNull();
    expect(verifyActionToken(secret, signedGarbage('a string'))).toBeNull();
    expect(verifyActionToken(secret, signedGarbage({ kind: 'refund-all', ref: 'x', exp }))).toBeNull();
    expect(verifyActionToken(secret, signedGarbage({ kind: 'pay-invoice', ref: '', exp }))).toBeNull();
    expect(
      verifyActionToken(secret, signedGarbage({ kind: 'pay-invoice', ref: 'x', exp: 'soon' }))
    ).toBeNull();
    expect(verifyActionToken(secret, signedGarbage({ kind: 'pay-invoice', ref: 'x' }))).toBeNull();
  });
});
