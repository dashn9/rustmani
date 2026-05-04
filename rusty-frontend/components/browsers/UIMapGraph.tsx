"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";

type Props = {
  data: unknown;
  className?: string;
};

type GraphNode = {
  id: string;
  nodeId?: number | string;
  label: string;
  sub?: string;
  meta?: unknown;
  children: GraphNode[];
};

export function UIMapGraph({ data, className }: Props) {
  const roots = toGraph(data);
  if (roots.length === 0) {
    return <div className={cn("p-4 text-xs text-muted-foreground", className)}>Empty tree.</div>;
  }
  return (
    <div className={cn("overflow-auto wb-scroll p-6", className)}>
      <div className="flex justify-center min-w-max">
        <div className="flex gap-8 items-start">
          {roots.map((r) => <Subtree key={r.id} node={r} />)}
        </div>
      </div>
    </div>
  );
}

function Subtree({ node }: { node: GraphNode }) {
  const [open, setOpen] = useState(true);
  const hasKids = node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <NodeBox node={node} expandable={hasKids} open={open} onToggle={() => setOpen((v) => !v)} />
      {hasKids && open && (
        <div className="relative mt-3 flex items-start gap-4 pt-3">
          {node.children.length > 1 && (
            <div className="absolute left-0 right-0 top-0 border-t border-border" aria-hidden />
          )}
          {node.children.map((c) => (
            <div key={c.id} className="relative flex flex-col items-center">
              <div className="absolute left-1/2 -top-3 h-3 w-px bg-border" aria-hidden />
              <Subtree node={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeBox({
  node, expandable, open, onToggle,
}: { node: GraphNode; expandable: boolean; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={expandable ? onToggle : undefined}
      className={cn(
        "rounded-md border border-border bg-card px-3 py-2 text-left shadow-sm",
        "min-w-32 max-w-52 transition-colors",
        expandable && "hover:border-wb-300",
      )}
      title={node.meta ? JSON.stringify(node.meta, null, 2) : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
          {node.label}
        </span>
        {node.nodeId !== undefined && node.nodeId !== null && (
          <span className="font-mono text-[9px] text-muted-foreground">#{node.nodeId}</span>
        )}
        {expandable && (
          <span className="ml-auto font-mono text-[9px] text-muted-foreground">
            {open ? "−" : `+${countDescendants(node)}`}
          </span>
        )}
      </div>
      {node.sub && <div className="mt-0.5 text-xs truncate">{node.sub}</div>}
    </button>
  );
}

function countDescendants(n: GraphNode): number {
  return n.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

type FlatItem = {
  id?: number | string;
  parent_id?: number | string;
  role?: string;
  name?: string;
  url?: string;
  text?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
  nodes?: unknown[];
};

function toGraph(value: unknown): GraphNode[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const items = value as FlatItem[];
    if (items.some((v) => v && typeof v === "object" && "parent_id" in v)) {
      return buildFromFlat(items);
    }
    return items.flatMap((v, i) => normalizeRecursive(v, `r${i}`));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Single node-like object?
    if ("role" in obj || "id" in obj || "children" in obj || "nodes" in obj) {
      return normalizeRecursive(obj as FlatItem, "r0");
    }
    // Otherwise treat each value as its own labelled subtree (diff/grouped shape)
    const groups: GraphNode[] = [];
    for (const [key, v] of Object.entries(obj)) {
      const sub = toGraph(v);
      if (sub.length === 0) continue;
      groups.push({
        id: `grp-${key}`,
        label: key,
        sub: `${sub.length} ${sub.length === 1 ? "item" : "items"}`,
        children: sub,
      });
    }
    return groups;
  }
  return [];
}

function buildFromFlat(items: FlatItem[]): GraphNode[] {
  const graphs: GraphNode[] = items.map((item, i) => ({
    id: `n${i}`,
    nodeId: item.id,
    label: String(item.role ?? "node"),
    sub: subtitleFor(item),
    meta: item,
    children: [],
  }));
  // Only register non-zero ids — id=0 is used as a placeholder for many leaf
  // InlineTextBox entries and would collide.
  const byId = new Map<string, GraphNode>();
  items.forEach((item, i) => {
    if (item.id !== undefined && item.id !== null && item.id !== 0) {
      byId.set(String(item.id), graphs[i]);
    }
  });
  const roots: GraphNode[] = [];
  items.forEach((item, i) => {
    const node = graphs[i];
    if (item.parent_id === undefined || item.parent_id === null) {
      roots.push(node);
      return;
    }
    const parent = byId.get(String(item.parent_id));
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function normalizeRecursive(value: unknown, path: string): GraphNode[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as FlatItem & Record<string, unknown>;
  const childrenKey = ["children", "nodes", "child_nodes", "items"].find(
    (k) => Array.isArray(obj[k]),
  );
  const childrenRaw = childrenKey ? (obj[childrenKey] as unknown[]) : [];
  return [{
    id: path,
    nodeId: obj.id,
    label: String(obj.role ?? "node"),
    sub: subtitleFor(obj),
    meta: obj,
    children: childrenRaw.flatMap((c, i) => normalizeRecursive(c, `${path}.${i}`)),
  }];
}

function subtitleFor(item: FlatItem): string | undefined {
  const raw = item.name ?? item.text ?? item.value ?? item.url;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const s = String(raw);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}
