import Link from 'next/link';

import { formatNaira } from '@/lib/format';

import type { GymCatalogEntry } from '@/lib/nombaone';

/**
 * A membership, priced. The price and cadence come from the platform catalog — not from a
 * hard-coded string — so a price change in the engine shows up here, and the Playwright
 * test asserts against the catalog rather than a literal.
 */
export function PlanCard({ entry }: { entry: GymCatalogEntry }) {
  const { def, price } = entry;
  const popular = def.badge === 'Most popular';

  return (
    <div
      data-plan={def.key}
      className={`relative flex flex-col rounded-lg border p-6 ${
        popular ? 'border-ember/60 bg-panel-2' : 'border-line bg-panel'
      }`}
    >
      {def.badge ? (
        <span className="absolute -top-2.5 left-6 rounded bg-ember px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-coal">
          {def.badge}
        </span>
      ) : null}

      <h3 className="text-lg font-semibold">{def.displayName}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-fog">{def.tagline}</p>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight" data-price>
          {formatNaira(price.unitAmountInKobo)}
        </span>
        <span className="text-[13px] text-dim">
          {def.isFlex ? 'per 10 minutes' : 'per month'}
        </span>
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-2 text-[13px] text-fog">
        {def.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-ember">·</span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={`/join?price=${price.id}`}
        className={`mt-6 rounded px-4 py-2.5 text-center text-[13px] font-semibold transition-opacity hover:opacity-90 ${
          popular ? 'bg-ember text-coal' : 'border border-line bg-panel-2 text-chalk'
        }`}
      >
        {def.isFlex ? 'Start a Flex Pass' : `Choose ${def.displayName}`}
      </Link>

      <p className="mt-3 text-center text-[11px] text-dim">
        {def.isFlex
          ? 'Stop it yourself, any time. You only pay for the time you use.'
          : 'Renews every month. Cancel any time.'}
      </p>
    </div>
  );
}
