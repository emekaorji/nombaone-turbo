import { ChevronDown } from 'lucide-react';

import { ConnectionPanel } from '@/components/console/settings/connection-panel';
import { TeamPanel } from '@/components/console/settings/team-panel';

export default function OrganizationSettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 gap-[18px]">
      {/* Org form */}
      <div className="flex flex-1 flex-col gap-4 self-start rounded-lg border border-border bg-surface-1 p-5">
        <span className="text-[15px] font-semibold text-foreground">Organization</span>

        <label className="flex flex-col gap-[7px]">
          <span className="text-[12.5px] font-medium text-foreground">Display name</span>
          <input
            defaultValue="Acme Ltd"
            className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-border-strong"
          />
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className="text-[12.5px] font-medium text-foreground">Support email</span>
          <input
            defaultValue="support@acme.io"
            className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-border-strong"
          />
        </label>

        <div className="flex gap-4">
          {/* Primary color */}
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className="text-[12.5px] font-medium text-foreground">Primary color</span>
            <div className="flex items-center gap-2.5 rounded border border-border bg-surface-2 px-3 py-2">
              <span className="size-5 rounded-sm bg-accent" />
              <span className="font-mono text-[13px] text-foreground">#0bdfa3</span>
            </div>
          </div>
          {/* Settlement mode */}
          <div className="flex flex-1 flex-col gap-[7px]">
            <span className="text-[12.5px] font-medium text-foreground">Settlement mode</span>
            <div className="flex items-center justify-between rounded border border-border bg-surface-2 px-3 py-2.5">
              <span className="text-[13px] text-foreground">Automatic</span>
              <ChevronDown className="size-[15px] text-subtle-foreground" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        {/* Quota */}
        <div className="flex flex-col gap-[7px]">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-foreground">Monthly request quota</span>
            <span className="font-mono text-[12px] text-muted-foreground">412,908 / 1,000,000</span>
          </div>
          <div className="h-[7px] w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent" style={{ width: '41.3%' }} />
          </div>
        </div>

        <button className="mt-1 self-start rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          Save changes
        </button>
      </div>

      {/* Right rail */}
      <div className="flex w-[360px] flex-col gap-4">
        <ConnectionPanel />
        <TeamPanel className="flex-1" />
      </div>
    </div>
  );
}
