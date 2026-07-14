import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DemoBar } from '@/components/demo-bar';
import { attentionBand, howYouPayLine, nextPaymentLine, nextPaymentReassurance, statusPill } from '@/lib/copy';
import { currentMember } from '@/lib/auth';
import { loadMembership } from '@/lib/membership';
import { pauseAction, resumeAction, stopFlexAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  good: 'border-mint/40 bg-mint/10 text-mint',
  warn: 'border-amberish/40 bg-amberish/10 text-amberish',
  bad: 'border-blood/40 bg-blood/10 text-blood',
  info: 'border-ember/40 bg-ember/10 text-ember',
  muted: 'border-line bg-panel-2 text-fog',
};

/**
 * ── THE SCREEN ───────────────────────────────────────────────────────────────
 *
 * If a member reads nothing else, they read this. Above the fold it answers, in order:
 *
 *   Am I OK?   What am I on?   What do I pay?   WHEN NEXT?   With what card?   How do I stop?
 *
 * The "when next" line is the biggest type on the page after the plan name, because it is
 * the single thing a subscription is FOR — and the single thing a member is most likely to
 * feel ambushed by if we hide it.
 *
 * Everything here comes from ONE object (`loadMembership`). This page does not know what
 * `past_due` means, and it must never learn.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ stopped?: string }>;
}) {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const { stopped } = await searchParams;
  const v = await loadMembership(member);
  const pill = statusPill(v);
  const band = attentionBand(v);

  const isSandbox = (process.env.NOMBAONE_API_KEY ?? '').startsWith('nbo_sandbox_');

  /* No membership yet ------------------------------------------------------ */
  if (v.state === 'none') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Hi {member.name.split(' ')[0]}.</h1>
        <div className="mt-8 rounded-lg border border-line bg-panel p-8 text-center">
          <p className="text-[14px] text-fog">You don&apos;t have a membership yet.</p>
          <Link
            href="/memberships"
            className="mt-5 inline-block rounded bg-ember px-5 py-2.5 text-[13px] font-semibold text-coal"
          >
            See memberships
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Who */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Hi {member.name.split(' ')[0]}.</h1>
        <p className="mt-1 text-[12.5px] text-dim">Member no. {member.memberNo}</p>
      </div>

      {isSandbox ? <DemoBar canFastForward={Boolean(v.subscriptionId)} /> : null}

      {stopped ? (
        <p className="mb-6 rounded border border-line bg-panel-2 px-4 py-3 text-[13px] text-fog">
          Done. Nothing else will be charged.
        </p>
      ) : null}

      {/* 1 · Something needs a decision */}
      {band ? (
        <div className={`mb-8 rounded-lg border p-5 ${TONE[band.tone]}`} data-testid="attention-band">
          <p className="text-[14px] font-semibold">{band.title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed opacity-90">{band.body}</p>
          {band.action || band.secondary ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {band.action ? (
                <a
                  href={band.action.href}
                  data-testid="band-action"
                  className="rounded bg-chalk px-4 py-2 text-[12.5px] font-semibold text-coal"
                >
                  {band.action.label}
                </a>
              ) : null}
              {band.secondary ? (
                <Link
                  href={band.secondary.href}
                  className="rounded border border-current px-4 py-2 text-[12.5px] font-medium"
                >
                  {band.secondary.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2 · The membership card — THE hero */}
      <section className="rounded-lg border border-line bg-panel p-7" data-testid="membership-card">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
          Your membership
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight" data-testid="plan-name">
            {v.planName}
          </h2>
          <span
            data-testid="status-pill"
            className={`rounded-full border px-3 py-1 text-[11.5px] font-medium ${TONE[pill.tone]}`}
          >
            ● {pill.label}
          </span>
        </div>

        <p className="mt-1 text-[14px] text-fog">
          <span className="text-chalk">{v.amount}</span> {v.cadence}
        </p>

        {/* The line. */}
        <div className="mt-6 rounded-lg border border-line bg-panel-2 p-5">
          <p className="text-[17px] font-semibold leading-snug" data-testid="next-payment-line">
            💳 {nextPaymentLine(v)}
          </p>
          {nextPaymentReassurance(v) ? (
            <p className="mt-2 text-[13px] leading-relaxed text-fog">{nextPaymentReassurance(v)}</p>
          ) : null}
        </div>

        {/* Primary actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          {v.isFlex && (v.state === 'active' || v.state === 'payment_problem') ? (
            <form action={stopFlexAction}>
              <button
                type="submit"
                data-testid="stop-flex"
                className="rounded bg-ember px-4 py-2 text-[12.5px] font-semibold text-coal"
              >
                I&apos;m done — stop billing
              </button>
            </form>
          ) : null}

          {!v.isFlex && v.state === 'active' ? (
            <>
              <Link
                href="/account/membership"
                className="rounded border border-line bg-panel-2 px-4 py-2 text-[12.5px] font-medium"
              >
                Change plan
              </Link>
              <form action={pauseAction}>
                <button
                  type="submit"
                  className="rounded border border-line bg-panel-2 px-4 py-2 text-[12.5px] font-medium"
                >
                  Pause membership
                </button>
              </form>
            </>
          ) : null}

          {v.state === 'paused' ? (
            <form action={resumeAction}>
              <button
                type="submit"
                className="rounded bg-ember px-4 py-2 text-[12.5px] font-semibold text-coal"
              >
                Unpause now
              </button>
            </form>
          ) : null}

          {v.state === 'ended' ? (
            <Link
              href="/memberships"
              className="rounded bg-ember px-4 py-2 text-[12.5px] font-semibold text-coal"
            >
              Rejoin
            </Link>
          ) : null}
        </div>
      </section>

      {/* 3 · What you get */}
      {v.features.length ? (
        <section className="mt-6 rounded-lg border border-line bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
            What your {v.amount} gets you
          </p>
          <ul className="mt-3 grid gap-2 text-[13px] text-fog sm:grid-cols-2">
            {v.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-ember">·</span>
                {f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 4 · How you pay */}
      <section className="mt-6 rounded-lg border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">How you pay</p>
        {v.card ? (
          <>
            <p className="mt-3 text-[14px]">
              💳 {v.card.brand} ending {v.card.last4}
              {v.card.expiry ? <span className="text-dim"> · Expires {v.card.expiry}</span> : null}
            </p>
            <p className="mt-1.5 text-[13px] text-fog">{howYouPayLine(v)}</p>
          </>
        ) : (
          <p className="mt-3 text-[13px] text-fog">{howYouPayLine(v)}</p>
        )}
        <Link
          href="/account/payment-method"
          className="mt-4 inline-block rounded border border-line bg-panel-2 px-4 py-2 text-[12.5px] font-medium"
        >
          {v.card ? 'Use a different card' : 'Add a card'}
        </Link>
      </section>

      {/* 5 · Your payments */}
      <section className="mt-6 rounded-lg border border-line bg-panel p-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
            Your payments
          </p>
          <Link href="/account/payments" className="text-[12px] text-ember hover:underline">
            See all
          </Link>
        </div>

        {v.payments.length === 0 ? (
          <p className="mt-3 text-[13px] text-fog">Nothing yet.</p>
        ) : (
          <table className="mt-3 w-full text-[13px]" data-testid="payments-table">
            <tbody className="divide-y divide-line">
              {v.payments.slice(0, 5).map((p, i) => (
                <tr key={i} data-testid="payment-row">
                  <td className="py-2.5 text-fog">{p.when}</td>
                  <td className="py-2.5">{p.what}</td>
                  <td className="py-2.5 text-right font-medium">{p.amount}</td>
                  <td className="py-2.5 pl-4 text-right">
                    <span className={p.failed ? 'text-blood' : 'text-fog'}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 6 · Manage — plain, findable, never hidden */}
      <section className="mt-6 rounded-lg border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
          Manage your membership
        </p>
        <div className="mt-3 divide-y divide-line">
          <Link
            href="/account/membership"
            className="flex items-center justify-between py-3 text-[13px] hover:text-ember"
          >
            <span>Change plan</span>
            <span className="text-dim">Move up or down any time →</span>
          </Link>
          <Link
            href="/account/updates"
            className="flex items-center justify-between py-3 text-[13px] hover:text-ember"
          >
            <span>Updates from us</span>
            <span className="text-dim">Receipts and anything that needs you →</span>
          </Link>
          {v.state !== 'ended' && v.state !== 'ending' ? (
            <Link
              href="/account/membership/cancel"
              className="flex items-center justify-between py-3 text-[13px] hover:text-blood"
              data-testid="cancel-link"
            >
              <span>Cancel membership</span>
              <span className="text-dim">Stop future payments →</span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
