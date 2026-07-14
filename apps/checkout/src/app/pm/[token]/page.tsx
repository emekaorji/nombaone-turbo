import { CreditCard, ExternalLink, MailCheck } from 'lucide-react';

import { Button } from '@nombaone/ui/components/ui/button';
import { Card, CardContent, CardHeader } from '@nombaone/ui/components/ui/card';
import { Separator } from '@nombaone/ui/components/ui/separator';

import { LinkExpired } from '@/components/LinkExpired';
import { StatusPill, type StatusVariant } from '@/components/StatusPill';
import { verifyActionTokenForKind } from '@/lib/action-token';
import { getSubscriptionPmView, type SubscriptionPmView } from '@/lib/billing';

import type { Metadata } from 'next';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UPDATE PAYMENT METHOD — the end-customer action page (`/pm/<token>`).
 *
 * The token in the URL is the WHOLE authority: a signed, expiring claim minted
 * by apps/api (`kind: 'update-pm'`, ref = SUBSCRIPTION reference) with the
 * shared `INFRA_ACTION_TOKEN_SECRET`. Verification happens FIRST; an invalid /
 * expired / tampered token renders the generic "link expired" state — no data
 * leak. Once verified, the subscription (+ customer + current default card) is
 * resolved by reference directly from the DB, same reference-only paradigm as
 * `lib/payment.ts`.
 *
 * DELIBERATELY READ-ONLY (v1). This page cannot mint a fresh card-capture
 * checkout itself: the checkout app holds no Nomba credentials and no API key,
 * and calling the money engine's services directly from here is forbidden (all
 * money writes live in apps/api). So the page does the two honest things it
 * can:
 *
 *   1. Show the card currently billing the subscription (brand / last4 / expiry
 *      — display fields only; there is structurally no PAN to show).
 *   2. When the subscription's latest OPEN invoice carries the engine-stamped
 *      `metadata.checkoutLink` (the dunning / action-required link — paying
 *      there captures a fresh card and the engine swaps it in server-side),
 *      surface it as the "Complete payment & update card" button.
 *
 * Otherwise it explains that a fresh secure card link arrives by email (the
 * dunning mailer sends one with every retry notice). NO fake buttons.
 *
 * FOLLOW-UP (the WRITE path): minting a fresh `setupCard` hosted checkout from
 * this page needs a small internal apps/api endpoint (token-authenticated with
 * this same action token, e.g. `POST /internal/pm-update-sessions`) that calls
 * the engine's payment-method setup and returns the new checkoutLink. Tracked
 * as a listed follow-up; until then this page stays zero-write.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const dynamic = 'force-dynamic';

const SUB_STATUS_PILL: Record<string, { variant: StatusVariant; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  trialing: { variant: 'info', label: 'Trial' },
  past_due: { variant: 'error', label: 'Past due' },
  paused: { variant: 'neutral', label: 'Paused' },
  incomplete: { variant: 'pending', label: 'Incomplete' },
  incomplete_expired: { variant: 'neutral', label: 'Expired' },
  canceled: { variant: 'neutral', label: 'Canceled' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const reference = verifyActionTokenForKind('update-pm', token);
  const view = reference ? await getSubscriptionPmView(reference) : null;
  if (!view) return { title: 'Link expired · Nombaone' };
  return {
    title: `Payment method · ${view.merchant.name} · Nombaone`,
    description: `Manage the card paying your ${view.merchant.name} subscription.`,
  };
}

export default async function UpdatePaymentMethodPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reference = verifyActionTokenForKind('update-pm', token);
  if (!reference) return <LinkExpired />;

  const view = await getSubscriptionPmView(reference);
  if (!view) return <LinkExpired />;

  const pill = SUB_STATUS_PILL[view.status] ?? { variant: 'neutral' as const, label: view.status };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 border-b bg-card">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subscription with
                </span>
                <span className="text-lg font-semibold leading-tight text-foreground">
                  {view.merchant.name}
                </span>
              </div>
              <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
            </div>
            <p className="text-sm text-muted-foreground">Payment method for {view.customerName}</p>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 p-6 pt-6">
            <CurrentMethod view={view} />
            <Separator />
            <NextStep view={view} />
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Secured by Nombaone · {view.reference}
        </p>
      </div>
    </main>
  );
}

/** The card currently billing this subscription — display fields only. */
function CurrentMethod({ view }: { view: SubscriptionPmView }) {
  const method = view.currentMethod;
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background">
        <CreditCard className="size-5 text-muted-foreground" />
      </span>
      {method ? (
        <div className="flex flex-col">
          <span className="text-sm font-medium capitalize text-foreground">
            {method.brand ?? method.kind}
            {method.last4 ? ` •••• ${method.last4}` : ''}
          </span>
          <span className="text-xs text-muted-foreground">
            {method.expMonth && method.expYear
              ? `Expires ${String(method.expMonth).padStart(2, '0')}/${method.expYear}`
              : 'On file'}
            {method.status !== 'active' ? ` · ${method.status.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
      ) : (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">No card on file</span>
          <span className="text-xs text-muted-foreground">
            This subscription has no saved payment method yet.
          </span>
        </div>
      )}
    </div>
  );
}

/** The one honest action available today, or the honest explanation. */
function NextStep({ view }: { view: SubscriptionPmView }) {
  if (view.openInvoiceCheckoutLink) {
    return (
      <div className="flex flex-col gap-2">
        <Button asChild className="h-11 w-full">
          <a href={view.openInvoiceCheckoutLink} rel="noopener noreferrer">
            Complete payment &amp; update card
            <ExternalLink className="ml-2 size-4" />
          </a>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Paying on Nomba&apos;s secure checkout saves your new card for future renewals.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
      <MailCheck className="mt-0.5 size-4 shrink-0 text-neutral-500" />
      <p className="text-sm text-neutral-700">
        To change your card, use the secure checkout link {view.merchant.name} sends by email —
        every payment reminder includes a fresh one. Paying there saves the new card for future
        renewals automatically.
      </p>
    </div>
  );
}
