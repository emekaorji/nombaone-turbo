import { orgUsersTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { getOrgBillingSettings } from '@nombaone/sara/org/billing-settings';
import { asc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type OrgMember = { name: string; email: string; role: string };
export type OrgSettingsView = {
  org: {
    name: string;
    supportEmail: string;
    primaryColorHex: string;
    settlementMode: 'split_at_collection' | 'collect_then_payout';
    monthlyRequestQuota: number | null;
  };
  members: OrgMember[];
  canEdit: boolean;
};

export async function getOrgSettings(): Promise<OrgSettingsView | null> {
  const session = await getSession();
  if (!session) return null;

  const [settings, members] = await Promise.all([
    getOrgBillingSettings(db, { organizationId: session.organizationId, mode: session.mode }),
    db
      .select({ name: orgUsersTable.name, email: orgUsersTable.email, role: orgUsersTable.role })
      .from(orgUsersTable)
      .where(eq(orgUsersTable.organizationId, session.organizationId))
      .orderBy(asc(orgUsersTable.createdAt)),
  ]);

  return {
    org: {
      name: session.org.name,
      supportEmail: settings.branding.supportEmail ?? '',
      primaryColorHex: settings.branding.primaryColorHex ?? '#0bdfa3',
      settlementMode: settings.settlementMode,
      monthlyRequestQuota: settings.monthlyRequestQuota,
    },
    members,
    canEdit: can(session.user.role as OrgUserRole, 'billing:write'),
  };
}

export async function listMembers(): Promise<OrgMember[]> {
  const session = await getSession();
  if (!session) return [];
  return db
    .select({ name: orgUsersTable.name, email: orgUsersTable.email, role: orgUsersTable.role })
    .from(orgUsersTable)
    .where(eq(orgUsersTable.organizationId, session.organizationId))
    .orderBy(asc(orgUsersTable.createdAt));
}
