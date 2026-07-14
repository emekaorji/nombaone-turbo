import 'server-only';

import { catalog, nombaone } from '@/lib/nombaone';
import { cadence, formatNaira, formatShortDate, isImminent } from '@/lib/format';
import { db } from '@/lib/db';

import type { Member } from '@/lib/auth';
import type { GymPlanDef } from '@/lib/nombaone';

/**
 * ── THE READ MODEL ───────────────────────────────────────────────────────────
 *
 * Every membership screen renders from ONE object, produced here. No page ever branches
 * on a platform enum — no component knows what `past_due` or `incomplete` means, and none
 * of them should. That is the whole legibility contract: if a member ever sees the word
 * "past due", it is because someone bypassed this file.
 *
 * It also means "when is my next payment" is answered in exactly one place. Two screens
 * computing that independently is how a product ends up telling a member two different
 * dates — the single most damaging thing a billing product can do.
 */

/** What a MEMBER is in, in words they would use. Never a platform status. */
export type MemberState =
  | 'none' // hasn't joined
  | 'pending' // joined, hasn't paid yet
  | 'active' // paid, all good
  | 'ending' // cancelled; still has access until the paid-for period ends
  | 'paused' // frozen; not being charged
  | 'payment_problem' // a payment failed, but they can still train (grace)
  | 'access_on_hold' // grace ran out
  | 'ended'; // over

export interface PaymentRow {
  when: string;
  what: string;
  amount: string;
  /** Human words. Never the invoice enum. */
  status: 'Paid' | 'Waiting' | "Didn't go through" | 'Part paid' | 'Cancelled';
  failed: boolean;
}

export interface MembershipView {
  state: MemberState;

  planName: string; // "Full Access"
  amount: string; // "₦35,000"
  cadence: string; // "every month" | "every 10 minutes"
  features: string[];
  isFlex: boolean;

  /** The instant money next leaves their account. `subscription.currentPeriodEnd`. */
  nextPaymentAt: string | null;
  /** True when the next payment is minutes away, not months (Flex Pass). */
  nextIsImminent: boolean;

  /** Only when something is wrong: the date they can train until. */
  graceUntil: string | null;
  /** Can they get through the door today? */
  canTrain: boolean;

  card: { brand: string; last4: string; expiry: string } | null;
  /** Set when a failed payment has a payable link waiting (from invoice.action_required). */
  payToken: string | null;
  /** Set when they abandoned the hosted checkout and can still finish. */
  resumeCheckoutLink: string | null;

  payments: PaymentRow[];

  /** Server-only. Never rendered. */
  subscriptionId: string | null;
  priceId: string | null;
}

/** No membership at all — a signed-in member who hasn't joined yet. */
const EMPTY: MembershipView = {
  state: 'none',
  planName: '',
  amount: '',
  cadence: '',
  features: [],
  isFlex: false,
  nextPaymentAt: null,
  nextIsImminent: false,
  graceUntil: null,
  canTrain: false,
  card: null,
  payToken: null,
  resumeCheckoutLink: null,
  payments: [],
  subscriptionId: null,
  priceId: null,
};

/** The subscription that matters when a member has more than one in their history. */
const LIVELINESS: Record<string, number> = {
  active: 6,
  past_due: 5,
  paused: 4,
  trialing: 3,
  incomplete: 2,
  canceled: 1,
  incomplete_expired: 0,
};

const paymentStatus = (status: string): PaymentRow['status'] => {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'partially_paid':
      return 'Part paid';
    case 'uncollectible':
      return "Didn't go through";
    case 'void':
      return 'Cancelled';
    default:
      return 'Waiting'; // draft | open — the money hasn't arrived yet
  }
};

