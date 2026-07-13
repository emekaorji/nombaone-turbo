import Link from 'next/link';

import { catalog, findCustomerByEmail, formatNaira, nombaone } from '@/lib/nombaone';

import type { Invoice, Subscription } from '@nombaone/node';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('en-NG', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Lagos',
});

function formatDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

/** Drain an SDK auto-paginating list into an array. */
async function collectAll<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

const SUB_BADGE: Record<Subscription['status'], string> = {
  active: 'border-mint/40 text-mint',
  trialing: 'border-mint/40 text-mint',
  incomplete: 'border-amberish/40 text-amberish',
  past_due: 'border-blood/40 text-blood',
  incomplete_expired: 'border-line text-dim',
  paused: 'border-line text-fog',
  canceled: 'border-line text-dim',
};

const INVOICE_BADGE: Record<Invoice['status'], string> = {
  paid: 'border-mint/40 text-mint',
  open: 'border-amberish/40 text-amberish',
  partially_paid: 'border-amberish/40 text-amberish',
  draft: 'border-line text-fog',
  void: 'border-line text-dim',
  uncollectible: 'border-blood/40 text-blood',
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${className}`}
    >
      {label}
    </span>
  );
}

/** Human label for the price a subscription is on. */
async function priceLabels(subscriptions: Subscription[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const gym = await catalog().catch(() => null);
  const client = nombaone();

  for (const sub of subscriptions) {
    if (labels.has(sub.priceId)) continue;
    const known = gym?.find((entry) => entry.price.id === sub.priceId);
    if (known) {
      labels.set(sub.priceId, `${known.def.displayName} · ${known.def.cadenceLabel}`);
      continue;
    }
    try {
      const price = await client.prices.retrieve(sub.priceId);
      const plan = await client.plans.retrieve(price.planId);
      labels.set(
        sub.priceId,
        `${plan.name} · ${formatNaira(price.unitAmountInKobo)} / ${price.intervalCount > 1 ? `${price.intervalCount} ` : ''}${price.interval}${price.intervalCount > 1 ? 's' : ''}`,
      );
    } catch {
      labels.set(sub.priceId, sub.priceId);
    }
  }
  return labels;
}

export default async function MemberPage({ params }: { params: Promise<{ email: string }> }) {
  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).toLowerCase();

  let customer;
  try {
    customer = await findCustomerByEmail(email);
  } catch (caught) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Engine not reachable yet</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fog">
          The member view reads live from the NombaOne engine. Fill in{' '}
          <span className="font-mono text-chalk">examples/gym/.env</span> and make sure the engine
          is running.
        </p>
        <p className="mt-3 font-mono text-xs break-all text-dim">
          {caught instanceof Error ? caught.message : String(caught)}
        </p>
      </main>
    );
  }
  if (!customer) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">No membership found</h1>
        <p className="mt-3 max-w-md text-sm text-fog">
          Nothing on file for <span className="font-mono text-chalk">{email}</span>. Join from the{' '}
          <Link href="/" className="text-ember underline underline-offset-2">
            memberships page
          </Link>{' '}
          — it takes one payment.
        </p>
      </main>
    );
  }

  const client = nombaone();

  // Independent reads — fetch in parallel, no waterfall.
  const [subscriptions, invoices] = await Promise.all([
    collectAll(client.subscriptions.list({ customerId: customer.id, limit: 100 })),
    collectAll(client.invoices.list({ customerId: customer.id, limit: 100 })),
  ]);

  const labels = await priceLabels(subscriptions);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-20">
      <section className="py-12">
        <p className="text-xs font-semibold tracking-[0.35em] text-ember uppercase">Member</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{customer.name}</h1>
        <p className="mt-1 font-mono text-xs text-dim">
          {customer.email} · {customer.id}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-fog uppercase">Memberships</h2>
        {subscriptions.length === 0 ? (
          <p className="mt-3 text-sm text-dim">No subscriptions yet.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {subscriptions.map((sub) => (
              <article key={sub.id} className="rounded-lg border border-line bg-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{labels.get(sub.priceId) ?? sub.priceId}</h3>
                    <p className="mt-1 font-mono text-[11px] text-dim">{sub.id}</p>
                  </div>
                  <Badge label={sub.status.replace('_', ' ')} className={SUB_BADGE[sub.status]} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-4">
                  <div>
                    <dt className="text-dim">Next billing</dt>
                    <dd className="mt-0.5 text-fog">
                      {sub.status === 'canceled' ? '—' : formatDate(sub.currentPeriodEnd)}
                      {sub.cancelAtPeriodEnd && sub.status !== 'canceled' ? (
                        <span className="ml-1 text-amberish">(ends then)</span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-dim">Collection</dt>
                    <dd className="mt-0.5 text-fog">
                      {sub.collectionMethod === 'charge_automatically'
                        ? 'card, charged automatically'
                        : 'bank transfer, invoice sent'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-dim">Period</dt>
                    <dd className="mt-0.5 text-fog">#{sub.currentPeriodIndex}</dd>
                  </div>
                  <div>
                    <dt className="text-dim">Member since</dt>
                    <dd className="mt-0.5 text-fog">{formatDate(sub.createdAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold tracking-wide text-fog uppercase">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-dim">No invoices yet.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {invoices.map((invoice) => (
              <article key={invoice.id} className="rounded-lg border border-line bg-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{formatNaira(invoice.totalInKobo)}</h3>
                    <p className="mt-1 font-mono text-[11px] text-dim">
                      {invoice.id} · {invoice.billingReason.replace(/_/g, ' ')} ·{' '}
                      {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                  <Badge
                    label={invoice.status.replace('_', ' ')}
                    className={INVOICE_BADGE[invoice.status]}
                  />
                </div>

                {invoice.payInstructions ? (
                  <div className="mt-4 rounded-md border border-amberish/30 bg-panel-2 p-4">
                    <p className="text-xs font-semibold tracking-wide text-amberish uppercase">
                      Pay by bank transfer — exact amount, it matches automatically
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs md:grid-cols-4">
                      <div>
                        <dt className="font-sans text-dim">Bank</dt>
                        <dd className="mt-0.5 text-chalk">{invoice.payInstructions.bankName ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-sans text-dim">Account number</dt>
                        <dd className="mt-0.5 text-chalk">
                          {invoice.payInstructions.accountNumber ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-sans text-dim">Account name</dt>
                        <dd className="mt-0.5 text-chalk">
                          {invoice.payInstructions.accountName ?? '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-sans text-dim">Amount (exact)</dt>
                        <dd className="mt-0.5 text-chalk">
                          {formatNaira(invoice.payInstructions.amountInKobo)}
                        </dd>
                      </div>
                    </dl>
                    {invoice.payInstructions.reference ? (
                      <p className="mt-2 font-mono text-[11px] text-dim">
                        ref: {invoice.payInstructions.reference}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
