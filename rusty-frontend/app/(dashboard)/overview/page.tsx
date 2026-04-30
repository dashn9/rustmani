"use client";

import { AreaChart, BarChart, DonutChart } from "@/components/Charts";
import { FluxHealth } from "@/components/FluxHealth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconRefresh } from "@/components/ui/Icon";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { loadConfig } from "@/lib/config";
import { flux, type FluxAgent } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";
import { loadRecentExecutions, type RecentExecution } from "@/lib/recentExecutions";
import { useEffect, useState } from "react";

export default function OverviewPage() {
  const browsers = usePolling((s) => api.listBrowsers(s), 5000, []);
  const fluxConfigured = typeof window !== "undefined" ? !!loadConfig()?.fluxUrl : false;
  const agents = usePolling(
    (s) => fluxConfigured ? flux.listAgents(s) : Promise.resolve([] as FluxAgent[]),
    10000,
    [fluxConfigured],
  );

  const [recents, setRecents] = useState<RecentExecution[]>([]);
  useEffect(() => {
    setRecents(loadRecentExecutions());
    const id = setInterval(() => setRecents(loadRecentExecutions()), 10_000);
    return () => clearInterval(id);
  }, []);

  const list = browsers.data ?? [];
  const nodes = agents.data ?? [];
  const counts = {
    total: list.length,
    idle: list.filter((b) => b.state === "idle").length,
    reserved: list.filter((b) => b.state === "reserved").length,
    partial: list.filter((b) => b.state === "partial_reserved").length,
  };
  const onlineNodes = nodes.filter((n) => n.status === "online").length;
  const offlineNodes = nodes.length - onlineNodes;
  const totalActive = nodes.reduce((s, n) => s + (Number(n.active_count) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Full system state at a glance."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { browsers.refetch(); agents.refetch(); }}
            disabled={browsers.loading || agents.loading}
          >
            <IconRefresh size={14} className={browsers.loading || agents.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Browsers" value={counts.total} loading={browsers.loading && !browsers.data} />
        <Stat label="Active tasks" value={totalActive} tone="success" loading={agents.loading && !agents.data} />
        <Stat label="Nodes online" value={`${onlineNodes}/${nodes.length}`} loading={agents.loading && !agents.data} />
        <Stat label="Errors" value={counts.partial} tone={counts.partial > 0 ? "warning" : "default"} loading={browsers.loading && !browsers.data} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Spawns · last 24 h</CardTitle></CardHeader>
          <CardBody><AreaChart data={spawnSeries(recents)} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Browser state</CardTitle></CardHeader>
          <CardBody>
            <DonutChart
              data={[
                { label: "idle", value: counts.idle },
                { label: "reserved", value: counts.reserved, color: "var(--success)" },
                { label: "partial", value: counts.partial, color: "var(--warning)" },
              ]}
            />
          </CardBody>
        </Card>
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-semibold mb-3">Flux nodes</h2>
        {!fluxConfigured ? (
          <Card><CardBody><NotConfigured /></CardBody></Card>
        ) : agents.error ? (
          <Card><CardBody><Unreachable msg={agents.error.message} /></CardBody></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Node status</CardTitle></CardHeader>
              <CardBody>
                <DonutChart
                  data={[
                    { label: "online", value: onlineNodes, color: "var(--success)" },
                    { label: "offline", value: offlineNodes, color: "var(--muted-foreground)" },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Memory used (MB)</CardTitle></CardHeader>
              <CardBody>
                <BarChart data={nodes.map((n) => ({
                  label: shortId(n.id),
                  value: Number(n.node_status?.memory_used_mb ?? 0),
                }))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>CPU %</CardTitle></CardHeader>
              <CardBody>
                <BarChart
                  accent="var(--accent)"
                  data={nodes.map((n) => ({
                    label: shortId(n.id),
                    value: Number(n.node_status?.cpu_percent ?? 0),
                  }))}
                />
              </CardBody>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Active tasks per node</CardTitle></CardHeader>
              <CardBody>
                <BarChart
                  accent="var(--success)"
                  data={nodes.map((n) => ({
                    label: shortId(n.id),
                    value: Number(n.active_count ?? 0),
                  }))}
                />
              </CardBody>
            </Card>
          </div>
        )}
      </section>

      <section className="mt-4">
        <FluxHealth />
      </section>
    </div>
  );
}

function spawnSeries(recents: RecentExecution[]): { x: string; y: number }[] {
  const now = Date.now();
  const buckets: Map<number, number> = new Map();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 60 * 60 * 1000);
    t.setMinutes(0, 0, 0);
    buckets.set(t.getTime(), 0);
  }
  for (const r of recents) {
    const t = new Date(r.spawnedAt);
    t.setMinutes(0, 0, 0);
    const key = t.getTime();
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([ts, y]) => ({
    x: `${new Date(ts).getHours()}h`,
    y,
  }));
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 14)}…` : id;
}

function NotConfigured() {
  return (
    <div className="flex items-center gap-3">
      <IconAlert size={18} className="text-muted-foreground" />
      <div>
        <div className="text-sm font-medium">Flux not configured</div>
        <div className="text-xs text-muted-foreground">
          Add Flux URL and API key in Settings to surface infrastructure metrics.
        </div>
      </div>
    </div>
  );
}

function Unreachable({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconAlert size={18} className="text-[var(--warning)]" />
      <div>
        <div className="text-sm font-medium">Flux unreachable</div>
        <div className="text-xs text-muted-foreground">{msg}</div>
      </div>
    </div>
  );
}
