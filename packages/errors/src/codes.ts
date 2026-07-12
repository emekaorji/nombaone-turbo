export type ApiFieldErrors = Record<string, string[]>;

export const HTTP_SUCCESS_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
} as const;

export const HTTP_REDIRECT_STATUS_CODES = {
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
} as const;

export const HTTP_ERROR_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const HTTP_STATUS_CODES = {
  ...HTTP_SUCCESS_STATUS_CODES,
  ...HTTP_REDIRECT_STATUS_CODES,
  ...HTTP_ERROR_STATUS_CODES,
} as const;

/**
 * The central error-code enum, shared across every package and app (backend +
 * frontends). It is intentionally GENERIC platform vocabulary — there is no
 * billing-product code here (no plan/subscription/invoice/dunning codes). Add
 * domain codes alongside the domain you build.
 *
 * Naming family → meaning:
 *  - `CLIENT_*`        bad request shapes from an API caller
 *  - `API_KEY_*`       public-API authentication (the per-org secret key)
 *  - `AUTH_*`          console/operator session authentication
 *  - `ORG_*`/`MEMBER_*`identity & membership
 *  - `IDEMPOTENCY_*`   the idempotency state machine
 *  - `WEBHOOK_*`       inbound (provider→us) + outbound (us→tenant) webhooks
 *  - `LEDGER_*`        double-entry ledger invariants
 *  - `RAIL_*`          the payment-rail abstraction
 *  - `SYSTEM_*`        internal / upstream failures (the public fallback)
 *
 * Internal codes never leak: the error handler collapses anything not in
 * `PUBLIC_ERROR_CODES` to `SYSTEM_INTERNAL_ERROR` on the wire.
 */