export async function loadMembership(member: Member): Promise<MembershipView> {
  const client = nombaone();

  // Pick the subscription that is actually live. A member who cancelled and rejoined has
  // two; the active one is the one they mean.
  const subs = await client.subscriptions.list({ customerId: member.customerId, limit: 20 });
  const live = [...subs.data].sort(
    (a, b) => (LIVELINESS[b.status] ?? 0) - (LIVELINESS[a.status] ?? 0)
  )[0];

  if (!live) return EMPTY;

  const cat = await catalog();
  const entry = cat.find((c) => c.price.id === live.priceId);
  const def: GymPlanDef | undefined = entry?.def;
  const price = entry?.price;

  // ── State. This mapping IS the product. ────────────────────────────────────
  let state: MemberState;
  let graceUntil: string | null = null;
  let canTrain = false;

  if (live.status === 'incomplete' || live.status === 'incomplete_expired') {
    state = 'pending';
  } else if (live.status === 'paused') {
    state = 'paused';
    canTrain = false;
  } else if (live.status === 'canceled') {
    state = 'ended';
  } else if (live.status === 'past_due') {
    // A failed payment does NOT immediately lock someone out. The engine gives a grace
    // window, and the door should honour it — a member whose card bounced this morning is
    // not a freeloader, and treating them like one is how you lose them.
    let grace: string | null = null;
    try {
      const dunning = await client.subscriptions.dunning.retrieve(live.id);
      grace = dunning.graceAccessUntil ?? null;
    } catch {
      grace = null; // no dunning state yet — treat as still in grace
    }
    const stillInGrace = grace ? new Date(grace).getTime() > Date.now() : true;
    graceUntil = grace;
    state = stillInGrace ? 'payment_problem' : 'access_on_hold';
    canTrain = stillInGrace;
  } else if (live.cancelAtPeriodEnd) {
    state = 'ending';
    canTrain = true;
  } else {
    state = 'active';
    canTrain = true;
  }

  // ── The card on file ───────────────────────────────────────────────────────
  let card: MembershipView['card'] = null;
  try {
    const methods = await client.paymentMethods.list({ customerRef: member.customerId });
    const active = methods.data.find((m) => m.status === 'active' && m.kind === 'card');
    if (active?.last4) {
      card = {
        brand: active.brand ?? 'Card',
        last4: active.last4,
        expiry:
          active.expMonth && active.expYear
            ? `${String(active.expMonth).padStart(2, '0')}/${String(active.expYear).slice(-2)}`
            : '',
      };
    }
  } catch {
    card = null;
  }

  // ── What they've paid ──────────────────────────────────────────────────────
  const invoices = await client.invoices.list({ customerId: member.customerId, limit: 50 });
  const payments: PaymentRow[] = invoices.data.map((inv) => ({
    when: formatShortDate(inv.createdAt),
    what: def?.displayName ?? 'Membership',
    amount: formatNaira(inv.totalInKobo ?? inv.amountDueInKobo ?? 0),
    status: paymentStatus(inv.status),
    failed: inv.status === 'uncollectible',
  }));

  // ── A waiting pay-link, and an abandoned checkout ──────────────────────────
  const payLink = db()
    .prepare(
      `SELECT token FROM pay_links WHERE member_id = ? AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(member.id) as { token: string } | undefined;

  const pending = db()
    .prepare('SELECT checkout_link FROM pending_checkouts WHERE subscription_id = ?')
    .get(live.id) as { checkout_link: string } | undefined;

  const nextPaymentAt = live.currentPeriodEnd ?? null;

  return {
    state,
    planName: def?.displayName ?? 'Membership',
    amount: formatNaira(price?.unitAmountInKobo ?? 0),
    cadence: price ? cadence(price.interval, price.intervalCount) : '',
    features: def?.features ?? [],
    isFlex: def?.isFlex ?? false,
    nextPaymentAt,
    nextIsImminent: nextPaymentAt ? isImminent(nextPaymentAt) : false,
    graceUntil,
    canTrain,
    card,
    payToken: payLink?.token ?? null,
    resumeCheckoutLink: state === 'pending' ? (pending?.checkout_link ?? null) : null,
    payments,
    subscriptionId: live.id,
    priceId: live.priceId,
  };
}
