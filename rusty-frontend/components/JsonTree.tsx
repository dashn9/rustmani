"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";

type Props = {
  value: unknown;
  /** Auto-expand nodes up to this depth on first render. */
  defaultDepth?: number;
};

export function JsonTree({ value, defaultDepth = 2 }: Props) {
  return (
    <div className="font-mono text-xs leading-relaxed">
      <Node value={value} depth={0} defaultDepth={defaultDepth} />
    </div>
  );
}

function Node({
  value, depth, defaultDepth, label,
}: { value: unknown; depth: number; defaultDepth: number; label?: string | number }) {
  if (value === null) return <Leaf label={label} cls="text-muted-foreground">null</Leaf>;
  if (value === undefined) return <Leaf label={label} cls="text-muted-foreground">undefined</Leaf>;
  if (typeof value === "boolean") return <Leaf label={label} cls="text-[oklch(0.74_0.16_310)]">{String(value)}</Leaf>;
  if (typeof value === "number") return <Leaf label={label} cls="text-[oklch(0.78_0.16_85)]">{value}</Leaf>;
  if (typeof value === "string") return <Leaf label={label} cls="text-[oklch(0.65_0.14_148)]">&quot;{value}&quot;</Leaf>;

  const isArr = Array.isArray(value);
  const entries = isArr
    ? (value as unknown[]).map((v, i) => [i, v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <Branch
      label={label}
      summary={isArr ? `Array(${entries.length})` : `{${entries.length}}`}
      open={depth < defaultDepth}
      bracket={isArr ? ["[", "]"] : ["{", "}"]}
    >
      {entries.map(([k, v]) => (
        <Node key={k} value={v} depth={depth + 1} defaultDepth={defaultDepth} label={k} />
      ))}
    </Branch>
  );
}

function Leaf({
  label, cls, children,
}: { label?: string | number; cls: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      {label !== undefined && <Label k={label} />}
      <span className={cls}>{children}</span>
    </div>
  );
}

function Branch({
  label, summary, open, bracket, children,
}: {
  label?: string | number;
  summary: string;
  open: boolean;
  bracket: [string, string];
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(open);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-baseline gap-1.5 text-left hover:bg-muted/40 rounded px-1 -mx-1"
      >
        <span className={cn(
          "inline-block w-3 text-muted-foreground transition-transform",
          isOpen && "rotate-90",
        )}>▸</span>
        {label !== undefined && <Label k={label} />}
        <span className="text-muted-foreground">{bracket[0]}</span>
        <span className="text-[10px] text-muted-foreground">{summary}</span>
        {!isOpen && <span className="text-muted-foreground">{bracket[1]}</span>}
      </button>
      {isOpen && (
        <div className="ml-4 border-l border-border/60 pl-3">{children}</div>
      )}
      {isOpen && <span className="text-muted-foreground ml-1">{bracket[1]}</span>}
    </div>
  );
}

function Label({ k }: { k: string | number }) {
  return (
    <>
      <span className="text-foreground">
        {typeof k === "number" ? k : k}
      </span>
      <span className="text-muted-foreground">:</span>
    </>
  );
}
