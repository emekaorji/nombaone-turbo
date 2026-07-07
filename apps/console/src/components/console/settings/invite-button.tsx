'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Plus, X } from 'lucide-react';

import { inviteTeammateAction, type InviteState } from '@/lib/team-actions';

const initial: InviteState = {};

export function InviteButton({ canInvite }: { canInvite: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(inviteTeammateAction, initial);
  const router = useRouter();
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.link) router.refresh(); // pending list updates behind the modal
  }, [state.link, router]);

  function close() {
    setOpen(false);
    setCopied(false);
  }

  async function copy() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
    } catch {
      linkRef.current?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!canInvite) {
    return (
      <button
        type="button"
        disabled
        title="Only owners and admins can invite teammates"
        className="flex items-center gap-[5px] text-[13px] font-medium text-accent disabled:opacity-50"
      >
        <Plus className="size-[14px]" strokeWidth={2} />
        Invite
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-[5px] text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
      >
        <Plus className="size-[14px]" strokeWidth={2} />
        Invite
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Invite a teammate</span>
              <button type="button" onClick={close} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            {state.link ? (
              <div className="flex flex-col gap-3">
                <p className="text-[12.5px] text-muted-foreground">
                  Invite created for <span className="text-foreground">{state.email}</span>. Share this one-time link —
                  they set a password and join your team.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    ref={linkRef}
                    readOnly
                    value={state.link}
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2.5 py-2 font-mono text-[12px] text-foreground"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="flex shrink-0 items-center gap-1.5 rounded bg-accent px-3 py-2 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                  >
                    {copied ? <Check className="size-[14px]" strokeWidth={2.5} /> : <Copy className="size-[14px]" strokeWidth={2} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <span className="text-[11px] text-subtle-foreground">The link expires in 7 days. You won&apos;t see it again.</span>
                <button
                  type="button"
                  onClick={close}
                  className="self-end rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
                >
                  Done
                </button>
              </div>
            ) : (
              <form action={action} className="flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-muted-foreground">Email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoFocus
                    placeholder="teammate@company.com"
                    className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-muted-foreground">Role</span>
                  <select
                    name="role"
                    defaultValue="developer"
                    className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border"
                  >
                    <option value="admin">Admin — manage team, keys, webhooks</option>
                    <option value="developer">Developer — keys, webhooks, read</option>
                    <option value="viewer">Viewer — read-only</option>
                  </select>
                </label>
                {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
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
                    disabled={pending}
                    className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {pending ? 'Creating…' : 'Create invite link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
