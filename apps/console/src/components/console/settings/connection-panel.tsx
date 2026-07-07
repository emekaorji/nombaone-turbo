import type { NombaConnection } from '@/lib/nomba-connection';

const STATUS: Record<NombaConnection['status'], { label: string; bg: string; dot: string; text: string }> = {
  not_connected: { label: 'Not connected', bg: 'bg-surface-2', dot: 'bg-subtle-foreground', text: 'text-muted-foreground' },
  pending: { label: 'Pending', bg: 'bg-warning-bg', dot: 'bg-warning', text: 'text-warning' },
  active: { label: 'Active', bg: 'bg-success-bg', dot: 'bg-success', text: 'text-success' },
  suspended: { label: 'Suspended', bg: 'bg-danger-bg', dot: 'bg-danger', text: 'text-danger' },
};

export function ConnectionPanel({ connection, className = '' }: { connection: NombaConnection; className?: string }) {
  const s = STATUS[connection.status];
  const connected = connection.status !== 'not_connected';

  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-foreground">Nomba connection</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
          <span className={`size-1.5 rounded-full ${s.dot}`} />
          <span className={`text-[11.5px] font-medium ${s.text}`}>{s.label}</span>
        </span>
      </div>

      {connected ? (
        <div className="flex flex-col">
          {[
            { label: 'Parent account', value: connection.parentAccountId ?? '—' },
            { label: 'Sub-account', value: connection.subAccountId ?? 'not yet provisioned' },
          ].map((r, i, arr) => (
            <div
              key={r.label}
              className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="text-[12.5px] text-subtle-foreground">{r.label}</span>
              <span className="font-mono text-[12.5px] text-foreground">{r.value}</span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-subtle-foreground">
            Settlement and payout turn on when this reads Active. Billing works in sandbox meanwhile.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-muted-foreground">
            Your settlement sub-account is provisioned by Nomba — it appears here as Active once Nomba enables it. Billing
            works in sandbox meanwhile; live settlement and payout turn on when this connection is active.
          </p>
        </div>
      )}
    </div>
  );
}
