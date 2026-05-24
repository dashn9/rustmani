"use client";

import { BatchActionBar } from "@/components/browsers/BatchActionBar";
import { BrowserCard } from "@/components/browsers/BrowserCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBrowsers, IconPlus, IconRefresh, IconTrash } from "@/components/ui/Icon";
import { ForceButton } from "@/components/ui/ForceButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { useToast } from "@/components/ui/Toast";
import { api, type DisplayMode } from "@/lib/api";
import { cn } from "@/lib/cn";
import { describeError } from "@/lib/config";

const DISPLAY_MODES: DisplayMode[] = ["headless", "xvfb", "normal"];
import { usePolling } from "@/lib/hooks";
import { pushRecentExecution } from "@/lib/recentExecutions";
import { useRef, useState } from "react";

export default function BrowsersPage() {
  const toast = useToast();
  const { data, loading, error, refetch } = usePolling(
    (s) => api.listBrowsers(s), 4000, [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [displayed, setDisplayed] = useState<Set<string>>(new Set());
  const [spawning, setSpawning] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [forceClose, setForceClose] = useState(false);
  const [spawnDisplay, setSpawnDisplay] = useState<DisplayMode>("headless");
  const gridRef = useRef<HTMLDivElement>(null);
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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

  function onGridMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest("a,button,input,label")) return;
    const ox = e.clientX;
    const oy = e.clientY;

    function onMove(ev: MouseEvent) {
      setSelBox({
        x: Math.min(ev.clientX, ox),
        y: Math.min(ev.clientY, oy),
        w: Math.abs(ev.clientX - ox),
        h: Math.abs(ev.clientY - oy),
      });
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const box = {
        x: Math.min(ev.clientX, ox),
        y: Math.min(ev.clientY, oy),
        w: Math.abs(ev.clientX - ox),
        h: Math.abs(ev.clientY - oy),
      };
      setSelBox(null);
      if (box.w < 6 || box.h < 6 || !gridRef.current) return;
      const ids: string[] = [];
      gridRef.current.querySelectorAll<HTMLElement>("[data-browser-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!(box.x + box.w < r.left || box.x > r.right || box.y + box.h < r.top || box.y > r.bottom)) {
          const id = el.dataset.browserId;
          if (id) ids.push(id);
        }
      });
      if (ids.length) setSelected(new Set(ids));
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const xvfbIds = new Set(list.filter((b) => b.display === "xvfb").map((b) => b.execution_id));

  function showDisplayForSelected() {
    setDisplayed((d) => {
      const next = new Set(d);
      selected.forEach((id) => { if (xvfbIds.has(id)) next.add(id); });
      return next;
    });
  }

  const displayableCount = Array.from(selected).filter((id) => xvfbIds.has(id) && !displayed.has(id)).length;

  async function closeAll() {
    if (!confirm(`Close all ${counts.total} browser(s)${forceClose ? " (force)" : ""}?`)) return;
    setClosingAll(true);
    try {
      await api.closeAllBrowsers(forceClose);
      toast.push({ tone: "success", message: "All browsers closed." });
      setSelected(new Set());
      setDisplayed(new Set());
      refetch();
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    } finally {
      setClosingAll(false);
    }
  }

  async function spawn() {
    setSpawning(true);
    try {
      const r = await api.spawnBrowser({ display: spawnDisplay });
      pushRecentExecution(r.execution_id);
      toast.push({ tone: "success", message: `Spawning ${r.execution_id.slice(0, 12)}… (${spawnDisplay})` });
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
            {counts.total > 0 && (
              <ForceButton force={forceClose} onToggleForce={setForceClose} onClick={closeAll} loading={closingAll}>
                <IconTrash size={14} /> Close all
              </ForceButton>
            )}
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-border bg-card">
              {DISPLAY_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSpawnDisplay(mode)}
                  aria-pressed={spawnDisplay === mode}
                  className={cn(
                    "px-3 text-xs font-medium transition-colors",
                    spawnDisplay === mode
                      ? "bg-wb text-wb-inverse"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
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
            onShowDisplay={displayableCount > 0 ? showDisplayForSelected : undefined}
            displayableCount={displayableCount}
          />
        )}

        {error ? (
          <div className="rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] p-4 text-sm text-[var(--error)]">
            {error.message}
          </div>
        ) : loading && !data ? (
          <div className="grid gap-4 items-start grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
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
          <div
            ref={gridRef}
            className="grid gap-4 items-start grid-cols-[repeat(auto-fill,minmax(360px,1fr))] select-none"
            onMouseDown={onGridMouseDown}
          >
            {list.map((b) => (
              <div key={b.execution_id} data-browser-id={b.execution_id}>
                <BrowserCard
                  browser={b}
                  selected={selected.has(b.execution_id)}
                  showDisplay={displayed.has(b.execution_id)}
                  onToggleSelect={toggleSelect}
                  onToggleDisplay={toggleDisplay}
                />
              </div>
            ))}
          </div>
        )}

        {selBox && selBox.w > 3 && selBox.h > 3 && (
          <div
            className="pointer-events-none fixed z-50 rounded-sm border border-wb bg-wb/10"
            style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }}
          />
        )}
      </div>

    </div>
  );
}
