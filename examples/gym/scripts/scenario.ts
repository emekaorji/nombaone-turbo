/**
 * Iron Republic — the asserting scenario.
 *
 * Drives the DEPLOYED-OR-LOCAL engine through the public SDK only and exits
 * non-zero on any failed invariant. Human payment steps prompt the operator;
 * pass `--headless` to skip every prompt and every paid-path assertion (CI
 * smoke without money) — what was skipped is printed at the end.
 *
 * Run:   pnpm --filter @nombaone/example-gym scenario [-- --headless]
 * Env:   examples/gym/.env (loaded via node --env-file-if-exists)
 */
import { createInterface } from 'node:readline/promises';

import { APIError } from '@nombaone/node';

import {
  GYM_PLANS,
  bootstrapCatalog,
  formatNaira,
  gymBaseUrl,
  nombaone,
} from '../src/lib/nombaone';

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

const HEADLESS = process.argv.includes('--headless');
const skipped: string[] = [];

const MINUTE = 60_000;

function banner(title: string): void {
  console.log(`\n━━━ ${title} ${'━'.repeat(Math.max(0, 64 - title.length))}`);
}

function pass(message: string): void {
  console.log(`  ✓ ${message}`);
}

function info(message: string): void {
  console.log(`  · ${message}`);
}

function skip(message: string): void {
  skipped.push(message);
  console.log(`  ↷ SKIPPED (headless): ${message}`);
}

function fail(message: string): never {
  console.error(`\n  ✗ ASSERT FAILED: ${message}`);
  console.error('\nScenario FAILED.');
  process.exit(1);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
  pass(message);
}

