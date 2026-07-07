'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, X } from 'lucide-react';

import { revokeInvitationAction } from '@/lib/team-actions';
import type { PendingInvite } from '@/lib/team';

export function PendingInviteRow({ invite, canManage }: { invite: PendingInvite; canManage: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function revoke() {
    start(async () => {
      await revokeInvitationAction(invite.reference);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2.5 py-[9px]">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Mail className="size-[13px] text-subtle-foreground" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-foreground">{invite.email}</span>
        <span className="truncate text-[11px] text-subtle-foreground">Invited {invite.invited} · {invite.role}</span>
      </div>
      <span className="rounded-full bg-warning-bg px-[9px] py-0.5 text-[11px] font-medium text-warning">pending</span>
      {canManage ? (
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          title="Revoke invite"
          className="text-subtle-foreground transition-colors hover:text-danger disabled:opacity-50"
        >
          <X className="size-[15px]" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
