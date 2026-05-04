"use client";

import { BatchResults, RunRecord } from "@/components/browsers/BatchResults";
import { Button } from "@/components/ui/Button";
import { ForceButton } from "@/components/ui/ForceButton";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ACTIONS, ActionDef, actionsByGroup, getAction } from "@/lib/actionCatalog";
import { describeError } from "@/lib/config";
import { useState } from "react";

const GROUPED = actionsByGroup();

type Props = {
  selectedIds: string[];
  onClear: () => void;
  onChanged: () => void;
  onShowDisplay?: () => void;
  displayableCount?: number;
};

export function BatchActionBar({ selectedIds, onClear, onChanged, onShowDisplay, displayableCount }: Props) {
  const toast = useToast();
  const [actionId, setActionId] = useState<string>(ACTIONS[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<RunRecord[] | null>(null);

  const action = getAction(actionId) ?? ACTIONS[0];

  function updateRun(id: string, patch: Partial<RunRecord>) {
    setRuns((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev,
    );
  }

  async function executeOne(action: ActionDef, id: string) {
    const start = performance.now();
    try {
      const result = await action.run(id, values);
      updateRun(id, { status: "ok", result, durationMs: performance.now() - start });
      return true;
    } catch (e) {
      updateRun(id, { status: "fail", error: describeError(e), durationMs: performance.now() - start });
      return false;
    }
  }

  function missingRequired(): string | null {
    for (const f of action.fields) {
      if (f.required && !(values[f.name] ?? "").trim()) return f.name;
    }
    return null;
  }

  async function run() {
    const missing = missingRequired();
    if (missing) {
      toast.push({ tone: "error", message: `Missing field: ${missing}` });
      return;
    }
    if (action.destructive
      && !confirm(`Run "${action.label}" on ${selectedIds.length} browser(s)?`)) return;

    setBusy(true);
    setRuns(selectedIds.map((id) => ({ id, status: "pending" })));

    const outcomes = await Promise.all(
      selectedIds.map((id) => executeOne(action, id)),
    );
    setBusy(false);

    const ok = outcomes.filter(Boolean).length;
    const fail = outcomes.length - ok;
    toast.push({
      tone: fail === 0 ? "success" : "error",
      message: `${action.label}: ${ok} ok${fail ? ` · ${fail} failed` : ""}`,
    });
    onChanged();
    if (action.clearSelectionOnSuccess && fail === 0) onClear();
  }

  async function retryFailed() {
    if (!runs) return;
    const failedIds = runs.filter((r) => r.status === "fail").map((r) => r.id);
    if (failedIds.length === 0) return;
    setBusy(true);
    for (const id of failedIds) updateRun(id, { status: "pending", error: undefined, durationMs: undefined });
    await Promise.all(failedIds.map((id) => executeOne(action, id)));
    setBusy(false);
  }

  function clearResults() {
    setRuns(null);
  }

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-4 rounded-md border border-border bg-card/95 backdrop-blur shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs">
        <span className="font-medium">{selectedIds.length} selected</span>
        <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">Clear selection</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <select
          value={actionId}
          onChange={(e) => { setActionId(e.target.value); setValues({}); setRuns(null); }}
          className="h-8 rounded border border-border bg-card px-2 text-xs"
          disabled={busy}
        >
          {Object.entries(GROUPED).map(([group, items]) =>
            items.length === 0 ? null : (
              <optgroup key={group} label={group}>
                {items.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </optgroup>
            ),
          )}
        </select>

        {action.fields.filter((f) => f.kind !== "checkbox").length === 0 && (
          <span className="text-[11px] text-muted-foreground">No parameters.</span>
        )}
        {action.fields.filter((f) => f.kind !== "checkbox").map((f) => (
          <Input
            key={f.name}
            type={f.kind === "number" ? "number" : "text"}
            placeholder={f.placeholder}
            mono={"mono" in f ? f.mono : false}
            required={f.required}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            className="flex-1 min-w-32"
            disabled={busy}
          />
        ))}

        {action.destructive && action.fields.some((f) => f.kind === "checkbox" && f.name === "force") ? (
          <ForceButton
            force={values.force === "true"}
            onToggleForce={(v) => setValues((prev) => ({ ...prev, force: v ? "true" : "" }))}
            onClick={run}
            loading={busy}
          >
            Run on {selectedIds.length}
          </ForceButton>
        ) : (
          <Button
            size="sm"
            variant={action.destructive ? "danger" : "primary"}
            onClick={run}
            loading={busy}
          >
            Run on {selectedIds.length}
          </Button>
        )}
      </div>

      {onShowDisplay && (
        <div className="flex items-center border-t border-border px-3 py-2">
          <Button size="sm" variant="secondary" onClick={onShowDisplay}>
            Show display ({displayableCount})
          </Button>
        </div>
      )}

      {runs && (
        <BatchResults
          runs={runs}
          busy={busy}
          actionLabel={action.label}
          onRetryFailed={retryFailed}
          onClear={clearResults}
        />
      )}
    </div>
  );
}
