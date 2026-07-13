import type { CommsJobData } from '@nombaone/queue';
import type { MailMessage } from './transport';

/**
 * ── End-customer email templates ────────────────────────────────────────────
 *
 * Plain HTML + text, rendered from the rich payload the trigger site enqueued.
 * Every template answers three questions in the first two lines: what happened,
 * how much money, what (if anything) the customer must do. Amounts arrive in
 * kobo and render as naira; links arrive fully formed (hosted checkout / action
 * pages) — templates never mint anything.
 */
const naira = (kobo: unknown): string => {
  const n = typeof kobo === 'number' ? kobo : Number(kobo ?? 0);
  return `₦${(n / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const when = (v: unknown): string => {
  const d = new Date(str(v));
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
};

interface Rendered {
  subject: string;
  intro: string;
  lines: string[];
  cta?: { label: string; href: string };
}

function render(template: CommsJobData['template'], d: Record<string, unknown>): Rendered {
  switch (template) {
    case 'renewal_upcoming':
      return {
        subject: `Upcoming renewal — ${naira(d.amountKobo)} for ${str(d.planName) || 'your subscription'}`,
        intro: `Your subscription renews soon.`,
        lines: [
          `${str(d.planName) || 'Your plan'} renews ${when(d.renewsAt) || 'shortly'} for ${naira(d.amountKobo)}.`,
          str(d.paymentHint) ||
            'No action is needed — your saved payment method will be charged automatically.',
        ],
      };
    case 'payment_action_required':
      return {
        subject: `Action needed — confirm your ${naira(d.amountKobo)} payment`,
        intro: 'Your bank asked for a quick confirmation.',
        lines: [
          `The ${naira(d.amountKobo)} charge for ${str(d.planName) || 'your subscription'} needs you to authorise it (a one-time code from your bank).`,
          'Nothing has been taken yet. Confirm below to keep your subscription active.',
        ],
        cta: d.checkoutLink ? { label: 'Confirm payment', href: str(d.checkoutLink) } : undefined,
      };
    case 'payment_method_update':
      return {
        subject: 'Your payment method needs updating',
        intro: `A payment for ${str(d.planName) || 'your subscription'} could not go through.`,
        lines: [
          str(d.reasonLine) || 'Your saved card was declined or has expired.',
          'Update your payment method to keep your subscription active — it takes a minute.',
        ],
        cta: d.actionUrl ? { label: 'Update payment method', href: str(d.actionUrl) } : undefined,
      };
    case 'invoice_payment_link': {
      const bank = str(d.bankName);
      const acct = str(d.accountNumber);
      return {
        subject: `Your ${naira(d.amountKobo)} invoice for ${str(d.planName) || 'your subscription'}`,
        intro: `An invoice is ready${d.dueAt ? ` — due ${when(d.dueAt)}` : ''}.`,
        lines: [
          `Amount due: ${naira(d.amountKobo)}.`,
          ...(bank && acct
            ? [`Pay by transfer to ${bank} ${acct}${str(d.accountName) ? ` (${str(d.accountName)})` : ''} — exact amount, please.`]
            : []),
        ],
        cta: d.checkoutLink ? { label: 'Pay now', href: str(d.checkoutLink) } : undefined,
      };
    }
    case 'payment_recovered':
      return {
        subject: 'Payment received — you are all set',
        intro: `Your ${naira(d.amountKobo)} payment for ${str(d.planName) || 'your subscription'} went through.`,
        lines: ['Your subscription is active again. Thanks for sorting it quickly.'],
      };
    case 'subscription_churned':
      return {
        subject: `Your ${str(d.planName) || 'subscription'} has been cancelled`,
        intro: 'We could not collect payment after several attempts, so the subscription has ended.',
        lines: [
          `Outstanding amount: ${naira(d.amountKobo)}.`,
          'You can restart any time — nothing else is owed unless you resubscribe.',
        ],
        ...(d.resubscribeUrl ? { cta: { label: 'Restart subscription', href: str(d.resubscribeUrl) } } : {}),
      };
    default: {
      const never: never = template;
      throw new Error(`unknown comms template: ${String(never)}`);
    }
  }
}

export function renderMail(job: Pick<CommsJobData, 'template' | 'to' | 'data'>): MailMessage {
  const r = render(job.template, job.data);
  const merchant = str(job.data.merchantName) || 'Your merchant';
  const text = [
    r.intro,
    '',
    ...r.lines,
    ...(r.cta ? ['', `${r.cta.label}: ${r.cta.href}`] : []),
    '',
    `— ${merchant}, billed with Nomba One`,
  ].join('\n');

  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = [
    `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">`,
    `<p style="font-size:15px;margin:0 0 12px">${esc(r.intro)}</p>`,
    ...r.lines.map((l) => `<p style="font-size:14px;margin:0 0 8px;color:#333">${esc(l)}</p>`),
    ...(r.cta
      ? [
          `<p style="margin:20px 0"><a href="${r.cta.href}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px">${esc(r.cta.label)}</a></p>`,
        ]
      : []),
    `<p style="font-size:12px;color:#888;margin-top:24px">— ${esc(merchant)}, billed with Nomba One</p>`,
    `</div>`,
  ].join('');

  return { to: job.to, subject: r.subject, html, text };
}
