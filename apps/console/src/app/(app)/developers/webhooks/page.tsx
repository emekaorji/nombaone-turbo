export const dynamic = 'force-dynamic';

import { WebhooksScreen } from '@/components/console/developers/webhooks-screen';
import { listDeliveries, listEndpoints } from '@/lib/webhooks';

export default async function WebhooksPage() {
  const [{ endpoints, canManage, mode }, deliveries] = await Promise.all([listEndpoints(), listDeliveries()]);
  return <WebhooksScreen endpoints={endpoints} deliveries={deliveries} canManage={canManage} mode={mode} />;
}
