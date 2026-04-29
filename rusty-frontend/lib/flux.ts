"use client";

import { loadConfig } from "./config";
import { ApiError, type Execution, type Node } from "./api";

async function fluxRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cfg = loadConfig();
  if (!cfg?.fluxUrl) throw new ApiError(0, "Flux URL not configured");
  let res: Response;
  try {
    res = await fetch(`${cfg.fluxUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : "Flux unreachable");
  }
  if (!res.ok) throw new ApiError(res.status, `Flux ${res.status}`);
  return res.json() as Promise<T>;
}

export const flux = {
  listAgents: () => fluxRequest<Node[]>("/agents"),
  getExecution: (id: string) => fluxRequest<Execution>(`/executions/${id}`),
  cancelExecution: (id: string) =>
    fluxRequest<void>(`/executions/${id}`, { method: "DELETE" }),
  listFunctions: () => fluxRequest<{ name: string; version: string }[]>("/functions"),
  terminateNode: (id: string) =>
    fluxRequest<void>(`/nodes/${id}`, { method: "DELETE" }),
};
