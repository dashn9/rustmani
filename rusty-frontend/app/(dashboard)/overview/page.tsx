"use client";

import { BarChart } from "@/components/Charts";
import { FluxHealth } from "@/components/FluxHealth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconRefresh } from "@/components/ui/Icon";
import { Stat } from "@/components/ui/Stat";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/hooks";

export default function OverviewPage() {
  const browsers = usePolling((s) => api.listBrowsers(s), 5000, []);

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
            onClick={browsers.refetch}
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
        <FluxHealth />
      </section>
    </div>
  );
}
