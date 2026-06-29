/**
 * `@nombaone/sara` — the domain layer (the ONLY place with business logic). Apps
 * stay thin and import narrow submodule slices (`@nombaone/sara/ledger`,
 * `/api-keys`, `/auth`, …), never a barrel. This root exports just the
 * cross-cutting primitives.
 */
export * from './context';
export * from './reference';
export * from './money';
export * from './pagination';
