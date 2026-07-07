'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';

import {
  applyDiscountToSubscriptionAction,
  cancelSubscriptionAction,
  changeSubscriptionAction,
  pauseSubscriptionAction,
  removeDiscountFromSubscriptionAction,
  resubscribeAction,
  resumeSubscriptionAction,
  updateSubscriptionMethodAction,
  type EngineActionState,
} from '@/lib/engine-actions';
import type { PriceOption } from '@/lib/subscription-form';

const initial: EngineActionState = {};

export function SubscriptionActions({
  subscriptionReference,
  status,
  canManage,
  prices,
  methods,
}: {
  subscriptionReference: string;
  status: string;
  canManage: boolean;
  prices: PriceOption[];
  methods: { reference: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [resubOpen, setResubOpen] = useState(false);
  const [pending, start] = useTransition();
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelSubscriptionAction.bind(null, subscriptionReference), initial);
  const [discountState, discountAction, discountPending] = useActionState(applyDiscountToSubscriptionAction.bind(null, subscriptionReference), initial);
  const [changeState, changeAction, changePending] = useActionState(changeSubscriptionAction.bind(null, subscriptionReference), initial);
  const [resubState, resubAction, resubPending] = useActionState(resubscribeAction.bind(null, subscriptionReference), initial);
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodState, methodAction, methodPending] = useActionState(updateSubscriptionMethodAction.bind(null, subscriptionReference), initial);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!cancelState.ok) return;
    router.refresh();
    const t = setTimeout(() => setCancelOpen(false), 0);
    return () => clearTimeout(t);
  }, [cancelState.ok, router]);

  useEffect(() => {
    if (!discountState.ok) return;
    router.refresh();
    const t = setTimeout(() => setDiscountOpen(false), 0);
    return () => clearTimeout(t);
  }, [discountState.ok, router]);

  useEffect(() => {
    if (!changeState.ok) return;
    router.refresh();
    const t = setTimeout(() => setChangeOpen(false), 0);
    return () => clearTimeout(t);
  }, [changeState.ok, router]);

  useEffect(() => {
    if (!resubState.ok) return;
    router.refresh();
    const t = setTimeout(() => setResubOpen(false), 0);
    return () => clearTimeout(t);
  }, [resubState.ok, router]);

  useEffect(() => {
    if (!methodState.ok) return;
    router.refresh();
    const t = setTimeout(() => setMethodOpen(false), 0);
    return () => clearTimeout(t);
  }, [methodState.ok, router]);

  function run(action: (ref: string) => Promise<EngineActionState>) {
    setOpen(false);
    start(async () => {
      await action(subscriptionReference);
      router.refresh();
    });
  }

  const canPause = status === 'active' || status === 'trialing';
  const canResume = status === 'paused';
  const canCancel = ['active', 'trialing', 'past_due', 'paused'].includes(status);
  const canDiscount = ['active', 'trialing', 'past_due', 'paused'].includes(status);
  const canChange = ['active', 'trialing', 'past_due'].includes(status) && prices.length > 0;
  const canResub = status === 'canceled' && prices.length > 0;
  const canChangeMethod = ['active', 'trialing', 'past_due'].includes(status) && methods.length > 0;
  const anyAction = canManage && (canPause || canResume || canCancel || canDiscount || canChange || canResub || canChangeMethod);

  const btnCls = 'flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-50';

  if (!anyAction) {
    return (
      <button disabled title={!canManage ? 'Only owners can change subscriptions' : 'No actions available for this status'} className={btnCls}>
        Actions
        <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={pending} className={btnCls}>
        {pending ? 'Working…' : 'Actions'}
        <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 flex w-[190px] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl">
          {canPause ? (
            <button type="button" onClick={() => run(pauseSubscriptionAction)} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
              Pause subscription
            </button>
          ) : null}
          {canResume ? (
            <button type="button" onClick={() => run(resumeSubscriptionAction)} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
              Resume subscription
            </button>
          ) : null}
          {canChange ? (
            <button type="button" onClick={() => { setOpen(false); setChangeOpen(true); }} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
              Change plan
            </button>
          ) : null}
          {canResub ? (
            <button type="button" onClick={() => { setOpen(false); setResubOpen(true); }} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
              Resubscribe
            </button>
          ) : null}
          {canChangeMethod ? (
            <button type="button" onClick={() => { setOpen(false); setMethodOpen(true); }} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
              Change payment method
            </button>
          ) : null}
          {canDiscount ? (
            <>
              <button type="button" onClick={() => { setOpen(false); setDiscountOpen(true); }} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
                Apply discount
              </button>
              <button type="button" onClick={() => run(removeDiscountFromSubscriptionAction)} className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2">
                Remove discount
              </button>
            </>
          ) : null}
          {canCancel ? (
            <button type="button" onClick={() => { setOpen(false); setCancelOpen(true); }} className="px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-surface-2">
              Cancel subscription
            </button>
          ) : null}
        </div>
      ) : null}

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setCancelOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Cancel subscription</span>
              <button type="button" onClick={() => setCancelOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={cancelAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">When</span>
                <select name="when" defaultValue="at_period_end" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border">
                  <option value="at_period_end">At period end (keeps access until then)</option>
                  <option value="now">Now (immediate)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Reason (optional)</span>
                <input name="comment" placeholder="Why is this canceling?" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              {cancelState.error ? <span className="text-[12px] text-danger">{cancelState.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setCancelOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
                  Keep it
                </button>
                <button type="submit" disabled={cancelPending} className="rounded bg-danger px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {cancelPending ? 'Canceling…' : 'Cancel subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {discountOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setDiscountOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Apply discount</span>
              <button type="button" onClick={() => setDiscountOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={discountAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Coupon code or reference</span>
                <input name="coupon" required autoFocus placeholder="e.g. WELCOME20 or nbo…cpn" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <span className="text-[11px] text-subtle-foreground">The coupon becomes a discount on this subscription&apos;s future invoices.</span>
              {discountState.error ? <span className="text-[12px] text-danger">{discountState.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setDiscountOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
                  Cancel
                </button>
                <button type="submit" disabled={discountPending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {discountPending ? 'Applying…' : 'Apply discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {changeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setChangeOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Change plan</span>
              <button type="button" onClick={() => setChangeOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={changeAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">New price</span>
                <select name="priceId" required defaultValue={prices[0]?.reference} className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border">
                  {prices.map((p) => (
                    <option key={p.reference} value={p.reference}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Quantity</span>
                <input name="quantity" type="number" min="1" placeholder="1" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">When</span>
                <select name="when" defaultValue="now" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border">
                  <option value="now">Now (prorated)</option>
                  <option value="next_cycle">At next cycle (scheduled)</option>
                </select>
              </label>
              {changeState.error ? <span className="text-[12px] text-danger">{changeState.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setChangeOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Cancel</button>
                <button type="submit" disabled={changePending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {changePending ? 'Changing…' : 'Change plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resubOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setResubOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Resubscribe</span>
              <button type="button" onClick={() => setResubOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={resubAction} className="flex flex-col gap-3.5">
              <p className="text-[12px] text-muted-foreground">A canceled subscription can&apos;t be un-canceled — this mints a new subscription for the customer.</p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Price (defaults to the original)</span>
                <select name="priceId" defaultValue="" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border">
                  <option value="">Same as before</option>
                  {prices.map((p) => (
                    <option key={p.reference} value={p.reference}>{p.label}</option>
                  ))}
                </select>
              </label>
              {resubState.error ? <span className="text-[12px] text-danger">{resubState.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setResubOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Cancel</button>
                <button type="submit" disabled={resubPending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {resubPending ? 'Resubscribing…' : 'Resubscribe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {methodOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setMethodOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Change payment method</span>
              <button type="button" onClick={() => setMethodOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={methodAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Charge this method next cycle</span>
                <select name="paymentMethodId" required defaultValue={methods[0]?.reference} className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border">
                  {methods.map((m) => (
                    <option key={m.reference} value={m.reference}>{m.label}</option>
                  ))}
                </select>
              </label>
              {methodState.error ? <span className="text-[12px] text-danger">{methodState.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setMethodOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Cancel</button>
                <button type="submit" disabled={methodPending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {methodPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
