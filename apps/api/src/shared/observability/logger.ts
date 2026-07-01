import { createLogger, format, transports } from 'winston';

import { getCorrelation } from './correlation';

/**
 * A format that mixes the ambient correlation context (`correlationId`,
 * `organizationId`, `environment`, `task`) onto every log line, so any line
 * emitted inside a request or a job is filterable by flow and by tenant without
 * the call site having to pass the ids. Explicit `info` fields win over the
 * ambient ones (a call site can always override).
 */
const correlationFormat = format((info) => {
  const ctx = getCorrelation();
  if (ctx) {
    return { ...ctx, ...info };
  }
  return info;
});

/** Structured logger. Requests are tagged `[api] <reqId> <method> <path> -> <status> <code>`
 * by the request logger; everything else uses these helpers. Every line also carries
 * the ambient correlation fields (item 5). */
export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(correlationFormat(), format.timestamp(), format.json()),
  defaultMeta: { service: 'api' },
  transports: [new transports.Console()],
});
