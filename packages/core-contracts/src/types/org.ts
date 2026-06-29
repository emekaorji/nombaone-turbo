import type { Environment } from './common';

/** An organization = a tenant: the unit of isolation and settlement. */
export interface OrgResponseData {
  id: string; // public reference (the merchant-facing id)
  name: string;
  createdAt: string;
}

export type OrgUserRole = 'owner' | 'admin' | 'developer' | 'viewer';

export interface OrgUserResponseData {
  id: string;
  email: string;
  name: string;
  role: OrgUserRole;
  createdAt: string;
}

export interface SessionContext {
  organizationId: string;
  userId: string;
  environment: Environment;
}
