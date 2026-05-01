"use client";

import { BatchActionBar } from "@/components/browsers/BatchActionBar";
import { BrowserCard } from "@/components/browsers/BrowserCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBrowsers, IconPlus, IconRefresh } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { describeError } from "@/lib/config";
import { usePolling } from "@/lib/hooks";
import { pushRecentExecution } from "@/lib/recentExecutions";
import { useState } from "react";

export default function BrowsersPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = usePolling(
    (s) => api.listBrowsers(s), 4000, [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [displayed, setDisplayed] = useState<Set<string>>(new Set());
  const [spawning, setSpawning] = useState(false);

  const list = data ?? [];
  const counts = {
    total: list.length,
    idle: list.filter((b) => b.state === "idle").length,
    reserved: list.filter((b) => b.state === "reserved").length,
    partial: list.filter((b) => b.state === "partial_reserved").length,
  };

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleDisplay(id: string) {
    setDisplayed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function spawn() {
    setSpawning(true);
    try {
      const r = await api.spawnBrowser();
      pushRecentExecution(r.execution_id);
      toast.push({ tone: "success", message: `Spawning ${r.execution_id.slice(0, 12)}…` });
      refetch();
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    } finally {
      setSpawning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Browsers"
        description="Spawn, control, and observe agents."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
              <IconRefresh size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button size="sm" onClick={spawn} loading={spawning}>
              <IconPlus size={14} /> Spawn
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total" value={counts.total} loading={loading && !data} />
        <Stat label="Idle" value={counts.idle} loading={loading && !data} />
        <Stat label="Reserved" value={counts.reserved} tone="success" loading={loading && !data} />
        <Stat label="Partial" value={counts.partial} tone="warning" loading={loading && !data} />
      </section>

      <div className="mt-8">
        {selected.size > 0 && (
          <BatchActionBar
            selectedIds={Array.from(selected)}
            onClear={() => setSelected(new Set())}
            onChanged={refetch}
          />
        )}

        {error ? (
          <div className="rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] p-4 text-sm text-[var(--error)]">
            {error.message}
          </div>
        ) : loading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<IconBrowsers size={32} />}
            title="No browsers yet"
            description="Spawn your first agent to start automating browsers."
            action={
              <Button onClick={spawn} loading={spawning}>
                <IconPlus size={14} /> Spawn browser
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {[...list]
              .sort((a, b) => Number(displayed.has(b.execution_id)) - Number(displayed.has(a.execution_id)))
              .map((b) => (
              <BrowserCard
                key={b.execution_id}
                browser={b}
                selected={selected.has(b.execution_id)}
                showDisplay={displayed.has(b.execution_id)}
                onToggleSelect={toggleSelect}
                onToggleDisplay={toggleDisplay}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
