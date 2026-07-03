import { cn } from "@/lib/utils";

/**
 * Emerald-tinted callout (.pen r7oSI): diamond icon + lead + body.
 * padding [16,18], radius 14, bg accent-muted, border accent-border, gap 12.
 * Both lead and body render in foreground (white) inside the tint.
 */
export function Callout({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[14px] border border-accent-border bg-accent-muted px-[18px] py-[16px]",
        className
      )}
    >
      <span aria-hidden="true" className="text-[18px] leading-[1.35] text-accent">
        ◆
      </span>
      <div className="flex flex-col gap-0.5">
        {title ? <p className="text-[17px] font-semibold text-foreground">{title}</p> : null}
        <div className="text-[16px] leading-[1.5] text-foreground">{children}</div>
      </div>
    </div>
  );
}
