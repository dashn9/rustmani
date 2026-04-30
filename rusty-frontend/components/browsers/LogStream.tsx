"use client";

import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { parseAnsiLines, type AnsiSegment } from "@/lib/ansi";
import { cn } from "@/lib/cn";
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

  const { meta, text: rawText } = useMemo(() => extractMetaAndText(data), [data]);
  const lines = useMemo(() => parseAnsiLines(rawText).map(parseStructured), [rawText]);

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
      <div ref={ref} className={`${height} overflow-y-auto wb-scroll p-2 font-mono text-[11px] leading-relaxed`}>
        {error ? (
          <div className="text-[var(--error)]">{error.message}</div>
        ) : lines.length === 0 || (lines.length === 1 && lines[0].segs.length === 0) ? (
          <div className="text-white/40">Waiting for output…</div>
        ) : (
          lines.map((l, i) => <Line key={i} index={i + 1} line={l} />)
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

const LEVEL_CLS: Record<string, string> = {
  ERROR: "text-[oklch(0.78_0.20_25)]",
  WARN:  "text-[oklch(0.85_0.18_85)]",
  INFO:  "text-[oklch(0.78_0.16_148)]",
  DEBUG: "text-[oklch(0.74_0.13_240)]",
  TRACE: "text-[oklch(0.74_0.16_310)]",
};

type Structured = {
  segs: AnsiSegment[];
  ts?: string;
  level?: string;
  target?: string;
  body?: AnsiSegment[];
};

const TRACING_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(ERROR|WARN|INFO|DEBUG|TRACE)\s+([^:\s]+):\s?(.*)$/;

function parseStructured(segs: AnsiSegment[]): Structured {
  const text = segs.map((s) => s.text).join("");
  const m = text.match(TRACING_RE);
  if (!m) return { segs };
  const [, ts, level, target, msg] = m;
  // slice the ANSI segments to keep colors only on the message body.
  const headLen = text.length - msg.length;
  const body: AnsiSegment[] = [];
  let pos = 0;
  for (const s of segs) {
    const start = pos;
    const end = pos + s.text.length;
    pos = end;
    if (end <= headLen) continue;
    const cut = Math.max(0, headLen - start);
    body.push({ text: s.text.slice(cut), className: s.className });
  }
  return { segs, ts, level, target, body };
}

function Line({ index, line }: { index: number; line: Structured }) {
  if (!line.level) {
    return (
      <div className="group flex gap-2 px-1 hover:bg-white/[0.04] rounded">
        <span className="text-white/25 select-none w-8 text-right shrink-0 leading-relaxed">{index}</span>
        <MessageBody segs={line.segs} className="flex-1" />
      </div>
    );
  }
  return (
    <div className="group grid grid-cols-[2rem_auto_4rem_auto_1fr] gap-x-2 px-1 hover:bg-white/[0.04] rounded items-baseline">
      <span className="text-white/25 select-none text-right leading-relaxed">{index}</span>
      <span className="text-white/35 truncate leading-relaxed" title={line.ts}>
        {line.ts ? line.ts.slice(11, 23) : ""}
      </span>
      <span className={cn("font-bold leading-relaxed", LEVEL_CLS[line.level!] ?? "text-white/70")}>
        {line.level}
      </span>
      <span className="text-white/45 truncate leading-relaxed" title={line.target}>
        {line.target}
      </span>
      <MessageBody segs={line.body ?? line.segs} />
    </div>
  );
}

const COLLAPSE_THRESHOLD = 300;

function MessageBody({
  segs, className,
}: { segs: AnsiSegment[]; className?: string }) {
  const totalLen = segs.reduce((a, s) => a + s.text.length, 0);
  const newlines = segs.reduce((a, s) => a + (s.text.match(/\n/g)?.length ?? 0), 0);
  const collapsible = totalLen > COLLAPSE_THRESHOLD || newlines >= 3;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "whitespace-pre-wrap break-all relative",
          collapsible && !expanded && "max-h-[4.5em] overflow-hidden",
        )}
      >
        {segs.length === 0
          ? <span> </span>
          : segs.map((s, j) => (
              <span key={j} className={s.className || undefined}>{s.text}</span>
            ))}
        {collapsible && !expanded && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
            style={{ background: "linear-gradient(to top, var(--wb-950), transparent)" }}
            aria-hidden
          />
        )}
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[10px] text-white/40 hover:text-white/80"
        >
          {expanded
            ? "▴ collapse"
            : `▾ show ${totalLen.toLocaleString()} chars`}
        </button>
      )}
    </div>
  );
}

/**
 * Both `/browsers/{id}/logs/` (rusty-server) and `/executions/{id}` (flux)
 * eventually surface a flux-shaped execution payload. The rusty path wraps it
 * inside `{ logs: "<json string>" }`; flux returns it directly. Pull out both
 * the meta (status/duration/error) and the raw `output` text.
 */
function extractMetaAndText(data: unknown): { meta: FluxExecution | null; text: string } {
  if (!data) return { meta: null, text: "" };

  if (typeof data === "string") {
    const parsed = tryParseExecution(data);
    return parsed ? { meta: parsed, text: parsed.output ?? "" } : { meta: null, text: data };
  }

  if (Array.isArray(data)) {
    return { meta: null, text: data.map(String).join("\n") };
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as { logs?: unknown; output?: unknown };
    // Direct flux execution shape
    if (typeof obj.output === "string") {
      return { meta: data as FluxExecution, text: obj.output };
    }
    // Rusty wrapper: { logs: "<json string or raw output>" }
    if (typeof obj.logs === "string") {
      const parsed = tryParseExecution(obj.logs);
      return parsed
        ? { meta: parsed, text: parsed.output ?? "" }
        : { meta: null, text: obj.logs };
    }
    if (Array.isArray(obj.logs)) {
      return { meta: null, text: obj.logs.map(String).join("\n") };
    }
  }
  return { meta: null, text: "" };
}

function tryParseExecution(s: string): FluxExecution | null {
  const trimmed = s.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && "output" in parsed) {
      return parsed as FluxExecution;
    }
  } catch { /* not JSON */ }
  return null;
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
