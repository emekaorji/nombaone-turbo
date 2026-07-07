import { InviteButton } from '@/components/console/settings/invite-button';
import { PendingInviteRow } from '@/components/console/settings/pending-invite-row';
import type { PendingInvite } from '@/lib/team';
import type { OrgMember } from '@/lib/org-settings';

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '·'
  );
}

function roleStyle(role: string): { badge: string; text: string } {
  if (role === 'owner') return { badge: 'bg-accent-muted', text: 'text-accent' };
  if (role === 'admin') return { badge: 'bg-info-bg', text: 'text-info' };
  return { badge: 'bg-surface-3', text: 'text-muted-foreground' };
}

export function TeamPanel({
  members,
  pendingInvites = [],
  canManage = false,
  className = '',
}: {
  members: OrgMember[];
  pendingInvites?: PendingInvite[];
  canManage?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2.5 rounded-lg border border-border bg-surface-1 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-foreground">Team</span>
        <InviteButton canInvite={canManage} />
      </div>
      {members.map((m, i) => {
        const s = roleStyle(m.role);
        return (
          <div
            key={m.email}
            className={`flex items-center gap-2.5 py-[9px] ${i < members.length - 1 || pendingInvites.length > 0 ? 'border-b border-border' : ''}`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10.5px] font-semibold text-muted-foreground">
              {initials(m.name)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium text-foreground">{m.name}</span>
              <span className="truncate text-[11px] text-subtle-foreground">{m.email}</span>
            </div>
            <span className={`rounded-full px-[9px] py-0.5 text-[11px] font-medium ${s.badge} ${s.text}`}>{m.role}</span>
          </div>
        );
      })}
      {pendingInvites.map((inv, i) => (
        <div key={inv.reference} className={i < pendingInvites.length - 1 ? 'border-b border-border' : ''}>
          <PendingInviteRow invite={inv} canManage={canManage} />
        </div>
      ))}
    </div>
  );
}
