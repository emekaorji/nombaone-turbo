'use client';

import { convertIntervalKobo, savingsPct, toMonthlyKobo } from '@nombaone/core-contracts/billing';
import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { cadenceSuffix, DEFAULT_CADENCE_KEY, PLAN_CADENCES, type Cadence } from '@/lib/cadences';
import { naira, toKobo } from '@/lib/money';
import { createPlanWithPricesAction } from '@/lib/plans-actions';

/** A non-base cadence the merchant has switched on. `amount` and `discount` are two views of one number. */
type Variant = { enabled: boolean; amount: string; discount: string };
/** Keyed by cadence key (`minute_10`, `year_1`) — a cadence is a unit × a count, never a unit alone. */
type Variants = Record<string, Variant>;

const BLANK: Variant = { enabled: false, amount: '', discount: '' };
const readVariant = (vs: Variants, key: string): Variant => vs[key] ?? BLANK;

/** Kobo → what belongs in a naira input: `500000` → `5,000`. Round-trips through the shared parser. */
const inputNaira = (kobo: number): string => naira(kobo).replace('₦', '');

/** A whole-percent discount, possibly negative (a premium). Empty/garbage → null, i.e. "don't derive". */
function toPct(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, '');
  if (!/^-?\d{1,3}$/.test(cleaned)) return null;
  const pct = Number(cleaned);
  return pct < 100 ? pct : null;
}

/** Apply a discount to the derived (par) amount. Clamped to 1 kobo — the DB's CHECK is unit_amount > 0. */
const discounted = (parKobo: number, pct: number): number => Math.max(1, Math.round((parKobo * (100 - pct)) / 100));

const byKey = (key: string): Cadence => PLAN_CADENCES.find((c) => c.key === key) ?? PLAN_CADENCES[0]!;

