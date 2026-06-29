'use client';

import { Hierarchy } from 'iconsax-react';

import { Button } from '@nombaone/ui/components/ui/button';
import { Badge } from '@nombaone/ui/components/ui/badge';

import { Section } from '@/components/common/Section';
import { Reference } from '@/components/common/Reference';
import { StatusPill } from '@/components/common/StatusPill';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CreateWebhookDialog } from '@/components/developers/CreateWebhookDialog';
import { webhookEndpointPill } from '@/lib/status';
import { absoluteDate } from '@/lib/format';
import { disableWebhookEndpointAction } from '@/lib/developer-actions';

export interface WebhookView {
  reference: string;
  url: string;
  enabledEvents: string[];
  signingSecretPrefix: string;
  disabledAt: string | null;
  createdAt: string;
}

/**
 * Webhook-endpoints list island. Each endpoint renders as a card (URL, status,
 * subscribed events, reference, created-at) with a disable confirm. Mutations go
 * through `@/lib/developer-actions` (RBAC + scope re-checked server-side);
 * `canManage` gates whether the add/disable affordances render.
 */
export function WebhooksClient({
  endpoints,
  canManage,
}: {
  endpoints: WebhookView[];
  canManage: boolean;
}) {
  if (endpoints.length === 0) {
    return (
      <EmptyState
        icon={Hierarchy}
        title="No webhook endpoints yet"
        description="Add an endpoint to receive HMAC-signed event deliveries. The signing secret is shown once."
        action={canManage ? <CreateWebhookDialog /> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <CreateWebhookDialog />
        </div>
      ) : null}

      <div className="space-y-3">
        {endpoints.map((endpoint) => {
          const pill = webhookEndpointPill(endpoint.disabledAt);
          return (
            <Section key={endpoint.reference}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{endpoint.url}</span>
                    <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {endpoint.enabledEvents.map((event) => (
                      <Badge key={event} variant="secondary" className="font-mono text-[10px]">
                        {event}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <Reference value={endpoint.reference} />
                    <span>Added {absoluteDate(endpoint.createdAt)}</span>
                    <span className="font-mono">{endpoint.signingSecretPrefix}…</span>
                  </div>
                </div>

                {canManage && !endpoint.disabledAt ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="sm" className="text-error-600">
                        Disable
                      </Button>
                    }
                    title="Disable this endpoint?"
                    description={
                      <>
                        We&apos;ll stop delivering events to{' '}
                        <span className="font-medium">{endpoint.url}</span>. In-flight deliveries are
                        skipped; history is preserved. You can add a new endpoint at any time.
                      </>
                    }
                    confirmLabel="Disable endpoint"
                    successMessage="Webhook endpoint disabled."
                    onConfirm={() => disableWebhookEndpointAction(endpoint.reference)}
                  />
                ) : null}
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
