import { CreditCard, Landmark, ArrowLeftRight, Check, type LucideIcon } from 'lucide-react';

import { RailBadge, type Rail } from '@/components/console/rail-badge';

type Tone = 'success' | 'warning' | 'info' | 'danger';

const rails = [
  {
    icon: CreditCard, name: 'Card', volume: '₦5.2M',
    sub1: '1,204 active cards · 41 need update',
    chip: { text: 'OTP on recharge', tone: 'warning' as Tone },
    rateLabel: 'Recovery rate', rate: 68, rateTone: 'warning' as Tone,
    note: 'Best-effort recharge. When the bank forces OTP, we fall back to a checkout link.',
  },
  {
    icon: Landmark, name: 'Direct debit', volume: '₦2.1M',
    sub1: '890 mandates active · 12 pending consent',
    chip: { text: 'Healthy', tone: 'success' as Tone },
    rateLabel: 'Success rate', rate: 92, rateTone: 'success' as Tone,
    note: 'NIBSS mandate pulls on payday. No customer action once consent is granted.',
  },
  {
    icon: ArrowLeftRight, name: 'Bank transfer', volume: '₦0.9M',
    sub1: '318 reconciled · 6 pending match',
    chip: { text: 'Reconciled', tone: 'info' as Tone },
    rateLabel: 'Match rate', rate: 99, rateTone: 'info' as Tone,
    note: 'Push payments reconciled to the kobo against Nomba.',
  },
];

type MStatus = 'active' | 'expired' | 'consent_pending';
type MRow = { customer: string; icon: LucideIcon; method: string; sub: string; rail: Rail; status: MStatus; def: boolean; added: string };
const methods: MRow[] = [
  { customer: 'Ada Obi', icon: CreditCard, method: 'Visa ·4242', sub: 'exp 09/28', rail: 'card', status: 'active', def: true, added: '12 Jun' },
  { customer: 'Bola Foods', icon: Landmark, method: 'GTBank mandate', sub: 'NIBSS · pull on payday', rail: 'ddebit', status: 'active', def: true, added: '2 Jan' },
  { customer: 'Zed Studio', icon: CreditCard, method: 'Mastercard ·5100', sub: 'exp 03/27', rail: 'card', status: 'active', def: true, added: '4 Feb' },
  { customer: 'Uche Media', icon: CreditCard, method: 'Visa ·2481', sub: 'exp 06/26', rail: 'card', status: 'expired', def: false, added: '14 Jun' },
  { customer: 'Mira Ltd', icon: ArrowLeftRight, method: 'Virtual account ·9931', sub: 'Wema · dedicated', rail: 'transfer', status: 'active', def: true, added: '8 Mar' },
  { customer: 'Kola Retail', icon: Landmark, method: 'Access mandate', sub: 'NIBSS · awaiting consent', rail: 'ddebit', status: 'consent_pending', def: false, added: '19 Nov' },
  { customer: 'Pau Ade', icon: CreditCard, method: 'Verve ·7788', sub: 'exp 11/29', rail: 'card', status: 'active', def: true, added: '1 Sep' },
];

const toneBg: Record<Tone, string> = { success: 'bg-success-bg', warning: 'bg-warning-bg', info: 'bg-info-bg', danger: 'bg-danger-bg' };
const toneText: Record<Tone, string> = { success: 'text-success', warning: 'text-warning', info: 'text-info', danger: 'text-danger' };
const toneFill: Record<Tone, string> = { success: 'bg-success', warning: 'bg-warning', info: 'bg-info', danger: 'bg-danger' };

const MSTATUS: Record<MStatus, { label: string; tone: Tone; dot: string }> = {
  active: { label: 'Active', tone: 'success', dot: 'bg-success' },
  expired: { label: 'Expired', tone: 'danger', dot: 'bg-danger' },
  consent_pending: { label: 'Consent pending', tone: 'warning', dot: 'bg-warning' },
};

export default function PaymentsPage() {
  return (
    <div className="flex h-full flex-col gap-4 lg:gap-5 px-4 lg:px-7 py-4 lg:py-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Payments and rails</h1>
        <p className="text-[14px] text-muted-foreground">
          One subscription, every rail. How money reaches you, and how well each rail performs.
        </p>
      </div>

      {/* Rails overview */}
      <div className="flex gap-4">
        {rails.map((r) => (
          <div key={r.name} className="flex flex-1 flex-col gap-[13px] rounded-lg border border-border bg-surface-1 p-[18px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-[34px] items-center justify-center rounded bg-surface-2">
                  <r.icon className="size-[17px] text-foreground" strokeWidth={1.75} />
                </div>
                <span className="text-[14.5px] font-semibold text-foreground">{r.name}</span>
              </div>
              <span className={`rounded-full px-[9px] py-[3px] text-[11px] font-medium ${toneBg[r.chip.tone]} ${toneText[r.chip.tone]}`}>
                {r.chip.text}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">{r.volume}</span>
              <span className="text-[12px] text-subtle-foreground">collected, 30 days</span>
            </div>
            <span className="text-[12.5px] text-muted-foreground">{r.sub1}</span>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] text-subtle-foreground">{r.rateLabel}</span>
              <span className={`font-mono text-[11.5px] ${toneText[r.rateTone]}`}>{r.rate}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full rounded-full ${toneFill[r.rateTone]}`} style={{ width: `${r.rate}%` }} />
            </div>
            <span className="text-[11.5px] text-subtle-foreground">{r.note}</span>
          </div>
        ))}
      </div>

      {/* Methods */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-semibold text-foreground">Payment methods</span>
          <span className="text-[12.5px] text-subtle-foreground">1,558 methods</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">CUSTOMER</span>
            <span className="w-[230px]">METHOD</span>
            <span className="w-[150px]">RAIL</span>
            <span className="w-[150px]">STATUS</span>
            <span className="w-[80px]">DEFAULT</span>
            <span className="w-[90px]">ADDED</span>
          </div>

          {methods.map((m, i) => {
            const s = MSTATUS[m.status];
            return (
              <div
                key={m.customer}
                className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < methods.length - 1 ? 'border-b border-border' : ''}`}
              >
                <span className="flex-1 text-[13px] font-medium text-foreground">{m.customer}</span>
                <div className="flex w-[230px] items-center gap-2.5">
                  <m.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13px] text-foreground">{m.method}</span>
                    <span className="truncate text-[11px] text-subtle-foreground">{m.sub}</span>
                  </div>
                </div>
                <div className="w-[150px]">
                  <RailBadge rail={m.rail} />
                </div>
                <div className="w-[150px]">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${toneBg[s.tone]}`}>
                    <span className={`size-1.5 rounded-full ${s.dot}`} />
                    <span className={`text-[12px] font-medium ${toneText[s.tone]}`}>{s.label}</span>
                  </span>
                </div>
                <div className="w-[80px]">
                  {m.def ? <Check className="size-[15px] text-accent" strokeWidth={2.5} /> : <span className="text-[13px] text-subtle-foreground">—</span>}
                </div>
                <span className="w-[90px] text-[12.5px] text-muted-foreground">{m.added}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
