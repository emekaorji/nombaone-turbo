import { describe, expect, it, vi } from 'vitest';

import { createMailTransport, isUndeliverableAddress } from '@nombaone/sara/mail';

/**
 * ── THE BOUNCE GUARD ─────────────────────────────────────────────────────────
 *
 * `.test`, `.invalid`, `.example`, `.localhost` are RESERVED (RFC 2606 / RFC 6761) and can
 * never resolve. Every message sent to one is a HARD BOUNCE by definition.
 *
 * Mail providers score senders on bounce rate. A few percent of hard bounces gets a domain
 * throttled, then suspended — and losing `mail.nombaone.xyz` means no renewal reminders and
 * no dunning warnings for ANY merchant: every customer about to be charged, and every
 * customer whose card just failed, silently hears nothing.
 *
 * This nearly happened. The shared dev database is full of fixture customers
 * (`@ironrepublic.test`, `@gym.test`, `@rls.test` — 10 of 11 rows), and the moment the
 * transport was pointed at a live key, a stale queue fired ~200 messages at them. Only the
 * daily quota running out stopped it.
 */
describe('mail — never send to an address that cannot exist', () => {
  it('flags every reserved TLD as undeliverable', () => {
    // The exact fixture domains sitting in our own dev database.
    expect(isUndeliverableAddress('member@ironrepublic.test')).toBe(true);
    expect(isUndeliverableAddress('a@gym.test')).toBe(true);
    expect(isUndeliverableAddress('a@rls.test')).toBe(true);
    expect(isUndeliverableAddress('a@nombaone.test')).toBe(true);

    expect(isUndeliverableAddress('a@foo.invalid')).toBe(true);
    expect(isUndeliverableAddress('a@foo.example')).toBe(true);
    expect(isUndeliverableAddress('a@foo.localhost')).toBe(true);
    expect(isUndeliverableAddress('a@example.com')).toBe(true);
    expect(isUndeliverableAddress('not-an-address')).toBe(true);
  });

  it('lets real addresses through', () => {
    expect(isUndeliverableAddress('emekapraiseo@gmail.com')).toBe(false);
    expect(isUndeliverableAddress('billing@mail.nombaone.xyz')).toBe(false);
    expect(isUndeliverableAddress('member@ironrepublic.ng')).toBe(false);
    // `.testing` is a real-looking TLD — only the exact reserved label is refused.
    expect(isUndeliverableAddress('a@foo.testing')).toBe(false);
  });

  it('the transport SKIPS an undeliverable address WITHOUT calling the mail vendor', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const transport = createMailTransport({
      transport: 'resend',
      apiKey: 're_fake',
      from: 'Nomba One <billing@mail.nombaone.xyz>',
      environment: 'production',
    });

    const res = await transport.send({
      to: 'scenario-abc@ironrepublic.test',
      subject: 'your membership renews in 1 minute',
      html: '<p>hi</p>',
      text: 'hi',
    });

    // No network call at all — the bounce is never generated.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.delivered).toBe(false);
    // A SKIP, not a throw: a throw would make the worker retry, and retrying a guaranteed
    // hard bounce is precisely the damage.
    expect(res.skipped).toBe('undeliverable_address');

    fetchSpy.mockRestore();
  });
});
