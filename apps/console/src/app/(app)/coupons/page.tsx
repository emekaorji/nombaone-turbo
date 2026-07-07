export const dynamic = 'force-dynamic';

import { Ticket } from 'lucide-react';

import { EmptyState } from '@/components/console/empty-state';
import { EditCouponButton } from '@/components/console/coupons/edit-coupon-button';
import { NewCouponButton } from '@/components/console/coupons/new-coupon-button';
import { listCouponsAndCredits, type CouponStatus } from '@/lib/coupons';
import { nairaShort } from '@/lib/money';

const CSTATUS: Record<CouponStatus, { label: string; text: string; bg: string; dot: string }> = {
  active: { label: 'Active', text: 'text-success', bg: 'bg-success-bg', dot: 'bg-success' },
  expired: { label: 'Expired', text: 'text-muted-foreground', bg: 'bg-surface-2', dot: 'bg-subtle-foreground' },
};

export default async function CouponsPage() {
  const { coupons, grants, stats } = await listCouponsAndCredits();
  const statCards = [
    { value: String(stats.activeCoupons), label: 'Active coupons' },
    { value: String(stats.totalRedemptions), label: 'Total redemptions' },
    { value: nairaShort(stats.discountGivenKobo), label: 'Discount given, 30 days' },
    { value: nairaShort(stats.creditOutstandingKobo), label: 'Credit outstanding' },
  ];

  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.4px] text-foreground">Coupons and credits</h1>
          <p className="text-[14px] text-muted-foreground">
            Coupons define a discount. Credits are money already owed to a customer, applied oldest first.
          </p>
        </div>
        <NewCouponButton />
      </div>

      {/* Stat strip */}
      <div className="flex items-center rounded-lg border border-border bg-surface-1 px-5 py-3.5">
        {statCards.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">{s.value}</span>
              <span className="text-[12.5px] text-muted-foreground">{s.label}</span>
            </div>
            {i < statCards.length - 1 ? <div className="h-[38px] w-px bg-border" /> : null}
          </div>
        ))}
      </div>

      {/* Coupons */}
      <span className="text-[16px] font-semibold text-foreground">Coupons</span>
      {coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          iconTone="accent"
          title="No coupons yet"
          titleSize={16}
          description={'Create a coupon to offer a discount.\nApply it to a subscription to derive the discount.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[960px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">CODE</span>
            <span className="w-[130px]">DISCOUNT</span>
            <span className="w-[170px]">DURATION</span>
            <span className="w-[150px]">REDEMPTIONS</span>
            <span className="w-[120px]">EXPIRES</span>
            <span className="w-[100px]">STATUS</span>
            <span className="w-[50px]" />
          </div>
          {coupons.map((c, i) => {
            const s = CSTATUS[c.status];
            return (
              <div
                key={c.reference}
                className={`flex min-w-[960px] items-center gap-[14px] px-4 py-3 ${i < coupons.length - 1 ? 'border-b border-border' : ''}`}
              >
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
                <div className="flex w-[50px] justify-end">
                  {c.status === 'active' ? (
                    <EditCouponButton couponRef={c.reference} code={c.code} maxRedemptions={c.maxRedemptions} redeemByISO={c.redeemByISO} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credit grants */}
      <span className="text-[16px] font-semibold text-foreground">Credit grants</span>
      {grants.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-1 px-5 py-8 text-center text-[13px] text-muted-foreground">
          No credit grants yet. Credit is granted from a customer&apos;s detail page.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-border bg-surface-1">
          <div className="flex min-w-[900px] items-center gap-[14px] border-b border-border px-4 py-3 font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">
            <span className="flex-1">CUSTOMER</span>
            <span className="w-[210px]">SOURCE</span>
            <span className="w-[130px] text-right">GRANTED</span>
            <span className="w-[130px] text-right">REMAINING</span>
            <span className="w-[110px]">DATE</span>
          </div>
          {grants.map((g, i) => (
            <div
              key={i}
              className={`flex min-w-[900px] items-center gap-[14px] px-4 py-3 ${i < grants.length - 1 ? 'border-b border-border' : ''}`}
            >
              <span className="flex-1 text-[13px] font-medium text-foreground">{g.customer}</span>
              <div className="w-[210px]">
                <span className="rounded-full bg-surface-3 px-[9px] py-0.5 font-mono text-[11.5px] text-subtle-foreground">
                  {g.source}
                </span>
              </div>
              <span className="w-[130px] text-right font-mono text-[13px] text-foreground">{g.granted}</span>
              <span
                className={`w-[130px] text-right font-mono text-[13px] ${g.zeroed ? 'text-subtle-foreground' : 'font-medium text-accent'}`}
              >
                {g.remaining}
              </span>
              <span className="w-[110px] text-[12.5px] text-muted-foreground">{g.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
