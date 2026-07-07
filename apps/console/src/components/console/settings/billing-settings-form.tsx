'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveBillingSettingsAction } from '@/lib/billing-settings-actions';
import type { BillingSettingsView } from '@/lib/billing-settings';

function Toggle({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex h-[22px] w-[38px] items-center rounded-full px-[3px] transition-colors disabled:opacity-60 ${on ? 'justify-end bg-accent' : 'justify-start bg-surface-3'}`}
    >
      <span className={`size-4 rounded-full ${on ? 'bg-accent-foreground' : 'bg-muted-foreground'}`} />
    </button>
  );
}

function NumField({
  value,
  unit,
  disabled,
  onChange,
}: {
  value: number;
  unit: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-3 py-2">
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        className="w-10 bg-transparent text-right font-mono text-[13px] text-foreground outline-none disabled:opacity-60"
      />
      <span className="text-[12px] text-subtle-foreground">{unit}</span>
    </div>
  );
}

function Chips({ items }: { items: (string | number)[] }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {items.map((c, i) => (
        <span key={i} className="rounded-full bg-surface-3 px-2.5 py-1 font-mono text-[11.5px] text-muted-foreground">
          {c}
        </span>
      ))}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface-1 px-5 py-[18px]">
      <div className="flex flex-col gap-[3px]">
        <span className="text-[15px] font-semibold text-foreground">{title}</span>
        {subtitle ? <span className="text-[12.5px] text-muted-foreground">{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 py-1.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-[11.5px] text-subtle-foreground">{desc}</span>
      </div>
      {children}
    </div>
  );
}

export function BillingSettingsForm({ settings, canEdit }: { settings: BillingSettingsView; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const set = <K extends keyof BillingSettingsView>(k: K, v: BillingSettingsView[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  function save() {
    const fd = new FormData();
    fd.set('dunningMaxAttempts', String(form.dunningMaxAttempts));
    fd.set('gracePeriodHours', String(form.gracePeriodHours));
    fd.set('dunningMaxWindowHours', String(form.dunningMaxWindowHours));
    fd.set('paydayPullForwardDays', String(form.paydayPullForwardDays));
    if (form.paydayBiasEnabled) fd.set('paydayBiasEnabled', 'on');
    if (form.partialCollectionEnabled) fd.set('partialCollectionEnabled', 'on');
    if (form.commsEnabled) fd.set('commsEnabled', 'on');
    fd.set('defaultCollectionMethod', form.defaultCollectionMethod);
    startTransition(async () => {
      const res = await saveBillingSettingsAction(fd);
      if (!res.ok) setError(res.message ?? 'Could not save.');
      else {
        setError(null);
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto">
      <Card title="Retry policy" subtitle="How dunning retries a failed charge.">
        <Row label="Maximum attempts" desc="Then the subscription churns involuntarily.">
          <NumField
            value={form.dunningMaxAttempts}
            unit="attempts"
            disabled={!canEdit}
            onChange={(v) => set('dunningMaxAttempts', v)}
          />
        </Row>
        <Row label="Retry intervals" desc="Hours after each failure.">
          <Chips items={form.dunningIntervalsHours.map((h) => `${h}h`)} />
        </Row>
        <Row label="Grace period" desc="How long the subscriber keeps access.">
          <NumField
            value={form.gracePeriodHours}
            unit="hours"
            disabled={!canEdit}
            onChange={(v) => set('gracePeriodHours', v)}
          />
        </Row>
        <Row label="Maximum window" desc="Give up after this long.">
          <NumField
            value={form.dunningMaxWindowHours}
            unit="hours"
            disabled={!canEdit}
            onChange={(v) => set('dunningMaxWindowHours', v)}
          />
        </Row>
      </Card>

      <Card
        title="Payday timing"
        subtitle="Retries snap forward onto payday, because a thin balance usually means not yet."
      >
        <Row label="Payday bias" desc="Time retries to the salary window.">
          <Toggle
            on={form.paydayBiasEnabled}
            disabled={!canEdit}
            onToggle={() => set('paydayBiasEnabled', !form.paydayBiasEnabled)}
          />
        </Row>
        <Row label="Payday days" desc="Days of the month to prefer.">
          <Chips items={form.paydayDays} />
        </Row>
        <Row label="Pull-forward window" desc="Snap forward up to this many days.">
          <NumField
            value={form.paydayPullForwardDays}
            unit="days"
            disabled={!canEdit}
            onChange={(v) => set('paydayPullForwardDays', v)}
          />
        </Row>
      </Card>

      <Card title="Collection">
        <Row label="Partial collection" desc="Accept a partial payment against an open invoice. Off by default.">
          <Toggle
            on={form.partialCollectionEnabled}
            disabled={!canEdit}
            onToggle={() => set('partialCollectionEnabled', !form.partialCollectionEnabled)}
          />
        </Row>
        <Row label="Default collection method" desc="How new subscriptions collect unless overridden.">
          <select
            disabled={!canEdit}
            value={form.defaultCollectionMethod}
            onChange={(e) => set('defaultCollectionMethod', e.target.value as BillingSettingsView['defaultCollectionMethod'])}
            className="rounded border border-border bg-surface-2 px-3 py-2 font-mono text-[12.5px] text-foreground outline-none focus:border-border-strong disabled:opacity-60"
          >
            <option value="charge_automatically">charge_automatically</option>
            <option value="send_invoice">send_invoice</option>
          </select>
        </Row>
        <Row label="Customer communications" desc="Send dunning emails and pay-link nudges.">
          <Toggle on={form.commsEnabled} disabled={!canEdit} onToggle={() => set('commsEnabled', !form.commsEnabled)} />
        </Row>
      </Card>

      {error ? (
        <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">{error}</p>
      ) : null}

      {canEdit ? (
        <div className="flex items-center justify-end gap-2.5">
          {saved && !dirty ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-success">
              <Check className="size-4" strokeWidth={2.5} />
              Saved
            </span>
          ) : null}
          <button
            onClick={() => {
              setForm(settings);
              setError(null);
              setSaved(false);
            }}
            disabled={!dirty || pending}
            className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
            Save policy
          </button>
        </div>
      ) : (
        <p className="text-right text-[12px] text-subtle-foreground">Your role can view but not change billing settings.</p>
      )}
    </div>
  );
}
