'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { confirmExampleFromWebhook } from '@nombaone/sara/example';

import { fail, ok, withAction, type ActionResult } from './action-result';
import { getCheckoutScope } from './payment';
import { txDb } from './db-tx';

import type { DomainContext } from '@nombaone/sara/context';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * payAction — the public checkout's lone mutation, a `'use server'` action.
 *
 * HOW A REAL HOSTED CHECKOUT SETTLES (the seams this stub stands in for):
 *
 *   • NOMBA HOSTED-CHECKOUT REDIRECT / IFRAME. In production the subscriber does
 *     NOT enter card/bank details on this page. Pressing "Pay" hands off to the
 *     provider's PCI-scoped hosted page — either a full-page redirect or an
 *     embedded iframe — where the instrument is captured. The provider charges
 *     the PULL rail (card token / mandate) or issues PUSH pay-instructions
 *     (a virtual account to transfer into), then redirects back here.
 *
 *   • CONFIRMED BY WEBHOOK, THEN RE-VERIFIED, NEVER ASSUMED. The redirect back is
 *     a HINT, not proof — it can be forged, replayed, or arrive before the money
 *     does. The authoritative signal is the provider's server-to-server WEBHOOK,
 *     and even that is untrusted: the domain RE-VERIFIES against the provider's
 *     API before recording a single ledger entry. That whole path lives in
 *     `confirmExampleFromWebhook` (sara/example), which resolves OUR resource by
 *     OUR reference within the pinned scope, re-verifies (a documented no-op seam
 *     for the mock rail), then posts the balanced settlement transaction and emits
 *     `example.settled`. A returning payer therefore always sees the LEDGER-DERIVED
 *     status — `pending` until the money has truly moved — never "assumed paid".
 *
 * WHAT THIS STUB DOES. There is no real provider in the boilerplate, so this
 * action simulates the provider having settled and drives the SAME re-verified
 * confirm path the real webhook would. It is the documented stub the task calls
 * for: it proves the money-path end to end without inventing a synchronous "pay"
 * primitive the domain does not have. The scope (org + environment) is re-resolved
 * SERVER-SIDE from the trusted resource row by its reference — never from client
 * input — so a forged scope cannot cross tenants. The interactive-tx handle
 * (`txDb()`) is required because the confirm path opens a `BEGIN … COMMIT` to post
 * the ledger transaction atomically; the cheaper HTTP read handle cannot.
 *
 * Returns the console-style `{ ok, code, message }` result so the client island
 * can branch + toast; on success the page path is revalidated so the now-settled,
 * freshly-derived state re-renders.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const referenceSchema = z
  .string()
  .trim()
  .min(1, 'A reference is required.')
  .max(128, 'That reference is too long.');

export async function payAction(reference: string): Promise<ActionResult> {
  const result = await withAction(async () => {
    const parsed = referenceSchema.safeParse(reference);
    if (!parsed.success) {
      return fail(NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED, 'This payment link is invalid.');
    }

    // Re-resolve the tenant scope from the trusted resource row — never trust a
    // scope from the client. A reference that matches nothing is a not-found.
    const scope = await getCheckoutScope(parsed.data);
    if (!scope) {
      return fail(NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND, 'Payment not found.');
    }

    const ctx: DomainContext = {
      organizationId: scope.organizationId,
      environment: scope.environment,
    };

    // STUB: stand in for the verified provider webhook. A real `providerReference`
    // would come off the webhook body; here we synthesize one so the join key is
    // present and the re-verify seam has something to look up. `confirmExample-
    // FromWebhook` itself does the "never assumed" work: re-verify, then post the
    // settlement ledger transaction + emit `example.settled`.
    await confirmExampleFromWebhook(txDb(), ctx, {
      reference: parsed.data,
      providerReference: `stub_${parsed.data}`,
    });

    return ok(undefined);
  });

  if (result.ok) revalidatePath(`/${reference}`);
  return result;
}
