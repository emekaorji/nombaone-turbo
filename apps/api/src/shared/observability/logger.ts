import { createLogger, format, transports } from 'winston';

/** Structured logger. Requests are tagged `[api] <reqId> <method> <path> -> <status> <code>`
 * by the request logger; everything else uses these helpers. */
export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: 'api' },
  transports: [new transports.Console()],
});
