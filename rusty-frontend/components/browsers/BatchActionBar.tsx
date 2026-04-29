"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useState } from "react";

type Props = {
  selectedIds: string[];
  onClear: () => void;
  onChanged: () => void;
};

type PromptKind = "navigate" | "instruct" | null;

export function BatchActionBar({ selectedIds, onClear, onChanged }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<PromptKind>(null);
  const [text, setText] = useState("");

  async function fanOut<T>(label: string, fn: (id: string) => Promise<T>) {
    setBusy(true);
    const res = await Promise.allSettled(selectedIds.map(fn));
    const ok = res.filter((r) => r.status === "fulfilled").length;
    const fail = res.length - ok;
    toast.push({
      tone: fail === 0 ? "success" : "error",
      message: `${label}: ${ok} ok${fail ? ` · ${fail} failed` : ""}`,
    });
    setBusy(false);
    onChanged();
  }

  async function closeAll() {
    if (!confirm(`Close ${selectedIds.length} browser(s)?`)) return;
    await fanOut("Closed", (id) => api.closeBrowser(id));
    onClear();
  }

  async function navigateAll() {
    if (!text.trim()) return;
    await fanOut("Navigate", (id) => api.navigate(id, text.trim()));
    setPrompt(null); setText("");
  }

  async function instructAll() {
    if (!text.trim()) return;
    await fanOut("Instruct", (id) => api.instruct(id, text.trim()));
    setPrompt(null); setText("");
  }

  async function screenshotAll() {
    await fanOut("Screenshot", (id) => api.screenshot(id));
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-2 rounded-md border border-border bg-card/90 backdrop-blur px-3 py-2 shadow-sm">
        <span className="text-xs font-medium">
          {selectedIds.length} selected
        </span>
        <div className="ml-2 h-5 w-px bg-border" />
        <Button size="sm" variant="secondary" onClick={() => setPrompt("navigate")} disabled={busy}>
          Navigate all
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPrompt("instruct")} disabled={busy}>
          Instruct all
        </Button>
        <Button size="sm" variant="secondary" onClick={screenshotAll} disabled={busy}>
          Screenshot all
        </Button>
        <Button size="sm" variant="danger" onClick={closeAll} disabled={busy}>
          Close selected
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
          Clear
        </Button>
      </div>
      <Modal
        open={prompt !== null}
        onClose={() => { setPrompt(null); setText(""); }}
        title={prompt === "navigate" ? "Navigate all" : "Instruct all"}
      >
        <div className="space-y-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={prompt === "navigate" ? "https://example.com" : "Click the sign-in link…"}
            mono={prompt === "navigate"}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Will be sent in parallel to {selectedIds.length} browser(s).
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => { setPrompt(null); setText(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={prompt === "navigate" ? navigateAll : instructAll}
              loading={busy}
            >
              Run
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
