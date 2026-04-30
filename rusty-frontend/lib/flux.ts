"use client";

import { loadConfig } from "./config";
import { ApiError } from "./api";

export type FluxExecution = {
  execution_id: string;
  agent_id?: string;
  function_name?: string;
  status: string;
  output: string;
  error?: string | null;
  duration_ms?: number;
  started_at?: string;
  status_at?: string;
};

export type FluxNodeStatus = {
  cpu_percent: number;
  memory_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  active_tasks: number;
  uptime_seconds: number;
  collected_at: string;
};

export type FluxAgent = {
  id: string;
  address: string;
  active_count: number;
  status: "online" | "offline" | string;
  last_heartbeat: string;
  provider_id: string;
  instance_type: string;
  provider: string;
  node_status: FluxNodeStatus | null;
};

async function fluxRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = loadConfig();
  if (!cfg?.fluxUrl) throw new ApiError(0, "Flux URL not configured");
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (cfg.fluxKey) headers["X-API-Key"] = cfg.fluxKey;
  let res: Response;
  try {
    res = await fetch(`${cfg.fluxUrl}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : "Flux unreachable");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || `Flux ${res.status}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as unknown as Promise<T>;
}

export const flux = {
  health: () => fluxRequest<unknown>("/health"),
  listAgents: (signal?: AbortSignal) => fluxRequest<FluxAgent[]>("/agents", { signal }),
  getExecution: (id: string, signal?: AbortSignal) =>
    fluxRequest<FluxExecution>(`/executions/${id}`, { signal }),
  cancelExecution: (id: string) =>
    fluxRequest<unknown>(`/executions/${id}`, { method: "DELETE" }),
  terminateNode: (id: string) =>
    fluxRequest<unknown>(`/nodes/${id}`, { method: "DELETE" }),
  terminateAllNodes: () => fluxRequest<unknown>("/nodes", { method: "DELETE" }),
};
