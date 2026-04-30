"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { IconAlert, IconCheck } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadConfig } from "@/lib/config";
import { flux } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";

type Props = {
  /** Render inside its own Card with header. Set false to embed inline. */
  card?: boolean;
};

export function FluxHealth({ card = true }: Props) {
  const fluxConfigured = typeof window !== "undefined" ? !!loadConfig()?.fluxUrl : false;
  const health = usePolling(
    () => fluxConfigured ? flux.health() : Promise.resolve(null),
    15000,
    [fluxConfigured],
  );

  let body: React.ReactNode;
  if (!fluxConfigured) {
    body = (
      <Row
        icon={<IconAlert size={18} className="text-muted-foreground" />}
        title="Flux not configured"
        description="Add Flux URL and API key in Settings to surface infrastructure health."
      />
    );
  } else if (health.loading && !health.data && !health.error) {
    body = <Skeleton className="h-9 w-64" />;
  } else if (health.error) {
    body = (
      <Row
        icon={<IconAlert size={18} className="text-[var(--warning)]" />}
        title="Flux unreachable"
        description={health.error.message}
      />
    );
  } else {
    body = (
      <Row
        icon={<IconCheck size={18} className="text-[var(--success)]" />}
        title="Flux is healthy"
        description="Reached /health successfully."
      />
    );
  }

  if (!card) return body;
  return (
    <Card>
      <CardHeader><CardTitle>Health</CardTitle></CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
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
