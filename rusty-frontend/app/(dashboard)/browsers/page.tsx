"use client";

import { BatchActionBar } from "@/components/browsers/BatchActionBar";
import { BrowserCard } from "@/components/browsers/BrowserCard";
import { BrowserDetail } from "@/components/browsers/BrowserDetail";
import { SpawnModal } from "@/components/browsers/SpawnModal";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBrowsers, IconPlus, IconRefresh } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import { useState } from "react";

export default function BrowsersPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = usePolling(
    (s) => api.listBrowsers(s), 4000, [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [spawning, setSpawning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = data ?? [];
  const counts = {
    total: list.length,
    active: list.filter((b) => b.status === "active").length,
    idle: list.filter((b) => b.status === "idle").length,
    errors: list.filter((b) => b.status === "error").length,
  };

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Browsers"
        description="Spawn, control, and observe agents."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={refetch}>
              <IconRefresh size={14} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setSpawning(true)}>
              <IconPlus size={14} /> Spawn
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total" value={counts.total} loading={loading && !data} />
        <Stat label="Active" value={counts.active} tone="success" loading={loading && !data} />
        <Stat label="Idle" value={counts.idle} loading={loading && !data} />
        <Stat label="Errors" value={counts.errors} tone={counts.errors > 0 ? "error" : "default"} loading={loading && !data} />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<IconBrowsers size={32} />}
            title="No browsers yet"
            description="Spawn your first agent to start automating browsers."
            action={
              <Button onClick={() => setSpawning(true)}>
                <IconPlus size={14} /> Spawn browser
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((b) => (
              <BrowserCard
                key={b.id}
                browser={b}
                selected={selected.has(b.id)}
                onToggleSelect={toggleSelect}
                onOpen={(id) => setOpenId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <SpawnModal
        open={spawning}
        onClose={() => setSpawning(false)}
        onConfirm={async (geo) => {
          await api.spawnBrowser(geo);
          toast.push({ tone: "success", message: "Browser spawning" });
          refetch();
        }}
      />

      <BrowserDetail
        browserId={openId}
        onClose={() => setOpenId(null)}
        onChanged={refetch}
      />
    </div>
  );
}
