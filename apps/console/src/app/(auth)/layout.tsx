import { AuthBrandPanel } from '@/components/auth/brand-panel';
import { MobileBrandBand } from '@/components/auth/mobile-brand-band';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AuthBrandPanel />
      <div className="flex w-full flex-col lg:w-[560px] lg:shrink-0 lg:border-l lg:border-border lg:bg-surface-1">
        <MobileBrandBand />
        <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-8 lg:justify-center lg:px-20 lg:pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
