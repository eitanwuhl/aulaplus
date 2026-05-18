import type { FieldError } from 'react-hook-form';

export function renderFieldError(error: FieldError | undefined): string | null {
  if (!error?.message) return null;
  return String(error.message);
}