async function promptEnter(message: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(`\n  ▸ ${message}\n    Press ENTER when done… `);
  rl.close();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until `probe` returns non-null, else fail after `timeoutMs`. */
async function poll<T>(
  label: string,
  timeoutMs: number,
  intervalMs: number,
  probe: () => Promise<T | null>,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  info(`polling: ${label} (up to ${Math.round(timeoutMs / MINUTE)} min, every ${intervalMs / 1000}s)`);
  for (;;) {
    const result = await probe();
    if (result !== null) return result;
    if (Date.now() >= deadline) fail(`timed out waiting for: ${label}`);
    await sleep(intervalMs);
  }
}

/* ------------------------------------------------------------------ */
/* Scenario                                                            */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  if (!process.env.NOMBAONE_API_KEY) {
    console.error(
      'NOMBAONE_API_KEY is not set. Fill in examples/gym/.env (see .env.example) and re-run.',
    );
    process.exit(1);
  }

  const client = nombaone();
  const runId = Date.now().toString(36);

  console.log('Iron Republic scenario');
  console.log(`  engine:   ${client.baseUrl} (${client.mode})`);
  console.log(`  callback: ${gymBaseUrl()}/welcome`);
  console.log(`  mode:     ${HEADLESS ? 'HEADLESS (prompts + paid-path assertions skipped)' : 'interactive'}`);

  /* ---- 1. Bootstrap the catalog ---------------------------------- */
  banner('1 · Bootstrap catalog');
  const catalog = await bootstrapCatalog();
  assert(catalog.length === GYM_PLANS.length, `catalog has ${GYM_PLANS.length} plan+price pairs`);
  const dayPass = catalog.find(
    (entry) => entry.price.interval === 'minute' && entry.price.intervalCount === 10,
  );
  assert(dayPass, "a price with interval:'minute', intervalCount:10 exists (the demo cadence)");
  for (const { def, plan, price } of catalog) {
    info(
      `${def.displayName}: plan ${plan.id} · price ${price.id} · ${formatNaira(price.unitAmountInKobo)} ${def.cadenceLabel}`,
    );
  }

  /* ---- 2. Member A joins (hosted-checkout entry, no PM) ---------- */
  banner('2 · Member A joins the Day Pass (no payment method)');
  const memberA = await client.customers.create({
    email: `scenario-${runId}-card@ironrepublic.test`,
    name: 'Scenario Member A (card)',
  });
  info(`customer ${memberA.id} <${memberA.email}>`);
  let subA = await client.subscriptions.create({
    customerId: memberA.id,
    priceId: dayPass.price.id,
    callbackUrl: `${gymBaseUrl()}/welcome`,
  });
  assert(subA.status === 'incomplete', `subscription starts 'incomplete' (got '${subA.status}')`);
  assert(subA.checkoutLink, 'create response carries a non-null checkoutLink');
  assert(subA.latestInvoiceId, 'latestInvoiceId is set on the create response');
  console.log(`\n  CHECKOUT LINK (member A): ${subA.checkoutLink}`);

  /* ---- 3. Pay by card → active + token captured ------------------ */
  banner('3 · First payment by CARD activates + tokenizes');
  if (HEADLESS) {
    skip('pay member A checkout link by card; assert active + defaultPaymentMethodId captured');
  } else {
    await promptEnter('Pay the checkout link above by CARD, then press enter');
    subA = await poll('member A subscription becomes active', 3 * MINUTE, 5_000, async () => {
      const current = await client.subscriptions.retrieve(subA.id);
      return current.status === 'active' ? current : null;
    });
    assert(subA.status === 'active', "member A subscription is 'active'");
    assert(
      subA.defaultPaymentMethodId,
      `card token captured — defaultPaymentMethodId = ${subA.defaultPaymentMethodId}`,
    );
  }

  /* ---- 4. Silent renewal on the 10-minute cycle ------------------ */
  banner('4 · Silent renewal (one 10-minute cycle)');
  if (HEADLESS) {
    skip('wait one 10-minute cycle; assert a subscription_cycle invoice lands paid|open');
  } else {
    console.log('  waiting one 10-minute cycle for silent renewal…');
    let otpPrompted = false;
    const renewal = await poll(
      'a renewal (subscription_cycle) invoice for member A',
      12 * MINUTE,
      15_000,
      async () => {
        const invoices = await client.invoices.list({ subscriptionId: subA.id, limit: 100 });
        const cycleInvoice = invoices.data.find(
          (inv) => inv.billingReason === 'subscription_cycle',
        );
        if (cycleInvoice && ['paid', 'open'].includes(cycleInvoice.status)) return cycleInvoice;

        // OTP reality check: some banks force a 3DS step-up on tokenized
        // recharges. The engine then emits invoice.action_required with a
        // checkoutLink instead of collecting silently.
        if (!otpPrompted) {
          const invoiceIds = new Set(invoices.data.map((inv) => inv.id));
          const actionEvents = await client.events.list({
            type: 'invoice.action_required',
            limit: 50,
          });
          const ours = actionEvents.data.find((evt) => {
            const reference = evt.payload.reference;
            return typeof reference === 'string' && invoiceIds.has(reference);
          });
          if (ours) {
            otpPrompted = true;
            const link = ours.payload.checkoutLink;
            console.log(
              `\n  ⚠ OTP REALITY CHECK: the bank stepped up the silent recharge (invoice.action_required).`,
            );
            console.log(`    Completion link: ${typeof link === 'string' ? link : '(none in payload)'}`);
            await promptEnter('Complete the OTP step at the link above, then press enter');
          }
        }
        return cycleInvoice ?? null;
      },
    );
    assert(
      ['paid', 'open'].includes(renewal.status),
      `renewal invoice ${renewal.id} landed with status ∈ paid|open`,
    );
    info(`renewal collected as '${renewal.status}'${otpPrompted ? ' (after an OTP step-up)' : ' (fully silent)'}`);
  }

  /* ---- 5. Member B pays by bank transfer → the flip -------------- */
  banner('5 · Member B pays by BANK TRANSFER → collectionMethod flips');
  const memberB = await client.customers.create({
    email: `scenario-${runId}-transfer@ironrepublic.test`,
    name: 'Scenario Member B (transfer)',
  });
  info(`customer ${memberB.id} <${memberB.email}>`);
  let subB = await client.subscriptions.create({
    customerId: memberB.id,
    priceId: dayPass.price.id,
    callbackUrl: `${gymBaseUrl()}/welcome`,
  });
  assert(subB.status === 'incomplete', `member B subscription starts 'incomplete'`);
  assert(subB.checkoutLink, 'member B create response carries a checkoutLink');
  console.log(`\n  CHECKOUT LINK (member B): ${subB.checkoutLink}`);
  if (HEADLESS) {
    skip("pay member B by bank transfer; assert collectionMethod === 'send_invoice' and NO defaultPaymentMethodId");
  } else {
    await promptEnter('Pay the checkout link above by BANK TRANSFER, then press enter');
    subB = await poll('member B subscription becomes active (transfer settles)', 5 * MINUTE, 5_000, async () => {
      const current = await client.subscriptions.retrieve(subB.id);
      return current.status === 'active' ? current : null;
    });
    assert(
      subB.collectionMethod === 'send_invoice',
      `paying by transfer flipped collectionMethod to 'send_invoice' (got '${subB.collectionMethod}')`,
    );
    assert(
      subB.defaultPaymentMethodId === null,
      'no defaultPaymentMethodId captured on the transfer rail (nothing to token-charge)',
    );
  }

  /* ---- 6. Cancel member A at period end --------------------------- */
  banner("6 · Cancel member A with mode: 'at_period_end'");
  if (HEADLESS) {
    // Still exercise cancel on the (unpaid, incomplete) subscription.
    try {
      const canceled = await client.subscriptions.cancel(subA.id, { mode: 'at_period_end' });
      info(`cancel accepted — status '${canceled.status}', cancelAtPeriodEnd=${canceled.cancelAtPeriodEnd}`);
      pass('subscriptions.cancel exercised');
    } catch (error) {
      if (error instanceof APIError && error.code === 'SUBSCRIPTION_ILLEGAL_TRANSITION') {
        try {
          const canceled = await client.subscriptions.cancel(subA.id, { mode: 'now' });
          info(`at_period_end illegal on an incomplete sub; cancel now → '${canceled.status}'`);
          pass('subscriptions.cancel exercised (mode: now fallback)');
        } catch (inner) {
          if (inner instanceof APIError && inner.code === 'SUBSCRIPTION_ILLEGAL_TRANSITION') {
            skip('cancel assertions — the engine refuses to cancel a never-paid incomplete subscription');
          } else {
            throw inner;
          }
        }
      } else {
        throw error;
      }
    }
    skip('poll to canceled after the period boundary; assert no further invoices');
  } else {
    const beforeCancel = await client.invoices.list({ subscriptionId: subA.id, limit: 100 });
    const invoiceCountAtCancel = beforeCancel.data.length;
    const canceledAck = await client.subscriptions.cancel(subA.id, { mode: 'at_period_end' });
    assert(canceledAck.cancelAtPeriodEnd, 'cancelAtPeriodEnd flag is set — access runs to the boundary');
    subA = await poll(
      "member A subscription becomes 'canceled' after the boundary",
      12 * MINUTE,
      15_000,
      async () => {
        const current = await client.subscriptions.retrieve(subA.id);
        return current.status === 'canceled' ? current : null;
      },
    );
    assert(subA.status === 'canceled', "member A subscription is 'canceled'");
    info('waiting 60s past cancellation to confirm the engine bills nothing further…');
    await sleep(MINUTE);
    const afterCancel = await client.invoices.list({ subscriptionId: subA.id, limit: 100 });
    assert(
      afterCancel.data.length === invoiceCountAtCancel,
      `no further invoices after cancel (${afterCancel.data.length} = ${invoiceCountAtCancel})`,
    );
  }

  /* ---- 7. Webhook / event-log sanity ------------------------------ */
  banner('7 · Event-log sanity (events.list)');
  const typesSeen = new Set<string>();
  let scanned = 0;
  for await (const event of client.events.list({ limit: 100 })) {
    typesSeen.add(event.type);
    scanned += 1;
    if (scanned >= 300) break;
  }
  info(`scanned ${scanned} events · ${typesSeen.size} distinct types: ${[...typesSeen].sort().join(', ')}`);
  if (HEADLESS) {
    assert(typesSeen.has('subscription.created'), "event log includes 'subscription.created'");
    skip("assert event types include 'subscription.activated' and 'invoice.paid' (paid path)");
  } else {
    assert(typesSeen.has('subscription.activated'), "event types seen include 'subscription.activated'");
    assert(typesSeen.has('invoice.paid'), "event types seen include 'invoice.paid'");
  }

  /* ---- Summary ----------------------------------------------------- */
  banner('Scenario PASSED');
  if (skipped.length > 0) {
    console.log('  Skipped in headless mode:');
    for (const item of skipped) console.log(`   ↷ ${item}`);
  } else {
    console.log('  Every step ran and every invariant held. The engine did the billing.');
  }
}

main().catch((error: unknown) => {
  if (error instanceof APIError) {
    console.error(`\nAPI error ${error.statusCode} [${error.code}]: ${error.message}`);
    if (error.hint) console.error(`hint: ${error.hint}`);
    if (error.docUrl) console.error(`docs: ${error.docUrl}`);
  } else {
    console.error('\nScenario crashed:', error);
  }
  process.exit(1);
});
