'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { createCouponAction } from '@/lib/coupons-actions';

export function NewCouponButton() {
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [duration, setDuration] = useState<'once' | 'repeating' | 'forever'>('once');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function close() {
    setOpen(false);
    setError(null);
    setDiscountType('percent');
    setDuration('once');
    formRef.current?.reset();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createCouponAction(fd);
      if (res.status === 'error') setError(res.message);
      else {
        close();
        router.refresh();
      }
    });
  }

  const inputCls =
    'rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" strokeWidth={2} />
        New coupon
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex w-full max-w-[460px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">New coupon</h2>
              <button onClick={close} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Code</span>
                <input
                  name="code"
                  autoFocus
                  placeholder="LAUNCH20"
                  onChange={(e) => (e.target.value = e.target.value.toUpperCase())}
                  className={`${inputCls} font-mono uppercase`}
                />
              </label>

              {/* Discount type */}
              <div className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Discount</span>
                <input type="hidden" name="discountType" value={discountType} />
                <div className="flex gap-2">
                  <div className="flex overflow-hidden rounded border border-border">
                    {(['percent', 'amount'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDiscountType(t)}
                        className={`px-3 py-2.5 text-[12.5px] font-medium transition-colors ${discountType === t ? 'bg-surface-3 text-foreground' : 'bg-surface-2 text-muted-foreground'}`}
                      >
                        {t === 'percent' ? '% off' : '₦ off'}
                      </button>
                    ))}
                  </div>
                  <input
                    name="value"
                    inputMode="decimal"
                    placeholder={discountType === 'percent' ? '20' : '2,000'}
                    className={`${inputCls} flex-1`}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-[7px]">
                  <span className="text-[12.5px] font-medium text-foreground">Duration</span>
                  <select
                    name="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as typeof duration)}
                    className={inputCls}
                  >
                    <option value="once">Once</option>
                    <option value="repeating">Repeating</option>
                    <option value="forever">Forever</option>
                  </select>
                </label>
                {duration === 'repeating' ? (
                  <label className="flex w-[120px] flex-col gap-[7px]">
                    <span className="text-[12.5px] font-medium text-foreground">Cycles</span>
                    <input name="durationInCycles" inputMode="numeric" placeholder="3" className={inputCls} />
                  </label>
                ) : null}
              </div>

              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">
                  Max redemptions <span className="text-subtle-foreground">(optional — blank = unlimited)</span>
                </span>
                <input name="maxRedemptions" inputMode="numeric" placeholder="500" className={inputCls} />
              </label>

              {error ? (
                <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
                  {error}
                </p>
              ) : null}

              <div className="mt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={close}
                  className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Create coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
