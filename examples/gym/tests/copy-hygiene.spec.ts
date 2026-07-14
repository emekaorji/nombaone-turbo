import { expect, test } from '@playwright/test';

/**
 * ── THE COMPLAINT, AS A TEST ─────────────────────────────────────────────────
 *
 * "I simply do not understand what is going on. This is not a typical gym membership
 * platform."
 *
 * It wasn't. The old app told members it was a "reference merchant for the NombaOne
 * billing engine", let them reach their data by typing an email into a URL, and described
 * a membership as something that "renews every 10 minutes so you can watch the engine bill
 * in real time."
 *
 * Every one of those words is TRUE. Not one of them means anything to the person paying.
 *
 * So this test crawls the product as a real member and fails the build if a platform word
 * reaches the screen. It is the guardrail that stops the drift coming back the next time
 * someone is in a hurry.
 */

/** Words that are true, and useless — or worse, alarming — to a member. */
const PLATFORM_WORDS = [
  'engine',
  'webhook',
  'idempotenc',
  'invoice',
  'subscription',
  'past due',
  'past_due',
  'dunning',
  'rail',
  'billing cycle',
  'gateway',
  'SDK',
  'API',
];

/** Raw platform references (`nbo…sub`, `nbo_sandbox_…`) must never appear in a member's view. */
const RAW_REFERENCE = /\bnbo(_|[a-z0-9]{6,})/i;

const uniq = () => Math.random().toString(36).slice(2, 8);

async function joinAndGetPages(page: import('@playwright/test').Page) {
  await page.goto('/memberships');
  await page.locator('[data-plan="flex"] a').click();
  await page.fill('#name', 'Ada Okonkwo');
  await page.fill('#email', `hygiene-${uniq()}@ironrepublic.ng`);
  await page.fill('#password', 'ironrepublic2026');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
  await expect(page.getByText(/You're in/i)).toBeVisible({ timeout: 30_000 });
}

test('no platform vocabulary reaches a member, on any page, in any state', async ({ page }) => {
  await joinAndGetPages(page);

  const routes = [
    '/',
    '/memberships',
    '/welcome',
    '/account',
    '/account/membership',
    '/account/membership/cancel',
    '/account/payments',
    '/account/payment-method',
    '/account/updates',
  ];

  const offences: string[] = [];

  for (const route of routes) {
    await page.goto(route);

    // ⚠ Read innerText from the LIVE body, and strip the demo bar out of the live DOM
    // first. Do NOT clone: a detached node has no layout, so `innerText` silently degrades
    // to `textContent` — which slurps up Next.js's inline RSC <script> payload. That
    // payload is full of raw ids and the word "api", and scanning it means testing the
    // framework's guts instead of what a member can actually read.
    const text = await page.evaluate(() => {
      document
        .querySelectorAll('[data-testid="fast-forward"], [data-testid="force-decline"]')
        .forEach((n) => n.closest('div.rounded-lg')?.remove());
      return (document.body as HTMLElement).innerText;
    });

    for (const word of PLATFORM_WORDS) {
      // Whole words only. A substring match flags "API" inside "capital" and turns the
      // guardrail into noise, which is how guardrails get deleted.
      const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (pattern.test(text)) {
        offences.push(`${route} → "${word}"`);
      }
    }
    if (RAW_REFERENCE.test(text)) {
      offences.push(`${route} → a raw platform reference (nbo…)`);
    }
  }

  expect(
    offences,
    `A member should never read these words — they are true and meaningless to the person paying:\n  ${offences.join('\n  ')}`,
  ).toEqual([]);
});

test('a member never sees a raw platform reference in the URL bar either', async ({ page }) => {
  await joinAndGetPages(page);

  for (const route of ['/account', '/account/payments', '/account/updates']) {
    await page.goto(route);
    expect(page.url(), `${route} leaked a platform reference into the URL`).not.toMatch(
      RAW_REFERENCE,
    );
  }
});

test('every page renders without a client-side error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await joinAndGetPages(page);

  for (const route of ['/', '/memberships', '/account', '/account/payments', '/account/updates']) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }

  expect(errors, `Client-side errors:\n  ${errors.join('\n  ')}`).toEqual([]);
});
