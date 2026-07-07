import { Check } from 'lucide-react';

import { LogoSquare } from '@/components/shell/logo-square';

const BULLETS = [
  'The money is never wrong',
  'One subscription, every rail',
  'Dunning tuned for thin balances',
];

/** Left brand panel for the auth split (svmeK), radial emerald glow. */
export function AuthBrandPanel() {
  return (
    <div
      data-theme="dark"
      className="relative hidden flex-1 flex-col justify-between overflow-hidden p-16 pb-14 lg:flex"
      style={{ background: 'radial-gradient(110% 100% at 34% 40%, #0b3527 0%, #040404 100%)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <LogoSquare className="size-8" />
        <span className="text-[17px] font-semibold text-foreground">Nomba One</span>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-[11px] text-subtle-foreground">
          Console
        </span>
      </div>

      {/* Middle */}
      <div className="flex w-[520px] max-w-full flex-col gap-[18px]">
        <h1 className="text-[44px] font-semibold leading-[1.06] tracking-[-1.6px] text-foreground">
          The console for recurring revenue.
        </h1>
        <p className="text-[16px] leading-[1.5] text-muted-foreground">
          Plans, cycles, proration, dunning, reconciliation, and settlement. One place to run
          subscriptions across every rail.
        </p>
        <div className="flex flex-col gap-[11px] pt-2.5">
          {BULLETS.map((b) => (
            <div key={b} className="flex items-center gap-2.5">
              <Check className="size-4 shrink-0 text-accent" strokeWidth={2} />
              <span className="text-[14px] text-foreground">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Copy */}
      <span className="text-[12px] text-subtle-foreground">© Nomba One</span>
    </div>
  );
}
