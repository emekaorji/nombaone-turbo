import { domainEventsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type EventTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
export type EventRow = {
  reference: string;
  type: string;
  tone: EventTone;
  detail: string;
  time: string;
};

function toneOf(type: string): EventTone {
  if (/recovered|succeeded|paid|payment_succeeded|activated/.test(type)) return 'success';
  if (/failed|uncollectible|exhausted|canceled|voided/.test(type)) return 'danger';
  if (/dunning|attempt|past_due|action_required|scheduled/.test(type)) return 'warning';
  if (/finalized|created|updated|issued/.test(type)) return 'info';
  return 'neutral';
}

function relTime(d: Date): string {
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function detailOf(payload: Record<string, unknown>): string {
  const ref =
    (typeof payload.reference === 'string' && payload.reference) ||
    (typeof payload.id === 'string' && payload.id) ||
    '';
  const amountKobo =
    typeof payload.amount === 'number'
      ? payload.amount
      : typeof payload.amountDue === 'number'
        ? payload.amountDue
        : typeof payload.amountKobo === 'number'
          ? payload.amountKobo
          : null;
  const amount = amountKobo !== null ? ` · ₦${Math.round(amountKobo / 100).toLocaleString()}` : '';
  return `${ref}${amount}` || '—';
}

export type EventFeedItem = { reference: string; type: string; tone: EventTone; time: string; selected: boolean };
export type PayloadLine = { t: string; c: 'muted' | 'fg' | 'accent' };
export type EventDetail = { reference: string; type: string; tone: EventTone; lines: PayloadLine[] } | null;
export type EventsView = { feed: EventFeedItem[]; detail: EventDetail; total: number };

function payloadLines(ev: { reference: string; type: string; createdAt: Date; payload: Record<string, unknown> }): PayloadLine[] {
  const obj = { id: ev.reference, type: ev.type, createdAt: ev.createdAt.toISOString(), data: ev.payload };
  return JSON.stringify(obj, null, 2)
    .split('\n')
    .map((t) => {
      const trimmed = t.trim();
      if (trimmed === '{' || trimmed === '}' || trimmed === '},' || trimmed === '}') return { t, c: 'muted' as const };
      if (trimmed.startsWith('"type"')) return { t, c: 'accent' as const };
      return { t, c: 'fg' as const };
    });
}

export async function getEventsView(selectedRef?: string): Promise<EventsView> {
  const session = await getSession();
  if (!session) return { feed: [], detail: null, total: 0 };

  const events = await db
    .select({
      reference: domainEventsTable.reference,
      type: domainEventsTable.type,
      payload: domainEventsTable.payload,
      createdAt: domainEventsTable.createdAt,
    })
    .from(domainEventsTable)
    .where(and(eq(domainEventsTable.organizationId, session.organizationId), eq(domainEventsTable.mode, session.mode)))
    .orderBy(desc(domainEventsTable.createdAt))
    .limit(50);

  if (events.length === 0) return { feed: [], detail: null, total: 0 };

  const selected = events.find((e) => e.reference === selectedRef) ?? events[0];
  const feed: EventFeedItem[] = events.map((e) => ({
    reference: e.reference,
    type: e.type,
    tone: toneOf(e.type),
    time: relTime(e.createdAt),
    selected: e.reference === selected.reference,
  }));

  return {
    feed,
    detail: {
      reference: selected.reference,
      type: selected.type,
      tone: toneOf(selected.type),
      lines: payloadLines(selected),
    },
    total: events.length,
  };
}

export async function getRecentEvents(limit = 7): Promise<EventRow[]> {
  const session = await getSession();
  if (!session) return [];

  const events = await db
    .select({
      reference: domainEventsTable.reference,
      type: domainEventsTable.type,
      payload: domainEventsTable.payload,
      createdAt: domainEventsTable.createdAt,
    })
    .from(domainEventsTable)
    .where(and(eq(domainEventsTable.organizationId, session.organizationId), eq(domainEventsTable.mode, session.mode)))
    .orderBy(desc(domainEventsTable.createdAt))
    .limit(limit);

  return events.map((e) => ({
    reference: e.reference,
    type: e.type,
    tone: toneOf(e.type),
    detail: detailOf(e.payload),
    time: relTime(e.createdAt),
  }));
}
