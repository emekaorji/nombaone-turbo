import type { ApiFieldErrors, NombaoneErrorCode } from '@nombaone/errors';

/**
 * The ONE response envelope every consumer parses. Discriminated on `success`;
 * `meta.requestId` is ALWAYS present (set from the request-id middleware). The
 * `data` type is the single source of truth — clients never define their own DTO.
 */
export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  statusCode: number;
  data: T;
  meta: ApiMeta;
}

export interface ApiPagination {
  limit: number;
  hasMore: boolean;
  /** Opaque cursor for the next page, or null when `hasMore` is false. */
  nextCursor: string | null;
}

export interface ApiPaginated<T> {
  success: true;
  statusCode: number;
  data: T[];
  pagination: ApiPagination;
  meta: ApiMeta;
}

export interface ApiError {
  success: false;
  statusCode: number;
  error: {
    code: NombaoneErrorCode;
    message: string;
    /** Actionable, plain-English guidance on exactly what to do next. Always present. */
    hint: string;
    /** Deep link to this code's entry in the public error reference. Always present. */
    docUrl: string;
    /** Per-field validation errors, present on 422 validation failures. */
    fields?: ApiFieldErrors;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export type ApiPaginatedResponse<T> = ApiPaginated<T> | ApiError;
