'use server';

import { can, type OrgUserRole } from '@nombaone/sara/auth';
import { revalidatePath } from 'next/cache';

import { ApiError, callApi } from '@/lib/api-client';
import { getSession } from '@/lib/auth';

export type EngineActionState = { error?: string; ok?: boolean; note?: string };

const TEST_BEHAVIORS = new Set(['success', 'decline_insufficient_funds', 'decline_expired_card', 'decline_do_not_honor', 'requires_otp']);

/** Mint a deterministic sandbox payment method for a customer (POST /v1/sandbox/payment-methods). */
export async function attachTestMethodAction(
  customerReference: string,
  _prev: EngineActionState,
  formData: FormData,
): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can attach payment methods.' };
  if (session.mode !== 'sandbox') return { error: 'Test payment methods only exist in sandbox mode.' };

  const behavior = String(formData.get('behavior') ?? 'success');
  const kind = String(formData.get('kind') ?? 'card') === 'mandate' ? 'mandate' : 'card';
  if (!TEST_BEHAVIORS.has(behavior)) return { error: 'Pick a valid outcome.' };

  try {
    await callApi(session, '/sandbox/payment-methods', {
      method: 'POST',
      body: { customerId: customerReference, behavior, kind },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not attach the test method.' };
  }

  revalidatePath(`/customers/${customerReference}`);
  revalidatePath('/payments');
  return { ok: true };
}

/** Remove the discount from a customer (DELETE /v1/customers/:ref/discount). Called directly. */
export async function removeDiscountFromCustomerAction(customerReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/customers/${encodeURIComponent(customerReference)}/discount`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not remove the discount.' };
  }
  revalidatePath(`/customers/${customerReference}`);
  return { ok: true, note: 'Discount removed.' };
}

/** Void an unconsumed credit grant (DELETE /v1/customers/:ref/credit/:grantRef). Called directly. */
export async function voidCreditGrantAction(customerReference: string, grantReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/customers/${encodeURIComponent(customerReference)}/credit/${encodeURIComponent(grantReference)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not void the credit.' };
  }
  revalidatePath(`/customers/${customerReference}`);
  return { ok: true, note: 'Credit voided.' };
}

/** Void a draft/open invoice (POST /v1/invoices/:ref/void). */
export async function voidInvoiceAction(invoiceReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const comment = String(formData.get('comment') ?? '').trim() || undefined;
  try {
    await callApi(guard.session, `/invoices/${encodeURIComponent(invoiceReference)}/void`, { method: 'POST', body: comment ? { comment } : {} });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not void the invoice.' };
  }
  revalidatePath(`/invoices/${invoiceReference}`);
  revalidatePath('/invoices');
  return { ok: true, note: 'Invoice voided.' };
}

/** Set a payment method as the customer's default (POST /v1/payment-methods/:ref/default). Called directly. */
export async function setDefaultPaymentMethodAction(paymentMethodReference: string, customerReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/payment-methods/${encodeURIComponent(paymentMethodReference)}/default`, { method: 'POST', body: {} });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not set the default method.' };
  }
  revalidatePath(`/customers/${customerReference}`);
  revalidatePath('/payments');
  return { ok: true, note: 'Default method updated.' };
}

/** Remove a payment method (DELETE /v1/payment-methods/:ref). Called directly. */
export async function removePaymentMethodAction(paymentMethodReference: string, customerReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/payment-methods/${encodeURIComponent(paymentMethodReference)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not remove the method.' };
  }
  revalidatePath(`/customers/${customerReference}`);
  revalidatePath('/payments');
  return { ok: true, note: 'Method removed.' };
}

/** Change a subscription's plan/price/quantity — immediately (with proration) or scheduled for next cycle. */
export async function changeSubscriptionAction(subscriptionReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const priceId = String(formData.get('priceId') ?? '').trim();
  if (!priceId) return { error: 'Pick a price.' };
  const qtyRaw = String(formData.get('quantity') ?? '').trim();
  const quantity = qtyRaw ? Math.max(1, Math.floor(Number(qtyRaw))) : undefined;
  const when = String(formData.get('when') ?? 'now') === 'next_cycle' ? 'next_cycle' : 'now';

  try {
    if (when === 'next_cycle') {
      await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/schedule`, {
        method: 'POST',
        body: { priceId, ...(quantity ? { quantity } : {}), effectiveAt: 'next_cycle' },
      });
    } else {
      await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/change`, {
        method: 'POST',
        body: { priceId, ...(quantity ? { quantity } : {}), prorationBehavior: 'create_prorations' },
      });
    }
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not change the subscription.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  revalidatePath('/subscriptions');
  revalidatePath('/invoices');
  return { ok: true, note: when === 'next_cycle' ? 'Change scheduled for next cycle.' : 'Plan changed.' };
}

