'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';

import { requestPasswordResetAction, type RequestResetState } from '@/lib/auth/reset';

/**
 * "I forgot my password."
 *
 * ⚠ The success screen is shown whether or not the email has an account — deliberately.
 * Anything else turns this page into a free membership oracle: type an address, watch the
 * response, learn whether that business banks with us.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordResetAction,
    { status: 'idle' }
  );

  if (state.status === 'sent') {
    return (
      <div className="flex w-full max-w-[400px] flex-col gap-[18px]">
        <div className="flex flex-col gap-[5px]">
          <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 className="size-5 text-accent" strokeWidth={2} />
          </div>
          <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">Check your email</h1>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            If that address has an account, we’ve sent a link to set a new password. It expires in
            an hour and can only be used once.
          </p>
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded border border-border bg-surface-2 px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-border-strong"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-[400px] flex-col gap-[18px]">
      <div className="flex flex-col gap-[5px]">
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">
          Reset your password
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          We’ll email you a link to set a new one.
        </p>
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="email" className="text-[12.5px] font-medium text-foreground">
          Email
        </label>
        <div className="flex items-center rounded border border-border bg-surface-2 px-[13px] py-[11px]">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle-foreground"
          />
        </div>
      </div>

      {state.status === 'error' ? (
        <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded bg-accent px-4 py-[11px] text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
        Send reset link
      </button>

      <p className="text-center text-[12.5px] text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
