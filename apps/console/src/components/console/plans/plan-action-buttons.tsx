'use client';

import { convertIntervalKobo, savingsPct, toMonthlyKobo } from '@nombaone/core-contracts/billing';
import { Archive, ArrowUpDown, Loader2, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { cadenceOrder, cadenceSuffix, makeCadence, PLAN_CADENCES, type Cadence } from '@/lib/cadences';
import { naira, toKobo } from '@/lib/money';
import {
  archivePlanAction,
  changePriceAction,
  deactivatePriceAction,
  updatePlanWithPricesAction,
} from '@/lib/plans-actions';

import type { PriceInterval } from '@nombaone/core-contracts/types';

/** The plan's current ACTIVE price on a cadence — what the edit form starts from. */
export type EditablePrice = { interval: PriceInterval; intervalCount: number; unitAmount: number };

/** A row in the edit form. `existing` = the plan already bills on it, so it cannot be switched off here. */
type Row = { cadence: Cadence; existing: boolean; enabled: boolean; amount: string; discount: string };

const inputNaira = (kobo: number): string => naira(kobo).replace('₦', '');

function toPct(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, '');
  if (!/^-?\d{1,3}$/.test(cleaned)) return null;
  const pct = Number(cleaned);
  return pct < 100 ? pct : null;
}

const discounted = (parKobo: number, pct: number): number => Math.max(1, Math.round((parKobo * (100 - pct)) / 100));

/**
 * Every row the form shows: the cadences we offer, PLUS any cadence this plan already bills on.
 *
 * The second half matters — a plan can carry an exotic cadence (`month × 3`) created through the
 * API or the ladder's own "Add price". It must be visible and editable here, not invisibly
 * omitted, or the merchant would have no idea it exists.
 */
function buildRows(prices: EditablePrice[]): Row[] {
  const byKey = new Map<string, Row>();

  for (const c of PLAN_CADENCES) {
    byKey.set(c.key, { cadence: c, existing: false, enabled: false, amount: '', discount: '' });
  }
  for (const p of prices) {
    const c = makeCadence(p.interval, p.intervalCount);
    byKey.set(c.key, {
      cadence: c,
      existing: true,
      enabled: true,
      amount: inputNaira(p.unitAmount),
      discount: '',
    });
  }

  return [...byKey.values()].sort((a, b) => cadenceOrder(a.cadence, b.cadence));
}

/**
 * Edit a plan — name, description, and what it costs on every cadence. The same fields as Create,
 * because a plan IS what it costs; hunting for a per-price control to change an amount was the
 * two-step model leaking into the UI.
 *
 * Underneath, a changed amount is a NEW price row and the old one is retired — that is what
 * grandfathers existing subscribers. Which is exactly why this form must NOT cascade: in Create,
 * editing the base re-derives every other cadence, but here that would silently recreate prices
 * the merchant never touched. So derivation fires in ONE place only — switching a NEW cadence on,
 * to seed it with a sensible figure. Everything else changes only when it is typed into.
 */