/** Change a subscription's default payment method (PATCH /v1/subscriptions/:ref). */
export async function updateSubscriptionMethodAction(subscriptionReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '').trim();
  if (!paymentMethodId) return { error: 'Pick a payment method.' };
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}`, { method: 'PATCH', body: { defaultPaymentMethodId: paymentMethodId } });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not update the payment method.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  revalidatePath('/subscriptions');
  return { ok: true, note: 'Payment method updated.' };
}

/** Cancel a scheduled next-cycle change (DELETE /v1/subscriptions/:ref/schedule). Called directly. */
export async function cancelScheduledChangeAction(subscriptionReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/schedule`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not cancel the scheduled change.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  return { ok: true, note: 'Scheduled change canceled.' };
}

/** Resubscribe a canceled subscription — mints a new subscription (POST /v1/subscriptions/:ref/resubscribe). */
export async function resubscribeAction(subscriptionReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const priceId = String(formData.get('priceId') ?? '').trim() || undefined;
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/resubscribe`, {
      method: 'POST',
      body: priceId ? { priceId } : {},
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not resubscribe.' };
  }
  revalidatePath('/subscriptions');
  revalidatePath('/');
  return { ok: true, note: 'Resubscribed.' };
}

/** Apply a coupon as a discount to a subscription (POST /v1/subscriptions/:ref/discount). */
export async function applyDiscountToSubscriptionAction(subscriptionReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const coupon = String(formData.get('coupon') ?? '').trim();
  if (!coupon) return { error: 'Enter a coupon code or reference.' };
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/discount`, { method: 'POST', body: { coupon } });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not apply the discount.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  revalidatePath('/subscriptions');
  return { ok: true, note: 'Discount applied.' };
}