export const NOMBAONE_ERROR_CODES = {
  // ---- Generic client request errors ----
  CLIENT_INVALID_REQUEST: 'CLIENT_INVALID_REQUEST',
  CLIENT_VALIDATION_FAILED: 'CLIENT_VALIDATION_FAILED',
  CLIENT_FORBIDDEN: 'CLIENT_FORBIDDEN',
  CLIENT_ROUTE_NOT_FOUND: 'CLIENT_ROUTE_NOT_FOUND',
  CLIENT_RESOURCE_NOT_FOUND: 'CLIENT_RESOURCE_NOT_FOUND',
  CLIENT_CONFLICT: 'CLIENT_CONFLICT',
  INVALID_CURSOR: 'INVALID_CURSOR',

  // ---- Public-API auth (per-org secret API key) ----
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_KEY_SCOPE_FORBIDDEN: 'API_KEY_SCOPE_FORBIDDEN',
  API_KEY_ENVIRONMENT_MISMATCH: 'API_KEY_ENVIRONMENT_MISMATCH',
  API_KEY_HOST_MISMATCH: 'API_KEY_HOST_MISMATCH',

  // ---- Console / operator session auth ----
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',
  AUTH_TOTP_REQUIRED: 'AUTH_TOTP_REQUIRED',
  AUTH_TOTP_INVALID: 'AUTH_TOTP_INVALID',
  AUTH_TOTP_NOT_ENROLLED: 'AUTH_TOTP_NOT_ENROLLED',
  AUTH_FORBIDDEN_ROLE: 'AUTH_FORBIDDEN_ROLE',
  AUTH_PASSWORD_INCORRECT: 'AUTH_PASSWORD_INCORRECT',
  AUTH_RESET_TOKEN_INVALID: 'AUTH_RESET_TOKEN_INVALID',

  // ---- Identity & membership ----
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  INVITE_INVALID: 'INVITE_INVALID',
  INVITE_EMAIL_ACTIVE: 'INVITE_EMAIL_ACTIVE',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  MEMBER_LAST_OWNER: 'MEMBER_LAST_OWNER',

  // ---- Idempotency state machine ----
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',

  // ---- Rate limiting ----
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // ---- Platform gate / maintenance ----
  PLATFORM_MAINTENANCE: 'PLATFORM_MAINTENANCE',

  // ---- Webhooks (inbound provider→us, outbound us→tenant) ----
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  WEBHOOK_DUPLICATE_EVENT: 'WEBHOOK_DUPLICATE_EVENT',
  WEBHOOK_RAW_BODY_MISSING: 'WEBHOOK_RAW_BODY_MISSING',
  WEBHOOK_ENDPOINT_NOT_FOUND: 'WEBHOOK_ENDPOINT_NOT_FOUND',
  WEBHOOK_EVENT_NOT_FOUND: 'WEBHOOK_EVENT_NOT_FOUND',

  // ---- Double-entry ledger ----
  LEDGER_TRANSACTION_UNBALANCED: 'LEDGER_TRANSACTION_UNBALANCED',
  LEDGER_INVALID_ENTRY: 'LEDGER_INVALID_ENTRY',
  LEDGER_ACCOUNT_NOT_FOUND: 'LEDGER_ACCOUNT_NOT_FOUND',
  LEDGER_TRANSACTION_NOT_FOUND: 'LEDGER_TRANSACTION_NOT_FOUND',
  LEDGER_TRANSACTION_ALREADY_REVERSED: 'LEDGER_TRANSACTION_ALREADY_REVERSED',
  LEDGER_INSUFFICIENT_FUNDS: 'LEDGER_INSUFFICIENT_FUNDS',

  // ---- Reconciliation ----
  RECONCILIATION_DRIFT_DETECTED: 'RECONCILIATION_DRIFT_DETECTED',

  // ---- Payment-rail abstraction ----
  RAIL_NOT_REGISTERED: 'RAIL_NOT_REGISTERED',
  RAIL_NOT_SUPPORTED: 'RAIL_NOT_SUPPORTED',

  // ---- Customers ----
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  CUSTOMER_EMAIL_TAKEN: 'CUSTOMER_EMAIL_TAKEN',

  // ---- Catalog: plans & prices ----
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  PLAN_NAME_TAKEN: 'PLAN_NAME_TAKEN',
  PLAN_ALREADY_ARCHIVED: 'PLAN_ALREADY_ARCHIVED',
  PLAN_HAS_ACTIVE_SUBSCRIBERS: 'PLAN_HAS_ACTIVE_SUBSCRIBERS',
  PRICE_NOT_FOUND: 'PRICE_NOT_FOUND',
  PRICE_PLAN_MISMATCH: 'PRICE_PLAN_MISMATCH',
  PRICE_IMMUTABLE: 'PRICE_IMMUTABLE',
  PRICE_ALREADY_INACTIVE: 'PRICE_ALREADY_INACTIVE',
  PRICE_TIERED_NOT_SUPPORTED: 'PRICE_TIERED_NOT_SUPPORTED',
  CATALOG_INVALID_INTERVAL: 'CATALOG_INVALID_INTERVAL',

  // ---- Payment methods, mandates & the Nomba provider ----
  PAYMENT_METHOD_NOT_FOUND: 'PAYMENT_METHOD_NOT_FOUND',
  PAYMENT_METHOD_NOT_ACTIVE: 'PAYMENT_METHOD_NOT_ACTIVE',
  PAYMENT_METHOD_KIND_MISMATCH: 'PAYMENT_METHOD_KIND_MISMATCH',
  MANDATE_NOT_ACTIVE: 'MANDATE_NOT_ACTIVE',
  MANDATE_MAX_AMOUNT_EXCEEDED: 'MANDATE_MAX_AMOUNT_EXCEEDED',
  MANDATE_CONSENT_PENDING: 'MANDATE_CONSENT_PENDING',
  NOMBA_REQUEST_FAILED: 'NOMBA_REQUEST_FAILED',
  NOMBA_UNAUTHORIZED: 'NOMBA_UNAUTHORIZED',
  NOMBA_SIGNATURE_INVALID: 'NOMBA_SIGNATURE_INVALID',

  // ---- Subscriptions & invoices ----
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_ILLEGAL_TRANSITION: 'SUBSCRIPTION_ILLEGAL_TRANSITION',
  SUBSCRIPTION_VERSION_CONFLICT: 'SUBSCRIPTION_VERSION_CONFLICT',
  SUBSCRIPTION_NOT_TERMINAL: 'SUBSCRIPTION_NOT_TERMINAL',
  SUBSCRIPTION_PAYMENT_METHOD_REQUIRED: 'SUBSCRIPTION_PAYMENT_METHOD_REQUIRED',
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_FINALIZED: 'INVOICE_ALREADY_FINALIZED',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  INVOICE_NOT_VOIDABLE: 'INVOICE_NOT_VOIDABLE',
  INVOICE_LINE_ITEMS_UNBALANCED: 'INVOICE_LINE_ITEMS_UNBALANCED',

  // ---- Billing scheduler & schedules (04) ----
  SUBSCRIPTION_SCHEDULE_NOT_FOUND: 'SUBSCRIPTION_SCHEDULE_NOT_FOUND',
  SUBSCRIPTION_SCHEDULE_CONFLICT: 'SUBSCRIPTION_SCHEDULE_CONFLICT',
  SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT: 'SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT',
  BILLING_CATCH_UP_LIMIT_EXCEEDED: 'BILLING_CATCH_UP_LIMIT_EXCEEDED',

  // ---- Invoicing adjustments (05): proration / coupons / discounts / credits ----
  PRORATION_NOT_APPLICABLE: 'PRORATION_NOT_APPLICABLE',
  PRORATION_PERIOD_INVALID: 'PRORATION_PERIOD_INVALID',
  PRORATION_DISTRIBUTION_UNBALANCED: 'PRORATION_DISTRIBUTION_UNBALANCED',
  PRORATION_INTERVAL_SWITCH_UNSUPPORTED: 'PRORATION_INTERVAL_SWITCH_UNSUPPORTED',
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_MAX_REDEMPTIONS_REACHED: 'COUPON_MAX_REDEMPTIONS_REACHED',
  COUPON_INVALID_DEFINITION: 'COUPON_INVALID_DEFINITION',
  COUPON_ALREADY_APPLIED: 'COUPON_ALREADY_APPLIED',
  DISCOUNT_NOT_FOUND: 'DISCOUNT_NOT_FOUND',
  CREDIT_GRANT_NOT_FOUND: 'CREDIT_GRANT_NOT_FOUND',
  CREDIT_GRANT_ALREADY_VOIDED: 'CREDIT_GRANT_ALREADY_VOIDED',
  CREDIT_INSUFFICIENT_BALANCE: 'CREDIT_INSUFFICIENT_BALANCE',
  CREDIT_INVALID_AMOUNT: 'CREDIT_INVALID_AMOUNT',
  INVOICE_NOT_BALANCED: 'INVOICE_NOT_BALANCED',

  // ---- Multi-tenancy & settlement (08) ----
  SETTLEMENT_SUBACCOUNT_NOT_FOUND: 'SETTLEMENT_SUBACCOUNT_NOT_FOUND',
  SETTLEMENT_SPLIT_UNBALANCED: 'SETTLEMENT_SPLIT_UNBALANCED',
  SETTLEMENT_ALREADY_RECORDED: 'SETTLEMENT_ALREADY_RECORDED',
  SETTLEMENT_NOT_FOUND: 'SETTLEMENT_NOT_FOUND',
  SETTLEMENT_PAYOUT_FAILED: 'SETTLEMENT_PAYOUT_FAILED',
  SETTLEMENT_RECONCILE_DRIFT: 'SETTLEMENT_RECONCILE_DRIFT',
  REFUND_ALREADY_REFUNDED: 'REFUND_ALREADY_REFUNDED',
  REFUND_AMOUNT_EXCEEDS_NET: 'REFUND_AMOUNT_EXCEEDS_NET',
  ESCROW_LOCKED: 'ESCROW_LOCKED',
  PAYOUT_EXCEEDS_AVAILABLE: 'PAYOUT_EXCEEDS_AVAILABLE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // ---- Dunning & recovery (06) ----
  DUNNING_SETTINGS_INVALID: 'DUNNING_SETTINGS_INVALID',
  DUNNING_NO_OPEN_INVOICE: 'DUNNING_NO_OPEN_INVOICE',
  DUNNING_ALREADY_TERMINAL: 'DUNNING_ALREADY_TERMINAL',
  DUNNING_ATTEMPT_NOT_FOUND: 'DUNNING_ATTEMPT_NOT_FOUND',
  DUNNING_CARD_UPDATE_REQUIRED: 'DUNNING_CARD_UPDATE_REQUIRED',
  DUNNING_NOT_IN_PROGRESS: 'DUNNING_NOT_IN_PROGRESS',

  // ---- The deletable example slice (delete with the example) ----
  EXAMPLE_NOT_FOUND: 'EXAMPLE_NOT_FOUND',

  // ---- Internal / upstream (public fallbacks) ----
  SYSTEM_INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR',
  SYSTEM_UPSTREAM_ERROR: 'SYSTEM_UPSTREAM_ERROR',
} as const;

export type HttpSuccessStatusCode =
  (typeof HTTP_SUCCESS_STATUS_CODES)[keyof typeof HTTP_SUCCESS_STATUS_CODES];
export type HttpRedirectStatusCode =
  (typeof HTTP_REDIRECT_STATUS_CODES)[keyof typeof HTTP_REDIRECT_STATUS_CODES];
export type HttpErrorStatusCode =
  (typeof HTTP_ERROR_STATUS_CODES)[keyof typeof HTTP_ERROR_STATUS_CODES];

export type NombaoneErrorCode = (typeof NOMBAONE_ERROR_CODES)[keyof typeof NOMBAONE_ERROR_CODES];

