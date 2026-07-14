'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { signInAction, type FormState } from '@/lib/actions';

const input =
  'w-full rounded border border-line bg-panel-2 px-3 py-2.5 text-[13.5px] text-chalk outline-none placeholder:text-dim focus:border-ember/60';

export function SignInForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="flex w-full max-w-[380px] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[12.5px] font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          placeholder="tunde@example.com"
          className={input}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[12.5px] font-medium">
          Password
        </label>
        <input id="password" name="password" type="password" required className={input} />
      </div>

      {state.error ? (
        <p className="rounded border border-blood/40 bg-blood/10 px-3 py-2 text-[12.5px] text-blood">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded bg-ember px-4 py-3 text-[13px] font-semibold text-coal transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-[12.5px] text-dim">
        Not a member yet?{' '}
        <Link href="/memberships" className="text-ember hover:underline">
          See memberships
        </Link>
      </p>
    </form>
  );
}
