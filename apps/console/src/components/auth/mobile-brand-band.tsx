import { LogoSquare } from '@/components/shell/logo-square';

/** Compact brand hero shown above the login form on mobile (ExLVO · BrandBand). */
export function MobileBrandBand() {
  return (
    <div className="flex h-[270px] shrink-0 flex-col items-center justify-center gap-4 border-b border-border bg-surface-1 px-8 lg:hidden">
      <LogoSquare className="size-14" />
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">Nomba One</span>
        <span className="whitespace-pre-line text-center text-[13px] leading-[1.5] text-muted-foreground">
          {'Subscriptions & recurring revenue,\nover every Nigerian rail.'}
        </span>
      </div>
    </div>
  );
}
