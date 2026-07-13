import { joinGym, lookupMember } from '@/lib/actions';
import { catalog, formatNaira } from '@/lib/nombaone';

import type { GymCatalog } from '@/lib/nombaone';

// Renders live catalog data from the engine on every request.
export const dynamic = 'force-dynamic';

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let memberships: GymCatalog | null = null;
  let setupError: string | null = null;
  try {
    memberships = await catalog();
  } catch (caught) {
    setupError = caught instanceof Error ? caught.message : String(caught);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 pb-20">
      <section className="py-16">
        <p className="text-xs font-semibold tracking-[0.35em] text-ember uppercase">
          Lagos · Est. 2026
        </p>
        <h1 className="mt-4 max-w-2xl text-5xl font-bold tracking-tight">
          Strength has a home. Billing has an engine.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-fog">
          Pick a membership, pay once on the hosted checkout, and the engine handles every renewal
          after that — silently on card, or by bank transfer with exact-amount instructions. The Day
          Pass renews every 10 minutes so you can watch it happen.
        </p>
      </section>

      {error ? (
        <div className="mb-8 rounded-md border border-blood/40 bg-blood/10 px-4 py-3 text-sm text-blood">
          {error}
        </div>
      ) : null}

      {setupError ? (
        <section className="rounded-lg border border-amberish/40 bg-panel p-6">
          <h2 className="text-sm font-semibold text-amberish">Engine not reachable yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">
            The catalog could not be loaded from the NombaOne engine. Fill in{' '}
            <span className="font-mono text-chalk">examples/gym/.env</span> (see{' '}
            <span className="font-mono text-chalk">.env.example</span>) and make sure the engine at{' '}
            <span className="font-mono text-chalk">
              {process.env.NOMBAONE_BASE_URL || 'the key-derived host'}
            </span>{' '}
            is running.
          </p>
          <p className="mt-3 font-mono text-xs break-all text-dim">{setupError}</p>
        </section>
      ) : null}

      {memberships ? (
        <section className="grid gap-6 md:grid-cols-3">
          {memberships.map(({ def, price }) => (
            <article
              key={def.key}
              className="flex flex-col rounded-lg border border-line bg-panel p-6 transition-colors hover:border-ember/50"
            >
              <h2 className="text-lg font-semibold">{def.displayName}</h2>
              <p className="mt-1 text-xs text-dim">{def.blurb}</p>
              <p className="mt-6 text-3xl font-bold tracking-tight">
                {formatNaira(price.unitAmountInKobo)}
                <span className="ml-2 text-xs font-normal text-fog">{def.cadenceLabel}</span>
              </p>
              {def.key === 'day-pass' ? (
                <p className="mt-2 inline-flex w-fit rounded-full border border-ember/40 px-2 py-0.5 text-[10px] tracking-wide text-ember uppercase">
                  demo cadence · minute × 10
                </p>
              ) : null}

              <form action={joinGym} className="mt-6 flex flex-col gap-3">
                <input type="hidden" name="priceId" value={price.id} />
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Full name"
                  autoComplete="name"
                  className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm placeholder:text-dim focus:border-ember focus:outline-none"
                />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="Email"
                  autoComplete="email"
                  className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm placeholder:text-dim focus:border-ember focus:outline-none"
                />
                <button
                  type="submit"
                  className="mt-1 rounded-md bg-ember px-3 py-2 text-sm font-semibold text-coal transition-opacity hover:opacity-90"
                >
                  Join — pay on hosted checkout
                </button>
              </form>
            </article>
          ))}
        </section>
      ) : null}

      <section className="mt-16 rounded-lg border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">Already a member?</h2>
        <p className="mt-1 text-xs text-fog">
          Look up your memberships and invoices with the email you joined with.
        </p>
        <form action={lookupMember} className="mt-4 flex max-w-md gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="flex-1 rounded-md border border-line bg-panel-2 px-3 py-2 text-sm placeholder:text-dim focus:border-ember focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold transition-colors hover:border-ember/60"
          >
            View
          </button>
        </form>
      </section>
    </main>
  );
}
