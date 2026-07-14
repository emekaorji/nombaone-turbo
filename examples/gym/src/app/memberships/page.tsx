import Link from 'next/link';

import { PlanCard } from '@/components/plan-card';
import { catalog } from '@/lib/nombaone';
import { formatNaira } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MembershipsPage() {
  const cat = await catalog();
  const memberships = cat.filter((c) => !c.def.isFlex);
  const flex = cat.find((c) => c.def.isFlex);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Pick how you want to train.</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-fog">
        Every membership is month-to-month. You pay the same amount on the same date each month,
        and you can stop it yourself any time — no phone calls, no notice period.
      </p>

      {/* The Flex Pass LEADS. It is the thing most people walking in actually want, and it is the
          one product where a member watches the billing happen rather than taking it on trust. */}
      {flex ? (
        <div
          data-plan="flex"
          className="mt-10 rounded-lg border border-ember/40 bg-panel-2 p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold">
                Just passing through? Flex Pass —{' '}
                <span className="text-ember" data-price>
                  {formatNaira(flex.price.unitAmountInKobo)}
                </span>{' '}
                per 10 minutes on the floor.
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-fog">
                No membership, no commitment. You pay {formatNaira(flex.price.unitAmountInKobo)} to
                get on the floor, and {formatNaira(flex.price.unitAmountInKobo)}{' '}
                again every 10 minutes you stay. When you&apos;re done, hit{' '}
                <strong>Stop billing</strong> on your account page and it stops immediately —
                you&apos;ll see every payment appear as it happens.
              </p>
            </div>

            <Link
              href={`/join?price=${flex.price.id}`}
              className="rounded bg-ember px-5 py-3 text-[13px] font-semibold text-coal transition-opacity hover:opacity-90"
            >
              Start a Flex Pass
            </Link>
          </div>
        </div>
      ) : null}

      <p className="mt-12 text-[13px] text-dim">Or train on a monthly membership.</p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {memberships.map((entry) => (
          <PlanCard key={entry.def.key} entry={entry} />
        ))}
      </div>

      {/* How paying works — the section that answers the question everyone actually has. */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight">How paying works</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {[
            {
              t: 'You pay the same day each month.',
              d: 'Join on the 8th, and we take payment on the 8th of every month after that.',
            },
            {
              t: 'You always know before we take it.',
              d: 'Your next payment — the exact amount, on the exact date — sits at the top of your account page from the day you join.',
            },
            {
              t: "You're in control.",
              d: 'Cancel from your account page in two taps. You keep access until the end of the time you have already paid for.',
            },
            {
              t: 'If a payment fails, nothing dramatic happens.',
              d: "We tell you, you keep training for a few more days, and we try again. You can also fix it yourself in one tap.",
            },
          ].map((x) => (
            <div key={x.t} className="rounded border border-line bg-panel p-5">
              <h3 className="text-[14px] font-semibold">{x.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fog">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">Common questions</h2>
        <dl className="mt-5 divide-y divide-line border-y border-line">
          {[
            ['Is there a sign-up fee?', 'No. The price you see is the only price.'],
            [
              'Can I freeze my membership?',
              "Yes — pause it whenever you like. You're not charged while it's paused.",
            ],
            [
              'Can I change plan?',
              'Any time, from your account page. The change is worked out fairly for the part of the month you have already paid for.',
            ],
            [
              'What if my card fails?',
              "We tell you on your account page, you keep training for a few more days, and we try again. You can also pay in one tap, or swap in a different card.",
            ],
          ].map(([q, a]) => (
            <div key={q} className="py-4">
              <dt className="text-[14px] font-medium">{q}</dt>
              <dd className="mt-1 text-[13px] text-fog">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