/** Remove the discount from a subscription (DELETE /v1/subscriptions/:ref/discount). Called directly. */
export async function removeDiscountFromSubscriptionAction(subscriptionReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/discount`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not remove the discount.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  return { ok: true, note: 'Discount removed.' };
}

/** Apply a coupon as a discount to a customer (POST /v1/customers/:ref/discount). */
export async function applyDiscountToCustomerAction(customerReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const coupon = String(formData.get('coupon') ?? '').trim();
  if (!coupon) return { error: 'Enter a coupon code or reference.' };
  try {
    await callApi(guard.session, `/customers/${encodeURIComponent(customerReference)}/discount`, { method: 'POST', body: { coupon } });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not apply the discount.' };
  }
  revalidatePath(`/customers/${customerReference}`);
  return { ok: true, note: 'Discount applied.' };
}

/** Update a customer's editable details (PATCH /v1/customers/:ref). Email is identity — not editable. */
export async function editCustomerAction(customerReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can edit customers.' };

  const name = String(formData.get('name') ?? '').trim();
  const phoneRaw = String(formData.get('phone') ?? '').trim();
  if (!name) return { error: 'Name cannot be empty.' };
  const body: { name: string; phone: string | null } = { name, phone: phoneRaw || null };

  try {
    await callApi(session, `/customers/${encodeURIComponent(customerReference)}`, { method: 'PATCH', body });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not update the customer.' };
  }

  revalidatePath(`/customers/${customerReference}`);
  revalidatePath('/customers');
  return { ok: true, note: 'Customer updated.' };
}

async function requireOwner(): Promise<{ session: NonNullable<Awaited<ReturnType<typeof getSession>>> } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can change subscriptions.' };
  return { session };
}

/** Cancel a subscription (POST /v1/subscriptions/:ref/cancel). */
export async function cancelSubscriptionAction(subscriptionReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  const when = String(formData.get('when') ?? 'now') === 'at_period_end' ? 'at_period_end' : 'now';
  const comment = String(formData.get('comment') ?? '').trim() || undefined;
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/cancel`, {
      method: 'POST',
      body: { mode: when, ...(comment ? { comment } : {}) },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not cancel the subscription.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  revalidatePath('/subscriptions');
  revalidatePath('/');
  return { ok: true, note: when === 'now' ? 'Subscription canceled.' : 'Cancels at period end.' };
}

/** Pause a subscription (POST /v1/subscriptions/:ref/pause). Called directly (not a form action). */
export async function pauseSubscriptionAction(subscriptionReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/pause`, { method: 'POST', body: {} });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not pause the subscription.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  revalidatePath('/subscriptions');
  return { ok: true, note: 'Subscription paused.' };
}

/** Resume a paused subscription (POST /v1/subscriptions/:ref/resume). Called directly (not a form action). */
export async function resumeSubscriptionAction(subscriptionReference: string): Promise<EngineActionState> {
  const guard = await requireOwner();
  if ('error' in guard) return { error: guard.error };
  try {
    await callApi(guard.session, `/subscriptions/${encodeURIComponent(subscriptionReference)}/resume`, { method: 'POST', body: {} });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not resume the subscription.' };
  }
  revalidatePath(`/subscriptions/${subscriptionReference}`);
  revalidatePath('/subscriptions');
  return { ok: true, note: 'Subscription resumed.' };
}

/** Refund a settlement (POST /v1/settlements/:ref/refund). Omitted amount = full refundable tenant share. */
export async function refundSettlementAction(settlementReference: string, _prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can issue refunds.' };

  const naira = String(formData.get('amount') ?? '').trim();
  const amountInKobo = naira ? Math.round(Number(naira) * 100) : undefined;
  if (amountInKobo !== undefined && (!Number.isFinite(amountInKobo) || amountInKobo <= 0)) {
    return { error: 'Enter a valid amount, or leave blank for a full refund.' };
  }

  try {
    await callApi(session, `/settlements/${encodeURIComponent(settlementReference)}/refund`, {
      method: 'POST',
      body: amountInKobo !== undefined ? { amountInKobo } : {},
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not issue the refund.' };
  }

  revalidatePath('/settlements');
  revalidatePath('/reconciliation');
  return { ok: true, note: 'Refund issued.' };
}

/**
 * Withdraw the merchant's settled balance (POST /v1/settlements/payout).
 *
 * 🔒 No destination is sent. It used to post a hand-typed `bankCode` + `accountNumber`
 * straight through, which meant the money went wherever the form said — including
 * wherever a typo said. The API now reads the destination from the merchant's registered,
 * bank-verified payout account, so this action cannot misdirect a naira.
 *
 * No amount ⇒ withdraw everything available.
 */
export async function createPayoutAction(_prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can withdraw funds.' };

  const raw = String(formData.get('amount') ?? '').trim();
  const body: Record<string, unknown> = {};
  if (raw) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };
    body.amountInKobo = Math.round(amount * 100);
  }

  try {
    await callApi(session, '/settlements/payout', { method: 'POST', body });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not start the payout.' };
  }

  revalidatePath('/settlements');
  return { ok: true, note: 'Payout started. The money is on its way to your bank.' };
}

/**
 * Ask the BANK who owns an account number, without saving anything
 * (POST /v1/payout-accounts/resolve).
 *
 * This is what turns "type your bank details and hope" into "we found ADEBAYO STORES LTD
 * — is this you?". The merchant confirms the bank's answer instead of trusting their own
 * typing, so a wrong digit is caught before any money moves rather than after.
 */
export async function resolvePayoutAccountAction(
  _prev: EngineActionState,
  formData: FormData
): Promise<EngineActionState & { accountName?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };

  const bankCode = String(formData.get('bankCode') ?? '').trim();
  const bankName = String(formData.get('bankName') ?? '').trim();
  const accountNumber = String(formData.get('accountNumber') ?? '').trim();
  if (!bankCode || !bankName) return { error: 'Pick your bank.' };
  if (!/^\d{10}$/.test(accountNumber)) return { error: 'A Nigerian account number is exactly 10 digits.' };

  try {
    const res = await callApi<{ accountName: string }>(session, '/payout-accounts/resolve', {
      method: 'POST',
      body: { bankCode, bankName, accountNumber },
    });
    return { ok: true, accountName: res.accountName };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'We could not check that account with the bank.' };
  }
}

/**
 * Save the bank account this merchant is paid into (POST /v1/payout-accounts).
 *
 * Asked for at FIRST WITHDRAWAL, never at signup — a bank account is meaningless until
 * there is money to send to it, and demanding one at the door is friction for nothing.
 * The holder's name is not sent: the API takes it from the bank.
 */
export async function addPayoutAccountAction(_prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can set the payout account.' };

  const bankCode = String(formData.get('bankCode') ?? '').trim();
  const bankName = String(formData.get('bankName') ?? '').trim();
  const accountNumber = String(formData.get('accountNumber') ?? '').trim();
  if (!bankCode || !bankName) return { error: 'Pick your bank.' };
  if (!/^\d{10}$/.test(accountNumber)) return { error: 'A Nigerian account number is exactly 10 digits.' };

  try {
    await callApi(session, '/payout-accounts', {
      method: 'POST',
      body: { bankCode, bankName, accountNumber },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not save that bank account.' };
  }

  revalidatePath('/settlements');
  revalidatePath('/');
  return { ok: true, note: 'Bank account saved. Your revenue pays out here daily.' };
}

/** Mint a sandbox test method from the test page (customer chosen in the form). */
export async function mintTestMethodAction(_prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can attach payment methods.' };
  if (session.mode !== 'sandbox') return { error: 'Test payment methods only exist in sandbox mode.' };

  const customerId = String(formData.get('customerId') ?? '').trim();
  if (!customerId) return { error: 'Pick a customer.' };
  const behavior = String(formData.get('behavior') ?? 'success');
  const kind = String(formData.get('kind') ?? 'card') === 'mandate' ? 'mandate' : 'card';
  if (!TEST_BEHAVIORS.has(behavior)) return { error: 'Pick a valid outcome.' };

  try {
    await callApi(session, '/sandbox/payment-methods', { method: 'POST', body: { customerId, behavior, kind } });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not attach the test method.' };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/payments');
  return { ok: true, note: 'Test method attached.' };
}

/** Advance a subscription to its next cycle (POST /v1/sandbox/subscriptions/:ref/advance-cycle). Sandbox only. */
export async function advanceCycleAction(_prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can advance the clock.' };
  if (session.mode !== 'sandbox') return { error: 'The test clock only runs in sandbox mode.' };

  const subscriptionReference = String(formData.get('subscriptionReference') ?? '').trim();
  if (!subscriptionReference) return { error: 'Pick a subscription.' };

  let outcome = 'advanced';
  try {
    const data = await callApi<{ outcome?: string }>(session, `/sandbox/subscriptions/${encodeURIComponent(subscriptionReference)}/advance-cycle`, {
      method: 'POST',
    });
    outcome = data?.outcome ?? 'advanced';
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not advance the cycle.' };
  }

  revalidatePath('/subscriptions');
  revalidatePath('/invoices');
  revalidatePath('/dunning');
  revalidatePath('/');
  return { ok: true, note: `Cycle ${outcome}.` };
}

/** Emit a real signed catalog event to the org's endpoints (POST /v1/sandbox/webhooks/simulate). Sandbox only. */
export async function simulateWebhookAction(_prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can simulate webhooks.' };
  if (session.mode !== 'sandbox') return { error: 'Webhook simulation only runs in sandbox mode.' };

  const type = String(formData.get('type') ?? '').trim();
  if (!type) return { error: 'Pick an event type.' };

  try {
    await callApi(session, '/sandbox/webhooks/simulate', { method: 'POST', body: { type } });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not simulate the webhook.' };
  }

  revalidatePath('/developers/webhooks');
  return { ok: true, note: `Sent ${type}.` };
}

/** Start a subscription (POST /v1/subscriptions). Charges inline when charge_automatically + a method + no trial. */
export async function createSubscriptionAction(
  customerReference: string,
  _prev: EngineActionState,
  formData: FormData,
): Promise<EngineActionState> {
  const session = await getSession();
  if (!session) return { error: 'Your session has expired.' };
  if (!can(session.user.role as OrgUserRole, 'money:write')) return { error: 'Only owners can start subscriptions.' };

  const priceId = String(formData.get('priceId') ?? '').trim();
  if (!priceId) return { error: 'Pick a price.' };
  const collectionMethod = String(formData.get('collectionMethod') ?? 'charge_automatically') === 'send_invoice' ? 'send_invoice' : 'charge_automatically';
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '').trim() || undefined;
  const trialRaw = String(formData.get('trialDays') ?? '').trim();
  const trialDays = trialRaw ? Math.max(0, Math.floor(Number(trialRaw))) : undefined;

  if (collectionMethod === 'charge_automatically' && !paymentMethodId && !(trialDays && trialDays > 0)) {
    return { error: 'Automatic collection needs a payment method (or a trial). Attach a method first.' };
  }

  try {
    await callApi(session, '/subscriptions', {
      method: 'POST',
      body: {
        customerId: customerReference,
        priceId,
        ...(paymentMethodId ? { paymentMethodId } : {}),
        collectionMethod,
        ...(trialDays ? { trialDays } : {}),
        quantity: 1,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Could not start the subscription.' };
  }

  revalidatePath(`/customers/${customerReference}`);
  revalidatePath('/subscriptions');
  revalidatePath('/invoices');
  revalidatePath('/');
  return { ok: true };
}

/** Top-level "New subscription" — reads the chosen customer from the form, then delegates to createSubscriptionAction. */
export async function createSubscriptionPickCustomerAction(_prev: EngineActionState, formData: FormData): Promise<EngineActionState> {
  const customerReference = String(formData.get('customerId') ?? '').trim();
  if (!customerReference) return { error: 'Pick a customer.' };
  return createSubscriptionAction(customerReference, _prev, formData);
}
