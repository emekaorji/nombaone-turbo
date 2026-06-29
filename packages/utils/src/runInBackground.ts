/** Error thrown when a promise is cancelled via cancellable(). */
export class CancelledError extends Error {
  override readonly name = 'CancelledError';

  constructor(message = 'Cancelled') {
    super(message);
  }
}

/**
 * Wraps a promise so the caller can stop waiting by calling cancel().
 * The underlying operation is not stopped; only the returned promise rejects with CancelledError.
 *
 * @example
 * const task = cancellable(expensiveAsyncThing());
 * task.cancel();
 * try {
 *   await task.promise;
 * } catch (e) {
 *   if (e instanceof CancelledError) { /* cancelled *\/ }
 * }
 */
export function cancellable<T>(promise: Promise<T>, cancelReason?: Error | string) {
  let cancel!: () => void;

  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(
        cancelReason instanceof Error
          ? cancelReason
          : new CancelledError(typeof cancelReason === 'string' ? cancelReason : 'Cancelled')
      );
    };
  });

  return {
    promise: Promise.race([promise, cancelled]) as Promise<T>,
    cancel,
  };
}

export type RunInBackgroundOptions = {
  /** Time in ms after which the operation's AbortSignal is aborted and onTimeout is invoked. */
  timeoutMs: number;
  /** Called when timeoutMs elapses (signal has been aborted). Optional. */
  onTimeout?: () => void;
  /** Called if the operation rejects. Optional; prevents unhandled rejection. Not called for abort errors when ignoreAbortError is true. */
  onError?: (error: unknown) => void;
  /** If true (default), do not call onError when the operation rejects due to abort. */
  ignoreAbortError?: boolean;
  /** Optional label for logging (e.g. 'bvn-insert'). */
  label?: string;
};

function defaultOnError(label: string | undefined, error: unknown): void {
  const prefix = label ? `[runInBackground ${label}]` : '[runInBackground]';
  // eslint-disable-next-line no-console
  console.error(prefix, error);
}

function defaultOnTimeout(label: string | undefined): void {
  const prefix = label ? `[runInBackground ${label}]` : '[runInBackground]';
  // eslint-disable-next-line no-console
  console.warn(prefix, 'Operation timed out (signal aborted).');
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'AbortError';
  }
  return false;
}

function isCancelledError(error: unknown): boolean {
  return error instanceof CancelledError;
}

/**
 * Runs an async operation in the background without blocking the caller.
 * When the timeout elapses, the wait is cancelled (via cancellable) and the AbortSignal is aborted.
 *
 * - Caller does not await: main flow continues immediately.
 * - The operation receives an AbortSignal; when timeoutMs elapses, the signal is aborted.
 * - Operations that support AbortSignal (fetch, many HTTP clients, etc.) will be cancelled.
 * - If the operation rejects: onError is called (abort rejections are ignored by default).
 *
 * @example
 * // Operation that supports cancellation (e.g. fetch)
 * runInBackgroundWithTimeout(
 *   (signal) => fetch(url, { signal }),
 *   { timeoutMs: 5000, label: 'fetch' }
 * );
 *
 * @example
 * // Operation that doesn't use the signal (e.g. DB insert) – will not cancel, but timeout still fires
 * runInBackgroundWithTimeout(
 *   (signal) => db.insert(table).values(data),
 *   { timeoutMs: 5000, label: 'insert' }
 * );
 */
export function runInBackground<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RunInBackgroundOptions
): void {
  const {
    timeoutMs,
    onTimeout,
    onError = (error) => defaultOnError(options.label, error),
    ignoreAbortError = true,
    label,
  } = options;

  const controller = new AbortController();
  const { signal } = controller;

  const operationPromise = operation(signal);
  const { promise: racedPromise, cancel } = cancellable(operationPromise);

  const timeoutId = setTimeout(() => {
    cancel();
    controller.abort();
    if (onTimeout) {
      onTimeout();
      return;
    }
    defaultOnTimeout(label);
  }, timeoutMs);

  const run = async (): Promise<void> => {
    try {
      await racedPromise;
    } catch (error) {
      if (ignoreAbortError && (isAbortError(error) || isCancelledError(error))) {
        return;
      }
      onError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  run();
}
