import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Foundation smoke-test: renders the design-language v2 tokens so the palette
 * can be verified visually (dark-first + light) before any surface is built.
 * Not a shipped route; the real Design System surface maps to the .pen DS board.
 */

function Swatch({ label, hex, className, ring }: { label: string; hex?: string; className: string; ring?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-16 rounded-lg ${className} ${ring ? 'ring-1 ring-inset ring-border' : ''}`} />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hex ? <span className="font-mono text-[11px] text-subtle-foreground">{hex}</span> : null}
      </div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Design language v2</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Token foundation, sourced 1:1 from NOMBAONE.pen. Dark is default; toggle to verify light.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">Surfaces</h2>
        <div className="grid grid-cols-4 gap-4">
          <Swatch label="background" className="bg-background" ring />
          <Swatch label="surface-1" className="bg-surface-1" ring />
          <Swatch label="surface-2" className="bg-surface-2" ring />
          <Swatch label="surface-3" className="bg-surface-3" ring />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">Accent (brand)</h2>
        <div className="grid grid-cols-4 gap-4">
          <Swatch label="accent" hex="#0bdfa3" className="bg-accent" />
          <Swatch label="accent-hover" className="bg-accent-hover" />
          <Swatch label="accent-muted" className="bg-accent-muted" ring />
          <Swatch label="accent-border" className="bg-accent-border" ring />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">Semantic</h2>
        <div className="grid grid-cols-4 gap-4">
          <Swatch label="success" className="bg-success" />
          <Swatch label="warning" className="bg-warning" />
          <Swatch label="danger" className="bg-danger" />
          <Swatch label="info" className="bg-info" />
          <div className="rounded-lg border border-success/40 bg-success-bg px-3 py-2 text-xs font-medium text-success">success-bg</div>
          <div className="rounded-lg border border-warning/40 bg-warning-bg px-3 py-2 text-xs font-medium text-warning">warning-bg</div>
          <div className="rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-xs font-medium text-danger">danger-bg</div>
          <div className="rounded-lg border border-info/40 bg-info-bg px-3 py-2 text-xs font-medium text-info">info-bg</div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">Text</h2>
        <div className="space-y-1 rounded-lg border border-border bg-surface-1 p-6">
          <p className="text-base text-foreground">foreground — the quick brown fox jumps over ₦4,820,000</p>
          <p className="text-base text-muted-foreground">muted-foreground — the quick brown fox jumps over ₦4,820,000</p>
          <p className="text-base text-subtle-foreground">subtle-foreground — the quick brown fox jumps over ₦4,820,000</p>
          <p className="font-mono text-sm text-muted-foreground">font-mono — nbo_sub_9x2k · GET /v1/subscriptions</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">Controls (raw tokens)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Primary action</button>
          <button className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-foreground ring-1 ring-inset ring-border-strong">Secondary</button>
          <button className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground ring-1 ring-inset ring-border">Ghost</button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" /> active
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
            <span className="size-1.5 rounded-full bg-warning" /> past_due
          </span>
        </div>
      </section>
    </main>
  );
}
