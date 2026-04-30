"use client";

import { DisplayStream } from "@/components/browsers/DisplayStream";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconBrowsers } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

export default function BatchDisplayPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <BatchDisplay />
    </Suspense>
  );
}

function BatchDisplay() {
  const params = useSearchParams();
  const filterIds = useMemo(() => {
    const raw = params.get("ids");
    if (!raw) return null;
    return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  }, [params]);

  const { data, loading, error } = usePolling(
    (s) => api.listBrowsers(s),
    8000,
    [],
  );

  const browsers = useMemo(() => {
    const all = data ?? [];
    return filterIds ? all.filter((b) => filterIds.has(b.execution_id)) : all;
  }, [data, filterIds]);

  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFocused(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div>
      <PageHeader
        title="Live displays"
        description={
          filterIds
            ? `Watching ${browsers.length} of ${data?.length ?? 0} browser(s).`
            : "Watching all browsers. Add ?ids=… to limit."
        }
        actions={
          <Link href="/browsers">
            <Button variant="secondary" size="sm">Back to browsers</Button>
          </Link>
        }
      />

      {error ? (
        <div className="rounded-md border border-[var(--error)]/30 bg-[color-mix(in_oklch,var(--error)_8%,var(--card))] p-4 text-sm text-[var(--error)]">
          {error.message}
        </div>
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-video w-full" />)}
        </div>
      ) : browsers.length === 0 ? (
        <EmptyState
          icon={<IconBrowsers size={32} />}
          title="No displays to show"
          description={
            filterIds
              ? "None of the selected browsers are running."
              : "Spawn a browser to see its display here."
          }
        />
      ) : (
        <div className={focused ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"}>
          {browsers.map((b) => {
            const isFocused = focused === b.execution_id;
            const hidden = focused !== null && !isFocused;
            if (hidden) return null;
            return (
              <DisplayTile
                key={b.execution_id}
                executionId={b.execution_id}
                state={b.state}
                expanded={isFocused}
                onToggle={() => setFocused(isFocused ? null : b.execution_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DisplayTile({
  executionId, state, expanded, onToggle,
}: {
  executionId: string;
  state: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={expanded ? "space-y-2" : "space-y-1.5"}>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono text-muted-foreground truncate flex-1">{executionId}</span>
        <span className="font-mono text-[10px] text-muted-foreground uppercase">{state}</span>
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? "shrink" : "expand"}
        </button>
        <Link
          href={`/browsers/${executionId}`}
          className="text-[var(--accent)] hover:underline"
        >
          open
        </Link>
      </div>
      <DisplayStream
        browserId={executionId}
        viewOnly={!expanded}
      />
    </div>
  );
}
