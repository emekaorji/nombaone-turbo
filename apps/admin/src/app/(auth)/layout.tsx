import { LogoIcon } from '@/components/brand/LogoIcon';

/**
 * Auth route-group layout: a centered, chrome-free shell for the operator
 * sign-in screen. No sidebar/topbar here — the dashboard chrome lives in the
 * `(dashboard)` group.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8 flex items-center gap-2.5">
        <span aria-hidden className="grid size-8 place-items-center rounded-md bg-primary">
          <LogoIcon className="size-4 text-purple-50" />
        </span>
        <span className="text-lg font-bold tracking-[-0.2px] text-foreground">Nombaone</span>
        <span className="rounded-xs bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.5px] text-neutral-600">
          ADMIN
        </span>
      </div>
      {children}
    </div>
  );
}
