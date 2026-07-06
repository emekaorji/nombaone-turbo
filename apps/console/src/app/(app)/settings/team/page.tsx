import { TeamPanel } from '@/components/console/settings/team-panel';

export default function TeamSettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TeamPanel className="w-full max-w-[640px] self-start" />
    </div>
  );
}
