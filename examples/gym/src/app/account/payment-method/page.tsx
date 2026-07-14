import { redirect } from 'next/navigation';

import { currentMember } from '@/lib/auth';
import { loadMembership } from '@/lib/membership';
import { startCardUpdateAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function PaymentMethodPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const { added } = await searchParams;
  const v = await loadMembership(member);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">How you pay</h1>

      {added ? (
        <p className="mt-5 rounded border border-mint/40 bg-mint/10 px-4 py-3 text-[13px] text-mint">
          Thanks — we&apos;re saving your card now. It&apos;ll show here in a moment.
        </p>
      ) : null}

      <div className="mt-6 rounded-lg border border-line bg-panel p-6">
        {v.card ? (
          <>
            <p className="text-[15px]">
              💳 {v.card.brand} ending {v.card.last4}
              {v.card.expiry ? <span className="text-dim"> · Expires {v.card.expiry}</span> : null}
            </p>
            <p className="mt-2 text-[13px] text-fog">
              This is the card we&apos;ll use for your next payment.
            </p>
          </>
        ) : (
          <p className="text-[13.5px] text-fog">
            You don&apos;t have a card saved yet, so your membership can&apos;t renew on its own.
            Add one and it takes care of itself.
          </p>
        )}

        <form action={startCardUpdateAction} className="mt-5">
          <button
            type="submit"
            className="rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal"
          >
            {v.card ? 'Use a different card' : 'Add a card'}
          </button>
        </form>

        <p className="mt-4 text-[12px] text-dim">
          🔒 We never see your full card number. Your bank checks the card with a small ₦100 charge,
          which is refunded.
        </p>
      </div>
    </div>
  );
}
