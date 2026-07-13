import { CheckCircle2, ExternalLink, Landmark, XCircle } from 'lucide-react';

import { Button } from '@nombaone/ui/components/ui/button';
import { Card, CardContent, CardHeader } from '@nombaone/ui/components/ui/card';
import { Separator } from '@nombaone/ui/components/ui/separator';

import { LinkExpired } from '@/components/LinkExpired';
import { MoneyAmount } from '@/components/MoneyAmount';
import { StatusPill, invoiceStatusPill } from '@/components/StatusPill';
import { verifyActionTokenForKind } from '@/lib/action-token';
import { getInvoiceView, type InvoiceView, type PayInstructionsView } from '@/lib/billing';
import { absoluteDate } from '@/lib/format';

import type { Metadata } from 'next';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PAY INVOICE — the end-customer action page (`/i/<token>`).
 *
 * The token in the URL is the WHOLE authority: a signed, expiring claim minted
 * by apps/api (`kind: 'pay-invoice'`, ref = invoice reference) with the shared
 * `INFRA_ACTION_TOKEN_SECRET`. Verification happens FIRST; only a valid token
 * reaches the database, and an invalid/expired/tampered one renders the generic
 * "link expired" state — no data leak, no hint whether the invoice exists.
 *
 * Once verified, the invoice is resolved by reference DIRECTLY from the DB
 * (scope derived from the row — the same reference-only resolver paradigm as
 * `lib/payment.ts`). Status is DERIVED from the row's timestamp signals, never
 * stored, so a returning payer always sees the true money state.
 *
 * Branded states:
 *   paid          → success screen
 *   open          → amount due + line summary + the collection affordances:
 *                     (a) engine-stamped `metadata.checkoutLink` → "Pay now"
 *                     (b) engine-stamped `metadata.payInstructions` → NUBAN block
 *   void / uncollectible / draft → terminal "no longer payable"
 *
 * READ-ONLY: collection itself happens on Nomba's hosted page (the link) or by
 * bank transfer (the NUBAN block); reconciliation is the engine's webhook job.
 * `force-dynamic` so each load reflects the current derived status.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const reference = verifyActionTokenForKind('pay-invoice', token);
  const view = reference ? await getInvoiceView(reference) : null;
  if (!view) return { title: 'Link expired · Nombaone' };
  return {
    title: `Pay ${view.merchant.name} · Nombaone`,
    description: `Complete your payment to ${view.merchant.name}.`,
  };
}

export default async function PayInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reference = verifyActionTokenForKind('pay-invoice', token);
  if (!reference) return <LinkExpired />;

  const view = await getInvoiceView(reference);
  // A verified token whose resource has since vanished degrades to the same
  // generic terminal state — still nothing to leak.
  if (!view) return <LinkExpired />;

  const pill = invoiceStatusPill(view.status);
  const isPaid = view.status === 'paid';
  const isCollectible = view.status === 'open' || view.status === 'partially_paid';

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 border-b bg-card">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invoice from
                </span>
                <span className="text-lg font-semibold leading-tight text-foreground">
                  {view.merchant.name}
                </span>
              </div>
              <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
            </div>
            <div className="flex items-baseline gap-2">
              <MoneyAmount
                kobo={isCollectible ? view.amountRemainingInKobo || view.amountDueInKobo : view.totalInKobo}
                className="text-3xl font-semibold tracking-tight text-foreground"
              />
              <span className="text-sm text-muted-foreground">{view.currency}</span>
            </div>
            {view.dueDate && !isPaid ? (
              <p className="text-xs text-muted-foreground">Due {absoluteDate(view.dueDate)}</p>
            ) : null}
          </CardHeader>

          <CardContent className="flex flex-col gap-5 p-6 pt-6">
            <LineSummary view={view} />

            {isPaid ? (
              <PaidBody view={view} />
            ) : isCollectible ? (
              <CollectBody view={view} />
            ) : (
              <TerminalBody label={pill.label} />
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Secured by Nombaone · {view.reference}
        </p>
      </div>
    </main>
  );
}

