'use client';

import { useActionState } from 'react';

import { joinAction, type FormState } from '@/lib/actions';

const input =
  'w-full rounded border border-line bg-panel-2 px-3 py-2.5 text-[13.5px] text-chalk outline-none placeholder:text-dim focus:border-ember/60';

/**
 * Step 1 of joining: who you are.
 *
 * Submitting this creates the member AND starts the membership, then hands them straight
 * to the payment page. There is no "review your order" dead-end in between — the order is
 * on this page, next to the button.
 */
export function JoinForm({
  priceId,
  planName,
  amount,
  cadenceLabel,
  isFlex,
  sandbox,
}: {
  priceId: string;
  planName: string;
  amount: string;
  cadenceLabel: string;
  isFlex: boolean;
  sandbox: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(joinAction, {});

  return (
    <form action={formAction} className="grid gap-8 md:grid-cols-[1fr_320px]">
      <input type="hidden" name="priceId" value={priceId} />

      {/* Details */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-[12.5px] font-medium">
            Full name
          </label>
          <input id="name" name="name" required autoFocus placeholder="Tunde Adeyemi" className={input} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[12.5px] font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="tunde@example.com"
            className={input}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-[12.5px] font-medium">
            Phone number
          </label>
          <input id="phone" name="phone" placeholder="0801 234 5678" className={input} />
          <span className="text-[11.5px] text-dim">
            So we can reach you if a payment doesn&apos;t go through.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[12.5px] font-medium">
            Choose a password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className={input}
          />
          <span className="text-[11.5px] text-dim">
            You&apos;ll use this to see your membership and stop it whenever you want.
          </span>
        </div>

        {state.error ? (
          <p className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-[12.5px] text-blood">
            {state.error}
          </p>
        ) : null}
      </div>

      {/* Order summary — the honest bit */}
      <aside className="h-fit rounded-lg border border-line bg-panel p-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-dim">Your order</h2>

        <p className="mt-3 text-lg font-semibold">{planName}</p>
        <p className="mt-1 text-[13px] text-fog">
          <span className="text-chalk">{amount}</span> {cadenceLabel}
        </p>

        <div className="mt-4 border-t border-line pt-4 text-[13px]">
          <div className="flex justify-between">
            <span className="text-fog">You pay today</span>
            <span className="font-semibold">{amount}</span>
          </div>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-dim">
          {isFlex ? (
            <>
              Then <span className="text-fog">{amount}</span> again every 10 minutes you stay. Stop
              it yourself from your account page the moment you&apos;re done.
            </>
          ) : (
            <>
              Then <span className="text-fog">{amount}</span> on the same date every month,
              automatically. Your next payment is always shown on your account page before we take
              it, and you can cancel in two taps.
            </>
          )}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded bg-ember px-4 py-3 text-[13px] font-semibold text-coal transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Setting up…' : `Continue to payment`}
        </button>

        {sandbox ? (
          <p className="mt-3 rounded border border-dashed border-dim/50 px-3 py-2 text-center text-[11px] leading-relaxed text-dim">
            Test mode — we&apos;ll use a test card. No real money moves, and everything after
            this (renewals, receipts, a failed payment) is real.
          </p>
        ) : (
          <p className="mt-3 text-center text-[11px] text-dim">
            🔒 We never see your full card number.
          </p>
        )}
      </aside>
    </form>
  );
}
