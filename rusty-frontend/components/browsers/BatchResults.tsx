"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useState } from "react";

const PRE_CLASS = "font-mono text-[10.5px] whitespace-pre-wrap break-all max-h-64 overflow-auto wb-scroll";

const STATUS_TONE = { ok: "success", fail: "error", pending: "neutral" } as const;
const STATUS_LABEL = { ok: "OK", fail: "FAIL", pending: "…" } as const;

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
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

function ResultBody({ run }: { run: RunRecord }) {
  if (run.status === "fail") {
    return <pre className={`${PRE_CLASS} text-[var(--error)]`}>{run.error}</pre>;
  }

  const screenshot = extractStringField(run.result, "data");
  if (screenshot) {
    return (
      <div className="rounded border border-border bg-black overflow-hidden max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/jpeg;base64,${screenshot}`} alt="Screenshot" className="w-full h-auto" />
      </div>
    );
  }

  const html = extractStringField(run.result, "html");
  return <pre className={PRE_CLASS}>{html ?? format(run.result)}</pre>;
}

function previewOf(run: RunRecord): string | null {
  if (run.status === "fail") return run.error ?? "error";
  if (run.status === "pending") return null;
  const r = run.result;
  if (r === null || r === undefined) return null;
  if (typeof r === "string") return truncate(r);
  if (typeof r === "object") {
    const html = extractStringField(r, "html");
    if (html) return truncate(html);
    if (extractStringField(r, "data")) return "<image>";
    return truncate(JSON.stringify(r));
  }
  return String(r);
}

function truncate(s: string, max = 120): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function extractStringField(value: unknown, key: string): string | null {
  if (value && typeof value === "object" && key in value) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "string" && v.length > 0) return v;
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
