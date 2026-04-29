"use client";

import { BarChart } from "@/components/Charts";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconCheck, IconRefresh } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { loadConfig } from "@/lib/config";
import { flux } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";

export default function OverviewPage() {
  const browsers = usePolling((s) => api.listBrowsers(s), 5000, []);
  const fluxConfigured = typeof window !== "undefined" ? !!loadConfig()?.fluxUrl : false;
  const fluxHealth = usePolling(
    () => fluxConfigured ? flux.health() : Promise.resolve(null),
    15000,
    [fluxConfigured],
  );

  const list = browsers.data ?? [];
  const counts = {
    total: list.length,
    idle: list.filter((b) => b.state === "idle").length,
    reserved: list.filter((b) => b.state === "reserved").length,
    partial: list.filter((b) => b.state === "partial_reserved").length,
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
            onClick={() => { browsers.refetch(); fluxHealth.refetch(); }}
            disabled={browsers.loading}
          >
            <IconRefresh size={14} className={browsers.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total" value={counts.total} loading={browsers.loading && !browsers.data} />
        <Stat label="Idle" value={counts.idle} loading={browsers.loading && !browsers.data} />
        <Stat label="Reserved" value={counts.reserved} tone="success" loading={browsers.loading && !browsers.data} />
        <Stat label="Partial" value={counts.partial} tone="warning" loading={browsers.loading && !browsers.data} />
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Contexts per browser</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart
              data={list.map((b) => ({ label: b.execution_id, value: b.contexts.length }))}
            />
          </CardBody>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold mb-3">Flux</h2>
        <Card>
          <CardBody>
            <FluxStatus
              configured={fluxConfigured}
              loading={fluxHealth.loading && !fluxHealth.data && !fluxHealth.error}
              error={fluxHealth.error}
            />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function FluxStatus({
  configured, loading, error,
}: { configured: boolean; loading: boolean; error: Error | null }) {
  if (!configured) {
    return (
      <Row
        icon={<IconAlert size={18} className="text-muted-foreground" />}
        title="Flux not configured"
        description="Add Flux URL and API key in Settings to surface infrastructure health."
      />
    );
  }
  if (loading) return <Skeleton className="h-9 w-64" />;
  if (error) {
    return (
      <Row
        icon={<IconAlert size={18} className="text-[var(--warning)]" />}
        title="Flux unreachable"
        description={error.message}
      />
    );
  }
  return (
    <Row
      icon={<IconCheck size={18} className="text-[var(--success)]" />}
      title="Flux is healthy"
      description="Reached /health successfully."
    />
  );
}

function Row({
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
