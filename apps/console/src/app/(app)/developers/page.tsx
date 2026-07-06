import { Plus, KeyRound, Copy } from 'lucide-react';

import { DeveloperTabs } from '@/components/console/developer-tabs';

const keys = [
  { name: 'Production server', prefix: 'nbo_sandbox_ab12••••34', scopes: ['subscriptions:write', 'invoices:read'], more: 6, lastUsed: '2m ago', created: '12 Jun' },
  { name: 'CI pipeline', prefix: 'nbo_sandbox_7f3d••••9a', scopes: ['events:read', 'webhooks:read'], more: 2, lastUsed: '1h ago', created: '3 Feb' },
  { name: 'Analytics reader', prefix: 'nbo_sandbox_c8e1••••2b', scopes: ['metrics:read'], more: 0, lastUsed: '—', created: '8 Mar' },
];

export default function DevelopersPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          Create key
        </button>
      </div>

      <DeveloperTabs />

      {/* Secret banner (reveal once) */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-accent-border bg-surface-2 px-[18px] py-4">
        <div className="flex items-center gap-2.5">
          <KeyRound className="size-4 text-accent" strokeWidth={2} />
          <span className="text-[14px] font-semibold text-foreground">Save your new secret key</span>
          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">Sandbox</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Copy it now. For your security, Nomba One will not show this secret again.
        </p>
        <div className="flex items-center gap-2.5">
          <div className="flex-1 truncate rounded border border-border bg-background px-3 py-2.5 font-mono text-[13px] text-foreground">
            nbo_sandbox_9f2a7c4b1e8d6a3f5c2b9e7d4a1f8c6b
          </div>
          <button className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-[9px] text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
            <Copy className="size-3.5" strokeWidth={2} />
            Copy
          </button>
        </div>
      </div>

      {/* Keys table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">KEY</span>
          <span className="w-[320px]">SCOPES</span>
          <span className="w-[110px]">LAST USED</span>
          <span className="w-[90px]">CREATED</span>
          <span className="w-[80px]" />
        </div>
        {keys.map((k, i) => (
          <div key={k.name} className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < keys.length - 1 ? 'border-b border-border' : ''}`}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-mono text-[12.5px] text-foreground">{k.prefix}</span>
              <span className="truncate text-[11.5px] text-subtle-foreground">{k.name}</span>
            </div>
            <div className="flex w-[320px] items-center gap-1.5">
              {k.scopes.map((sc) => (
                <span key={sc} className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {sc}
                </span>
              ))}
              {k.more > 0 ? <span className="text-[11.5px] text-subtle-foreground">+{k.more}</span> : null}
            </div>
            <span className="w-[110px] text-[12.5px] text-muted-foreground">{k.lastUsed}</span>
            <span className="w-[90px] text-[12.5px] text-muted-foreground">{k.created}</span>
            <div className="w-[80px]">
              <button className="text-[12.5px] text-danger hover:underline">Revoke</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
