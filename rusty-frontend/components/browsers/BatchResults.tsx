"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useState } from "react";

export type RunStatus = "pending" | "ok" | "fail";

export type RunRecord = {
  id: string;
  status: RunStatus;
  durationMs?: number;
  result?: unknown;
  error?: string;
};

type Props = {
  runs: RunRecord[];
  busy: boolean;
  actionLabel: string;
  onRetryFailed: () => void;
  onClear: () => void;
};

export function BatchResults({ runs, busy, actionLabel, onRetryFailed, onClear }: Props) {
  const ok = runs.filter((r) => r.status === "ok").length;
  const fail = runs.filter((r) => r.status === "fail").length;
  const pending = runs.filter((r) => r.status === "pending").length;
  const totalMs = runs
    .filter((r) => r.durationMs !== undefined)
    .reduce((s, r) => s + (r.durationMs ?? 0), 0);

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-3 px-3 py-2 text-xs">
        <span className="font-medium">{actionLabel}</span>
        <span className="font-mono text-muted-foreground">
          {ok} ok
          {fail > 0 && <> · <span className="text-[var(--error)]">{fail} failed</span></>}
          {pending > 0 && <> · <span className="text-muted-foreground">{pending} pending</span></>}
          {runs.length > 0 && totalMs > 0 && <> · {Math.round(totalMs)}ms total</>}
        </span>
        <div className="ml-auto flex gap-1.5">
          {fail > 0 && !busy && (
            <Button size="sm" variant="secondary" onClick={onRetryFailed}>
              Retry {fail} failed
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClear}>Dismiss</Button>
        </div>
      </div>
      <ul className="max-h-96 overflow-auto wb-scroll divide-y divide-border">
        {runs.map((r) => <ResultRow key={r.id} run={r} />)}
      </ul>
    </div>
  );
}

function ResultRow({ run }: { run: RunRecord }) {
  const [expanded, setExpanded] = useState(false);
  const preview = previewOf(run);

  return (
    <li className="px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <StatusPill status={run.status} />
        <Link
          href={`/browsers/${run.id}`}
          className="font-mono text-[10.5px] text-muted-foreground hover:text-foreground truncate max-w-56"
        >
          {run.id}
        </Link>
        {run.durationMs !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {Math.round(run.durationMs)}ms
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {preview && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              className="text-[10.5px] text-muted-foreground hover:text-foreground"
            >
              {expanded ? "hide" : "details"}
            </button>
          )}
          {run.status === "ok" && (
            <button
              type="button"
              onClick={() => copy(run.result)}
              className="text-[10.5px] text-muted-foreground hover:text-foreground"
            >
              copy
            </button>
          )}
        </span>
      </div>
      {!expanded && preview && (
        <div className="mt-1 ml-7 truncate font-mono text-[10.5px] text-muted-foreground">
          {preview}
        </div>
      )}
      {expanded && (
        <div className="mt-2 ml-7">
          <ResultBody run={run} />
        </div>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: RunStatus }) {
  const styles =
    status === "ok" ? "bg-[var(--success)]/15 text-[var(--success)]"
    : status === "fail" ? "bg-[var(--error)]/15 text-[var(--error)]"
    : "bg-muted text-muted-foreground";
  const label = status === "ok" ? "OK" : status === "fail" ? "FAIL" : "…";
  return (
    <span className={`inline-flex h-5 min-w-9 items-center justify-center rounded px-1.5 font-mono text-[10px] font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function ResultBody({ run }: { run: RunRecord }) {
  if (run.status === "fail") {
    return (
      <pre className="font-mono text-[10.5px] text-[var(--error)] whitespace-pre-wrap break-all max-h-64 overflow-auto wb-scroll">
        {run.error}
      </pre>
    );
  }

  const screenshot = extractScreenshot(run.result);
  if (screenshot) {
    return (
      <div className="rounded border border-border bg-black overflow-hidden max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/jpeg;base64,${screenshot}`} alt="Screenshot" className="w-full h-auto" />
      </div>
    );
  }

  const html = extractHtml(run.result);
  if (html) {
    return (
      <pre className="font-mono text-[10.5px] whitespace-pre-wrap break-all max-h-64 overflow-auto wb-scroll">
        {html}
      </pre>
    );
  }

  return (
    <pre className="font-mono text-[10.5px] whitespace-pre-wrap break-all max-h-64 overflow-auto wb-scroll">
      {format(run.result)}
    </pre>
  );
}

function previewOf(run: RunRecord): string | null {
  if (run.status === "fail") return run.error ?? "error";
  if (run.status === "pending") return null;
  const r = run.result;
  if (r === null || r === undefined) return null;
  if (typeof r === "string") return r.length > 120 ? r.slice(0, 120) + "…" : r;
  if (typeof r === "object") {
    const html = extractHtml(r);
    if (html) return html.slice(0, 120) + (html.length > 120 ? "…" : "");
    if (extractScreenshot(r)) return "<image>";
    const compact = JSON.stringify(r);
    return compact.length > 120 ? compact.slice(0, 120) + "…" : compact;
  }
  return String(r);
}

function extractScreenshot(value: unknown): string | null {
  if (value && typeof value === "object" && "data" in value) {
    const d = (value as { data: unknown }).data;
    if (typeof d === "string" && d.length > 0) return d;
  }
  return null;
}

function extractHtml(value: unknown): string | null {
  if (value && typeof value === "object" && "html" in value) {
    const h = (value as { html: unknown }).html;
    if (typeof h === "string") return h;
  }
  return null;
}

function format(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function copy(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  navigator.clipboard?.writeText(text).catch(() => {});
}
