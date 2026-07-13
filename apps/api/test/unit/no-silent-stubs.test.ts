import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ── NO SILENT STUBS ──────────────────────────────────────────────────────────
 *
 * A stub that quietly stands in for a real integration is the most expensive kind of bug
 * in this codebase, because it makes everything downstream *look* healthy: the queue
 * drains, the job succeeds, the tests are green — and no customer ever got the email, no
 * naira ever left the account. You find out days later, from a customer.
 *
 * The rule is: a missing key FAILS. It never degrades into something that resembles
 * working. These tests pin the two places that used to break it.
 */
const SRC = join(__dirname, '../../src');
/** The mail rules now live in shared infra, so BOTH apps obey exactly one set of them. */
const SARA_MAIL = join(__dirname, '../../../../packages/sara/src/mail/index.ts');

/** Strip comments — LINE comments first (see rails-registered-at-boot for why). */
const strip = (src: string): string =>
  src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const readCode = (rel: string): string => strip(readFileSync(join(SRC, rel), 'utf8'));
const readMail = (): string => strip(readFileSync(SARA_MAIL, 'utf8'));

describe('a missing credential fails loudly — it never degrades into a stub', () => {
  it('the mail transport does NOT fall back to `log` when RESEND_API_KEY is missing', () => {
    const code = readMail();

    // It used to warn and hand back the log transport, so every renewal reminder and
    // dunning warning was silently swallowed while everything reported success.
    expect(
      /RESEND_API_KEY/.test(code) && /throw new Error/.test(code),
      'sara/mail must THROW when COMMS_TRANSPORT=resend and RESEND_API_KEY is unset, not fall back to log.'
    ).toBe(true);

    expect(
      /falling back to log/i.test(code),
      'sara/mail still contains a silent fallback to the log transport.'
    ).toBe(false);
  });

  it('the log transport is FORBIDDEN in production — emails must never be printed instead of sent', () => {
    const code = readMail();
    expect(
      /production/.test(code) && /throw new Error/.test(code),
      'sara/mail must refuse the log transport in production.'
    ).toBe(true);
  });

  it("production refuses Resend's sandbox sender — it 403s for every real customer", () => {
    const code = readMail();
    // `onboarding@resend.dev` only delivers to the Resend account owner. In production it
    // returns 403 for every actual subscriber — one silent failure at a time, buried in a
    // worker log, while the queue reports success. Our verified domain is mail.nombaone.xyz.
    // NB: the source guards with the regex literal `/resend\.dev/i`, so the character
    // after "resend" is a BACKSLASH, not a dot — match loosely rather than trying to
    // out-clever the escaping.
    expect(
      /resend/i.test(code) && /SANDBOX_SENDER/.test(code) && /production/.test(code),
      'sara/mail must refuse to boot in production when the sender is the resend.dev sandbox sender.'
    ).toBe(true);
  });

  it('the inbound webhook has NO signature bypass', () => {
    const code = readCode('apps/webhook/modules/nomba/controller.ts');

    // `NOMBA_WEBHOOK_DEBUG` accepted the request whether or not any candidate signature
    // matched, and it was left switched on. Anyone who could reach the tunnel could forge
    // a payment_success and activate subscriptions for free.
    expect(
      /NOMBA_WEBHOOK_DEBUG/.test(code),
      'the NOMBA_WEBHOOK_DEBUG signature bypass is back in the webhook controller.'
    ).toBe(false);

    // Verification must be unconditional.
    expect(/verifyNombaSignature/.test(code) && /rejectSignature/.test(code)).toBe(true);
  });

  it('the signature bypass flag is gone from the env schema entirely', () => {
    const code = readCode('shared/config/env.ts');
    expect(
      /NOMBA_WEBHOOK_DEBUG/.test(code),
      'NOMBA_WEBHOOK_DEBUG is back in env.ts — a bypass that can be re-enabled by an env var is a bypass.'
    ).toBe(false);
  });
});
