import { cn } from "@/lib/utils";

/** Small mono label chip (.pen C7MpZr). */
export function Tag({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--r-sm)] border border-border bg-surface-2 px-[10px] py-[5px] font-mono text-xs text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
