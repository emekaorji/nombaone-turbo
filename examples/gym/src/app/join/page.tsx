import Link from 'next/link';
import { redirect } from 'next/navigation';

import { JoinForm } from '@/components/join-form';
import { catalog } from '@/lib/nombaone';
import { currentMember } from '@/lib/auth';
import { formatNaira } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ price?: string }>;
}) {
  const { price } = await searchParams;
  const cat = await catalog();
  const entry = cat.find((c) => c.price.id === price);

  // No plan picked (or a stale link) — send them back to choose one rather than
  // guessing on their behalf.
  if (!entry) redirect('/memberships');

  // Already signed in? They don't need to make a second account.
  const member = await currentMember();
  if (member) redirect('/account');

  const { def, price: p } = entry;

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <p className="text-[12px] uppercase tracking-wider text-dim">Step 1 of 2</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Join Iron Republic</h1>
      <p className="mt-2 text-[13.5px] text-fog">
        Your details first, then payment.{' '}
        <Link href="/memberships" className="text-ember hover:underline">
          Change membership
        </Link>
      </p>

      <div className="mt-10">
        <JoinForm
          priceId={p.id}
          planName={def.displayName}
          amount={formatNaira(p.unitAmountInKobo)}
          cadenceLabel={def.isFlex ? 'per 10 minutes' : 'every month'}
          isFlex={Boolean(def.isFlex)}
          sandbox={(process.env.NOMBAONE_API_KEY ?? '').startsWith('nbo_sandbox_')}
        />
      </div>

      <p className="mt-8 text-[12.5px] text-dim">
        Already a member?{' '}
        <Link href="/signin" className="text-ember hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
