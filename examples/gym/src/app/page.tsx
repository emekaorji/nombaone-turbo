import Link from 'next/link';

import { PlanCard } from '@/components/plan-card';
import { catalog } from '@/lib/nombaone';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cat = await catalog();
  const memberships = cat.filter((c) => !c.def.isFlex);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight">
            Lagos trains soft.
            <br />
            <span className="text-ember">You won&apos;t.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-fog">
            Iron Republic is a strength gym in Lekki Phase 1. Barbells, platforms, and coaches who
            actually know what they&apos;re doing. Open 5am to 11pm, seven days.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/memberships"
              className="rounded bg-ember px-5 py-3 text-[13px] font-semibold text-coal transition-opacity hover:opacity-90"
            >
              See memberships
            </Link>
            <span className="text-[13px] text-dim">
              From ₦20,000 a month. Cancel any time, from your phone.
            </span>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-3 text-[12px] text-dim">
            <span>12 competition platforms</span>
            <span>40+ classes a week</span>
            <span>Open 5am – 11pm, 7 days</span>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            {
              t: 'Real iron.',
              d: 'Eleiko bars, calibrated plates, 12 lifting platforms. No queue for a squat rack, ever.',
            },
            {
              t: 'Coaching included.',
              d: 'Technique clinics every Tuesday and Saturday, free with Full Access and above.',
            },
            {
              t: 'No lock-in.',
              d: 'No sign-up fee, no admin charge, no year-long contract you have to beg to leave.',
            },
          ].map((x) => (
            <div key={x.t}>
              <h3 className="text-[15px] font-semibold">{x.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Pick how you want to train.</h2>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-fog">
            Every membership is month-to-month. You pay the same amount on the same date each
            month, and you can stop it yourself any time — no phone calls, no notice period.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {memberships.map((entry) => (
              <PlanCard key={entry.def.key} entry={entry} />
            ))}
          </div>

          <p className="mt-6 text-center text-[12px] text-dim">
            Cancel any time · No sign-up fee · Your next payment is always shown on your account
            page, before we take it
          </p>

          <div className="mt-10 text-center">
            <Link href="/memberships" className="text-[13px] text-ember hover:underline">
              Just passing through? See the Flex Pass →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
