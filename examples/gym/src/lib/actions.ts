'use server';

import { randomUUID } from 'node:crypto';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { authenticate, createMember, currentMember, findMemberByEmail, signOut } from '@/lib/auth';
import { catalog, findCustomerByEmail, gymBaseUrl, nombaone, SANDBOX } from '@/lib/nombaone';
import { db } from '@/lib/db';
import { loadMembership } from '@/lib/membership';

/**
 * Everything Iron Republic writes to the billing engine.
 *
 * Every money-write carries an idempotency key — a member who double-taps "Pay" on a
 * flaky phone connection must not be charged twice, and that guarantee has to live here,
 * not in their thumb.
 */

export type FormState = { error?: string; ok?: boolean };

/* ------------------------------------------------------------------ */
/* Joining                                                             */
/* ------------------------------------------------------------------ */

/**
 * Sign up and start the membership — one step, from the member's point of view.
 *
 * Order matters: the NombaOne customer is created BEFORE the gym's member row. A member
 * we cannot bill is worse than no member at all, so if the engine is unreachable we fail
 * before taking their password rather than after.
 */
export async function joinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const password = String(formData.get('password') ?? '');
  const priceId = String(formData.get('priceId') ?? '');

  if (!name) return { error: 'Tell us your name.' };
  if (!email.includes('@')) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };
  if (!priceId) return { error: 'Pick a membership first.' };

  if (findMemberByEmail(email)) {
    return { error: 'You already have an account with that email. Sign in instead.' };
  }

  let redirectTo: string;

  try {
    const client = nombaone();

    // The member IS a NombaOne customer. Reuse one if this email is already on the
    // platform (someone who started joining before and never paid).
    const existing = await findCustomerByEmail(email);
    const customer =
      existing ??
      (await client.customers.create(
        { name, email, ...(phone ? { phone } : {}) },
        { idempotencyKey: `cust:${email}` },
      ));

    const member = await createMember({ email, name, phone, password, customerId: customer.id });

    /**
     * ── How the member pays ──────────────────────────────────────────────────
     *
     * LIVE: subscribe with NO payment method. The engine hands back a hosted checkout
     * link and leaves the membership dormant until the money actually arrives — nothing
     * is granted on a promise. That is the real entry, and it is what this code does with
     * a live key.
     *
     * SANDBOX: use a deterministic test card instead, and say so on the page.
     *
     * This is not a shortcut — it is the only honest option. Nomba's sandbox does not
     * deliver transaction webhooks (confirmed on two separate accounts), so a card paid on
     * the sandbox checkout page NEVER reaches the engine: the membership would sit on
     * "we're confirming your payment" forever, and the member would be stranded on a page
     * that can never finish. Shipping that button would be shipping a dead end.
     *
     * The test card runs every real path the live one does — invoice, charge, ledger,
     * renewal, the dunning ladder, recovery. Only the Nomba rail itself is stood in for.
     */
    if (SANDBOX) {
      const method = await client.sandbox.createPaymentMethod(
        { customerId: customer.id, behavior: 'success' },
        { idempotencyKey: `pm:${member.id}` },
      );

      await client.subscriptions.create(
        { customerId: customer.id, priceId, paymentMethodId: method.id },
        { idempotencyKey: `sub:${member.id}:${priceId}` },
      );

      redirectTo = '/welcome';
    } else {
      const subscription = await client.subscriptions.create(
        { customerId: customer.id, priceId, callbackUrl: `${gymBaseUrl()}/welcome` },
        { idempotencyKey: `sub:${member.id}:${priceId}` },
      );

      if (!subscription.checkoutLink) {
        return { error: "We couldn't start your payment just now. Please try again." };
      }

      // Keep the link. The engine returns it on this one response and NEVER again (it is
      // null on every subsequent read) — so if the member closes the payment page without
      // paying, this row is the only way back to it. That is the "Finish joining" button.
      db()
        .prepare(
          `INSERT OR REPLACE INTO pending_checkouts (subscription_id, member_id, checkout_link, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(subscription.id, member.id, subscription.checkoutLink, new Date().toISOString());

      redirectTo = subscription.checkoutLink;
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `We couldn't set up your membership: ${error.message}`
          : "We couldn't set up your membership.",
    };
  }

  redirect(redirectTo); // outside the try — redirect() works by throwing
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  const member = await authenticate(email, password);
  // One message for a wrong email AND a wrong password — never confirm which addresses
  // have accounts here.
  if (!member) return { error: "That email and password don't match." };

  redirect('/account');
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/');
}

/* ------------------------------------------------------------------ */
/* Managing a membership                                               */
/* ------------------------------------------------------------------ */

