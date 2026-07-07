export const dynamic = 'force-dynamic';

import { BillingSettingsForm } from '@/components/console/settings/billing-settings-form';
import { getBillingSettings } from '@/lib/billing-settings';

export default async function BillingSettingsPage() {
  const data = await getBillingSettings();
  if (!data) return null;
  return <BillingSettingsForm settings={data.settings} canEdit={data.canEdit} />;
}
