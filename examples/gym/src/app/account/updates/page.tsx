import { redirect } from 'next/navigation';

import { currentMember } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatShortDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
}

/**
 * What the gym has told this member.
 *
 * These rows are written by the webhook handler as the engine reports real events. This
 * app sends no SMS and no email, so this feed is the honest answer to "how will I know?" —
 * and we say exactly that, rather than promising a text message we never send.
 */
export default async function UpdatesPage() {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const notices = db()
    .prepare('SELECT * FROM notices WHERE member_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(member.id) as Notice[];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Updates from us</h1>
      <p className="mt-2 text-[13.5px] text-fog">
        Receipts, and anything that needs you. This is where we tell you things.
      </p>

      {notices.length === 0 ? (
        <p className="mt-8 rounded-lg border border-line bg-panel p-6 text-[13px] text-fog">
          Nothing yet.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {notices.map((n) => (
            <li key={n.id} className="rounded-lg border border-line bg-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[14px] font-semibold">{n.title}</p>
                <span className="shrink-0 text-[11.5px] text-dim">
                  {formatShortDate(n.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fog">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
