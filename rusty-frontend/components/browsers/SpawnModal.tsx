"use client";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (geo?: string) => Promise<void>;
};

export function SpawnModal({ open, onClose, onConfirm }: Props) {
  const [geo, setGeo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      await onConfirm(geo.trim() || undefined);
      setGeo(""); onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Spawn browser">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="geo">Geo (optional)</Label>
          <Input
            id="geo"
            value={geo}
            onChange={(e) => setGeo(e.target.value)}
            placeholder="us-west, eu-central…"
            mono
          />
          <p className="text-[11px] text-muted-foreground">
            Leave empty to let the cluster choose.
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] px-3 py-2 text-xs text-[var(--error)]">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Spawn</Button>
        </div>
      </div>
    </Modal>
  );
}
