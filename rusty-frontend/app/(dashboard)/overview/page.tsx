"use client";

import { AreaChart, BarChart } from "@/components/Charts";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconRefresh } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api, type Browser, type Node } from "@/lib/api";
import { flux } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";

export default function OverviewPage() {
  const browsers = usePolling((s) => api.listBrowsers(s), 5000, []);
  const nodes = usePolling(() => flux.listAgents(), 10000, []);

  const list = browsers.data ?? [];
  const counts = {
    total: list.length,
    active: list.filter((b) => b.status === "active").length,
    idle: list.filter((b) => b.status === "idle").length,
    errors: list.filter((b) => b.status === "error").length,
  };

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Full system state at a glance."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { browsers.refetch(); nodes.refetch(); }}
          >
            <IconRefresh size={14} /> Refresh
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total" value={counts.total} loading={browsers.loading && !browsers.data} />
        <Stat label="Active" value={counts.active} tone="success" loading={browsers.loading && !browsers.data} />
        <Stat label="Idle" value={counts.idle} loading={browsers.loading && !browsers.data} />
        <Stat label="Errors" value={counts.errors} tone={counts.errors > 0 ? "error" : "default"} loading={browsers.loading && !browsers.data} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Browsers spawned over time</CardTitle>
          </CardHeader>
          <CardBody>
            <AreaChart data={spawnSeries(list)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contexts per agent</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart
              data={list.map((b) => ({ label: b.id, value: b.context_count ?? 0 }))}
            />
          </CardBody>
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nodes</h2>
          {nodes.error && <FluxUnreachable />}
        </div>
        <Card>
          <NodesTable
            nodes={nodes.data ?? []}
            loading={nodes.loading && !nodes.data && !nodes.error}
            unreachable={!!nodes.error}
          />
        </Card>
      </section>
    </div>
  );
}

function FluxUnreachable() {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--warning)]">
      <IconAlert size={14} />
      Flux unreachable
    </div>
  );
}

function NodesTable({
  nodes, loading, unreachable,
}: { nodes: Node[]; loading: boolean; unreachable: boolean }) {
  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  }
  if (unreachable) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Flux is not reachable — node infrastructure data unavailable. Browser stats above remain accurate.
      </div>
    );
  }
  if (nodes.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No nodes registered.</div>;
  }
  return (
    <div className="overflow-x-auto wb-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <Th>ID</Th><Th>Status</Th><Th>Platform</Th><Th>Memory</Th><Th>CPU</Th><Th>Functions</Th><Th>Joined</Th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr key={n.id} className="border-b border-border/60 last:border-0">
              <Td><span className="font-mono text-xs">{n.id.slice(0, 12)}</span></Td>
              <Td>
                <StatusBadge status={n.status === "online" ? "active" : "error"} />
              </Td>
              <Td><span className="font-mono text-xs">{n.platform}</span></Td>
              <Td><span className="font-mono text-xs">{n.memory_used_mb}/{n.memory_limit_mb} MB</span></Td>
              <Td><span className="font-mono text-xs">{n.cpu_percent.toFixed(1)}%</span></Td>
              <Td><span className="font-mono text-xs">{n.functions.join(", ") || "—"}</span></Td>
              <Td><span className="font-mono text-xs text-muted-foreground">{formatTime(n.registered_at)}</span></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5">{children}</td>;
}

export function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function spawnSeries(list: Browser[]): { x: string; y: number }[] {
  if (list.length === 0) return [];
  const buckets = new Map<string, number>();
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 60 * 60 * 1000);
    buckets.set(`${t.getHours()}h`, 0);
  }
  for (const b of list) {
    if (!b.created_at) continue;
    const d = new Date(b.created_at);
    const key = `${d.getHours()}h`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([x, y]) => ({ x, y }));
}
