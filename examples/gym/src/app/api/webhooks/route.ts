import { randomBytes, randomUUID } from 'node:crypto';

import { WebhookVerificationError, webhooks } from '@nombaone/node';

import { run } from '@/lib/db';
import { findMemberByCustomerId, type Member } from '@/lib/auth';
import { formatDate, formatNaira } from '@/lib/format';
import { nombaone } from '@/lib/nombaone';

import type { MemberRow } from '@/lib/db';
import type { WebhookEvent } from '@nombaone/node';

/**
 * ── WHAT THE GYM HEARS FROM THE BILLING ENGINE ───────────────────────────────
 *
 * This is where a platform event becomes something a member can actually read. Every
 * branch ends in a NOTICE — a plain-English line in their Updates feed — because this app
 * sends no SMS and no email, so it must never pretend to.
 *
 * ── The webhook is a HINT, not the truth ─────────────────────────────────────
 * The payload carries only `{ reference }` — the id of the thing that changed. It does not
 * carry the customer, the amount, or the next payment date. So every branch below fetches
 * the real resource from the API before it says anything to a member. That is not extra
 * work; it is the only honest way to do it. A webhook body can be stale or replayed; the
 * API cannot.
 *
 * ── Two branches are load-bearing, not decorative ────────────────────────────
 *  1. `invoice.action_required` is the ONLY place a payable link for a failed payment ever
 *     exists. The SDK has no `invoices.pay()` and no hosted invoice URL. If this branch is
 *     missing, a member whose card bounced has literally no way to fix it — forever.
 *  2. `payment_method.attached` is how a newly added card reaches the membership. The
 *     card-capture callback does not return the new method's id, so the redirect cannot do
 *     it. Only this event knows.
 */

export const runtime = 'nodejs';

