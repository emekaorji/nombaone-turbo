export const dynamic = 'force-dynamic';

import { FlaskConical } from 'lucide-react';

import { DeveloperTabs } from '@/components/console/developer-tabs';
import { TestInstrumentsPanel } from '@/components/console/developers/test-instruments-panel';
import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { getSession } from '@/lib/auth';
import { getTestInstrumentData } from '@/lib/test-instruments';

export default async function TestModePage() {
  const [session, data] = await Promise.all([getSession(), getTestInstrumentData()]);
  const mode = session?.mode ?? 'sandbox';
  const isLive = mode === 'live';
  const canManage = session ? can(session.user.role as OrgUserRole, 'money:write') : false;

  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
      </div>

      <DeveloperTabs />

      {/* Env banner — mode-aware */}
      <div className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-3 ${isLive ? 'border-border bg-surface-2' : 'border-warning bg-warning-bg'}`}>
        <FlaskConical className={`size-4 shrink-0 ${isLive ? 'text-muted-foreground' : 'text-warning'}`} strokeWidth={1.75} />
        <p className="text-[12.5px] text-foreground">
          {isLive
            ? 'You are in live mode. Test-mode instruments only exist in sandbox — switch to sandbox to use them. Live behavior is byte-identical.'
            : 'Sandbox mode. These instruments drive deterministic outcomes and do not exist on live; live behavior is byte-identical.'}
        </p>
      </div>

      {isLive ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-surface-1 p-8 text-center text-[13px] text-muted-foreground">
          Switch to sandbox mode to use the test instruments.
        </div>
      ) : (
        <TestInstrumentsPanel data={data} canManage={canManage} />
      )}
    </div>
  );
}
