'use server';

/**
 * Server actions — the merchant-side writes. Joining is the canonical
 * hosted-checkout entry: create (or reuse) the customer, create the
 * subscription with NO payment method, and hand the member to the
 * `checkoutLink` the engine returns. Paying there activates the subscription
 * and captures a reusable card for silent renewals.
 */
import { redirect } from 'next/navigation';

import { ConflictError } from '@nombaone/node';

import { findCustomerByEmail, gymBaseUrl, nombaone } from './nombaone';

import type { Customer } from '@nombaone/node';

export async function joinGym(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const priceId = String(formData.get('priceId') ?? '');

  if (!name || !email || !priceId) {
    redirect('/?error=Fill%20in%20your%20name%20and%20email%20to%20join.');
  }

  const client = nombaone();

  // Reuse the customer by email; emails are unique per org + mode.
  let customer: Customer | null = await findCustomerByEmail(email);
  if (!customer) {
    try {
      customer = await client.customers.create({ email, name });
    } catch (error) {
      // CUSTOMER_EMAIL_TAKEN — created concurrently; reuse it.
      if (!(error instanceof ConflictError)) throw error;
      customer = await findCustomerByEmail(email);
    }
  }
  if (!customer) {
    throw new Error(`Could not create or find a customer for ${email}.`);
  }

  // No paymentMethodId → hosted-checkout entry: the subscription starts
  // `incomplete` and the response carries the checkoutLink.
  const subscription = await client.subscriptions.create({
    customerId: customer.id,
    priceId,
    callbackUrl: `${gymBaseUrl()}/welcome`,
  });

  redirect(subscription.checkoutLink ?? `/members/${encodeURIComponent(email)}`);
}

/** "Already a member?" lookup — navigates to the member view. */
export async function lookupMember(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!email) redirect('/?error=Enter%20the%20email%20you%20joined%20with.');
  redirect(`/members/${encodeURIComponent(email)}`);
}
