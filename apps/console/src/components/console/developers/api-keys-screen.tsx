'use client';

import { Check, Copy, KeyRound, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { DeveloperTabs } from '@/components/console/developer-tabs';
import { createKeyAction, revokeKeyAction } from '@/lib/api-keys-actions';
import type { ApiKeyListItem } from '@/lib/api-keys';

export function ApiKeysScreen({
  keys,
  canManage,
  mode,
}: {
  keys: ApiKeyListItem[];
  canManage: boolean;
  mode: 'sandbox' | 'live';
}) {
  const router = useRouter();
  const [justMinted, setJustMinted] = useState<{ secret: string; keyPrefix: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRef, setConfirmRef] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createKeyAction(fd);
      if (res.status === 'error') {
        setError(res.message);
      } else {
        setJustMinted({ secret: res.secret, keyPrefix: res.keyPrefix });
        setModalOpen(false);
        setError(null);
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  function copySecret() {
    if (!justMinted) return;
    void navigator.clipboard?.writeText(justMinted.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke(reference: string) {
    startTransition(async () => {
      await revokeKeyAction(reference);
      setConfirmRef(null);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Developers</h1>
          <p className="text-[14px] text-muted-foreground">
            Keys, webhooks, events, logs, and test-mode instruments. Your control panel behind the SDK.
          </p>
        </div>
        {canManage ? (
          <button
            onClick={() => {
              setError(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            <Plus className="size-4" strokeWidth={2} />
            Create key
          </button>
        ) : null}
      </div>

      <DeveloperTabs />

      {/* Reveal-once secret banner */}
      {justMinted ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-accent-border bg-surface-2 px-[18px] py-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="size-4 text-accent" strokeWidth={2} />
            <span className="text-[14px] font-semibold text-foreground">Save your new secret key</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${mode === 'live' ? 'bg-accent-muted text-accent' : 'bg-warning-bg text-warning'}`}
            >
              {mode === 'live' ? 'Live' : 'Sandbox'}
            </span>
            <button
              onClick={() => setJustMinted(null)}
              aria-label="Dismiss"
              className="ml-auto text-subtle-foreground hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Copy it now. For your security, Nomba One will not show this secret again.
          </p>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 truncate rounded border border-border bg-background px-3 py-2.5 font-mono text-[13px] text-foreground">
              {justMinted.secret}
            </div>
            <button
              onClick={copySecret}
              className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-[9px] text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              {copied ? <Check className="size-3.5" strokeWidth={2.5} /> : <Copy className="size-3.5" strokeWidth={2} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Keys table */}
      {keys.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-1 px-6 text-center">
          <KeyRound className="size-6 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-[14px] font-medium text-foreground">No API keys yet</span>
          <span className="text-[12.5px] text-muted-foreground">
            Create a key to authenticate your server against the {mode} API.
          </span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">KEY</span>
            <span className="w-[320px]">SCOPES</span>
            <span className="w-[110px]">LAST USED</span>
            <span className="w-[90px]">CREATED</span>
            <span className="w-[80px]" />
          </div>
          {keys.map((k, i) => (
            <div
              key={k.reference}
              className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${k.revoked ? 'opacity-55' : ''} ${i < keys.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-[12.5px] text-foreground">{k.prefix}</span>
                <span className="truncate text-[11.5px] text-subtle-foreground">{k.name}</span>
              </div>
              <div className="flex w-[320px] items-center gap-1.5">
                {k.scopes.slice(0, 2).map((sc) => (
                  <span key={sc} className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {sc}
                  </span>
                ))}
                {k.scopes.length > 2 ? (
                  <span className="text-[11.5px] text-subtle-foreground">+{k.scopes.length - 2}</span>
                ) : null}
              </div>
              <span className="w-[110px] text-[12.5px] text-muted-foreground">{k.lastUsed}</span>
              <span className="w-[90px] text-[12.5px] text-muted-foreground">{k.created}</span>
              <div className="w-[80px]">
                {k.revoked ? (
                  <span className="text-[12.5px] text-subtle-foreground">Revoked</span>
                ) : canManage ? (
                  confirmRef === k.reference ? (
                    <button
                      onClick={() => revoke(k.reference)}
                      disabled={pending}
                      className="rounded-sm bg-danger px-2 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmRef(k.reference)}
                      className="text-[12.5px] text-danger hover:underline"
                    >
                      Revoke
                    </button>
                  )
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={() => setModalOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex w-full max-w-[440px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">Create API key</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form ref={formRef} onSubmit={submitCreate} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Key name</span>
                <input
                  name="name"
                  autoFocus
                  placeholder="Production server"
                  className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong"
                />
              </label>
              <p className="text-[12px] text-subtle-foreground">
                Minted for the <span className="font-medium text-foreground">{mode}</span> ring. The secret is shown
                once, right after you create it.
              </p>
              {error ? (
                <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Create key
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
