export const dynamic = 'force-dynamic';

import { TeamPanel } from '@/components/console/settings/team-panel';
import { getSession } from '@/lib/auth';
import { listMembers } from '@/lib/org-settings';
import { getPendingInvitations } from '@/lib/team';
import { can, type OrgUserRole } from '@nombaone/sara/auth';

export default async function TeamSettingsPage() {
  const [members, pendingInvites, session] = await Promise.all([
    listMembers(),
    getPendingInvitations(),
    getSession(),
  ]);
  const canManage = session ? can(session.user.role as OrgUserRole, 'members:manage') : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TeamPanel
        members={members}
        pendingInvites={pendingInvites}
        canManage={canManage}
        className="w-full max-w-[640px] self-start"
      />
    </div>
  );
}
