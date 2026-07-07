export const dynamic = 'force-dynamic';

import { ConnectionPanel } from '@/components/console/settings/connection-panel';
import { OrgSettingsForm } from '@/components/console/settings/org-settings-form';
import { TeamPanel } from '@/components/console/settings/team-panel';
import { getSession } from '@/lib/auth';
import { getNombaConnection } from '@/lib/nomba-connection';
import { getOrgSettings } from '@/lib/org-settings';
import { getPendingInvitations } from '@/lib/team';
import { can, type OrgUserRole } from '@nombaone/sara/auth';

export default async function OrganizationSettingsPage() {
  const [data, connection, pendingInvites, session] = await Promise.all([
    getOrgSettings(),
    getNombaConnection(),
    getPendingInvitations(),
    getSession(),
  ]);
  if (!data) return null;
  const canManage = session ? can(session.user.role as OrgUserRole, 'members:manage') : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] lg:flex-row">
      <OrgSettingsForm org={data.org} canEdit={data.canEdit} />
      <div className="flex w-full flex-col gap-4 lg:w-[360px]">
        <ConnectionPanel connection={connection} />
        <TeamPanel members={data.members} pendingInvites={pendingInvites} canManage={canManage} className="flex-1" />
      </div>
    </div>
  );
}