/** The line summary — what this invoice is for (signed kobo per line). */
function LineSummary({ view }: { view: InvoiceView }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {view.lines.map((line) => (
        <div key={line.id} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">
            {line.description}
            {line.quantity > 1 ? ` × ${line.quantity}` : ''}
          </dt>
          <dd>
            <MoneyAmount kobo={line.amountInKobo} />
          </dd>
        </div>
      ))}
      <Separator />
      <div className="flex items-center justify-between">
        <dt className="font-medium text-foreground">Amount due</dt>
        <dd>
          <MoneyAmount
            kobo={view.amountRemainingInKobo || view.amountDueInKobo}
            className="font-semibold text-foreground"
          />
        </dd>
      </div>
    </dl>
  );
}

/** Open / partially paid → the collection affordances the engine stamped. */
function CollectBody({ view }: { view: InvoiceView }) {
  const hasAny = Boolean(view.checkoutLink) || Boolean(view.payInstructions);
  return (
    <div className="flex flex-col gap-4">
      {view.checkoutLink ? (
        <div className="flex flex-col gap-2">
          <Button asChild className="h-11 w-full">
            <a href={view.checkoutLink} rel="noopener noreferrer">
              Pay now
              <ExternalLink className="ml-2 size-4" />
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll complete payment on Nomba&apos;s secure hosted checkout.
          </p>
        </div>
      ) : null}

      {view.payInstructions ? <PayInstructionsBlock instructions={view.payInstructions} /> : null}

      {!hasAny ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          This invoice is awaiting collection. Check back shortly, or look out for payment
          instructions from {view.merchant.name} by email.
        </p>
      ) : null}
    </div>
  );
}

/** The NUBAN block — pay by bank transfer, exact amount to the named account. */
function PayInstructionsBlock({ instructions }: { instructions: PayInstructionsView }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 px-4 py-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Landmark className="size-4 text-muted-foreground" />
        Pay by bank transfer
      </div>
      <dl className="flex flex-col gap-2 text-sm">
        <InstructionRow label="Bank" value={instructions.bankName ?? '—'} />
        <InstructionRow label="Account number" value={instructions.accountNumber ?? '—'} mono />
        <InstructionRow label="Account name" value={instructions.accountName ?? '—'} />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Exact amount</dt>
          <dd>
            <MoneyAmount kobo={instructions.amountInKobo} className="font-semibold text-foreground" />
          </dd>
        </div>
        {instructions.reference ? (
          <InstructionRow label="Reference" value={instructions.reference} mono />
        ) : null}
      </dl>
      <p className="text-xs text-muted-foreground">
        Transfer the exact amount — it&apos;s matched automatically to this invoice.
      </p>
    </div>
  );
}

function InstructionRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-foreground' : 'text-foreground'}>{value}</dd>
    </div>
  );
}

/** Paid → success screen. */
function PaidBody({ view }: { view: InvoiceView }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-success-200 bg-success-50 px-4 py-6 text-center">
      <CheckCircle2 className="size-8 text-success-600" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-success-700">Invoice paid</p>
        <p className="text-sm text-success-700/80">
          Your payment of <MoneyAmount kobo={view.totalInKobo} className="font-medium" /> to{' '}
          {view.merchant.name} is complete.
        </p>
        {view.paidAt ? (
          <p className="text-xs text-success-700/70">Paid {absoluteDate(view.paidAt)}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Terminal non-payable state (void / uncollectible / draft). */
function TerminalBody({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
      <span className="mt-0.5 shrink-0">
        <XCircle className="size-4" />
      </span>
      <p>
        <span className="font-medium text-foreground">{label}.</span> This invoice can no longer be
        paid here.
      </p>
    </div>
  );
}
