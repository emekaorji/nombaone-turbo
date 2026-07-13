import { listEvents } from '@/lib/event-log';

export const dynamic = 'force-dynamic';

const timeFmt = new Intl.DateTimeFormat('en-NG', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Africa/Lagos',
});

/**
 * The webhook feed — every signature-verified delivery this app has received
 * at /api/webhooks, deduped on the domain event id. In-memory only: it resets
 * on restart (the platform's `events.list` is the durable backstop).
 */
export default function EventsPage() {
  const events = listEvents();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-20">
      <section className="py-12">
        <p className="text-xs font-semibold tracking-[0.35em] text-ember uppercase">Webhooks</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Events received</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-fog">
          Verified deliveries to <span className="font-mono text-chalk">/api/webhooks</span>, newest
          first, deduped by domain event id (delivery is at-least-once). In-memory — restarts clear
          it.
        </p>
      </section>

      {events.length === 0 ? (
        <section className="rounded-lg border border-line bg-panel p-6 text-sm text-fog">
          <p>No events yet.</p>
          <p className="mt-2 text-xs text-dim">
            Register a webhook endpoint with the engine pointing at{' '}
            <span className="font-mono text-chalk">
              {(process.env.GYM_BASE_URL || 'http://localhost:8060').replace(/\/$/, '')}/api/webhooks
            </span>{' '}
            and put the plaintext <span className="font-mono text-chalk">nbo_whsec_…</span> secret in{' '}
            <span className="font-mono text-chalk">GYM_WEBHOOK_SECRET</span>.
          </p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-panel text-xs tracking-wide text-dim uppercase">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.eventId} className="border-b border-line/60 last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap text-fog">
                    {timeFmt.format(new Date(event.receivedAt))}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-chalk">{event.type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fog">{event.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
