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

import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailSendResult {
  delivered: boolean;
  providerId?: string;
  /**
   * Set when we deliberately did NOT attempt delivery. A skip is a SUCCESS for the job —
   * it must never be retried, because retrying it is the harm.
   */
  skipped?: 'undeliverable_address';
}

export type MailTransportKind = 'smtp' | 'resend' | 'log';

export interface MailTransport {
  readonly kind: MailTransportKind;
  send(message: MailMessage): Promise<MailSendResult>;
  /**
   * Release any held connections. SMTP pools a TLS socket, which keeps the Node event loop
   * alive — without this a process would never exit on SIGTERM, and the orchestrator would
   * eventually SIGKILL it mid-send. No-op for the HTTP transports.
   */
  close?(): Promise<void>;
}

export interface MailConfig {
  transport: MailTransportKind;
  /** `resend` only. */
  apiKey?: string | undefined;
  /** `smtp` only — the mailbox we authenticate as. */
  smtp?:
    | {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
      }
    | undefined;
  from: string;
  /** `production` forbids the log transport and the sandbox sender. */
  environment: string;
}

/** Resend's shared sandbox sender — only ever delivers to the account owner. */
const SANDBOX_SENDER = /resend\.dev/i;

/**
 * ── 🔴 NEVER SEND TO AN ADDRESS THAT CANNOT EXIST ────────────────────────────
 *
 * `.test`, `.invalid`, `.example` and `.localhost` are RESERVED by RFC 2606 and RFC 6761.
 * They are guaranteed never to resolve. Every message sent to one is a HARD BOUNCE, by
 * definition — not a maybe.
 *
 * This is not a cosmetic concern. Mail providers score a sender on its bounce rate, and a
 * few percent of hard bounces gets a domain throttled and then suspended. Losing
 * `mail.nombaone.xyz` means no renewal reminders and no dunning warnings for ANY merchant
 * — every customer who was about to be charged, and every customer whose card just failed,
 * silently hears nothing.
 *
 * It very nearly happened: the shared dev database is full of fixture customers
 * (`@ironrepublic.test`, `@gym.test`, `@rls.test`), and the moment the transport was
 * pointed at a real Resend key, a stale queue fired ~200 messages at them. The daily quota
 * running out is what stopped it.
 *
 * So the transport refuses these addresses BEFORE the network call, and reports a SKIP
 * rather than throwing — a throw would make the worker retry, and retrying a guaranteed
 * bounce is precisely the damage we are avoiding.
 */
const UNDELIVERABLE_TLDS = new Set(['test', 'invalid', 'example', 'localhost', 'local']);

/** RFC 2606 reserved second-level names — also guaranteed undeliverable. */
const UNDELIVERABLE_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);

export function isUndeliverableAddress(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return true; // not an address at all
  if (UNDELIVERABLE_DOMAINS.has(domain)) return true;
  const tld = domain.split('.').pop();
  return tld !== undefined && UNDELIVERABLE_TLDS.has(tld);
}

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

/**
 * SMTP (nodemailer) — currently Gmail.
 *
 * ⚠ Gmail rewrites the `From` header to the authenticated mailbox unless the address is a
 * verified "send mail as" alias. So `COMMS_FROM` must be that mailbox (or a configured
 * alias), or the recipient sees the raw Gmail address regardless of what we set.
 *
 * ⚠ Gmail caps at roughly 500 recipients/day and is not a domain-aligned sender for
 * `nombaone.xyz` (no SPF/DKIM alignment), so deliverability to a real subscriber base is
 * materially worse than a proper transactional provider. Fine for now; not the endgame.
 *
 * The connection is created ONCE and pooled — nodemailer otherwise opens a fresh TLS
 * handshake per message, which on a dunning sweep is both slow and a good way to get
 * throttled.
 */
const smtpTransport = (
  smtp: NonNullable<MailConfig['smtp']>,
  from: string
): MailTransport => {
  let cachedTransporter: Transporter | null = null;

  const transporter = (): Transporter => {
    cachedTransporter ??= nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
      pool: true,
      maxConnections: 3,
      // Stay well under Gmail's throttle. The BullMQ limiter is the primary throttle;
      // this is the belt to its braces.
      rateLimit: 5,
      rateDelta: 1000,
    });
    return cachedTransporter;
  };

  return {
    kind: 'smtp',
    async send(message) {
      // Same bounce guard as every other transport — a `.test` recipient is a guaranteed
      // hard bounce, and Gmail will suspend an account that produces them.
      if (isUndeliverableAddress(message.to)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[mail] SKIPPED undeliverable address to=${message.to} subject=${message.subject} ` +
            '(reserved TLD — sending would be a guaranteed hard bounce)'
        );
        return { delivered: false, skipped: 'undeliverable_address' };
      }

      // THROWS on failure, so BullMQ retries with backoff. A mail blip must never silently
      // eat a dunning warning.
      const info = await transporter().sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      return { delivered: true, providerId: info.messageId };
    },

    async close() {
      cachedTransporter?.close();
      cachedTransporter = null;
    },
  };
};

const resendTransport = (apiKey: string, from: string): MailTransport => ({
  kind: 'resend',
  async send(message) {
    // 🔴 BOUNCE GUARD — refuse before the network call. A message to `@gym.test` cannot be
    // delivered; sending it only buys a hard bounce against our sender reputation. Report
    // a SKIP (not a throw) so the job completes and is never retried.
    if (isUndeliverableAddress(message.to)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[mail] SKIPPED undeliverable address to=${message.to} subject=${message.subject} ` +
          '(reserved TLD — sending would be a guaranteed hard bounce)'
      );
      return { delivered: false, skipped: 'undeliverable_address' };
    }

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

  if (config.transport === 'smtp') {
    const smtp = config.smtp;
    if (!smtp?.user || !smtp?.password) {
      throw new Error(
        'COMMS_TRANSPORT=smtp but SMTP_USER / SMTP_PASSWORD are not set. Refusing to start: falling back ' +
          'to a log transport would silently swallow every email we owe a human.'
      );
    }
    return smtpTransport(smtp, config.from);
  }

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
        'sent. Set COMMS_TRANSPORT=smtp (SMTP_USER + SMTP_PASSWORD) or resend (RESEND_API_KEY).'
    );
  }

  return logTransport(config.from);
}
