import { notFound } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@nombaone/ui/components/ui/card';
import { Separator } from '@nombaone/ui/components/ui/separator';

import { MoneyAmount } from '@/components/MoneyAmount';
import { PayForm } from '@/components/PayForm';
import { StatusPill, exampleStatusPill } from '@/components/StatusPill';
import { absoluteDate } from '@/lib/format';
import { getCheckoutResource, isPayable } from '@/lib/payment';

import type { ExampleResponseData } from '@nombaone/core-contracts/types';
import type { Metadata } from 'next';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PUBLIC, REFERENCE-KEYED RSC PAGE — the subscriber surface (`/[reference]`).
 *
 * A Server Component, read-only, and UNAUTHENTICATED. It resolves the EXAMPLE
 * resource by its PUBLIC reference (the `nbo…exa` id in the URL) through
 * `getCheckoutResource`, which derives org + environment FROM the resource row
 * and hands that pinned ctx to sara's `getExampleByReference` — there is NO API
 * layer between this page and the domain. The org context is never taken from a
 * caller; the reference is the only authority. (See `lib/payment.ts`.)
 *
 * Branded states:
 *   pending   → amount + merchant + a 'pay' panel (the `payAction` server action)
 *   settled   → success screen
 *   failed    → terminal state
 *   not found → 404 (`notFound()` → app/not-found.tsx)
 *
 * STATUS IS LEDGER-DERIVED, NEVER ASSUMED. `getExampleByReference` computes status
 * from the ledger — the single source of truth for money state. A returning payer
 * who reloads this page sees `pending` until the money has ACTUALLY moved and been
 * confirmed (webhook → re-verify → settlement post). The page never shows "paid"
 * just because the payer came back. (See `lib/actions.ts` for the confirm seam.)
 *
 * `force-dynamic` so each load reflects the current derived status (no cache of a
 * money state that can change out of band).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>;
}): Promise<Metadata> {
  const { reference } = await params;
  const result = await getCheckoutResource(reference);
  if (!result) return { title: 'Payment not found · Nombaone' };
  return {
    title: `Pay ${result.merchant.name} · Nombaone`,
    description: `Complete your payment to ${result.merchant.name}.`,
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const result = await getCheckoutResource(reference);
  if (!result) notFound();

  const { example, merchant } = result;
  const pill = exampleStatusPill(example.status);
  const payable = isPayable(example.status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 border-b bg-card">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pay
                </span>
                <span className="text-lg font-semibold leading-tight text-foreground">
                  {merchant.name}
                </span>
              </div>
              <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
            </div>
            <div className="flex items-baseline gap-2">
              <MoneyAmount
                kobo={example.amountInKobo}
                className="text-3xl font-semibold tracking-tight text-foreground"
              />
              <span className="text-sm text-muted-foreground">{example.currency}</span>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 p-6 pt-6">
            <AmountBreakdown example={example} />

            {payable ? (
              <PayForm reference={reference} />
            ) : example.status === 'settled' ? (
              <SettledBody example={example} merchantName={merchant.name} />
            ) : (
              <TerminalBody status={example.status} label={pill.label} />
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Secured by Nombaone · {example.id}
        </p>
      </div>
    </main>
  );
}

/** The amount summary — every state shows it (money in kobo). */
function AmountBreakdown({ example }: { example: ExampleResponseData }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <Row label="Amount">
        <MoneyAmount kobo={example.amountInKobo} />
      </Row>
      <Separator />
      <Row label="Total" emphasis>
        <MoneyAmount kobo={example.amountInKobo} className="font-semibold text-foreground" />
      </Row>
    </dl>
  );
}

function Row({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={emphasis ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Settled / paid success screen. */
function SettledBody({
  example,
  merchantName,
}: {
  example: ExampleResponseData;
  merchantName: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-success-200 bg-success-50 px-4 py-6 text-center">
      <CheckCircle2 className="size-8 text-success-600" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-success-700">Payment successful</p>
        <p className="text-sm text-success-700/80">
          Your payment of <MoneyAmount kobo={example.amountInKobo} className="font-medium" /> to{' '}
          {merchantName} is complete.
        </p>
        <p className="text-xs text-success-700/70">Created {absoluteDate(example.createdAt)}</p>
      </div>
    </div>
  );
}

/** Terminal non-success state (failed / unknown). */
function TerminalBody({ status, label }: { status: string; label: string }) {
  const message =
    status === 'failed'
      ? 'This payment could not be completed.'
      : 'This payment can no longer be paid.';
  return (
    <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
      <span className="mt-0.5 shrink-0">
        <XCircle className="size-4" />
      </span>
      <p>
        <span className="font-medium text-foreground">{label}.</span> {message}
      </p>
    </div>
  );
}
