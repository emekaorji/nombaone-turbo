import Link from 'next/link';
import { redirect } from 'next/navigation';

import { currentMember } from '@/lib/auth';
import { loadMembership } from '@/lib/membership';
import { nextPaymentLine } from '@/lib/copy';

export const dynamic = 'force-dynamic';

/** How long we keep saying "checking…" before we admit we don't know. */
const PATIENCE_MS = 2 * 60 * 1000;

/**
 * Where the payment page sends them back to.
 *
 * ⚠ Coming back here is NOT proof that the money arrived. The bank tells the engine, and the engine
 * tells us — the browser redirect is just the member's browser. So if the membership hasn't started
 * yet, we say so honestly and refresh, rather than congratulating someone whose card was declined.
 *
 * ── TWO WAYS THIS PAGE USED TO LIE BY OMISSION ───────────────────────────────
 *
 * 1. It accepted ONLY `active` / `ending` as confirmed, so it was really asking "is this membership
 *    healthy RIGHT NOW?" when the only question it has any business asking is "did the payment that
 *    brought you here land?". A member whose JOIN succeeded and whose later RENEWAL then failed came
 *    back to this URL and was told, forever, that we were still confirming a payment we had
 *    confirmed hours earlier. That is exactly what happened on live.
 *
 * 2. It refreshed FOREVER. Someone who abandoned the Nomba page, or whose card was declined, sat on
 *    a screen reading "you don't need to do anything" while nothing was ever going to happen. A
 *    spinner with no ceiling isn't patience; it's a dead end with good manners.
 *
 * So: once the membership EXISTS, this page's job is done — and if it isn't healthy, the account
 * page is the honest place to explain why. And the waiting is bounded.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>;
}) {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const { since } = await searchParams;
  const v = await loadMembership(member);

  // "Has the membership started?" — NOT "is it healthy?".
  const notStarted = v.state === 'none' || v.state === 'pending';

  // It started, but something needs them (a failed payment, a hold, a pause). The account page names
  // it and offers the fix; a cheerful welcome here would be worse than useless.
  if (!notStarted && v.state !== 'active' && v.state !== 'ending') redirect('/account');

  if (notStarted) {
    const startedAt = Number(since) || Date.now();
    const waited = Date.now() - startedAt;

    if (waited <= PATIENCE_MS) {
      // Carry the start time across the refresh, so the wait is bounded instead of eternal.
      return (
        <div className="mx-auto max-w-2xl px-6 py-20">
          <meta httpEquiv="refresh" content={`3;url=/welcome?since=${startedAt}`} />
          <h1 className="text-2xl font-bold tracking-tight">We&apos;re confirming your payment.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-fog">
            This takes a few seconds for a card, and a little longer for a bank transfer. This page
            updates itself — you don&apos;t need to do anything.
          </p>
          <p className="mt-6 text-[12.5px] text-dim">Checking…</p>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-2xl font-bold tracking-tight">We haven&apos;t got your payment.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-fog">
          Nothing has been taken from your account. If you didn&apos;t finish paying, you can pick up
          where you left off. If you believe you did pay, wait a minute and refresh — and if
          it&apos;s still not here, tell us at the front desk and we&apos;ll sort it out.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {v.resumeCheckoutLink ? (
            <a
              href={v.resumeCheckoutLink}
              className="rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal"
            >
              Finish paying
            </a>
          ) : (
            <Link
              href="/memberships"
              className="rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal"
            >
              Start again
            </Link>
          )}
          <Link
            href="/account"
            className="rounded border border-line px-5 py-2.5 text-[13px] font-semibold text-fog"
          >
            My account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-[13px] font-semibold text-mint">✅ You&apos;re in</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Welcome to Iron Republic, {member.name.split(' ')[0]}.
      </h1>
      <p className="mt-3 text-[14px] text-fog">
        Your <span className="text-chalk">{v.planName}</span> membership is live from today.
      </p>

      <div className="mt-8 rounded-lg border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
          What happens next
        </p>
        <p className="mt-3 text-[15px] font-semibold leading-snug" data-testid="welcome-next">
          💳 {nextPaymentLine(v)}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-fog">
          It&apos;s always shown on your account page before it happens. To stop it: Account → Cancel
          membership. Two taps, any time.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/account"
          className="rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal"
        >
          Go to my account
        </Link>
      </div>

      <p className="mt-10 text-[12.5px] text-dim">
        Bring on your first visit: your ID, indoor trainers, a water bottle. Ask for Coach Femi at
        the front desk.
      </p>
    </div>
  );
}
