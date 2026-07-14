import { redirect } from 'next/navigation';

import { ChangePlanForm } from '@/components/change-plan-form';
import { catalog } from '@/lib/nombaone';
import { currentMember } from '@/lib/auth';
import { formatNaira } from '@/lib/format';
import { loadMembership } from '@/lib/membership';

export const dynamic = 'force-dynamic';

export default async function ChangePlanPage() {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const v = await loadMembership(member);
  if (!v.subscriptionId) redirect('/memberships');

  const cat = await catalog();
  const options = cat.map((c) => ({
    id: c.price.id,
    name: c.def.displayName,
    amount: formatNaira(c.price.unitAmountInKobo),
    cadence: c.def.isFlex ? 'per 10 minutes' : 'every month',
  }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Change your plan</h1>
      <p className="mt-2 text-[13.5px] text-fog">
        Move up or down whenever you like. The change takes effect straight away.
      </p>
      <ChangePlanForm options={options} currentPriceId={v.priceId} />
    </div>
  );
}
