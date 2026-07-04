'use client';

import { Code } from 'iconsax-react';

import { Button } from '@nombaone/ui/components/ui/button';
import type { ApiKeyScope } from '@nombaone/core-contracts/types';
import type { Mode } from '@nombaone/sara/context';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nombaone/ui/components/ui/table';
import { Badge } from '@nombaone/ui/components/ui/badge';

import { Reference } from '@/components/common/Reference';
import { StatusPill } from '@/components/common/StatusPill';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CreateApiKeyDialog } from '@/components/developers/CreateApiKeyDialog';
import { apiKeyPill } from '@/lib/status';
import { absoluteDate } from '@/lib/format';
import { revokeApiKeyAction } from '@/lib/developer-actions';

export interface ApiKeyView {
  reference: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  mode: Mode;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * API-keys list island. Renders the keys table (each row showing the masked
 * prefix, scopes, status, last-used), the create-key dialog, and a per-key
 * revoke confirm. All mutations go through `@/lib/developer-actions` (which
 * re-check RBAC + scope server-side); `canManage` only gates whether the
 * affordances render.
 */
export function ApiKeysClient({
  keys,
  canManage,
}: {
  keys: ApiKeyView[];
  canManage: boolean;
}) {
  if (keys.length === 0) {
    return (
      <EmptyState
        icon={Code}
        title="No API keys yet"
        description="Create a key to authenticate calls to the Nombaone public API. The secret is shown once."
        action={canManage ? <CreateApiKeyDialog /> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <CreateApiKeyDialog />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Key</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Scopes</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Last used</TableHead>
              {canManage ? <TableHead className="w-0" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => {
              const pill = apiKeyPill(key.revokedAt);
              return (
                <TableRow key={key.reference}>
                  <TableCell className="py-3 text-sm font-medium text-foreground">
                    {key.name}
                  </TableCell>
                  <TableCell className="py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                      {key.keyPrefix}…
                    </code>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="font-mono text-[10px]">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <StatusPill variant={pill.variant}>{pill.label}</StatusPill>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {key.lastUsedAt ? absoluteDate(key.lastUsedAt) : 'Never'}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="py-3 text-right">
                      {key.revokedAt ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm" className="text-error-600">
                              Revoke
                            </Button>
                          }
                          title="Revoke this API key?"
                          description={
                            <>
                              Any service using <Reference value={key.keyPrefix} copyable={false} />{' '}
                              will stop authenticating immediately. This can&apos;t be undone — you&apos;ll
                              need to create a new key.
                            </>
                          }
                          confirmLabel="Revoke key"
                          successMessage="API key revoked."
                          onConfirm={() => revokeApiKeyAction(key.reference)}
                        />
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
