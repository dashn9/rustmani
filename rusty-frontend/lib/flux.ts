"use client";

import { loadConfig } from "./config";
import { ApiError } from "./api";

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
  getExecution: (id: string) => fluxRequest<string>(`/executions/${id}`),
  cancelExecution: (id: string) =>
    fluxRequest<unknown>(`/executions/${id}`, { method: "DELETE" }),
  terminateAllNodes: () => fluxRequest<unknown>("/nodes", { method: "DELETE" }),
};