export function EditPlanButton({
  planRef,
  name,
  description,
  prices,
}: {
  planRef: string;
  name: string;
  description: string | null;
  prices: EditablePrice[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const initial = useMemo(() => buildRows(prices), [prices]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [planName, setPlanName] = useState(name);

  function openModal() {
    setError(null);
    setRows(buildRows(prices)); // always start from what is actually in the database
    setPlanName(name);
    setOpen(true);
  }

  const koboOf = (r: Row): number | null => (r.enabled ? toKobo(r.amount) : null);

  /**
   * The baseline every `% off` is measured against: the live row that costs the MOST per month —
   * the same rule the price ladder uses, so the modal and the ladder never disagree.
   */
  const baseRow = rows
    .filter((r) => r.enabled && koboOf(r) !== null)
    .reduce<Row | null>((best, r) => {
      const monthly = toMonthlyKobo(koboOf(r)!, r.cadence.interval, r.cadence.intervalCount);
      const bestMonthly = best ? toMonthlyKobo(koboOf(best)!, best.cadence.interval, best.cadence.intervalCount) : -1;
      return monthly > bestMonthly ? r : best;
    }, null);

  const baselineMonthly = baseRow
    ? toMonthlyKobo(koboOf(baseRow)!, baseRow.cadence.interval, baseRow.cadence.intervalCount)
    : null;

  /** The equivalent amount on another cadence, off the baseline row. Seeds a newly-enabled cadence. */
  const parKobo = (c: Cadence): number | null =>
    baseRow === null
      ? null
      : convertIntervalKobo(
          koboOf(baseRow)!,
          baseRow.cadence.interval,
          baseRow.cadence.intervalCount,
          c.interval,
          c.intervalCount,
        );

  const savingsFor = (c: Cadence, kobo: number | null): number | null =>
    kobo === null || baselineMonthly === null
      ? null
      : savingsPct(baselineMonthly, toMonthlyKobo(kobo, c.interval, c.intervalCount));

  const patch = (key: string, p: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.cadence.key === key ? { ...r, ...p } : r)));

  function toggle(row: Row) {
    if (row.existing) return; // removing a cadence is the ladder's Deactivate, not a checkbox here
    if (row.enabled) {
      patch(row.cadence.key, { enabled: false, amount: '', discount: '' });
      return;
    }
    const par = parKobo(row.cadence);
    patch(row.cadence.key, {
      enabled: true,
      amount: par === null ? '' : inputNaira(par),
      discount: par === null ? '' : '0',
    });
  }

  /**
   * The amount is what gets STORED, so it always wins. Clearing the typed `%` hands that box back
   * to the live computed savings, which is recomputed from the rows on every render — so it can
   * never sit there showing a stale figure against a baseline that has since moved.
   *
   * This touches ONE row. It must: every changed amount mints a new price row, so cascading a
   * re-derive the way the create form does would silently recreate prices nobody asked to change.
   */
  function editAmount(row: Row, raw: string) {
    patch(row.cadence.key, { amount: raw, discount: '' });
  }

  /** Discount → amount, for this row only. */
  function editDiscount(row: Row, raw: string) {
    const pct = toPct(raw);
    const par = parKobo(row.cadence);
    if (pct === null || par === null) {
      patch(row.cadence.key, { discount: raw });
      return;
    }
    patch(row.cadence.key, { discount: raw, amount: inputNaira(discounted(par, pct)) });
  }

  /** What the merchant is about to change — spelled out before they commit to it. */
  const changing = rows.filter((r) => {
    const kobo = koboOf(r);
    if (kobo === null) return false;
    const current = prices.find(
      (p) => p.interval === r.cadence.interval && p.intervalCount === r.cadence.intervalCount,
    );
    return current ? current.unitAmount !== kobo : true;
  });

  function submit(formData: FormData) {
    start(async () => {
      const res = await updatePlanWithPricesAction(planRef, formData);
      if (res.status === 'error') setError(res.message);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  const ready = planName.trim().length > 0 && rows.every((r) => !r.enabled || toKobo(r.amount) !== null);
  const inputCls =
    'rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong';

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 rounded border border-border px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
      >
        <Pencil className="size-[14px] text-muted-foreground" strokeWidth={1.75} />
        Edit plan
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">Edit plan</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            <form action={submit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Name</span>
                <input
                  name="name"
                  autoFocus
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">
                  Description <span className="text-subtle-foreground">(optional)</span>
                </span>
                <input name="description" defaultValue={description ?? ''} placeholder="Everything a growing team needs" className={inputCls} />
              </label>

              <div className="flex flex-col gap-2.5 rounded border border-border bg-surface-2/40 p-3">
                <span className="text-[12.5px] font-medium text-foreground">What it costs</span>

                {rows.map((row) => {
                  const kobo = koboOf(row);
                  const save = savingsFor(row.cadence, kobo);
                  // A typed `%` wins while it is being typed; otherwise the box mirrors the real
                  // saving this amount represents right now.
                  const discountValue = row.discount !== '' ? row.discount : save === null ? '' : String(save);
                  return (
                    <div key={row.cadence.key} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            disabled={row.existing || (baseRow === null && !row.enabled)}
                            onChange={() => toggle(row)}
                            className="size-3.5 accent-[var(--accent)] disabled:opacity-40"
                          />
                          <span className="text-[13px] first-letter:capitalize text-foreground">{row.cadence.label}</span>
                        </label>
                        {row.enabled && save !== null && save > 0 ? (
                          <span className="rounded-full bg-success-bg px-2 py-[2px] text-[11px] font-medium text-success">
                            save {save}%
                          </span>
                        ) : null}
                      </div>

                      {row.enabled ? (
                        <div className="flex items-center gap-2 pl-6">
                          <input
                            name={`amount_${row.cadence.key}`}
                            inputMode="decimal"
                            aria-label={`${row.cadence.label} amount in naira`}
                            value={row.amount}
                            onChange={(e) => editAmount(row, e.target.value)}
                            className={`flex-1 ${inputCls}`}
                          />
                          <span className="whitespace-nowrap text-[12.5px] text-subtle-foreground">{cadenceSuffix(row.cadence)}</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              inputMode="numeric"
                              aria-label={`${row.cadence.label} discount percent`}
                              value={discountValue}
                              onChange={(e) => editDiscount(row, e.target.value)}
                              className={`w-[62px] text-right ${inputCls}`}
                            />
                            <span className="text-[12.5px] text-subtle-foreground">% off</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <span className="text-[11.5px] text-subtle-foreground">
                  A cadence you don&apos;t touch stays exactly as it is. Switching a new one on derives a
                  starting figure from the rest — edit it freely.
                </span>
              </div>

              <p className="rounded border border-accent-border bg-accent-muted px-3.5 py-3 text-[12.5px] text-foreground">
                {changing.length === 0
                  ? 'No price has changed. Saving updates the plan’s details and leaves every price exactly as it is.'
                  : `Changing ${changing.map((r) => r.cadence.label).join(' and ')} creates a new price and retires the old one. Existing subscribers keep what they signed up on — only new subscribers pay the new amount.`}
              </p>

              {error ? (
                <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">{error}</p>
              ) : null}

              <div className="mt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !ready}
                  className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ArchivePlanButton({ planRef }: { planRef: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      await archivePlanAction(planRef);
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="rounded border border-border px-3 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
        >
          Cancel
        </button>
        <button
          onClick={archive}
          disabled={pending}
          className="rounded bg-danger px-3 py-[7px] text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          Confirm archive
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded border border-border px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
    >
      <Archive className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      Archive
    </button>
  );
}

/**
 * Change what a cadence costs. Underneath this is a new price row plus a deactivation of the old one
 * (a price is immutable — its money fields are never updated), which is exactly what grandfathers
 * the people already paying. The copy says that out loud, because it is the merchant's guarantee,
 * not an implementation note.
 */
export function ChangePriceButton({
  priceRef,
  current,
  subscribers,
}: {
  priceRef: string;
  current: string;
  subscribers: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kobo = toKobo(amount);

  function close() {
    setOpen(false);
    setAmount('');
    setError(null);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await changePriceAction(priceRef, formData);
      if (res.status === 'error') setError(res.message);
      else {
        close();
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground hover:underline"
      >
        <ArrowUpDown className="size-[13px] text-muted-foreground" strokeWidth={1.75} />
        Change price
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative z-10 flex w-full max-w-[440px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Change price</span>
              <button type="button" onClick={close} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={submit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">New amount (₦)</span>
                <input
                  name="amount"
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="6,000.00"
                  className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong"
                />
                <span className="text-[11.5px] text-subtle-foreground">
                  {kobo !== null ? (
                    <>
                      Stored as <span className="font-mono text-foreground">{kobo.toLocaleString('en-US')} kobo</span>.
                    </>
                  ) : (
                    'Enter the new price in naira; it is stored as integer kobo.'
                  )}
                </span>
              </label>
              <p className="rounded border border-accent-border bg-accent-muted px-3.5 py-3 text-[12.5px] text-foreground">
                {subscribers > 0
                  ? `Existing subscribers keep ${current} — only new subscribers pay the new price.`
                  : `The current ${current} is retired, not deleted. Anyone already on it would keep it; only new subscribers pay the new price.`}
              </p>
              {error ? <span className="text-[12px] text-danger">{error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || kobo === null}
                  className="flex items-center justify-center gap-2 rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Change price
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DeactivatePriceButton({ priceRef }: { priceRef: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function deactivate() {
    startTransition(async () => {
      await deactivatePriceAction(priceRef);
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <button
        onClick={deactivate}
        disabled={pending}
        className="rounded-sm bg-danger px-2 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
      >
        Confirm
      </button>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-[12.5px] text-danger hover:underline">
      Deactivate
    </button>
  );
}