const notice = async (
  memberId: string,
  kind: string,
  title: string,
  body: string,
): Promise<void> => {
  await run(
    `INSERT INTO notices (id, member_id, kind, title, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    memberId,
    kind,
    title,
    body,
    new Date().toISOString(),
  );
};

const closeOpenPayLinks = async (memberId: string): Promise<void> => {
  await run(
    'UPDATE pay_links SET used_at = ? WHERE member_id = ? AND used_at IS NULL',
    new Date().toISOString(),
    memberId,
  );
};

const asMember = (row: MemberRow | undefined): Member | null =>
  row
    ? {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        customerId: row.customer_id,
        memberNo: row.member_no,
        since: row.created_at,
      }
    : null;

export async function POST(req: Request) {
  const secret = process.env.GYM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[gym/webhooks] GYM_WEBHOOK_SECRET is not set — cannot verify deliveries');
    return Response.json({ error: 'webhook secret not configured' }, { status: 500 });
  }

  // RAW body. Parsing and re-stringifying reorders keys and changes the bytes, which
  // breaks the signature.
  const rawBody = await req.text();
  const signature = req.headers.get('x-nombaone-signature') ?? '';

  let event: WebhookEvent;
  try {
    event = webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    const reason = error instanceof WebhookVerificationError ? error.message : String(error);
    console.warn('[gym/webhooks] rejected delivery: signature verification failed', { reason });
    return Response.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Delivery is at-least-once. Claim the event id; a replay loses the claim and does
  // nothing, so a member is never told "Payment received" twice for one payment.
  const claimed = await run(
    'INSERT OR IGNORE INTO webhook_events (event_id, received_at) VALUES (?, ?)',
    event.event.id,
    new Date().toISOString(),
  );
  if (claimed === 0) {
    return Response.json({ received: true, duplicate: true });
  }

  const type = event.type;
  const data = event.data as Record<string, unknown>;
  const reference = typeof data.reference === 'string' ? data.reference : '';

  try {
    const client = nombaone();

    /* ---------------- invoice events: money moved (or didn't) ---------------- */
    if (type.startsWith('invoice.')) {
      const invoice = await client.invoices.retrieve(reference);
      const member = asMember(await findMemberByCustomerId(invoice.customerId));
      if (!member) return Response.json({ received: true }); // not one of ours

      const money = formatNaira(invoice.totalInKobo ?? invoice.amountDueInKobo ?? 0);

      // The next payment date lives on the subscription, not the invoice.
      let nextAt: string | null = null;
      if (invoice.subscriptionId) {
        try {
          const sub = await client.subscriptions.retrieve(invoice.subscriptionId);
          nextAt = sub.currentPeriodEnd ?? null;
        } catch {
          nextAt = null;
        }
      }

      switch (type) {
        case 'invoice.paid':
          await notice(
            member.id,
            'paid',
            `Payment received — ${money}`,
            nextAt
              ? `Thanks. Your next payment comes out on ${formatDate(nextAt)}.`
              : 'Thanks — your receipt is on your account page.',
          );
          await closeOpenPayLinks(member.id); // whatever they owed is settled
          break;

        case 'invoice.payment_failed':
          await notice(
            member.id,
            'failed',
            `We couldn't take your ${money} payment`,
            "Your bank turned it down — usually an expired card, or not enough in the account. You can still train while we sort it out. Have a look at your account page.",
          );
          break;

        /**
         * 🔴 THE ONLY SOURCE OF A PAY LINK. The engine mints a fresh checkout link for the
         * unpaid invoice and sends it here. Nothing else in the SDK can produce one.
         */
        case 'invoice.action_required': {
          const link = typeof data.checkoutLink === 'string' ? data.checkoutLink : '';
          if (link) {
            // Opaque token — a member's URL never contains a platform reference.
            const token = randomBytes(16).toString('base64url');
            await run(
              `INSERT INTO pay_links (token, member_id, invoice_ref, checkout_link, amount_kobo, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              token,
              member.id,
              reference,
              link,
              invoice.amountDueInKobo ?? 0,
              new Date().toISOString(),
            );

            await notice(
              member.id,
              'action',
              `Your ${money} payment needs you`,
              'Tap "Pay now" on your account page to finish it — it only takes a moment.',
            );
          }
          break;
        }

        case 'invoice.payment_recovered':
          await notice(
            member.id,
            'recovered',
            "Sorted — you're back in",
            `${money} received. Your membership is running normally again.`,
          );
          await closeOpenPayLinks(member.id);
          break;

        default:
          break;
      }

      return Response.json({ received: true });
    }

    /* ---------------- subscription events: the membership itself ------------- */
    if (type.startsWith('subscription.')) {
      const sub = await client.subscriptions.retrieve(reference);
      const member = asMember(await findMemberByCustomerId(sub.customerId));
      if (!member) return Response.json({ received: true });

      const nextAt = sub.currentPeriodEnd;

      switch (type) {
        case 'subscription.activated':
          await notice(
            member.id,
            'joined',
            "You're in — your membership is live",
            nextAt
              ? `Welcome to Iron Republic. Your next payment comes out on ${formatDate(nextAt)}.`
              : 'Welcome to Iron Republic.',
          );
          break;

        case 'subscription.churned':
          await notice(
            member.id,
            'ended',
            'Your membership has stopped',
            "We couldn't take payment after several tries, so we've stopped your membership. You're welcome back any time — rejoining takes 30 seconds.",
          );
          break;

        case 'subscription.canceled':
          await notice(
            member.id,
            'ended',
            'Your membership has ended',
            'Nothing more will be charged. You can rejoin whenever you like.',
          );
          break;

        case 'subscription.paused':
          await notice(
            member.id,
            'paused',
            'Your membership is paused',
            "You won't be charged while it's paused.",
          );
          break;

        case 'subscription.resumed':
          await notice(member.id, 'joined', "You're back", 'Your membership is running again.');
          break;

        default:
          break;
      }

      return Response.json({ received: true });
    }

    /* ---------------- card events ------------------------------------------- */
    if (type.startsWith('payment_method.')) {
      const method = await client.paymentMethods.retrieve(reference);
      const member = asMember(await findMemberByCustomerId(method.customerId));
      if (!member) return Response.json({ received: true });

      if (type === 'payment_method.attached' && method.status === 'active') {
        await notice(
          member.id,
          'card',
          'Your new card is saved',
          "We'll use it for your next payment. You can change it any time.",
        );
      }

      if (type === 'payment_method.expiring') {
        await notice(
          member.id,
          'card',
          'Your card expires soon',
          'Add a new one before your next payment so your membership keeps running.',
        );
      }

      return Response.json({ received: true });
    }
  } catch (error) {
    // Never make the engine retry because OUR side broke. The money is already correct on
    // the platform; a missing line in an Updates feed is not worth a retry storm.
    console.error('[gym/webhooks] handler error', { type, reference, error });
  }

  return Response.json({ received: true });
}
