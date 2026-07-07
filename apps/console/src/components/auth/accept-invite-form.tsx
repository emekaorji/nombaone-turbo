'use client';

import { useActionState } from 'react';

import { acceptInvitationAction, type AcceptState } from '@/lib/team-actions';

const initial: AcceptState = {};

export function AcceptInviteForm({ token, email, role }: { token: string; email: string; role: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">Email</span>
        <input
          readOnly
          value={email}
          className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-muted-foreground"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">Your name</span>
        <input
          name="name"
          required
          autoFocus
          placeholder="Ada Lovelace"
          className="rounded border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-accent-border"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted-foreground">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="rounded border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-accent-border"
        />
      </label>

      {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? 'Joining…' : `Join as ${role}`}
      </button>
    </form>
  );
}
