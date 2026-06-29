import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { RailAdapter } from './types';

/**
 * A tiny registry so the core resolves a rail by key, never by hard-coded name.
 * Register your adapters once at boot; the billing core calls `getRail(key)`.
 */
const registry = new Map<string, RailAdapter>();

export const registerRail = (adapter: RailAdapter): void => {
  registry.set(adapter.key, adapter);
};

export const getRail = (key: string): RailAdapter => {
  const adapter = registry.get(key);
  if (!adapter) {
    throw AppError.BadRequest(
      `No rail registered for "${key}"`,
      { key },
      NOMBAONE_ERROR_CODES.RAIL_NOT_REGISTERED
    );
  }
  return adapter;
};

export const listRails = (): RailAdapter[] => Array.from(registry.values());
