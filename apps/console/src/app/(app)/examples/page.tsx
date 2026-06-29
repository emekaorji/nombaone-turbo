import type { Metadata } from 'next';

import { listExamples } from '@nombaone/sara/example';
import type { ExampleKind } from '@nombaone/core-contracts/types';

import { PageHeader } from '@/components/common/PageHeader';
import { db } from '@/lib/db';
import { getOrgDomainCtx } from '@/lib/auth-context';
import { ExamplesClient } from '@/components/examples/ExamplesClient';
import { CreateExampleButton } from '@/components/examples/CreateExampleButton';

export const metadata: Metadata = { title: 'Examples · Nombaone Console' };

const KINDS: ReadonlySet<string> = new Set<ExampleKind>(['standard', 'priority']);

/**
 * Examples list — the deletable money-path slice. List STATE lives in the URL
 * (`?kind=`, `?cursor=`) so the view is shareable + refresh-safe (nuqs on the
 * client; this RSC just reads the resolved params). The page fetches one keyset
 * page through `listExamples` (session-pinned scope) and hands the page + next
 * cursor to the client island. Next 16: `searchParams` is async.
 */
export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; cursor?: string }>;
}) {
  const ctx = await getOrgDomainCtx();
  const { kind: kindParam, cursor } = await searchParams;
  const kind = kindParam && KINDS.has(kindParam) ? (kindParam as ExampleKind) : undefined;

  const page = await listExamples(db, ctx, { kind, cursor, limit: 20 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examples"
        description="The deletable money-path slice — each example posts a balanced double-entry charge."
        actions={<CreateExampleButton />}
      />
      <ExamplesClient
        rows={page.data}
        nextCursor={page.nextCursor}
        hasMore={page.hasMore}
        activeKind={kind ?? null}
      />
    </div>
  );
}
