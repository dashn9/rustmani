"use client";

import { FullLogView, type LogSource } from "@/components/browsers/LogStream";
import { PageHeader } from "@/components/PageHeader";
import { StateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconLogs } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { loadConfig } from "@/lib/config";
import { usePolling } from "@/lib/hooks";
import {
  clearRecentExecutions,
  loadRecentExecutions,
  type RecentExecution,
} from "@/lib/recentExecutions";
import { useState } from "react";

type Active = { executionId: string; source: LogSource } | null;

export default function LogsPage() {
  const browsers = usePolling((s) => api.listBrowsers(s), 5000, []);
  const [active, setActive] = useState<Active>(null);
  const [recents, setRecents] = useState<RecentExecution[]>(
    typeof window !== "undefined" ? loadRecentExecutions() : [],
  );
  const fluxConfigured = typeof window !== "undefined" ? !!loadConfig()?.fluxUrl : false;

  const list = browsers.data ?? [];
  const liveIds = new Set(list.map((b) => b.execution_id));
  const orphanRecents = recents.filter((r) => !liveIds.has(r.id));

  function refreshRecents() {
    setRecents(loadRecentExecutions());
  }

  function clearRecents() {
    if (!confirm("Clear recent execution IDs?")) return;
    clearRecentExecutions();
    setRecents([]);
    if (active && active.source === "flux") setActive(null);
  }

  return (
    <div>
      <PageHeader title="Logs" description="Live output from a selected execution." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-border bg-card max-h-[70vh] overflow-y-auto wb-scroll">
          <Group title={`Browsers (${list.length})`}>
            {browsers.loading && !browsers.data ? (
              <div className="space-y-1.5 px-2 py-1">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : list.length === 0 ? (
              <Empty>No browsers.</Empty>
            ) : (
              list.map((b) => (
                <Item
                  key={b.execution_id}
                  selected={active?.executionId === b.execution_id && active.source === "rusty"}
                  onClick={() => setActive({ executionId: b.execution_id, source: "rusty" })}
                >
                  <span className="font-mono truncate flex-1">{b.execution_id}</span>
                  <StateBadge state={b.state} />
                </Item>
              ))
            )}
          </Group>

          <Group
            title={`Recent (${orphanRecents.length})`}
            actions={
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={refreshRecents}>Refresh</Button>
                {recents.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearRecents}>Clear</Button>
                )}
              </div>
            }
          >
            {!fluxConfigured ? (
              <Empty>Configure Flux URL in Settings to read logs for closed executions.</Empty>
            ) : orphanRecents.length === 0 ? (
              <Empty>
                {recents.length === 0
                  ? "No recent executions yet — spawn a browser."
                  : "All recents are still live above."}
              </Empty>
            ) : (
              orphanRecents.map((r) => (
                <Item
                  key={r.id}
                  selected={active?.executionId === r.id && active.source === "flux"}
                  onClick={() => setActive({ executionId: r.id, source: "flux" })}
                >
                  <span className="font-mono truncate flex-1">{r.id}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {timeAgo(r.spawnedAt)}
                  </span>
                </Item>
              ))
            )}
          </Group>
        </aside>

        <section>
          {active ? (
            <FullLogView executionId={active.executionId} source={active.source} />
          ) : (
            <EmptyState
              icon={<IconLogs size={32} />}
              title="Pick an execution"
              description="Select a browser or a recent execution from the list to stream its logs."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Group({
  title, actions, children,
}: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {actions}
      </div>
      <ul className="space-y-0.5 p-2 pt-0">{children}</ul>
    </div>
  );
}

function Item({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted",
          selected && "bg-muted",
        )}
      >
        {children}
      </button>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="px-2 py-3 text-xs text-muted-foreground">{children}</li>;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
