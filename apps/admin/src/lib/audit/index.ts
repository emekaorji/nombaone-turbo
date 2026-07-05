/**
 * `@/lib/audit` — the append-only operator audit trail.
 *
 * One entry point: `recordAudit`, called from every privileged admin-console
 * mutation. See `./audit` for the paradigm (platform-side accountability,
 * distinct from the tenant-facing `domain_events` spine).
 */
export * from './audit';
