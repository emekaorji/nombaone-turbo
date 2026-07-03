"use client";

import { useState } from "react";
import { Code, ImageIcon, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const HANDLES = [
  "midnight_debugger",
  "ships_at_3am",
  "kudi_gremlin",
  "miraculous_mimi",
  "code_wizard_99",
  "aunty.tech",
];

/** Shared "Ask the Hall" modal (.pen ask modal). Opened by any add-question trigger. */
export function AskModal({ children }: { children: React.ReactNode }) {
  const [handle, setHandle] = useState(HANDLES[0]!);

  function shuffle() {
    setHandle(HANDLES[Math.floor((Date.now() / 7) % HANDLES.length)]!);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg gap-0 border-border-strong bg-surface-1 p-0">
        <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
          <DialogTitle className="text-lg font-semibold text-foreground">Ask the Hall</DialogTitle>
          <p className="text-xs text-muted-foreground">Answered in the open by the team</p>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Posting as</label>
            <div className="flex items-center gap-2">
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} className="flex-1" />
              <button
                type="button"
                onClick={shuffle}
                aria-label="Shuffle handle"
                className="inline-flex size-9 items-center justify-center rounded-[var(--r)] border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Your question</label>
            <Textarea
              rows={3}
              placeholder="How do I bill a customer who can only pay by bank transfer?"
              className="resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-[var(--r)] border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-3">
              <ImageIcon className="size-4 text-muted-foreground" /> Image
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-[var(--r)] border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-3">
              <Code className="size-4 text-muted-foreground" /> Add code
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Switch defaultChecked id="feature" />
            <label htmlFor="feature" className="text-sm text-foreground">
              Feature my question in the Hall
            </label>
          </div>

          <Button variant="accent" className="mt-1 w-full">
            <Sparkles className="size-4" /> Ask in the open
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
