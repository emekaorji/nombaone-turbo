'use client';

import { ErrorState } from '@/components/console/states/error-state';

export default function SubscriptionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Subscriptions</h1>
        <p className="text-[14px] text-muted-foreground">
          The book of recurring revenue. Every subscription, its health, and what needs you.
        </p>
      </div>
      <ErrorState onRetry={reset} requestId={error.digest ?? 'req_7fa2c9e1b0'} />
    </div>
  );
}
