'use client';

import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { resetPasswordAction } from '@/lib/auth/reset';
import type { ResetState } from '@/lib/auth/reset-types';

/** Set a new password from an emailed link. The token is bound server-side. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [show, setShow] = useState(false);
  const [state, formAction, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction.bind(null, token),
    { status: 'idle' }
  );

  if (state.status === 'done') {
    return (
      <div className="flex w-full max-w-[400px] flex-col gap-[18px]">
        <div className="flex flex-col gap-[5px]">
          <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 className="size-5 text-accent" strokeWidth={2} />
          </div>
          <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">
            Password updated
          </h1>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            We signed out every other device, so anyone who had access no longer does.
          </p>
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded bg-accent px-4 py-[11px] text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-[400px] flex-col gap-[18px]">
      <div className="flex flex-col gap-[5px]">
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">
          Set a new password
        </h1>
        <p className="text-[13.5px] text-muted-foreground">At least 10 characters.</p>
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="password" className="text-[12.5px] font-medium text-foreground">
          New password
        </label>
        <div className="flex items-center rounded border border-border bg-surface-2 px-[13px] py-[11px]">
          <input
            id="password"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            placeholder="••••••••••"
            className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle-foreground"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="text-subtle-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="confirmPassword" className="text-[12.5px] font-medium text-foreground">
          Confirm password
        </label>
        <div className="flex items-center rounded border border-border bg-surface-2 px-[13px] py-[11px]">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••••"
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
        Update password
      </button>
    </form>
  );
}
