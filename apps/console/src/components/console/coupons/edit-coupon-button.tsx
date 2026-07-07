'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { X } from 'lucide-react';

import { updateCouponAction } from '@/lib/coupons-actions';

export function EditCouponButton({
  couponRef,
  code,
  maxRedemptions,
  redeemByISO,
}: {
  couponRef: string;
  code: string;
  maxRedemptions: number | null;
  redeemByISO: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const r = await updateCouponAction(couponRef, formData);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(r.message ?? 'Could not save.');
      }
    });
  }

  return (
    <>
      <button onClick={() => { setError(null); setOpen(true); }} className="text-[12px] text-accent transition-opacity hover:opacity-80">
        Edit
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Edit {code}</span>
              <button type="button" onClick={() => setOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={submit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Redeem by</span>
                <input name="redeemBy" type="date" defaultValue={redeemByISO ?? ''} className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Max redemptions</span>
                <input name="maxRedemptions" type="number" min="1" defaultValue={maxRedemptions ?? ''} placeholder="Unlimited" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <span className="text-[11px] text-subtle-foreground">The discount value and duration are fixed — create a new coupon to change them.</span>
              {error ? <span className="text-[12px] text-danger">{error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Cancel</button>
                <button type="submit" disabled={pending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
