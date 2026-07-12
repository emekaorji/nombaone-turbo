/**
 * `@nombaone/core-contracts` — the single source of truth for API shapes.
 * Depends on NOTHING but `@nombaone/errors` (for the error-code type) + zod.
 * Importable by the backend and every frontend without pulling DB or domain code.
 *
 *  - `@nombaone/core-contracts`              → the DTO types + envelope (this file)
 *  - `@nombaone/core-contracts/types`        → types only
 *  - `@nombaone/core-contracts/validations`  → zod schemas only (forms can import
 *                                               these without dragging type files)
 *  - `@nombaone/core-contracts/billing`      → the billing-interval primitives
 *                                               (cadence math + money normalization
 *                                               shared by the API and the console)
 */
export * from './types';
export * from './billing';