export const getDefaultNombaoneErrorCodeForStatus = (
  status: HttpErrorStatusCode
): NombaoneErrorCode => {
  switch (status) {
    case HTTP_STATUS_CODES.BAD_REQUEST:
      return NOMBAONE_ERROR_CODES.CLIENT_INVALID_REQUEST;
    case HTTP_STATUS_CODES.UNAUTHORIZED:
      return NOMBAONE_ERROR_CODES.API_KEY_INVALID;
    case HTTP_STATUS_CODES.FORBIDDEN:
      return NOMBAONE_ERROR_CODES.CLIENT_FORBIDDEN;
    case HTTP_STATUS_CODES.NOT_FOUND:
      return NOMBAONE_ERROR_CODES.CLIENT_RESOURCE_NOT_FOUND;
    case HTTP_STATUS_CODES.CONFLICT:
      return NOMBAONE_ERROR_CODES.CLIENT_CONFLICT;
    case HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY:
      return NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED;
    case HTTP_STATUS_CODES.TOO_MANY_REQUESTS:
      return NOMBAONE_ERROR_CODES.RATE_LIMIT_EXCEEDED;
    case HTTP_STATUS_CODES.BAD_GATEWAY:
    case HTTP_STATUS_CODES.SERVICE_UNAVAILABLE:
    case HTTP_STATUS_CODES.GATEWAY_TIMEOUT:
      return NOMBAONE_ERROR_CODES.SYSTEM_UPSTREAM_ERROR;
    case HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR:
    default:
      return NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR;
  }
};

/**
 * Codes safe to expose on the public API wire. Anything NOT here is collapsed to
 * `SYSTEM_INTERNAL_ERROR` by the error handler so internal detail never leaks.
 */
export const PUBLIC_ERROR_CODES: ReadonlySet<NombaoneErrorCode> = new Set([
  NOMBAONE_ERROR_CODES.CLIENT_INVALID_REQUEST,
  NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED,
  NOMBAONE_ERROR_CODES.CLIENT_FORBIDDEN,
  NOMBAONE_ERROR_CODES.CLIENT_ROUTE_NOT_FOUND,
  NOMBAONE_ERROR_CODES.CLIENT_RESOURCE_NOT_FOUND,
  NOMBAONE_ERROR_CODES.CLIENT_CONFLICT,
  NOMBAONE_ERROR_CODES.INVALID_CURSOR,
  NOMBAONE_ERROR_CODES.API_KEY_MISSING,
  NOMBAONE_ERROR_CODES.API_KEY_INVALID,
  NOMBAONE_ERROR_CODES.API_KEY_SCOPE_FORBIDDEN,
  NOMBAONE_ERROR_CODES.API_KEY_ENVIRONMENT_MISMATCH,
  NOMBAONE_ERROR_CODES.API_KEY_HOST_MISMATCH,
  NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_MISSING,
  NOMBAONE_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
  NOMBAONE_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
  NOMBAONE_ERROR_CODES.RATE_LIMIT_EXCEEDED,
  NOMBAONE_ERROR_CODES.PLATFORM_MAINTENANCE,
  NOMBAONE_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
  NOMBAONE_ERROR_CODES.CUSTOMER_NOT_FOUND,
  NOMBAONE_ERROR_CODES.CUSTOMER_EMAIL_TAKEN,
  NOMBAONE_ERROR_CODES.PLAN_NOT_FOUND,
  NOMBAONE_ERROR_CODES.PLAN_NAME_TAKEN,
  NOMBAONE_ERROR_CODES.PLAN_ALREADY_ARCHIVED,
  NOMBAONE_ERROR_CODES.PLAN_HAS_ACTIVE_SUBSCRIBERS,
  NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND,
  NOMBAONE_ERROR_CODES.PRICE_PLAN_MISMATCH,
  NOMBAONE_ERROR_CODES.PRICE_ALREADY_INACTIVE,
  NOMBAONE_ERROR_CODES.PRICE_TIERED_NOT_SUPPORTED,
  NOMBAONE_ERROR_CODES.PAYMENT_METHOD_NOT_FOUND,
  NOMBAONE_ERROR_CODES.PAYMENT_METHOD_NOT_ACTIVE,
  NOMBAONE_ERROR_CODES.PAYMENT_METHOD_KIND_MISMATCH,
  NOMBAONE_ERROR_CODES.MANDATE_NOT_ACTIVE,
  NOMBAONE_ERROR_CODES.MANDATE_MAX_AMOUNT_EXCEEDED,
  NOMBAONE_ERROR_CODES.MANDATE_CONSENT_PENDING,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_ILLEGAL_TRANSITION,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_VERSION_CONFLICT,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_TERMINAL,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_PAYMENT_METHOD_REQUIRED,
  NOMBAONE_ERROR_CODES.INVOICE_NOT_FOUND,
  NOMBAONE_ERROR_CODES.INVOICE_ALREADY_FINALIZED,
  NOMBAONE_ERROR_CODES.INVOICE_ALREADY_PAID,
  NOMBAONE_ERROR_CODES.INVOICE_NOT_VOIDABLE,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_SCHEDULE_NOT_FOUND,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_SCHEDULE_CONFLICT,
  NOMBAONE_ERROR_CODES.SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT,
  NOMBAONE_ERROR_CODES.PRORATION_NOT_APPLICABLE,
  NOMBAONE_ERROR_CODES.PRORATION_INTERVAL_SWITCH_UNSUPPORTED,
  NOMBAONE_ERROR_CODES.COUPON_NOT_FOUND,
  NOMBAONE_ERROR_CODES.COUPON_EXPIRED,
  NOMBAONE_ERROR_CODES.COUPON_MAX_REDEMPTIONS_REACHED,
  NOMBAONE_ERROR_CODES.COUPON_INVALID_DEFINITION,
  NOMBAONE_ERROR_CODES.COUPON_ALREADY_APPLIED,
  NOMBAONE_ERROR_CODES.DISCOUNT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.CREDIT_GRANT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.CREDIT_GRANT_ALREADY_VOIDED,
  NOMBAONE_ERROR_CODES.CREDIT_INSUFFICIENT_BALANCE,
  NOMBAONE_ERROR_CODES.CREDIT_INVALID_AMOUNT,
  NOMBAONE_ERROR_CODES.DUNNING_NO_OPEN_INVOICE,
  NOMBAONE_ERROR_CODES.DUNNING_ATTEMPT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.DUNNING_CARD_UPDATE_REQUIRED,
  NOMBAONE_ERROR_CODES.DUNNING_ALREADY_TERMINAL,
  NOMBAONE_ERROR_CODES.SETTLEMENT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.SETTLEMENT_SUBACCOUNT_NOT_FOUND,
  NOMBAONE_ERROR_CODES.REFUND_ALREADY_REFUNDED,
  NOMBAONE_ERROR_CODES.REFUND_AMOUNT_EXCEEDS_NET,
  NOMBAONE_ERROR_CODES.ESCROW_LOCKED,
  NOMBAONE_ERROR_CODES.PAYOUT_EXCEEDS_AVAILABLE,
  NOMBAONE_ERROR_CODES.QUOTA_EXCEEDED,
  NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND,
  NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR,
  NOMBAONE_ERROR_CODES.SYSTEM_UPSTREAM_ERROR,
]);

