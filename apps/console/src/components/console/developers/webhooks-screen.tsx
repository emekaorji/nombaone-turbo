'use client';

import { Check, Copy, Globe, KeyRound, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { DeveloperTabs } from '@/components/console/developer-tabs';
import { createEndpointAction, disableEndpointAction, replayDeliveryAction, rotateSecretAction, updateEndpointAction } from '@/lib/webhooks-actions';
import type { DeliveryItem, DeliveryStatus, EndpointItem } from '@/lib/webhooks';

const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; text: string; dot: string }> = {
  succeeded: { label: 'Delivered', text: 'text-success', dot: 'bg-success' },
  pending: { label: 'Pending', text: 'text-warning', dot: 'bg-warning' },
  failed: { label: 'Failed', text: 'text-danger', dot: 'bg-danger' },
  dead: { label: 'Dead', text: 'text-danger', dot: 'bg-danger' },
};

export function WebhooksScreen({
  endpoints,
  deliveries,
  canManage,
  mode,
}: {
  endpoints: EndpointItem[];
  deliveries: DeliveryItem[];
  canManage: boolean;
  mode: 'sandbox' | 'live';
}) {
  const router = useRouter();
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRef, setConfirmRef] = useState<string | null>(null);
  const [editEp, setEditEp] = useState<EndpointItem | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editEp) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateEndpointAction(editEp.reference, fd);
      if (r.ok) {
        setEditEp(null);
        router.refresh();
      } else {
        setError(r.message ?? 'Could not update.');
      }
    });
  }

  function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createEndpointAction(fd);
      if (res.status === 'error') setError(res.message);
      else {
        setJustCreated(res.signingSecret);
        setModalOpen(false);
        setError(null);
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  function copySecret() {
    if (!justCreated) return;
    void navigator.clipboard?.writeText(justCreated);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function disable(reference: string) {
    startTransition(async () => {
      await disableEndpointAction(reference);
      setConfirmRef(null);
      router.refresh();
    });
  }

  function rotate(reference: string) {
    startTransition(async () => {
      const r = await rotateSecretAction(reference);
      if (r.ok) {
        setJustCreated(r.signingSecret);
        router.refresh();
      } else {
        setError(r.message);
      }
    });
  }

  function replay(endpointReference: string, deliveryReference: string) {
    startTransition(async () => {
      const r = await replayDeliveryAction(endpointReference, deliveryReference);
      if (!r.ok) setError(r.message ?? 'Could not replay.');
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-6">
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
            Add endpoint
          </button>
        ) : null}
      </div>

      <DeveloperTabs />

      {/* Reveal-once signing secret */}
      {justCreated ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-accent-border bg-surface-2 px-[18px] py-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="size-4 text-accent" strokeWidth={2} />
            <span className="text-[14px] font-semibold text-foreground">Save the signing secret</span>
            <button
              onClick={() => setJustCreated(null)}
              aria-label="Dismiss"
              className="ml-auto text-subtle-foreground hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Verify every delivery with this secret. Nomba One will not show it again.
          </p>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 truncate rounded border border-border bg-background px-3 py-2.5 font-mono text-[13px] text-foreground">
              {justCreated}
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

      {/* Endpoints */}
      {endpoints.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-1 px-6 text-center">
          <Globe className="size-6 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-[14px] font-medium text-foreground">No webhook endpoints yet</span>
          <span className="text-[12.5px] text-muted-foreground">
            Add an https endpoint to receive {mode} events, signed and delivered at-least-once.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {endpoints.map((ep) => (
            <div key={ep.reference} className="flex flex-col gap-[14px] rounded-lg border border-border bg-surface-1 p-[18px]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Globe className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="truncate font-mono text-[14px] font-medium text-foreground">{ep.url}</span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-[9px] py-[3px] ${ep.active ? 'bg-success-bg' : 'bg-surface-2'}`}
                  >
                    <span className={`size-1.5 rounded-full ${ep.active ? 'bg-success' : 'bg-subtle-foreground'}`} />
                    <span className={`text-[12px] font-medium ${ep.active ? 'text-success' : 'text-muted-foreground'}`}>
                      {ep.active ? 'Active' : 'Disabled'}
                    </span>
                  </span>
                </div>
                {canManage && ep.active ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <button onClick={() => { setError(null); setEditEp(ep); }} className="text-[12.5px] text-muted-foreground hover:text-foreground">
                      Edit
                    </button>
                    <button onClick={() => rotate(ep.reference)} disabled={pending} className="text-[12.5px] text-accent hover:underline disabled:opacity-50">
                      Rotate secret
                    </button>
                    {confirmRef === ep.reference ? (
                      <button
                        onClick={() => disable(ep.reference)}
                        disabled={pending}
                        className="rounded-sm bg-danger px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                      >
                        Confirm disable
                      </button>
                    ) : (
                      <button onClick={() => setConfirmRef(ep.reference)} className="text-[12.5px] text-danger hover:underline">
                        Disable
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="truncate font-mono text-[11.5px] text-subtle-foreground">
                Signing secret {ep.secretPrefix} · {ep.events} · x-nombaone-delivery-guarantee: at-least-once · added{' '}
                {ep.created}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Recent deliveries */}
      <span className="text-[16px] font-semibold text-foreground">Recent deliveries</span>
      {deliveries.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-1 px-6 text-center">
          <span className="text-[13.5px] font-medium text-foreground">No deliveries yet</span>
          <span className="text-[12.5px] text-muted-foreground">
            Deliveries appear here as events fire — each is signed, retried, and replayable.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[720px] items-center gap-[14px] border-b border-border px-4 py-[11px] font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">EVENT</span>
            <span className="w-[140px]">STATUS</span>
            <span className="w-[80px]">ATTEMPTS</span>
            <span className="w-[70px]">TIME</span>
            <span className="w-[80px]" />
          </div>
          {deliveries.map((d, i) => {
            const s = DELIVERY_STATUS[d.status];
            return (
              <div key={d.reference} className={`flex min-w-[720px] items-center gap-[14px] px-4 py-[11px] ${i < deliveries.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-mono text-[12.5px] text-foreground">{d.eventType}</span>
                  <span className="truncate font-mono text-[10.5px] text-subtle-foreground">
                    {d.reference}{d.replayed ? ' · replayed' : ''}
                  </span>
                </div>
                <div className="flex w-[140px] items-center gap-1.5">
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                  {d.responseStatus != null ? <span className="font-mono text-[11px] text-subtle-foreground">{d.responseStatus}</span> : null}
                </div>
                <span className="w-[80px] font-mono text-[12.5px] text-muted-foreground">{d.attempts}</span>
                <span className="w-[70px] text-[12px] text-muted-foreground">{d.time}</span>
                <div className="flex w-[80px] justify-end">
                  {canManage ? (
                    <button onClick={() => replay(d.endpointReference, d.reference)} disabled={pending} className="text-[11.5px] text-accent hover:underline disabled:opacity-50">
                      Replay
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit endpoint modal */}
      {editEp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={() => setEditEp(null)} className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex w-full max-w-[460px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">Edit endpoint</h2>
              <button onClick={() => setEditEp(null)} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={submitEdit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Endpoint URL</span>
                <input
                  name="url"
                  autoFocus
                  defaultValue={editEp.url}
                  className="rounded border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-foreground outline-none focus:border-border-strong"
                />
              </label>
              <p className="text-[12px] text-subtle-foreground">The signing secret is unchanged. Rotate it separately if needed.</p>
              {error ? <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">{error}</p> : null}
              <div className="mt-1 flex items-center justify-end gap-2.5">
                <button type="button" onClick={() => setEditEp(null)} className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70">
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Add endpoint modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={() => setModalOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex w-full max-w-[460px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">Add webhook endpoint</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form ref={formRef} onSubmit={submitCreate} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Endpoint URL</span>
                <input
                  name="url"
                  autoFocus
                  placeholder="https://api.acme.io/webhooks/nomba"
                  className="rounded border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-foreground outline-none focus:border-border-strong"
                />
              </label>
              <p className="text-[12px] text-subtle-foreground">
                Subscribes to all events. The signing secret is shown once after you add it.
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
                  Add endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
