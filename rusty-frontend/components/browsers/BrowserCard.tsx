"use client";

import { StateBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Browser } from "@/lib/api";
import Link from "next/link";

type Props = {
  browser: Browser;
  selected: boolean;
  onToggleSelect: (id: string) => void;
};

export function BrowserCard({ browser: b, selected, onToggleSelect }: Props) {
  return (
    <Card
      className={cn(
        "relative transition-all hover:border-wb-300",
        selected && "ring-2 ring-wb ring-offset-2 ring-offset-background border-wb",
      )}
    >
      <label
        className="absolute top-3 right-3 cursor-pointer z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(b.execution_id)}
          className="h-4 w-4 rounded border-border accent-wb"
          aria-label={`Select ${b.execution_id}`}
        />
      </label>
      <Link href={`/browsers/${b.execution_id}`} className="block p-4">
        <div className="font-mono text-xs text-muted-foreground truncate pr-7">
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
