import { Plus } from 'lucide-react';

import { SubscriptionsSkeleton } from '@/components/console/states/subscriptions-skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Subscriptions</h1>
          <p className="text-[14px] text-muted-foreground">
            The book of recurring revenue. Every subscription, its health, and what needs you.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded bg-accent/60 px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground">
          <Plus className="size-4" strokeWidth={2} />
          New subscription
        </div>
      </div>
      <SubscriptionsSkeleton />
    </div>
  );
}
