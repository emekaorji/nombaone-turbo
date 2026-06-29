'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@nombaone/ui/components/ui/button';

import { payAction } from '@/lib/actions';

/**
 * The pay client island for an OPEN (pending) resource.
 *
 * Pressing "Pay" runs the `payAction` server action behind a `useTransition` so
 * the button shows a pending state. In production this is the point where the
 * page hands off to Nomba's hosted-checkout (redirect or iframe) to capture the
 * instrument; here the action drives the documented re-verified confirm stub
 * directly. On success we toast + `router.refresh()` so the revalidated,
 * now-settled page re-renders with its freshly-derived status; on failure we
 * surface the structured message.
 *
 * Mirrors the console's action islands: the server action is the security +
 * correctness boundary (it re-resolves scope server-side and posts the ledger
 * transaction) — this is only the UX layer. The button is the sole input, so
 * the reference is passed in from the RSC and never re-typed by the user.
 */
export function PayForm({ reference }: { reference: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onPay() {
    startTransition(async () => {
      const result = await payAction(reference);
      if (result.ok) {
        toast.success('Payment successful');
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" className="h-11 w-full" disabled={pending} onClick={onPay}>
        {pending ? 'Processing…' : 'Pay now'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll complete payment on Nomba&apos;s secure hosted checkout.
      </p>
    </div>
  );
}
