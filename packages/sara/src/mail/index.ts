/**
 * ── THE MAIL TRANSPORT (shared infra) ────────────────────────────────────────
 *
 * One Resend transport for every app that sends a human an email — the API's customer
 * comms (renewal reminders, dunning, invoice links) AND the console's own mail (team
 * invitations). It lives in `sara` rather than in `apps/api` because a Next.js app cannot
 * import from an Express app, and duplicating a mail sender is how two of them drift into
 * having different rules about what counts as "sent".
 *
 * ── The rule this file exists to enforce ─────────────────────────────────────
 * A missing key FAILS. It never quietly degrades into something that looks like it works.
 *
 * The version this replaced did exactly that: if `resend` was selected but no API key was
 * present, it logged a warning and handed back a transport that printed the email to a log
 * and reported success. The queue drained, the jobs went green, the tests passed — and not
 * one customer ever received anything. You only find out when a subscriber says "nobody
 * told me you were going to charge me."
 *
 * So:
 *   • `resend` with no key            → THROW.
 *   • `log` in production             → THROW. Printing a dunning warning to stdout in
 *                                       production is worse than refusing to boot.
 *   • Resend's sandbox sender in prod → THROW. `onboarding@resend.dev` only delivers to
 *                                       the Resend account owner and 403s for every real
 *                                       customer, one silent failure at a time.
 *
 * `log` remains available for local development ONLY, and it says so on every send.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailTransport {
  readonly kind: 'resend' | 'log';
  send(message: MailMessage): Promise<{ delivered: boolean; providerId?: string }>;
}

export interface MailConfig {
  transport: 'resend' | 'log';
  apiKey?: string | undefined;
  from: string;
  /** `production` forbids the log transport and the sandbox sender. */
  environment: string;
}

/** Resend's shared sandbox sender — only ever delivers to the account owner. */
const SANDBOX_SENDER = /resend\.dev/i;

const logTransport = (from: string): MailTransport => ({
  kind: 'log',
  async send(message) {
    // eslint-disable-next-line no-console
    console.warn(
      `[mail:log] NOT SENT (log transport) from=${from} to=${message.to} subject=${message.subject}`
    );
    // eslint-disable-next-line no-console
    console.warn(`[mail:log] ${message.text.slice(0, 400)}`);
    return { delivered: false };
  },
});

const resendTransport = (apiKey: string, from: string): MailTransport => ({
  kind: 'resend',
  async send(message) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // THROW, so a BullMQ job retries with backoff and a server action surfaces the
      // failure. A mail-vendor blip must never silently eat a dunning warning.
      throw new Error(`resend send failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, providerId: json.id };
  },
});

/** Build the transport, refusing every configuration that would silently swallow mail. */
export function createMailTransport(config: MailConfig): MailTransport {
  const isProduction = config.environment === 'production';

  if (config.transport === 'resend') {
    if (!config.apiKey) {
      throw new Error(
        'COMMS_TRANSPORT=resend but RESEND_API_KEY is not set. Refusing to start: falling back to a log ' +
          'transport would silently swallow every email we owe a human.'
      );
    }
    if (isProduction && SANDBOX_SENDER.test(config.from)) {
      throw new Error(
        `COMMS_FROM is Resend's sandbox sender (${config.from}), which can only email the Resend account ` +
          'owner and 403s for every real recipient. Refusing to start in production. Use the verified ' +
          'domain: "Nomba One <billing@mail.nombaone.xyz>".'
      );
    }
    return resendTransport(config.apiKey, config.from);
  }

  if (isProduction) {
    throw new Error(
      'COMMS_TRANSPORT=log is not allowed in production — emails would be printed to a log and never ' +
        'sent. Set COMMS_TRANSPORT=resend and RESEND_API_KEY.'
    );
  }

  return logTransport(config.from);
}
