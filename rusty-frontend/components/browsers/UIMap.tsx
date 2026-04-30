"use client";

import { JsonTree } from "@/components/JsonTree";
import { UIMapGraph } from "@/components/browsers/UIMapGraph";
import { Button } from "@/components/ui/Button";
import { IconRefresh } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { describeError } from "@/lib/config";
import { useFetch } from "@/lib/hooks";
import { useState } from "react";

type Mode = "graph" | "json";
type Source = "map" | "diff";

type Props = { browserId: string };

export function UIMap({ browserId }: Props) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("graph");
  const [src, setSrc] = useState<Source>("map");

  const { data, error, loading, refetch } = useFetch(
    (s) => src === "diff" ? api.uiMapDiff(browserId, s) : api.uiMap(browserId, s),
    [browserId, src],
  );

  async function copy() {
    if (data === undefined || data === null) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.push({ tone: "success", message: "UI map copied" });
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    }
  }

  const empty = isEmpty(data);

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-medium">Accessibility tree</span>
          <Toggle
            options={[{ value: "map", label: "Full" }, { value: "diff", label: "Diff" }]}
            value={src}
            onChange={(v) => setSrc(v as Source)}
          />
          <Toggle
            options={[{ value: "graph", label: "Graph" }, { value: "json", label: "JSON" }]}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={refetch} disabled={loading}>
            <IconRefresh size={12} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" variant="ghost" onClick={copy} disabled={empty}>
            Copy JSON
          </Button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-auto wb-scroll">
        {loading && !data ? (
          <div className="p-3 space-y-1.5">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-3 text-xs text-[var(--error)]">{error.message}</div>
        ) : empty ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {src === "diff" ? "No changes since last snapshot." : "No data."}
          </div>
        ) : mode === "graph" ? (
          <UIMapGraph data={data} />
        ) : (
          <div className="p-3"><JsonTree value={data} defaultDepth={2} /></div>
        )}
      </div>
    </div>
  );
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return true;
    return entries.every(([, val]) => isEmpty(val));
  }
  if (typeof v === "string") return v.length === 0;
  return false;
}

function Toggle<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5 bg-background">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2 py-0.5 text-[11px] rounded",
            value === o.value ? "bg-wb text-wb-inverse" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
