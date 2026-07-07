'use client';

import { Archive, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { archivePlanAction, deactivatePriceAction, updatePlanAction } from '@/lib/plans-actions';

export function EditPlanButton({ planRef, name, description }: { planRef: string; name: string; description: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const r = await updatePlanAction(planRef, formData);
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(r.message ?? 'Could not save.');
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="flex items-center gap-1.5 rounded border border-border px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
      >
        <Pencil className="size-[14px] text-muted-foreground" strokeWidth={1.75} />
        Edit
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Edit plan</span>
              <button type="button" onClick={() => setOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={submit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Name</span>
                <input name="name" required defaultValue={name} className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Description</span>
                <textarea name="description" rows={3} defaultValue={description ?? ''} placeholder="What this plan is for" className="resize-none rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <span className="text-[11px] text-subtle-foreground">Prices are immutable — a price change is a new price.</span>
              {error ? <span className="text-[12px] text-danger">{error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Cancel</button>
                <button type="submit" disabled={pending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ArchivePlanButton({ planRef }: { planRef: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      await archivePlanAction(planRef);
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="rounded border border-border px-3 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
        >
          Cancel
        </button>
        <button
          onClick={archive}
          disabled={pending}
          className="rounded bg-danger px-3 py-[7px] text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          Confirm archive
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded border border-border px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:border-border-strong"
    >
      <Archive className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      Archive
    </button>
  );
}

export function DeactivatePriceButton({ priceRef }: { priceRef: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function deactivate() {
    startTransition(async () => {
      await deactivatePriceAction(priceRef);
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <button
        onClick={deactivate}
        disabled={pending}
        className="rounded-sm bg-danger px-2 py-1 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
      >
        Confirm
      </button>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-[12.5px] text-danger hover:underline">
      Deactivate
    </button>
  );
}
