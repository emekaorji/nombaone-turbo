'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, X } from 'lucide-react';

import {
  addPayoutAccountAction,
  createPayoutAction,
  refundSettlementAction,
  resolvePayoutAccountAction,
  type EngineActionState,
} from '@/lib/engine-actions';

const initial: EngineActionState = {};
/** The resolve step also carries back the name the BANK gave us for the account. */
type ResolveState = EngineActionState & { accountName?: string };
const initialResolve: ResolveState = {};
const inputCls = 'rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border';
const cancelCls = 'rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3';
const submitCls = 'rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50';

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground">{title}</span>
          <button type="button" onClick={onClose} className="text-subtle-foreground hover:text-foreground">
            <X className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type Bank = { code: string; name: string };
export type PayoutAccount = { bankName: string; accountNumber: string; accountName: string };

/** `0123456789` → `••••••6789` — enough to recognise, not enough to leak. */
const maskAccount = (n: string): string => `${'•'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}`;

/**
 * ADD YOUR BANK ACCOUNT — the "is this you?" flow.
 *
 * Two steps, deliberately. The merchant picks a bank and types 10 digits; we ask the BANK
 * who owns that account and show them the answer; only then can they save it. They confirm
 * the bank's answer instead of trusting their own typing, so a transposed digit is caught
 * here rather than discovered after the money has gone.
 *
 * This replaces a form with a raw "Bank code" text input (placeholder `000013`) whose value
 * was posted straight to the transfer API.
 */
function AddBankAccountForm({ banks, onDone }: { banks: Bank[]; onDone: () => void }) {
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolveState, resolveAction, resolving] = useActionState(resolvePayoutAccountAction, initialResolve);
  const [saveState, saveAction, saving] = useActionState(addPayoutAccountAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (!saveState.ok) return;
    router.refresh();
    onDone();
  }, [saveState.ok, router, onDone]);

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? '';
  const confirmed = resolveState.ok ? resolveState.accountName : undefined;
  const ready = bankCode !== '' && /^\d{10}$/.test(accountNumber);

  // Step 2 — the bank has told us who owns the account. Confirm, then save.
  if (confirmed) {
    return (
      <form action={saveAction} className="flex flex-col gap-3.5">
        <p className="text-[12px] text-muted-foreground">Is this you?</p>
        <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
          <p className="text-[14px] font-semibold text-foreground">{confirmed}</p>
          <p className="text-[12px] text-muted-foreground">
            {bankName} · {maskAccount(accountNumber)}
          </p>
        </div>
        <p className="text-[11.5px] text-subtle-foreground">
          Your bank confirmed this name. Your revenue pays out here every day.
        </p>
        <input type="hidden" name="bankCode" value={bankCode} />
        <input type="hidden" name="bankName" value={bankName} />
        <input type="hidden" name="accountNumber" value={accountNumber} />
        {saveState.error ? <span className="text-[12px] text-danger">{saveState.error}</span> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onDone} className={cancelCls}>
            Not me
          </button>
          <button type="submit" disabled={saving} className={submitCls}>
            {saving ? 'Saving…' : 'Yes, that’s me'}
          </button>
        </div>
      </form>
    );
  }

  // Step 1 — pick a bank, type 10 digits. No name field: we don't take the merchant's word.
  return (
    <form action={resolveAction} className="flex flex-col gap-3.5">
      <p className="text-[12px] text-muted-foreground">
        Where should we send your money? We’ll check it with your bank first.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">Bank</span>
        <select
          name="bankCode"
          required
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          className={inputCls}
        >
          <option value="">Select your bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <input type="hidden" name="bankName" value={bankName} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">Account number</span>
        <input
          name="accountNumber"
          inputMode="numeric"
          maxLength={10}
          required
          placeholder="0123456789"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          className={inputCls}
        />
      </label>
      {resolveState.error ? <span className="text-[12px] text-danger">{resolveState.error}</span> : null}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className={cancelCls}>
          Cancel
        </button>
        <button type="submit" disabled={!ready || resolving} className={submitCls}>
          {resolving ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </form>
  );
}

/**
 * WITHDRAW. If the merchant has a verified bank account we pay into it; if they don't, this
 * is the moment we ask — the first and only time we need it.
 *
 * The destination is NOT part of the withdrawal. The API reads it from the merchant's
 * registered account, so nothing typed here can redirect a naira.
 */
export function WithdrawButton({
  availableShort,
  canManage,
  banks,
  payoutAccount,
}: {
  availableShort: string;
  canManage: boolean;
  banks: Bank[];
  payoutAccount: PayoutAccount | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPayoutAction, initial);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canManage}
        title={!canManage ? 'Only owners can withdraw' : undefined}
        className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        <Banknote className="size-4" strokeWidth={2} />
        {payoutAccount ? 'Withdraw' : 'Add your bank account'}
      </button>

      {open ? (
        <Overlay
          title={payoutAccount ? 'Withdraw' : 'Add your bank account'}
          onClose={close}
        >
          {payoutAccount ? (
            <form action={formAction} className="flex flex-col gap-3.5">
              <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
                <p className="text-[12px] text-muted-foreground">Paying into</p>
                <p className="text-[13.5px] font-semibold text-foreground">{payoutAccount.accountName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {payoutAccount.bankName} · {maskAccount(payoutAccount.accountNumber)}
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">
                  Amount (₦) — leave blank to withdraw everything
                </span>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  autoFocus
                  placeholder={availableShort}
                  className={inputCls}
                />
              </label>
              <p className="text-[11.5px] text-subtle-foreground">
                {availableShort} available now. The rest is inside the refund window and unlocks shortly.
                Your balance pays out automatically every day — this is just to get it sooner.
              </p>
              {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} className={cancelCls}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={submitCls}>
                  {pending ? 'Starting…' : 'Withdraw'}
                </button>
              </div>
            </form>
          ) : (
            <AddBankAccountForm banks={banks} onDone={close} />
          )}
        </Overlay>
      ) : null}
    </>
  );
}

export function RefundButton({ settlementReference, canManage }: { settlementReference: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(refundSettlementAction.bind(null, settlementReference), initial);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  if (!canManage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm border border-border-strong bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
      >
        Refund
      </button>
      {open ? (
        <Overlay title="Refund settlement" onClose={() => setOpen(false)}>
          <form action={formAction} className="flex flex-col gap-3.5">
            <p className="text-[12px] text-muted-foreground">Reverses the tenant share. Platform fees are earned and non-refundable.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Amount (₦) — blank for full</span>
              <input name="amount" type="number" min="0" step="0.01" placeholder="Full refund" className={inputCls} />
            </label>
            {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
              <button type="submit" disabled={pending} className={submitCls}>{pending ? 'Refunding…' : 'Issue refund'}</button>
            </div>
          </form>
        </Overlay>
      ) : null}
    </>
  );
}
