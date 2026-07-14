import { redirect } from 'next/navigation';

import { CancelForm } from '@/components/cancel-form';
import { cancelPromise } from '@/lib/copy';
import { currentMember } from '@/lib/auth';
import { loadMembership } from '@/lib/membership';

export const dynamic = 'force-dynamic';

/**
 * The cancel screen's only job is to be HONEST, not to trap.
 *
 * It names the exact date they keep access until — the same date the dashboard shows,
 * computed from the same place, because a member who is told two different dates will
 * (rightly) never trust either.
 *
 * There is no "are you sure?? you'll lose everything!!" theatre, and — deliberately — no
 * "undo" button afterwards. The engine cannot un-cancel a membership, so offering it would
 * be a lie the first time someone pressed it. The honest way back is to rejoin.
 */
export default async function CancelPage() {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const v = await loadMembership(member);
  if (!v.subscriptionId || v.state === 'ended' || v.state === 'ending') redirect('/account');

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Cancel your membership?</h1>

      <div className="mt-6 rounded-lg border border-line bg-panel p-6">
        <p className="text-[14px] leading-relaxed" data-testid="cancel-promise">
          {cancelPromise(v)}
        </p>
        <p className="mt-3 text-[13px] text-fog">
          No fee, no notice period, and you can rejoin whenever you like.
        </p>
      </div>

      <CancelForm />
    </div>
  );
}
