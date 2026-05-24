"use client";

import { DisplayStream } from "@/components/browsers/DisplayStream";
import { StateBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Browser } from "@/lib/api";
import Link from "next/link";

type Props = {
  browser: Browser;
  selected: boolean;
  showDisplay: boolean;
  onToggleSelect: (id: string) => void;
  onToggleDisplay: (id: string) => void;
};

export function BrowserCard({
  browser: b, selected, showDisplay, onToggleSelect, onToggleDisplay,
}: Props) {
  return (
    <Card
      className={cn(
        "relative flex flex-col overflow-hidden transition-all hover:border-wb-300",
        selected && "ring-2 ring-wb ring-offset-2 ring-offset-background border-wb",
        showDisplay && "",
      )}
    >
      <div
        className="absolute top-2.5 right-2.5 z-10 flex items-center gap-2 rounded-md bg-card/85 px-1.5 py-1 backdrop-blur border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {b.display === "xvfb" ? (
          <button
            type="button"
            onClick={() => onToggleDisplay(b.execution_id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {showDisplay ? "Hide display" : "Show display"}
          </button>
        ) : (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/70"
            title={`Display streaming requires the "xvfb" mode at spawn. This browser was started as "${b.display}".`}
          >
            No display ({b.display})
          </span>
        )}
        <label className="cursor-pointer flex items-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(b.execution_id)}
            className="h-4 w-4 rounded border-border accent-wb"
            aria-label={`Select ${b.execution_id}`}
          />
        </label>
      </div>

      {showDisplay && b.display === "xvfb" && (
        <div className="border-b border-border">
          <DisplayStream browserId={b.execution_id} className="!rounded-none !border-0" />
        </div>
      )}

      <Link href={`/browsers/${b.execution_id}`} className="block p-4">
        <div className="font-mono text-xs text-muted-foreground truncate pr-40">
          {b.execution_id}
        </div>
        <div className="mt-2"><StateBadge state={b.state} /></div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <Field label="IP" value={b.public_ip || b.private_ip || "—"} mono />
          <Field label="gRPC" value={b.grpc_port || "—"} mono />
          <Field label="Ctx" value={b.contexts.length} mono />
        </dl>
      </Link>
    </Card>
  );
}

function Field({
  label, value, mono,
}: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
