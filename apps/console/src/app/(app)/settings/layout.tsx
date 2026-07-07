import type { ReactNode } from 'react';

import { SettingsTabs } from '@/components/console/settings-tabs';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-[18px] px-7 py-6">
      <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Settings</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}
