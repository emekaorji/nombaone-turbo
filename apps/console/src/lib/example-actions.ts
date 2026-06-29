'use server';

import { createExampleBody } from '@nombaone/core-contracts/validations';
import { NOMBAONE_ERROR_CODES, type ApiFieldErrors } from '@nombaone/errors';
import { createExample } from '@nombaone/sara/example';
import type { PoolDatabase } from '@nombaone/core-db/pool';

import { txDb } from './db-tx';
import { getOrgDomainCtx, requireCapability } from './auth-context';
import { withAction, fail, ok, type ActionResult } from './actions';

/**
 * Create an example (the deletable money-path slice). This exercises the full
 * domain path — ledger post, event emit, mock-rail collect — from the console so
 * the slice is demonstrable end to end. Gated on `apiKeys:manage` (developer and
 * above) since it mutates money state; the scope is session-pinned, never
 * client-supplied. `createExample` opens an interactive tx → concrete
 * `PoolDatabase`.
 */
export type CreateExampleResult = ActionResult<{ reference: string }>;

export async function createExampleAction(raw: unknown): Promise<CreateExampleResult> {
  return withAction(
    async () => {
      await requireCapability('apiKeys:manage');
      const parsed = createExampleBody.safeParse(raw);
      if (!parsed.success) {
        const fields: ApiFieldErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join('.') || '_root';
          (fields[key] ??= []).push(issue.message);
        }
        return fail(
          NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
          'Enter a positive amount in kobo.',
          fields
        );
      }

      const ctx = await getOrgDomainCtx();
      const created = await createExample(txDb() as PoolDatabase, ctx, {
        kind: parsed.data.kind,
        amount: parsed.data.amount,
      });
      return ok({ reference: created.id });
    },
    { revalidate: '/examples' }
  );
}
