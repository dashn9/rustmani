"use client";

import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Browser } from "@/lib/api";

type Props = {
  browser: Browser;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
};

export function BrowserCard({ browser: b, selected, onToggleSelect, onOpen }: Props) {
  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all hover:border-wb-300",
        selected && "ring-2 ring-wb ring-offset-2 ring-offset-background border-wb",
      )}
      onClick={() => onOpen(b.id)}
    >
      <label
        className="absolute top-3 right-3 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(b.id)}
          className="h-4 w-4 rounded border-border accent-wb"
          aria-label={`Select ${b.id}`}
        />
      </label>
      <div className="p-4">
        <div className="flex items-start justify-between pr-7">
          <div className="font-mono text-xs text-muted-foreground truncate">
            {b.id}
          </div>
        </div>
        <div className="mt-2"><StatusBadge status={b.status} /></div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <Field label="Host" value={b.host ?? "—"} mono />
          <Field label="gRPC" value={b.grpc_port ?? "—"} mono />
          <Field label="Ctx" value={b.context_count ?? 0} mono />
        </dl>
      </div>
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
