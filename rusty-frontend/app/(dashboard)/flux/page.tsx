"use client";

import { FluxHealth } from "@/components/FluxHealth";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconCheck, IconRefresh, IconTrash } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { describeError, loadConfig } from "@/lib/config";
import { flux, type FluxAgent } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";

export default function FluxPage() {
  const toast = useToast();
  const fluxConfigured = typeof window !== "undefined" ? !!loadConfig()?.fluxUrl : false;
  const agents = usePolling(
    (s) => fluxConfigured ? flux.listAgents(s) : Promise.resolve([] as FluxAgent[]),
    8000,
    [fluxConfigured],
  );

  async function terminateAll() {
    if (!confirm("Terminate ALL Flux nodes? This will kill every running agent.")) return;
    try {
      await flux.terminateAllNodes();
      toast.push({ tone: "success", message: "All nodes terminated" });
      agents.refetch();
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    }
  }

  async function terminate(id: string) {
    if (!confirm(`Terminate node ${id}?`)) return;
    try {
      await flux.terminateNode(id);
      toast.push({ tone: "success", message: "Node terminated" });
      agents.refetch();
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    }
  }

  if (!fluxConfigured) {
    return (
      <div>
        <PageHeader title="Flux" description="Infrastructure that hosts browser agents." />
        <Card>
          <CardBody>
            <Status
              icon={<IconAlert size={18} className="text-muted-foreground" />}
              title="Flux not configured"
              description="Add Flux URL and API key in Settings to manage nodes."
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const list = agents.data ?? [];
  const online = list.filter((a) => a.status === "online").length;

  return (
    <div>
      <PageHeader
        title="Flux"
        description={list.length > 0 ? `${online} of ${list.length} nodes online` : "Infrastructure that hosts browser agents."}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={agents.refetch}
            disabled={agents.loading}
          >
            <IconRefresh size={14} className={agents.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <div className="mb-4">
        <FluxHealth />
      </div>

      <Card className="mb-4">
        {agents.loading && !agents.data && !agents.error ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : agents.error ? (
          <CardBody>
            <Status
              icon={<IconAlert size={18} className="text-[var(--warning)]" />}
              title="Flux unreachable"
              description={agents.error.message}
            />
          </CardBody>
        ) : list.length === 0 ? (
          <CardBody>
            <Status
              icon={<IconCheck size={18} className="text-[var(--success)]" />}
              title="No nodes registered"
              description="Flux is reachable but no agents have joined yet."
            />
          </CardBody>
        ) : (
          <NodeTable agents={list} onTerminate={terminate} />
        )}
      </Card>

      <Card className="border-[var(--error)]/30">
        <CardHeader>
          <CardTitle className="text-[var(--error)]">Danger zone</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
            <div>
              <div className="text-sm font-medium">Terminate all nodes</div>
              <div className="text-xs text-muted-foreground">
                Kill every running agent. This cannot be undone.
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={terminateAll}>
              <IconTrash size={14} /> Terminate all
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function NodeTable({
  agents, onTerminate,
}: { agents: FluxAgent[]; onTerminate: (id: string) => void }) {
  return (
    <div className="overflow-x-auto wb-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <Th>ID</Th><Th>Status</Th><Th>Provider</Th><Th>Address</Th>
            <Th>Memory</Th><Th>CPU</Th><Th>Tasks</Th><Th>Uptime</Th><Th>Last seen</Th><Th />
          </tr>
        </thead>
        <tbody>
          {agents.map((n) => {
            const ns = n.node_status;
            return (
              <tr key={n.id} className="border-b border-border/60 last:border-0">
                <Td><span className="font-mono text-xs">{n.id}</span></Td>
                <Td>
                  <Badge tone={n.status === "online" ? "success" : "neutral"}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      n.status === "online" ? "bg-[var(--success)] wb-pulse" : "bg-muted-foreground",
                    )} />
                    {n.status}
                  </Badge>
                </Td>
                <Td>
                  <div className="font-mono text-xs">{n.provider}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{n.instance_type}</div>
                </Td>
                <Td><span className="font-mono text-xs">{n.address}</span></Td>
                <Td>
                  <MemoryBar
                    used={num(ns?.memory_used_mb)}
                    limit={num(ns?.memory_total_mb)}
                  />
                </Td>
                <Td><span className="font-mono text-xs">{num(ns?.cpu_percent).toFixed(1)}%</span></Td>
                <Td><span className="font-mono text-xs">{n.active_count}</span></Td>
                <Td><span className="font-mono text-xs text-muted-foreground">{formatDuration(num(ns?.uptime_seconds))}</span></Td>
                <Td><span className="font-mono text-xs text-muted-foreground">{format(n.last_heartbeat)}</span></Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => onTerminate(n.id)}>Terminate</Button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MemoryBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-32">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct > 85 ? "bg-[var(--error)]" : pct > 60 ? "bg-[var(--warning)]" : "bg-wb",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        {used}/{limit}
      </span>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-middle">{children}</td>;
}

function Status({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

function format(iso: string | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDuration(s: number): string {
  if (s <= 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
