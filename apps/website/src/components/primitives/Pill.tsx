import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const dotTone: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const textTone: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

/** Rounded status pill with an optional dot (.pen bxMAG). */
export function Pill({
  className,
  children,
  tone = "neutral",
  dot = true,
}: {
  className?: string;
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full border border-border bg-surface-1 px-[11px] py-1 text-[12.5px] font-medium",
        textTone[tone],
        className
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dotTone[tone])} /> : null}
      {children}
    </span>
  );
}
