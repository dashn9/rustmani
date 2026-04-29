"use client";

import { FullLogView } from "@/components/browsers/LogStream";
import { PageHeader } from "@/components/PageHeader";
import { StateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconLogs } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import { useState } from "react";

export default function LogsPage() {
  const browsers = usePolling((s) => api.listBrowsers(s), 5000, []);
  const [active, setActive] = useState<string | null>(null);
  const list = browsers.data ?? [];

  return (
    <div>
      <PageHeader title="Logs" description="Live output from a selected browser." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-2 max-h-[70vh] overflow-y-auto wb-scroll">
          {browsers.loading && !browsers.data ? (
            <div className="space-y-1.5 p-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No browsers.</div>
          ) : (
            <ul className="space-y-0.5">
              {list.map((b) => (
                <li key={b.execution_id}>
                  <button
                    onClick={() => setActive(b.execution_id)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted",
                      active === b.execution_id && "bg-muted",
                    )}
                  >
                    <span className="font-mono truncate flex-1">{b.execution_id.slice(0, 12)}…</span>
                    <StateBadge state={b.state} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section>
          {active ? (
            <FullLogView browserId={active} />
          ) : (
            <EmptyState
              icon={<IconLogs size={32} />}
              title="Pick a browser"
              description="Select a browser from the list to stream its logs."
            />
          )}
        </section>
      </div>
    </div>
  );
}
