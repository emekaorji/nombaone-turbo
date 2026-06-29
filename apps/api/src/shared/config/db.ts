// The two DB handles for the API process come from @nombaone/core-db: the pool
// (interactive transactions) + a check helper. The API uses the pool for both
// reads and tx writes (it's a long-lived server, not serverless).
export { db, pool, checkDatabaseConnection, type PoolDatabase } from '@nombaone/core-db/pool';
