import { requestLogsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type LogFilter = 'all' | 'succeeded' | 'failed';

export type LogFeedItem = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  statusTone: StatusTone;
  latency: string;
  time: string;
  selected: boolean;
};

export type CodeLine = { t: string; c: 'muted' | 'fg' | 'accent' };

export type LogField = { label: string; value: string; mono?: boolean };
export type LogDetail = {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  statusLabel: string;
  statusTone: StatusTone;
  fields: LogField[];
  bodyLines: CodeLine[] | null;
  bodyNote: string | null;
} | null;

export type LogsView = { feed: LogFeedItem[]; detail: LogDetail; total: number; filter: LogFilter };

function statusTone(code: number): StatusTone {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'info';
  if (code >= 200) return 'success';
  return 'neutral';
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable',
  429: 'Too Many Requests',
  500: 'Internal Error',
  503: 'Service Unavailable',
};

function statusLabel(code: number): string {
  const text = STATUS_TEXT[code];
  return text ? `${code} ${text}` : String(code);
}

function relTime(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function fullTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function bodyLines(body: Record<string, unknown>): CodeLine[] {
  return JSON.stringify(body, null, 2)
    .split('\n')
    .map((t) => {
      const trimmed = t.trim();
      if (trimmed === '{' || trimmed === '}' || trimmed === '},' || trimmed === '[' || trimmed === ']' || trimmed === '],') return { t, c: 'muted' as const };
      if (trimmed.startsWith('"domain"') || trimmed.startsWith('"type"')) return { t, c: 'accent' as const };
      return { t, c: 'fg' as const };
    });
}

export async function getLogsView(selectedRequestId?: string, filter: LogFilter = 'all'): Promise<LogsView> {
  const session = await getSession();
  if (!session) return { feed: [], detail: null, total: 0, filter };
  const { organizationId, mode } = session;

  const statusFilter =
    filter === 'succeeded'
      ? lt(requestLogsTable.statusCode, 400)
      : filter === 'failed'
        ? gte(requestLogsTable.statusCode, 400)
        : undefined;

  const rows = await db
    .select({
      requestId: requestLogsTable.requestId,
      method: requestLogsTable.method,
      path: requestLogsTable.path,
      statusCode: requestLogsTable.statusCode,
      durationMs: requestLogsTable.durationMs,
      ip: requestLogsTable.ip,
      idempotencyKey: requestLogsTable.idempotencyKey,
      apiVersion: requestLogsTable.apiVersion,
      responseBody: requestLogsTable.responseBody,
      createdAt: requestLogsTable.createdAt,
    })
    .from(requestLogsTable)
    .where(and(eq(requestLogsTable.organizationId, organizationId), eq(requestLogsTable.mode, mode), ...(statusFilter ? [statusFilter] : [])))
    .orderBy(desc(requestLogsTable.createdAt))
    .limit(50);

  const total = rows.length;
  const selected = (selectedRequestId && rows.find((r) => r.requestId === selectedRequestId)) || rows[0] || null;

  const feed: LogFeedItem[] = rows.map((r) => ({
    requestId: r.requestId,
    method: r.method,
    path: r.path,
    statusCode: r.statusCode,
    statusTone: statusTone(r.statusCode),
    latency: `${r.durationMs}ms`,
    time: relTime(r.createdAt),
    selected: selected ? r.requestId === selected.requestId : false,
  }));

  let detail: LogDetail = null;
  if (selected) {
    const fields: LogField[] = [
      { label: 'Request ID', value: selected.requestId, mono: true },
      { label: 'Time', value: fullTime(selected.createdAt), mono: true },
      { label: 'IP', value: selected.ip ?? '—', mono: true },
      { label: 'API version', value: selected.apiVersion ?? '—', mono: true },
      { label: 'Idempotency-Key', value: selected.idempotencyKey ?? '—', mono: true },
    ];
    const truncated = selected.responseBody && (selected.responseBody as Record<string, unknown>)._truncated === true;
    detail = {
      requestId: selected.requestId,
      method: selected.method,
      path: selected.path,
      statusCode: selected.statusCode,
      statusLabel: statusLabel(selected.statusCode),
      statusTone: statusTone(selected.statusCode),
      fields,
      bodyLines: selected.responseBody && !truncated ? bodyLines(selected.responseBody as Record<string, unknown>) : null,
      bodyNote: truncated
        ? String((selected.responseBody as Record<string, unknown>)._note ?? 'Response body omitted (too large).')
        : selected.responseBody
          ? null
          : 'No response body was captured for this request.',
    };
  }

  return { feed, detail, total, filter };
}
