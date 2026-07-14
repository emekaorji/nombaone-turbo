/**
 * Reset-flow state types.
 *
 * They live OUTSIDE `reset.ts` because that file is `'use server'`, and a server-action
 * module may only export async functions — exporting a type from it makes Next treat it
 * as a callable action and the build fails.
 */
export type RequestResetState =
  | { status: 'idle' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

export type ResetState =
  | { status: 'idle' }
  | { status: 'done' }
  | { status: 'error'; message: string };
