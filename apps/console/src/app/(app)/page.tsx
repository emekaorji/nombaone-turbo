import { Code, Flash, Hierarchy } from 'iconsax-react';

import { getOrganization } from '@nombaone/sara/org';
import { listApiKeys } from '@nombaone/sara/api-keys';
import { listWebhookEndpoints } from '@nombaone/sara/webhooks';
import { listExamples } from '@nombaone/sara/example';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Section } from '@/components/common/Section';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { db } from '@/lib/db';
import { getOrgDomainCtx } from '@/lib/auth-context';

/**
 * Overview — the signed-in landing screen. Every figure is an RSC read through a
 * `@nombaone/sara` domain function with the session-pinned scope (`ctx`); there
 * is NO API layer between the console and the domain. The reads run in parallel.
 */
export default async function OverviewPage() {
  const ctx = await getOrgDomainCtx();

  const [org, keys, endpoints, examples] = await Promise.all([
    getOrganization(db, ctx.organizationId),
    listApiKeys(db, ctx),
    listWebhookEndpoints(db, ctx),
    listExamples(db, ctx, { limit: 100 }),
  ]);

  const activeKeys = keys.filter((k) => !k.revokedAt).length;
  const activeEndpoints = endpoints.filter((e) => !e.disabledAt).length;
  const exampleVolumeKobo = examples.data.reduce((sum, e) => sum + e.amountInKobo, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${org ? `, ${org.name}` : ''}`}
        description={`You're viewing the ${ctx.environment === 'live' ? 'live' : 'test'} environment.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active API keys"
          value={activeKeys}
          hint={`${keys.length} total`}
          icon={Code}
        />
        <StatCard
          label="Webhook endpoints"
          value={activeEndpoints}
          hint={`${endpoints.length} total`}
          icon={Hierarchy}
        />
        <StatCard
          label="Example volume"
          value={<MoneyAmount kobo={exampleVolumeKobo} />}
          hint={`${examples.data.length} examples`}
          icon={Flash}
        />
      </div>

      <Section
        title="Getting started"
        description="The console is wired to the Nombaone domain — no API layer in between."
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            • <span className="text-foreground">Developers → API keys</span>: mint a per-environment
            secret key (shown once) to call the public API.
          </li>
          <li>
            • <span className="text-foreground">Developers → Webhooks</span>: register an endpoint
            and receive HMAC-signed event deliveries.
          </li>
          <li>
            • <span className="text-foreground">Examples</span>: the deletable money-path slice —
            create one to watch the double-entry ledger move.
          </li>
        </ul>
      </Section>
    </div>
  );
}
