import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import type { ApiFieldErrors } from '@nombaone/errors';

/**
 * Map an action's `fields` (the contracts/`ApiFieldErrors` shape:
 * `field → messages[]`) back onto a react-hook-form instance via `setError`, so
 * a server-side validation failure paints the same inline errors the client
 * resolver would. Returns `true` if at least one field error was applied (the
 * caller then skips the root alert), `false` otherwise.
 */
export function applyFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fields: ApiFieldErrors | undefined
): boolean {
  if (!fields) return false;
  let applied = false;
  for (const [name, messages] of Object.entries(fields)) {
    const message = messages?.[0];
    if (!message || name === '_root') continue;
    form.setError(name as Path<T>, { type: 'server', message });
    applied = true;
  }
  return applied;
}
