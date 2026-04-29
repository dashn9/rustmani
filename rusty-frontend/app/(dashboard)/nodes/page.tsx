"use client";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconCheck, IconRefresh, IconTrash } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { describeError, loadConfig } from "@/lib/config";
import { flux } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";

export default function NodesPage() {
  const toast = useToast();
  const fluxConfigured = typeof window !== "undefined" ? !!loadConfig()?.fluxUrl : false;
  const health = usePolling(
    () => fluxConfigured ? flux.health() : Promise.resolve(null),
    10000,
    [fluxConfigured],
  );

  async function terminateAll() {
    if (!confirm("Terminate ALL Flux nodes? This will kill every running agent.")) return;
    try {
      await flux.terminateAllNodes();
      toast.push({ tone: "success", message: "Flux nodes terminated" });
    } catch (e) {
      toast.push({ tone: "error", message: describeError(e) });
    }
  }

  if (!fluxConfigured) {
    return (
      <div>
        <PageHeader title="Nodes" description="Flux infrastructure." />
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

  return (
    <div>
      <PageHeader
        title="Nodes"
        description="Flux infrastructure registered with this control plane."
        actions={
          <Button variant="secondary" size="sm" onClick={health.refetch} disabled={health.loading}>
            <IconRefresh size={14} className={health.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Flux health</CardTitle>
        </CardHeader>
        <CardBody>
          {health.loading && !health.data && !health.error ? (
            <Skeleton className="h-9 w-64" />
          ) : health.error ? (
            <Status
              icon={<IconAlert size={18} className="text-[var(--warning)]" />}
              title="Flux unreachable"
              description={health.error.message}
            />
          ) : (
            <Status
              icon={<IconCheck size={18} className="text-[var(--success)]" />}
              title="Flux is healthy"
              description="Reached /health successfully."
            />
          )}
        </CardBody>
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
