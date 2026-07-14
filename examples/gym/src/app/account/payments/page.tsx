import { redirect } from 'next/navigation';

import { currentMember } from '@/lib/auth';
import { loadMembership } from '@/lib/membership';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const v = await loadMembership(member);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Your payments</h1>
      <p className="mt-2 text-[13.5px] text-fog">Everything you&apos;ve paid us, newest first.</p>

      {v.payments.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-panel p-6 text-[13px] text-fog">
          Nothing yet.
        </p>
      ) : (
        <table className="mt-8 w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-dim">
              <th className="pb-2 font-semibold">Date</th>
              <th className="pb-2 font-semibold">What for</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
              <th className="pb-2 pl-4 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {v.payments.map((p, i) => (
              <tr key={i}>
                <td className="py-3 text-fog">{p.when}</td>
                <td className="py-3">{p.what}</td>
                <td className="py-3 text-right font-medium">{p.amount}</td>
                <td className="py-3 pl-4 text-right">
                  <span className={p.failed ? 'text-blood' : 'text-fog'}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
