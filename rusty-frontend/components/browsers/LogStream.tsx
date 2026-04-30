"use client";

import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { parseAnsiLines, type AnsiSegment } from "@/lib/ansi";
import { flux, type FluxExecution } from "@/lib/flux";
import { usePolling } from "@/lib/hooks";
import { useEffect, useMemo, useRef, useState } from "react";

export type LogSource = "rusty" | "flux";

type Props = {
  executionId: string;
  source?: LogSource;
  height?: string;
};

export function LogStream({ executionId, source = "rusty", height = "h-72" }: Props) {
  const [autoscroll, setAutoscroll] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const { data, error, loading } = usePolling(
    (s) => source === "flux"
      ? flux.getExecution(executionId, s)
      : api.logs(executionId, s),
    2000,
    [executionId, source],
  );

  const rawText = useMemo(() => extractText(data), [data]);
  const lines = useMemo(() => parseAnsiLines(rawText), [rawText]);
  const meta = source === "flux" && data ? (data as FluxExecution) : null;

  useEffect(() => {
    if (autoscroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines.length, autoscroll]);

  return (
    <div className="rounded-md border border-border bg-wb-950 text-wb-inverse">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          {meta && <ExecutionMeta meta={meta} />}
          <span className="font-mono text-[11px] text-white/50 truncate">
            {error ? "logs unavailable" : `${lines.length} lines · ${source}${loading ? " · live" : ""}`}
          </span>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-white/70 shrink-0">
          <input
            type="checkbox"
            checked={autoscroll}
            onChange={(e) => setAutoscroll(e.target.checked)}
            className="h-3 w-3 accent-[var(--accent)]"
          />
          Auto-scroll
        </label>
      </div>
      <div ref={ref} className={`${height} overflow-y-auto wb-scroll p-3 font-mono text-[11px] leading-relaxed`}>
        {error ? (
          <div className="text-[var(--error)]">{error.message}</div>
        ) : lines.length === 0 || (lines.length === 1 && lines[0].length === 0) ? (
          <div className="text-white/40">Waiting for output…</div>
        ) : (
          lines.map((segs, i) => <Line key={i} index={i + 1} segs={segs} />)
        )}
      </div>
    </div>
  );
}

function ExecutionMeta({ meta }: { meta: FluxExecution }) {
  const tone = meta.status === "succeeded" || meta.status === "running"
    ? "success"
    : meta.status === "cancelled" || meta.status === "failed"
      ? "error"
      : "neutral";
  return (
    <>
      <Badge tone={tone}>{meta.status}</Badge>
      {meta.duration_ms != null && (
        <span className="font-mono text-[10px] text-white/50">
          {formatMs(meta.duration_ms)}
        </span>
      )}
      {meta.error && (
        <span className="font-mono text-[10px] text-[var(--error)] truncate" title={meta.error}>
          {meta.error}
        </span>
      )}
    </>
  );
}

function Line({ index, segs }: { index: number; segs: AnsiSegment[] }) {
  return (
    <div className="whitespace-pre-wrap break-all">
      <span className="text-white/30 mr-2 select-none">{String(index).padStart(4, " ")}</span>
      {segs.length === 0
        ? <span> </span>
        : segs.map((s, j) => (
            <span key={j} className={s.className || undefined}>{s.text}</span>
          ))}
    </div>
  );
}

function extractText(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(String).join("\n");
  if (typeof data === "object" && data !== null) {
    const obj = data as { logs?: unknown; output?: unknown };
    if (typeof obj.output === "string") return obj.output;
    if (typeof obj.logs === "string") return obj.logs;
    if (Array.isArray(obj.logs)) return obj.logs.map(String).join("\n");
  }
  return "";
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export function FullLogView({
  executionId, source,
}: { executionId: string; source?: LogSource }) {
  return <LogStream executionId={executionId} source={source} height="h-[60vh]" />;
}