export async function changePlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await currentMember();
  if (!member) return { error: 'Please sign in again.' };

  const priceId = String(formData.get('priceId') ?? '');
  const view = await loadMembership(member);
  if (!view.subscriptionId) return { error: "You don't have a membership to change." };
  if (!priceId || priceId === view.priceId) return { error: 'Pick a different membership.' };

  try {
    const cat = await catalog();
    const from = cat.find((c) => c.price.id === view.priceId)?.price;
    const to = cat.find((c) => c.price.id === priceId)?.price;

    await nombaone().subscriptions.change(
      view.subscriptionId,
      {
        priceId,
        // Moving between a monthly membership and the by-the-minute Flex Pass changes the
        // cadence, not just the price — the engine must be told, or it refuses.
        intervalSwitch: Boolean(from && to && from.interval !== to.interval),
        prorationBehavior: 'create_prorations',
      },
      { idempotencyKey: `change:${view.subscriptionId}:${priceId}` },
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "We couldn't change your membership.",
    };
  }

  revalidatePath('/account');
  redirect('/account');
}

export async function pauseAction(): Promise<void> {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const view = await loadMembership(member);
  if (view.subscriptionId) {
    await nombaone().subscriptions.pause(
      view.subscriptionId,
      {},
      { idempotencyKey: `pause:${view.subscriptionId}:${Date.now()}` },
    );
  }
  revalidatePath('/account');
  redirect('/account');
}

export async function resumeAction(): Promise<void> {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const view = await loadMembership(member);
  if (view.subscriptionId) {
    await nombaone().subscriptions.resume(view.subscriptionId, {
      idempotencyKey: `resume:${view.subscriptionId}:${Date.now()}`,
    });
  }
  revalidatePath('/account');
  redirect('/account');
}

/**
 * Cancel — at the end of the period they have already paid for.
 *
 * ⚠ There is deliberately NO "undo cancel" anywhere in this app. The engine has no
 * `uncancel`, so a button offering it would be a lie the first time someone pressed it.
 * The honest way back is to rejoin, which is one tap.
 */
export async function cancelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const member = await currentMember();
  if (!member) return { error: 'Please sign in again.' };

  const view = await loadMembership(member);
  if (!view.subscriptionId) return { error: "You don't have a membership to cancel." };

  const reason = String(formData.get('reason') ?? '').trim();

  try {
    await nombaone().subscriptions.cancel(
      view.subscriptionId,
      { mode: 'at_period_end', ...(reason ? { comment: reason } : {}) },
      { idempotencyKey: `cancel:${view.subscriptionId}` },
    );
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "We couldn't cancel your membership.",
    };
  }

  revalidatePath('/account');
  redirect('/account?stopped=1');
}

/** "I'm done" on a Flex Pass — the same stop, worded the way floor time actually works. */
export async function stopFlexAction(): Promise<void> {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const view = await loadMembership(member);
  if (view.subscriptionId) {
    await nombaone().subscriptions.cancel(
      view.subscriptionId,
      { mode: 'at_period_end' },
      { idempotencyKey: `cancel:${view.subscriptionId}` },
    );
  }
  revalidatePath('/account');
  redirect('/account?stopped=1');
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

/**
 * Add or replace the card on file.
 *
 * Card capture is a hosted page with a small verification charge — this app never touches
 * a card number. The new card is bound to the membership by the `payment_method.attached`
 * webhook, NOT by this redirect: the callback only tells us the member came back, which
 * is not the same as the bank having said yes.
 */
export async function startCardUpdateAction(): Promise<void> {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const setup = await nombaone().paymentMethods.setup(
    {
      customerRef: member.customerId,
      amountInKobo: 10_000, // ₦100 card check
      callbackUrl: `${gymBaseUrl()}/account/payment-method?added=1`,
    },
    { idempotencyKey: `card:${member.id}:${Date.now()}` },
  );

  redirect(setup.checkoutLink);
}

/* ------------------------------------------------------------------ */
/* Demo levers — sandbox key only (see components/demo-bar.tsx)         */
/* ------------------------------------------------------------------ */

/**
 * Bring the next payment forward.
 *
 * A Flex Pass genuinely renews every ten minutes, so a renewal CAN simply be waited for —
 * and that is the honest demo. This exists so you don't have to wait for it in a room full
 * of judges.
 */
export async function fastForwardAction(): Promise<void> {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const view = await loadMembership(member);
  if (view.subscriptionId) {
    await nombaone().sandbox.advanceCycle(view.subscriptionId, {
      idempotencyKey: `ff:${view.subscriptionId}:${randomUUID()}`,
    });
  }
  revalidatePath('/account');
  redirect('/account');
}

/**
 * Make the next payment fail.
 *
 * A declined card is the one story you cannot stage naturally — you would have to actually
 * run out of money. This swaps in a card the sandbox always declines, so the recovery
 * story (grace period, "you can still train until…", the pay link) can be shown for real.
 */
export async function forceDeclineAction(): Promise<void> {
  const member = await currentMember();
  if (!member) redirect('/signin');

  const client = nombaone();
  const view = await loadMembership(member);
  if (!view.subscriptionId) redirect('/account');

  const method = await client.sandbox.createPaymentMethod(
    { customerId: member.customerId, behavior: 'decline_insufficient_funds' },
    { idempotencyKey: `decline:${member.id}:${randomUUID()}` },
  );

  await client.subscriptions.updatePaymentMethod(
    view.subscriptionId,
    { paymentMethodReference: method.id },
    { idempotencyKey: `setpm:${view.subscriptionId}:${method.id}` },
  );

  revalidatePath('/account');
  redirect('/account');
}
