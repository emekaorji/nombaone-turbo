import { createMailTransport, type MailMessage, type MailTransport } from '@nombaone/sara/mail';

import { env } from '@shared/config/env';

/**
 * The API's mail transport — a thin binding of this app's env onto the SHARED transport
 * (`@nombaone/sara/mail`), which the console uses too.
 *
 * The rules that matter live there, deliberately in one place: a missing RESEND_API_KEY
 * throws, the `log` transport is forbidden in production, and Resend's sandbox sender is
 * refused in production (it 403s for every real customer). This file used to own its own
 * copy of that logic — and its copy silently fell back to `log` when the key was absent,
 * so every renewal reminder and dunning email was swallowed while everything reported
 * success.
 */
export type { MailMessage, MailTransport };

let cached: MailTransport | null = null;

export function getMailTransport(): MailTransport {
  if (cached) return cached;
  cached = createMailTransport({
    transport: env.COMMS_TRANSPORT,
    apiKey: env.RESEND_API_KEY,
    from: env.COMMS_FROM,
    environment: env.INFRA_ENVIRONMENT,
  });
  return cached;
}

/** TEST-ONLY seam: inject a fake transport (mirrors __setNombaClient). */
export function __setMailTransport(transport: MailTransport | null): void {
  cached = transport;
}
