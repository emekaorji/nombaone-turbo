'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, FastForward, Plus, Send, Webhook } from 'lucide-react';

import { advanceCycleAction, mintTestMethodAction, simulateWebhookAction, type EngineActionState } from '@/lib/engine-actions';
import type { TestInstrumentData } from '@/lib/test-instruments';

const initial: EngineActionState = {};
const OUTCOMES = ['success', 'decline_insufficient_funds', 'decline_expired_card', 'decline_do_not_honor', 'requires_otp'];
const selectCls = 'rounded border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-foreground outline-none focus:border-accent-border';
const submitCls = 'flex items-center justify-center gap-2 rounded bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50';

function Note({ state }: { state: EngineActionState }) {
  if (state.error) return <span className="text-[11.5px] text-danger">{state.error}</span>;
  if (state.ok) return <span className="text-[11.5px] text-success">{state.note ?? 'Done.'}</span>;
  return null;
}

function useRefreshOnOk(ok: boolean | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (ok) router.refresh();
  }, [ok, router]);
}

export function TestInstrumentsPanel({ data, canManage }: { data: TestInstrumentData; canManage: boolean }) {
  const [mint, mintAction, mintPending] = useActionState(mintTestMethodAction, initial);
  const [adv, advAction, advPending] = useActionState(advanceCycleAction, initial);
  const [sim, simAction, simPending] = useActionState(simulateWebhookAction, initial);
  const [selectedOutcome, setSelectedOutcome] = useState('success');
  useRefreshOnOk(mint.ok);
  useRefreshOnOk(adv.ok);

  const disabled = !canManage;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* Mint a test method */}
      <form action={mintAction} className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-1 p-[18px]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
            <CreditCard className="size-[17px] text-accent" strokeWidth={1.75} />
          </div>
          <span className="text-[14.5px] font-semibold text-foreground">Mint a test method</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">Deterministic outcomes, attached to a customer.</p>
        <select name="customerId" required defaultValue={data.customers[0]?.reference ?? ''} className={selectCls}>
          {data.customers.length === 0 ? <option value="">No customers yet</option> : null}
          {data.customers.map((c) => (
            <option key={c.reference} value={c.reference}>{c.label}</option>
          ))}
        </select>
        <select name="kind" defaultValue="card" className={selectCls}>
          <option value="card">Card</option>
          <option value="mandate">Direct debit (mandate)</option>
        </select>
        <input type="hidden" name="behavior" value={selectedOutcome} />
        <div className="flex flex-1 flex-col gap-1.5">
          {OUTCOMES.map((o) => {
            const sel = o === selectedOutcome;
            return (
              <button
                key={o}
                type="button"
                onClick={() => setSelectedOutcome(o)}
                className={`flex items-center gap-[9px] rounded px-2.5 py-2 text-left transition-colors ${sel ? 'border border-accent-border bg-surface-2' : 'hover:bg-surface-2/50'}`}
              >
                {sel ? (
                  <span className="grid size-[14px] shrink-0 place-items-center rounded-full border-[3px] border-accent bg-accent">
                    <span className="size-1 rounded-full bg-accent-foreground" />
                  </span>
                ) : (
                  <span className="size-[14px] shrink-0 rounded-full border border-border-strong bg-surface-3" />
                )}
                <span className={`font-mono text-[12px] ${sel ? 'text-foreground' : 'text-muted-foreground'}`}>{o}</span>
              </button>
            );
          })}
        </div>
        <Note state={mint} />
        <button type="submit" disabled={disabled || mintPending || data.customers.length === 0} className={submitCls}>
          <Plus className="size-[15px]" strokeWidth={2} />
          {mintPending ? 'Attaching…' : `Mint ${selectedOutcome} method`}
        </button>
      </form>

      {/* Advance the clock */}
      <form action={advAction} className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-1 p-[18px]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
            <FastForward className="size-[17px] text-accent" strokeWidth={1.75} />
          </div>
          <span className="text-[14.5px] font-semibold text-foreground">Advance the clock</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">Move a subscription to its next cycle. Active or trialing only.</p>
        <select name="subscriptionReference" required defaultValue={data.subscriptions[0]?.reference ?? ''} className={selectCls}>
          {data.subscriptions.length === 0 ? <option value="">No advanceable subscriptions</option> : null}
          {data.subscriptions.map((s) => (
            <option key={s.reference} value={s.reference}>{s.label}</option>
          ))}
        </select>
        <div className="flex flex-1 items-center justify-center gap-3">
          <span className="text-[13px] text-muted-foreground">this cycle</span>
          <FastForward className="size-[18px] text-accent" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-foreground">next cycle</span>
        </div>
        <Note state={adv} />
        <button type="submit" disabled={disabled || advPending || data.subscriptions.length === 0} className={submitCls}>
          <FastForward className="size-[15px]" strokeWidth={2} />
          {advPending ? 'Advancing…' : 'Advance cycle'}
        </button>
      </form>

      {/* Simulate a webhook */}
      <form action={simAction} className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-1 p-[18px]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
            <Webhook className="size-[17px] text-accent" strokeWidth={1.75} />
          </div>
          <span className="text-[14.5px] font-semibold text-foreground">Simulate a webhook</span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">Emit a real, signed catalog event to your endpoints.</p>
        <select name="type" defaultValue={data.eventTypes[0]} className={selectCls}>
          {data.eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="flex-1" />
        <Note state={sim} />
        <button type="submit" disabled={disabled || simPending} className={submitCls}>
          <Send className="size-[15px]" strokeWidth={2} />
          {simPending ? 'Sending…' : 'Send event'}
        </button>
      </form>
    </div>
  );
}