export function NewPlanButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [baseKey, setBaseKey] = useState(DEFAULT_CADENCE_KEY);
  const [baseAmount, setBaseAmount] = useState('');
  const [variants, setVariants] = useState<Variants>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const base = byKey(baseKey);
  const baseKobo = toKobo(baseAmount);
  // Everything a cadence is judged against: what the base costs PER MONTH.
  const baselineMonthly = baseKobo === null ? null : toMonthlyKobo(baseKobo, base.interval, base.intervalCount);
  /** The equivalent amount on another cadence — a SUGGESTION (annual is almost never exactly 12×). */
  const parKobo = (c: Cadence): number | null =>
    baseKobo === null
      ? null
      : convertIntervalKobo(baseKobo, base.interval, base.intervalCount, c.interval, c.intervalCount);
  /** The truth about what the merchant typed, whatever the discount box says. */
  const savingsFor = (c: Cadence, kobo: number | null): number | null =>
    kobo === null || baselineMonthly === null
      ? null
      : savingsPct(baselineMonthly, toMonthlyKobo(kobo, c.interval, c.intervalCount));

  function close() {
    setOpen(false);
    setError(null);
    setName('');
    setBaseKey(DEFAULT_CADENCE_KEY);
    setBaseAmount('');
    setVariants({});
    formRef.current?.reset();
  }

  const patch = (key: string, p: Partial<Variant>) =>
    setVariants((prev) => ({ ...prev, [key]: { ...readVariant(prev, key), ...p } }));

  function toggle(c: Cadence) {
    const current = readVariant(variants, c.key);
    if (current.enabled) {
      patch(c.key, { enabled: false });
      return;
    }
    const par = parKobo(c);
    // Switched on at the derived figure with no discount — the merchant edits from there.
    patch(c.key, { enabled: true, amount: par === null ? '' : inputNaira(par), discount: par === null ? '' : '0' });
  }

  /** Amount → discount. The amount is what gets stored, so it wins; the % follows it. */
  function editAmount(c: Cadence, raw: string) {
    const pct = savingsFor(c, toKobo(raw));
    patch(c.key, { amount: raw, discount: pct === null ? '' : String(pct) });
  }

  /** Discount → amount. Derives off the PAR figure, so 0% is always exactly the equivalent price. */
  function editDiscount(c: Cadence, raw: string) {
    const pct = toPct(raw);
    const par = parKobo(c);
    if (pct === null || par === null) {
      patch(c.key, { discount: raw });
      return;
    }
    patch(c.key, { discount: raw, amount: inputNaira(discounted(par, pct)) });
  }

  /**
   * The base moved, so every derived amount moves with it — but the merchant's DISCOUNT is a pricing
   * decision, not arithmetic, so that is what we preserve while the amount is recomputed.
   */
  function editBase(nextAmount: string, nextKey: string) {
    setBaseAmount(nextAmount);
    setBaseKey(nextKey);
    const next = byKey(nextKey);
    const nextKobo = toKobo(nextAmount);
    setVariants((prev) => {
      const out: Variants = { ...prev };
      for (const c of PLAN_CADENCES) {
        const v = readVariant(prev, c.key);
        if (!v.enabled) continue;
        // The base cadence cannot also be a variant of itself.
        if (c.key === nextKey) {
          out[c.key] = { ...v, enabled: false };
          continue;
        }
        if (nextKobo === null) continue;
        const pct = toPct(v.discount) ?? 0;
        const par = convertIntervalKobo(nextKobo, next.interval, next.intervalCount, c.interval, c.intervalCount);
        out[c.key] = { ...v, amount: inputNaira(discounted(par, pct)) };
      }
      return out;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPlanWithPricesAction(fd);
      if (res.status === 'error') setError(res.message);
      else {
        close();
        router.push(`/plans?plan=${encodeURIComponent(res.reference)}`);
        router.refresh();
      }
    });
  }

  // A plan that cannot be billed is not a plan. No name or no base price → no submit.
  const ready = name.trim().length > 0 && baseKobo !== null;
  const inputCls =
    'rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" strokeWidth={2} />
        New plan
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">New plan</h2>
              <button onClick={close} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <input type="hidden" name="baseCadence" value={baseKey} />

              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Name</span>
                <input
                  name="name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pro"
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">
                  Description <span className="text-subtle-foreground">(optional)</span>
                </span>
                <input name="description" placeholder="Everything a growing team needs" className={inputCls} />
              </label>

              {/* The base price. It is not a separate step — a plan IS what it costs. */}
              <div className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">What it costs</span>
                <div className="flex items-center gap-2">
                  <input
                    name={`amount_${baseKey}`}
                    inputMode="decimal"
                    aria-label="Base amount in naira"
                    value={baseAmount}
                    onChange={(e) => editBase(e.target.value, baseKey)}
                    placeholder="5,000.00"
                    className={`flex-1 ${inputCls}`}
                  />
                  <select
                    aria-label="Base billing cadence"
                    value={baseKey}
                    onChange={(e) => editBase(baseAmount, e.target.value)}
                    className={`w-[152px] ${inputCls}`}
                  >
                    {PLAN_CADENCES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11.5px] text-subtle-foreground">
                  {baseKobo !== null ? (
                    <>
                      Stored as <span className="font-mono text-foreground">{baseKobo.toLocaleString('en-US')} kobo</span>.
                      Raising it later never changes what existing subscribers pay.
                    </>
                  ) : (
                    'Enter the price in naira; it is stored as integer kobo.'
                  )}
                </span>
              </div>

              {/* Other cadences, priced off the base. Each is a real price row of its own. */}
              <div className="flex flex-col gap-2 rounded border border-border bg-surface-2/40 p-3">
                <span className="text-[12.5px] font-medium text-foreground">Also offer</span>
                {PLAN_CADENCES.filter((c) => c.key !== baseKey).map((c) => {
                  const v = readVariant(variants, c.key);
                  const kobo = v.enabled ? toKobo(v.amount) : null;
                  const save = savingsFor(c, kobo);
                  return (
                    <div key={c.key} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={v.enabled}
                            disabled={baseKobo === null}
                            onChange={() => toggle(c)}
                            className="size-3.5 accent-[var(--accent)] disabled:opacity-40"
                          />
                          <span className="text-[13px] first-letter:capitalize text-foreground">{c.label}</span>
                        </label>
                        {v.enabled && save !== null && save > 0 ? (
                          <span className="rounded-full bg-success-bg px-2 py-[2px] text-[11px] font-medium text-success">
                            save {save}%
                          </span>
                        ) : null}
                      </div>

                      {v.enabled ? (
                        <div className="flex flex-col gap-1.5 pl-6">
                          <div className="flex items-center gap-2">
                            <input
                              name={`amount_${c.key}`}
                              inputMode="decimal"
                              aria-label={`${c.label} amount in naira`}
                              value={v.amount}
                              onChange={(e) => editAmount(c, e.target.value)}
                              className={`flex-1 ${inputCls}`}
                            />
                            <span className="whitespace-nowrap text-[12.5px] text-subtle-foreground">{cadenceSuffix(c)}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                inputMode="numeric"
                                aria-label={`${c.label} discount percent`}
                                value={v.discount}
                                onChange={(e) => editDiscount(c, e.target.value)}
                                className={`w-[62px] text-right ${inputCls}`}
                              />
                              <span className="text-[12.5px] text-subtle-foreground">% off</span>
                            </div>
                          </div>
                          <span className="text-[11.5px] text-subtle-foreground">
                            {kobo !== null ? (
                              <>
                                Stored as <span className="font-mono text-foreground">{kobo.toLocaleString('en-US')} kobo</span>.
                                {save !== null && save < 0 ? ` A ${Math.abs(save)}% premium over ${base.label}.` : ''}
                              </>
                            ) : (
                              'Enter the price in naira; it is stored as integer kobo.'
                            )}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <span className="text-[11.5px] text-subtle-foreground">
                  {baseKobo === null
                    ? 'Set the base price first — the others are derived from it.'
                    : 'Derived from the base. Edit the amount or the discount — each updates the other.'}
                </span>
              </div>

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
                  disabled={pending || !ready}
                  className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Create plan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