export const toPublicErrorCode = (code: NombaoneErrorCode): NombaoneErrorCode =>
  PUBLIC_ERROR_CODES.has(code) ? code : NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR;

/**
 * Single source of truth for the error-reference base URL. Every `docUrl` is
 * this base plus a `#<CODE>` anchor, so the docs site can host one page per code
 * (or one page with per-code anchors) and every API response deep-links to it.
 */
export const DOCS_ERRORS_BASE = 'https://docs.nombaone.xyz/errors';

/**
 * Developer-facing guidance attached to every error code (tenet 9 — "errors are
 * a feature"). Surfaced on the wire in the error envelope so an integrator can
 * fix the problem without leaving the response.
 */
export interface ErrorCodeMeta {
  /** A specific, actionable sentence telling the caller exactly what to do next. */
  hint: string;
  /** Deep link to this code's entry in the public error reference. */
  docUrl: string;
}

/**
 * One entry per code in {@link NOMBAONE_ERROR_CODES}. The `Record<NombaoneErrorCode, …>`
 * key type makes this map EXHAUSTIVE: add a code without meta here and this file
 * fails type-check. `hint` is written in a plain-English, do-this-next voice;
 * `docUrl` deep-links to the code's anchor on the error reference.
 */
export const ERROR_CODE_META: Record<NombaoneErrorCode, ErrorCodeMeta> = {
  // ---- Generic client request errors ----
  CLIENT_INVALID_REQUEST: {
    hint: 'The request could not be understood. Check the method, path, headers, and that the JSON body is well-formed before retrying.',
    docUrl: `${DOCS_ERRORS_BASE}#CLIENT_INVALID_REQUEST`,
  },
  CLIENT_VALIDATION_FAILED: {
    hint: 'One or more fields are invalid. Read the `fields` map in this response — each key is a field path and its messages tell you exactly what to fix.',
    docUrl: `${DOCS_ERRORS_BASE}#CLIENT_VALIDATION_FAILED`,
  },
  CLIENT_FORBIDDEN: {
    hint: 'Your key is valid but not allowed to perform this action. Confirm the resource belongs to your organization and that your key has the required scope.',
    docUrl: `${DOCS_ERRORS_BASE}#CLIENT_FORBIDDEN`,
  },
  CLIENT_ROUTE_NOT_FOUND: {
    hint: 'No route matches this method and path. Check the HTTP verb and the URL (including the `/v1` version prefix) against the API reference.',
    docUrl: `${DOCS_ERRORS_BASE}#CLIENT_ROUTE_NOT_FOUND`,
  },
  CLIENT_RESOURCE_NOT_FOUND: {
    hint: 'No resource exists at that id in this mode. Verify the id and confirm your key targets the same mode (sandbox vs live) the resource lives in.',
    docUrl: `${DOCS_ERRORS_BASE}#CLIENT_RESOURCE_NOT_FOUND`,
  },
  CLIENT_CONFLICT: {
    hint: 'This request conflicts with the current state of the resource. Re-fetch it to see its latest state, then retry with values consistent with that state.',
    docUrl: `${DOCS_ERRORS_BASE}#CLIENT_CONFLICT`,
  },
  INVALID_CURSOR: {
    hint: 'The pagination `cursor` is malformed or expired. Drop the `cursor` to start from the first page, then page forward using only the `nextCursor` values we return.',
    docUrl: `${DOCS_ERRORS_BASE}#INVALID_CURSOR`,
  },

  // ---- Public-API auth (per-org secret API key) ----
  API_KEY_MISSING: {
    hint: 'Send your secret key as `Authorization: Bearer <key>`. Create one in the dashboard under API keys if you do not have it.',
    docUrl: `${DOCS_ERRORS_BASE}#API_KEY_MISSING`,
  },
  API_KEY_INVALID: {
    hint: 'That key is not recognized. Copy it fresh from the dashboard (it may have been rotated or revoked) and send the whole `nbo_sandbox_`/`nbo_live_` string with no extra whitespace.',
    docUrl: `${DOCS_ERRORS_BASE}#API_KEY_INVALID`,
  },
  API_KEY_SCOPE_FORBIDDEN: {
    hint: 'Your key lacks the scope this endpoint needs. Grant the required scope (e.g. `customers:write`) to the key in the dashboard, or use a key that already has it.',
    docUrl: `${DOCS_ERRORS_BASE}#API_KEY_SCOPE_FORBIDDEN`,
  },
  API_KEY_ENVIRONMENT_MISMATCH: {
    hint: 'A `nbo_live_` key is only accepted on the production deployment. Use your `nbo_sandbox_` key to build against sandbox, and switch to the `nbo_live_` key once you go live in production.',
    docUrl: `${DOCS_ERRORS_BASE}#API_KEY_ENVIRONMENT_MISMATCH`,
  },
  API_KEY_HOST_MISMATCH: {
    hint: 'Your key\'s mode does not match the host you called. Send `nbo_sandbox_` keys to the sandbox host and `nbo_live_` keys to the live host — the base URL and the key prefix must agree.',
    docUrl: `${DOCS_ERRORS_BASE}#API_KEY_HOST_MISMATCH`,
  },

  // ---- Console / operator session auth ----
  AUTH_INVALID_CREDENTIALS: {
    hint: 'The email or password is incorrect. Re-enter them, or use the password-reset flow if you are unsure of the password.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_INVALID_CREDENTIALS`,
  },
  AUTH_EMAIL_TAKEN: {
    hint: 'An account already exists for this email. Sign in instead, or use the password-reset flow to recover access.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_EMAIL_TAKEN`,
  },
  AUTH_SESSION_INVALID: {
    hint: 'Your session has expired or been revoked. Sign in again to obtain a fresh session.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_SESSION_INVALID`,
  },
  AUTH_TOTP_REQUIRED: {
    hint: 'This account has two-factor auth enabled. Submit the current 6-digit code from your authenticator app to complete sign-in.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_TOTP_REQUIRED`,
  },
  AUTH_TOTP_INVALID: {
    hint: 'That authenticator code was wrong or already used. Wait for the next code and try again; if it keeps failing, confirm your device clock is accurate.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_TOTP_INVALID`,
  },
  AUTH_TOTP_NOT_ENROLLED: {
    hint: 'Two-factor auth is not set up on this account. Enroll an authenticator in security settings before using a TOTP-protected action.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_TOTP_NOT_ENROLLED`,
  },
  AUTH_FORBIDDEN_ROLE: {
    hint: 'Your member role does not permit this action. Ask an organization owner or admin to perform it, or to grant you a higher role.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_FORBIDDEN_ROLE`,
  },
  AUTH_PASSWORD_INCORRECT: {
    hint: 'The current password you entered does not match. Re-enter it; use password reset if you have forgotten it.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_PASSWORD_INCORRECT`,
  },
  AUTH_RESET_TOKEN_INVALID: {
    hint: 'This password-reset link is invalid or has expired. Request a new reset email and use the most recent link.',
    docUrl: `${DOCS_ERRORS_BASE}#AUTH_RESET_TOKEN_INVALID`,
  },

  // ---- Identity & membership ----
  ORG_NOT_FOUND: {
    hint: 'No organization matches that id. Check the id, and confirm your session or key belongs to that organization.',
    docUrl: `${DOCS_ERRORS_BASE}#ORG_NOT_FOUND`,
  },
  INVITE_INVALID: {
    hint: 'This invite is invalid, already used, or expired. Ask an organization admin to send you a fresh invitation.',
    docUrl: `${DOCS_ERRORS_BASE}#INVITE_INVALID`,
  },
  INVITE_EMAIL_ACTIVE: {
    hint: 'This email is already an active member of the organization. There is nothing to accept — sign in with that account instead.',
    docUrl: `${DOCS_ERRORS_BASE}#INVITE_EMAIL_ACTIVE`,
  },
  MEMBER_NOT_FOUND: {
    hint: 'No member with that id exists in this organization. Verify the member id, or list members to find the correct one.',
    docUrl: `${DOCS_ERRORS_BASE}#MEMBER_NOT_FOUND`,
  },
  MEMBER_LAST_OWNER: {
    hint: 'You cannot remove or demote the only remaining owner. Promote another member to owner first, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#MEMBER_LAST_OWNER`,
  },

  // ---- Idempotency state machine ----
  IDEMPOTENCY_KEY_MISSING: {
    hint: 'Send a unique `Idempotency-Key` header on this request; reuse the same key to safely retry the same operation.',
    docUrl: `${DOCS_ERRORS_BASE}#IDEMPOTENCY_KEY_MISSING`,
  },
  IDEMPOTENCY_KEY_REUSED: {
    hint: 'You reused an `Idempotency-Key` with a different request body. Use a new key for a new operation, or resend the identical body to replay the original result.',
    docUrl: `${DOCS_ERRORS_BASE}#IDEMPOTENCY_KEY_REUSED`,
  },
  IDEMPOTENCY_IN_PROGRESS: {
    hint: 'A request with this `Idempotency-Key` is still being processed. Wait briefly and retry with the same key to get the final result.',
    docUrl: `${DOCS_ERRORS_BASE}#IDEMPOTENCY_IN_PROGRESS`,
  },

  // ---- Rate limiting ----
  RATE_LIMIT_EXCEEDED: {
    hint: "You're sending requests too quickly. Back off and retry after the interval in the `Retry-After` header.",
    docUrl: `${DOCS_ERRORS_BASE}#RATE_LIMIT_EXCEEDED`,
  },

  // ---- Platform gate / maintenance ----
  PLATFORM_MAINTENANCE: {
    hint: 'The platform is briefly paused for maintenance and is rejecting writes. Reads still work; retry your write after a short wait.',
    docUrl: `${DOCS_ERRORS_BASE}#PLATFORM_MAINTENANCE`,
  },

  // ---- Webhooks (inbound provider→us, outbound us→tenant) ----
  WEBHOOK_SIGNATURE_INVALID: {
    hint: 'The webhook signature did not verify. Confirm you are using the correct signing secret for this endpoint and verifying against the exact raw request body (no re-serialization).',
    docUrl: `${DOCS_ERRORS_BASE}#WEBHOOK_SIGNATURE_INVALID`,
  },
  WEBHOOK_DUPLICATE_EVENT: {
    hint: 'This event id has already been received and processed. Treat it as a duplicate and acknowledge it without reprocessing — webhook delivery is at-least-once.',
    docUrl: `${DOCS_ERRORS_BASE}#WEBHOOK_DUPLICATE_EVENT`,
  },
  WEBHOOK_RAW_BODY_MISSING: {
    hint: 'The raw request body was not available to verify the signature. Ensure the raw body is preserved (do not let a JSON parser consume it before signature checking).',
    docUrl: `${DOCS_ERRORS_BASE}#WEBHOOK_RAW_BODY_MISSING`,
  },
  WEBHOOK_ENDPOINT_NOT_FOUND: {
    hint: 'No webhook endpoint matches that id. List your endpoints to find the correct id, or create the endpoint first.',
    docUrl: `${DOCS_ERRORS_BASE}#WEBHOOK_ENDPOINT_NOT_FOUND`,
  },
  WEBHOOK_EVENT_NOT_FOUND: {
    hint: 'No webhook event exists with that id. Check the id, or list recent events to find the delivery you meant to inspect or replay.',
    docUrl: `${DOCS_ERRORS_BASE}#WEBHOOK_EVENT_NOT_FOUND`,
  },

  // ---- Double-entry ledger ----
  LEDGER_TRANSACTION_UNBALANCED: {
    hint: 'A ledger transaction was rejected because its debits and credits did not sum to zero. This is an internal invariant — retry the operation; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#LEDGER_TRANSACTION_UNBALANCED`,
  },
  LEDGER_INVALID_ENTRY: {
    hint: 'A ledger entry was malformed (bad account, direction, or amount). This is an internal invariant — retry; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#LEDGER_INVALID_ENTRY`,
  },
  LEDGER_ACCOUNT_NOT_FOUND: {
    hint: 'A referenced ledger account does not exist. This is an internal bookkeeping error — retry; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#LEDGER_ACCOUNT_NOT_FOUND`,
  },
  LEDGER_TRANSACTION_NOT_FOUND: {
    hint: 'The referenced ledger transaction could not be found. This is an internal bookkeeping error — retry; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#LEDGER_TRANSACTION_NOT_FOUND`,
  },
  LEDGER_TRANSACTION_ALREADY_REVERSED: {
    hint: 'This ledger transaction has already been reversed and cannot be reversed again. No action is needed; inspect the transaction to see its existing reversal.',
    docUrl: `${DOCS_ERRORS_BASE}#LEDGER_TRANSACTION_ALREADY_REVERSED`,
  },
  LEDGER_INSUFFICIENT_FUNDS: {
    hint: 'The account balance is too low for this ledger movement. Fund or settle the account first, or reduce the amount, before retrying.',
    docUrl: `${DOCS_ERRORS_BASE}#LEDGER_INSUFFICIENT_FUNDS`,
  },

  // ---- Reconciliation ----
  RECONCILIATION_DRIFT_DETECTED: {
    hint: 'Our ledger and the provider disagree on a balance. Processing was halted to protect your money — no action from you; support is alerted, contact them with the `requestId` if urgent.',
    docUrl: `${DOCS_ERRORS_BASE}#RECONCILIATION_DRIFT_DETECTED`,
  },

  // ---- Payment-rail abstraction ----
  RAIL_NOT_REGISTERED: {
    hint: 'The requested payment rail is not configured on this deployment. This is a server configuration gap — contact support with the rail you need and the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#RAIL_NOT_REGISTERED`,
  },
  RAIL_NOT_SUPPORTED: {
    hint: 'This operation is not supported on the selected payment rail. Choose a rail that supports it, or check the docs for which rails support this action.',
    docUrl: `${DOCS_ERRORS_BASE}#RAIL_NOT_SUPPORTED`,
  },

  // ---- Customers ----
  CUSTOMER_NOT_FOUND: {
    hint: 'No customer exists with that id in this mode. Check the id, and confirm you are using the key for the same mode (sandbox vs live) the customer was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#CUSTOMER_NOT_FOUND`,
  },
  CUSTOMER_EMAIL_TAKEN: {
    hint: 'A customer with this email already exists in your organization. Reuse the existing customer, or create this one with a different email.',
    docUrl: `${DOCS_ERRORS_BASE}#CUSTOMER_EMAIL_TAKEN`,
  },

  // ---- Catalog: plans & prices ----
  PLAN_NOT_FOUND: {
    hint: 'No plan exists with that id in this environment. Verify the plan id, and that your key matches the environment the plan was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#PLAN_NOT_FOUND`,
  },
  PLAN_NAME_TAKEN: {
    hint: 'A plan with this name already exists in your organization. Pick a different name, or update the existing plan instead of creating a new one.',
    docUrl: `${DOCS_ERRORS_BASE}#PLAN_NAME_TAKEN`,
  },
  PLAN_ALREADY_ARCHIVED: {
    hint: 'This plan is already archived, so it cannot be archived or modified again. Unarchive it first if you need to change it.',
    docUrl: `${DOCS_ERRORS_BASE}#PLAN_ALREADY_ARCHIVED`,
  },
  PLAN_HAS_ACTIVE_SUBSCRIBERS: {
    hint: 'You cannot archive or delete a plan that still has active subscriptions. Migrate or cancel those subscriptions first, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#PLAN_HAS_ACTIVE_SUBSCRIBERS`,
  },
  PRICE_NOT_FOUND: {
    hint: 'No price exists with that id in this environment. Check the price id, and that your key matches the environment it was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#PRICE_NOT_FOUND`,
  },
  PRICE_PLAN_MISMATCH: {
    hint: 'That price does not belong to the plan you referenced. Use a price that belongs to this plan, or reference the plan the price actually belongs to.',
    docUrl: `${DOCS_ERRORS_BASE}#PRICE_PLAN_MISMATCH`,
  },
  PRICE_IMMUTABLE: {
    hint: 'Prices are immutable once created to keep billing history stable. Create a new price and deactivate the old one instead of editing it.',
    docUrl: `${DOCS_ERRORS_BASE}#PRICE_IMMUTABLE`,
  },
  PRICE_ALREADY_INACTIVE: {
    hint: 'This price is already inactive. No action is needed; create a new active price if you need one to subscribe against.',
    docUrl: `${DOCS_ERRORS_BASE}#PRICE_ALREADY_INACTIVE`,
  },
  PRICE_TIERED_NOT_SUPPORTED: {
    hint: 'Tiered/graduated pricing is not supported here. Use a flat per-unit price for this operation.',
    docUrl: `${DOCS_ERRORS_BASE}#PRICE_TIERED_NOT_SUPPORTED`,
  },
  CATALOG_INVALID_INTERVAL: {
    hint: 'The billing interval is not valid. Use one of the supported intervals (`minute`, `day`, `week`, `month`, `year`) with a positive interval count — the count multiplies the unit, so `minute` × 10 bills every ten minutes and `month` × 3 bills quarterly.',
    docUrl: `${DOCS_ERRORS_BASE}#CATALOG_INVALID_INTERVAL`,
  },

  // ---- Payment methods, mandates & the Nomba provider ----
  PAYMENT_METHOD_NOT_FOUND: {
    hint: 'No payment method exists with that id for this customer. Verify the id, and that it belongs to the customer and environment you are calling with.',
    docUrl: `${DOCS_ERRORS_BASE}#PAYMENT_METHOD_NOT_FOUND`,
  },
  PAYMENT_METHOD_NOT_ACTIVE: {
    hint: 'This payment method is not active (it may be pending, expired, or detached). Have the customer re-authorize or add a new payment method before charging.',
    docUrl: `${DOCS_ERRORS_BASE}#PAYMENT_METHOD_NOT_ACTIVE`,
  },
  PAYMENT_METHOD_KIND_MISMATCH: {
    hint: 'This operation needs a different kind of payment method than the one provided (e.g. a card where a bank mandate was given). Supply a payment method of the required kind.',
    docUrl: `${DOCS_ERRORS_BASE}#PAYMENT_METHOD_KIND_MISMATCH`,
  },
  MANDATE_NOT_ACTIVE: {
    hint: 'The mandate is not active yet (or has been revoked), so it cannot be charged. Wait for the customer to authorize it, or start a new mandate.',
    docUrl: `${DOCS_ERRORS_BASE}#MANDATE_NOT_ACTIVE`,
  },
  MANDATE_MAX_AMOUNT_EXCEEDED: {
    hint: "The charge is larger than the mandate's authorized maximum. Lower the amount, or have the customer authorize a new mandate with a higher limit.",
    docUrl: `${DOCS_ERRORS_BASE}#MANDATE_MAX_AMOUNT_EXCEEDED`,
  },
  MANDATE_CONSENT_PENDING: {
    hint: 'The customer has not finished authorizing this mandate. Send them back through the consent link and wait for the activation webhook before charging.',
    docUrl: `${DOCS_ERRORS_BASE}#MANDATE_CONSENT_PENDING`,
  },
  NOMBA_REQUEST_FAILED: {
    hint: 'The Nomba provider rejected or failed the request. Retry shortly; if it persists, check the Nomba status and contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#NOMBA_REQUEST_FAILED`,
  },
  NOMBA_UNAUTHORIZED: {
    hint: 'Our credentials for the Nomba provider were rejected. This is a server-side configuration issue — contact support with the `requestId`; there is nothing to change in your request.',
    docUrl: `${DOCS_ERRORS_BASE}#NOMBA_UNAUTHORIZED`,
  },
  NOMBA_SIGNATURE_INVALID: {
    hint: 'A callback from Nomba failed signature verification and was rejected. If you are replaying a webhook, resend the untouched original payload; otherwise this may be a spoofed request that was safely ignored.',
    docUrl: `${DOCS_ERRORS_BASE}#NOMBA_SIGNATURE_INVALID`,
  },

  // ---- Subscriptions & invoices ----
  SUBSCRIPTION_NOT_FOUND: {
    hint: 'No subscription exists with that id in this environment. Check the id, and that your key matches the environment it was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_NOT_FOUND`,
  },
  SUBSCRIPTION_ILLEGAL_TRANSITION: {
    hint: 'The subscription cannot move to that state from its current one (e.g. resuming a canceled subscription). Re-fetch it to see its current status and choose a valid action.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_ILLEGAL_TRANSITION`,
  },
  SUBSCRIPTION_VERSION_CONFLICT: {
    hint: 'The subscription changed since you loaded it (optimistic-concurrency conflict). Re-fetch it, reapply your change on the latest version, and retry.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_VERSION_CONFLICT`,
  },
  SUBSCRIPTION_NOT_TERMINAL: {
    hint: 'This action requires the subscription to be in a terminal state (e.g. canceled). Cancel or end it first, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_NOT_TERMINAL`,
  },
  SUBSCRIPTION_PAYMENT_METHOD_REQUIRED: {
    hint: 'This subscription needs a usable payment method before it can be billed. Attach an active card or authorized mandate to the customer, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_PAYMENT_METHOD_REQUIRED`,
  },
  INVOICE_NOT_FOUND: {
    hint: 'No invoice exists with that id in this environment. Verify the id, and that your key matches the environment it was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#INVOICE_NOT_FOUND`,
  },
  INVOICE_ALREADY_FINALIZED: {
    hint: 'This invoice is already finalized and its line items are locked. Issue a credit note or a new invoice instead of editing this one.',
    docUrl: `${DOCS_ERRORS_BASE}#INVOICE_ALREADY_FINALIZED`,
  },
  INVOICE_ALREADY_PAID: {
    hint: 'This invoice is already paid, so it cannot be paid or voided again. If you need to reverse it, issue a refund against the payment.',
    docUrl: `${DOCS_ERRORS_BASE}#INVOICE_ALREADY_PAID`,
  },
  INVOICE_NOT_VOIDABLE: {
    hint: 'Only open, unpaid invoices can be voided. Because this invoice is paid or already void, issue a refund or credit note instead.',
    docUrl: `${DOCS_ERRORS_BASE}#INVOICE_NOT_VOIDABLE`,
  },
  INVOICE_LINE_ITEMS_UNBALANCED: {
    hint: 'The invoice line items do not sum to the invoice total. This is an internal invariant — retry; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#INVOICE_LINE_ITEMS_UNBALANCED`,
  },

  // ---- Billing scheduler & schedules (04) ----
  SUBSCRIPTION_SCHEDULE_NOT_FOUND: {
    hint: 'No subscription schedule exists with that id. Check the id, or list schedules on the subscription to find the correct one.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_SCHEDULE_NOT_FOUND`,
  },
  SUBSCRIPTION_SCHEDULE_CONFLICT: {
    hint: 'This schedule overlaps or conflicts with an existing one on the subscription. Cancel or adjust the conflicting schedule, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_SCHEDULE_CONFLICT`,
  },
  SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT: {
    hint: "The schedule's `effectiveAt` is invalid — it must be in the future and align with the billing cycle. Choose a valid future timestamp and retry.",
    docUrl: `${DOCS_ERRORS_BASE}#SUBSCRIPTION_SCHEDULE_INVALID_EFFECTIVE_AT`,
  },
  BILLING_CATCH_UP_LIMIT_EXCEEDED: {
    hint: 'Too many billing periods are overdue to catch up in one run (a safety cap against runaway backfills). Advance the subscription in smaller steps, or contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#BILLING_CATCH_UP_LIMIT_EXCEEDED`,
  },

  // ---- Invoicing adjustments (05): proration / coupons / discounts / credits ----
  PRORATION_NOT_APPLICABLE: {
    hint: 'Proration does not apply to this change (for example, no mid-cycle difference to prorate). Proceed without proration, or verify the change you intended.',
    docUrl: `${DOCS_ERRORS_BASE}#PRORATION_NOT_APPLICABLE`,
  },
  PRORATION_PERIOD_INVALID: {
    hint: 'The proration period is invalid — its start must be before its end and within the current billing cycle. Correct the dates and retry.',
    docUrl: `${DOCS_ERRORS_BASE}#PRORATION_PERIOD_INVALID`,
  },
  PRORATION_DISTRIBUTION_UNBALANCED: {
    hint: 'Prorated amounts did not sum to the expected total. This is an internal rounding invariant — retry; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#PRORATION_DISTRIBUTION_UNBALANCED`,
  },
  PRORATION_INTERVAL_SWITCH_UNSUPPORTED: {
    hint: 'Prorating across a change of billing interval (e.g. monthly to yearly) is not supported. Schedule the interval change at the next period boundary instead.',
    docUrl: `${DOCS_ERRORS_BASE}#PRORATION_INTERVAL_SWITCH_UNSUPPORTED`,
  },
  COUPON_NOT_FOUND: {
    hint: 'No coupon matches that id or code in this environment. Check the code for typos and that your key matches the environment the coupon was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#COUPON_NOT_FOUND`,
  },
  COUPON_EXPIRED: {
    hint: 'This coupon is past its redeem-by date and can no longer be applied. Use a currently valid coupon, or issue a new one.',
    docUrl: `${DOCS_ERRORS_BASE}#COUPON_EXPIRED`,
  },
  COUPON_MAX_REDEMPTIONS_REACHED: {
    hint: 'This coupon has hit its maximum number of redemptions. Raise its redemption limit, or create a new coupon for further use.',
    docUrl: `${DOCS_ERRORS_BASE}#COUPON_MAX_REDEMPTIONS_REACHED`,
  },
  COUPON_INVALID_DEFINITION: {
    hint: "The coupon's definition is inconsistent (e.g. both a percent and a fixed amount, or a non-positive value). Fix the definition so exactly one valid discount is specified.",
    docUrl: `${DOCS_ERRORS_BASE}#COUPON_INVALID_DEFINITION`,
  },
  COUPON_ALREADY_APPLIED: {
    hint: 'This coupon is already applied to the subscription or invoice. Remove the existing discount first if you intend to reapply or change it.',
    docUrl: `${DOCS_ERRORS_BASE}#COUPON_ALREADY_APPLIED`,
  },
  DISCOUNT_NOT_FOUND: {
    hint: 'No discount exists with that id on this subscription or invoice. Verify the id, or list discounts to find the correct one.',
    docUrl: `${DOCS_ERRORS_BASE}#DISCOUNT_NOT_FOUND`,
  },
  CREDIT_GRANT_NOT_FOUND: {
    hint: 'No credit grant exists with that id for this customer. Check the id, and that it belongs to the customer and environment you are calling with.',
    docUrl: `${DOCS_ERRORS_BASE}#CREDIT_GRANT_NOT_FOUND`,
  },
  CREDIT_GRANT_ALREADY_VOIDED: {
    hint: 'This credit grant is already voided and cannot be voided or spent again. Issue a new credit grant if the customer needs more credit.',
    docUrl: `${DOCS_ERRORS_BASE}#CREDIT_GRANT_ALREADY_VOIDED`,
  },
  CREDIT_INSUFFICIENT_BALANCE: {
    hint: "The customer's credit balance is too low to cover this amount. Grant more credit, or apply a smaller amount.",
    docUrl: `${DOCS_ERRORS_BASE}#CREDIT_INSUFFICIENT_BALANCE`,
  },
  CREDIT_INVALID_AMOUNT: {
    hint: 'The credit amount is invalid — it must be a positive integer in the smallest currency unit. Send a valid amount and retry.',
    docUrl: `${DOCS_ERRORS_BASE}#CREDIT_INVALID_AMOUNT`,
  },
  INVOICE_NOT_BALANCED: {
    hint: 'After applying credits and discounts, the invoice does not balance. This is an internal invariant — retry; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#INVOICE_NOT_BALANCED`,
  },

  // ---- Multi-tenancy & settlement (08) ----
  SETTLEMENT_SUBACCOUNT_NOT_FOUND: {
    hint: 'No settlement subaccount is configured for this organization. Create and verify the subaccount before recording splits or payouts.',
    docUrl: `${DOCS_ERRORS_BASE}#SETTLEMENT_SUBACCOUNT_NOT_FOUND`,
  },
  SETTLEMENT_SPLIT_UNBALANCED: {
    hint: 'The settlement split amounts do not add up to the charge total. Adjust the split so the parts sum exactly to the total, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#SETTLEMENT_SPLIT_UNBALANCED`,
  },
  SETTLEMENT_ALREADY_RECORDED: {
    hint: 'A settlement has already been recorded for this charge. It is idempotent — inspect the existing settlement instead of recording it again.',
    docUrl: `${DOCS_ERRORS_BASE}#SETTLEMENT_ALREADY_RECORDED`,
  },
  SETTLEMENT_NOT_FOUND: {
    hint: 'No settlement exists with that id in this environment. Verify the id, and that your key matches the environment it belongs to.',
    docUrl: `${DOCS_ERRORS_BASE}#SETTLEMENT_NOT_FOUND`,
  },
  SETTLEMENT_PAYOUT_FAILED: {
    hint: 'The payout to the settlement subaccount failed at the bank/provider. We will retry automatically; check the subaccount details are correct and contact support with the `requestId` if it keeps failing.',
    docUrl: `${DOCS_ERRORS_BASE}#SETTLEMENT_PAYOUT_FAILED`,
  },
  SETTLEMENT_RECONCILE_DRIFT: {
    hint: 'Recorded settlements do not reconcile with provider payouts. Processing paused to protect funds — no action from you; support is alerted, contact them with the `requestId` if urgent.',
    docUrl: `${DOCS_ERRORS_BASE}#SETTLEMENT_RECONCILE_DRIFT`,
  },
  REFUND_ALREADY_REFUNDED: {
    hint: 'This charge has already been fully refunded. Inspect the existing refund; there is nothing left to refund.',
    docUrl: `${DOCS_ERRORS_BASE}#REFUND_ALREADY_REFUNDED`,
  },
  REFUND_AMOUNT_EXCEEDS_NET: {
    hint: 'The refund is larger than the remaining refundable (net) amount on the charge. Refund at most the remaining balance shown on the charge.',
    docUrl: `${DOCS_ERRORS_BASE}#REFUND_AMOUNT_EXCEEDS_NET`,
  },
  ESCROW_LOCKED: {
    hint: 'These funds are held in escrow and cannot be paid out or refunded yet. Wait for the escrow hold to release, then retry.',
    docUrl: `${DOCS_ERRORS_BASE}#ESCROW_LOCKED`,
  },
  PAYOUT_EXCEEDS_AVAILABLE: {
    hint: 'The payout is larger than the available (non-escrowed, settled) balance. Reduce the amount to at most the available balance, or wait for more funds to settle.',
    docUrl: `${DOCS_ERRORS_BASE}#PAYOUT_EXCEEDS_AVAILABLE`,
  },
  QUOTA_EXCEEDED: {
    hint: "You've reached a plan or account quota for this operation. Back off and retry later, or contact support to raise the quota.",
    docUrl: `${DOCS_ERRORS_BASE}#QUOTA_EXCEEDED`,
  },

  // ---- Dunning & recovery (06) ----
  DUNNING_SETTINGS_INVALID: {
    hint: 'The dunning configuration is invalid (e.g. non-increasing retry offsets or an empty schedule). Provide a valid, ordered retry schedule and retry.',
    docUrl: `${DOCS_ERRORS_BASE}#DUNNING_SETTINGS_INVALID`,
  },
  DUNNING_NO_OPEN_INVOICE: {
    hint: 'There is no open, past-due invoice to run dunning against. Confirm the subscription actually has an unpaid invoice before triggering recovery.',
    docUrl: `${DOCS_ERRORS_BASE}#DUNNING_NO_OPEN_INVOICE`,
  },
  DUNNING_ALREADY_TERMINAL: {
    hint: 'This dunning process has already ended (recovered or exhausted) and cannot be advanced. Start a new billing attempt if the invoice is still unpaid.',
    docUrl: `${DOCS_ERRORS_BASE}#DUNNING_ALREADY_TERMINAL`,
  },
  DUNNING_ATTEMPT_NOT_FOUND: {
    hint: 'No dunning attempt exists with that id. Verify the id, or list the attempts on the invoice to find the correct one.',
    docUrl: `${DOCS_ERRORS_BASE}#DUNNING_ATTEMPT_NOT_FOUND`,
  },
  DUNNING_CARD_UPDATE_REQUIRED: {
    hint: 'The card needs customer action (such as OTP/3DS) that cannot be completed headlessly. Send the customer the hosted payment/checkout link to update or re-authorize their card.',
    docUrl: `${DOCS_ERRORS_BASE}#DUNNING_CARD_UPDATE_REQUIRED`,
  },
  DUNNING_NOT_IN_PROGRESS: {
    hint: 'No dunning is currently in progress for this subscription or invoice, so it cannot be advanced or canceled. Check the invoice status first.',
    docUrl: `${DOCS_ERRORS_BASE}#DUNNING_NOT_IN_PROGRESS`,
  },

  // ---- The deletable example slice (delete with the example) ----
  EXAMPLE_NOT_FOUND: {
    hint: 'No example resource exists with that id in this environment. Check the id, and that your key matches the environment it was created in.',
    docUrl: `${DOCS_ERRORS_BASE}#EXAMPLE_NOT_FOUND`,
  },

  // ---- Internal / upstream (public fallbacks) ----
  SYSTEM_INTERNAL_ERROR: {
    hint: 'Something failed on our side. Retry shortly; if it persists, contact support with the `requestId` from the response `meta`.',
    docUrl: `${DOCS_ERRORS_BASE}#SYSTEM_INTERNAL_ERROR`,
  },
  SYSTEM_UPSTREAM_ERROR: {
    hint: 'An upstream dependency was unavailable or timed out. This is transient — retry after a short backoff; if it persists, contact support with the `requestId`.',
    docUrl: `${DOCS_ERRORS_BASE}#SYSTEM_UPSTREAM_ERROR`,
  },
};

/**
 * Resolve the hint + docUrl for a code, falling back to the generic internal
 * meta if an unknown value is ever passed (defensive — the `Record` type keeps
 * the map exhaustive at compile time).
 */
export function errorMetaFor(code: NombaoneErrorCode): ErrorCodeMeta {
  return ERROR_CODE_META[code] ?? ERROR_CODE_META.SYSTEM_INTERNAL_ERROR;
}
