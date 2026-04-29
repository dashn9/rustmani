"use client";

import { loadConfig } from "./config";

export type BrowserStatus = "active" | "idle" | "error" | "spawning" | "closed";

export type Browser = {
  id: string;
  status: BrowserStatus;
  host?: string;
  grpc_port?: number;
  context_count?: number;
  flux_execution_id?: string;
  created_at?: string;
  geo?: string;
};

export type Node = {
  id: string;
  status: "online" | "offline";
  platform: "linux" | "windows" | "macos" | string;
  memory_used_mb: number;
  memory_limit_mb: number;
  cpu_percent: number;
  functions: string[];
  registered_at: string;
  uptime_seconds?: number;
};

export type Execution = {
  id: string;
  status: string;
  output: string[];
  started_at?: string;
  finished_at?: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

type ReqOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  baseOverride?: string;
  keyOverride?: string;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: ReqOptions = {}): Promise<T> {
  const cfg = loadConfig();
  const base = opts.baseOverride ?? cfg?.serverUrl;
  const key = opts.keyOverride ?? cfg?.apiKey ?? "";
  if (!base) throw new ApiError(0, "Not configured");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["X-API-Key"] = key;
  }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : "Network error");
  }

  const text = await res.text();
  let parsed: unknown = text;
  if (text && res.headers.get("content-type")?.includes("application/json")) {
    try { parsed = JSON.parse(text); } catch { /* leave as text */ }
  }

  if (!res.ok) {
    const msg = (parsed && typeof parsed === "object" && "message" in parsed)
      ? String((parsed as { message: unknown }).message)
      : res.statusText || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, parsed);
  }
  return parsed as T;
}

export const api = {
  ping: (baseOverride?: string, keyOverride?: string) =>
    request<Browser[]>("/browsers/", { baseOverride, keyOverride }),

  listBrowsers: (signal?: AbortSignal) => request<Browser[]>("/browsers/", { signal }),
  getBrowser: (id: string, signal?: AbortSignal) =>
    request<Browser>(`/browsers/${id}/`, { signal }),
  spawnBrowser: (geo?: string) =>
    request<Browser>("/browsers/", { method: "PUT", body: geo ? { geo } : {} }),
  closeBrowser: (id: string) =>
    request<void>(`/browsers/${id}/`, { method: "DELETE" }),
  closeAllBrowsers: () => request<void>("/browsers/", { method: "DELETE" }),

  createContext: (id: string) =>
    request<{ context_id: string }>(`/browsers/${id}/contexts/`, { method: "PUT" }),
  closeContext: (id: string, ctxId: string) =>
    request<void>(`/browsers/${id}/contexts/${ctxId}/`, { method: "DELETE" }),

  navigate: (id: string, url: string) =>
    request<void>(`/browsers/${id}/navigate/`, { method: "POST", body: { url } }),
  click: (id: string, x: number, y: number) =>
    request<void>(`/browsers/${id}/click/`, { method: "POST", body: { x, y } }),
  nodeClick: (id: string, node_id: string) =>
    request<void>(`/browsers/${id}/node-click/`, { method: "POST", body: { node_id } }),
  type: (id: string, text: string, node_id?: string) =>
    request<void>(`/browsers/${id}/type/`, { method: "POST", body: { text, node_id } }),
  scrollBy: (id: string, y: number) =>
    request<void>(`/browsers/${id}/scroll-by/`, { method: "POST", body: { y } }),
  scrollTo: (id: string, node_id: string) =>
    request<void>(`/browsers/${id}/scroll-to/`, { method: "POST", body: { node_id } }),
  evaluate: (id: string, script: string) =>
    request<{ result: unknown }>(`/browsers/${id}/eval/`, { method: "POST", body: { script } }),

  screenshot: (id: string) =>
    request<{ screenshot: string }>(`/browsers/${id}/screenshot/`, { method: "POST", body: {} }),
  fetchHtml: (id: string, node_id?: string) =>
    request<{ html: string }>(`/browsers/${id}/fetch-html/`, { method: "POST", body: { node_id } }),
  fetchText: (id: string, node_id: string) =>
    request<{ text: string }>(`/browsers/${id}/fetch-text/`, { method: "POST", body: { node_id } }),
  findNode: (id: string, selector: string) =>
    request<{ node_id: string }>(`/browsers/${id}/find-node/`, { method: "POST", body: { selector } }),
  waitForNode: (id: string, selector: string, timeout_ms?: number) =>
    request<{ node_id: string }>(`/browsers/${id}/wait-for-node/`, {
      method: "POST", body: { selector, timeout_ms },
    }),
  uiMap: (id: string, signal?: AbortSignal) =>
    request<unknown>(`/browsers/${id}/ui-map/`, { signal }),

  instruct: (id: string, instruction: string) =>
    request<void>(`/browsers/${id}/instruct/`, { method: "POST", body: { instruction } }),
  logs: (id: string, signal?: AbortSignal) =>
    request<{ output: string[] } | string[]>(`/browsers/${id}/logs/`, { signal }),

  teardown: () => request<void>("/teardown/", { method: "DELETE" }),
};
