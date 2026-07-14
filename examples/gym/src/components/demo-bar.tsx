import { fastForwardAction, forceDeclineAction } from '@/lib/actions';

/**
 * The demo bar.
 *
 * It is deliberately, visibly a demo — nothing here pretends to be part of the gym. It
 * exists because two things in a subscription are true but slow:
 *
 *  • A Flex Pass really does renew every ten minutes. You CAN just wait, and that is the
 *    honest demo. This lets you not wait, in a room full of people.
 *  • A card decline cannot be staged at all — you would have to genuinely run out of
 *    money. This swaps in a card the sandbox always declines, so the recovery story
 *    (grace period, "you can still train until…", the pay link) can be shown for real.
 *
 * Both buttons drive the SAME engine paths a real payment does. Nothing here is faked;
 * it is only brought forward.
 *
 * Rendered only for a sandbox key — see `/account`.
 */
export function DemoBar({ canFastForward }: { canFastForward: boolean }) {
  return (
    <div className="mb-8 rounded-lg border border-dashed border-dim/50 bg-panel/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">
            Demo controls
          </p>
          <p className="mt-1 text-[12px] text-dim">
            Not part of the gym. These bring real events forward so you don&apos;t have to wait
            for them.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={fastForwardAction}>
            <button
              type="submit"
              disabled={!canFastForward}
              data-testid="fast-forward"
              className="rounded border border-line bg-panel-2 px-3 py-2 text-[12px] font-medium text-chalk transition-colors hover:border-dim disabled:opacity-40"
            >
              ⏩ Take the next payment now
            </button>
          </form>

          <form action={forceDeclineAction}>
            <button
              type="submit"
              disabled={!canFastForward}
              data-testid="force-decline"
              className="rounded border border-line bg-panel-2 px-3 py-2 text-[12px] font-medium text-chalk transition-colors hover:border-dim disabled:opacity-40"
            >
              ⚡ Make the next payment fail
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
