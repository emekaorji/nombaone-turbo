import { notFound, redirect } from 'next/navigation';

import { currentMember } from '@/lib/auth';
import { get } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * One tap to fix a failed payment.
 *
 * ── Why this route exists at all ─────────────────────────────────────────────
 * The SDK has no `invoices.pay()` and no hosted invoice URL. The ONLY payable link for a
 * failed charge that ever exists is the one the engine mints and hands to us on the
 * `invoice.action_required` webhook. Our handler stores it against an opaque token, and
 * this page redeems it.
 *
 * ── Why the token is opaque ──────────────────────────────────────────────────
 * A member's URL never contains a platform reference. `/pay/nbo…inv` would leak an
 * internal id into their browser history, their screenshots and their WhatsApp messages —
 * and would be guessable. `randomBytes(16)` is not.
 *
 * ── Why it is member-scoped ──────────────────────────────────────────────────
 * A token is bound to the member it was minted for. Someone who gets hold of another
 * member's link cannot pay (or view) their bill.
 */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const member = await currentMember();
  if (!member) redirect('/signin');

  const link = await get<{ checkout_link: string; used_at: string | null }>(
    `SELECT checkout_link, used_at FROM pay_links
     WHERE token = ? AND member_id = ?`,
    token,
    member.id
  );

  // Not theirs, or never existed. 404 — never confirm that someone else's link is real.
  if (!link) notFound();

  // Already settled (the `invoice.paid` webhook closes these). Don't send them to a dead
  // payment page — tell them the good news.
  if (link.used_at) redirect('/account');

  redirect(link.checkout_link);
}
