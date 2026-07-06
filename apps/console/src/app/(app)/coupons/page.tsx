import { Plus } from 'lucide-react';

const stats = [
  { value: '12', label: 'Active coupons' },
  { value: '599', label: 'Total redemptions' },
  { value: '₦210k', label: 'Discount given, 30 days' },
  { value: '₦340k', label: 'Credit outstanding' },
];

type CStatus = 'active' | 'expired' | 'scheduled';
const coupons: { code: string; discount: string; duration: string; redemptions: string; expires: string; status: CStatus }[] = [
  { code: 'LAUNCH20', discount: '20% off', duration: 'repeating · 3 cycles', redemptions: '142 / 500', expires: '31 Dec', status: 'active' },
  { code: 'WELCOME2K', discount: '₦2,000 off', duration: 'once', redemptions: '88 / ∞', expires: '—', status: 'active' },
  { code: 'LOYAL10', discount: '10% off', duration: 'forever', redemptions: '210 / ∞', expires: '—', status: 'active' },
  { code: 'BLACKFRIDAY', discount: '30% off', duration: 'once', redemptions: '0 / 500', expires: '30 Nov', status: 'scheduled' },
  { code: 'TRIAL5K', discount: '₦5,000 off', duration: 'once', redemptions: '98 / 200', expires: '15 Sep', status: 'expired' },
];

const grants: { customer: string; source: string; granted: string; remaining: string; date: string }[] = [
  { customer: 'Mira Ltd', source: 'refund', granted: '₦5,000', remaining: '₦5,000', date: '12 Sep' },
  { customer: 'Kola Retail', source: 'goodwill', granted: '₦12,000', remaining: '₦12,000', date: '1 Aug' },
  { customer: 'Ada Obi', source: 'proration', granted: '₦2,500', remaining: '₦1,600', date: '27 Sep' },
  { customer: 'Bola Foods', source: 'refund', granted: '₦8,000', remaining: '₦0', date: '19 Aug' },
  { customer: 'Nia Books', source: 'goodwill', granted: '₦800', remaining: '₦800', date: '22 Aug' },
];

const CSTATUS: Record<CStatus, { label: string; text: string; bg: string; dot: string }> = {
  active: { label: 'Active', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  scheduled: { label: 'Scheduled', text: 'text-info', bg: 'bg-info-bg', dot: 'bg-info' },
  expired: { label: 'Expired', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
};

export default function CouponsPage() {
  return (
    <div className="flex h-full flex-col gap-3.5 lg:gap-[18px] px-4 lg:px-7 py-4 lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Coupons and credits</h1>
          <p className="text-[14px] text-muted-foreground">
            Coupons define a discount. Credits are money already owed to a customer, applied oldest first.
          </p>
        </div>
        <button className="flex items-center gap-2 rounded bg-accent px-[15px] py-[9px] text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
          <Plus className="size-4" strokeWidth={2} />
          New coupon
        </button>
      </div>

      {/* Stat strip */}
      <div className="flex items-center rounded-lg border border-border bg-surface-1 px-5 py-3.5">
        {stats.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">{s.value}</span>
              <span className="text-[12.5px] text-muted-foreground">{s.label}</span>
            </div>
            {i < stats.length - 1 ? <div className="h-[38px] w-px bg-border" /> : null}
          </div>
        ))}
      </div>

      {/* Coupons */}
      <span className="text-[16px] font-semibold text-foreground">Coupons</span>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">CODE</span>
          <span className="w-[130px]">DISCOUNT</span>
          <span className="w-[170px]">DURATION</span>
          <span className="w-[150px]">REDEMPTIONS</span>
          <span className="w-[120px]">EXPIRES</span>
          <span className="w-[100px]">STATUS</span>
        </div>
        {coupons.map((c, i) => {
          const s = CSTATUS[c.status];
          return (
            <div key={c.code} className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < coupons.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="flex-1">
                <span className="rounded-full bg-accent-muted px-2.5 py-[3px] font-mono text-[12px] font-medium text-accent">
                  {c.code}
                </span>
              </div>
              <span className="w-[130px] text-[13px] font-medium text-foreground">{c.discount}</span>
              <span className="w-[170px] text-[12.5px] text-muted-foreground">{c.duration}</span>
              <span className="w-[150px] font-mono text-[12.5px] text-muted-foreground">{c.redemptions}</span>
              <span className="w-[120px] text-[12.5px] text-muted-foreground">{c.expires}</span>
              <div className="w-[100px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] ${s.bg}`}>
                  <span className={`size-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[12px] font-medium ${s.text}`}>{s.label}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Credit grants */}
      <span className="text-[16px] font-semibold text-foreground">Credit grants</span>
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
        <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
          <span className="flex-1">CUSTOMER</span>
          <span className="w-[210px]">SOURCE</span>
          <span className="w-[130px] text-right">GRANTED</span>
          <span className="w-[130px] text-right">REMAINING</span>
          <span className="w-[110px]">DATE</span>
        </div>
        {grants.map((g, i) => (
          <div key={i} className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < grants.length - 1 ? 'border-b border-border' : ''}`}>
            <span className="flex-1 text-[13px] font-medium text-foreground">{g.customer}</span>
            <div className="w-[210px]">
              <span className="rounded-full bg-surface-3 px-[9px] py-0.5 font-mono text-[11.5px] text-subtle-foreground">
                {g.source}
              </span>
            </div>
            <span className="w-[130px] text-right font-mono text-[13px] text-foreground">{g.granted}</span>
            <span className={`w-[130px] text-right font-mono text-[13px] ${g.remaining === '₦0' ? 'text-subtle-foreground' : 'font-medium text-accent'}`}>
              {g.remaining}
            </span>
            <span className="w-[110px] text-[12.5px] text-muted-foreground">{g.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
