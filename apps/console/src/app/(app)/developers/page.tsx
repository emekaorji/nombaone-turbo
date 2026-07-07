export const dynamic = 'force-dynamic';

import { ApiKeysScreen } from '@/components/console/developers/api-keys-screen';
import { listKeys } from '@/lib/api-keys';

export default async function DevelopersPage() {
  const { items, canManage, mode } = await listKeys();
  return <ApiKeysScreen keys={items} canManage={canManage} mode={mode} />;
}
