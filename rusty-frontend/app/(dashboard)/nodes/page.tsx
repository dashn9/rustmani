"use client";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconAlert, IconChevronDown, IconChevronRight, IconRefresh } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { type Node } from "@/lib/api";
import { flux } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";
import { useState } from "react";

export default function NodesPage() {
  const { data, loading, error, refetch } = usePolling(
    () => flux.listAgents(), 8000, [],
  );

  return (
    <div>
      <PageHeader
        title="Nodes"
        description="Flux infrastructure registered with this control plane."
        actions={
          <Button variant="secondary" size="sm" onClick={refetch}>
            <IconRefresh size={14} /> Refresh
          </Button>
        }
      />
      {error ? (
        <Card>
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <IconAlert size={28} className="text-[var(--warning)]" />
            <h3 className="mt-3 text-sm font-semibold">Flux unreachable</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {error.message || "Could not reach the Flux API."}
            </p>
            <Button className="mt-5" size="sm" onClick={refetch}>Retry</Button>
          </div>
        </Card>
      ) : loading && !data ? (
        <Card>
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </Card>
      ) : (
        <Card>
          <NodeTable nodes={data ?? []} onTerminated={refetch} />
        </Card>
      )}
    </div>
  );
}

function NodeTable({ nodes, onTerminated }: { nodes: Node[]; onTerminated: () => void }) {
  if (nodes.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No nodes registered.</div>;
  }
  return (
    <div className="overflow-x-auto wb-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <Th className="w-8" />
            <Th>ID</Th><Th>Status</Th><Th>Platform</Th>
            <Th>Memory</Th><Th>CPU</Th><Th>Functions</Th><Th>Joined</Th><Th />
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => <NodeRow key={n.id} node={n} onTerminated={onTerminated} />)}
        </tbody>
      </table>
    </div>
  );
}

function NodeRow({ node: n, onTerminated }: { node: Node; onTerminated: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function terminate() {
    if (!confirm(`Terminate node ${n.id}?`)) return;
    try {
      await flux.terminateNode(n.id);
      toast.push({ tone: "success", message: "Node terminated" });
      onTerminated();
    } catch (e) {
      toast.push({ tone: "error", message: (e as Error).message });
    }
  }

  return (
    <>
      <tr className="border-b border-border/60">
        <Td>
          <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground">
            {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </button>
        </Td>
        <Td><span className="font-mono text-xs">{n.id.slice(0, 14)}</span></Td>
        <Td><StatusBadge status={n.status === "online" ? "active" : "error"} /></Td>
        <Td><span className="font-mono text-xs">{n.platform}</span></Td>
        <Td>
          <MemoryBar used={n.memory_used_mb} limit={n.memory_limit_mb} />
        </Td>
        <Td><span className="font-mono text-xs">{n.cpu_percent.toFixed(1)}%</span></Td>
        <Td><span className="font-mono text-xs">{n.functions.join(", ") || "—"}</span></Td>
        <Td><span className="font-mono text-xs text-muted-foreground">{format(n.registered_at)}</span></Td>
        <Td>
          <Button size="sm" variant="ghost" onClick={terminate}>Terminate</Button>
        </Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="bg-muted/40 border-b border-border/60">
            <div className="px-6 py-4 text-xs space-y-1.5">
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <Detail label="Full ID" value={<span className="font-mono">{n.id}</span>} />
                <Detail label="Memory limit" value={`${n.memory_limit_mb} MB`} />
                <Detail label="Functions" value={n.functions.join(", ") || "—"} />
                {n.uptime_seconds != null && (
                  <Detail label="Uptime" value={formatDuration(n.uptime_seconds)} />
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("px-4 py-2.5 text-left font-medium", className)}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-middle">{children}</td>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function format(iso: string | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
