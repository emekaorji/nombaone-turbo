export const dynamic = 'force-dynamic';

import { ConnectionPanel } from '@/components/console/settings/connection-panel';
import { getNombaConnection } from '@/lib/nomba-connection';

export default async function ConnectionSettingsPage() {
  const connection = await getNombaConnection();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConnectionPanel connection={connection} className="w-full max-w-[560px] self-start" />
    </div>
  );
}
