import { formatDate, whenPhrase } from '@/lib/format';

import type { MembershipView } from '@/lib/membership';

/**
 * ── EVERY SENTENCE A MEMBER READS ABOUT THEIR MONEY ──────────────────────────
 *
 * One file, so the product cannot contradict itself and so no component ever composes
 * prose from a platform status. The rule this enforces:
 *
 *   A member never sees the words engine, webhook, invoice, subscription, past due,
 *   dunning, rail, cycle, or a reference like `nbo…`.
 *
 * Those words are all true, and all useless to the person paying. "Your subscription is
 * past_due and dunning attempt 2 of 4 is scheduled" tells a member nothing. "We couldn't
 * take your ₦35,000 payment — you can still train until Monday" tells them everything.
 *
 * `tests/copy-hygiene.spec.ts` crawls every page and fails the build if a platform word
 * reaches the screen.
 */

export interface StatusPill {
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'muted' | 'info';
}

export function statusPill(v: MembershipView): StatusPill {
  switch (v.state) {
    case 'active':
      return { label: 'Active', tone: 'good' };
    case 'ending':
      return { label: 'Ending soon', tone: 'muted' };
    case 'paused':
      return { label: 'Paused', tone: 'muted' };
    case 'payment_problem':
      return { label: 'Payment problem', tone: 'warn' };
    case 'access_on_hold':
      return { label: 'Access paused', tone: 'bad' };
    case 'pending':
      return { label: 'Not started', tone: 'info' };
    case 'ended':
      return { label: 'Ended', tone: 'muted' };
    default:
      return { label: '', tone: 'muted' };
  }
}

/**
 * THE LINE. The single most important sentence in the product — the one a member
 * (and a judge) reads to understand what a subscription actually is.
 */
export function nextPaymentLine(v: MembershipView): string {
  switch (v.state) {
    case 'active':
      if (!v.nextPaymentAt) return 'Your membership is live.';
      return `Your next payment of ${v.amount} comes out ${whenPhrase(v.nextPaymentAt)}.`;

    case 'ending':
      return v.nextPaymentAt
        ? `Your membership ends on ${formatDate(v.nextPaymentAt)}. You can still train until then, and nothing more will be charged.`
        : 'Your membership is ending. Nothing more will be charged.';

    case 'paused':
      return "Your membership is paused. You won't be charged while it's paused.";

    case 'payment_problem':
      // A member whose card just bounced has exactly one urgent question: am I locked out?
      // Answer it either way. The grace DATE is only known once the engine has scheduled a
      // retry, which can be a few minutes later — but the ACCESS is true immediately, and
      // leaving them to guess is how a recoverable payment turns into a lost member.
      return v.graceUntil
        ? `We couldn't take your ${v.amount} payment. You can still train until ${formatDate(v.graceUntil)}.`
        : `We couldn't take your ${v.amount} payment. You can still train while we sort it out.`;

    case 'access_on_hold':
      return `Your ${v.amount} payment didn't go through, so your access is on hold. Pay now and it switches back on straight away.`;

    case 'pending':
      return 'Your membership starts the moment your first payment goes through.';

    case 'ended':
      return 'Your membership has ended. Nothing is being charged.';

    default:
      return '';
  }
}

/** The reassurance under the line — why this is not a trap. */
export function nextPaymentReassurance(v: MembershipView): string | null {
  if (v.state !== 'active' || !v.nextPaymentAt) return null;
  return 'This happens automatically. It will always be shown here before it happens.';
}

/** The attention band at the top of the account page, when something needs a decision. */
export interface Band {
  tone: 'warn' | 'bad' | 'info' | 'muted';
  title: string;
  body: string;
  action?: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export function attentionBand(v: MembershipView): Band | null {
  switch (v.state) {
    case 'pending':
      return {
        tone: 'info',
        title: "You haven't finished joining.",
        body: `Your ${v.planName} membership starts the moment your first payment goes through.`,
        ...(v.resumeCheckoutLink
          ? { action: { label: 'Finish joining', href: v.resumeCheckoutLink } }
          : {}),
      };

    case 'payment_problem':
      return {
        tone: 'warn',
        title: `We couldn't take your ${v.amount} payment.`,
        body: v.graceUntil
          ? `Your bank turned it down — usually an expired card, or not enough in the account. Nothing to panic about. You can keep training until ${formatDate(v.graceUntil)}, and we'll try again before then.`
          : "Your bank turned it down — usually an expired card, or not enough in the account. Nothing to panic about: you can keep training while we sort it out, and we'll try again shortly.",
        ...(v.payToken
          ? { action: { label: `Pay ${v.amount} now`, href: `/pay/${v.payToken}` } }
          : {}),
        secondary: { label: 'Use a different card', href: '/account/payment-method' },
      };

    case 'access_on_hold':
      return {
        tone: 'bad',
        title: 'Your access is on hold.',
        body: `Your ${v.amount} payment never went through, so we've paused your membership. This isn't a cancellation — your plan and your price are exactly as you left them. Pay now and you can walk in ten minutes later.`,
        ...(v.payToken
          ? {
              action: {
                label: `Pay ${v.amount} and switch it back on`,
                href: `/pay/${v.payToken}`,
              },
            }
          : { action: { label: 'Use a different card', href: '/account/payment-method' } }),
      };

    case 'ending':
      return {
        tone: 'muted',
        title: 'Your membership is ending.',
        body: v.nextPaymentAt
          ? `You'll keep full access until ${formatDate(v.nextPaymentAt)} — the time you've already paid for. After that, your card won't be charged again.`
          : "Your card won't be charged again.",
      };

    case 'paused':
      return {
        tone: 'muted',
        title: 'Your membership is paused.',
        body: "You won't be charged while it's paused. Unpause whenever you're ready to train again.",
        action: { label: 'Unpause now', href: '/account/membership' },
      };

    default:
      return null;
  }
}

/** How they pay — or the honest truth when there is no card to charge. */
export function howYouPayLine(v: MembershipView): string {
  if (v.card) {
    const when = v.nextPaymentAt ? ` on ${formatDate(v.nextPaymentAt)}` : '';
    return `This is the card we'll use${when}.`;
  }
  return "You don't have a card saved yet, so your membership can't renew on its own. Add one and it takes care of itself.";
}

/** The cancel screen. Its job is to be honest, not to trap. */
export function cancelPromise(v: MembershipView): string {
  return v.nextPaymentAt
    ? `You'll keep full access until ${formatDate(v.nextPaymentAt)} — the time you've already paid for. After that your card won't be charged again, and you won't need to do anything else.`
    : "Your card won't be charged again.";
}
