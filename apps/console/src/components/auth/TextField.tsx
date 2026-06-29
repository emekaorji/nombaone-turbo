'use client';

import { forwardRef } from 'react';

import { Input } from '@nombaone/ui/components/ui/input';
import { Label } from '@nombaone/ui/components/ui/label';
import { cn } from '@/lib/cn';

/**
 * A labelled text input wired for react-hook-form: forwards the ref/props from
 * `register(...)`, shows a per-field error below the input (mapped from the
 * action's `fields` back onto the form), and flags the input invalid for a11y.
 */
export const TextField = forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & { label: string; error?: string }
>(({ label, error, id, className, ...props }, ref) => {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(error && 'border-error-500 focus-visible:ring-error-500', className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-error-600">
          {error}
        </p>
      ) : null}
    </div>
  );
});
TextField.displayName = 'TextField';
