'use client';

import { Eye, EyeOff, Globe, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { signupAction, type SignupState } from '@/lib/auth/actions';

const fieldWrap = 'flex items-center rounded border border-border bg-surface-2 px-[13px] py-[11px]';
const fieldInput = 'w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle-foreground';

export function SignupForm() {
  const [show, setShow] = useState(false);
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction, { status: 'idle' });

  return (
    <form action={formAction} className="flex w-full max-w-[400px] flex-col gap-[18px]">
      {/* Heading */}
      <div className="flex flex-col gap-[5px]">
        <h1 className="text-[23px] font-semibold tracking-[-0.4px] text-foreground">Create your console</h1>
        <p className="text-[13.5px] text-muted-foreground">Start building on Nomba One. Sandbox is free — go live when you&apos;re ready.</p>
      </div>

      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="name" className="text-[12.5px] font-medium text-foreground">
            Full name
          </label>
          <div className={fieldWrap}>
            <input id="name" name="name" type="text" autoComplete="name" placeholder="Ada Obi" className={fieldInput} />
          </div>
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="businessName" className="text-[12.5px] font-medium text-foreground">
            Business name
          </label>
          <div className={fieldWrap}>
            <input id="businessName" name="businessName" type="text" autoComplete="organization" placeholder="Acme Ltd" className={fieldInput} />
          </div>
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="email" className="text-[12.5px] font-medium text-foreground">
            Work email
          </label>
          <div className={fieldWrap}>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className={fieldInput} />
          </div>
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor="password" className="text-[12.5px] font-medium text-foreground">
            Password
          </label>
          <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-[13px] py-[11px]">
            <input
              id="password"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={fieldInput}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="shrink-0 text-subtle-foreground transition-colors hover:text-muted-foreground"
            >
              {show ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {state.status === 'error' ? (
        <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">{state.message}</p>
      ) : null}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded bg-accent px-4 py-[11px] text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
        Create account
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-subtle-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Google */}
      <button
        type="button"
        disabled
        title="Google sign-in is coming soon"
        className="flex w-full items-center justify-center gap-[9px] rounded border border-border bg-surface-2 px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-60"
      >
        <Globe className="size-4 text-muted-foreground" strokeWidth={1.75} />
        Continue with Google
      </button>

      {/* Note */}
      <div className="flex items-center gap-[7px] pt-0.5">
        <Shield className="size-[14px] shrink-0 text-subtle-foreground" strokeWidth={1.75} />
        <span className="text-[11.5px] text-subtle-foreground">You&apos;ll be the owner. Set up two-factor from Settings after you sign in.</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-[5px] pt-2">
        <span className="text-[13px] text-muted-foreground">Already have an account?</span>
        <Link href="/login" className="text-[13px] font-medium text-accent hover:underline">
          Sign in
        </Link>
      </div>
    </form>
  );
}
