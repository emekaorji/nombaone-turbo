'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveOrgSettingsAction } from '@/lib/org-settings-actions';
import type { OrgSettingsView } from '@/lib/org-settings';

const inputCls =
  'rounded border border-border bg-surface-2 px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-border-strong disabled:opacity-60';

export function OrgSettingsForm({ org, canEdit }: { org: OrgSettingsView['org']; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(org);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(org);
  const swatch = /^#[0-9a-fA-F]{6}$/.test(form.primaryColorHex) ? form.primaryColorHex : '#0bdfa3';

  function save() {
    const fd = new FormData();
    fd.set('name', form.name);
    fd.set('supportEmail', form.supportEmail);
    fd.set('primaryColorHex', form.primaryColorHex);
    fd.set('settlementMode', form.settlementMode);
    startTransition(async () => {
      const res = await saveOrgSettingsAction(fd);
      if (!res.ok) setError(res.message ?? 'Could not save.');
      else {
        setError(null);
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 self-start rounded-lg border border-border bg-surface-1 p-5">
      <span className="text-[15px] font-semibold text-foreground">Organization</span>

      <label className="flex flex-col gap-[7px]">
        <span className="text-[12.5px] font-medium text-foreground">Display name</span>
        <input
          disabled={!canEdit}
          value={form.name}
          onChange={(e) => {
            setForm((f) => ({ ...f, name: e.target.value }));
            setSaved(false);
          }}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-[7px]">
        <span className="text-[12.5px] font-medium text-foreground">Support email</span>
        <input
          disabled={!canEdit}
          value={form.supportEmail}
          placeholder="support@acme.io"
          onChange={(e) => {
            setForm((f) => ({ ...f, supportEmail: e.target.value }));
            setSaved(false);
          }}
          className={inputCls}
        />
      </label>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-[7px]">
          <span className="text-[12.5px] font-medium text-foreground">Primary color</span>
          <div className="flex items-center gap-2.5 rounded border border-border bg-surface-2 px-3 py-2">
            <span className="size-5 shrink-0 rounded-sm border border-border" style={{ backgroundColor: swatch }} />
            <input
              disabled={!canEdit}
              value={form.primaryColorHex}
              onChange={(e) => {
                setForm((f) => ({ ...f, primaryColorHex: e.target.value }));
                setSaved(false);
              }}
              className="w-full bg-transparent font-mono text-[13px] text-foreground outline-none disabled:opacity-60"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[7px]">
          <span className="text-[12.5px] font-medium text-foreground">Settlement mode</span>
          <select
            disabled={!canEdit}
            value={form.settlementMode}
            onChange={(e) => {
              setForm((f) => ({ ...f, settlementMode: e.target.value as OrgSettingsView['org']['settlementMode'] }));
              setSaved(false);
            }}
            className={`${inputCls} py-2`}
          >
            <option value="split_at_collection">Split at collection</option>
            <option value="collect_then_payout">Collect then payout</option>
          </select>
        </div>
      </div>

      {/* Quota (read-only, real) */}
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-foreground">Monthly request quota</span>
        <span className="font-mono text-[12px] text-muted-foreground">
          {org.monthlyRequestQuota != null ? org.monthlyRequestQuota.toLocaleString('en-US') : 'Unlimited'}
        </span>
      </div>

      {error ? (
        <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">{error}</p>
      ) : null}

      {canEdit ? (
        <div className="mt-1 flex items-center gap-2.5">
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
            Save changes
          </button>
          {dirty ? (
            <button
              onClick={() => {
                setForm(org);
                setError(null);
              }}
              className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
            >
              Discard
            </button>
          ) : null}
          {saved && !dirty ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-success">
              <Check className="size-4" strokeWidth={2.5} />
              Saved
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-subtle-foreground">Your role can view but not change organization settings.</p>
      )}
    </div>
  );
}
