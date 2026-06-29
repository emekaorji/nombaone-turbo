import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

/**
 * Cursor pagination only — opaque cursor, clamped limit, NO total-count query.
 * The cursor encodes the keyset position (createdAt + id), matching the
 * `(org, env, created_at desc, id desc)` index.
 */
export interface Cursor {
  createdAt: string;
  id: string;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const clampLimit = (limit?: number): number => {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
};

export const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

export const decodeCursor = (raw?: string): Cursor | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed?.createdAt === 'string' && typeof parsed?.id === 'string') {
      return parsed as Cursor;
    }
  } catch {
    // fall through
  }
  throw AppError.BadRequest('Invalid cursor', { cursor: raw }, NOMBAONE_ERROR_CODES.INVALID_CURSOR);
};

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Given `limit + 1` rows fetched, slice to `limit` and derive the next cursor. */
export const buildPage = <T>(rows: T[], limit: number, toCursor: (row: T) => Cursor): Page<T> => {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  return {
    data,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
  };
};
