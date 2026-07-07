/** Loading skeleton for the subscriptions list (matches the States board · LOADING). */
export function SubscriptionsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-[14px] rounded-lg border border-border bg-surface-1 p-[18px]">
      {/* Skeleton command bar */}
      <div className="flex items-center justify-between rounded bg-surface-2 px-4 py-3.5">
        <div className="flex flex-col gap-2">
          <div className="h-[9px] w-20 rounded-full bg-surface-3" />
          <div className="h-4 w-[120px] rounded-full bg-border-strong" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-[9px] w-[60px] rounded-full bg-surface-3" />
          <div className="h-4 w-[90px] rounded-full bg-border-strong" />
        </div>
      </div>
      {/* Skeleton rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-1 py-3 ${i < 4 ? 'border-b border-border' : ''}`}>
          <div className="size-[26px] shrink-0 rounded-full bg-surface-2" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-2.5 w-[140px] rounded-full bg-surface-3" />
            <div className="h-2 w-[90px] rounded-full bg-surface-2" />
          </div>
          <div className="h-1.5 w-20 rounded-full bg-surface-2" />
          <div className="h-3 w-[54px] rounded-full bg-surface-3" />
        </div>
      ))}
    </div>
  );
}
