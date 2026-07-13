import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ── 🔴 THE MONEY MUST BE WIRED AT BOOT ──────────────────────────────────────────
 *
 * `registerRailsIfConfigured()` swaps the mock rails — which `@nombaone/sara/rails`
 * registers as an import side-effect — for the REAL Nomba card/mandate/transfer
 * adapters, and installs the Nomba client factory that `mintInvoiceCheckoutLink`
 * depends on.
 *
 * It existed, it was correct, and it was called from NOWHERE. Its only caller in the
 * whole repo was one e2e test. So the deployed API booted with `mock_pull` and
 * `mock_push` as its only rails, and in production:
 *
 *   • `getRail('card')` threw `RAIL_NOT_REGISTERED` on every renewal charge;
 *   • `getBillingNombaClient()` returned `null`, so `mintInvoiceCheckoutLink` returned
 *     `null` and `POST /v1/subscriptions` handed the customer NO checkout link.
 *
 * Every e2e suite passed throughout, because the harness injects a Nomba client
 * directly and never boots the real entrypoint. That is precisely the hole this test
 * exists to cover: it asserts on the ENTRYPOINT SOURCE, which is the one thing the
 * integration tests structurally cannot reach.
 *
 * If you are here because this test failed: an entrypoint stopped registering the
 * rails, and the money path in that process is dead. Do not delete this test.
 */
const SRC = join(__dirname, '../../src');

/**
 * Read an entrypoint with ALL COMMENTS STRIPPED.
 *
 * This matters, and the first version of this test got it wrong: both entrypoints carry a
 * long doc-comment explaining `registerRailsIfConfigured()` — parentheses and all — so a
 * naive grep of the raw source matches the COMMENT and passes even when the call has been
 * deleted. The test would have been permanently green and worthless. We assert on code, not
 * on prose about the code.
 */
const read = (file: string): string =>
  readFileSync(join(SRC, file), 'utf8')
    // LINE comments first, deliberately. server.ts opens with an eslint-disable line that
    // contains the glob `@nombaone/*` — and that `/*` opens a block-comment match which
    // then swallows the whole import section, so a block-first strip silently deletes the
    // very import this test checks for.
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

/** Every process that can serve a money route or run a money sweep. */
const ENTRYPOINTS = [
  {
    file: 'server.ts',
    why: 'the deployed API: serves /v1 AND runs the billing/dunning/settlement sweeps',
  },
  {
    file: 'http-only.ts',
    why: 'the console bridge: serves the same /v1 money routes (subscribe, charge, payout)',
  },
];

describe('🔴 every entrypoint registers the real Nomba rails at boot', () => {
  it.each(ENTRYPOINTS)('$file calls registerRailsIfConfigured() — $why', ({ file }) => {
    const source = read(file);

    expect(
      source.includes('registerRailsIfConfigured'),
      `${file} never calls registerRailsIfConfigured(). Without it this process boots with ONLY the mock rails: ` +
        `getRail('card') throws RAIL_NOT_REGISTERED on every charge, and mintInvoiceCheckoutLink returns null ` +
        `so subscribers get no checkout link. The money path is dead in that process.`
    ).toBe(true);

    // Imported, not just named in a comment.
    expect(
      /import\s+\{[^}]*registerRailsIfConfigured[^}]*\}\s+from/.test(source),
      `${file} mentions registerRailsIfConfigured but does not import it.`
    ).toBe(true);

    // Actually invoked.
    expect(
      /registerRailsIfConfigured\s*\(\s*\)/.test(source),
      `${file} imports registerRailsIfConfigured but never CALLS it.`
    ).toBe(true);
  });

  it('registerRailsIfConfigured is not test-only — it has a production caller', () => {
    // The original defect in one assertion: the function was live, correct, and
    // referenced exclusively by a test file.
    const productionCallers = ENTRYPOINTS.filter((e) =>
      /registerRailsIfConfigured\s*\(\s*\)/.test(read(e.file))
    );
    expect(productionCallers.length).toBeGreaterThan(0);
  });
});
