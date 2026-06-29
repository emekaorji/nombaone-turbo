"use client";

import { useState } from "react";

import { ThumbsDown, ThumbsUp } from "lucide-react";

import { getAnonymousId } from "@/lib/anonymous-id";
import { cn } from "@/lib/cn";

/**
 * "Was this page helpful?": the client island in the pager footer.
 *
 * Two clear, bordered buttons (Yes / No, each with a lucide icon). A click POSTs
 * `{ pageSlug, helpful, anonymousId }` to `/api/feedback`, disables the controls
 * while sending, then swaps to a "Thanks for the feedback!" state. It never
 * throws on a failed request; the docs keep working regardless; we just settle
 * into the thanks state so a reader is never left hanging.
 */

type Status = "idle" | "sending" | "done";

export function Feedback({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>("idle");

  async function send(helpful: boolean) {
    if (status !== "idle") return;
    setStatus("sending");
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSlug: slug, helpful, anonymousId: getAnonymousId() }),
      });
    } catch {
      // Feedback is best-effort; never surface a failure to the reader.
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        Thanks for the feedback!
      </div>
    );
  }

  const disabled = status === "sending";

  return (
    <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
      <span>Was this page helpful?</span>
      <div className="flex gap-2">
        <FeedbackButton label="Yes" disabled={disabled} onClick={() => send(true)}>
          <ThumbsUp size={15} aria-hidden />
        </FeedbackButton>
        <FeedbackButton label="No" disabled={disabled} onClick={() => send(false)}>
          <ThumbsDown size={15} aria-hidden />
        </FeedbackButton>
      </div>
    </div>
  );
}

function FeedbackButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {children}
      {label}
    </button>
  );
}
