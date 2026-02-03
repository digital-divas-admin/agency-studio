/**
 * Input Component
 * Reusable form input with label and error state
 */

import { clsx } from 'clsx';
import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, className, type = 'text', ...props },
  ref
) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={clsx(
          'w-full rounded-lg border bg-surface/50 px-4 py-2 text-text',
          'placeholder:text-text-muted/60',
          'transition-all duration-200',
          'hover:border-border hover:bg-surface',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-border/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, className, rows = 4, ...props },
  ref
) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-muted">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full rounded-lg border bg-surface/50 px-4 py-2 text-text resize-none',
          'placeholder:text-text-muted/60',
          'transition-all duration-200',
          'hover:border-border hover:bg-surface',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-elevated',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500' : 'border-border/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
});
