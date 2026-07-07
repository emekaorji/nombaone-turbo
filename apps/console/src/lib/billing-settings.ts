import { db } from '@nombaone/core-db/serverless';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { getOrgBillingSettings } from '@nombaone/sara/org/billing-settings';

import { getSession } from '@/lib/auth';

export type BillingSettingsView = {
  dunningMaxAttempts: number;
  dunningIntervalsHours: number[];
  dunningMaxWindowHours: number;
  gracePeriodHours: number;
  paydayBiasEnabled: boolean;
  paydayDays: number[];
  paydayPullForwardDays: number;
  partialCollectionEnabled: boolean;
  defaultCollectionMethod: 'charge_automatically' | 'send_invoice';
  commsEnabled: boolean;
};

export async function getBillingSettings(): Promise<{ settings: BillingSettingsView; canEdit: boolean } | null> {
  const session = await getSession();
  if (!session) return null;
  const s = await getOrgBillingSettings(db, { organizationId: session.organizationId, mode: session.mode });
  return {
    settings: {
      dunningMaxAttempts: s.dunningMaxAttempts,
      dunningIntervalsHours: s.dunningIntervalsHours,
      dunningMaxWindowHours: s.dunningMaxWindowHours,
      gracePeriodHours: s.gracePeriodHours,
      paydayBiasEnabled: s.paydayBiasEnabled,
      paydayDays: s.paydayDays,
      paydayPullForwardDays: s.paydayPullForwardDays,
      partialCollectionEnabled: s.partialCollectionEnabled,
      defaultCollectionMethod: s.defaultCollectionMethod,
      commsEnabled: s.commsEnabled,
    },
    canEdit: can(session.user.role as OrgUserRole, 'billing:write'),
  };
}
