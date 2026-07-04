"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `<AskAI>` (Phase 09) — the in-docs assistant. A floating launcher opens a
 * panel that streams answers from `/api/ask`, which is grounded strictly in the
 * documentation corpus (it refuses when it can't answer from the docs, and
 * always expresses money in integer kobo). Answers cite source URLs, rendered
 * as clickable links. Client leaf; keyboard-operable, AA-contrast on dark.
 */

const SUGGESTIONS = [
  "How do I start a subscription that fails on a thin balance?",
  "How do I verify a webhook signature?",
  "What does API_KEY_INVALID mean?",
];

/** Linkify bare URLs in the streamed answer so citations are clickable. */
function renderAnswer(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} className="text-[--accent] underline underline-offset-2 hover:opacity-80">
        {part.replace(/^https?:\/\/docs\.nombaone\.xyz/, "")}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function AskAI() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      inputRef.current?.focus();
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true);
    setError(null);
    setAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const data = (await res.json()) as { answer?: string; error?: string };
        if (data.error) setError(data.error);
        else setAnswer(data.answer ?? "");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream.");
        return;
      }
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch {
      setError("Something went wrong. Try again, or use search (⌘K).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask AI about the docs"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-colors hover:border-[--accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="text-[--accent]">✦</span>
        Ask AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Ask AI">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span aria-hidden="true" className="text-[--accent]">✦</span>
                Ask the docs
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {!answer && !error && !busy && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ask anything about Nomba One. Answers come only from these docs — and always
                    in integer kobo.
                  </p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setQuestion(s);
                        void ask(s);
                      }}
                      className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:border-[--accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {busy && !answer && <p className="text-sm text-muted-foreground">Searching the docs…</p>}
              {error && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-foreground">
                  {error}
                </p>
              )}
              {answer && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground" aria-live="polite">
                  {renderAnswer(answer)}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
              className="border-t border-border p-3"
            >
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(question);
                  }
                }}
                rows={2}
                placeholder="Ask a question…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Grounded in the docs · cites sources</span>
                <button
                  type="submit"
                  disabled={busy || !question.trim()}
                  className="rounded-lg bg-[--accent] px-4 py-1.5 text-sm font-semibold text-[color:var(--accent-foreground)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {busy ? "…" : "Ask"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
