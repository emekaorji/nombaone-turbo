"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `<AskAI>` (Phase 09) — the in-docs assistant. A floating launcher opens a
 * panel that holds a multi-turn conversation, streaming answers from `/api/ask`
 * (grounded strictly in the docs corpus, money always in integer kobo, sources
 * cited as clickable links). The conversation is kept in state and persisted to
 * `localStorage`, so follow-ups keep context and the thread survives a reload.
 * Client leaf; keyboard-operable, AA-contrast on dark.
 */

const STORAGE_KEY = "nbo-ask-history";

const SUGGESTIONS = [
  "How do I start a subscription that fails on a thin balance?",
  "How do I verify a webhook signature?",
  "What does API_KEY_INVALID mean?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Linkify bare URLs in an answer so citations are clickable. */
function renderAnswer(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-[--accent] underline underline-offset-2 hover:opacity-80"
      >
        {part.replace(/^https?:\/\/docs\.nombaone\.xyz/, "")}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function loadHistory(): Message[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

export function AskAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist the thread whenever it changes (writing to an external store is a
  // legit effect — no setState here).
  useEffect(() => {
    if (messages.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Keep the transcript pinned to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

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

  function openPanel() {
    // Restore the persisted thread on open (event handler, not an effect).
    if (messages.length === 0) {
      const saved = loadHistory();
      if (saved.length) setMessages(saved);
    }
    setOpen(true);
  }

  function newChat() {
    setMessages([]);
    setError(null);
    setInput("");
    window.localStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  }

  async function ask(text: string) {
    const query = text.trim();
    if (!query || busy) return;

    const history = [...messages, { role: "user", content: query } as Message];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    // Stream the assistant reply into the last (placeholder) message.
    const setLastAssistant = (content: string) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content };
        return copy;
      });

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const data = (await res.json()) as { answer?: string; error?: string };
        if (data.error) {
          setError(data.error);
          setMessages((m) => m.slice(0, -1)); // drop the empty placeholder
        } else {
          setLastAssistant(data.answer ?? "");
        }
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream.");
        setMessages((m) => m.slice(0, -1));
        return;
      }
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setLastAssistant(acc);
      }
      if (!acc.trim()) {
        setError("The assistant returned an empty answer. Try rephrasing.");
        setMessages((m) => m.slice(0, -1));
      }
    } catch {
      setError("Something went wrong. Try again, or use search (⌘K).");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const streaming = busy && messages.at(-1)?.role === "assistant" && !messages.at(-1)?.content;

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
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
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={newChat}
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    New chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Close
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && !error && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ask anything about Nomba One. Answers come only from these docs, and always
                    in integer kobo.
                  </p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void ask(s)}
                      className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:border-[--accent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[--accent]/12 px-3 py-2 text-sm text-foreground">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={i}
                    className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
                    aria-live={i === messages.length - 1 ? "polite" : undefined}
                  >
                    {m.content ? (
                      renderAnswer(m.content)
                    ) : streaming ? (
                      <span className="text-muted-foreground">Searching the docs…</span>
                    ) : null}
                  </div>
                ),
              )}

              {error && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-foreground">
                  {error}
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
              className="border-t border-border p-3"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(input);
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
                  disabled={busy || !input.trim()}
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
