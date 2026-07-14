export const dynamic = 'force-dynamic';

import { OrgSettingsForm } from '@/components/console/settings/org-settings-form';
import { TeamPanel } from '@/components/console/settings/team-panel';
import { getSession } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-settings';
import { getPendingInvitations } from '@/lib/team';
import { can, type OrgUserRole } from '@nombaone/sara/auth';

export default async function OrganizationSettingsPage() {
  const [data, pendingInvites, session] = await Promise.all([
    getOrgSettings(),
    getPendingInvitations(),
    getSession(),
  ]);
  if (!data) return null;
  const canManage = session ? can(session.user.role as OrgUserRole, 'members:manage') : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] lg:flex-row">
      <OrgSettingsForm org={data.org} canEdit={data.canEdit} />
      <div className="flex w-full flex-col gap-4 lg:w-[360px]">
        <TeamPanel members={data.members} pendingInvites={pendingInvites} canManage={canManage} className="flex-1" />
      </div>
    </div>
  );
}
