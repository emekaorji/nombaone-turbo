'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { cancelAction, type FormState } from '@/lib/actions';

export function CancelForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(cancelAction, {});

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-[12.5px] font-medium text-fog">
          Tell us why you&apos;re leaving? (optional)
        </label>
        <select
          id="reason"
          name="reason"
          className="w-full max-w-sm rounded border border-line bg-panel-2 px-3 py-2.5 text-[13.5px] text-chalk outline-none focus:border-ember/60"
        >
          <option value="">Rather not say</option>
          <option>Too expensive</option>
          <option>Too far away</option>
          <option>Not using it enough</option>
          <option>Moving</option>
          <option>Injured</option>
          <option>Other</option>
        </select>
      </div>

      {state.error ? (
        <p className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-[12.5px] text-blood">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          data-testid="confirm-cancel"
          className="rounded border border-blood/50 bg-blood/10 px-5 py-2.5 text-[13px] font-semibold text-blood disabled:opacity-60"
        >
          {pending ? 'Cancelling…' : 'Yes, cancel my membership'}
        </button>
        <Link
          href="/account"
          className="rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal"
        >
          Never mind, keep it
        </Link>
      </div>
    </form>
  );
}
