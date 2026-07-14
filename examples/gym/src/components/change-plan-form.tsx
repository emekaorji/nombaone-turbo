'use client';

import { useActionState } from 'react';

import { changePlanAction, type FormState } from '@/lib/actions';

export function ChangePlanForm({
  options,
  currentPriceId,
}: {
  options: { id: string; name: string; amount: string; cadence: string }[];
  currentPriceId: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changePlanAction, {});

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      {options.map((o) => {
        const current = o.id === currentPriceId;
        return (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 ${
              current ? 'border-ember/50 bg-panel-2' : 'border-line bg-panel hover:border-dim'
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="priceId"
                value={o.id}
                disabled={current}
                defaultChecked={current}
                className="accent-[var(--color-ember)]"
              />
              <span>
                <span className="text-[14px] font-semibold">{o.name}</span>
                <span className="ml-2 text-[13px] text-fog">
                  {o.amount} {o.cadence}
                </span>
              </span>
            </span>
            {current ? (
              <span className="text-[11.5px] text-dim">Your plan</span>
            ) : null}
          </label>
        );
      })}

      {state.error ? (
        <p className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-[12.5px] text-blood">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="confirm-change-plan"
        className="mt-2 w-fit rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal disabled:opacity-60"
      >
        {pending ? 'Changing…' : 'Change my plan'}
      </button>

      <p className="text-[12px] text-dim">
        We work out the difference fairly for the part of the month you&apos;ve already paid for.
      </p>
    </form>
  );
}
