import { ConnectionPanel } from '@/components/console/settings/connection-panel';

export default function ConnectionSettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConnectionPanel className="w-full max-w-[560px] self-start" />
    </div>
  );
}
