import { InfoCircle } from 'iconsax-react';

/**
 * Root-level form alert: the non-field failure message (or a success notice) an
 * auth form surfaces above its fields. Per-field errors render inline via
 * `TextField`; this is for the "wrong email or password" / "check your inbox"
 * case that doesn't belong to a single field.
 */
export function FormAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success';
  children: React.ReactNode;
}) {
  const styles =
    tone === 'success'
      ? 'border-success-200 bg-success-50 text-success-700'
      : 'border-error-200 bg-error-50 text-error-700';
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${styles}`}
    >
      <InfoCircle size={16} color="currentColor" variant="Bold" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
