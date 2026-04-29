"use client";

import { api } from "@/lib/api";
import { usePolling } from "@/lib/hooks";
import { useEffect, useRef, useState } from "react";

type Props = {
  browserId: string;
  height?: string;
};

export function LogStream({ browserId, height = "h-72" }: Props) {
  const [autoscroll, setAutoscroll] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const { data, error, loading } = usePolling(
    (s) => api.logs(browserId, s),
    2000,
    [browserId],
  );

  const lines = normalizeLogs(data);

  useEffect(() => {
    if (autoscroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines.length, autoscroll]);

  return (
    <div className="rounded-md border border-border bg-wb-950 text-wb-inverse">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[11px] text-white/60">
          {error ? "logs unavailable" : `${lines.length} lines${loading ? " · live" : ""}`}
        </span>
        <label className="flex items-center gap-1.5 text-[11px] text-white/70">
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
        ) : lines.length === 0 ? (
          <div className="text-white/40">Waiting for output…</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              <span className="text-white/30 mr-2 select-none">{String(i + 1).padStart(4, " ")}</span>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function normalizeLogs(data: unknown): string[] {
  if (!data) return [];
  if (typeof data === "object" && data !== null && "logs" in data) {
    const o = (data as { logs?: unknown }).logs;
    if (typeof o === "string") return o.split(/\r?\n/);
    if (Array.isArray(o)) return o.map(String);
  }
  if (typeof data === "string") return data.split(/\r?\n/);
  if (Array.isArray(data)) return data.map(String);
  return [];
}

export function FullLogView({ browserId }: { browserId: string }) {
  return <LogStream browserId={browserId} height="h-[60vh]" />;
}
