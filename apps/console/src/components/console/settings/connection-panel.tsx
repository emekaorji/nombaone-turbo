const rows = [
  { label: 'Parent account', value: 'nma_ac8f2' },
  { label: 'Subaccount, sandbox', value: 'nma_sub_9d1' },
  { label: 'Settlement bank', value: 'GTBank ···· 1234' },
];

export function ConnectionPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-foreground">Nomba connection</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-[9px] py-[3px]">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="text-[11.5px] font-medium text-success">Active</span>
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`flex items-center justify-between py-2 ${i < rows.length - 1 ? 'border-b border-border' : ''}`}
          >
            <span className="text-[12.5px] text-subtle-foreground">{r.label}</span>
            <span className="font-mono text-[12.5px] text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-subtle-foreground">Settlement and payout require an active connection.</p>
    </div>
  );
}
